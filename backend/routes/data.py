"""
routes/data.py  (updated)

All sample submission endpoints now run the validation pipeline
BEFORE inserting into the database. The assigned status comes
directly from the ValidationResult — never hardcoded to "pending".
"""

import csv
import io
import json
import uuid
from datetime import datetime

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from sqlalchemy import func
from sqlalchemy.orm import Session

from models import Competition, DataSample, CompetitionPrompt, UserProfile
from schemas import DataSampleIn
from supabase_client import supabase
from services.validation_service import validate_sample   # ← new import
from .utils import get_db, get_current_user

router = APIRouter(tags=["data"])


# ─────────────────────────────────────────────────────────────────────────────
# Prompt rotation
# ─────────────────────────────────────────────────────────────────────────────

@router.get("/competitions/{competition_id}/prompts/next")
def get_next_prompt(competition_id: str, db: Session = Depends(get_db)):
    """Returns the least-used prompt for this competition."""
    prompt = (
        db.query(CompetitionPrompt)
        .filter(CompetitionPrompt.competition_id == competition_id)
        .order_by(CompetitionPrompt.used_count.asc())
        .first()
    )
    if not prompt:
        raise HTTPException(status_code=404, detail="No prompts available")
    prompt.used_count += 1
    db.commit()
    return {"id": prompt.id, "content": prompt.content, "difficulty": prompt.difficulty}


# ─────────────────────────────────────────────────────────────────────────────
# Text sample  (validated BEFORE insert)
# ─────────────────────────────────────────────────────────────────────────────

@router.post("/data-samples")
async def create_text_sample(
    body: DataSampleIn,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """
    Submit a text-based data sample.

    Validation runs first; the sample is only written to the DB once
    a status has been assigned by the pipeline.
    Clients receive a 422 with detail when the sample is outright rejected,
    so the user can correct and resubmit.
    """
    # Fetch the competition's task_type to pass to the AI validator
    comp = db.query(Competition).filter(Competition.id == body.competition_id).first()
    task_type = comp.task_type if comp else "TEXT_PROCESSING"

    # ── Run validation pipeline ───────────────────────────────────────────
    result = await validate_sample(
        text_content=body.text_content,
        annotation=body.annotation,
        task_type=task_type or "TEXT_PROCESSING",
        run_ai=True,
    )

    # Hard reject: return an error so the frontend can inform the contributor
    if result.status == "rejected":
        raise HTTPException(
            status_code=422,
            detail={
                "status": "rejected",
                "reasons": result.reasons,
                "message": "Sample did not pass validation and was not saved.",
            },
        )

    # ── Insert with the validated/flagged status ──────────────────────────
    sample = DataSample(
        competition_id=body.competition_id,
        contributor_id=current_user.id,
        text_content=body.text_content,
        annotation=json.dumps(body.annotation or {}),
        status=result.status,                          # never hardcoded
        quality_score=str(result.quality_score) if result.quality_score is not None else None,
        submitted_at=datetime.utcnow().isoformat(),
    )
    db.add(sample)
    db.commit()
    db.refresh(sample)

    return {
        "id": sample.id,
        "status": sample.status,
        "quality_score": result.quality_score,
        "validation_notes": result.reasons,
    }


# ─────────────────────────────────────────────────────────────────────────────
# Audio sample  (lightweight validation — no AI on binary blobs)
# ─────────────────────────────────────────────────────────────────────────────

@router.post("/data-samples/audio")
async def create_audio_sample(
    audio: UploadFile = File(...),
    competition_id: str = Form(...),
    annotation: str = Form(...),
    audio_duration: float = Form(0),
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """
    Submit an audio recording.

    We validate the annotation JSON before uploading audio to storage
    so we don't waste bandwidth on structurally invalid submissions.
    Audio itself is validated at the media level (duration > 0).
    """
    # Parse annotation
    try:
        ann_dict = json.loads(annotation)
    except json.JSONDecodeError:
        raise HTTPException(status_code=422, detail="annotation must be valid JSON")

    # Basic structural validation (no AI for audio — skip run_ai)
    result = await validate_sample(
        text_content=ann_dict.get("transcript", "placeholder"),  # use transcript if present
        annotation=ann_dict,
        task_type="AUDIO SYNTHESIS",
        run_ai=False,   # AI text scoring not applicable to audio blobs
    )

    # Reject entirely invalid audio submissions
    if result.status == "rejected":
        raise HTTPException(
            status_code=422,
            detail={"status": "rejected", "reasons": result.reasons},
        )

    # Duration sanity check — flag zero-length recordings
    derived_status = result.status
    if audio_duration <= 0:
        derived_status = "flagged"

    sample_id    = str(uuid.uuid4())
    storage_path = f"{competition_id}/{sample_id}.wav"
    audio_bytes  = await audio.read()

    supabase.storage.from_("audio-samples").upload(
        storage_path, audio_bytes, {"content-type": "audio/wav"}
    )

    sample = DataSample(
        id=sample_id,
        competition_id=competition_id,
        contributor_id=current_user.id,
        audio_url=storage_path,
        audio_duration=str(audio_duration),
        annotation=annotation,
        status=derived_status,
        submitted_at=datetime.utcnow().isoformat(),
    )
    db.add(sample)
    db.commit()
    return {"id": sample_id, "status": derived_status}


# ─────────────────────────────────────────────────────────────────────────────
# Bulk import  (fast-path: rule-based only, no AI per row)
# ─────────────────────────────────────────────────────────────────────────────

@router.post("/competitions/{competition_id}/samples/bulk")
async def bulk_import(
    competition_id: str,
    files: list[UploadFile] = File(...),
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """
    Bulk-import .csv or .jsonl files.

    Each row is validated with run_ai=False (fast rule-based pass).
    Rows that are rejected are counted separately and NOT inserted.
    Rows that pass with status "flagged" or "validated" are inserted.
    """
    inserted = 0
    rejected = 0

    for f in files:
        content = (await f.read()).decode("utf-8")
        rows_to_insert = []

        raw_rows = []
        if f.filename.endswith(".jsonl"):
            for line in content.strip().splitlines():
                obj = json.loads(line)
                raw_rows.append({
                    "text_content": obj.get("text_content"),
                    "annotation": obj.get("annotation", {}),
                })
        elif f.filename.endswith(".csv"):
            reader = csv.DictReader(io.StringIO(content))
            for row in reader:
                raw_rows.append({
                    "text_content": row.get("text_content", ""),
                    "annotation": {"label": row.get("label", "")},
                })

        for row in raw_rows:
            # Validate each row (no AI for bulk speed)
            result = await validate_sample(
                text_content=row["text_content"],
                annotation=row["annotation"],
                task_type="TEXT_PROCESSING",
                run_ai=False,
            )
            if result.status == "rejected":
                rejected += 1
                continue  # DO NOT insert rejected rows

            rows_to_insert.append(DataSample(
                competition_id=competition_id,
                contributor_id=current_user.id,
                text_content=row["text_content"],
                annotation=json.dumps(row["annotation"]),
                status=result.status,
                quality_score=str(result.quality_score) if result.quality_score else None,
                submitted_at=datetime.utcnow().isoformat(),
            ))

        db.add_all(rows_to_insert)
        inserted += len(rows_to_insert)

    db.commit()
    return {"inserted": inserted, "rejected": rejected}


# ─────────────────────────────────────────────────────────────────────────────
# Stats helpers (unchanged from original)
# ─────────────────────────────────────────────────────────────────────────────

@router.get("/data-samples/count")
def sample_count(competition_id: str, db: Session = Depends(get_db)):
    count = db.query(DataSample).filter(DataSample.competition_id == competition_id).count()
    return {"count": count}


@router.get("/competitions/{competition_id}/my-stats")
def my_stats(
    competition_id: str,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    base = db.query(DataSample).filter(
        DataSample.competition_id == competition_id,
        DataSample.contributor_id == current_user.id,
    )
    return {
        "validated": base.filter(DataSample.status == "validated").count(),
        "flagged":   base.filter(DataSample.status == "flagged").count(),
        "pending":   base.filter(DataSample.status == "pending").count(),
    }


@router.get("/competitions/{competition_id}/team-stats")
def team_stats(competition_id: str, db: Session = Depends(get_db)):
    total = db.query(DataSample).filter(DataSample.competition_id == competition_id).count()

    rows = (
        db.query(DataSample.contributor_id, func.count(DataSample.id).label("cnt"))
        .filter(DataSample.competition_id == competition_id)
        .group_by(DataSample.contributor_id)
        .order_by(func.count(DataSample.id).desc())
        .limit(5)
        .all()
    )

    members = []
    for contributor_id, cnt in rows:
        profile  = db.query(UserProfile).filter(UserProfile.user_id == contributor_id).first()
        name     = profile.full_name if profile else "Unknown"
        initials = "".join(w[0].upper() for w in name.split()[:2])
        members.append({
            "id": contributor_id,
            "name": name,
            "initials": initials,
            "role": "Contributor",
            "count": cnt,
            "today": 0,
        })

    return {"total": total, "members": members}