"""
routes/validation.py  — full rewrite supporting all 4 requirements

1. Dynamic columns per task type (DATASET_CONFIGS-aware)
2. Detailed score breakdown returned per sample
3. Manual 2-annotator approval flow (status: pending→scored→can_be_validated→validated)
4. Full annotator audit trail stored and returned
"""
import json
from datetime import datetime, timezone

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from models import DataSample, Competition, CompetitionOrganizer, UserProfile
from services.validation_service import REQUIRED_APPROVALS
from .utils import get_db, get_current_user

router = APIRouter(tags=["validation"])

# ── Task-type → display columns mapping (mirrors DATASET_CONFIGS) ─────────────
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
    "id":          "ID",
    "content":     "Content",
    "label":       "Label",
    "entities":    "Entities",
    "sentiment":   "Sentiment",
    "confidence":  "Confidence",
    "source":      "Source Text",
    "translation": "Translation",
    "lang_pair":   "Lang Pair",
    "context":     "Context",
    "question":    "Question",
    "answer":      "Answer",
    "document":    "Document",
    "summary":     "Summary",
    "prompt":      "Prompt",
    "audio":       "Audio",
    "duration":    "Duration",
    "transcript":  "Transcript",
    "emotion":     "Emotion",
    "intensity":   "Intensity",
    "events":      "Events",
    "annotator":   "Annotator",
    "score":       "Score",
    "approvals":   "Approvals",
    "status":      "Status",
    "actions":     "Actions",
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
    Parse a value that may be:
    - Already a list (jsonb returned by PostgreSQL as Python list)
    - A JSON string (text column stored with json.dumps)
    - None / empty
    """
    if not value:
        return []
    if isinstance(value, list):
        return value
    if isinstance(value, dict):
        return []   # wrong type, ignore
    try:
        r = json.loads(value)
        return r if isinstance(r, list) else []
    except Exception:
        return []


def _require_access(competition_id: str, user_id: str, db: Session) -> bool:
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


def _load_store(comp): 
    try:
        raw = json.loads(comp.datasets_json) if comp.datasets_json else {}
    except Exception:
        raw = {}
    return raw if isinstance(raw, dict) else {"datasets": raw, "versions": []}


def _save_store(comp, store, db):
    comp.datasets_json = json.dumps(store)
    db.commit()


def _parse_versions(comp) -> list:
    return _load_store(comp).get("versions", [])


def _next_version_tag(versions):
    if not versions:
        return "v1.0"
    latest = versions[0].get("tag", "v1.0")
    try:
        parts = latest.lstrip("v").split(".")
        return f"v{int(parts[0])}.{int(parts[1]) + 1}"
    except Exception:
        return "v1.0"


def _compute_diff(new_stats, prev_stats):
    if prev_stats is None:
        return {}
    keys = ["total_samples","validated_samples","flagged_samples","rejected_samples","pending_samples"]
    return {k: new_stats.get(k,0) - prev_stats.get(k,0) for k in keys
            if k in new_stats or k in prev_stats}


def _build_sample_row(s: DataSample, db: Session, task_type: str) -> dict:
    """Build a table row dict for a sample, with all task-specific fields."""
    profile = db.query(UserProfile).filter(UserProfile.user_id == s.contributor_id).first()
    annotator_name = (profile.full_name if profile else None) or "Unknown"
    initials = "".join(w[0].upper() for w in annotator_name.split()[:2]) or "?"

    ann = _parse_annotation(s.annotation)

    # Score breakdown
    breakdown = _parse_json_list(getattr(s, "score_breakdown", None))

    # Approvals audit trail
    approvals = _parse_json_list(getattr(s, "approvals_json", None))
    approval_count = getattr(s, "approval_count", 0) or len([a for a in approvals if a.get("action") == "approve"])

    try:
        quality_score = float(s.quality_score) if s.quality_score is not None else None
    except Exception:
        quality_score = None

    flags_list = _parse_json_list(s.flags)
    sample_id  = str(s.id)

    # Default reason
    default_reason = _default_reason_for_status(s.status)

    base = {
        "id":              sample_id,
        "uid":             f"#{sample_id[:7].upper()}",
        "status":          s.status,
        "submitted_at":    str(s.submitted_at) if s.submitted_at else None,
        "sample_type":     "audio" if s.audio_url else "text",
        "annotator":       {"name": annotator_name, "initials": initials},
        "agreement":       quality_score,
        "score_breakdown": breakdown,
        "approvals":       approvals,
        "approval_count":  approval_count,
        "approvals_needed": max(0, REQUIRED_APPROVALS - approval_count),
        "flags":           flags_list,
        "rejection_reason": flags_list[0] if flags_list else default_reason,
        "version_tag":     s.version_tag,
        "task_type":       task_type,
        # Task-agnostic content fields — "content" is the column key, "content_snippet" is the alias
        "content_snippet": (s.text_content or "")[:80],
        "content":         (s.text_content or "")[:80],   # matches column key "content"
    }

    # Task-specific fields
    tt = (task_type or "").upper().replace(" ", "_")

    if tt == "QUESTION_ANSWERING":
        base["context"]  = (s.text_content or "")[:120]
        base["question"] = ann.get("question", "—")
        base["answer"]   = ann.get("answer", "—")

    elif tt == "TRANSLATION":
        base["source"]      = (s.text_content or "")[:80]
        base["translation"] = ann.get("translation", ann.get("target", "—"))
        src  = ann.get("source_lang", "EN")
        tgt  = ann.get("target_lang", "")
        base["lang_pair"]   = f"{src}→{tgt}" if tgt else src

    elif tt == "SENTIMENT_ANALYSIS":
        base["sentiment"]   = ann.get("sentiment", "—")
        base["confidence"]  = ann.get("confidence", None)
        base["label"]       = ann.get("sentiment", "—")

    elif tt == "NER":
        entities = ann.get("entities", [])
        base["entities"] = ", ".join(
            f"{e.get('text','?')} [{e.get('label','?')}]" for e in entities[:3]
        ) or "—"
        base["label"]    = base["entities"]

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
        base["emotion"]    = ann.get("emotion", "—")
        base["intensity"]  = ann.get("intensity", None)
        base["audio"]      = s.audio_url or "—"
        base["label"]      = ann.get("emotion", "—")

    elif tt == "AUDIO_EVENT_DETECTION":
        events = ann.get("events", [])
        base["events"] = f"{len(events)} event(s)" if events else "—"
        base["audio"]  = s.audio_url or "—"
        base["label"]  = base["events"]

    else:
        # TEXT_CLASSIFICATION and default
        labels = ann.get("labels") or ann.get("label")
        if isinstance(labels, list):
            labels = ", ".join(labels)
        base["label"] = labels or "—"

    return base


def _default_reason_for_status(status: str) -> str | None:
    return {
        "pending": "Submitted, awaiting automated scoring.",
        "scored": (
            f"Automated checks passed. Waiting for {REQUIRED_APPROVALS} "
            "annotator approvals before it can be validated."
        ),
        "can_be_validated": "Received enough annotator approvals. An organiser can now validate this sample.",
        "flagged": "Flagged by automated checks or an annotator. Needs review.",
        "rejected": "Failed automated validation rules. See score breakdown for details.",
    }.get(status)


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
    org_count = db.query(CompetitionOrganizer).filter(
        CompetitionOrganizer.competition_id == competition_id).count()
    if org_count == 0:
        try:
            db.add(CompetitionOrganizer(competition_id=competition_id, user_id=user_id, role="owner"))
            db.commit()
        except Exception:
            db.rollback()
        return {"role": "organizer", "is_organizer": True}
    return {"role": "guest", "is_organizer": False}


# ─────────────────────────────────────────────────────────────────────────────
# GET /competitions/{competition_id}/samples
# Returns paginated rows with dynamic task-type columns
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
        # Support comma-separated status filter
        statuses = [s.strip() for s in status.split(",")]
        if len(statuses) == 1:
            q = q.filter(DataSample.status == statuses[0])
        else:
            q = q.filter(DataSample.status.in_(statuses))
    if search:
        q = q.filter(DataSample.text_content.ilike(f"%{search}%"))

    total   = q.count()
    samples = (q.order_by(DataSample.submitted_at.desc())
                .offset((page - 1) * page_size).limit(page_size).all())

    columns = _task_columns(task_type)
    column_defs = [{"key": c, "label": COLUMN_LABELS.get(c, c.title())} for c in columns]

    return {
        "total":       total,
        "page":        page,
        "page_size":   page_size,
        "pages":       max(1, (total + page_size - 1) // page_size),
        "task_type":   task_type,
        "columns":     column_defs,
        "items":       [_build_sample_row(s, db, task_type) for s in samples],
    }


# ─────────────────────────────────────────────────────────────────────────────
# POST /data-samples/{sample_id}/approve
# Annotator approves a scored sample. When approval_count >= REQUIRED_APPROVALS
# the status moves to "can_be_validated".
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

    user_id = str(current_user.id)

    # Load existing approvals
    approvals = _parse_json_list(getattr(sample, "approvals_json", None))

    # Prevent duplicate approval from same user
    already = next((a for a in approvals if a.get("user_id") == user_id), None)
    if already:
        # Update existing entry
        already["action"]    = action
        already["note"]      = note
        already["timestamp"] = datetime.now(timezone.utc).isoformat()
    else:
        profile = db.query(UserProfile).filter(UserProfile.user_id == user_id).first()
        approvals.append({
            "user_id":   user_id,
            "name":      (profile.full_name if profile else None) or "Unknown",
            "action":    action,
            "note":      note,
            "timestamp": datetime.now(timezone.utc).isoformat(),
        })

    sample.approvals_json = json.dumps(approvals)

    # Count approvals
    approve_count = len([a for a in approvals if a.get("action") == "approve"])
    reject_count  = len([a for a in approvals if a.get("action") == "reject"])

    sample.approval_count = approve_count

    # Update status based on votes
    if action == "reject":
        sample.status = "rejected"
        # Add to flags
        flags = _parse_json_list(sample.flags)
        flags.append(f"Rejected by {approvals[-1]['name']}: {note or 'No reason given'}")
        sample.flags = json.dumps(flags)
    elif action == "flag":
        sample.status = "flagged"
        flags = _parse_json_list(sample.flags)
        flags.append(f"Flagged by {approvals[-1]['name']}: {note or 'No reason given'}")
        sample.flags = json.dumps(flags)
    elif approve_count >= REQUIRED_APPROVALS:
        sample.status = "can_be_validated"
    # else stay as "scored" — not enough approvals yet

    db.commit()
    return {
        "id":             sample_id,
        "status":         sample.status,
        "approval_count": approve_count,
        "approvals_needed": max(0, REQUIRED_APPROVALS - approve_count),
        "approvals":      approvals,
    }


# ─────────────────────────────────────────────────────────────────────────────
# PATCH /data-samples/{sample_id}/status
# Final status override — only organisers can set "validated"
# ─────────────────────────────────────────────────────────────────────────────
@router.patch("/data-samples/{sample_id}/status")
def update_sample_status(
    sample_id: str,
    body: dict,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    new_status = body.get("status", "").lower()
    allowed = {"validated", "flagged", "rejected", "scored", "can_be_validated"}
    if new_status not in allowed:
        raise HTTPException(status_code=400, detail=f"status must be one of {allowed}")

    sample = db.query(DataSample).filter(DataSample.id == sample_id).first()
    if not sample:
        raise HTTPException(status_code=404, detail="Sample not found")

    is_org = _require_access(sample.competition_id, str(current_user.id), db)

    if new_status == "validated":
        if not is_org:
            raise HTTPException(status_code=403, detail="Only organisers can mark samples as validated")
        if sample.status != "can_be_validated":
            approval_count = getattr(sample, "approval_count", 0) or 0
            if approval_count < REQUIRED_APPROVALS:
                raise HTTPException(
                    status_code=409,
                    detail=(
                        f"This sample needs {REQUIRED_APPROVALS} annotator approvals before validation. "
                        f"Currently has {approval_count}. Use the Approve button to collect more."
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
# Returns column definitions for the current task type
# ─────────────────────────────────────────────────────────────────────────────
@router.get("/competitions/{competition_id}/table-config")
def table_config(competition_id: str, db: Session = Depends(get_db),
                 current_user=Depends(get_current_user)):
    _require_access(competition_id, str(current_user.id), db)
    comp = db.query(Competition).filter(Competition.id == competition_id).first()
    if not comp:
        raise HTTPException(status_code=404, detail="Competition not found")
    tt = (comp.task_type or "TEXT_CLASSIFICATION").upper().replace(" ", "_")
    cols = _task_columns(tt)
    return {
        "task_type": tt,
        "columns": [{"key": c, "label": COLUMN_LABELS.get(c, c.title())} for c in cols],
    }


# ─────────────────────────────────────────────────────────────────────────────
# Revalidate, versions, health, export, pin — unchanged from previous version
# (copy from previous validation.py output)
# ─────────────────────────────────────────────────────────────────────────────
@router.post("/competitions/{competition_id}/revalidate")
async def revalidate_pending(competition_id: str, background_tasks: BackgroundTasks,
                              db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    is_org = _require_access(competition_id, str(current_user.id), db)
    if not is_org:
        raise HTTPException(status_code=403, detail="Only organisers can trigger revalidation")
    pending_count = db.query(DataSample).filter(
        DataSample.competition_id == competition_id, DataSample.status == "pending").count()
    comp = db.query(Competition).filter(Competition.id == competition_id).first()
    task_type = (comp.task_type if comp else None) or "TEXT_CLASSIFICATION"
    background_tasks.add_task(_run_revalidation, competition_id, task_type)
    return {"message": f"Revalidation started for {pending_count} pending sample(s).", "pending": pending_count}


async def _run_revalidation(competition_id: str, task_type: str):
    from database import SessionLocal
    from services.validation_service import validate_sample as _validate
    db = SessionLocal()
    try:
        pending = db.query(DataSample).filter(
            DataSample.competition_id == competition_id,
            DataSample.status.in_(["pending", "scored"])).all()
        for sample in pending:
            ann = _parse_annotation(sample.annotation)
            result = await _validate(text_content=sample.text_content, annotation=ann,
                                     task_type=task_type, run_ai=True)
            sample.status = result.status
            if result.quality_score is not None:
                sample.quality_score = float(result.quality_score)
            sample.flags = json.dumps(result.reasons)
            if hasattr(sample, "score_breakdown"):
                sample.score_breakdown = json.dumps(result.score_breakdown)
        db.commit()
    except Exception as exc:
        db.rollback(); print(f"[revalidate] error: {exc}")
    finally:
        db.close()


@router.get("/competitions/{competition_id}/versions")
def list_versions(competition_id: str, db: Session = Depends(get_db),
                  current_user=Depends(get_current_user)):
    _require_access(competition_id, str(current_user.id), db)
    comp = db.query(Competition).filter(Competition.id == competition_id).first()
    if not comp:
        raise HTTPException(status_code=404, detail="Competition not found")
    store = _load_store(comp)
    versions = store.get("versions", [])
    pinned_tag = store.get("pinned_version_tag")
    for i, v in enumerate(versions):
        v["is_current"] = (i == 0)
        v["is_pinned"]  = (v.get("tag") == pinned_tag)
        prev = versions[i+1] if i+1 < len(versions) else None
        v["diff"] = _compute_diff(v, prev)
    return versions


@router.post("/competitions/{competition_id}/versions")
def create_version(competition_id: str, body: dict, db: Session = Depends(get_db),
                   current_user=Depends(get_current_user)):
    _require_access(competition_id, str(current_user.id), db)
    comp = db.query(Competition).filter(Competition.id == competition_id).first()
    if not comp:
        raise HTTPException(status_code=404, detail="Competition not found")
    versions = _parse_versions(comp)
    tag = (body.get("tag") or "").strip() or _next_version_tag(versions)
    if any(v.get("tag") == tag for v in versions):
        raise HTTPException(status_code=409, detail=f"Version {tag} already exists.")
    total     = db.query(DataSample).filter(DataSample.competition_id == competition_id).count()
    validated = db.query(DataSample).filter(DataSample.competition_id == competition_id,
                                             DataSample.status == "validated").count()
    flagged   = db.query(DataSample).filter(DataSample.competition_id == competition_id,
                                             DataSample.status == "flagged").count()
    rejected  = db.query(DataSample).filter(DataSample.competition_id == competition_id,
                                             DataSample.status == "rejected").count()
    pending   = db.query(DataSample).filter(DataSample.competition_id == competition_id,
                                             DataSample.status.in_(["pending","scored"])).count()
    db.query(DataSample).filter(DataSample.competition_id == competition_id,
        DataSample.status == "validated", DataSample.version_tag == None  # noqa
    ).update({"version_tag": tag}, synchronize_session=False)
    db.flush()
    stats = dict(total_samples=total, validated_samples=validated, flagged_samples=flagged,
                 rejected_samples=rejected, pending_samples=pending)
    diff = _compute_diff(stats, versions[0] if versions else None)
    changelog = []
    if diff.get("validated_samples", 0) > 0:
        changelog.append(f"+{diff['validated_samples']} newly validated samples added.")
    if diff.get("total_samples", 0) > 0:
        changelog.append(f"{diff['total_samples']} new submissions since last snapshot.")
    if not changelog:
        changelog.append("No changes vs previous version.")
    new_version = {**stats, "tag": tag, "label": body.get("label",""),
                   "notes": body.get("notes",""), "date": datetime.utcnow().strftime("%b %d, %Y"),
                   "created_at": datetime.utcnow().isoformat(), "diff": diff,
                   "changelog": changelog, "is_current": False, "deleted": False}
    versions.insert(0, new_version)
    store = _load_store(comp)
    store["versions"] = versions
    _save_store(comp, store, db)
    return new_version


@router.patch("/competitions/{competition_id}/versions/{tag}")
def update_version(competition_id: str, tag: str, body: dict,
                   db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    _require_access(competition_id, str(current_user.id), db)
    comp = db.query(Competition).filter(Competition.id == competition_id).first()
    if not comp:
        raise HTTPException(status_code=404, detail="Competition not found")
    versions = _parse_versions(comp)
    idx = next((i for i, v in enumerate(versions) if v.get("tag") == tag), None)
    if idx is None:
        raise HTTPException(status_code=404, detail=f"Version {tag} not found")
    for field in ("label", "notes"):
        if field in body:
            versions[idx][field] = body[field]
    store = _load_store(comp); store["versions"] = versions; _save_store(comp, store, db)
    return versions[idx]


@router.delete("/competitions/{competition_id}/versions/{tag}")
def delete_version(competition_id: str, tag: str, db: Session = Depends(get_db),
                   current_user=Depends(get_current_user)):
    is_org = _require_access(competition_id, str(current_user.id), db)
    if not is_org:
        raise HTTPException(status_code=403, detail="Only organisers can delete versions")
    comp = db.query(Competition).filter(Competition.id == competition_id).first()
    if not comp:
        raise HTTPException(status_code=404, detail="Competition not found")
    versions = _parse_versions(comp)
    if not versions:
        raise HTTPException(status_code=404, detail="No versions found")
    if versions[0].get("tag") == tag:
        raise HTTPException(status_code=409, detail="Cannot delete the latest version.")
    idx = next((i for i, v in enumerate(versions) if v.get("tag") == tag), None)
    if idx is None:
        raise HTTPException(status_code=404, detail=f"Version {tag} not found")
    versions[idx]["deleted"] = True
    store = _load_store(comp); store["versions"] = versions; _save_store(comp, store, db)
    return {"deleted": True, "tag": tag}


@router.post("/competitions/{competition_id}/versions/{tag}/pin")
def pin_version(competition_id: str, tag: str, db: Session = Depends(get_db),
                current_user=Depends(get_current_user)):
    _require_access(competition_id, str(current_user.id), db)
    comp = db.query(Competition).filter(Competition.id == competition_id).first()
    if not comp:
        raise HTTPException(status_code=404, detail="Competition not found")
    if not any(v.get("tag") == tag for v in _parse_versions(comp)):
        raise HTTPException(status_code=404, detail=f"Version {tag} not found")
    store = _load_store(comp); store["pinned_version_tag"] = tag; _save_store(comp, store, db)
    return {"pinned": True, "tag": tag}


@router.delete("/competitions/{competition_id}/versions/pin")
def unpin_version(competition_id: str, db: Session = Depends(get_db),
                  current_user=Depends(get_current_user)):
    _require_access(competition_id, str(current_user.id), db)
    comp = db.query(Competition).filter(Competition.id == competition_id).first()
    if not comp:
        raise HTTPException(status_code=404, detail="Competition not found")
    store = _load_store(comp); store.pop("pinned_version_tag", None); _save_store(comp, store, db)
    return {"pinned": False}


@router.get("/competitions/{competition_id}/pinned-version")
def get_pinned_version(competition_id: str, db: Session = Depends(get_db),
                       current_user=Depends(get_current_user)):
    _require_access(competition_id, str(current_user.id), db)
    comp = db.query(Competition).filter(Competition.id == competition_id).first()
    if not comp:
        raise HTTPException(status_code=404, detail="Competition not found")
    store = _load_store(comp)
    tag = store.get("pinned_version_tag")
    if not tag:
        return {"pinned": False, "tag": None, "version": None}
    version = next((v for v in _parse_versions(comp) if v.get("tag") == tag), None)
    return {"pinned": True, "tag": tag, "version": version}


@router.get("/competitions/{competition_id}/data-health")
def data_health(competition_id: str, db: Session = Depends(get_db),
                current_user=Depends(get_current_user)):
    _require_access(competition_id, str(current_user.id), db)
    def cnt(st):
        return db.query(DataSample).filter(
            DataSample.competition_id == competition_id, DataSample.status == st).count()
    total     = db.query(DataSample).filter(DataSample.competition_id == competition_id).count()
    validated = cnt("validated")
    flagged   = cnt("flagged")
    rejected  = cnt("rejected")
    pending   = cnt("pending") + cnt("scored") + cnt("can_be_validated")
    all_s     = db.query(DataSample).filter(DataSample.competition_id == competition_id).all()
    text_lengths  = [len((s.text_content or "").split()) for s in all_s if s.text_content]
    avg_text_len  = round(sum(text_lengths)/len(text_lengths), 1) if text_lengths else 0
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
                    alerts.append({"level":"critical","type":"Class Imbalance",
                        "detail":f'"{lbl}" represents {round(count/total*100)}% of samples.'})
                    break
        if flagged > 0:
            alerts.append({"level":"warning","type":"Flagged Samples",
                "detail":f"{flagged} sample{'s' if flagged!=1 else ''} need review"})
        if rejected > 0:
            alerts.append({"level":"warning","type":"Rejected Samples",
                "detail":f"{rejected} sample{'s' if rejected!=1 else ''} failed validation"})
    return {"total":total,"validated":validated,"flagged":flagged,"rejected":rejected,
            "pending":pending,"avg_text_length":avg_text_len,
            "label_distribution":label_counts,"alerts":alerts}


@router.get("/competitions/{competition_id}/export")
def export_dataset(competition_id: str,
                   format: str = Query("csv", regex="^(csv|json|conll)$"),
                   version: str | None = Query(None),
                   status_filter: str = Query("validated"),
                   db: Session = Depends(get_db), current_user=Depends(get_current_user)):
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
        raise HTTPException(status_code=404, detail=f"No {status_filter} samples found.")
    comp = db.query(Competition).filter(Competition.id == competition_id).first()
    task_type = (comp.task_type if comp else None) or "TEXT_CLASSIFICATION"
    rows = []
    for s in samples:
        row_data = _build_sample_row(s, db, task_type)
        ann = _parse_annotation(s.annotation)
        rows.append({
            "id": str(s.id), "text_content": s.text_content or "",
            "annotation": json.dumps(ann), "status": s.status,
            "quality_score": s.quality_score or "", "task_type": task_type,
            "submitted_at": str(s.submitted_at) if s.submitted_at else "",
            "version_tag": s.version_tag or "", "approvals": s.approval_count or 0,
            **{k: str(v) for k, v in row_data.items()
               if k in ("label","question","answer","translation","sentiment","summary","emotion","entities")},
        })
    if format == "json":
        content = json.dumps(rows, ensure_ascii=False, indent=2)
        return StreamingResponse(iter([content]), media_type="application/json",
            headers={"Content-Disposition": f'attachment; filename="dataset-{competition_id}.json"'})
    output = io.StringIO()
    if rows:
        writer = csv_mod.DictWriter(output, fieldnames=rows[0].keys())
        writer.writeheader(); writer.writerows(rows)
    return StreamingResponse(iter([output.getvalue()]), media_type="text/csv",
        headers={"Content-Disposition": f'attachment; filename="dataset-{competition_id}.csv"'})