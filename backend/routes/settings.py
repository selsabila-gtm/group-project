# backend/routes/settings.py

from fastapi import APIRouter, Depends, HTTPException, Header
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional
import os

from models import UserProfile
from .utils import get_db, get_current_user
from supabase_client import supabase

router = APIRouter(prefix="/settings", tags=["settings"])

# Must match a URL listed in Supabase → Authentication → URL Configuration → Redirect URLs.
# Change to your production domain when deploying.
EMAIL_REDIRECT_URL = os.getenv("EMAIL_REDIRECT_URL", "http://localhost:5173/auth/callback")


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
# Uses the Supabase Admin API to queue an email change with email_confirm=False.
# This means Supabase sends a confirmation link to the NEW address, and the
# change only takes effect AFTER the user clicks it (verification preserved).
#
# The confirmation link redirects to /auth/callback (AuthCallback.jsx), which
# exchanges the code for a session, stores it, and redirects to
# /settings?email_confirmed=1.
#
# Root cause of the original 401: the token from localStorage was expired.
# The fix is in get_current_user (utils.py) — it validates via supabase.auth.get_user()
# which will raise if the token is expired. The frontend must refresh the token
# before calling this endpoint if the session might be stale.

@router.post("/change-email")
def change_email(
    body: EmailUpdate,
    current_user=Depends(get_current_user),
):
    if not body.email or "@" not in body.email:
        raise HTTPException(status_code=400, detail="Invalid email address")

    if body.email.lower() == (current_user.email or "").lower():
        raise HTTPException(status_code=400, detail="This is already your current email")

    try:
        # email_confirm=False → Supabase queues the change AND emails the new
        # address. The auth.users.email column only updates after confirmation.
        supabase.auth.admin.generate_link({
    "type": "email_change",
    "email": body.email,
    "user_id": str(current_user.id),
    "options": {
        "redirect_to": EMAIL_REDIRECT_URL
    }
})
    except Exception as e:
        err = str(e).lower()
        if "rate limit" in err:
            raise HTTPException(
                status_code=429,
                detail="Too many email-change requests. Please wait a few minutes and try again.",
            )
        if "already registered" in err or "already exists" in err:
            raise HTTPException(
                status_code=409,
                detail="That email address is already in use by another account.",
            )
        raise HTTPException(
            status_code=400,
            detail=f"Email change request failed: {str(e)}",
        )

    return {
        "message": (
            f"A confirmation link has been sent to {body.email}. "
            "Your email address will only be updated once you click that link."
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