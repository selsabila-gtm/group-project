import csv
import io
import json
import uuid
from datetime import datetime

from fastapi import APIRouter, Depends, File, Form, Header, HTTPException, UploadFile
from sqlalchemy import func
from sqlalchemy.orm import Session

from models import Competition, DataSample, CompetitionPrompt, UserProfile
from schemas import DataSampleIn
from supabase_client import supabase
from .utils import get_db, get_current_user

router = APIRouter(tags=["data"])


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


@router.post("/data-samples")
def create_text_sample(
    body: DataSampleIn,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """Submit a text-based data sample."""
    sample = DataSample(
        competition_id=body.competition_id,
        contributor_id=current_user.id,
        text_content=body.text_content,
        annotation=json.dumps(body.annotation or {}),
        status="pending",
        submitted_at=datetime.utcnow().isoformat(),
    )
    db.add(sample)
    db.commit()
    db.refresh(sample)
    return {"id": sample.id, "status": sample.status}


@router.post("/data-samples/audio")
async def create_audio_sample(
    audio: UploadFile = File(...),
    competition_id: str = Form(...),
    annotation: str = Form(...),
    audio_duration: float = Form(0),
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """Submit an audio recording (AUDIO SYNTHESIS competitions)."""
    sample_id = str(uuid.uuid4())
    storage_path = f"{competition_id}/{sample_id}.wav"
    audio_bytes = await audio.read()

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
        status="pending",
        submitted_at=datetime.utcnow().isoformat(),
    )
    db.add(sample)
    db.commit()
    return {"id": sample_id, "status": "pending"}


@router.post("/competitions/{competition_id}/samples/bulk")
async def bulk_import(
    competition_id: str,
    files: list[UploadFile] = File(...),
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """Bulk-import .csv or .jsonl files."""
    inserted = 0
    for f in files:
        content = (await f.read()).decode("utf-8")
        rows = []
        if f.filename.endswith(".jsonl"):
            for line in content.strip().splitlines():
                obj = json.loads(line)
                rows.append(DataSample(
                    competition_id=competition_id,
                    contributor_id=current_user.id,
                    text_content=obj.get("text_content"),
                    annotation=json.dumps(obj.get("annotation", {})),
                    status="pending",
                    submitted_at=datetime.utcnow().isoformat(),
                ))
        elif f.filename.endswith(".csv"):
            reader = csv.DictReader(io.StringIO(content))
            for row in reader:
                rows.append(DataSample(
                    competition_id=competition_id,
                    contributor_id=current_user.id,
                    text_content=row.get("text_content", ""),
                    annotation=json.dumps({"label": row.get("label", "")}),
                    status="pending",
                    submitted_at=datetime.utcnow().isoformat(),
                ))
        db.add_all(rows)
        inserted += len(rows)

    db.commit()
    return {"inserted": inserted}


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
        "flagged": base.filter(DataSample.status == "flagged").count(),
        "pending": base.filter(DataSample.status == "pending").count(),
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
        profile = db.query(UserProfile).filter(UserProfile.user_id == contributor_id).first()
        name = profile.full_name if profile else "Unknown"
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
