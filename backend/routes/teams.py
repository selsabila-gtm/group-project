"""
Teams API routes.

Tables assumed (SQLAlchemy models in models_teams.py):
  - teams           : id, name, description, created_by (user UUID), created_at
  - team_members    : id, team_id, user_id (UUID), role, joined_at
  - team_invitations: id, team_id, sender_id, receiver_id, role, status, created_at

UserProfile (from models.py) : user_id (UUID), full_name, email
"""

from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from models import UserProfile
from models_teams import Team, TeamMember, TeamInvitation
from .utils import get_db, get_current_user

router = APIRouter(tags=["teams"])


# ── Helpers ────────────────────────────────────────────────────────────────────

def _profile(db: Session, user_id: str) -> dict:
    """Return display name + email for a user_id."""
    p = db.query(UserProfile).filter(UserProfile.user_id == user_id).first()
    if p:
        return {"username": p.full_name or "Unknown", "email": getattr(p, "email", "")}
    return {"username": "Unknown", "email": ""}


def _require_leader(db: Session, team_id: int, user_id: str):
    membership = db.query(TeamMember).filter(
        TeamMember.team_id == team_id,
        TeamMember.user_id == user_id,
    ).first()
    if not membership or membership.role != "leader":
        raise HTTPException(status_code=403, detail="Only team leaders can perform this action")
    return membership


# ── List / search teams ────────────────────────────────────────────────────────

@router.get("/teams")
def list_teams(
    page: int = 1,
    limit: int = 6,
    search: str = "",
    tab: str = "all",          # "all" | "mine"
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    query = db.query(Team)

    if tab == "mine":
        my_team_ids = [
            r.team_id for r in db.query(TeamMember.team_id).filter(
                TeamMember.user_id == current_user.id
            ).all()
        ]
        if not my_team_ids:
            return {"teams": [], "total": 0}
        query = query.filter(Team.id.in_(my_team_ids))

    if search.strip():
        query = query.filter(Team.name.ilike(f"%{search.strip()}%"))

    total = query.count()
    teams = query.order_by(Team.created_at.desc()).offset((page - 1) * limit).limit(limit).all()

    if not teams:
        return {"teams": [], "total": total}

    # Fetch all member rows for these teams in one query
    team_ids = [t.id for t in teams]
    member_rows = db.query(TeamMember).filter(TeamMember.team_id.in_(team_ids)).all()

    count_map: dict[int, int] = {}
    my_teams: set[int] = set()
    for m in member_rows:
        count_map[m.team_id] = count_map.get(m.team_id, 0) + 1
        if m.user_id == current_user.id:
            my_teams.add(m.team_id)

    result = []
    for t in teams:
        result.append({
            "id": t.id,
            "name": t.name,
            "description": t.description,
            "created_at": t.created_at,
            "member_count": count_map.get(t.id, 0),
            "is_my_team": t.id in my_teams,
        })

    return {"teams": result, "total": total}


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

    team = Team(
        name=name,
        description=(body.get("description") or "").strip(),
        created_by=current_user.id,
        created_at=datetime.utcnow().isoformat(),
    )
    db.add(team)
    db.flush()  # get team.id

    # Creator becomes leader automatically
    db.add(TeamMember(
        team_id=team.id,
        user_id=current_user.id,
        role="leader",
        joined_at=datetime.utcnow().isoformat(),
    ))
    db.commit()
    db.refresh(team)
    return {"id": team.id, "name": team.name, "message": "Team created successfully"}


# ── Team detail (with member list) ────────────────────────────────────────────

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

    members = []
    current_user_role = None
    for m in member_rows:
        info = _profile(db, m.user_id)
        members.append({
            "userId": m.user_id,
            "username": info["username"],
            "email": info["email"],
            "role": m.role,
            "joinedAt": m.joined_at,
        })
        if m.user_id == current_user.id:
            current_user_role = m.role

    return {
        "id": team.id,
        "name": team.name,
        "description": team.description,
        "created_at": team.created_at,
        "created_by": team.created_by,
        "members": members,
        "current_user_role": current_user_role,
    }


# ── Update team info (leaders only) ───────────────────────────────────────────

@router.put("/teams/{team_id}")
def update_team(
    team_id: int,
    body: dict,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    _require_leader(db, team_id, current_user.id)

    team = db.query(Team).filter(Team.id == team_id).first()
    if not team:
        raise HTTPException(status_code=404, detail="Team not found")

    name = (body.get("name") or "").strip()
    if not name:
        raise HTTPException(status_code=400, detail="Team name cannot be empty")

    team.name = name
    team.description = (body.get("description") or "").strip()
    db.commit()
    return {"message": "Team updated successfully"}


# ── Invite member by email (leaders only) ─────────────────────────────────────

@router.post("/teams/{team_id}/invite")
def invite_member(
    team_id: int,
    body: dict,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    _require_leader(db, team_id, current_user.id)

    email = (body.get("email") or "").strip().lower()
    role = body.get("role", "member")

    if not email:
        raise HTTPException(status_code=400, detail="Email is required")
    if role not in ("member", "admin", "leader"):
        raise HTTPException(status_code=400, detail="Invalid role")

    # Look up the receiver in UserProfile by email
    receiver = db.query(UserProfile).filter(UserProfile.email == email).first()
    if not receiver:
        raise HTTPException(status_code=404, detail="No user found with that email address")

    # Already a member?
    existing_member = db.query(TeamMember).filter(
        TeamMember.team_id == team_id,
        TeamMember.user_id == receiver.user_id,
    ).first()
    if existing_member:
        raise HTTPException(
            status_code=400,
            detail=f"{receiver.full_name} is already a member of this team",
        )

    # Pending invite already exists?
    existing_invite = db.query(TeamInvitation).filter(
        TeamInvitation.team_id == team_id,
        TeamInvitation.receiver_id == receiver.user_id,
        TeamInvitation.status == "pending",
    ).first()
    if existing_invite:
        raise HTTPException(
            status_code=400,
            detail=f"{receiver.full_name} already has a pending invitation",
        )

    now = datetime.utcnow().isoformat()
    db.add(TeamInvitation(
        team_id=team_id,
        sender_id=current_user.id,
        receiver_id=receiver.user_id,
        role=role,
        status="pending",
        created_at=now,
        updated_at=now,
    ))
    db.commit()
    return {"message": f"Invitation sent to {receiver.full_name}"}


# ── Remove member (leaders only) ──────────────────────────────────────────────

@router.delete("/teams/{team_id}/members/{user_id}")
def remove_member(
    team_id: int,
    user_id: str,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    _require_leader(db, team_id, current_user.id)

    if user_id == current_user.id:
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
