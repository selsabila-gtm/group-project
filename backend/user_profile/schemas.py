from pydantic import BaseModel, field_validator
from typing import Optional
from datetime import datetime


# ─── Experience ───────────────────────────────────────────────────────────────

class ExperienceBase(BaseModel):
    title: str
    organization: Optional[str] = None
    start_year: int
    end_year: Optional[int] = None
    description: Optional[str] = None


class ExperienceCreate(ExperienceBase):
    pass


class ExperienceUpdate(BaseModel):
    title: Optional[str] = None
    organization: Optional[str] = None
    start_year: Optional[int] = None
    end_year: Optional[int] = None
    description: Optional[str] = None


class ExperienceOut(ExperienceBase):
    id: int
    user_id: str          # UUID from Supabase auth
    created_at: Optional[datetime] = None

    model_config = {"from_attributes": True}


# ─── Profile update (fields on the user_profiles table) ──────────────────────

class ProfileUpdate(BaseModel):
    name: Optional[str] = None
    profile_picture: Optional[str] = None   # renamed from avatar_url
    bio: Optional[str] = None
    institution: Optional[str] = None
    skills: Optional[list[str]] = None
    linkedin_url: Optional[str] = None
    github_url: Optional[str] = None
    website_url: Optional[str] = None

    @field_validator("bio")
    @classmethod
    def bio_max_length(cls, v):
        if v and len(v) > 500:
            raise ValueError("Bio cannot exceed 500 characters")
        return v


# ─── Full profile response ────────────────────────────────────────────────────

class UserProfileOut(BaseModel):
    id: Optional[str] = None   # ✅ make it optional
    user_id: str               # ✅ this is your real column

    username: Optional[str] = None
    email: Optional[str] = None
    name: Optional[str] = None
    profile_picture: Optional[str] = None
    created_at: Optional[datetime] = None
    bio: Optional[str] = None
    institution: Optional[str] = None
    skills: Optional[list[str]] = None
    linkedin_url: Optional[str] = None
    github_url: Optional[str] = None
    website_url: Optional[str] = None
    experiences: list[ExperienceOut] = []

    model_config = {"from_attributes": True}