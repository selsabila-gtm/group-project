from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from models import Competition, CompetitionOrganizer, CompetitionParticipant, RecentCompetition
from .utils import get_db

router = APIRouter(tags=["dashboard"])


@router.get("/dashboard/stats/{user_id}")
def get_dashboard_stats(user_id: str, db: Session = Depends(get_db)):
    total_competitions = db.query(CompetitionOrganizer).filter(
        CompetitionOrganizer.user_id == user_id
    ).count()

    teams_joined = db.query(CompetitionParticipant).filter(
        CompetitionParticipant.user_id == user_id
    ).count()

    return {
        "user_id": user_id,
        "total_competitions": total_competitions,
        "teams_joined": teams_joined,
    }


@router.get("/dashboard/recent/{user_id}")
def get_recent_competitions(user_id: str, db: Session = Depends(get_db)):
    return (
        db.query(RecentCompetition)
        .filter(RecentCompetition.user_id == user_id)
        .order_by(RecentCompetition.id.desc())
        .limit(10)
        .all()
    )
