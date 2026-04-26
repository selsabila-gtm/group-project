import json
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import or_

from models import (
    Competition, CompetitionOrganizer, CompetitionParticipant,
    DashboardStat, RecentCompetition,
)
from schemas import CompetitionCreateIn, CompetitionActionOut
from .utils import get_db, get_current_user, get_icon_for_task

router = APIRouter(tags=["competitions"])


# ── Helpers ────────────────────────────────────────────────────────────────────

def validate_competition_payload(data: CompetitionCreateIn):
    if not data.competition_name or not data.competition_name.strip():
        raise HTTPException(status_code=400, detail="Competition name is required")
    if not data.task_type or not data.task_type.strip():
        raise HTTPException(status_code=400, detail="Task type is required")
    if not data.description or not data.description.strip():
        raise HTTPException(status_code=400, detail="Description is required")
    if not data.start_date:
        raise HTTPException(status_code=400, detail="Start date is required")
    if not data.end_date:
        raise HTTPException(status_code=400, detail="End date is required")
    if data.end_date < data.start_date:
        raise HTTPException(status_code=400, detail="End date must be after start date")
    if not data.primary_metric:
        raise HTTPException(status_code=400, detail="Primary metric is required")
    if data.prize_pool is not None and data.prize_pool < 0:
        raise HTTPException(status_code=400, detail="Prize pool cannot be negative")
    if (data.min_members is not None and data.max_members is not None
            and data.min_members > data.max_members):
        raise HTTPException(status_code=400, detail="Min team members cannot exceed max")
    if data.max_submissions_per_day is not None and data.max_submissions_per_day <= 0:
        raise HTTPException(status_code=400, detail="Max submissions per day must be > 0")
    if data.merge_deadline and data.start_date and data.merge_deadline < data.start_date:
        raise HTTPException(status_code=400, detail="Merge deadline cannot be before start date")
    if data.validation_date and data.start_date and data.validation_date < data.start_date:
        raise HTTPException(status_code=400, detail="Validation date cannot be before start date")
    if data.freeze_date and data.start_date and data.freeze_date < data.start_date:
        raise HTTPException(status_code=400, detail="Freeze date cannot be before start date")


def build_competition_record(data: CompetitionCreateIn, is_draft: bool) -> Competition:
    category = data.task_type.upper() if data.task_type else "GENERAL"
    if is_draft:
        status, stat1_label, stat1_value = "DRAFT", "STATUS", "Draft"
        stat2_label, stat2_value, footer = "STEP", "Saved", "DRAFT"
    else:
        status = "OPEN"
        stat1_label, stat1_value = "REWARD", f"${data.prize_pool:,}" if data.prize_pool else "TBD"
        stat2_label, stat2_value, footer = "DEADLINE", data.end_date if data.end_date else "TBD", "NEW"

    return Competition(
        category=category, status=status, title=data.competition_name,
        description=data.description,
        stat1_label=stat1_label, stat1_value=str(stat1_value),
        stat2_label=stat2_label, stat2_value=str(stat2_value),
        footer=footer, muted=False, is_draft=is_draft,
        task_type=data.task_type, start_date=data.start_date, end_date=data.end_date,
        prize_pool=data.prize_pool, primary_metric=data.primary_metric,
        secondary_metric=data.secondary_metric, max_teams=data.max_teams,
        min_members=data.min_members, max_members=data.max_members,
        merge_deadline=data.merge_deadline,
        required_skills=json.dumps(data.required_skills),
        max_submissions_per_day=data.max_submissions_per_day,
        allow_external_data=data.allow_external_data,
        allow_pretrained_models=data.allow_pretrained_models,
        require_code_sharing=data.require_code_sharing,
        additional_rules=data.additional_rules,
        complexity_level=data.complexity_level,
        datasets_json=json.dumps(data.datasets),
        milestones_json=json.dumps(data.milestones),
        validation_date=data.validation_date, freeze_date=data.freeze_date,
    )


def apply_competition_filters(query, db, search, category, status, tab, current_user):
    if search:
        term = f"%{search}%"
        query = query.filter(or_(
            Competition.title.ilike(term),
            Competition.description.ilike(term),
            Competition.category.ilike(term),
        ))
    if category and category.upper() != "ALL TASKS":
        query = query.filter(Competition.category.ilike(category))
    if status:
        query = query.filter(Competition.status.ilike(status))
    if tab == "participating":
        ids = db.query(CompetitionParticipant.competition_id).filter(
            CompetitionParticipant.user_id == current_user.id)
        query = query.filter(Competition.id.in_(ids))
    elif tab == "organizing":
        ids = db.query(CompetitionOrganizer.competition_id).filter(
            CompetitionOrganizer.user_id == current_user.id)
        query = query.filter(Competition.id.in_(ids))
    return query


def _comp_to_dict(comp: Competition) -> dict:
    """Serialize a Competition ORM object to a plain dict."""
    return {c.name: getattr(comp, c.name) for c in comp.__table__.columns}


# ── Routes ─────────────────────────────────────────────────────────────────────

# NOTE: /competitions/count and /competitions/draft must be registered BEFORE
# /competitions/{competition_id} to avoid FastAPI treating "count"/"draft" as IDs.

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
    query = apply_competition_filters(query, db, search, category, status, tab, current_user)
    return {"count": query.count()}


@router.post("/competitions/draft", response_model=CompetitionActionOut)
def save_competition_draft(
    data: CompetitionCreateIn,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    competition = build_competition_record(data, is_draft=True)
    db.add(competition)
    db.flush()
    db.add(CompetitionOrganizer(
        competition_id=competition.id, user_id=current_user.id,
        role="owner", created_at=datetime.utcnow().isoformat(),
    ))
    db.commit()
    db.refresh(competition)
    return {"message": "Competition draft saved successfully", "competition_id": competition.id}


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

    db.add(CompetitionOrganizer(
        competition_id=competition.id, user_id=current_user.id,
        role="owner", created_at=datetime.utcnow().isoformat(),
    ))

    stats = db.query(DashboardStat).filter(DashboardStat.user_id == current_user.id).first()
    if stats:
        stats.total_competitions = (
            db.query(Competition).filter(Competition.is_draft == False).count() + 1
        )
    else:
        db.add(DashboardStat(user_id=current_user.id, total_competitions=1, teams_joined=0))

    db.add(RecentCompetition(
        user_id=current_user.id, competition_id=competition.id,
        title=competition.title, type=competition.category,
        status=competition.status, score="--", sync="Just now",
        icon=get_icon_for_task(data.task_type),
    ))
    db.commit()
    db.refresh(competition)
    return {"message": "Competition created successfully", "competition_id": competition.id}


@router.get("/competitions")
def get_competitions(
    limit: int = 20,
    offset: int = 0,
    search: str | None = None,
    category: str | None = None,
    status: str | None = None,
    tab: str = "all",
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    query = db.query(Competition).filter(Competition.is_draft == False)
    query = apply_competition_filters(query, db, search, category, status, tab, current_user)
    competitions = query.offset(offset).limit(limit).all()

    if not competitions:
        return []

    # Resolve the current user's role for every competition in one pair of queries
    comp_ids = [c.id for c in competitions]

    organized_ids = {
        row.competition_id
        for row in db.query(CompetitionOrganizer).filter(
            CompetitionOrganizer.competition_id.in_(comp_ids),
            CompetitionOrganizer.user_id == current_user.id,
        ).all()
    }
    participated_ids = {
        row.competition_id
        for row in db.query(CompetitionParticipant).filter(
            CompetitionParticipant.competition_id.in_(comp_ids),
            CompetitionParticipant.user_id == current_user.id,
        ).all()
    }

    result = []
    for comp in competitions:
        d = _comp_to_dict(comp)
        if comp.id in organized_ids:
            d["user_role"] = "organizer"
        elif comp.id in participated_ids:
            d["user_role"] = "participant"
        else:
            d["user_role"] = "none"
        result.append(d)

    return result


@router.get("/competitions/{competition_id}/is-joined")
def is_joined_competition(
    competition_id: str,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    participant = db.query(CompetitionParticipant).filter(
        CompetitionParticipant.competition_id == competition_id,
        CompetitionParticipant.user_id == current_user.id,
    ).first()
    return {"joined": participant is not None}


@router.post("/competitions/{competition_id}/join")
def join_competition(
    competition_id: str,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    competition = db.query(Competition).filter(
        Competition.id == competition_id, Competition.is_draft == False
    ).first()
    if not competition:
        raise HTTPException(status_code=404, detail="Competition not found")
    if competition.status != "OPEN":
        raise HTTPException(status_code=400, detail="Competition is not open")

    if db.query(CompetitionOrganizer).filter(
        CompetitionOrganizer.competition_id == competition_id,
        CompetitionOrganizer.user_id == current_user.id,
    ).first():
        raise HTTPException(status_code=400, detail="Organizer cannot join as participant")

    if db.query(CompetitionParticipant).filter(
        CompetitionParticipant.competition_id == competition_id,
        CompetitionParticipant.user_id == current_user.id,
    ).first():
        raise HTTPException(status_code=400, detail="Already joined this competition")

    db.add(CompetitionParticipant(
        competition_id=competition_id, user_id=current_user.id,
        team_id=None, status="joined", joined_at=datetime.utcnow().isoformat(),
    ))
    db.add(RecentCompetition(
        competition_id=competition.id, user_id=current_user.id,
        title=competition.title, type=competition.category,
        status="IN PROGRESS", score="--", sync="Just now",
        icon=get_icon_for_task(competition.task_type),
    ))

    stats = db.query(DashboardStat).filter(DashboardStat.user_id == current_user.id).first()
    if stats:
        stats.teams_joined += 1
    else:
        db.add(DashboardStat(
            user_id=current_user.id,
            total_competitions=db.query(Competition).filter(Competition.is_draft == False).count(),
            teams_joined=1,
        ))
    db.commit()
    return {"message": "Joined competition successfully"}


@router.get("/competitions/{competition_id}/monitoring")
def get_competition_monitoring(
    competition_id: str,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    competition = db.query(Competition).filter(
        Competition.id == competition_id, Competition.is_draft == False
    ).first()
    if not competition:
        raise HTTPException(status_code=404, detail="Competition not found")

    is_organizer = db.query(CompetitionOrganizer).filter(
        CompetitionOrganizer.competition_id == competition_id,
        CompetitionOrganizer.user_id == current_user.id,
    ).first() is not None

    participants_count = db.query(CompetitionParticipant).filter(
        CompetitionParticipant.competition_id == competition_id
    ).count()

    datasets = []
    if competition.datasets_json:
        try:
            datasets = json.loads(competition.datasets_json)
        except Exception:
            datasets = []

    return {
        "is_organizer": is_organizer,
        "participants_count": participants_count,
        "teams_count": participants_count,
        "max_teams": competition.max_teams,
        "datasets_count": len(datasets),
        "data_collection_status": "Configured" if datasets else "Not configured",
        "submissions_count": 0,
        "best_score": "Pending",
        "primary_metric": competition.primary_metric or "Not selected",
        "leaderboard_status": "Waiting for submissions",
    }


@router.get("/competitions/{competition_id}")
def get_competition_details(
    competition_id: str,
    db: Session = Depends(get_db),
):
    competition = db.query(Competition).filter(
        Competition.id == competition_id, Competition.is_draft == False
    ).first()
    if not competition:
        raise HTTPException(status_code=404, detail="Competition not found")
    return competition
