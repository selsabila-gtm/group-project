from datetime import datetime, date
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from models import (
    Competition,
    CompetitionOrganizer,
    CompetitionParticipant,
)
from models_teams import TeamMember
from .utils import get_db, get_icon_for_task

router = APIRouter(tags=["dashboard"])


def compute_status(comp: Competition):
    today = date.today()

    try:
        start = datetime.strptime(comp.start_date, "%Y-%m-%d").date() if comp.start_date else None
        end = datetime.strptime(comp.end_date, "%Y-%m-%d").date() if comp.end_date else None
    except Exception:
        return comp.status or "UNKNOWN"

    if start and today < start:
        return "UPCOMING"

    if start and end and start <= today <= end:
        return "OPEN"

    if end and today > end:
        return "CLOSED"

    return comp.status or "OPEN"


def time_ago(value):
    if not value:
        return "Recently"

    try:
        if isinstance(value, str):
            dt = datetime.fromisoformat(value.replace("Z", "+00:00")).replace(tzinfo=None)
        else:
            dt = value.replace(tzinfo=None)

        diff = datetime.utcnow() - dt

        if diff.days > 0:
            return f"{diff.days} day{'s' if diff.days > 1 else ''} ago"

        hours = diff.seconds // 3600
        if hours > 0:
            return f"{hours} hour{'s' if hours > 1 else ''} ago"

        minutes = diff.seconds // 60
        if minutes > 0:
            return f"{minutes} minute{'s' if minutes > 1 else ''} ago"

        return "Just now"
    except Exception:
        return "Recently"


@router.get("/dashboard/stats/{user_id}")
def get_dashboard_stats(user_id: str, db: Session = Depends(get_db)):
    organized_competitions = (
        db.query(CompetitionOrganizer)
        .join(Competition, CompetitionOrganizer.competition_id == Competition.id)
        .filter(
            CompetitionOrganizer.user_id == user_id,
            Competition.is_draft == False,
        )
        .count()
    )

    joined_competitions = (
        db.query(CompetitionParticipant)
        .join(Competition, CompetitionParticipant.competition_id == Competition.id)
        .filter(
            CompetitionParticipant.user_id == user_id,
            Competition.is_draft == False,
        )
        .count()
    )

    teams_joined = (
        db.query(TeamMember)
        .filter(TeamMember.user_id == user_id)
        .count()
    )

    return {
        "user_id": user_id,
        "organized_competitions": organized_competitions,
        "joined_competitions": joined_competitions,
        "teams_joined": teams_joined,
    }


@router.get("/dashboard/recent/{user_id}")
def get_recent_competitions(user_id: str, db: Session = Depends(get_db)):
    organized = (
        db.query(Competition, CompetitionOrganizer.created_at)
        .join(CompetitionOrganizer, CompetitionOrganizer.competition_id == Competition.id)
        .filter(
            CompetitionOrganizer.user_id == user_id,
            Competition.is_draft == False,
        )
        .all()
    )

    joined = (
        db.query(Competition, CompetitionParticipant.joined_at)
        .join(CompetitionParticipant, CompetitionParticipant.competition_id == Competition.id)
        .filter(
            CompetitionParticipant.user_id == user_id,
            Competition.is_draft == False,
        )
        .all()
    )

    rows = []

    for comp, action_time in organized:
        rows.append({
            "id": f"organized-{comp.id}",
            "competition_id": comp.id,
            "title": comp.title,
            "type": comp.task_type or comp.category,
            "status": compute_status(comp),
            "score": "--",
            "sync": time_ago(action_time),
            "icon": get_icon_for_task(comp.task_type),
            "role": "ORGANIZER",
            "action_time": str(action_time or ""),
        })

    for comp, action_time in joined:
        rows.append({
            "id": f"joined-{comp.id}",
            "competition_id": comp.id,
            "title": comp.title,
            "type": comp.task_type or comp.category,
            "status": compute_status(comp),
            "score": "--",
            "sync": time_ago(action_time),
            "icon": get_icon_for_task(comp.task_type),
            "role": "PARTICIPANT",
            "action_time": str(action_time or ""),
        })

    rows.sort(key=lambda x: x["action_time"], reverse=True)

    return rows[:10]