from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from schemas import CompetitionActionOut
from database import SessionLocal
from schemas import UserCreate, UserLogin
from supabase_client import supabase
from models import UserProfile
from fastapi import Header 
router = APIRouter()
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def get_icon_for_task(task_type: str):
    task = (task_type or "").upper()

    if "TRANSLATION" in task:
        return "文"
    if "AUDIO" in task:
        return "◉"
    if "TEXT" in task:
        return "◎"
    if "COGNITIVE" in task:
        return "▣"
    if "QUESTION" in task:
        return "Q"
    if "SUMMARIZATION" in task:
        return "▤"

    return "◎"



def get_current_user(authorization: str = Header(...)):
    token = authorization.split(" ")[1]

    user = supabase.auth.get_user(token)

    if not user:
        raise HTTPException(status_code=401, detail="Invalid token")

    return user
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

    if (
        data.min_members is not None
        and data.max_members is not None
        and data.min_members > data.max_members
    ):
        raise HTTPException(
            status_code=400,
            detail="Min team members cannot be greater than max team members",
        )

    if data.max_submissions_per_day is not None and data.max_submissions_per_day <= 0:
        raise HTTPException(
            status_code=400,
            detail="Max submissions per day must be greater than 0",
        )

    if data.merge_deadline and data.start_date and data.merge_deadline < data.start_date:
        raise HTTPException(
            status_code=400,
            detail="Merge deadline cannot be before the start date",
        )

    if data.validation_date and data.start_date and data.validation_date < data.start_date:
        raise HTTPException(
            status_code=400,
            detail="Validation date cannot be before the start date",
        )

    if data.freeze_date and data.start_date and data.freeze_date < data.start_date:
        raise HTTPException(
            status_code=400,
            detail="Freeze date cannot be before the start date",
        )


def build_competition_record(data: CompetitionCreateIn, is_draft: bool):
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
        stat1_value = f"${data.prize_pool:,}" if data.prize_pool else "TBD"
        stat2_label = "DEADLINE"
        stat2_value = data.end_date if data.end_date else "TBD"
        footer = "NEW"

    return Competition(
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
        required_skills=json.dumps(data.required_skills),
        max_submissions_per_day=data.max_submissions_per_day,
        allow_external_data=data.allow_external_data,
        allow_pretrained_models=data.allow_pretrained_models,
        require_code_sharing=data.require_code_sharing,
        additional_rules=data.additional_rules,
        complexity_level=data.complexity_level,
        datasets_json=json.dumps(data.datasets),
        milestones_json=json.dumps(data.milestones),
        validation_date=data.validation_date,
        freeze_date=data.freeze_date,
    )


def apply_competition_filters(query, db, search, category, status, tab):
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
        joined_ids = db.query(CompetitionParticipant.competition_id).filter(
            CompetitionParticipant.user_id == DEMO_USER_ID
        )
        query = query.filter(Competition.id.in_(joined_ids))

    elif tab == "organizing":
        organized_ids = db.query(CompetitionOrganizer.competition_id).filter(
            CompetitionOrganizer.user_id == DEMO_USER_ID
        )
        query = query.filter(Competition.id.in_(organized_ids))

    return query




@router.post("/signup")
def signup(user: UserCreate, db: Session = Depends(get_db)):
    response = supabase.auth.sign_up({
        "email": user.email,
        "password": user.password
    })

    if response.user is None:
        raise HTTPException(status_code=400, detail="Signup failed")

    user_id = response.user.id

    # ✅ check if already exists
    existing = db.query(UserProfile).filter(
        UserProfile.user_id == user_id
    ).first()

    if not existing:
        db_user = UserProfile(
            user_id=user_id,
            full_name=user.full_name
        )
        db.add(db_user)
        db.commit()

    return {
        "message": "User created successfully",
        "user": response.user
    }

from supabase_auth.errors import AuthApiError

@router.post("/login")
def login(user: UserLogin):
    try:
        response = supabase.auth.sign_in_with_password({
            "email": user.email,
            "password": user.password
        })
    except AuthApiError:
        raise HTTPException(
            status_code=401,
            detail="Invalid email or password"
        )

    if response.user and not response.session:
        raise HTTPException(
            status_code=401,
            detail="Email not confirmed"
        )

    return {
        "access_token": response.session.access_token,
        "user": response.user
    }

@router.post("/competitions/draft", response_model=CompetitionActionOut)
def save_competition_draft(data: CompetitionCreateIn, db: Session = Depends(get_db)):
    competition = build_competition_record(data, is_draft=True)
    db.add(competition)
    db.flush()

    organizer = CompetitionOrganizer(
        competition_id=competition.id,
        user_id=DEMO_USER_ID,
        role="owner",
        created_at=datetime.utcnow().isoformat(),
    )
    db.add(organizer)

    db.commit()
    db.refresh(competition)

    return {
        "message": "Competition draft saved successfully",
        "competition_id": competition.id,
    }


@router.post("/competitions/create", response_model=CompetitionActionOut)
def create_competition(data: CompetitionCreateIn, db: Session = Depends(get_db)):
    validate_competition_payload(data)

    competition = build_competition_record(data, is_draft=False)
    db.add(competition)
    db.flush()

    organizer = CompetitionOrganizer(
        competition_id=competition.id,
        user_id=DEMO_USER_ID,
        role="owner",
        created_at=datetime.utcnow().isoformat(),
    )
    db.add(organizer)

    stats = db.query(DashboardStat).filter(DashboardStat.user_id == DEMO_USER_ID).first()

    if stats:
        stats.total_competitions = db.query(Competition).filter(Competition.is_draft == False).count() + 1
    else:
        stats = DashboardStat(
            user_id=DEMO_USER_ID,
            total_competitions=1,
            teams_joined=0,
        )
        db.add(stats)

    recent = RecentCompetition(
        user_id=DEMO_USER_ID,
        title=competition.title,
        type=competition.category,
        status=competition.status,
        score="--",
        sync="Just now",
        icon=get_icon_for_task(data.task_type),
    )
    db.add(recent)

    db.commit()
    db.refresh(competition)

    return {
        "message": "Competition created successfully",
        "competition_id": competition.id,
    }


@router.post("/competitions/{competition_id}/join")
def join_competition(competition_id: str, db: Session = Depends(get_db)):
    competition = db.query(Competition).filter(
        Competition.id == competition_id,
        Competition.is_draft == False,
    ).first()

    if not competition:
        raise HTTPException(status_code=404, detail="Competition not found")

    if competition.status != "OPEN":
        raise HTTPException(status_code=400, detail="Competition is not open")

    organizer = db.query(CompetitionOrganizer).filter(
        CompetitionOrganizer.competition_id == competition_id,
        CompetitionOrganizer.user_id == DEMO_USER_ID,
    ).first()

    if organizer:
        raise HTTPException(
            status_code=400,
            detail="Organizer cannot join their own competition as participant",
        )

    existing = db.query(CompetitionParticipant).filter(
        CompetitionParticipant.competition_id == competition_id,
        CompetitionParticipant.user_id == DEMO_USER_ID,
    ).first()

    if existing:
        raise HTTPException(status_code=400, detail="Already joined this competition")

    participant = CompetitionParticipant(
        competition_id=competition_id,
        user_id=DEMO_USER_ID,
        team_id=None,
        status="joined",
        joined_at=datetime.utcnow().isoformat(),
    )

    db.add(participant)

    recent = RecentCompetition(
        user_id=DEMO_USER_ID,
        title=competition.title,
        type=competition.category,
        status="IN PROGRESS",
        score="--",
        sync="Just now",
        icon=get_icon_for_task(competition.task_type),
    )
    db.add(recent)

    stats = db.query(DashboardStat).filter(DashboardStat.user_id == DEMO_USER_ID).first()
    if stats:
        stats.teams_joined += 1
    else:
        stats = DashboardStat(
            user_id=DEMO_USER_ID,
            total_competitions=db.query(Competition).filter(Competition.is_draft == False).count(),
            teams_joined=1,
        )
        db.add(stats)

    db.commit()

    return {"message": "Joined competition successfully"}
