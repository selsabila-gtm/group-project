"""
Team-related SQLAlchemy models — aligned with actual DB schema.

Fixes vs previous version:
  - Team.updated_at added (DB has this column)
  - Team.created_by stays String (we store Supabase UUID, not old users.id int)
  - TeamMember.user_id is String → FK to user_profiles.user_id (text)
  - All id columns are Integer / serial, matching DB

NOTE: user_profiles has NO email column in the DB.
      Invite-by-email must resolve UUID via Supabase Auth admin API,
      OR you add an `email` column to user_profiles and populate it in /sync-user.
      The easier fix: add to your /sync-user endpoint:
          new_user = UserProfile(user_id=..., full_name=..., email=email)
      and add `email = Column(String, nullable=True)` to UserProfile in models.py.
"""

from sqlalchemy import Column, Integer, String, ForeignKey
from database import Base


class Team(Base):
    __tablename__ = "teams"

    id          = Column(Integer, primary_key=True, autoincrement=True)
    name        = Column(String(100), nullable=False)
    description = Column(String, nullable=True)
    created_by  = Column(String, nullable=True)   # Supabase user UUID stored as text
    created_at  = Column(String, nullable=True)
    updated_at  = Column(String, nullable=True)   # ← was missing


class TeamMember(Base):
    __tablename__ = "team_members"

    id        = Column(Integer, primary_key=True, autoincrement=True)
    team_id   = Column(Integer, ForeignKey("teams.id", ondelete="CASCADE"), nullable=False)
    user_id   = Column(String, nullable=False)    # Supabase UUID → user_profiles.user_id
    role      = Column(String(20), default="member")   # "leader" | "admin" | "member"
    joined_at = Column(String, nullable=True)


class TeamInvitation(Base):
    __tablename__ = "team_invitations"

    id          = Column(Integer, primary_key=True, autoincrement=True)
    team_id     = Column(Integer, ForeignKey("teams.id", ondelete="CASCADE"), nullable=False)
    sender_id   = Column(String, nullable=False)   # Supabase UUID
    receiver_id = Column(String, nullable=False)   # Supabase UUID
    role        = Column(String, default="member")
    status      = Column(String, default="pending")  # "pending" | "accepted" | "declined"
    created_at  = Column(String, nullable=True)
    updated_at  = Column(String, nullable=True)