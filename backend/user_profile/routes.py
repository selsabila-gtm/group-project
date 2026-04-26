from fastapi import APIRouter, Depends, HTTPException, status
from supabase_client import supabase

def get_current_user():
    return {"id": 1}

from .schemas import (
    ProfileUpdate,
    ExperienceCreate,
    ExperienceUpdate,
    ExperienceOut,
    UserProfileOut,
)

# Two routers: /profile for user profile, /competitions for competition lookups
router = APIRouter(prefix="/profile", tags=["profile"])
competitions_router = APIRouter(prefix="/competitions", tags=["competitions"])

def _require_own_profile(user_id: int, current_user: dict):
    if current_user["id"] != user_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You can only modify your own profile.",
        )

def _get_user_or_404(user_id: int) -> dict:
    res = (
        supabase.table("users")
        .select(
            "id, username, email, name, avatar_url, created_at, "
            "bio, institution, skills, linkedin_url, github_url, website_url"
        )
        .eq("id", user_id)
        .maybe_single()
        .execute()
    )
    if not res.data:
        raise HTTPException(status_code=404, detail="User not found.")
    return res.data

def _get_experiences(user_id: int):
    res = (
        supabase.table("user_experiences")
        .select(
            "id, user_id, title, organization, start_year, end_year, description, created_at"
        )
        .eq("user_id", user_id)
        .order("start_year", desc=True)
        .execute()
    )
    return res.data or []

@router.get("/{user_id}", response_model=UserProfileOut)
def get_profile(user_id: int):
    user = _get_user_or_404(user_id)
    user["experiences"] = _get_experiences(user_id)
    return user

@router.put("/{user_id}", response_model=UserProfileOut)
def update_profile(user_id: int, payload: ProfileUpdate, current_user: dict = Depends(get_current_user)):
    _require_own_profile(user_id, current_user)

    updates = payload.model_dump(exclude_unset=True)
    if not updates:
        raise HTTPException(status_code=400, detail="No fields provided")

    supabase.table("users").update(updates).eq("id", user_id).execute()

    updated = _get_user_or_404(user_id)
    updated["experiences"] = _get_experiences(user_id)
    return updated

@router.post("/{user_id}/experience", response_model=ExperienceOut)
def add_experience(user_id: int, payload: ExperienceCreate, current_user: dict = Depends(get_current_user)):
    _require_own_profile(user_id, current_user)

    row = {"user_id": user_id, **payload.model_dump()}

    res = supabase.table("user_experiences").insert(row).execute()

    if not res.data:
        raise HTTPException(status_code=500, detail="Insert failed")

    return res.data[0]

@router.put("/{user_id}/experience/{exp_id}", response_model=ExperienceOut)
def update_experience(user_id: int, exp_id: int, payload: ExperienceUpdate, current_user: dict = Depends(get_current_user)):
    _require_own_profile(user_id, current_user)

    updates = payload.model_dump(exclude_unset=True)
    if not updates:
        raise HTTPException(status_code=400, detail="No fields provided")

    res = (
        supabase.table("user_experiences")
        .update(updates)
        .eq("id", exp_id)
        .execute()
    )

    if not res.data:
        raise HTTPException(status_code=500, detail="Update failed")

    return res.data[0]

@router.delete("/{user_id}/experience/{exp_id}")
def delete_experience(user_id: int, exp_id: int, current_user: dict = Depends(get_current_user)):
    _require_own_profile(user_id, current_user)

    supabase.table("user_experiences").delete().eq("id", exp_id).execute()

    return {"message": "Deleted successfully"}


# ─── Competition endpoints (read-only, auto-populated) ────────────────────────

@competitions_router.get("/organizer/{user_id}")
def get_organized_competitions(user_id: int):
    """
    Returns all competitions where this user is listed as an organizer.
    Joins competition_organizers → competitions to get competition details.
    """
    res = (
        supabase.table("competition_organizers")
        .select("competition_id, competitions(id, title)")
        .eq("user_id", user_id)
        .execute()
    )
    competitions = []
    for row in (res.data or []):
        comp = row.get("competitions")
        if comp:
            competitions.append(comp)
    return competitions


@competitions_router.get("/participant/{user_id}")
def get_participated_competitions(user_id: int):
    """
    Returns all competitions where this user is listed as a participant.
    Joins competition_participants → competitions to get competition details.
    """
    res = (
        supabase.table("competition_participants")
        .select("competition_id, competitions(id, title)")
        .eq("user_id", user_id)
        .execute()
    )
    competitions = []
    for row in (res.data or []):
        comp = row.get("competitions")
        if comp:
            competitions.append(comp)
    return competitions