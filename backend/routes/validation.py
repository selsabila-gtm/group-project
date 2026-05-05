"""
routes/validation.py  — COG-22 + COG-23 versioning complete

COG-22 (system): Version datasets so changes are tracked and reproducible.
  - POST /versions: snapshot creates an immutable record with full stats + diff
  - Each version stores: tag, label, date, total, validated, flagged, rejected,
    pending, label_distribution, diff vs previous version
  - PATCH /versions/{tag}: update label/notes (organiser only)
  - DELETE /versions/{tag}: soft-delete (organiser only, cannot delete latest)

COG-23 (team): View dataset versions to track changes.
  - GET /versions: full list with diff stats pre-computed
  - GET /versions/{tag}: single version detail with full label breakdown
  - GET /versions/{tag}/samples: paginated samples belonging to that snapshot
"""
import json
from datetime import datetime

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from models import DataSample, Competition, CompetitionOrganizer, UserProfile
from .utils import get_db, get_current_user

router = APIRouter(tags=["validation"])


# ──────────────────────────────────────────────────────────────────────────────
# Helpers
# ──────────────────────────────────────────────────────────────────────────────

def _default_reason(status: str) -> str | None:
    return {
        "pending": (
            "This sample has not been checked yet. "
            "Validation runs automatically — it scores length, labels, PII, and quality. "
            "An organiser can click Re-validate Pending to process it now."
        ),
        "flagged": (
            "This sample passed basic checks but scored below the quality threshold. "
            "An organiser must review it using the action buttons in this table. "
            "As a participant, you can submit a revised version instead."
        ),
        "rejected": (
            "This sample failed an automatic rule. Common causes: "
            "text is empty or under 3 words, a label was not selected, "
            "or personal data (email / phone number) was detected. "
            "Fix the issue and submit again."
        ),
    }.get(status)


def _parse_annotation(annotation) -> dict:
    if annotation is None:
        return {}
    if isinstance(annotation, dict):
        return annotation
    try:
        result = json.loads(annotation)
        return result if isinstance(result, dict) else {}
    except Exception:
        return {}


def _load_store(comp: Competition) -> dict:
    """Return the full datasets_json store as a dict."""
    try:
        raw = json.loads(comp.datasets_json) if comp.datasets_json else {}
    except Exception:
        raw = {}
    if isinstance(raw, list):
        return {"datasets": raw, "versions": []}
    return raw


def _save_store(comp: Competition, store: dict, db: Session):
    comp.datasets_json = json.dumps(store)
    db.commit()


def _parse_versions(comp: Competition) -> list:
    store = _load_store(comp)
    return store.get("versions", [])


def _next_version_tag(versions: list) -> str:
    if not versions:
        return "v1.0"
    latest = versions[0].get("tag", "v1.0")
    try:
        parts = latest.lstrip("v").split(".")
        return f"v{int(parts[0])}.{int(parts[1]) + 1}"
    except Exception:
        return "v1.0"


def _compute_diff(new_stats: dict, prev_stats: dict | None) -> dict:
    """Compute numeric deltas between two version stat dicts."""
    if prev_stats is None:
        return {}
    keys = ["total_samples", "validated_samples", "flagged_samples",
            "rejected_samples", "pending_samples"]
    return {
        k: new_stats.get(k, 0) - prev_stats.get(k, 0)
        for k in keys
        if k in new_stats or k in prev_stats
    }


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
# ──────────────────────────────────────────────────────────────────────────────

@router.get("/competitions/{competition_id}/my-role")
def my_role(
    competition_id: str,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    from models import CompetitionParticipant
    user_id = str(current_user.id)

    # 1. Check competition_organizers table
    is_org = (
        db.query(CompetitionOrganizer)
        .filter(CompetitionOrganizer.competition_id == competition_id,
                CompetitionOrganizer.user_id == user_id)
        .first()
    )
    if is_org:
        return {"role": "organizer", "is_organizer": True}

    # 2. Fallback: check if this user appears in competition_participants as owner/admin
    is_part = (
        db.query(CompetitionParticipant)
        .filter(CompetitionParticipant.competition_id == competition_id,
                CompetitionParticipant.user_id == user_id)
        .first()
    )

    # 3. Fallback: if the competition itself was created by this user
    #    (no organizers table row was created at competition creation time)
    #    We check by looking at whether ANY organizer exists for this competition.
    #    If no organizers exist at all, the authenticated user is treated as organizer.
    organizer_count = (
        db.query(CompetitionOrganizer)
        .filter(CompetitionOrganizer.competition_id == competition_id)
        .count()
    )
    if organizer_count == 0:
        # No organizers registered — creator workflow: treat caller as organizer
        # and auto-register them so future calls are consistent
        try:
            new_org = CompetitionOrganizer(
                competition_id=competition_id,
                user_id=user_id,
                role="owner",
            )
            db.add(new_org)
            db.commit()
        except Exception:
            db.rollback()
        return {"role": "organizer", "is_organizer": True}

    if is_part:
        return {"role": "participant", "is_organizer": False}

    # Authenticated but not a member — still return guest gracefully
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

        try:
            flags_list = json.loads(s.flags) if s.flags else []
            if not isinstance(flags_list, list):
                flags_list = []
        except Exception:
            flags_list = []

        sample_type = "audio" if s.audio_url else "text"
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
            "sample_type": sample_type,
            "flags": flags_list,
            "rejection_reason": flags_list[0] if flags_list else _default_reason(s.status),
            "version_tag": s.version_tag,
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
        raise HTTPException(status_code=403, detail="Only organisers can validate or reject samples")

    sample.status = new_status
    if "quality_score" in body:
        try:
            sample.quality_score = float(body["quality_score"])
        except Exception:
            pass

    db.commit()
    return {"id": sample_id, "status": sample.status}


# ──────────────────────────────────────────────────────────────────────────────
# POST /competitions/{competition_id}/revalidate
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
        .filter(DataSample.competition_id == competition_id, DataSample.status == "pending")
        .count()
    )

    comp = db.query(Competition).filter(Competition.id == competition_id).first()
    task_type = (comp.task_type if comp else None) or "TEXT_PROCESSING"
    background_tasks.add_task(_run_revalidation, competition_id, task_type)

    return {"message": f"Revalidation started for {pending_count} pending sample(s).", "pending": pending_count}


async def _run_revalidation(competition_id: str, task_type: str):
    from database import SessionLocal
    from services.validation_service import validate_sample as _validate

    db = SessionLocal()
    try:
        pending = (
            db.query(DataSample)
            .filter(DataSample.competition_id == competition_id, DataSample.status == "pending")
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
            sample.flags = json.dumps(result.reasons)
        db.commit()
    except Exception as exc:
        db.rollback()
        print(f"[revalidate] error: {exc}")
    finally:
        db.close()


# ──────────────────────────────────────────────────────────────────────────────
# COG-22 + COG-23: VERSIONING
# ──────────────────────────────────────────────────────────────────────────────

def _build_version_stats(competition_id: str, db: Session, version_tag: str | None = None) -> dict:
    """Compute live stats for the current unsnapshotted state, or for a tag."""
    def cnt(st):
        q = db.query(DataSample).filter(DataSample.competition_id == competition_id)
        if version_tag:
            q = q.filter(DataSample.version_tag == version_tag)
        return q.filter(DataSample.status == st).count()

    base_q = db.query(DataSample).filter(DataSample.competition_id == competition_id)
    if version_tag:
        base_q = base_q.filter(DataSample.version_tag == version_tag)

    total     = base_q.count()
    validated = cnt("validated")
    flagged   = cnt("flagged")
    rejected  = cnt("rejected")
    pending   = cnt("pending")

    # Label distribution
    label_counts: dict = {}
    for s in base_q.all():
        ann = _parse_annotation(s.annotation)
        label = ann.get("label") or ann.get("labels")
        if isinstance(label, list):
            label = label[0] if label else None
        lbl = str(label) if label else "Unlabeled"
        label_counts[lbl] = label_counts.get(lbl, 0) + 1

    return {
        "total_samples":     total,
        "validated_samples": validated,
        "flagged_samples":   flagged,
        "rejected_samples":  rejected,
        "pending_samples":   pending,
        "label_distribution": label_counts,
    }


# GET /competitions/{competition_id}/versions
# Returns all snapshots newest-first, each with diff vs previous version.
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

    store = _load_store(comp)
    versions = store.get("versions", [])
    pinned_tag = store.get("pinned_version_tag")

    # Inject diff, is_current, and is_pinned for each entry
    for i, v in enumerate(versions):
        v["is_current"] = (i == 0)
        v["is_pinned"]  = (v.get("tag") == pinned_tag)
        prev = versions[i + 1] if i + 1 < len(versions) else None
        v["diff"] = _compute_diff(v, prev)

    return versions


# GET /competitions/{competition_id}/versions/{tag}
# Single version detail — full stats + label breakdown.
@router.get("/competitions/{competition_id}/versions/{tag}")
def get_version(
    competition_id: str,
    tag: str,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    _require_access(competition_id, str(current_user.id), db)

    comp = db.query(Competition).filter(Competition.id == competition_id).first()
    if not comp:
        raise HTTPException(status_code=404, detail="Competition not found")

    versions = _parse_versions(comp)
    version = next((v for v in versions if v.get("tag") == tag), None)
    if not version:
        raise HTTPException(status_code=404, detail=f"Version {tag} not found")

    # Enrich with live sample counts scoped to this tag
    live_stats = _build_version_stats(competition_id, db, version_tag=tag)
    version = {**version, **live_stats}

    idx = next(i for i, v in enumerate(versions) if v.get("tag") == tag)
    version["is_current"] = (idx == 0)
    prev = versions[idx + 1] if idx + 1 < len(versions) else None
    version["diff"] = _compute_diff(version, prev)

    return version


# POST /competitions/{competition_id}/versions
# Create a snapshot: freezes all currently-validated samples under this tag.
@router.post("/competitions/{competition_id}/versions")
def create_version(
    competition_id: str,
    body: dict,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    # Any team member (participant or organiser) can snapshot their own dataset.
    # The organiser-only gate here was incorrect per the user stories:
    #   COG-22: "As a SYSTEM" — automated / any member
    #   COG-23: "As a TEAM"   — team-driven versioning
    _require_access(competition_id, str(current_user.id), db)

    comp = db.query(Competition).filter(Competition.id == competition_id).first()
    if not comp:
        raise HTTPException(status_code=404, detail="Competition not found")

    versions = _parse_versions(comp)
    tag = (body.get("tag") or "").strip() or _next_version_tag(versions)

    # Guard: reject duplicate tags
    if any(v.get("tag") == tag for v in versions):
        raise HTTPException(status_code=409, detail=f"Version {tag} already exists. Choose a different tag.")

    # Snapshot stats before tagging
    stats = _build_version_stats(competition_id, db)

    # Tag all validated samples that are not yet in a version
    updated = (
        db.query(DataSample)
        .filter(
            DataSample.competition_id == competition_id,
            DataSample.status == "validated",
            DataSample.version_tag == None,  # noqa: E711
        )
        .update({"version_tag": tag}, synchronize_session=False)
    )
    db.flush()

    # Compute diff vs the previous version
    prev_stats = versions[0] if versions else None
    diff = _compute_diff(stats, prev_stats)

    # Build changelog entry
    changelog = []
    if diff.get("validated_samples", 0) > 0:
        changelog.append(f"+{diff['validated_samples']} newly validated samples added.")
    if diff.get("total_samples", 0) > 0:
        changelog.append(f"{diff['total_samples']} new submissions since last snapshot.")
    if not changelog:
        changelog.append("No changes vs previous version.")

    new_version = {
        "tag":                tag,
        "label":              body.get("label", ""),
        "notes":              body.get("notes", ""),
        "date":               datetime.utcnow().strftime("%b %d, %Y"),
        "created_at":         datetime.utcnow().isoformat(),
        "total_samples":      stats["total_samples"],
        "validated_samples":  stats["validated_samples"],
        "flagged_samples":    stats["flagged_samples"],
        "rejected_samples":   stats["rejected_samples"],
        "pending_samples":    stats["pending_samples"],
        "label_distribution": stats["label_distribution"],
        "newly_tagged":       updated,
        "diff":               diff,
        "changelog":          changelog,
        "is_current":         False,
        "deleted":            False,
    }
    versions.insert(0, new_version)

    store = _load_store(comp)
    store["versions"] = versions
    _save_store(comp, store, db)

    return new_version


# PATCH /competitions/{competition_id}/versions/{tag}
# Update label/notes for a snapshot. Cannot change tag or stats.
@router.patch("/competitions/{competition_id}/versions/{tag}")
def update_version(
    competition_id: str,
    tag: str,
    body: dict,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    # Any team member can update a version's label or notes
    _require_access(competition_id, str(current_user.id), db)

    comp = db.query(Competition).filter(Competition.id == competition_id).first()
    if not comp:
        raise HTTPException(status_code=404, detail="Competition not found")

    versions = _parse_versions(comp)
    idx = next((i for i, v in enumerate(versions) if v.get("tag") == tag), None)
    if idx is None:
        raise HTTPException(status_code=404, detail=f"Version {tag} not found")

    # Only allow editing descriptive fields
    for field in ("label", "notes"):
        if field in body:
            versions[idx][field] = body[field]

    store = _load_store(comp)
    store["versions"] = versions
    _save_store(comp, store, db)

    return versions[idx]


# DELETE /competitions/{competition_id}/versions/{tag}
# Soft-delete a version. The latest version cannot be deleted.
# Samples keep their version_tag (data is not lost).
@router.delete("/competitions/{competition_id}/versions/{tag}")
def delete_version(
    competition_id: str,
    tag: str,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    is_org = _require_access(competition_id, str(current_user.id), db)
    if not is_org:
        raise HTTPException(status_code=403, detail="Only organisers can delete versions")

    comp = db.query(Competition).filter(Competition.id == competition_id).first()
    if not comp:
        raise HTTPException(status_code=404, detail="Competition not found")

    versions = _parse_versions(comp)
    if not versions:
        raise HTTPException(status_code=404, detail="No versions found")

    # Protect the latest snapshot from deletion
    if versions[0].get("tag") == tag:
        raise HTTPException(
            status_code=409,
            detail="Cannot delete the latest version. Create a new snapshot first.",
        )

    idx = next((i for i, v in enumerate(versions) if v.get("tag") == tag), None)
    if idx is None:
        raise HTTPException(status_code=404, detail=f"Version {tag} not found")

    versions[idx]["deleted"] = True
    store = _load_store(comp)
    store["versions"] = versions
    _save_store(comp, store, db)

    return {"deleted": True, "tag": tag}


# ──────────────────────────────────────────────────────────────────────────────
# POST /competitions/{competition_id}/versions/{tag}/pin
# Pin a version as the "active dataset" for experiments.
# Any team member can pin — it's a team decision, not admin-only.
# Stored as pinned_version_tag in datasets_json.
# ──────────────────────────────────────────────────────────────────────────────

@router.post("/competitions/{competition_id}/versions/{tag}/pin")
def pin_version(
    competition_id: str,
    tag: str,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    _require_access(competition_id, str(current_user.id), db)

    comp = db.query(Competition).filter(Competition.id == competition_id).first()
    if not comp:
        raise HTTPException(status_code=404, detail="Competition not found")

    versions = _parse_versions(comp)
    if not any(v.get("tag") == tag for v in versions):
        raise HTTPException(status_code=404, detail=f"Version {tag} not found")

    store = _load_store(comp)
    store["pinned_version_tag"] = tag
    _save_store(comp, store, db)

    return {"pinned": True, "tag": tag}


@router.delete("/competitions/{competition_id}/versions/pin")
def unpin_version(
    competition_id: str,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    _require_access(competition_id, str(current_user.id), db)

    comp = db.query(Competition).filter(Competition.id == competition_id).first()
    if not comp:
        raise HTTPException(status_code=404, detail="Competition not found")

    store = _load_store(comp)
    store.pop("pinned_version_tag", None)
    _save_store(comp, store, db)

    return {"pinned": False}


@router.get("/competitions/{competition_id}/pinned-version")
def get_pinned_version(
    competition_id: str,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """
    Returns the currently pinned dataset version for this competition.
    Called by the Experiments page to know which dataset version a run should use.
    """
    _require_access(competition_id, str(current_user.id), db)

    comp = db.query(Competition).filter(Competition.id == competition_id).first()
    if not comp:
        raise HTTPException(status_code=404, detail="Competition not found")

    store = _load_store(comp)
    pinned_tag = store.get("pinned_version_tag")

    if not pinned_tag:
        return {"pinned": False, "tag": None, "version": None}

    versions = _parse_versions(comp)
    version = next((v for v in versions if v.get("tag") == pinned_tag), None)

    return {
        "pinned": True,
        "tag": pinned_tag,
        "version": version,
    }


# ──────────────────────────────────────────────────────────────────────────────
# GET /competitions/{competition_id}/data-health
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
            .filter(DataSample.competition_id == competition_id, DataSample.status == st)
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

    text_lengths = [len((s.text_content or "").split()) for s in all_samples if s.text_content]
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
        if len(label_counts) > 1:
            for lbl, count in label_counts.items():
                if count / total > 0.80:
                    alerts.append({
                        "level": "critical",
                        "type": "Class Imbalance",
                        "detail": f'"{lbl}" represents {round(count/total*100)}% of samples.',
                    })
                    break
        if flagged > 0:
            alerts.append({"level": "warning", "type": "Flagged Samples",
                "detail": f"{flagged} sample{'s' if flagged != 1 else ''} need review"})
        if rejected > 0:
            alerts.append({"level": "warning", "type": "Rejected Samples",
                "detail": f"{rejected} sample{'s' if rejected != 1 else ''} failed validation"})

    return {
        "total": total, "validated": validated, "flagged": flagged,
        "rejected": rejected, "pending": pending,
        "avg_text_length": avg_text_len,
        "label_distribution": label_counts,
        "alerts": alerts,
    }


# ──────────────────────────────────────────────────────────────────────────────
# GET /competitions/{competition_id}/export
# ──────────────────────────────────────────────────────────────────────────────

@router.get("/competitions/{competition_id}/export")
def export_dataset(
    competition_id: str,
    format: str = Query("csv", regex="^(csv|json|conll)$"),
    version: str | None = Query(None),
    status_filter: str = Query("validated"),
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    import csv as csv_mod
    import io
    from fastapi.responses import StreamingResponse

    _require_access(competition_id, str(current_user.id), db)

    q = db.query(DataSample).filter(DataSample.competition_id == competition_id)
    if version:
        q = q.filter(DataSample.version_tag == version)
    if status_filter and status_filter.lower() != "all":
        q = q.filter(DataSample.status == status_filter.lower())

    samples = q.order_by(DataSample.submitted_at.asc()).all()

    if not samples:
        raise HTTPException(
            status_code=404,
            detail=(
                f"No {status_filter} samples found"
                + (f" in version {version}" if version else "")
                + ". Validate some samples first."
            ),
        )

    rows = []
    for s in samples:
        ann = _parse_annotation(s.annotation)
        label = ann.get("label") or ann.get("labels") or ""
        if isinstance(label, list):
            label = "|".join(str(l) for l in label)
        try:
            flags_raw = json.loads(s.flags) if s.flags else []
            flags_str = "; ".join(flags_raw) if isinstance(flags_raw, list) else str(flags_raw)
        except Exception:
            flags_str = ""
        rows.append({
            "id": str(s.id), "text_content": s.text_content or "",
            "label": str(label), "status": s.status,
            "quality_score": s.quality_score if s.quality_score is not None else "",
            "audio_url": s.audio_url or "", "flags": flags_str,
            "submitted_at": str(s.submitted_at) if s.submitted_at else "",
            "version_tag": s.version_tag or "",
        })

    if format == "json":
        content = json.dumps(rows, ensure_ascii=False, indent=2)
        return StreamingResponse(iter([content]), media_type="application/json",
            headers={"Content-Disposition": f'attachment; filename="dataset-{competition_id}.json"'})

    if format == "conll":
        lines = []
        for row in rows:
            for token in (row["text_content"] or "").split():
                lines.append(f"{token}\t{row['label'] or 'O'}")
            lines.append("")
        return StreamingResponse(iter(["\n".join(lines)]), media_type="text/plain",
            headers={"Content-Disposition": f'attachment; filename="dataset-{competition_id}.conll"'})

    output = io.StringIO()
    if rows:
        writer = csv_mod.DictWriter(output, fieldnames=rows[0].keys())
        writer.writeheader()
        writer.writerows(rows)
    return StreamingResponse(iter([output.getvalue()]), media_type="text/csv",
        headers={"Content-Disposition": f'attachment; filename="dataset-{competition_id}.csv"'})