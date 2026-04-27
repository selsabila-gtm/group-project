from fastapi import APIRouter, Depends, HTTPException, status
from httpx import RemoteProtocolError
from supabase_client import supabase

from routes.utils import get_current_user
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


def _require_own_profile(user_id: str, current_user: dict):
    """Only the authenticated user may modify their own profile."""
    if current_user.id != user_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You can only modify your own profile.",
        )


def _get_profile_or_404(user_id: str) -> dict:
    res = (
        supabase.table("user_profiles")
        .select(
            "user_id, full_name, profile_picture, updated_at, "
            "bio, institution, skills, linkedin_url, github_url, website_url"
        )
        .eq("user_id", user_id)
        .maybe_single()
        .execute()
    )
    if not res.data:
        raise HTTPException(status_code=404, detail="User profile not found.")

    profile = res.data
    # Expose full_name as "name" so the frontend can use either key
    profile["name"] = profile.get("full_name")

    try:
        auth_user = supabase.auth.admin.get_user_by_id(user_id)
        if auth_user and auth_user.user:
            profile["username"] = auth_user.user.user_metadata.get("username") or auth_user.user.email
            profile["email"] = auth_user.user.email
    except Exception:
        profile.setdefault("username", None)
        profile.setdefault("email", None)

    return profile


def _get_experiences(user_id: str):
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


@router.get("/me", response_model=UserProfileOut)
def get_my_profile(current_user: dict = Depends(get_current_user)):
    user_id = current_user.id
    profile = _get_profile_or_404(user_id)
    profile["experiences"] = _get_experiences(user_id)
    return profile


@router.get("/{user_id}", response_model=UserProfileOut)
def get_profile(user_id: str):
    profile = _get_profile_or_404(user_id)
    profile["experiences"] = _get_experiences(user_id)
    return profile


@router.put("/me", response_model=UserProfileOut)
def update_my_profile(
    payload: ProfileUpdate,
    current_user: dict = Depends(get_current_user),
):
    user_id = current_user.id

    updates = payload.model_dump(exclude_unset=True)
    if not updates:
        raise HTTPException(status_code=400, detail="No fields provided")

    # Frontend sends "name"; DB column is "full_name" — remap if needed
    if "name" in updates:
        updates["full_name"] = updates.pop("name")

    supabase.table("user_profiles").upsert({"user_id": user_id, **updates}).execute()

    updated = _get_profile_or_404(user_id)
    updated["experiences"] = _get_experiences(user_id)
    return updated


@router.put("/{user_id}", response_model=UserProfileOut)
def update_profile(
    user_id: str,
    payload: ProfileUpdate,
    current_user: dict = Depends(get_current_user),
):
    _require_own_profile(user_id, current_user)

    updates = payload.model_dump(exclude_unset=True)
    if not updates:
        raise HTTPException(status_code=400, detail="No fields provided")

    supabase.table("user_profiles").upsert({"user_id": user_id, **updates}).execute()

    updated = _get_profile_or_404(user_id)
    updated["experiences"] = _get_experiences(user_id)
    return updated


@router.post("/me/experience", response_model=ExperienceOut)
def add_experience(
    payload: ExperienceCreate,
    current_user: dict = Depends(get_current_user),
):
    user_id = current_user.id
    row = {"user_id": user_id, **payload.model_dump()}
    res = supabase.table("user_experiences").insert(row).execute()
    if not res.data:
        raise HTTPException(status_code=500, detail="Insert failed")
    return res.data[0]


@router.put("/me/experience/{exp_id}", response_model=ExperienceOut)
def update_experience(
    exp_id: int,
    payload: ExperienceUpdate,
    current_user: dict = Depends(get_current_user),
):
    user_id = current_user.id

    check = (
        supabase.table("user_experiences")
        .select("user_id")
        .eq("id", exp_id)
        .maybe_single()
        .execute()
    )
    if not check.data or check.data["user_id"] != user_id:
        raise HTTPException(status_code=403, detail="Not your experience entry.")

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


@router.delete("/me/experience/{exp_id}")
def delete_experience(
    exp_id: int,
    current_user: dict = Depends(get_current_user),
):
    user_id = current_user.id

    check = (
        supabase.table("user_experiences")
        .select("user_id")
        .eq("id", exp_id)
        .maybe_single()
        .execute()
    )
    if not check.data or check.data["user_id"] != user_id:
        raise HTTPException(status_code=403, detail="Not your experience entry.")

    supabase.table("user_experiences").delete().eq("id", exp_id).execute()
    return {"message": "Deleted successfully"}


def _fetch_competitions_by_ids(comp_ids: list) -> list:
    """Given a list of competition IDs, return [{id, title}, ...] from the competitions table."""
    if not comp_ids:
        return []
    res = (
        supabase.table("competitions")
        .select("id, title")
        .in_("id", comp_ids)
        .execute()
    )
    return res.data or []


@competitions_router.get("/organizer/{user_id}")
def get_organized_competitions(user_id: str):
    try:
        # Step 1: get competition_ids for this organizer
        res = (
            supabase.table("competition_organizers")
            .select("competition_id")
            .eq("user_id", user_id)
            .execute()
        )
        rows = res.data or []
        print(f"[organizer] user={user_id} rows={rows}")   # ← debug log

        comp_ids = [row["competition_id"] for row in rows if row.get("competition_id")]
        if not comp_ids:
            return []

        # Step 2: fetch competition details directly — no FK join needed
        return _fetch_competitions_by_ids(comp_ids)

    except RemoteProtocolError:
        return []
    except Exception as e:
        print(f"[get_organized_competitions] error: {e}")
        return []


@competitions_router.get("/participant/{user_id}")
def get_participated_competitions(user_id: str):
    try:
        # Step 1: get competition_ids for this participant
        res = (
            supabase.table("competition_participants")
            .select("competition_id")
            .eq("user_id", user_id)
            .execute()
        )
        rows = res.data or []
        print(f"[participant] user={user_id} rows={rows}")   # ← debug log

        comp_ids = [row["competition_id"] for row in rows if row.get("competition_id")]
        if not comp_ids:
            return []

        # Step 2: fetch competition details directly — no FK join needed
        return _fetch_competitions_by_ids(comp_ids)

    except RemoteProtocolError:
        return []
    except Exception as e:
        print(f"[get_participated_competitions] error: {e}")
        return []