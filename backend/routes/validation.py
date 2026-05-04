"""
routes/validation.py  — fixed

Bugs fixed vs original:
  1. Added GET /competitions/{id}/my-role   (frontend was 404-ing)
  2. Added POST /competitions/{id}/revalidate (RawSamplesTable button target)
  3. _parse_annotation() handles jsonb dict OR legacy JSON string
  4. quality_score stored/read as float, not str
  5. data_health: fixed re-filter on consumed query object (use fresh queries)
  6. data_health: alert logic fixed — was flagging healthy data, now flags real imbalance
  7. list_versions: removed duplicate _parse_versions call
  8. _next_version_tag: starts at v1.0 not v1.2
"""
import json
from datetime import datetime

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from models import DataSample, Competition, CompetitionOrganizer, UserProfile
from .utils import get_db, get_current_user

router = APIRouter(tags=["validation"])


# ──────────────────────────────────────────────────────────────────────────────
# Internal helpers
# ──────────────────────────────────────────────────────────────────────────────

def _parse_annotation(annotation) -> dict:
    """DB stores jsonb (already a dict) OR legacy text (JSON string)."""
    if annotation is None:
        return {}
    if isinstance(annotation, dict):
        return annotation
    try:
        result = json.loads(annotation)
        return result if isinstance(result, dict) else {}
    except Exception:
        return {}


def _parse_versions(comp: Competition) -> list:
    try:
        raw = json.loads(comp.datasets_json) if comp.datasets_json else {}
    except Exception:
        return []
    if isinstance(raw, list):
        return []
    return raw.get("versions", [])


def _next_version_tag(versions: list) -> str:
    if not versions:
        return "v1.0"
    latest = versions[0].get("tag", "v1.0")
    try:
        parts = latest.lstrip("v").split(".")
        return f"v{int(parts[0])}.{int(parts[1]) + 1}"
    except Exception:
        return "v1.0"


def _require_access(competition_id: str, user_id: str, db: Session) -> bool:
    from models import CompetitionParticipant
    is_org = (
        db.query(CompetitionOrganizer)
        .filter(
            CompetitionOrganizer.competition_id == competition_id,
            CompetitionOrganizer.user_id == user_id,
        )
        .first()
    )
    is_part = (
        db.query(CompetitionParticipant)
        .filter(
            CompetitionParticipant.competition_id == competition_id,
            CompetitionParticipant.user_id == user_id,
        )
        .first()
    )
    if not is_org and not is_part:
        raise HTTPException(status_code=403, detail="Access denied")
    return bool(is_org)


# ──────────────────────────────────────────────────────────────────────────────
# GET /competitions/{competition_id}/my-role
# FIX: This endpoint was missing — frontend was getting 404, isOrganizer stayed false
# ──────────────────────────────────────────────────────────────────────────────

@router.get("/competitions/{competition_id}/my-role")
def my_role(
    competition_id: str,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    from models import CompetitionParticipant
    user_id = str(current_user.id)

    is_org = (
        db.query(CompetitionOrganizer)
        .filter(
            CompetitionOrganizer.competition_id == competition_id,
            CompetitionOrganizer.user_id == user_id,
        )
        .first()
    )
    if is_org:
        return {"role": "organizer", "is_organizer": True}

    is_part = (
        db.query(CompetitionParticipant)
        .filter(
            CompetitionParticipant.competition_id == competition_id,
            CompetitionParticipant.user_id == user_id,
        )
        .first()
    )
    if is_part:
        return {"role": "participant", "is_organizer": False}

    # Return guest gracefully — frontend degrades instead of crashing
    return {"role": "guest", "is_organizer": False}


# ──────────────────────────────────────────────────────────────────────────────
# GET /competitions/{competition_id}/samples
# ──────────────────────────────────────────────────────────────────────────────

@router.get("/competitions/{competition_id}/samples")
def list_samples(
    competition_id: str,
    status: str | None = Query(None),
    search: str | None = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    version: str | None = Query(None),
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    _require_access(competition_id, str(current_user.id), db)

    q = db.query(DataSample).filter(DataSample.competition_id == competition_id)
    if version:
        q = q.filter(DataSample.version_tag == version)
    if status and status.lower() != "all":
        q = q.filter(DataSample.status == status.lower())
    if search:
        q = q.filter(DataSample.text_content.ilike(f"%{search}%"))

    total = q.count()
    samples = (
        q.order_by(DataSample.submitted_at.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
        .all()
    )

    rows = []
    for s in samples:
        profile = (
            db.query(UserProfile)
            .filter(UserProfile.user_id == s.contributor_id)
            .first()
        )
        annotator_name = (profile.full_name if profile else None) or "Unknown"
        initials = "".join(w[0].upper() for w in annotator_name.split()[:2]) or "?"

        ann = _parse_annotation(s.annotation)
        label = ann.get("label") or ann.get("labels") or None
        if isinstance(label, list):
            label = label[0] if label else None

        try:
            agreement = float(s.quality_score) if s.quality_score is not None else None
        except Exception:
            agreement = None

        sample_id = str(s.id)
        rows.append({
            "id": sample_id,
            "uid": f"#{sample_id[:7].upper()}",
            "content_snippet": (s.text_content or "")[:80],
            "label": label,
            "annotator": {"name": annotator_name, "initials": initials},
            "agreement": agreement,
            "status": s.status,
            "submitted_at": str(s.submitted_at) if s.submitted_at else None,
            "audio_url": s.audio_url,
            "audio_duration": s.audio_duration,
        })

    return {
        "total": total,
        "page": page,
        "page_size": page_size,
        "pages": max(1, (total + page_size - 1) // page_size),
        "items": rows,
    }


# ──────────────────────────────────────────────────────────────────────────────
# PATCH /data-samples/{sample_id}/status
# ──────────────────────────────────────────────────────────────────────────────

@router.patch("/data-samples/{sample_id}/status")
def update_sample_status(
    sample_id: str,
    body: dict,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    new_status = body.get("status", "").lower()
    allowed = {"validated", "flagged", "rejected", "pending"}
    if new_status not in allowed:
        raise HTTPException(status_code=400, detail=f"status must be one of {allowed}")

    sample = db.query(DataSample).filter(DataSample.id == sample_id).first()
    if not sample:
        raise HTTPException(status_code=404, detail="Sample not found")

    is_org = _require_access(sample.competition_id, str(current_user.id), db)

    if not is_org and new_status in {"validated", "rejected"}:
        raise HTTPException(
            status_code=403,
            detail="Only organisers can validate or reject samples",
        )

    sample.status = new_status

    if "quality_score" in body:
        try:
            # FIX: store as float, not str (DB column is double precision)
            sample.quality_score = float(body["quality_score"])
        except Exception:
            pass

    db.commit()
    return {"id": sample_id, "status": sample.status}


# ──────────────────────────────────────────────────────────────────────────────
# POST /competitions/{competition_id}/revalidate
# FIX: This endpoint was missing — RawSamplesTable "Re-validate Pending" button
# Runs the full validation pipeline on all pending samples asynchronously.
# ──────────────────────────────────────────────────────────────────────────────

@router.post("/competitions/{competition_id}/revalidate")
async def revalidate_pending(
    competition_id: str,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    is_org = _require_access(competition_id, str(current_user.id), db)
    if not is_org:
        raise HTTPException(status_code=403, detail="Only organisers can trigger revalidation")

    pending_count = (
        db.query(DataSample)
        .filter(
            DataSample.competition_id == competition_id,
            DataSample.status == "pending",
        )
        .count()
    )

    comp = db.query(Competition).filter(Competition.id == competition_id).first()
    task_type = (comp.task_type if comp else None) or "TEXT_PROCESSING"

    background_tasks.add_task(_run_revalidation, competition_id, task_type)

    return {
        "message": f"Revalidation started for {pending_count} pending sample(s).",
        "pending": pending_count,
    }


async def _run_revalidation(competition_id: str, task_type: str):
    """Background task: re-validate all pending samples."""
    from database import SessionLocal
    from services.validation_service import validate_sample as _validate

    db = SessionLocal()
    try:
        pending = (
            db.query(DataSample)
            .filter(
                DataSample.competition_id == competition_id,
                DataSample.status == "pending",
            )
            .all()
        )
        for sample in pending:
            ann = _parse_annotation(sample.annotation)
            result = await _validate(
                text_content=sample.text_content,
                annotation=ann,
                task_type=task_type,
                run_ai=True,
            )
            sample.status = result.status
            if result.quality_score is not None:
                sample.quality_score = float(result.quality_score)
        db.commit()
    except Exception as exc:
        db.rollback()
        print(f"[revalidate] error: {exc}")
    finally:
        db.close()


# ──────────────────────────────────────────────────────────────────────────────
# GET /competitions/{competition_id}/versions
# ──────────────────────────────────────────────────────────────────────────────

@router.get("/competitions/{competition_id}/versions")
def list_versions(
    competition_id: str,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    _require_access(competition_id, str(current_user.id), db)

    comp = db.query(Competition).filter(Competition.id == competition_id).first()
    if not comp:
        raise HTTPException(status_code=404, detail="Competition not found")

    # FIX: was calling _parse_versions twice (duplicate)
    versions = _parse_versions(comp)

    for i, v in enumerate(versions):
        v["is_current"] = (i == 0)

    return versions


# ──────────────────────────────────────────────────────────────────────────────
# POST /competitions/{competition_id}/versions
# ──────────────────────────────────────────────────────────────────────────────

@router.post("/competitions/{competition_id}/versions")
def create_version(
    competition_id: str,
    body: dict,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    is_org = _require_access(competition_id, str(current_user.id), db)
    if not is_org:
        raise HTTPException(status_code=403, detail="Only organisers can create versions")

    comp = db.query(Competition).filter(Competition.id == competition_id).first()
    if not comp:
        raise HTTPException(status_code=404, detail="Competition not found")

    versions = _parse_versions(comp)

    total = db.query(DataSample).filter(DataSample.competition_id == competition_id).count()
    validated = (
        db.query(DataSample)
        .filter(DataSample.competition_id == competition_id, DataSample.status == "validated")
        .count()
    )

    tag = body.get("tag") or _next_version_tag(versions)

    db.query(DataSample).filter(
        DataSample.competition_id == competition_id,
        DataSample.status == "validated",
    ).update({"version_tag": tag}, synchronize_session=False)

    new_version = {
        "tag": tag,
        "label": body.get("label", ""),
        "date": datetime.utcnow().strftime("%b %d, %Y"),
        "total_samples": total,
        "validated_samples": validated,
        "is_current": False,
    }
    versions.insert(0, new_version)

    existing = {}
    try:
        existing = json.loads(comp.datasets_json) if comp.datasets_json else {}
    except Exception:
        existing = {}

    if isinstance(existing, list):
        existing = {"datasets": existing, "versions": []}

    existing["versions"] = versions
    comp.datasets_json = json.dumps(existing)
    db.commit()

    return new_version


# ──────────────────────────────────────────────────────────────────────────────
# GET /competitions/{competition_id}/data-health
# FIX: was re-filtering an already-filtered query object (SQLAlchemy doesn't
#      support chaining .filter() on a result of .count()). Now uses fresh
#      scalar queries per status.
# FIX: alert logic — was flagging when Misc < 4% (healthy!). Now flags real
#      imbalance (any label > 80% when there are multiple labels).
# ──────────────────────────────────────────────────────────────────────────────

@router.get("/competitions/{competition_id}/data-health")
def data_health(
    competition_id: str,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    _require_access(competition_id, str(current_user.id), db)

    def count_status(st: str) -> int:
        return (
            db.query(DataSample)
            .filter(
                DataSample.competition_id == competition_id,
                DataSample.status == st,
            )
            .count()
        )

    total     = db.query(DataSample).filter(DataSample.competition_id == competition_id).count()
    validated = count_status("validated")
    flagged   = count_status("flagged")
    rejected  = count_status("rejected")
    pending   = count_status("pending")

    all_samples = (
        db.query(DataSample)
        .filter(DataSample.competition_id == competition_id)
        .all()
    )

    text_lengths = [
        len((s.text_content or "").split())
        for s in all_samples
        if s.text_content
    ]
    avg_text_len = round(sum(text_lengths) / len(text_lengths), 1) if text_lengths else 0

    label_counts: dict = {}
    for s in all_samples:
        ann = _parse_annotation(s.annotation)
        label = ann.get("label") or ann.get("labels")
        if isinstance(label, list):
            label = label[0] if label else None
        lbl = str(label) if label else "Unlabeled"
        label_counts[lbl] = label_counts.get(lbl, 0) + 1

    alerts = []
    if total > 0:
        # Real imbalance: one label takes > 80% of all samples when > 1 class exists
        if len(label_counts) > 1:
            for lbl, count in label_counts.items():
                pct = count / total
                if pct > 0.80:
                    alerts.append({
                        "level": "critical",
                        "type": "Class Imbalance",
                        "detail": (
                            f'"{lbl}" represents {round(pct * 100)}% of samples. '
                            "Consider adding more diverse labels."
                        ),
                    })
                    break

        if flagged > 0:
            alerts.append({
                "level": "warning",
                "type": "Flagged Samples",
                "detail": f"{flagged} sample{'s' if flagged != 1 else ''} need{'s' if flagged == 1 else ''} review",
            })

        if rejected > 0:
            alerts.append({
                "level": "warning",
                "type": "Rejected Samples",
                "detail": f"{rejected} sample{'s' if rejected != 1 else ''} failed validation and should be reviewed",
            })

    return {
        "total": total,
        "validated": validated,
        "flagged": flagged,
        "rejected": rejected,
        "pending": pending,
        "avg_text_length": avg_text_len,
        "label_distribution": label_counts,
        "alerts": alerts,
    }