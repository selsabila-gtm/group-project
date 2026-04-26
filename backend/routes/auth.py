from supabase_auth.errors import AuthApiError
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from schemas import UserCreate, UserLogin
from models import UserProfile
from .utils import get_db
from supabase_client import supabase

router = APIRouter(tags=["auth"])


@router.post("/sync-user")
def sync_user(data: dict, db: Session = Depends(get_db)):
    user_id = data.get("user_id")
    full_name = data.get("full_name")
    email = data.get("email", "")

    if not user_id:
        raise HTTPException(status_code=400, detail="Missing user_id")

    existing = db.query(UserProfile).filter(UserProfile.user_id == user_id).first()
    if existing:
        return {"message": "User already exists"}

    new_user = UserProfile(user_id=user_id, full_name=full_name, email=email)
    db.add(new_user)
    db.commit()
    return {"message": "User profile created"}


@router.post("/signup")
def signup(user: UserCreate, db: Session = Depends(get_db)):
    try:
        response = supabase.auth.sign_up({
            "email": user.email,
            "password": user.password
        })
    except AuthApiError as e:
        raise HTTPException(status_code=400, detail=str(e))

    if response.user is None:
        raise HTTPException(status_code=400, detail="Signup failed")

    user_id = response.user.id

    existing = db.query(UserProfile).filter(UserProfile.user_id == user_id).first()
    if not existing:
        db_user = UserProfile(
            user_id=user_id,
            full_name=user.full_name,
            email=user.email,
        )
        db.add(db_user)
        db.commit()

    return {"message": "User created successfully", "user": response.user}


@router.post("/login")
def login(user: UserLogin):
    try:
        response = supabase.auth.sign_in_with_password({
            "email": user.email,
            "password": user.password
        })
    except AuthApiError:
        raise HTTPException(status_code=401, detail="Invalid email or password")

    if response.user and not response.session:
        raise HTTPException(status_code=401, detail="Email not confirmed")

    return {
        "access_token": response.session.access_token,
        "user": response.user,
    }
