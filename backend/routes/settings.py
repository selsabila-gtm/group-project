# backend/routes/settings.py

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional

from models import UserProfile
from .utils import get_db, get_current_user
from supabase_client import supabase

router = APIRouter(prefix="/settings", tags=["settings"])


# ── Schemas ────────────────────────────────────────────────────────────────────

class AccountInfoUpdate(BaseModel):
    full_name: Optional[str] = None
    username:  Optional[str] = None  # kept but ignored
    email:     Optional[str] = None


class PasswordUpdate(BaseModel):
    current_password: str
    new_password:     str


# ── GET current user settings ─────────────────────────────────────────────────

@router.get("/me")
def get_my_settings(
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    profile = db.query(UserProfile).filter(
        UserProfile.user_id == current_user.id
    ).first()

    if not profile:
        raise HTTPException(status_code=404, detail="User profile not found")

    return {
        "user_id":   str(current_user.id),
        "full_name": profile.full_name or current_user.user_metadata.get("full_name", ""),
        "username":  "",  # ✅ fixed
        "email":     profile.email or current_user.email or "",
    }


# ── PATCH account info ────────────────────────────────────────────────────────

@router.patch("/account")
def update_account_info(
    body: AccountInfoUpdate,
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    profile = db.query(UserProfile).filter(
        UserProfile.user_id == current_user.id
    ).first()

    if not profile:
        raise HTTPException(status_code=404, detail="User profile not found")

    # ── Local DB updates ──────────────────────────────────────────────────────
    if body.full_name is not None:
        profile.full_name = body.full_name

    # ❌ username logic removed completely

    if body.email is not None:
        profile.email = body.email

    db.commit()
    db.refresh(profile)

    # ── Supabase sync ─────────────────────────────────────────────────────────
    supabase_update: dict = {}

    if body.full_name is not None:
        supabase_update["data"] = {"full_name": body.full_name}

    if body.email is not None:
        supabase_update["email"] = body.email

    if supabase_update:
        try:
            supabase.auth.update_user(supabase_update)
        except Exception as e:
            return {
                "message": "Local profile updated but Supabase sync failed",
                "warning": str(e),
            }

    return {
        "message":   "Account updated successfully",
        "full_name": profile.full_name,
        "username":  "",  # ✅ fixed
        "email":     profile.email,
    }


# ── POST change password ──────────────────────────────────────────────────────

@router.post("/change-password")
def change_password(
    body: PasswordUpdate,
    current_user=Depends(get_current_user),
):
    if len(body.new_password) < 6:
        raise HTTPException(
            status_code=400,
            detail="New password must be at least 6 characters",
        )

    try:
        verify = supabase.auth.sign_in_with_password({
            "email":    current_user.email,
            "password": body.current_password,
        })
    except Exception:
        raise HTTPException(status_code=401, detail="Current password is incorrect")

    if not verify.user:
        raise HTTPException(status_code=401, detail="Current password is incorrect")

    try:
        supabase.auth.update_user({"password": body.new_password})
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Password update failed: {str(e)}")

    return {"message": "Password updated successfully"}


# ── POST logout ───────────────────────────────────────────────────────────────

@router.post("/logout")
def logout(current_user=Depends(get_current_user)):
    try:
        supabase.auth.sign_out()
    except Exception:
        pass

    return {"message": "Logged out successfully"}