import json
from datetime import datetime, date

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import or_, text

from models import (
    Competition,
    CompetitionOrganizer,
    CompetitionParticipant,
    DashboardStat,
    RecentCompetition,
)
from schemas import CompetitionCreateIn, CompetitionActionOut
from .utils import get_db, get_current_user, get_icon_for_task

router = APIRouter(tags=["competitions"])


# ── Helpers ────────────────────────────────────────────────────────────────────

def parse_date(value):
    if not value:
        return None
    try:
        return datetime.strptime(value, "%Y-%m-%d").date()
    except Exception:
        return None


def compute_competition_status(competition: Competition):
    today = date.today()
    start = parse_date(competition.start_date)
    end = parse_date(competition.end_date)

    if start and today < start:
        return "UPCOMING"

    if start and end and start <= today <= end:
        return "OPEN"

    if end and today > end:
        return "CLOSED"

    return competition.status or "OPEN"


def refresh_competition_display_fields(competition: Competition):
    real_status = compute_competition_status(competition)

    competition.status = real_status
    competition.category = (competition.task_type or competition.category or "GENERAL").upper()

    competition.stat1_label = "REWARD"
    competition.stat1_value = (
        f"${competition.prize_pool:,}"
        if competition.prize_pool is not None
        else "TBD"
    )

    competition.stat2_label = "DEADLINE"
    competition.stat2_value = competition.end_date or "TBD"

    if real_status == "UPCOMING":
        competition.footer = "UPCOMING"
    elif real_status == "OPEN":
        competition.footer = "ACTIVE"
    elif real_status == "CLOSED":
        competition.footer = "ENDED"
    else:
        competition.footer = real_status

    return competition


def delete_competition_related_rows(db: Session, competition_id: str):
    """Delete all child rows for a competition using raw SQL to avoid ORM cascade issues."""
    db.execute(text("DELETE FROM competition_datasets WHERE competition_id = :cid"), {"cid": competition_id})
    db.execute(text("DELETE FROM competition_participants WHERE competition_id = :cid"), {"cid": competition_id})
    db.execute(text("DELETE FROM competition_organizers WHERE competition_id = :cid"), {"cid": competition_id})
    db.execute(text("DELETE FROM recent_competitions WHERE competition_id = :cid"), {"cid": competition_id})


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

    if (
        data.min_members is not None
        and data.max_members is not None
        and data.min_members > data.max_members
    ):
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

    if merge_deadline and merge_deadline < start:
        raise HTTPException(status_code=400, detail="Merge deadline cannot be before start date")

    if merge_deadline and merge_deadline > end:
        raise HTTPException(status_code=400, detail="Merge deadline cannot be after end date")

    if validation_date and validation_date < start:
        raise HTTPException(status_code=400, detail="Validation date cannot be before start date")

    if validation_date and validation_date > end:
        raise HTTPException(status_code=400, detail="Validation date cannot be after end date")

    if freeze_date and freeze_date < start:
        raise HTTPException(status_code=400, detail="Freeze date cannot be before start date")

    if freeze_date and freeze_date > end:
        raise HTTPException(status_code=400, detail="Freeze date cannot be after end date")

    if validation_date and freeze_date and freeze_date < validation_date:
        raise HTTPException(status_code=400, detail="Freeze date cannot be before validation date")


def build_competition_record(data: CompetitionCreateIn, is_draft: bool) -> Competition:
    category = data.task_type.upper() if data.task_type else "GENERAL"

    if is_draft:
        status = "DRAFT"
        stat1_label = "STATUS"
        stat1_value = "Draft"
        stat2_label = "STEP"
        stat2_value = "Saved"
        footer = "DRAFT"
    else:
        status = "OPEN"
        stat1_label = "REWARD"
        stat1_value = f"${data.prize_pool:,}" if data.prize_pool is not None else "TBD"
        stat2_label = "DEADLINE"
        stat2_value = data.end_date if data.end_date else "TBD"
        footer = "ACTIVE"

    competition = Competition(
        category=category,
        status=status,
        title=data.competition_name,
        description=data.description,
        stat1_label=stat1_label,
        stat1_value=str(stat1_value),
        stat2_label=stat2_label,
        stat2_value=str(stat2_value),
        footer=footer,
        muted=False,
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
        datasets_json=json.dumps(data.datasets or []),
        milestones_json=json.dumps(data.milestones or []),
        validation_date=data.validation_date,
        freeze_date=data.freeze_date,
    )

    if not is_draft:
        refresh_competition_display_fields(competition)

    return competition


def apply_competition_filters(query, db, search, category, status, tab, current_user):
    if search:
        term = f"%{search}%"
        query = query.filter(
            or_(
                Competition.title.ilike(term),
                Competition.description.ilike(term),
                Competition.category.ilike(term),
                Competition.task_type.ilike(term),
            )
        )

    if category and category.upper() != "ALL TASKS":
        query = query.filter(Competition.category.ilike(category))

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


def _comp_to_dict(comp: Competition) -> dict:
    refresh_competition_display_fields(comp)
    return {c.name: getattr(comp, c.name) for c in comp.__table__.columns}


def update_dashboard_stat_for_user(db: Session, user_id: str):
    stats = db.query(DashboardStat).filter(DashboardStat.user_id == user_id).first()

    organized_count = (
        db.query(CompetitionOrganizer)
        .join(Competition, CompetitionOrganizer.competition_id == Competition.id)
        .filter(
            CompetitionOrganizer.user_id == user_id,
            Competition.is_draft == False,
        )
        .count()
    )

    joined_count = (
        db.query(CompetitionParticipant)
        .join(Competition, CompetitionParticipant.competition_id == Competition.id)
        .filter(
            CompetitionParticipant.user_id == user_id,
            Competition.is_draft == False,
        )
        .count()
    )

    if stats:
        stats.total_competitions = organized_count
        stats.teams_joined = joined_count
    else:
        db.add(
            DashboardStat(
                user_id=user_id,
                total_competitions=organized_count,
                teams_joined=joined_count,
            )
        )


# ── Routes ─────────────────────────────────────────────────────────────────────

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

    competitions = query.all()

    if status:
        wanted = status.upper()
        count = sum(1 for comp in competitions if compute_competition_status(comp) == wanted)
        return {"count": count}

    return {"count": len(competitions)}


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

    db.commit()
    db.refresh(competition)

    return {
        "message": "Competition draft saved successfully",
        "competition_id": competition.id,
    }


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

    db.add(
        RecentCompetition(
            user_id=current_user.id,
            competition_id=competition.id,
            title=competition.title,
            type=competition.category,
            status=competition.status,
            score="--",
            sync="Just now",
            icon=get_icon_for_task(data.task_type),
        )
    )

    update_dashboard_stat_for_user(db, current_user.id)

    db.commit()
    db.refresh(competition)

    return {
        "message": "Competition created successfully",
        "competition_id": competition.id,
    }


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
    query = apply_competition_filters(query, db, search, category, None, tab, current_user)

    competitions = query.all()

    def valid_date_value(value):
        parsed = parse_date(value)
        return parsed is not None

    if sort == "unknown_dates":
        competitions = [
            c for c in competitions
            if not valid_date_value(c.start_date) or not valid_date_value(c.end_date)
        ]

    elif sort == "oldest":
        competitions = [
            c for c in competitions
            if valid_date_value(c.start_date)
        ]
        competitions.sort(key=lambda c: parse_date(c.start_date))

    else:
        competitions = [
            c for c in competitions
            if valid_date_value(c.start_date)
        ]
        competitions.sort(key=lambda c: parse_date(c.start_date), reverse=True)

    if status:
        wanted = status.upper()
        competitions = [
            comp for comp in competitions
            if compute_competition_status(comp) == wanted
        ]

    competitions = competitions[offset: offset + limit]

    if not competitions:
        return []

    comp_ids = [c.id for c in competitions]

    organized_ids = {
        row.competition_id
        for row in db.query(CompetitionOrganizer)
        .filter(
            CompetitionOrganizer.competition_id.in_(comp_ids),
            CompetitionOrganizer.user_id == current_user.id,
        )
        .all()
    }

    participated_ids = {
        row.competition_id
        for row in db.query(CompetitionParticipant)
        .filter(
            CompetitionParticipant.competition_id.in_(comp_ids),
            CompetitionParticipant.user_id == current_user.id,
        )
        .all()
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

    db.commit()

    return result


@router.get("/competitions/{competition_id}/is-joined")
def is_joined_competition(
    competition_id: str,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    participant = (
        db.query(CompetitionParticipant)
        .filter(
            CompetitionParticipant.competition_id == competition_id,
            CompetitionParticipant.user_id == current_user.id,
        )
        .first()
    )

    return {"joined": participant is not None}


@router.post("/competitions/{competition_id}/join")
def join_competition(
    competition_id: str,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    competition = (
        db.query(Competition)
        .filter(
            Competition.id == competition_id,
            Competition.is_draft == False,
        )
        .first()
    )

    if not competition:
        raise HTTPException(status_code=404, detail="Competition not found")

    real_status = compute_competition_status(competition)

    if real_status != "OPEN":
        raise HTTPException(
            status_code=400,
            detail=f"Competition is {real_status.lower()} and cannot be joined",
        )

    is_organizer = (
        db.query(CompetitionOrganizer)
        .filter(
            CompetitionOrganizer.competition_id == competition_id,
            CompetitionOrganizer.user_id == current_user.id,
        )
        .first()
    )

    if is_organizer:
        raise HTTPException(status_code=400, detail="Organizer cannot join as participant")

    already_joined = (
        db.query(CompetitionParticipant)
        .filter(
            CompetitionParticipant.competition_id == competition_id,
            CompetitionParticipant.user_id == current_user.id,
        )
        .first()
    )

    if already_joined:
        raise HTTPException(status_code=400, detail="Already joined this competition")

    participants_count = (
        db.query(CompetitionParticipant)
        .filter(CompetitionParticipant.competition_id == competition_id)
        .count()
    )

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
            type=competition.category,
            status="IN PROGRESS",
            score="--",
            sync="Just now",
            icon=get_icon_for_task(competition.task_type),
        )
    )

    update_dashboard_stat_for_user(db, current_user.id)

    db.commit()

    return {"message": "Joined competition successfully"}


@router.get("/competitions/{competition_id}/monitoring")
def get_competition_monitoring(
    competition_id: str,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    competition = (
        db.query(Competition)
        .filter(
            Competition.id == competition_id,
            Competition.is_draft == False,
        )
        .first()
    )

    if not competition:
        raise HTTPException(status_code=404, detail="Competition not found")

    refresh_competition_display_fields(competition)

    is_organizer = (
        db.query(CompetitionOrganizer)
        .filter(
            CompetitionOrganizer.competition_id == competition_id,
            CompetitionOrganizer.user_id == current_user.id,
        )
        .first()
        is not None
    )

    participants_count = (
        db.query(CompetitionParticipant)
        .filter(CompetitionParticipant.competition_id == competition_id)
        .count()
    )

    datasets = []
    if competition.datasets_json:
        try:
            datasets = json.loads(competition.datasets_json)
        except Exception:
            datasets = []

    db.commit()

    return {
        "is_organizer": is_organizer,
        "competition_status": competition.status,
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
    competition = (
        db.query(Competition)
        .filter(
            Competition.id == competition_id,
            Competition.is_draft == False,
        )
        .first()
    )

    if not competition:
        raise HTTPException(status_code=404, detail="Competition not found")

    refresh_competition_display_fields(competition)
    db.commit()
    db.refresh(competition)

    return competition


@router.put("/competitions/{competition_id}/update")
def update_competition(
    competition_id: str,
    data: CompetitionCreateIn,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    validate_competition_payload(data)

    competition = (
        db.query(Competition)
        .filter(Competition.id == competition_id)
        .first()
    )

    if not competition:
        raise HTTPException(status_code=404, detail="Competition not found")

    is_organizer = (
        db.query(CompetitionOrganizer)
        .filter(
            CompetitionOrganizer.competition_id == competition_id,
            CompetitionOrganizer.user_id == current_user.id,
        )
        .first()
    )

    if not is_organizer:
        raise HTTPException(status_code=403, detail="Not allowed")

    # Delete competition_datasets rows before updating — avoids NOT NULL violation
    db.execute(text("DELETE FROM competition_datasets WHERE competition_id = :cid"), {"cid": competition_id})
    db.flush()

    competition.title = data.competition_name
    competition.task_type = data.task_type
    competition.category = data.task_type.upper()
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
    competition.datasets_json = json.dumps(data.datasets or [])
    competition.milestones_json = json.dumps(data.milestones or [])

    competition.validation_date = data.validation_date
    competition.freeze_date = data.freeze_date

    # Promote draft to real competition on publish
    competition.is_draft = False

    refresh_competition_display_fields(competition)

    recent_rows = (
        db.query(RecentCompetition)
        .filter(RecentCompetition.competition_id == competition_id)
        .all()
    )

    if recent_rows:
        for row in recent_rows:
            row.title = competition.title
            row.type = competition.category
            row.status = competition.status
            row.icon = get_icon_for_task(competition.task_type)
    else:
        db.add(
            RecentCompetition(
                user_id=current_user.id,
                competition_id=competition_id,
                title=competition.title,
                type=competition.category,
                status=competition.status,
                score="--",
                sync="Just now",
                icon=get_icon_for_task(competition.task_type),
            )
        )

    update_dashboard_stat_for_user(db, current_user.id)

    db.commit()

    return {"message": "Competition updated successfully"}


@router.delete("/competitions/{competition_id}")
def delete_competition(
    competition_id: str,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    competition = (
        db.query(Competition)
        .filter(Competition.id == competition_id)
        .first()
    )

    if not competition:
        raise HTTPException(status_code=404, detail="Competition not found")

    is_organizer = (
        db.query(CompetitionOrganizer)
        .filter(
            CompetitionOrganizer.competition_id == competition_id,
            CompetitionOrganizer.user_id == current_user.id,
        )
        .first()
    )

    if not is_organizer:
        raise HTTPException(status_code=403, detail="Not allowed")

    # Delete all child rows with raw SQL to avoid ORM cascade/null issues
    db.execute(text("DELETE FROM competition_datasets WHERE competition_id = :cid"), {"cid": competition_id})
    db.execute(text("DELETE FROM competition_participants WHERE competition_id = :cid"), {"cid": competition_id})
    db.execute(text("DELETE FROM competition_organizers WHERE competition_id = :cid"), {"cid": competition_id})
    db.execute(text("DELETE FROM recent_competitions WHERE competition_id = :cid"), {"cid": competition_id})
    db.flush()

    db.delete(competition)

    update_dashboard_stat_for_user(db, current_user.id)

    db.commit()

    return {"message": "Competition deleted successfully"}