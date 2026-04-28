# backend/routes/settings.py

from fastapi import APIRouter, Depends, HTTPException, Header
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional

from models import UserProfile
from .utils import get_db, get_current_user
from supabase_client import supabase

router = APIRouter(prefix="/settings", tags=["settings"])


# ── Schemas ────────────────────────────────────────────────────────────────────

class ProfileUpdate(BaseModel):
    full_name: Optional[str] = None


class EmailUpdate(BaseModel):
    email: str


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
        # Email always comes from Supabase Auth — not from user_profiles
        "email":     current_user.email or "",
    }


# ── PATCH profile (full_name only) ────────────────────────────────────────────

@router.patch("/account")
def update_profile(
    body: ProfileUpdate,
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    profile = db.query(UserProfile).filter(
        UserProfile.user_id == current_user.id
    ).first()

    if not profile:
        raise HTTPException(status_code=404, detail="User profile not found")

    if body.full_name is not None:
        profile.full_name = body.full_name
        db.commit()
        db.refresh(profile)

        # Sync into Supabase user_metadata (non-critical)
        try:
            supabase.auth.admin.update_user_by_id(
                str(current_user.id),
                {"user_metadata": {"full_name": body.full_name}},
            )
        except Exception:
            pass

    return {
        "message":   "Profile updated successfully",
        "full_name": profile.full_name,
    }


# ── POST change email ─────────────────────────────────────────────────────────
#
# IMPORTANT: We must use supabase.auth.update_user() with the USER's own token,
# NOT the admin API. The admin API (update_user_by_id) silently changes the
# email with zero verification. The user-facing API sends a confirmation link
# to the new address; the email only changes after they click it.

@router.post("/change-email")
def change_email(
    body: EmailUpdate,
    current_user=Depends(get_current_user),
    authorization: str = Header(...),
):
    if not body.email or "@" not in body.email:
        raise HTTPException(status_code=400, detail="Invalid email address")

    if body.email == current_user.email:
        raise HTTPException(status_code=400, detail="This is already your current email")

    # Extract raw token — already validated by get_current_user, we just need
    # to pass it to set_session so the SDK acts as this user (not service-role).
    token = authorization.split(" ", 1)[1].strip()

    try:
        # set_session tells the Supabase client to act as this user for the
        # next call. Pass empty string for refresh_token — we only need one call.
        supabase.auth.set_session(token, "")
        supabase.auth.update_user({
            "email": body.email,
            "email_redirect_to": "http://localhost:5173/auth/callback",
        })
    except Exception as e:
        raise HTTPException(
            status_code=400,
            detail=f"Email change request failed: {str(e)}",
        )

    return {
        "message": (
            f"A confirmation link has been sent to {body.email}. "
            "Your email address will be updated once you click the link."
        )
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

    # Verify current password by re-authenticating
    try:
        verify = supabase.auth.sign_in_with_password({
            "email":    current_user.email,
            "password": body.current_password,
        })
    except Exception:
        raise HTTPException(status_code=401, detail="Current password is incorrect")

    if not verify.user:
        raise HTTPException(status_code=401, detail="Current password is incorrect")

    # Admin API is fine for password — no verification email needed
    try:
        supabase.auth.admin.update_user_by_id(
            str(current_user.id),
            {"password": body.new_password},
        )
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Password update failed: {str(e)}")

    return {"message": "Password updated successfully"}


# ── POST logout ───────────────────────────────────────────────────────────────

@router.post("/logout")
def logout(current_user=Depends(get_current_user)):
    try:
        supabase.auth.admin.sign_out(str(current_user.id))
    except Exception:
        pass

    return {"message": "Logged out successfully"}