"""
Teams API routes — uses user_profiles (not users table).

Tables:
  - teams, team_members, team_invitations  (models_teams.py)
  - team_join_requests                     (new — see SQL below)
  - user_profiles                          (user_id text PK, full_name, email)

SQL to create the new table:
─────────────────────────────────────────────────────────────
CREATE TABLE public.team_join_requests (
  id          SERIAL PRIMARY KEY,
  team_id     INTEGER NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  user_id     TEXT    NOT NULL REFERENCES user_profiles(user_id) ON DELETE CASCADE,
  message     TEXT,
  status      VARCHAR DEFAULT 'pending',  -- 'pending' | 'accepted' | 'declined'
  created_at  TEXT,
  updated_at  TEXT,
  CONSTRAINT no_duplicate_request UNIQUE (team_id, user_id, status)
);
─────────────────────────────────────────────────────────────
"""

from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import Column, Integer, String, Text
from sqlalchemy.orm import Session

from database import Base
from models import UserProfile
from models_teams import Team, TeamMember, TeamInvitation
from .utils import get_db, get_current_user

router = APIRouter(tags=["teams"])


# ── Inline model for join requests ────────────────────────────────────────────

class TeamJoinRequest(Base):
    __tablename__ = "team_join_requests"

    id         = Column(Integer, primary_key=True, autoincrement=True)
    team_id    = Column(Integer, nullable=False)
    user_id    = Column(String, nullable=False)
    message    = Column(Text, nullable=True)
    status     = Column(String, default="pending")  # pending | accepted | declined
    created_at = Column(String, nullable=True)
    updated_at = Column(String, nullable=True)


# ── Helpers ────────────────────────────────────────────────────────────────────

def _now() -> str:
    return datetime.utcnow().isoformat()


def _profile(db: Session, user_id: str) -> dict:
    p = db.query(UserProfile).filter(UserProfile.user_id == str(user_id)).first()
    if p:
        return {"username": p.full_name or getattr(p, "username", None) or "Unknown"}
    return {"username": "Unknown"}


def _require_leader(db: Session, team_id: int, user_id: str):
    m = db.query(TeamMember).filter(
        TeamMember.team_id == team_id,
        TeamMember.user_id == str(user_id),
    ).first()
    if not m or m.role != "leader":
        raise HTTPException(status_code=403, detail="Only team leaders can perform this action")
    return m


def _require_can_invite(db: Session, team_id: int, user_id: str):
    """Leaders and admins can invite."""
    m = db.query(TeamMember).filter(
        TeamMember.team_id == team_id,
        TeamMember.user_id == str(user_id),
    ).first()
    if not m or m.role not in ("leader", "admin"):
        raise HTTPException(status_code=403, detail="Only leaders and admins can invite members")
    return m


# ── List / search teams ────────────────────────────────────────────────────────

@router.get("/teams")
def list_teams(
    page: int = 1,
    limit: int = 6,
    search: str = "",
    tab: str = "all",
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    query = db.query(Team)

    if tab == "mine":
        my_team_ids = [
            r.team_id for r in
            db.query(TeamMember.team_id)
              .filter(TeamMember.user_id == str(current_user.id))
              .all()
        ]
        if not my_team_ids:
            return {"teams": [], "total": 0}
        query = query.filter(Team.id.in_(my_team_ids))

    if search.strip():
        query = query.filter(Team.name.ilike(f"%{search.strip()}%"))

    total = query.count()
    teams = (
        query
        .order_by(Team.created_at.desc())
        .offset((page - 1) * limit)
        .limit(limit)
        .all()
    )

    if not teams:
        return {"teams": [], "total": total}

    team_ids    = [t.id for t in teams]
    member_rows = db.query(TeamMember).filter(TeamMember.team_id.in_(team_ids)).all()

    count_map: dict[int, int] = {}
    my_teams: set[int] = set()
    for m in member_rows:
        count_map[m.team_id] = count_map.get(m.team_id, 0) + 1
        if str(m.user_id) == str(current_user.id):
            my_teams.add(m.team_id)

    return {
        "teams": [
            {
                "id":           t.id,
                "name":         t.name,
                "description":  t.description,
                "created_at":   t.created_at,
                "member_count": count_map.get(t.id, 0),
                "is_my_team":   t.id in my_teams,
            }
            for t in teams
        ],
        "total": total,
    }


# ── Create team ────────────────────────────────────────────────────────────────

@router.post("/teams")
def create_team(
    body: dict,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    name = (body.get("name") or "").strip()
    if not name:
        raise HTTPException(status_code=400, detail="Team name is required")

    now  = _now()
    team = Team(
        name=name,
        description=(body.get("description") or "").strip(),
        created_by=str(current_user.id),
        created_at=now,
        updated_at=now,
    )
    db.add(team)
    db.flush()

    db.add(TeamMember(
        team_id=team.id,
        user_id=str(current_user.id),
        role="leader",
        joined_at=now,
    ))
    db.commit()
    db.refresh(team)
    return {"id": team.id, "name": team.name, "message": "Team created successfully"}


# ── Team detail ────────────────────────────────────────────────────────────────

@router.get("/teams/{team_id}")
def get_team(
    team_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    team = db.query(Team).filter(Team.id == team_id).first()
    if not team:
        raise HTTPException(status_code=404, detail="Team not found")

    member_rows = (
        db.query(TeamMember)
        .filter(TeamMember.team_id == team_id)
        .order_by(TeamMember.joined_at.asc())
        .all()
    )

    members           = []
    current_user_role = None
    for m in member_rows:
        info = _profile(db, m.user_id)
        members.append({
            "userId":   str(m.user_id),
            "username": info["username"],
            "role":     m.role,
            "joinedAt": m.joined_at,
        })
        if str(m.user_id) == str(current_user.id):
            current_user_role = m.role

    return {
        "id":                team.id,
        "name":              team.name,
        "description":       team.description,
        "created_at":        team.created_at,
        "created_by":        team.created_by,
        "members":           members,
        "current_user_role": current_user_role,  # null = not a member
    }


# ── Update team (leaders only) ────────────────────────────────────────────────

@router.put("/teams/{team_id}")
def update_team(
    team_id: int,
    body: dict,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    _require_leader(db, team_id, str(current_user.id))

    team = db.query(Team).filter(Team.id == team_id).first()
    if not team:
        raise HTTPException(status_code=404, detail="Team not found")

    name = (body.get("name") or "").strip()
    if not name:
        raise HTTPException(status_code=400, detail="Team name cannot be empty")

    team.name        = name
    team.description = (body.get("description") or "").strip()
    team.updated_at  = _now()
    db.commit()
    return {"message": "Team updated successfully"}


# ── Delete team (leaders only) ────────────────────────────────────────────────

@router.delete("/teams/{team_id}")
def delete_team(
    team_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    _require_leader(db, team_id, str(current_user.id))

    team = db.query(Team).filter(Team.id == team_id).first()
    if not team:
        raise HTTPException(status_code=404, detail="Team not found")

    # Cascade-delete members, invitations, and join requests first
    db.query(TeamMember).filter(TeamMember.team_id == team_id).delete(synchronize_session=False)
    db.query(TeamInvitation).filter(TeamInvitation.team_id == team_id).delete(synchronize_session=False)
    db.query(TeamJoinRequest).filter(TeamJoinRequest.team_id == team_id).delete(synchronize_session=False)
    db.delete(team)
    db.commit()
    return {"message": "Team deleted successfully"}


# ── Invite by email (leaders + admins) ───────────────────────────────────────

@router.post("/teams/{team_id}/invite")
def invite_member(
    team_id: int,
    body: dict,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    _require_can_invite(db, team_id, str(current_user.id))

    email = (body.get("email") or "").strip().lower()
    role  = body.get("role", "member")

    if not email:
        raise HTTPException(status_code=400, detail="Email is required")
    if role not in ("member", "admin", "leader"):
        raise HTTPException(status_code=400, detail="Invalid role")

    # Resolve email → user_profiles (requires email column on user_profiles)
    receiver = db.query(UserProfile).filter(UserProfile.email == email).first()
    if not receiver:
        raise HTTPException(status_code=404, detail="No registered user found with that email")

    receiver_id   = receiver.user_id
    receiver_name = receiver.full_name or email

    existing_member = db.query(TeamMember).filter(
        TeamMember.team_id == team_id,
        TeamMember.user_id == receiver_id,
    ).first()
    if existing_member:
        raise HTTPException(status_code=400, detail=f"{receiver_name} is already a member")

    existing_invite = db.query(TeamInvitation).filter(
        TeamInvitation.team_id     == team_id,
        TeamInvitation.receiver_id == receiver_id,
        TeamInvitation.status      == "pending",
    ).first()
    if existing_invite:
        raise HTTPException(status_code=400, detail=f"{receiver_name} already has a pending invitation")

    now = _now()
    db.add(TeamInvitation(
        team_id=team_id,
        sender_id=str(current_user.id),
        receiver_id=receiver_id,
        role=role,
        status="pending",
        created_at=now,
        updated_at=now,
    ))
    db.commit()
    return {"message": f"Invitation sent to {receiver_name}"}


# ── Request to join (outsiders only) ─────────────────────────────────────────

@router.post("/teams/{team_id}/request-join")
def request_join(
    team_id: int,
    body: dict,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    team = db.query(Team).filter(Team.id == team_id).first()
    if not team:
        raise HTTPException(status_code=404, detail="Team not found")

    # Already a member?
    already = db.query(TeamMember).filter(
        TeamMember.team_id == team_id,
        TeamMember.user_id == str(current_user.id),
    ).first()
    if already:
        raise HTTPException(status_code=400, detail="You are already a member of this team")

    # Already has a pending request?
    existing = db.query(TeamJoinRequest).filter(
        TeamJoinRequest.team_id == team_id,
        TeamJoinRequest.user_id == str(current_user.id),
        TeamJoinRequest.status  == "pending",
    ).first()
    if existing:
        raise HTTPException(status_code=400, detail="You already have a pending request for this team")

    now = _now()
    db.add(TeamJoinRequest(
        team_id=team_id,
        user_id=str(current_user.id),
        message=(body.get("message") or "").strip() or None,
        status="pending",
        created_at=now,
        updated_at=now,
    ))
    db.commit()
    return {"message": "Join request sent. A team leader will review it."}


# ── List join requests (leaders only) ────────────────────────────────────────

@router.get("/teams/{team_id}/join-requests")
def list_join_requests(
    team_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    _require_leader(db, team_id, str(current_user.id))

    requests = db.query(TeamJoinRequest).filter(
        TeamJoinRequest.team_id == team_id,
        TeamJoinRequest.status  == "pending",
    ).all()

    return [
        {
            "id":         r.id,
            "user_id":    r.user_id,
            "username":   _profile(db, r.user_id)["username"],
            "message":    r.message,
            "created_at": r.created_at,
        }
        for r in requests
    ]


# ── Accept / decline join request (leaders only) ─────────────────────────────

@router.post("/teams/{team_id}/join-requests/{request_id}/accept")
def accept_join_request(
    team_id: int,
    request_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    _require_leader(db, team_id, str(current_user.id))

    req = db.query(TeamJoinRequest).filter(
        TeamJoinRequest.id      == request_id,
        TeamJoinRequest.team_id == team_id,
        TeamJoinRequest.status  == "pending",
    ).first()
    if not req:
        raise HTTPException(status_code=404, detail="Join request not found")

    req.status     = "accepted"
    req.updated_at = _now()

    db.add(TeamMember(
        team_id=team_id,
        user_id=req.user_id,
        role="member",
        joined_at=_now(),
    ))
    db.commit()
    return {"message": "Join request accepted"}


@router.post("/teams/{team_id}/join-requests/{request_id}/decline")
def decline_join_request(
    team_id: int,
    request_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    _require_leader(db, team_id, str(current_user.id))

    req = db.query(TeamJoinRequest).filter(
        TeamJoinRequest.id      == request_id,
        TeamJoinRequest.team_id == team_id,
        TeamJoinRequest.status  == "pending",
    ).first()
    if not req:
        raise HTTPException(status_code=404, detail="Join request not found")

    req.status     = "declined"
    req.updated_at = _now()
    db.commit()
    return {"message": "Join request declined"}


# ── Remove member (leaders only) ──────────────────────────────────────────────

@router.delete("/teams/{team_id}/members/{user_id}")
def remove_member(
    team_id: int,
    user_id: str,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    _require_leader(db, team_id, str(current_user.id))

    if user_id == str(current_user.id):
        raise HTTPException(status_code=400, detail="You cannot remove yourself")

    membership = db.query(TeamMember).filter(
        TeamMember.team_id == team_id,
        TeamMember.user_id == user_id,
    ).first()
    if not membership:
        raise HTTPException(status_code=404, detail="Member not found")

    db.delete(membership)
    db.commit()
    return {"message": "Member removed successfully"}


# ── Pending invitations for current user ──────────────────────────────────────

@router.get("/teams/invitations/pending")
def my_pending_invitations(
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    invites = db.query(TeamInvitation).filter(
        TeamInvitation.receiver_id == str(current_user.id),
        TeamInvitation.status      == "pending",
    ).all()

    return [
        {
            "id":         inv.id,
            "team_id":    inv.team_id,
            "team_name":  (db.query(Team).filter(Team.id == inv.team_id).first() or Team()).name or "Unknown",
            "sender":     _profile(db, inv.sender_id)["username"],
            "role":       inv.role,
            "created_at": inv.created_at,
        }
        for inv in invites
    ]


# ── Accept / decline invitation ───────────────────────────────────────────────

@router.post("/teams/invitations/{invitation_id}/accept")
def accept_invitation(
    invitation_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    inv = db.query(TeamInvitation).filter(
        TeamInvitation.id          == invitation_id,
        TeamInvitation.receiver_id == str(current_user.id),
        TeamInvitation.status      == "pending",
    ).first()
    if not inv:
        raise HTTPException(status_code=404, detail="Invitation not found")

    inv.status     = "accepted"
    inv.updated_at = _now()
    db.add(TeamMember(
        team_id=inv.team_id,
        user_id=str(current_user.id),
        role=inv.role,
        joined_at=_now(),
    ))
    db.commit()
    return {"message": "Invitation accepted"}


@router.post("/teams/invitations/{invitation_id}/decline")
def decline_invitation(
    invitation_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    inv = db.query(TeamInvitation).filter(
        TeamInvitation.id          == invitation_id,
        TeamInvitation.receiver_id == str(current_user.id),
        TeamInvitation.status      == "pending",
    ).first()
    if not inv:
        raise HTTPException(status_code=404, detail="Invitation not found")

    inv.status     = "declined"
    inv.updated_at = _now()
    db.commit()
    return {"message": "Invitation declined"}