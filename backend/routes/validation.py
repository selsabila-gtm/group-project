"""
routes/validation.py

Dataset Hub backend:
  - List / filter data samples for a competition
  - Validate / flag / reject individual samples
  - Dataset version management (list + create snapshot)
"""

import json
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func
from sqlalchemy.orm import Session

from models import DataSample, Competition, CompetitionOrganizer, UserProfile
from .utils import get_db, get_current_user

router = APIRouter(tags=["validation"])


# ─────────────────────────────────────────────────────────────────────────────
# Helper: check the caller is organiser or participant of this competition
# ─────────────────────────────────────────────────────────────────────────────

def _require_access(competition_id: str, user_id: str, db: Session):
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
    return bool(is_org)  # returns True if organiser


# ─────────────────────────────────────────────────────────────────────────────
# GET /competitions/{competition_id}/samples
# Returns paginated sample list with optional status / search filters.
# ─────────────────────────────────────────────────────────────────────────────

@router.get("/competitions/{competition_id}/samples")
def list_samples(
    competition_id: str,
    status: str | None = Query(None),
    search: str | None = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
    version: str | None = Query(None),
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
        annotator_name = profile.full_name if profile else "Unknown"
        initials = "".join(w[0].upper() for w in annotator_name.split()[:2]) if annotator_name else "?"

        # Parse annotation JSON safely
        try:
            ann = json.loads(s.annotation) if s.annotation else {}
        except Exception:
            ann = {}

        # Derive label from annotation
        label = ann.get("label") or ann.get("labels") or None
        if isinstance(label, list):
            label = label[0] if label else None

        # Agreement score — use quality_score if present, else simulate
        try:
            agreement = float(s.quality_score) if s.quality_score else None
        except Exception:
            agreement = None

        rows.append({
            "id": s.id,
            "uid": f"#{s.id[:7].upper()}",
            "content_snippet": (s.text_content or "")[:80],
            "label": label,
            "annotator": {"name": annotator_name, "initials": initials},
            "agreement": agreement,
            "status": s.status,
            "submitted_at": s.submitted_at,
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


# ─────────────────────────────────────────────────────────────────────────────
# PATCH /data-samples/{sample_id}/status
# Validates, flags, or rejects a single sample.
# Only organisers can validate/reject; participants can only flag.
# ─────────────────────────────────────────────────────────────────────────────

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

    # Participants can only flag, not validate/reject
    if not is_org and new_status in {"validated", "rejected"}:
        raise HTTPException(
            status_code=403,
            detail="Only organisers can validate or reject samples",
        )

    sample.status = new_status

    # Attach optional quality_score if provided
    if "quality_score" in body:
        try:
            sample.quality_score = str(float(body["quality_score"]))
        except Exception:
            pass

    db.commit()
    return {"id": sample_id, "status": sample.status}


# ─────────────────────────────────────────────────────────────────────────────
# GET /competitions/{competition_id}/versions
# Returns the list of dataset snapshots (stored as JSON in the competition row).
# ─────────────────────────────────────────────────────────────────────────────

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

    versions = _parse_versions(comp)

    # Always inject a live "current" pseudo-version derived from real counts
    total = db.query(DataSample).filter(DataSample.competition_id == competition_id).count()
    validated = (
        db.query(DataSample)
        .filter(DataSample.competition_id == competition_id, DataSample.status == "validated")
        .count()
    )

    # Keep versions sorted newest first; prepend a live entry
    versions = _parse_versions(comp)

# Mark latest as current
    for i, v in enumerate(versions):
        v["is_current"] = i == 0

    return versions


# ─────────────────────────────────────────────────────────────────────────────
# POST /competitions/{competition_id}/versions
# Creates a named snapshot of the current dataset state.
# Only organisers can create versions.
# ─────────────────────────────────────────────────────────────────────────────

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

# Assign ALL validated samples to this version
    db.query(DataSample).filter(
    DataSample.competition_id == competition_id,
    DataSample.status == "validated"
    ).update(
    {"version_tag": tag},
    synchronize_session=False
    )
    new_version = {
    "tag": tag,
    "label": body.get("label", ""),
    "date": datetime.utcnow().strftime("%b %d, %Y"),
    "total_samples": total,
    "validated_samples": validated,
    "is_current": False,
}
    versions.insert(0, new_version)

    # Persist versions list into the datasets_json field
    # We use a wrapper so we don't break the datasets array
    existing = {}
    try:
        existing = json.loads(comp.datasets_json) if comp.datasets_json else {}
    except Exception:
        existing = {}

    if isinstance(existing, list):
        # Legacy: datasets_json was an array of dataset objects — wrap it
        existing = {"datasets": existing, "versions": []}

    existing["versions"] = versions
    comp.datasets_json = json.dumps(existing)
    db.commit()

    return new_version


# ─────────────────────────────────────────────────────────────────────────────
# GET /competitions/{competition_id}/data-health
# Returns aggregated quality stats for the Data Health Panel.
# ─────────────────────────────────────────────────────────────────────────────

@router.get("/competitions/{competition_id}/data-health")
def data_health(
    competition_id: str,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    _require_access(competition_id, str(current_user.id), db)

    base = db.query(DataSample).filter(DataSample.competition_id == competition_id)
    total = base.count()
    validated = base.filter(DataSample.status == "validated").count()
    flagged = base.filter(DataSample.status == "flagged").count()
    rejected = base.filter(DataSample.status == "rejected").count()
    pending = base.filter(DataSample.status == "pending").count()

    # Average text length
    samples = base.all()
    text_lengths = [len((s.text_content or "").split()) for s in samples if s.text_content]
    avg_text_len = round(sum(text_lengths) / len(text_lengths), 1) if text_lengths else 0

    # Compute label distribution
    label_counts: dict = {}
    for s in samples:
        try:
            ann = json.loads(s.annotation) if s.annotation else {}
        except Exception:
            ann = {}
        label = ann.get("label") or ann.get("labels")
        if isinstance(label, list):
            label = label[0] if label else "Misc"
        lbl = str(label) if label else "Misc"
        label_counts[lbl] = label_counts.get(lbl, 0) + 1

    # Flag alerts
    alerts = []
    if total > 0:
        misc_pct = label_counts.get("Misc", 0) / max(total, 1)
        if misc_pct < 0.04:
            alerts.append({
                "level": "critical",
                "type": "Class Imbalance",
                "detail": f"Misc label low (<{round(misc_pct*100)}% representation)",
            })
        if flagged > 0:
            alerts.append({
                "level": "warning",
                "type": "Flagged Samples",
                "detail": f"{flagged} sample{'s' if flagged > 1 else ''} need review",
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


# ─────────────────────────────────────────────────────────────────────────────
# Internal helpers
# ─────────────────────────────────────────────────────────────────────────────

def _parse_versions(comp: Competition) -> list:
    try:
        raw = json.loads(comp.datasets_json) if comp.datasets_json else {}
    except Exception:
        return []
    if isinstance(raw, list):
        return []
    return raw.get("versions", [])


def _next_version_tag(versions: list) -> str:
    """Increment the latest vX.Y tag."""
    if not versions:
        return "v1.2"
    latest = versions[0].get("tag", "v1.0")
    try:
        parts = latest.lstrip("v").split(".")
        major, minor = int(parts[0]), int(parts[1])
        return f"v{major}.{minor + 1}"
    except Exception:
        return "v1.0"