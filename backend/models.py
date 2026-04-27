from sqlalchemy import Column, String, Integer, Boolean, Text
from database import Base
import uuid

class UserProfile(Base):
    __tablename__ = "user_profiles"

    user_id   = Column(String, primary_key=True)
    full_name = Column(String)
    email     = Column(String, nullable=True)  # ← add this

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

    # New fields for create competition flow
    is_draft = Column(Boolean, default=False)
    task_type = Column(String, nullable=True)
    start_date = Column(String, nullable=True)
    end_date = Column(String, nullable=True)
    prize_pool = Column(Integer, nullable=True)

    primary_metric = Column(String, nullable=True)
    secondary_metric = Column(String, nullable=True)

    max_teams = Column(Integer, nullable=True)
    min_members = Column(Integer, nullable=True)
    max_members = Column(Integer, nullable=True)
    merge_deadline = Column(String, nullable=True)
    required_skills = Column(Text, nullable=True)
    max_submissions_per_day = Column(Integer, nullable=True)
    allow_external_data = Column(Boolean, default=True)
    allow_pretrained_models = Column(Boolean, default=True)
    require_code_sharing = Column(Boolean, default=False)
    additional_rules = Column(Text, nullable=True)

    complexity_level = Column(Integer, nullable=True)

    datasets_json = Column(Text, nullable=True)
    milestones_json = Column(Text, nullable=True)
    validation_date = Column(String, nullable=True)
    freeze_date = Column(String, nullable=True)

class CompetitionOrganizer(Base):
    __tablename__ = "competition_organizers"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    competition_id = Column(String, nullable=False)
    user_id = Column(String, nullable=False)
    role = Column(String, default="owner")
    created_at = Column(String, nullable=True)


class CompetitionParticipant(Base):
    __tablename__ = "competition_participants"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    competition_id = Column(String, nullable=False)
    user_id = Column(String, nullable=False)
    team_id = Column(String, nullable=True)
    status = Column(String, default="joined")
    joined_at = Column(String, nullable=True)


class RecentCompetition(Base):
    __tablename__ = "recent_competitions"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    competition_id = Column(String, nullable=True)
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


class CompetitionPrompt(Base):
    __tablename__ = "competition_prompts"
    id             = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    competition_id = Column(String, nullable=False)
    content        = Column(Text, nullable=False)
    difficulty     = Column(String, nullable=True)
    domain         = Column(String, nullable=True)
    used_count     = Column(Integer, default=0)
    created_at     = Column(String, nullable=True)

class DataSample(Base):
    __tablename__ = "data_samples"
    id             = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    competition_id = Column(String, nullable=False, index=True)
    contributor_id = Column(String, nullable=False, index=True)
    status         = Column(String, default="pending")
    text_content   = Column(Text, nullable=True)
    annotation     = Column(Text, nullable=True)   # JSON string
    audio_url      = Column(String, nullable=True)
    audio_duration = Column(String, nullable=True)
    quality_score  = Column(String, nullable=True)
    flags          = Column(Text, default="[]")
    meta_data       = Column(Text, default="{}")
    submitted_at   = Column(String, nullable=True)