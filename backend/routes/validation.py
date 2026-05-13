"""
routes/validation.py — full rewrite

Key changes vs previous version:
  1. Versioning now backed by `dataset_versions` SQL table (models_versioning.py).
     No more JSON blob in Competition.datasets_json.
  2. ALL status changes (validate, flag, reject, un-reject) are open to any
     competition member — organiser gate removed.
  3. A sample can only be marked "validated" when >= 2 distinct contributors
     have submitted to the same competition (2-annotator rule).
  4. "rejected" samples can be moved back to any status (un-reject).
  5. Dynamic task-type columns, score breakdown, approval audit trail preserved.
"""

import json
from datetime import datetime, timezone

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Query
from sqlalchemy import func
from sqlalchemy.orm import Session

from models import DataSample, Competition, CompetitionOrganizer, UserProfile
from models_versioning import DatasetVersion
from services.validation_service import REQUIRED_APPROVALS
from .utils import get_db, get_current_user

router = APIRouter(tags=["validation"])

# ── Task-type → display columns ───────────────────────────────────────────────
TASK_COLUMNS = {
    "TEXT_CLASSIFICATION":  ["id","content","label","annotator","score","approvals","status","actions"],
    "NER":                  ["id","content","entities","annotator","score","approvals","status","actions"],
    "SENTIMENT_ANALYSIS":   ["id","content","sentiment","confidence","annotator","score","approvals","status","actions"],
    "TRANSLATION":          ["id","source","translation","lang_pair","annotator","score","approvals","status","actions"],
    "QUESTION_ANSWERING":   ["id","context","question","answer","annotator","score","approvals","status","actions"],
    "SUMMARIZATION":        ["id","document","summary","annotator","score","approvals","status","actions"],
    "AUDIO_SYNTHESIS":      ["id","prompt","audio","duration","annotator","score","approvals","status","actions"],
    "AUDIO_TRANSCRIPTION":  ["id","audio","transcript","annotator","score","approvals","status","actions"],
    "SPEECH_EMOTION":       ["id","audio","emotion","intensity","annotator","score","approvals","status","actions"],
    "AUDIO_EVENT_DETECTION":["id","audio","events","annotator","score","approvals","status","actions"],
}

COLUMN_LABELS = {
    "id": "ID", "content": "Content", "label": "Label", "entities": "Entities",
    "sentiment": "Sentiment", "confidence": "Confidence", "source": "Source Text",
    "translation": "Translation", "lang_pair": "Lang Pair", "context": "Context",
    "question": "Question", "answer": "Answer", "document": "Document",
    "summary": "Summary", "prompt": "Prompt", "audio": "Audio",
    "duration": "Duration", "transcript": "Transcript", "emotion": "Emotion",
    "intensity": "Intensity", "events": "Events", "annotator": "Annotator",
    "score": "Score", "approvals": "Approvals", "status": "Status", "actions": "Actions",
}


def _task_columns(task_type: str) -> list[str]:
    tt = (task_type or "TEXT_CLASSIFICATION").upper().replace(" ", "_")
    return TASK_COLUMNS.get(tt, TASK_COLUMNS["TEXT_CLASSIFICATION"])


def _parse_annotation(annotation) -> dict:
    if annotation is None:
        return {}
    if isinstance(annotation, dict):
        return annotation
    try:
        r = json.loads(annotation)
        return r if isinstance(r, dict) else {}
    except Exception:
        return {}


def _parse_json_list(value) -> list:
    """
    Safely coerce a value to a Python list.

    Handles three cases that can appear in the DB:
      1. Already a list (correct — Column(JSON) returning native Python).
      2. A JSON string encoding a list  e.g. '[{"user_id":…}]'
         (legacy rows written with json.dumps() before this fix).
      3. A double-encoded string  e.g. '"[{…}]"'  (old bug — two json.dumps calls).
    """
    if not value and value != 0:
        return []
    if isinstance(value, list):
        return value
    if isinstance(value, dict):
        return []
    # String path — may be single- or double-encoded
    if isinstance(value, str):
        try:
            result = json.loads(value)
            # Double-encoded: json.loads returned another string
            if isinstance(result, str):
                result = json.loads(result)
            return result if isinstance(result, list) else []
        except Exception:
            return []
    return []


def _require_access(competition_id: str, user_id: str, db: Session) -> bool:
    """
    Returns True if user is an organiser, False if participant.
    Raises 403 if not a member at all.
    """
    from models import CompetitionParticipant
    is_org = db.query(CompetitionOrganizer).filter(
        CompetitionOrganizer.competition_id == competition_id,
        CompetitionOrganizer.user_id == user_id,
    ).first()
    is_part = db.query(CompetitionParticipant).filter(
        CompetitionParticipant.competition_id == competition_id,
        CompetitionParticipant.user_id == user_id,
    ).first()
    if not is_org and not is_part:
        raise HTTPException(status_code=403, detail="Access denied")
    return bool(is_org)


def _default_reason_for_status(status: str) -> str | None:
    return {
        "pending":           "Submitted, awaiting automated scoring.",
        "scored":            f"Automated checks passed. Waiting for {REQUIRED_APPROVALS} annotator approvals.",
        "can_be_validated":  "Received enough annotator approvals. Can now be validated.",
        "flagged":           "Flagged by automated checks or an annotator. Needs review.",
        "rejected":          "Failed validation rules. Can be un-rejected by any team member.",
    }.get(status)


def _build_sample_row(s: DataSample, db: Session, task_type: str) -> dict:
    profile = db.query(UserProfile).filter(UserProfile.user_id == s.contributor_id).first()
    annotator_name = (profile.full_name if profile else None) or "Unknown"
    initials = "".join(w[0].upper() for w in annotator_name.split()[:2]) or "?"

    ann       = _parse_annotation(s.annotation)
    breakdown = _parse_json_list(getattr(s, "score_breakdown", None))
    approvals = _parse_json_list(getattr(s, "approvals_json", None))
    approval_count = getattr(s, "approval_count", 0) or len(
        [a for a in approvals if a.get("action") == "approve"]
    )
    flags_list = _parse_json_list(s.flags)

    try:
        quality_score = float(s.quality_score) if s.quality_score is not None else None
    except Exception:
        quality_score = None

    base = {
        "id":               str(s.id),
        "uid":              f"#{str(s.id)[:7].upper()}",
        "status":           s.status,
        "submitted_at":     str(s.submitted_at) if s.submitted_at else None,
        "sample_type":      "audio" if s.audio_url else "text",
        "annotator":        {"name": annotator_name, "initials": initials},
        "agreement":        quality_score,
        "score_breakdown":  breakdown,
        "approvals":        approvals,
        "approval_count":   approval_count,
        "approvals_needed": max(0, REQUIRED_APPROVALS - approval_count),
        "flags":            flags_list,
        "rejection_reason": flags_list[0] if flags_list else _default_reason_for_status(s.status),
        "version_tag":      s.version_tag,
        "task_type":        task_type,
        "content_snippet":  (s.text_content or "")[:80],
        "content":          (s.text_content or "")[:80],
    }

    tt = (task_type or "").upper().replace(" ", "_")

    if tt == "QUESTION_ANSWERING":
        base["context"]  = (s.text_content or "")[:120]
        base["question"] = ann.get("question", "—")
        base["answer"]   = ann.get("answer", "—")
    elif tt == "TRANSLATION":
        base["source"]      = (s.text_content or "")[:80]
        base["translation"] = ann.get("translation", ann.get("target", "—"))
        src = ann.get("source_lang", "EN")
        tgt = ann.get("target_lang", "")
        base["lang_pair"]   = f"{src}→{tgt}" if tgt else src
    elif tt == "SENTIMENT_ANALYSIS":
        base["sentiment"]  = ann.get("sentiment", "—")
        base["confidence"] = ann.get("confidence", None)
        base["label"]      = ann.get("sentiment", "—")
    elif tt == "NER":
        entities = ann.get("entities", [])
        base["entities"] = ", ".join(
            f"{e.get('text','?')} [{e.get('label','?')}]" for e in entities[:3]
        ) or "—"
        base["label"] = base["entities"]
    elif tt == "SUMMARIZATION":
        base["document"] = (s.text_content or "")[:80]
        base["summary"]  = (ann.get("summary", "") or "")[:80]
        base["label"]    = base["summary"]
    elif tt in ("AUDIO_SYNTHESIS", "AUDIO_TRANSCRIPTION"):
        base["prompt"]     = (ann.get("transcript", s.text_content) or "")[:80]
        base["audio"]      = s.audio_url or "—"
        base["duration"]   = s.audio_duration
        base["transcript"] = ann.get("transcript", "—")
        base["label"]      = base["transcript"]
    elif tt == "SPEECH_EMOTION":
        base["emotion"]   = ann.get("emotion", "—")
        base["intensity"] = ann.get("intensity", None)
        base["audio"]     = s.audio_url or "—"
        base["label"]     = ann.get("emotion", "—")
    elif tt == "AUDIO_EVENT_DETECTION":
        events = ann.get("events", [])
        base["events"] = f"{len(events)} event(s)" if events else "—"
        base["audio"]  = s.audio_url or "—"
        base["label"]  = base["events"]
    else:
        labels = ann.get("labels") or ann.get("label")
        if isinstance(labels, list):
            labels = ", ".join(labels)
        base["label"] = labels or "—"

    return base


# ─────────────────────────────────────────────────────────────────────────────
# GET /competitions/{competition_id}/my-role
# ─────────────────────────────────────────────────────────────────────────────

@router.get("/competitions/{competition_id}/my-role")
def my_role(competition_id: str, db: Session = Depends(get_db),
            current_user=Depends(get_current_user)):
    from models import CompetitionParticipant
    user_id = str(current_user.id)
    is_org = db.query(CompetitionOrganizer).filter(
        CompetitionOrganizer.competition_id == competition_id,
        CompetitionOrganizer.user_id == user_id).first()
    if is_org:
        return {"role": "organizer", "is_organizer": True}
    is_part = db.query(CompetitionParticipant).filter(
        CompetitionParticipant.competition_id == competition_id,
        CompetitionParticipant.user_id == user_id).first()
    if is_part:
        return {"role": "participant", "is_organizer": False}
    # Auto-assign as organiser if nobody else is
    org_count = db.query(CompetitionOrganizer).filter(
        CompetitionOrganizer.competition_id == competition_id).count()
    if org_count == 0:
        try:
            db.add(CompetitionOrganizer(
                competition_id=competition_id, user_id=user_id, role="owner"))
            db.commit()
        except Exception:
            db.rollback()
        return {"role": "organizer", "is_organizer": True}
    return {"role": "guest", "is_organizer": False}


# ─────────────────────────────────────────────────────────────────────────────
# GET /competitions/{competition_id}/samples
# ─────────────────────────────────────────────────────────────────────────────

@router.get("/competitions/{competition_id}/samples")
def list_samples(
    competition_id: str,
    status:    str | None = Query(None),
    search:    str | None = Query(None),
    page:      int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    version:   str | None = Query(None),
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    _require_access(competition_id, str(current_user.id), db)

    comp = db.query(Competition).filter(Competition.id == competition_id).first()
    task_type = (comp.task_type if comp else None) or "TEXT_CLASSIFICATION"

    q = db.query(DataSample).filter(DataSample.competition_id == competition_id)
    if version:
        q = q.filter(DataSample.version_tag == version)
    if status and status.lower() != "all":
        statuses = [s.strip() for s in status.split(",")]
        q = q.filter(DataSample.status.in_(statuses) if len(statuses) > 1
                     else DataSample.status == statuses[0])
    if search:
        q = q.filter(DataSample.text_content.ilike(f"%{search}%"))

    total   = q.count()
    samples = (q.order_by(DataSample.submitted_at.desc())
                .offset((page - 1) * page_size).limit(page_size).all())

    columns     = _task_columns(task_type)
    column_defs = [{"key": c, "label": COLUMN_LABELS.get(c, c.title())} for c in columns]

    return {
        "total":     total,
        "page":      page,
        "page_size": page_size,
        "pages":     max(1, (total + page_size - 1) // page_size),
        "task_type": task_type,
        "columns":   column_defs,
        "items":     [_build_sample_row(s, db, task_type) for s in samples],
    }


# ─────────────────────────────────────────────────────────────────────────────
# POST /data-samples/{sample_id}/approve
# Any member can approve / flag / reject a scored sample.
# ─────────────────────────────────────────────────────────────────────────────

@router.post("/data-samples/{sample_id}/approve")
def approve_sample(
    sample_id: str,
    body: dict,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    action = body.get("action", "approve")   # "approve" | "reject" | "flag"
    note   = body.get("note", "")

    sample = db.query(DataSample).filter(DataSample.id == sample_id).first()
    if not sample:
        raise HTTPException(status_code=404, detail="Sample not found")

    _require_access(sample.competition_id, str(current_user.id), db)

    user_id   = str(current_user.id)
    approvals = _parse_json_list(getattr(sample, "approvals_json", None))

    # Update or append this user's vote
    existing = next((a for a in approvals if a.get("user_id") == user_id), None)
    if existing:
        existing.update({"action": action, "note": note,
                         "timestamp": datetime.now(timezone.utc).isoformat()})
    else:
        profile = db.query(UserProfile).filter(UserProfile.user_id == user_id).first()
        approvals.append({
            "user_id":   user_id,
            "name":      (profile.full_name if profile else None) or "Unknown",
            "action":    action,
            "note":      note,
            "timestamp": datetime.now(timezone.utc).isoformat(),
        })

    # approvals_json is Column(JSON) — assign the Python list directly.
    # Never call json.dumps() on a JSON column; SQLAlchemy serialises it automatically.
    sample.approvals_json = approvals

    approve_count = len([a for a in approvals if a.get("action") == "approve"])
    sample.approval_count = approve_count

    if action == "reject":
        sample.status = "rejected"
        flags = _parse_json_list(sample.flags)
        flags.append(f"Rejected by {approvals[-1]['name']}: {note or 'No reason given'}")
        sample.flags = flags          # Column(JSON) — assign list, not json.dumps(list)
    elif action == "flag":
        sample.status = "flagged"
        flags = _parse_json_list(sample.flags)
        flags.append(f"Flagged by {approvals[-1]['name']}: {note or 'No reason given'}")
        sample.flags = flags          # Column(JSON) — assign list, not json.dumps(list)
    elif approve_count >= REQUIRED_APPROVALS:
        sample.status = "can_be_validated"

    db.commit()
    return {
        "id":               sample_id,
        "status":           sample.status,
        "approval_count":   approve_count,
        "approvals_needed": max(0, REQUIRED_APPROVALS - approve_count),
        "approvals":        approvals,
    }


# ─────────────────────────────────────────────────────────────────────────────
# PATCH /data-samples/{sample_id}/status
#
# OPEN TO ALL MEMBERS — no organiser gate.
# Supports any → any status transition, including un-rejecting.
# "validated" requires >= 2 distinct contributors in the competition.
# ─────────────────────────────────────────────────────────────────────────────

@router.patch("/data-samples/{sample_id}/status")
def update_sample_status(
    sample_id: str,
    body: dict,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    new_status = body.get("status", "").lower()
    allowed = {"validated", "flagged", "rejected", "pending", "scored", "can_be_validated"}
    if new_status not in allowed:
        raise HTTPException(status_code=400, detail=f"status must be one of {allowed}")

    sample = db.query(DataSample).filter(DataSample.id == sample_id).first()
    if not sample:
        raise HTTPException(status_code=404, detail="Sample not found")

    # Any member can do anything — just check they belong to this competition
    _require_access(sample.competition_id, str(current_user.id), db)

    # 2-annotator rule: "validated" requires REQUIRED_APPROVALS approvals
    # on THIS specific sample — not a competition-wide contributor count.
    # (A sample in "can_be_validated" already passed this check via the approve flow.)
    if new_status == "validated":
        approvals     = _parse_json_list(getattr(sample, "approvals_json", None))
        approve_count = len([a for a in approvals if a.get("action") == "approve"])
        if approve_count < REQUIRED_APPROVALS and sample.status != "can_be_validated":
            raise HTTPException(
                status_code=422,
                detail=(
                    f"Cannot validate: this sample needs {REQUIRED_APPROVALS} approvals "
                    f"but only has {approve_count}. "
                    "Have another team member click ✓ Approve on this sample first."
                ),
            )

    sample.status = new_status

    if "quality_score" in body:
        try:
            sample.quality_score = float(body["quality_score"])
        except Exception:
            pass

    db.commit()
    return {"id": sample_id, "status": sample.status}


# ─────────────────────────────────────────────────────────────────────────────
# GET /competitions/{competition_id}/table-config
# ─────────────────────────────────────────────────────────────────────────────

@router.get("/competitions/{competition_id}/table-config")
def table_config(competition_id: str, db: Session = Depends(get_db),
                 current_user=Depends(get_current_user)):
    _require_access(competition_id, str(current_user.id), db)
    comp = db.query(Competition).filter(Competition.id == competition_id).first()
    if not comp:
        raise HTTPException(status_code=404, detail="Competition not found")
    tt   = (comp.task_type or "TEXT_CLASSIFICATION").upper().replace(" ", "_")
    cols = _task_columns(tt)
    return {
        "task_type": tt,
        "columns":   [{"key": c, "label": COLUMN_LABELS.get(c, c.title())} for c in cols],
    }


# ─────────────────────────────────────────────────────────────────────────────
# POST /competitions/{competition_id}/revalidate
# Re-run validation pipeline on all pending/scored samples (background task).
# Open to any competition member.
# ─────────────────────────────────────────────────────────────────────────────

@router.post("/competitions/{competition_id}/revalidate")
async def revalidate_pending(
    competition_id: str,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    _require_access(competition_id, str(current_user.id), db)
    pending_count = db.query(DataSample).filter(
        DataSample.competition_id == competition_id,
        DataSample.status.in_(["pending", "scored"])).count()
    comp = db.query(Competition).filter(Competition.id == competition_id).first()
    task_type = (comp.task_type if comp else None) or "TEXT_CLASSIFICATION"
    background_tasks.add_task(_run_revalidation, competition_id, task_type)
    return {"message": f"Revalidation started for {pending_count} pending sample(s).",
            "pending": pending_count}


async def _run_revalidation(competition_id: str, task_type: str):
    from database import SessionLocal
    from services.validation_service import validate_sample as _validate
    db = SessionLocal()
    try:
        pending = db.query(DataSample).filter(
            DataSample.competition_id == competition_id,
            DataSample.status.in_(["pending", "scored"])).all()
        for sample in pending:
            ann    = _parse_annotation(sample.annotation)
            result = await _validate(text_content=sample.text_content, annotation=ann,
                                     task_type=task_type, run_ai=True)
            sample.status = result.status
            if result.quality_score is not None:
                sample.quality_score = float(result.quality_score)
            sample.flags = result.reasons   # Column(JSON) — assign list directly
            if hasattr(sample, "score_breakdown"):
                # score_breakdown is Column(JSON) — assign list directly, no json.dumps()
                sample.score_breakdown = getattr(result, "score_breakdown", [])
        db.commit()
    except Exception as exc:
        db.rollback()
        print(f"[revalidate] error: {exc}")
    finally:
        db.close()


# ─────────────────────────────────────────────────────────────────────────────
# GET /competitions/{competition_id}/versions
# Returns all non-deleted versions from the dataset_versions table.
# ─────────────────────────────────────────────────────────────────────────────

@router.get("/competitions/{competition_id}/versions")
def list_versions(
    competition_id: str,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    _require_access(competition_id, str(current_user.id), db)

    rows = (
        db.query(DatasetVersion)
        .filter(
            DatasetVersion.competition_id == competition_id,
            DatasetVersion.deleted == False,  # noqa: E712
        )
        .order_by(DatasetVersion.created_at.desc())
        .all()
    )

    result = []
    for i, v in enumerate(rows):
        creator = (
            db.query(UserProfile)
            .filter(UserProfile.user_id == v.created_by)
            .first()
        )
        creator_name = creator.full_name if creator else "Unknown"

        try:
            dt         = datetime.fromisoformat(v.created_at)
            date_label = dt.strftime("%b %d, %Y")
        except Exception:
            date_label = v.created_at or ""

        # Diff vs the version before (older = next in list since sorted desc)
        prev = rows[i + 1] if i + 1 < len(rows) else None
        diff = {}
        if prev:
            for k in ("total_samples", "validated_samples", "flagged_samples",
                      "rejected_samples", "pending_samples"):
                new_v  = getattr(v,    k, 0) or 0
                prev_v = getattr(prev, k, 0) or 0
                diff[k] = new_v - prev_v

        try:
            label_dist = json.loads(v.label_distribution_json or "{}")
        except Exception:
            label_dist = {}

        try:
            changelog = json.loads(v.changelog_json or "[]")
        except Exception:
            changelog = []

        result.append({
            "id":                  v.id,
            "tag":                 v.tag,
            "label":               v.label or "",
            "notes":               v.notes or "",
            "date":                date_label,
            "created_at":          v.created_at,
            "created_by":          creator_name,
            "total_samples":       v.total_samples,
            "validated_samples":   v.validated_samples,
            "flagged_samples":     v.flagged_samples,
            "rejected_samples":    v.rejected_samples,
            "pending_samples":     v.pending_samples,
            "label_distribution":  label_dist,
            "changelog":           changelog,
            "is_pinned":           v.is_pinned,
            "is_current":          i == 0,
            "deleted":             False,
            "diff":                diff,
        })

    return result


# ─────────────────────────────────────────────────────────────────────────────
# POST /competitions/{competition_id}/versions
# Creates a snapshot. Any member can create one.
# Stamps all currently-validated + un-tagged samples with the version tag.
# ─────────────────────────────────────────────────────────────────────────────

@router.post("/competitions/{competition_id}/versions")
def create_version(
    competition_id: str,
    body: dict,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    _require_access(competition_id, str(current_user.id), db)

    comp = db.query(Competition).filter(Competition.id == competition_id).first()
    if not comp:
        raise HTTPException(status_code=404, detail="Competition not found")

    # Determine tag
    existing_tags = [
        v.tag for v in db.query(DatasetVersion)
        .filter(DatasetVersion.competition_id == competition_id,
                DatasetVersion.deleted == False)  # noqa: E712
        .all()
    ]
    tag = (body.get("tag") or "").strip()
    if not tag:
        # Auto-increment from latest
        if not existing_tags:
            tag = "v1.0"
        else:
            latest = sorted(existing_tags, reverse=True)[0]
            try:
                parts = latest.lstrip("v").split(".")
                tag = f"v{int(parts[0])}.{int(parts[1]) + 1}"
            except Exception:
                tag = "v1.0"

    if tag in existing_tags:
        raise HTTPException(status_code=409, detail=f"Version {tag} already exists.")

    # Snapshot counts
    base_q   = db.query(DataSample).filter(DataSample.competition_id == competition_id)
    total     = base_q.count()
    validated = base_q.filter(DataSample.status == "validated").count()
    flagged   = base_q.filter(DataSample.status == "flagged").count()
    rejected  = base_q.filter(DataSample.status == "rejected").count()
    pending   = base_q.filter(DataSample.status.in_(["pending", "scored"])).count()

    # Label distribution snapshot
    all_samples = base_q.all()
    label_counts: dict = {}
    for s in all_samples:
        ann   = _parse_annotation(s.annotation)
        label = ann.get("label") or ann.get("labels") or ann.get("sentiment")
        if isinstance(label, list):
            label = label[0] if label else None
        lbl = str(label) if label else "Unlabeled"
        label_counts[lbl] = label_counts.get(lbl, 0) + 1

    # Changelog vs previous version
    prev_version = (
        db.query(DatasetVersion)
        .filter(DatasetVersion.competition_id == competition_id,
                DatasetVersion.deleted == False)  # noqa: E712
        .order_by(DatasetVersion.created_at.desc())
        .first()
    )
    changelog = []
    if prev_version:
        dv = validated - prev_version.validated_samples
        dt = total     - prev_version.total_samples
        if dv > 0:
            changelog.append(f"+{dv} newly validated samples added.")
        if dt > 0:
            changelog.append(f"{dt} new submissions since last snapshot.")
    if not changelog:
        changelog.append("No changes vs previous version.")

    # Stamp validated samples with this version tag (only un-tagged ones)
    db.query(DataSample).filter(
        DataSample.competition_id == competition_id,
        DataSample.status == "validated",
        DataSample.version_tag == None,  # noqa: E711
    ).update({"version_tag": tag}, synchronize_session=False)
    db.flush()

    # Insert the version row
    version_row = DatasetVersion(
        competition_id          = competition_id,
        created_by              = str(current_user.id),
        tag                     = tag,
        label                   = body.get("label", ""),
        notes                   = body.get("notes", ""),
        total_samples           = total,
        validated_samples       = validated,
        flagged_samples         = flagged,
        rejected_samples        = rejected,
        pending_samples         = pending,
        label_distribution_json = json.dumps(label_counts),
        changelog_json          = json.dumps(changelog),
        is_pinned               = False,
        deleted                 = False,
    )
    db.add(version_row)
    db.commit()
    db.refresh(version_row)

    try:
        dt         = datetime.fromisoformat(version_row.created_at)
        date_label = dt.strftime("%b %d, %Y")
    except Exception:
        date_label = version_row.created_at

    return {
        "id":                 version_row.id,
        "tag":                tag,
        "label":              version_row.label,
        "notes":              version_row.notes,
        "date":               date_label,
        "created_at":         version_row.created_at,
        "total_samples":      total,
        "validated_samples":  validated,
        "flagged_samples":    flagged,
        "rejected_samples":   rejected,
        "pending_samples":    pending,
        "label_distribution": label_counts,
        "changelog":          changelog,
        "is_pinned":          False,
        "is_current":         True,
        "deleted":            False,
        "diff":               {},
    }


# ─────────────────────────────────────────────────────────────────────────────
# PATCH /competitions/{competition_id}/versions/{tag}
# Edit label / notes only. Stats are immutable.
# ─────────────────────────────────────────────────────────────────────────────

@router.patch("/competitions/{competition_id}/versions/{tag}")
def update_version(
    competition_id: str,
    tag: str,
    body: dict,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    _require_access(competition_id, str(current_user.id), db)
    v = db.query(DatasetVersion).filter(
        DatasetVersion.competition_id == competition_id,
        DatasetVersion.tag == tag,
        DatasetVersion.deleted == False,  # noqa: E712
    ).first()
    if not v:
        raise HTTPException(status_code=404, detail=f"Version {tag} not found")
    if "label" in body:
        v.label = body["label"]
    if "notes" in body:
        v.notes = body["notes"]
    db.commit()
    return {"tag": v.tag, "label": v.label, "notes": v.notes}


# ─────────────────────────────────────────────────────────────────────────────
# DELETE /competitions/{competition_id}/versions/{tag}
# Soft-delete. Cannot delete the most recent version.
# Open to all members (it's their dataset).
# ─────────────────────────────────────────────────────────────────────────────

@router.delete("/competitions/{competition_id}/versions/{tag}")
def delete_version(
    competition_id: str,
    tag: str,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    _require_access(competition_id, str(current_user.id), db)

    versions = (
        db.query(DatasetVersion)
        .filter(DatasetVersion.competition_id == competition_id,
                DatasetVersion.deleted == False)  # noqa: E712
        .order_by(DatasetVersion.created_at.desc())
        .all()
    )
    if not versions:
        raise HTTPException(status_code=404, detail="No versions found")
    if versions[0].tag == tag:
        raise HTTPException(status_code=409, detail="Cannot delete the latest version.")

    v = next((x for x in versions if x.tag == tag), None)
    if not v:
        raise HTTPException(status_code=404, detail=f"Version {tag} not found")

    v.deleted = True
    db.commit()
    return {"deleted": True, "tag": tag}


# ─────────────────────────────────────────────────────────────────────────────
# POST /competitions/{competition_id}/versions/{tag}/pin
# PIN — marks a version for use in experiments. Unpins any previously pinned.
# ─────────────────────────────────────────────────────────────────────────────

@router.post("/competitions/{competition_id}/versions/{tag}/pin")
def pin_version(
    competition_id: str,
    tag: str,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    _require_access(competition_id, str(current_user.id), db)

    # Unpin all first
    db.query(DatasetVersion).filter(
        DatasetVersion.competition_id == competition_id,
    ).update({"is_pinned": False}, synchronize_session=False)

    v = db.query(DatasetVersion).filter(
        DatasetVersion.competition_id == competition_id,
        DatasetVersion.tag == tag,
        DatasetVersion.deleted == False,  # noqa: E712
    ).first()
    if not v:
        raise HTTPException(status_code=404, detail=f"Version {tag} not found")

    v.is_pinned = True
    db.commit()
    return {"pinned": True, "tag": tag}


# ─────────────────────────────────────────────────────────────────────────────
# DELETE /competitions/{competition_id}/versions/pin
# UNPIN all versions.
# ─────────────────────────────────────────────────────────────────────────────

@router.delete("/competitions/{competition_id}/versions/pin")
def unpin_version(
    competition_id: str,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    _require_access(competition_id, str(current_user.id), db)
    db.query(DatasetVersion).filter(
        DatasetVersion.competition_id == competition_id,
    ).update({"is_pinned": False}, synchronize_session=False)
    db.commit()
    return {"pinned": False}


# ─────────────────────────────────────────────────────────────────────────────
# GET /competitions/{competition_id}/pinned-version
# ─────────────────────────────────────────────────────────────────────────────

@router.get("/competitions/{competition_id}/pinned-version")
def get_pinned_version(
    competition_id: str,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    _require_access(competition_id, str(current_user.id), db)
    v = db.query(DatasetVersion).filter(
        DatasetVersion.competition_id == competition_id,
        DatasetVersion.is_pinned == True,  # noqa: E712
        DatasetVersion.deleted == False,   # noqa: E712
    ).first()
    if not v:
        return {"pinned": False, "tag": None, "version": None}
    return {"pinned": True, "tag": v.tag, "version": {"tag": v.tag, "label": v.label}}


# ─────────────────────────────────────────────────────────────────────────────
# GET /competitions/{competition_id}/data-health
# ─────────────────────────────────────────────────────────────────────────────

@router.get("/competitions/{competition_id}/data-health")
def data_health(
    competition_id: str,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    _require_access(competition_id, str(current_user.id), db)

    def cnt(st):
        return db.query(DataSample).filter(
            DataSample.competition_id == competition_id,
            DataSample.status == st,
        ).count()

    total     = db.query(DataSample).filter(DataSample.competition_id == competition_id).count()
    validated = cnt("validated")
    flagged   = cnt("flagged")
    rejected  = cnt("rejected")
    pending   = cnt("pending") + cnt("scored") + cnt("can_be_validated")

    all_s        = db.query(DataSample).filter(DataSample.competition_id == competition_id).all()
    text_lengths = [len((s.text_content or "").split()) for s in all_s if s.text_content]
    avg_text_len = round(sum(text_lengths) / len(text_lengths), 1) if text_lengths else 0

    label_counts: dict = {}
    for s in all_s:
        ann   = _parse_annotation(s.annotation)
        label = ann.get("label") or ann.get("labels") or ann.get("sentiment")
        if isinstance(label, list):
            label = label[0] if label else None
        lbl = str(label) if label else "Unlabeled"
        label_counts[lbl] = label_counts.get(lbl, 0) + 1

    alerts = []
    if total > 0:
        if len(label_counts) > 1:
            for lbl, count in label_counts.items():
                if count / total > 0.80:
                    alerts.append({
                        "level": "critical", "type": "Class Imbalance",
                        "detail": f'"{lbl}" represents {round(count / total * 100)}% of samples.',
                    })
                    break
        if flagged > 0:
            alerts.append({
                "level": "warning", "type": "Flagged Samples",
                "detail": f"{flagged} sample{'s' if flagged != 1 else ''} need review",
            })
        if rejected > 0:
            alerts.append({
                "level": "warning", "type": "Rejected Samples",
                "detail": f"{rejected} sample{'s' if rejected != 1 else ''} failed validation",
            })

    return {
        "total": total, "validated": validated, "flagged": flagged,
        "rejected": rejected, "pending": pending,
        "avg_text_length": avg_text_len,
        "label_distribution": label_counts,
        "alerts": alerts,
    }


# ─────────────────────────────────────────────────────────────────────────────
# GET /competitions/{competition_id}/export
# ─────────────────────────────────────────────────────────────────────────────

@router.get("/competitions/{competition_id}/export")
def export_dataset(
    competition_id: str,
    format: str = Query("csv", regex="^(csv|json|conll)$"),
    version: str | None = Query(None),
    status_filter: str = Query("validated"),
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    import csv as csv_mod, io
    from fastapi.responses import StreamingResponse

    _require_access(competition_id, str(current_user.id), db)
    q = db.query(DataSample).filter(DataSample.competition_id == competition_id)
    if version:
        q = q.filter(DataSample.version_tag == version)
    if status_filter and status_filter.lower() != "all":
        q = q.filter(DataSample.status == status_filter.lower())
    samples = q.order_by(DataSample.submitted_at.asc()).all()

    if not samples:
        raise HTTPException(status_code=404,
                            detail=f"No {status_filter} samples found.")

    comp      = db.query(Competition).filter(Competition.id == competition_id).first()
    task_type = (comp.task_type if comp else None) or "TEXT_CLASSIFICATION"

    rows = []
    for s in samples:
        row_data = _build_sample_row(s, db, task_type)
        ann      = _parse_annotation(s.annotation)
        rows.append({
            "id":            str(s.id),
            "text_content":  s.text_content or "",
            "annotation":    json.dumps(ann),
            "status":        s.status,
            "quality_score": s.quality_score or "",
            "task_type":     task_type,
            "submitted_at":  str(s.submitted_at) if s.submitted_at else "",
            "version_tag":   s.version_tag or "",
            "approvals":     s.approval_count or 0,
            **{k: str(v) for k, v in row_data.items()
               if k in ("label", "question", "answer", "translation",
                        "sentiment", "summary", "emotion", "entities")},
        })

    if format == "json":
        content = json.dumps(rows, ensure_ascii=False, indent=2)
        return StreamingResponse(
            iter([content]), media_type="application/json",
            headers={"Content-Disposition":
                     f'attachment; filename="dataset-{competition_id}.json"'})

    output = io.StringIO()
    if rows:
        writer = csv_mod.DictWriter(output, fieldnames=rows[0].keys())
        writer.writeheader()
        writer.writerows(rows)
    return StreamingResponse(
        iter([output.getvalue()]), media_type="text/csv",
        headers={"Content-Disposition":
                 f'attachment; filename="dataset-{competition_id}.csv"'})