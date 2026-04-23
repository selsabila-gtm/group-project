from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import or_

from database import SessionLocal
from models import User, DashboardStat, Competition, RecentCompetition, Notification
from schemas import (
    UserCreate,
    UserLogin,
    DashboardStatOut,
    CompetitionOut,
    RecentCompetitionOut,
    NotificationOut,
)
from auth import hash_password, verify_password, create_access_token

router = APIRouter()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


@router.post("/signup")
def signup(user: UserCreate, db: Session = Depends(get_db)):
    existing_user = db.query(User).filter(User.email == user.email).first()

    if existing_user:
        raise HTTPException(status_code=400, detail="Email already exists")

    new_user = User(
        full_name=user.full_name,
        email=user.email,
        password=hash_password(user.password)
    )

    db.add(new_user)
    db.commit()
    db.refresh(new_user)

    return {"message": "User created successfully"}


@router.post("/login")
def login(user: UserLogin, db: Session = Depends(get_db)):
    db_user = db.query(User).filter(User.email == user.email).first()

    if not db_user:
        raise HTTPException(status_code=400, detail="User not found")

    if not verify_password(user.password, db_user.password):
        raise HTTPException(status_code=400, detail="Incorrect password")

    token = create_access_token({
        "sub": db_user.email,
        "user_id": db_user.id
    })

    return {
        "access_token": token,
        "token_type": "bearer"
    }


@router.get("/dashboard/stats/{user_id}", response_model=DashboardStatOut)
def get_dashboard_stats(user_id: str, db: Session = Depends(get_db)):
    stats = db.query(DashboardStat).filter(DashboardStat.user_id == user_id).first()
    if not stats:
        raise HTTPException(status_code=404, detail="Dashboard stats not found")
    return stats


@router.get("/dashboard/recent/{user_id}", response_model=list[RecentCompetitionOut])
def get_recent_competitions(user_id: str, db: Session = Depends(get_db)):
    return db.query(RecentCompetition).filter(
        RecentCompetition.user_id == user_id
    ).all()


@router.get("/dashboard/notifications/{user_id}", response_model=list[NotificationOut])
def get_notifications(user_id: str, db: Session = Depends(get_db)):
    return db.query(Notification).filter(
        Notification.user_id == user_id
    ).all()


@router.get("/competitions", response_model=list[CompetitionOut])
def get_competitions(
    search: str | None = Query(default=None),
    category: str | None = Query(default=None),
    status: str | None = Query(default=None),
    tab: str | None = Query(default="all"),
    limit: int = Query(default=4, ge=1, le=50),
    offset: int = Query(default=0, ge=0),
    db: Session = Depends(get_db),
):
    query = db.query(Competition)

    if search:
        search_term = f"%{search}%"
        query = query.filter(
            or_(
                Competition.title.ilike(search_term),
                Competition.description.ilike(search_term),
                Competition.category.ilike(search_term),
            )
        )

    if category and category.upper() != "ALL TASKS":
        query = query.filter(Competition.category.ilike(category))

    if status:
        query = query.filter(Competition.status.ilike(status))

    # Demo logic for tabs
    if tab == "participating":
        query = query.filter(Competition.status.ilike("OPEN"))
    elif tab == "organizing":
        query = query.filter(Competition.status.ilike("CLOSED"))

    return query.offset(offset).limit(limit).all()


@router.get("/competitions/count")
def get_competitions_count(
    search: str | None = Query(default=None),
    category: str | None = Query(default=None),
    status: str | None = Query(default=None),
    tab: str | None = Query(default="all"),
    db: Session = Depends(get_db),
):
    query = db.query(Competition)

    if search:
        search_term = f"%{search}%"
        query = query.filter(
            or_(
                Competition.title.ilike(search_term),
                Competition.description.ilike(search_term),
                Competition.category.ilike(search_term),
            )
        )

    if category and category.upper() != "ALL TASKS":
        query = query.filter(Competition.category.ilike(category))

    if status:
        query = query.filter(Competition.status.ilike(status))

    if tab == "participating":
        query = query.filter(Competition.status.ilike("OPEN"))
    elif tab == "organizing":
        query = query.filter(Competition.status.ilike("CLOSED"))

    return {"count": query.count()}


@router.get("/competitions/{competition_id}", response_model=CompetitionOut)
def get_competition(competition_id: str, db: Session = Depends(get_db)):
    competition = db.query(Competition).filter(Competition.id == competition_id).first()
    if not competition:
        raise HTTPException(status_code=404, detail="Competition not found")
    return competition