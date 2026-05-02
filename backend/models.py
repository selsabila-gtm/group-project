from sqlalchemy import Column, String, Integer, Boolean, Text, ForeignKey
from sqlalchemy.orm import relationship
from database import Base
from datetime import datetime
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
    datasets = relationship("CompetitionDataset", back_populates="competition")

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

# NOTE: The full Notification model lives in routes/notifications.py
# It was removed here to avoid a duplicate-table conflict with SQLAlchemy.
# routes/notifications.py defines the authoritative Notification class.

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
    status         = Column(String, default="pending")   # validated | flagged | rejected | pending
    text_content   = Column(Text, nullable=True)
    annotation     = Column(Text, nullable=True)          # JSON string
    audio_url      = Column(String, nullable=True)
    audio_duration = Column(String, nullable=True)
    quality_score  = Column(String, nullable=True)        # float stored as string for compatibility
    flags          = Column(Text, default="[]")
    meta_data      = Column(Text, default="{}")
    submitted_at   = Column(String, nullable=True)
    # Version tag assigned when a dataset snapshot is created
    version_tag    = Column(String, nullable=True, index=True)
    # ── Add this class to models.py ───────────────────────────────────────────────
# Make sure these are at the top of models.py:
#   import uuid
#   from datetime import datetime
#   from sqlalchemy import Column, String, Integer, Text, ForeignKey
#   from sqlalchemy.orm import relationship

class CompetitionDataset(Base):
    __tablename__ = "competition_datasets"

    id                = Column(String, primary_key=True,
                               default=lambda: str(uuid.uuid4()))
    competition_id    = Column(String, ForeignKey("competitions.id"), nullable=False)
    uploaded_by       = Column(String, ForeignKey("user_profiles.user_id"), nullable=False)
    dataset_type      = Column(String, default="hidden_test")  # hidden_test | public_train | sample
    original_filename = Column(String, nullable=False)
    storage_path      = Column(String, nullable=False)   # path inside "competition-datasets" bucket
    file_size_bytes   = Column(Integer, default=0)
    description       = Column(Text, default="")
    uploaded_at       = Column(String, default=lambda: datetime.utcnow().isoformat())

    competition = relationship("Competition", back_populates="datasets")
    uploader    = relationship("UserProfile", foreign_keys=[uploaded_by])

# ── Inside the existing Competition class add: ────────────────────────────────
#   datasets = relationship("CompetitionDataset", back_populates="competition", cascade="all, delete-orphan")
class ExperimentWorkspace(Base):
    __tablename__ = "experiment_workspaces"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    competition_id = Column(String, ForeignKey("competitions.id"), nullable=False, index=True)
    user_id = Column(String, ForeignKey("user_profiles.user_id"), nullable=False, index=True)

    name = Column(String, nullable=False, default="Notebook Workspace")
    status = Column(String, default="stopped")  # stopped | starting | running | failed
    container_id = Column(String, nullable=True)
    docker_image = Column(String, default="lexivia/notebook-gpu:latest")
    resource_tier = Column(String, default="GPU Basic")

    cpu_limit = Column(String, default="2 cores")
    ram_limit = Column(String, default="8 GB")
    gpu_limit = Column(String, default="1 shared GPU")
    storage_limit = Column(String, default="20 GB")

    notebook_url = Column(String, nullable=True)
    last_started_at = Column(String, nullable=True)
    created_at = Column(String, default=lambda: datetime.utcnow().isoformat())


class ExperimentRun(Base):
    __tablename__ = "experiment_runs"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    workspace_id = Column(String, ForeignKey("experiment_workspaces.id"), nullable=False, index=True)
    competition_id = Column(String, ForeignKey("competitions.id"), nullable=False, index=True)
    user_id = Column(String, ForeignKey("user_profiles.user_id"), nullable=False, index=True)

    name = Column(String, nullable=False)
    notes = Column(Text, default="")
    metric_name = Column(String, default="accuracy")
    metric_value = Column(String, default="0.00")
    parameters_json = Column(Text, default="{}")
    artifact_path = Column(String, nullable=True)

    created_at = Column(String, default=lambda: datetime.utcnow().isoformat())