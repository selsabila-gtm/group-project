"""
routes/competitions.py

Changes vs previous version:
  - Competition.dataset_config is now saved from data.task_config on create/update/draft.
  - New GET /competitions/{id}/dataset-config endpoint merges organizer config with
    per-task defaults and serves it to DataCollection widgets.
  - Audio prompt tasks (AUDIO_SYNTHESIS, SPEECH_EMOTION) automatically seed the
    competition_prompts table from task_config["prompts"] on create/update.

schemas.py NOTE: add to CompetitionCreateIn:
    task_config: Optional[dict] = None
"""

import json
from datetime import datetime, date
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import or_, text

from models import (
    Competition,
    CompetitionOrganizer,
    CompetitionParticipant,
    CompetitionPrompt,
    DashboardStat,
    RecentCompetition,
    CompetitionDataset,
)
from schemas import CompetitionCreateIn, CompetitionActionOut
from .utils import get_db, get_current_user, get_icon_for_task

router = APIRouter(tags=["competitions"])

# ── Per-task fallback defaults ─────────────────────────────────────────────────
# Used when the organizer hasn't configured a field yet, or for older competitions
# that predate the task-config feature.
TASK_CONFIG_DEFAULTS: dict[str, dict] = {
    "TEXT_CLASSIFICATION": {
        "labels": ["Finance", "Technology", "Healthcare", "Politics",
                   "Sports", "Entertainment", "Science", "Other"],
        "description": "",
    },
    "NER": {
        "entity_types": ["PER", "ORG", "LOC", "MISC", "DATE", "MONEY", "PRODUCT"],
        "description": "",
    },
    "SENTIMENT_ANALYSIS": {
        "sentiment_labels": ["positive", "negative", "neutral", "mixed"],
        "aspect_categories": ["product", "service", "price", "delivery", "support"],
        "description": "",
    },
    "TRANSLATION": {
        "source_lang": "EN",
        "target_lang": "AR",
        "glossary": [],
        "description": "",
    },
    "QUESTION_ANSWERING": {
        "qa_type": "extractive",
        "description": "",
    },
    "SUMMARIZATION": {
        "target_ratio": 0.1,
        "max_ratio": 0.15,
        "min_summary_words": 20,
        "description": "",
    },
    "AUDIO_SYNTHESIS": {
        "description": "",
    },
    "AUDIO_TRANSCRIPTION": {
        "speakers": 1,
        "with_timestamps": False,
        "description": "",
    },
    "SPEECH_EMOTION": {
        "emotion_labels": ["neutral", "happy", "sad", "angry",
                           "surprised", "fearful", "disgusted", "contempt"],
        "description": "",
    },
    "AUDIO_EVENT_DETECTION": {
        "event_types": ["speech", "music", "noise", "silence",
                        "applause", "laughter", "alarm", "animal"],
        "description": "",
    },
}

PROMPT_TASKS = {"AUDIO_SYNTHESIS", "SPEECH_EMOTION"}


def parse_date(value):
    if not value:
        return None
    try:
        return datetime.strptime(value, "%Y-%m-%d").date()
    except Exception:
        return None


def compute_competition_status(competition: Competition):
    if competition.is_draft:
        return "DRAFT"

    today = date.today()
    start = parse_date(competition.start_date)
    end = parse_date(competition.end_date)

    if start and today < start:
        return "UPCOMING"
    if start and end and start <= today <= end:
        return "OPEN"
    if end and today > end:
        return "CLOSED"

    return "OPEN"


def task_category(competition: Competition):
    return (competition.task_type or "GENERAL").upper()


def competition_display_dict(competition: Competition) -> dict:
    real_status = compute_competition_status(competition)

    if real_status == "UPCOMING":
        footer = "UPCOMING"
    elif real_status == "OPEN":
        footer = "ACTIVE"
    elif real_status == "CLOSED":
        footer = "ENDED"
    else:
        footer = real_status

    base = {c.name: getattr(competition, c.name) for c in competition.__table__.columns}

    base.update(
        {
            "category": task_category(competition),
            "status": real_status,
            "stat1_label": "REWARD",
            "stat1_value": f"${competition.prize_pool:,}" if competition.prize_pool is not None else "TBD",
            "stat2_label": "DEADLINE",
            "stat2_value": competition.end_date or "TBD",
            "footer": footer,
            "muted": False,
            "datasets_json": "[]",
        }
    )

    return base


def delete_competition_related_rows(db: Session, competition_id: str):
    db.execute(text("DELETE FROM competition_datasets WHERE competition_id = :cid"), {"cid": competition_id})
    db.execute(text("DELETE FROM competition_participants WHERE competition_id = :cid"), {"cid": competition_id})
    db.execute(text("DELETE FROM competition_organizers WHERE competition_id = :cid"), {"cid": competition_id})
    db.execute(text("DELETE FROM recent_competitions WHERE competition_id = :cid"), {"cid": competition_id})
    db.execute(text("DELETE FROM competition_prompts WHERE competition_id = :cid"), {"cid": competition_id})
    db.execute(text("DELETE FROM dataset_versions WHERE competition_id = :cid"), {"cid": competition_id})


def validate_competition_payload(data: CompetitionCreateIn):
    if not data.competition_name or not data.competition_name.strip():
        raise HTTPException(status_code=400, detail="Competition name is required")
    if not data.task_type or not data.task_type.strip():
        raise HTTPException(status_code=400, detail="Task type is required")
    if not data.description or not data.description.strip():
        raise HTTPException(status_code=400, detail="Description is required")

    start = parse_date(data.start_date)
    end = parse_date(data.end_date)

    if data.start_date and not start:
        raise HTTPException(status_code=400, detail="Invalid start date format")
    if data.end_date and not end:
        raise HTTPException(status_code=400, detail="Invalid end date format")
    if start and end and end < start:
        raise HTTPException(status_code=400, detail="End date must be after start date")

    if not data.primary_metric:
        raise HTTPException(status_code=400, detail="Primary metric is required")

    if data.prize_pool is not None and data.prize_pool < 0:
        raise HTTPException(status_code=400, detail="Prize pool cannot be negative")
    if data.max_teams is not None and data.max_teams < 0:
        raise HTTPException(status_code=400, detail="Max teams cannot be negative")
    if data.min_members is not None and data.min_members <= 0:
        raise HTTPException(status_code=400, detail="Min team members must be greater than 0")
    if data.max_members is not None and data.max_members <= 0:
        raise HTTPException(status_code=400, detail="Max team members must be greater than 0")
    if data.min_members is not None and data.max_members is not None and data.min_members > data.max_members:
        raise HTTPException(status_code=400, detail="Min team members cannot exceed max team members")
    if data.max_submissions_per_day is not None and data.max_submissions_per_day <= 0:
        raise HTTPException(status_code=400, detail="Max submissions per day must be greater than 0")

    merge_deadline = parse_date(data.merge_deadline)
    validation_date = parse_date(data.validation_date)
    freeze_date = parse_date(data.freeze_date)

    if data.merge_deadline and not merge_deadline:
        raise HTTPException(status_code=400, detail="Invalid merge deadline format")
    if data.validation_date and not validation_date:
        raise HTTPException(status_code=400, detail="Invalid validation date format")
    if data.freeze_date and not freeze_date:
        raise HTTPException(status_code=400, detail="Invalid freeze date format")

    for label, value in [
        ("Merge deadline", merge_deadline),
        ("Validation date", validation_date),
        ("Freeze date", freeze_date),
    ]:
        if value and start and value < start:
            raise HTTPException(status_code=400, detail=f"{label} cannot be before start date")
        if value and end and value > end:
            raise HTTPException(status_code=400, detail=f"{label} cannot be after end date")

    if validation_date and freeze_date and freeze_date < validation_date:
        raise HTTPException(status_code=400, detail="Freeze date cannot be before validation date")


def _merge_task_config(task_type: str, organizer_config: dict) -> dict:
    """Merge organizer overrides on top of per-task defaults."""
    defaults = dict(TASK_CONFIG_DEFAULTS.get(task_type or "", {}))
    defaults.update(organizer_config or {})
    return defaults


def build_competition_record(data: CompetitionCreateIn, is_draft: bool) -> Competition:
    task_config = getattr(data, "task_config", None) or {}
    merged = _merge_task_config(data.task_type, task_config)
    # Strip the "prompts" key from dataset_config — prompts live in competition_prompts table
    config_to_store = {k: v for k, v in merged.items() if k != "prompts"}

    return Competition(
        title=data.competition_name,
        description=data.description,
        is_draft=is_draft,
        task_type=data.task_type,
        start_date=data.start_date,
        end_date=data.end_date,
        prize_pool=data.prize_pool,
        primary_metric=data.primary_metric,
        secondary_metric=data.secondary_metric,
        max_teams=data.max_teams,
        min_members=data.min_members,
        max_members=data.max_members,
        merge_deadline=data.merge_deadline,
        required_skills=json.dumps(data.required_skills or []),
        max_submissions_per_day=data.max_submissions_per_day,
        allow_external_data=data.allow_external_data,
        allow_pretrained_models=data.allow_pretrained_models,
        require_code_sharing=data.require_code_sharing,
        additional_rules=data.additional_rules,
        complexity_level=data.complexity_level,
        milestones_json=json.dumps(data.milestones or []),
        validation_date=data.validation_date,
        freeze_date=data.freeze_date,
        dataset_config=json.dumps(config_to_store),
    )


def _seed_prompts(db: Session, competition_id: str, task_type: str, task_config: dict):
    """
    If task_type requires prompts (AUDIO_SYNTHESIS, SPEECH_EMOTION) and the
    organizer supplied them, wipe existing prompts and re-seed from the config.
    """
    if task_type not in PROMPT_TASKS:
        return
    raw_prompts = task_config.get("prompts") or []
    if not raw_prompts:
        return

    db.execute(
        text("DELETE FROM competition_prompts WHERE competition_id = :cid"),
        {"cid": competition_id},
    )
    for content in raw_prompts:
        content = content.strip()
        if content:
            db.add(CompetitionPrompt(
                competition_id=competition_id,
                content=content,
                used_count=0,
                created_at=datetime.utcnow().isoformat(),
            ))


def apply_competition_filters(query, db, search, category, tab, current_user):
    if search:
        term = f"%{search}%"
        query = query.filter(
            or_(
                Competition.title.ilike(term),
                Competition.description.ilike(term),
                Competition.task_type.ilike(term),
            )
        )

    if category and category.upper() != "ALL TASKS":
        query = query.filter(Competition.task_type.ilike(category))

    if tab == "participating":
        ids = db.query(CompetitionParticipant.competition_id).filter(
            CompetitionParticipant.user_id == current_user.id
        )
        query = query.filter(Competition.id.in_(ids))
    elif tab == "organizing":
        ids = db.query(CompetitionOrganizer.competition_id).filter(
            CompetitionOrganizer.user_id == current_user.id
        )
        query = query.filter(Competition.id.in_(ids))

    return query


def update_dashboard_stat_for_user(db: Session, user_id: str):
    stats = db.query(DashboardStat).filter(DashboardStat.user_id == user_id).first()

    organized_count = (
        db.query(CompetitionOrganizer)
        .join(Competition, CompetitionOrganizer.competition_id == Competition.id)
        .filter(CompetitionOrganizer.user_id == user_id, Competition.is_draft == False)
        .count()
    )

    joined_count = (
        db.query(CompetitionParticipant)
        .join(Competition, CompetitionParticipant.competition_id == Competition.id)
        .filter(CompetitionParticipant.user_id == user_id, Competition.is_draft == False)
        .count()
    )

    if stats:
        stats.total_competitions = organized_count
        stats.teams_joined = joined_count
    else:
        db.add(DashboardStat(user_id=user_id, total_competitions=organized_count, teams_joined=joined_count))


def get_user_role(db: Session, competition_id: str, user_id: str):
    is_organizer = (
        db.query(CompetitionOrganizer)
        .filter(CompetitionOrganizer.competition_id == competition_id, CompetitionOrganizer.user_id == user_id)
        .first()
        is not None
    )
    if is_organizer:
        return "organizer"

    is_participant = (
        db.query(CompetitionParticipant)
        .filter(CompetitionParticipant.competition_id == competition_id, CompetitionParticipant.user_id == user_id)
        .first()
        is not None
    )
    if is_participant:
        return "participant"

    return "none"


# ─────────────────────────────────────────────────────────────────────────────
# Dataset-config endpoint  ← used by DataCollection.jsx to populate widgets
# ─────────────────────────────────────────────────────────────────────────────

@router.get("/competitions/{competition_id}/dataset-config")
def get_dataset_config(
    competition_id: str,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """
    Returns the merged task configuration for the competition.
    Organizer-supplied values override per-task defaults.
    Also injects prompt_count for audio tasks.
    """
    competition = db.query(Competition).filter(Competition.id == competition_id).first()
    if not competition:
        raise HTTPException(status_code=404, detail="Competition not found")

    task_type = (competition.task_type or "").upper()

    # Load organizer config stored on the competition
    try:
        stored = json.loads(competition.dataset_config or "{}")
    except (json.JSONDecodeError, TypeError):
        stored = {}

    # Merge with defaults (organizer config wins for any key it provides)
    merged = _merge_task_config(task_type, stored)

    # For audio prompt tasks: expose how many prompts are available
    if task_type in PROMPT_TASKS:
        prompt_count = (
            db.query(CompetitionPrompt)
            .filter(CompetitionPrompt.competition_id == competition_id)
            .count()
        )
        merged["prompt_count"] = prompt_count

    return merged


# ─────────────────────────────────────────────────────────────────────────────
# Competition count
# ─────────────────────────────────────────────────────────────────────────────

@router.get("/competitions/count")
def get_competitions_count(
    search: str | None = None,
    category: str | None = None,
    status: str | None = None,
    tab: str = "all",
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    query = db.query(Competition).filter(Competition.is_draft == False)
    query = apply_competition_filters(query, db, search, category, tab, current_user)

    competitions = query.all()

    if status:
        wanted = status.upper()
        return {"count": sum(1 for comp in competitions if compute_competition_status(comp) == wanted)}

    return {"count": len(competitions)}


# ─────────────────────────────────────────────────────────────────────────────
# Draft
# ─────────────────────────────────────────────────────────────────────────────

@router.post("/competitions/draft", response_model=CompetitionActionOut)
def save_competition_draft(
    data: CompetitionCreateIn,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    competition = build_competition_record(data, is_draft=True)

    db.add(competition)
    db.flush()

    db.add(
        CompetitionOrganizer(
            competition_id=competition.id,
            user_id=current_user.id,
            role="owner",
            created_at=datetime.utcnow().isoformat(),
        )
    )

    task_config = getattr(data, "task_config", None) or {}
    _seed_prompts(db, competition.id, data.task_type or "", task_config)

    db.commit()
    db.refresh(competition)

    return {"message": "Competition draft saved successfully", "competition_id": competition.id}


# ─────────────────────────────────────────────────────────────────────────────
# Create
# ─────────────────────────────────────────────────────────────────────────────

@router.post("/competitions/create", response_model=CompetitionActionOut)
def create_competition(
    data: CompetitionCreateIn,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    validate_competition_payload(data)

    competition = build_competition_record(data, is_draft=False)
    db.add(competition)
    db.flush()

    db.add(
        CompetitionOrganizer(
            competition_id=competition.id,
            user_id=current_user.id,
            role="owner",
            created_at=datetime.utcnow().isoformat(),
        )
    )

    status = compute_competition_status(competition)
    db.add(
        RecentCompetition(
            user_id=current_user.id,
            competition_id=competition.id,
            title=competition.title,
            type=task_category(competition),
            status=status,
            score="--",
            sync="Just now",
            icon=get_icon_for_task(data.task_type),
        )
    )

    task_config = getattr(data, "task_config", None) or {}
    _seed_prompts(db, competition.id, data.task_type or "", task_config)

    update_dashboard_stat_for_user(db, current_user.id)
    db.commit()
    db.refresh(competition)

    return {"message": "Competition created successfully", "competition_id": competition.id}


# ─────────────────────────────────────────────────────────────────────────────
# List / search
# ─────────────────────────────────────────────────────────────────────────────

@router.get("/competitions")
def get_competitions(
    limit: int = 20,
    offset: int = 0,
    search: str | None = None,
    category: str | None = None,
    status: str | None = None,
    tab: str = "all",
    sort: str = "newest",
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    query = db.query(Competition).filter(Competition.is_draft == False)
    query = apply_competition_filters(query, db, search, category, tab, current_user)

    competitions = query.all()

    def valid_date_value(value):
        return parse_date(value) is not None

    if sort == "unknown_dates":
        competitions = [c for c in competitions if not valid_date_value(c.start_date) or not valid_date_value(c.end_date)]
    elif sort == "oldest":
        competitions = [c for c in competitions if valid_date_value(c.start_date)]
        competitions.sort(key=lambda c: parse_date(c.start_date))
    else:
        competitions = [c for c in competitions if valid_date_value(c.start_date)]
        competitions.sort(key=lambda c: parse_date(c.start_date), reverse=True)

    if status:
        wanted = status.upper()
        competitions = [comp for comp in competitions if compute_competition_status(comp) == wanted]

    competitions = competitions[offset: offset + limit]

    if not competitions:
        return []

    comp_ids = [c.id for c in competitions]

    organized_ids = {
        row.competition_id
        for row in db.query(CompetitionOrganizer)
        .filter(CompetitionOrganizer.competition_id.in_(comp_ids), CompetitionOrganizer.user_id == current_user.id)
        .all()
    }

    participated_ids = {
        row.competition_id
        for row in db.query(CompetitionParticipant)
        .filter(CompetitionParticipant.competition_id.in_(comp_ids), CompetitionParticipant.user_id == current_user.id)
        .all()
    }

    result = []
    for comp in competitions:
        d = competition_display_dict(comp)

        if comp.id in organized_ids:
            d["user_role"] = "organizer"
        elif comp.id in participated_ids:
            d["user_role"] = "participant"
        else:
            d["user_role"] = "none"

        result.append(d)

    return result


# ─────────────────────────────────────────────────────────────────────────────
# Is-joined
# ─────────────────────────────────────────────────────────────────────────────

@router.get("/competitions/{competition_id}/is-joined")
def is_joined_competition(
    competition_id: str,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    role = get_user_role(db, competition_id, current_user.id)
    return {"joined": role == "participant", "user_role": role}


# ─────────────────────────────────────────────────────────────────────────────
# Join
# ─────────────────────────────────────────────────────────────────────────────

@router.post("/competitions/{competition_id}/join")
def join_competition(
    competition_id: str,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    competition = (
        db.query(Competition)
        .filter(Competition.id == competition_id, Competition.is_draft == False)
        .first()
    )

    if not competition:
        raise HTTPException(status_code=404, detail="Competition not found")

    real_status = compute_competition_status(competition)
    if real_status != "OPEN":
        raise HTTPException(status_code=400, detail=f"Competition is {real_status.lower()} and cannot be joined")

    if get_user_role(db, competition_id, current_user.id) == "organizer":
        raise HTTPException(status_code=400, detail="Organizer cannot join as participant")

    if get_user_role(db, competition_id, current_user.id) == "participant":
        raise HTTPException(status_code=400, detail="Already joined this competition")

    participants_count = db.query(CompetitionParticipant).filter(CompetitionParticipant.competition_id == competition_id).count()

    if competition.max_teams and competition.max_teams > 0 and participants_count >= competition.max_teams:
        raise HTTPException(status_code=400, detail="Competition is full")

    db.add(
        CompetitionParticipant(
            competition_id=competition_id,
            user_id=current_user.id,
            team_id=None,
            status="joined",
            joined_at=datetime.utcnow().isoformat(),
        )
    )

    db.add(
        RecentCompetition(
            competition_id=competition.id,
            user_id=current_user.id,
            title=competition.title,
            type=task_category(competition),
            status="IN PROGRESS",
            score="--",
            sync="Just now",
            icon=get_icon_for_task(competition.task_type),
        )
    )

    update_dashboard_stat_for_user(db, current_user.id)
    db.commit()

    return {"message": "Joined competition successfully"}


# ─────────────────────────────────────────────────────────────────────────────
# Monitoring
# ─────────────────────────────────────────────────────────────────────────────

@router.get("/competitions/{competition_id}/monitoring")
def get_competition_monitoring(
    competition_id: str,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    competition = (
        db.query(Competition)
        .filter(Competition.id == competition_id, Competition.is_draft == False)
        .first()
    )

    if not competition:
        raise HTTPException(status_code=404, detail="Competition not found")

    role = get_user_role(db, competition_id, current_user.id)
    participants_count = db.query(CompetitionParticipant).filter(CompetitionParticipant.competition_id == competition_id).count()
    datasets_count = db.query(CompetitionDataset).filter(CompetitionDataset.competition_id == competition_id).count()

    return {
        "is_organizer": role == "organizer",
        "user_role": role,
        "competition_status": compute_competition_status(competition),
        "participants_count": participants_count,
        "teams_count": participants_count,
        "max_teams": competition.max_teams,
        "datasets_count": datasets_count,
        "data_collection_status": "Configured" if datasets_count else "Not configured",
        "submissions_count": 0,
        "best_score": "Pending",
        "primary_metric": competition.primary_metric or "Not selected",
        "leaderboard_status": "Waiting for submissions",
    }


# ─────────────────────────────────────────────────────────────────────────────
# Get single competition
# ─────────────────────────────────────────────────────────────────────────────

@router.get("/competitions/{competition_id}")
def get_competition_details(
    competition_id: str,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    competition = (
        db.query(Competition)
        .filter(Competition.id == competition_id, Competition.is_draft == False)
        .first()
    )

    if not competition:
        raise HTTPException(status_code=404, detail="Competition not found")

    d = competition_display_dict(competition)
    role = get_user_role(db, competition_id, current_user.id)
    d["user_role"] = role
    d["is_organizer"] = role == "organizer"
    d["is_participant"] = role == "participant"
    d["datasets_count"] = db.query(CompetitionDataset).filter(CompetitionDataset.competition_id == competition_id).count()

    return d


# ─────────────────────────────────────────────────────────────────────────────
# Update
# ─────────────────────────────────────────────────────────────────────────────

@router.put("/competitions/{competition_id}/update")
def update_competition(
    competition_id: str,
    data: CompetitionCreateIn,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    validate_competition_payload(data)

    competition = db.query(Competition).filter(Competition.id == competition_id).first()

    if not competition:
        raise HTTPException(status_code=404, detail="Competition not found")

    is_organizer = (
        db.query(CompetitionOrganizer)
        .filter(CompetitionOrganizer.competition_id == competition_id, CompetitionOrganizer.user_id == current_user.id)
        .first()
    )

    if not is_organizer:
        raise HTTPException(status_code=403, detail="Not allowed")

    competition.title = data.competition_name
    competition.task_type = data.task_type
    competition.description = data.description
    competition.start_date = data.start_date
    competition.end_date = data.end_date
    competition.prize_pool = data.prize_pool
    competition.primary_metric = data.primary_metric
    competition.secondary_metric = data.secondary_metric

    competition.max_teams = data.max_teams
    competition.min_members = data.min_members
    competition.max_members = data.max_members
    competition.merge_deadline = data.merge_deadline

    competition.required_skills = json.dumps(data.required_skills or [])
    competition.max_submissions_per_day = data.max_submissions_per_day
    competition.allow_external_data = data.allow_external_data
    competition.allow_pretrained_models = data.allow_pretrained_models
    competition.require_code_sharing = data.require_code_sharing
    competition.additional_rules = data.additional_rules

    competition.complexity_level = data.complexity_level
    competition.milestones_json = json.dumps(data.milestones or [])

    competition.validation_date = data.validation_date
    competition.freeze_date = data.freeze_date
    competition.is_draft = False

    # Save updated task config
    task_config = getattr(data, "task_config", None) or {}
    merged = _merge_task_config(data.task_type, task_config)
    config_to_store = {k: v for k, v in merged.items() if k != "prompts"}
    competition.dataset_config = json.dumps(config_to_store)

    # Re-seed prompts if applicable
    _seed_prompts(db, competition_id, data.task_type or "", task_config)

    real_status = compute_competition_status(competition)

    recent_rows = db.query(RecentCompetition).filter(RecentCompetition.competition_id == competition_id).all()

    if recent_rows:
        for row in recent_rows:
            row.title = competition.title
            row.type = task_category(competition)
            row.status = real_status
            row.icon = get_icon_for_task(competition.task_type)
    else:
        db.add(
            RecentCompetition(
                user_id=current_user.id,
                competition_id=competition_id,
                title=competition.title,
                type=task_category(competition),
                status=real_status,
                score="--",
                sync="Just now",
                icon=get_icon_for_task(competition.task_type),
            )
        )

    update_dashboard_stat_for_user(db, current_user.id)
    db.commit()

    return {"message": "Competition updated successfully"}


# ─────────────────────────────────────────────────────────────────────────────
# Delete
# ─────────────────────────────────────────────────────────────────────────────

@router.delete("/competitions/{competition_id}")
def delete_competition(
    competition_id: str,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    competition = db.query(Competition).filter(Competition.id == competition_id).first()

    if not competition:
        raise HTTPException(status_code=404, detail="Competition not found")

    is_organizer = (
        db.query(CompetitionOrganizer)
        .filter(CompetitionOrganizer.competition_id == competition_id, CompetitionOrganizer.user_id == current_user.id)
        .first()
    )

    if not is_organizer:
        raise HTTPException(status_code=403, detail="Not allowed")

    delete_competition_related_rows(db, competition_id)
    db.flush()

    db.delete(competition)
    update_dashboard_stat_for_user(db, current_user.id)
    db.commit()

    return {"message": "Competition deleted successfully"}