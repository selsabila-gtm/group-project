"""
routes/notifications.py

Full notification system:
  - Listing (with pagination + unread filter)
  - Mark read / unread (single + bulk)
  - Delete (single + bulk)
  - Action endpoints (accept/decline team invitations inline)

SQL to create the table:
────────────────────────────────────────────────────────────────
CREATE TABLE public.notifications (
  id                UUID         NOT NULL DEFAULT gen_random_uuid(),
  user_id           TEXT         NOT NULL REFERENCES public.user_profiles(user_id) ON DELETE CASCADE,
  type              VARCHAR      NOT NULL,
    -- Types:
    --  'team_invitation'          → someone invited you to a team
    --  'team_join_request'        → someone requested to join your team
    --  'team_invitation_accepted' → your team invitation was accepted
    --  'team_invitation_declined' → your team invitation was declined
    --  'team_join_accepted'       → your join request was accepted
    --  'team_join_declined'       → your join request was declined
    --  'team_member_removed'      → you were removed from a team
    --  'competition_invitation'   → invited to organise/join a competition
    --  'competition_joined'       → someone joined your competition
    --  'competition_submission'   → new submission in your competition
    --  'data_sample_flagged'      → a data sample you submitted was flagged
    --  'data_sample_validated'    → a data sample you submitted was validated
    --  'general'                  → generic platform notification

  title             VARCHAR      NOT NULL,
  message           TEXT         NOT NULL,

  -- Who triggered the notification (denormalised for speed)
  actor_id          TEXT         REFERENCES public.user_profiles(user_id) ON DELETE SET NULL,
  actor_name        TEXT,

  -- Context links
  team_id           INTEGER      REFERENCES public.teams(id) ON DELETE SET NULL,
  team_name         TEXT,

  competition_id    VARCHAR      REFERENCES public.competitions(id) ON DELETE SET NULL,
  competition_name  TEXT,

  -- Reference to the original invitation / join-request rows
  invitation_id     INTEGER      REFERENCES public.team_invitations(id) ON DELETE SET NULL,
  join_request_id   INTEGER      REFERENCES public.team_join_requests(id) ON DELETE SET NULL,

  -- State
  is_read           BOOLEAN      NOT NULL DEFAULT FALSE,
  is_deleted        BOOLEAN      NOT NULL DEFAULT FALSE,
  action_taken      VARCHAR,                              -- NULL | 'accepted' | 'declined'

  created_at        TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ  NOT NULL DEFAULT NOW(),

  CONSTRAINT notifications_pkey PRIMARY KEY (id)
);

-- Fast look-ups per user
CREATE INDEX IF NOT EXISTS idx_notifications_user_id   ON public.notifications (user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_is_read   ON public.notifications (user_id, is_read) WHERE is_deleted = FALSE;
CREATE INDEX IF NOT EXISTS idx_notifications_created   ON public.notifications (user_id, created_at DESC) WHERE is_deleted = FALSE;
────────────────────────────────────────────────────────────────
"""

from datetime import datetime
from typing import Optional
from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import Column, Boolean, Integer, String, Text, DateTime
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Session

from database import Base
from models import UserProfile
from models_teams import (
    Team,
    TeamMember,
    TeamInvitation,
    TeamJoinRequest,
)
from .utils import get_db, get_current_user

router = APIRouter(prefix="/notifications", tags=["notifications"])


# ── SQLAlchemy model ──────────────────────────────────────────────────────────

class Notification(Base):
    __tablename__ = "notifications"

    id             = Column(String, primary_key=True, default=lambda: str(uuid4()))
    user_id        = Column(String, nullable=False)       # recipient
    type           = Column(String, nullable=False)
    title          = Column(String, nullable=False)
    message        = Column(Text,   nullable=False)

    actor_id       = Column(String, nullable=True)
    actor_name     = Column(String, nullable=True)

    team_id        = Column(Integer, nullable=True)
    team_name      = Column(String,  nullable=True)

    competition_id   = Column(String, nullable=True)
    competition_name = Column(String, nullable=True)

    invitation_id    = Column(Integer, nullable=True)
    join_request_id  = Column(Integer, nullable=True)

    is_read      = Column(Boolean, nullable=False, default=False)
    is_deleted   = Column(Boolean, nullable=False, default=False)
    action_taken = Column(String,  nullable=True)

    created_at = Column(String, nullable=False, default=lambda: datetime.utcnow().isoformat())
    updated_at = Column(String, nullable=False, default=lambda: datetime.utcnow().isoformat())


# ── Internal helper (used by teams.py and competitions.py) ───────────────────

def create_notification(
    db: Session,
    *,
    user_id: str,
    type: str,
    title: str,
    message: str,
    actor_id: str | None = None,
    actor_name: str | None = None,
    team_id: int | None = None,
    team_name: str | None = None,
    competition_id: str | None = None,
    competition_name: str | None = None,
    invitation_id: int | None = None,
    join_request_id: int | None = None,
) -> Notification:
    """
    Create and persist a single notification row.
    Call this from inside any route that should generate notifications.
    The caller is responsible for db.commit().
    """
    now = datetime.utcnow().isoformat()
    n = Notification(
        user_id=user_id,
        type=type,
        title=title,
        message=message,
        actor_id=actor_id,
        actor_name=actor_name,
        team_id=team_id,
        team_name=team_name,
        competition_id=competition_id,
        competition_name=competition_name,
        invitation_id=invitation_id,
        join_request_id=join_request_id,
        is_read=False,
        is_deleted=False,
        created_at=now,
        updated_at=now,
    )
    db.add(n)
    return n


def _now() -> str:
    return datetime.utcnow().isoformat()


# ── Serialiser ────────────────────────────────────────────────────────────────

def _serialize(n: Notification) -> dict:
    return {
        "id":               n.id,
        "type":             n.type,
        "title":            n.title,
        "message":          n.message,
        "actor_id":         n.actor_id,
        "actor_name":       n.actor_name,
        "team_id":          n.team_id,
        "team_name":        n.team_name,
        "competition_id":   n.competition_id,
        "competition_name": n.competition_name,
        "invitation_id":    n.invitation_id,
        "join_request_id":  n.join_request_id,
        "is_read":          n.is_read,
        "action_taken":     n.action_taken,
        "created_at":       n.created_at,
    }


# ═════════════════════════════════════════════════════════════════════════════
# LIST  GET /notifications
# ═════════════════════════════════════════════════════════════════════════════

@router.get("")
def list_notifications(
    page:       int  = Query(1,  ge=1),
    page_size:  int  = Query(20, ge=1, le=100),
    unread_only: bool = Query(False),
    type_filter: Optional[str] = Query(None),       # e.g. "team_invitation"
    db: Session          = Depends(get_db),
    current_user         = Depends(get_current_user),
):
    q = (
        db.query(Notification)
        .filter(
            Notification.user_id    == str(current_user.id),
            Notification.is_deleted == False,
        )
    )

    if unread_only:
        q = q.filter(Notification.is_read == False)

    if type_filter:
        q = q.filter(Notification.type == type_filter)

    total  = q.count()
    items  = (
        q.order_by(Notification.created_at.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
        .all()
    )

    unread_count = (
        db.query(Notification)
        .filter(
            Notification.user_id    == str(current_user.id),
            Notification.is_deleted == False,
            Notification.is_read    == False,
        )
        .count()
    )

    return {
        "total":        total,
        "page":         page,
        "page_size":    page_size,
        "pages":        max(1, (total + page_size - 1) // page_size),
        "unread_count": unread_count,
        "items":        [_serialize(n) for n in items],
    }


# ═════════════════════════════════════════════════════════════════════════════
# UNREAD COUNT  GET /notifications/unread-count
# (used by the topbar badge — extremely lightweight)
# ═════════════════════════════════════════════════════════════════════════════

@router.get("/unread-count")
def unread_count(
    db: Session  = Depends(get_db),
    current_user = Depends(get_current_user),
):
    count = (
        db.query(Notification)
        .filter(
            Notification.user_id    == str(current_user.id),
            Notification.is_deleted == False,
            Notification.is_read    == False,
        )
        .count()
    )
    return {"count": count}


# ═════════════════════════════════════════════════════════════════════════════
# MARK READ / UNREAD  PATCH /notifications/{id}/read
# ═════════════════════════════════════════════════════════════════════════════

@router.patch("/{notification_id}/read")
def mark_read(
    notification_id: str,
    body: dict,                     # { "is_read": true | false }
    db: Session  = Depends(get_db),
    current_user = Depends(get_current_user),
):
    n = _get_own_notification(db, notification_id, str(current_user.id))
    n.is_read   = bool(body.get("is_read", True))
    n.updated_at = _now()
    db.commit()
    return _serialize(n)


# ═════════════════════════════════════════════════════════════════════════════
# BULK MARK READ  PATCH /notifications/mark-all-read
# ═════════════════════════════════════════════════════════════════════════════

@router.patch("/mark-all-read")
def mark_all_read(
    db: Session  = Depends(get_db),
    current_user = Depends(get_current_user),
):
    now = _now()
    rows = (
        db.query(Notification)
        .filter(
            Notification.user_id    == str(current_user.id),
            Notification.is_deleted == False,
            Notification.is_read    == False,
        )
        .all()
    )
    for n in rows:
        n.is_read    = True
        n.updated_at = now
    db.commit()
    return {"updated": len(rows)}


# ═════════════════════════════════════════════════════════════════════════════
# DELETE  DELETE /notifications/{id}
# ═════════════════════════════════════════════════════════════════════════════

@router.delete("/{notification_id}")
def delete_notification(
    notification_id: str,
    db: Session  = Depends(get_db),
    current_user = Depends(get_current_user),
):
    n = _get_own_notification(db, notification_id, str(current_user.id))
    n.is_deleted  = True
    n.updated_at  = _now()
    db.commit()
    return {"deleted": True}


# ═════════════════════════════════════════════════════════════════════════════
# BULK DELETE  DELETE /notifications  (body: { "ids": [...] } | { "all": true })
# ═════════════════════════════════════════════════════════════════════════════

@router.delete("")
def bulk_delete(
    body: dict,
    db: Session  = Depends(get_db),
    current_user = Depends(get_current_user),
):
    now = _now()
    if body.get("all"):
        rows = (
            db.query(Notification)
            .filter(
                Notification.user_id    == str(current_user.id),
                Notification.is_deleted == False,
            )
            .all()
        )
    else:
        ids = body.get("ids", [])
        rows = (
            db.query(Notification)
            .filter(
                Notification.user_id    == str(current_user.id),
                Notification.id.in_(ids),
                Notification.is_deleted == False,
            )
            .all()
        )

    for n in rows:
        n.is_deleted  = True
        n.updated_at  = now
    db.commit()
    return {"deleted": len(rows)}


# ═════════════════════════════════════════════════════════════════════════════
# ACTION: ACCEPT TEAM INVITATION  POST /notifications/{id}/accept-invitation
# ═════════════════════════════════════════════════════════════════════════════

@router.post("/{notification_id}/accept-invitation")
def accept_team_invitation(
    notification_id: str,
    db: Session  = Depends(get_db),
    current_user = Depends(get_current_user),
):
    n = _get_own_notification(db, notification_id, str(current_user.id))

    if n.type != "team_invitation":
        raise HTTPException(status_code=400, detail="Not a team invitation notification")

    if n.action_taken:
        raise HTTPException(status_code=400, detail=f"Already {n.action_taken} this invitation")

    if not n.invitation_id:
        raise HTTPException(status_code=400, detail="No invitation linked to this notification")

    inv = db.query(TeamInvitation).filter(
        TeamInvitation.id          == n.invitation_id,
        TeamInvitation.receiver_id == str(current_user.id),
        TeamInvitation.status      == "pending",
    ).first()

    if not inv:
        raise HTTPException(status_code=404, detail="Invitation not found or already handled")

    # Accept
    inv.status     = "accepted"
    inv.updated_at = _now()

    db.add(TeamMember(
        team_id=inv.team_id,
        user_id=str(current_user.id),
        role=inv.role,
        joined_at=_now(),
    ))

    n.action_taken = "accepted"
    n.is_read      = True
    n.updated_at   = _now()

    # Notify the sender that the invitation was accepted
    sender_profile = db.query(UserProfile).filter(
        UserProfile.user_id == str(current_user.id)
    ).first()
    sender_name = sender_profile.full_name if sender_profile else "Someone"

    create_notification(
        db,
        user_id=inv.sender_id,
        type="team_invitation_accepted",
        title="Invitation Accepted",
        message=f"{sender_name} accepted your invitation to join {n.team_name or 'the team'}.",
        actor_id=str(current_user.id),
        actor_name=sender_name,
        team_id=n.team_id,
        team_name=n.team_name,
    )

    db.commit()
    return {"message": "Invitation accepted", "notification": _serialize(n)}


# ═════════════════════════════════════════════════════════════════════════════
# ACTION: DECLINE TEAM INVITATION  POST /notifications/{id}/decline-invitation
# ═════════════════════════════════════════════════════════════════════════════

@router.post("/{notification_id}/decline-invitation")
def decline_team_invitation(
    notification_id: str,
    db: Session  = Depends(get_db),
    current_user = Depends(get_current_user),
):
    n = _get_own_notification(db, notification_id, str(current_user.id))

    if n.type != "team_invitation":
        raise HTTPException(status_code=400, detail="Not a team invitation notification")

    if n.action_taken:
        raise HTTPException(status_code=400, detail=f"Already {n.action_taken} this invitation")

    if not n.invitation_id:
        raise HTTPException(status_code=400, detail="No invitation linked")

    inv = db.query(TeamInvitation).filter(
        TeamInvitation.id          == n.invitation_id,
        TeamInvitation.receiver_id == str(current_user.id),
        TeamInvitation.status      == "pending",
    ).first()

    if not inv:
        raise HTTPException(status_code=404, detail="Invitation not found or already handled")

    inv.status     = "declined"
    inv.updated_at = _now()

    n.action_taken = "declined"
    n.is_read      = True
    n.updated_at   = _now()

    # Notify sender
    receiver_profile = db.query(UserProfile).filter(
        UserProfile.user_id == str(current_user.id)
    ).first()
    receiver_name = receiver_profile.full_name if receiver_profile else "Someone"

    create_notification(
        db,
        user_id=inv.sender_id,
        type="team_invitation_declined",
        title="Invitation Declined",
        message=f"{receiver_name} declined your invitation to join {n.team_name or 'the team'}.",
        actor_id=str(current_user.id),
        actor_name=receiver_name,
        team_id=n.team_id,
        team_name=n.team_name,
    )

    db.commit()
    return {"message": "Invitation declined", "notification": _serialize(n)}


# ═════════════════════════════════════════════════════════════════════════════
# ACTION: ACCEPT JOIN REQUEST  POST /notifications/{id}/accept-join-request
# ═════════════════════════════════════════════════════════════════════════════

@router.post("/{notification_id}/accept-join-request")
def accept_join_request(
    notification_id: str,
    db: Session  = Depends(get_db),
    current_user = Depends(get_current_user),
):

    n = _get_own_notification(db, notification_id, str(current_user.id))

    if n.type != "team_join_request":
        raise HTTPException(status_code=400, detail="Not a join request notification")

    if n.action_taken:
        raise HTTPException(status_code=400, detail=f"Already {n.action_taken} this request")

    if not n.join_request_id:
        raise HTTPException(status_code=400, detail="No join request linked")

    req = db.query(TeamJoinRequest).filter(
        TeamJoinRequest.id      == n.join_request_id,
        TeamJoinRequest.team_id == n.team_id,
        TeamJoinRequest.status  == "pending",
    ).first()

    if not req:
        raise HTTPException(status_code=404, detail="Join request not found or already handled")

    req.status     = "accepted"
    req.updated_at = _now()

    db.add(TeamMember(
        team_id=req.team_id,
        user_id=req.user_id,
        role="member",
        joined_at=_now(),
    ))

    n.action_taken = "accepted"
    n.is_read      = True
    n.updated_at   = _now()

    # Notify requester
    leader_profile = db.query(UserProfile).filter(
        UserProfile.user_id == str(current_user.id)
    ).first()

    create_notification(
        db,
        user_id=req.user_id,
        type="team_join_accepted",
        title="Join Request Accepted",
        message=f"Your request to join {n.team_name or 'the team'} was accepted!",
        actor_id=str(current_user.id),
        actor_name=leader_profile.full_name if leader_profile else None,
        team_id=n.team_id,
        team_name=n.team_name,
    )

    db.commit()
    return {"message": "Join request accepted", "notification": _serialize(n)}


# ═════════════════════════════════════════════════════════════════════════════
# ACTION: DECLINE JOIN REQUEST  POST /notifications/{id}/decline-join-request
# ═════════════════════════════════════════════════════════════════════════════

@router.post("/{notification_id}/decline-join-request")
def decline_join_request(
    notification_id: str,
    db: Session  = Depends(get_db),
    current_user = Depends(get_current_user),
):

    n = _get_own_notification(db, notification_id, str(current_user.id))

    if n.type != "team_join_request":
        raise HTTPException(status_code=400, detail="Not a join request notification")

    if n.action_taken:
        raise HTTPException(status_code=400, detail=f"Already {n.action_taken} this request")
    
    if not n.join_request_id:
        raise HTTPException(status_code=400, detail="No join request linked")

    req = db.query(TeamJoinRequest).filter(
        TeamJoinRequest.id      == n.join_request_id,
        TeamJoinRequest.team_id == n.team_id,
        TeamJoinRequest.status  == "pending",
    ).first()

    if not req:
        raise HTTPException(status_code=404, detail="Join request not found or already handled")

    req.status     = "declined"
    req.updated_at = _now()

    n.action_taken = "declined"
    n.is_read      = True
    n.updated_at   = _now()

    # Notify requester
    create_notification(
        db,
        user_id=req.user_id,
        type="team_join_declined",
        title="Join Request Declined",
        message=f"Your request to join {n.team_name or 'the team'} was not accepted.",
        team_id=n.team_id,
        team_name=n.team_name,
    )

    db.commit()
    return {"message": "Join request declined", "notification": _serialize(n)}


# ── Private helpers ───────────────────────────────────────────────────────────

def _get_own_notification(db: Session, notification_id: str, user_id: str) -> Notification:
    n = db.query(Notification).filter(
        Notification.id         == notification_id,
        Notification.user_id    == user_id,
        Notification.is_deleted == False,
    ).first()
    if not n:
        raise HTTPException(status_code=404, detail="Notification not found")
    return n
