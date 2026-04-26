"""
Team-related SQLAlchemy models.

Import this module in main.py alongside models.py so that
Base.metadata.create_all() picks up these tables on startup.

Also add `email` to UserProfile in models.py if it is not there:
    email = Column(String, nullable=True)
"""

from sqlalchemy import Column, Integer, String, ForeignKey
from database import Base


class Team(Base):
    __tablename__ = "teams"

    id = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(String, nullable=False)
    description = Column(String, nullable=True)
    created_by = Column(String, nullable=True)   # Supabase user UUID
    created_at = Column(String, nullable=True)


class TeamMember(Base):
    __tablename__ = "team_members"

    id = Column(Integer, primary_key=True, autoincrement=True)
    team_id = Column(Integer, ForeignKey("teams.id", ondelete="CASCADE"), nullable=False)
    user_id = Column(String, nullable=False)     # Supabase user UUID
    role = Column(String, default="member")      # "leader" | "admin" | "member"
    joined_at = Column(String, nullable=True)


class TeamInvitation(Base):
    __tablename__ = "team_invitations"

    id = Column(Integer, primary_key=True, autoincrement=True)
    team_id = Column(Integer, ForeignKey("teams.id", ondelete="CASCADE"), nullable=False)
    sender_id = Column(String, nullable=False)   # Supabase user UUID
    receiver_id = Column(String, nullable=False) # Supabase user UUID
    role = Column(String, default="member")
    status = Column(String, default="pending")   # "pending" | "accepted" | "declined"
    created_at = Column(String, nullable=True)
    updated_at = Column(String, nullable=True)
