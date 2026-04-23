from sqlalchemy import Column, String, Integer, Boolean
from database import Base
import uuid


class User(Base):
    __tablename__ = "users"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    full_name = Column(String, nullable=False)
    email = Column(String, unique=True, index=True, nullable=False)
    password = Column(String, nullable=False)


class DashboardStat(Base):
    __tablename__ = "dashboard_stats"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(String, index=True, nullable=False)
    total_competitions = Column(Integer, default=0)
    teams_joined = Column(Integer, default=0)


class Competition(Base):
    __tablename__ = "competitions"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    category = Column(String, nullable=False)
    status = Column(String, nullable=False)
    title = Column(String, nullable=False)
    description = Column(String, nullable=False)
    stat1_label = Column(String, nullable=False)
    stat1_value = Column(String, nullable=False)
    stat2_label = Column(String, nullable=False)
    stat2_value = Column(String, nullable=False)
    footer = Column(String, nullable=False)
    muted = Column(Boolean, default=False)


class RecentCompetition(Base):
    __tablename__ = "recent_competitions"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(String, index=True, nullable=False)
    title = Column(String, nullable=False)
    type = Column(String, nullable=False)
    status = Column(String, nullable=False)
    score = Column(String, nullable=False)
    sync = Column(String, nullable=False)
    icon = Column(String, nullable=False)


class Notification(Base):
    __tablename__ = "notifications"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(String, index=True, nullable=False)
    title = Column(String, nullable=False)
    message = Column(String, nullable=False)
    time = Column(String, nullable=False)
    highlighted = Column(Boolean, default=False)
    actions = Column(Boolean, default=False)