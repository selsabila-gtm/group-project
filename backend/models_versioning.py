"""
models_versioning.py

Drop this file alongside models.py and register it in main.py:

    import models_versioning   # registers dataset_versions table

Replaces the JSON-blob version array embedded in Competition.datasets_json
with a proper relational table. Snapshots are write-once — only `label`,
`notes`, `is_pinned`, and `deleted` are mutable after creation.
"""

from sqlalchemy import Column, String, Integer, Text, Boolean, ForeignKey, UniqueConstraint
from sqlalchemy.orm import relationship
from database import Base
from datetime import datetime
import uuid


class DatasetVersion(Base):
    """
    One row per dataset snapshot for a competition.

    Immutable fields (captured at snapshot time):
        tag, total_samples, validated_samples, flagged_samples,
        rejected_samples, pending_samples, label_distribution_json,
        changelog_json, created_at, created_by.

    Mutable fields: label, notes, is_pinned, deleted.
    """
    __tablename__ = "dataset_versions"

    id             = Column(String, primary_key=True,
                            default=lambda: str(uuid.uuid4()))
    competition_id = Column(String, ForeignKey("competitions.id"),
                            nullable=False, index=True)
    created_by     = Column(String, ForeignKey("user_profiles.user_id"),
                            nullable=False)

    # Unique human-readable tag per competition, e.g. "v1.2"
    tag            = Column(String, nullable=False)

    # Editable metadata
    label          = Column(String, default="")
    notes          = Column(Text,   default="")

    # Stats captured at snapshot creation — never updated
    total_samples     = Column(Integer, default=0)
    validated_samples = Column(Integer, default=0)
    flagged_samples   = Column(Integer, default=0)
    rejected_samples  = Column(Integer, default=0)
    pending_samples   = Column(Integer, default=0)

    # JSON strings for richer snapshot data
    label_distribution_json = Column(Text, default="{}")   # {label: count, ...}
    changelog_json          = Column(Text, default="[]")   # ["line1", "line2"]

    # Pin flag — one version at a time should be pinned per competition
    # (enforced at application level, not DB level, for flexibility)
    is_pinned = Column(Boolean, default=False)

    # Soft-delete — never hard-deletes so audit trail is preserved
    deleted = Column(Boolean, default=False)

    created_at = Column(String, default=lambda: datetime.utcnow().isoformat())

    # ORM relationships (for joins — not strictly required)
    competition = relationship("Competition", foreign_keys=[competition_id])
    creator     = relationship("UserProfile", foreign_keys=[created_by])

    __table_args__ = (
        UniqueConstraint("competition_id", "tag", name="uq_dataset_version_tag"),
    )