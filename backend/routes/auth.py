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
    full_name = data.get("full_name") or ""
    email = data.get("email") or ""

    if not user_id:
        raise HTTPException(status_code=400, detail="Missing user_id")

    existing = db.query(UserProfile).filter(UserProfile.user_id == user_id).first()

    if existing:
        existing.full_name = full_name or existing.full_name
        existing.email = email or existing.email
        db.commit()
        db.refresh(existing)
        return {"message": "User profile updated"}

    db_user = UserProfile(
        user_id=user_id,
        full_name=full_name,
        email=email,
    )

    db.add(db_user)
    db.commit()
    db.refresh(db_user)

    return {"message": "User profile created"}
@router.post("/signup")
def signup(user: UserCreate, db: Session = Depends(get_db)):
    # 1. Create the user in Supabase auth
    try:
        response = supabase.auth.sign_up({
            "email": user.email,
            "password": user.password,
            "options": {
                "data": {
                    "full_name": user.full_name,
                }
            }
        })
    except AuthApiError as e:
        raise HTTPException(status_code=400, detail=str(e))

    if response.user is None:
        raise HTTPException(status_code=400, detail="Signup failed")

    user_id = response.user.id

    # 2. Save to user_profiles table in your local DB
    existing = db.query(UserProfile).filter(UserProfile.user_id == user_id).first()
    if not existing:
        db_user = UserProfile(
            user_id=user_id,
            full_name=user.full_name,
        )
        db.add(db_user)
        db.commit()

    # 3. Upsert into Supabase user_profiles table (correct column names)
    supabase.table("user_profiles").upsert({
        "user_id": user_id,        # primary key column
        "full_name": user.full_name,  # correct column name (not "name")
    }).execute()

    # 4. Log the user in immediately so they get a token
    try:
        login_response = supabase.auth.sign_in_with_password({
            "email": user.email,
            "password": user.password,
        })
    except AuthApiError:
        return {"message": "Signup successful. Please confirm your email then log in."}

    if not login_response.session:
        return {"message": "Signup successful. Please confirm your email then log in."}

    return {
        "access_token": login_response.session.access_token,
        "user": login_response.user,
    }


@router.post("/login")
def login(user: UserLogin, db: Session = Depends(get_db)):
    try:
        response = supabase.auth.sign_in_with_password({
            "email": user.email,
            "password": user.password
        })
    except AuthApiError:
        raise HTTPException(status_code=401, detail="Invalid email or password")

    if not response.user or not response.session:
        raise HTTPException(status_code=401, detail="Please confirm your email before logging in.")

    user_id = response.user.id

    # Ensure user_profiles row exists in local DB
    existing = db.query(UserProfile).filter(UserProfile.user_id == user_id).first()
    if not existing:
        db_user = UserProfile(
            user_id=user_id,
            full_name=response.user.user_metadata.get("full_name", ""),
        )
        db.add(db_user)
        db.commit()

    # Upsert into Supabase user_profiles table (correct column names)
    supabase.table("user_profiles").upsert({
        "user_id": user_id,        # primary key column
        "full_name": response.user.user_metadata.get("full_name", ""),  # correct column name
    }).execute()

    return {
        "access_token": response.session.access_token,
        "user": response.user,
    }