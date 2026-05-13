"""
routes/experiment_registry.py

FIXES in this version:
  - Team resolution now reads from `team_members` table (the source of truth),
    NOT from competition_participants.team_id which was never being populated.
  - _get_user_team_id: looks up the user's team via TeamMember rows for members
    of any team that is registered as participating in this competition.
  - _get_team_user_ids: fetches ALL members of the team from team_members.
  - Submission now correctly stamps team_id from team_members so leaderboard
    groups by team instead of showing every user individually.
  - Solo participants (no team) still appear solo on the leaderboard.
  - Leaderboard shows team name as the display name when team_id is set.

Endpoints:
  GET  /competitions/{id}/experiment-registry        — runs for current user's team
  POST /competitions/{id}/experiment-registry/submit — evaluate a run via Docker
  GET  /competitions/{id}/leaderboard-rich           — full leaderboard with team info
"""

import os
import json
import uuid
import tempfile
import subprocess
from datetime import datetime
from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from models import (
    Competition,
    CompetitionDataset,
    CompetitionParticipant,
    CompetitionOrganizer,
    ExperimentRun,
    ExperimentWorkspace,
    Submission,
    UserProfile,
)

from models_teams import Team, TeamMember

from supabase_client import supabase
from .utils import get_db, get_current_user

router = APIRouter(tags=["experiment-registry"])

WORKSPACES_DIR   = Path("./workspaces").resolve()
EVAL_RUNNER_PATH = Path(__file__).parent / "eval_runner.py"
STORAGE_BUCKET   = "competition-datasets"

# ─── All metrics an organizer can choose ─────────────────────────────────────
KNOWN_METRICS = {
    "accuracy", "f1", "f1_macro", "f1_weighted",
    "precision", "recall", "auc", "roc_auc",
    "mse", "mae", "rmse", "r2",
    "exact_match", "bleu", "rouge_l", "rouge_1", "rouge_2",
    "wer", "cer",
}

METRIC_HIGHER_IS_BETTER = {
    "accuracy": True,  "f1": True,       "f1_macro": True,  "f1_weighted": True,
    "precision": True, "recall": True,   "auc": True,       "roc_auc": True,
    "mse": False,      "mae": False,     "rmse": False,     "r2": True,
    "exact_match": True, "bleu": True,   "rouge_l": True,   "rouge_1": True,
    "rouge_2": True,   "wer": False,     "cer": False,
}


# ─────────────────────────────────────────────────────────────────────────────
# Team resolution helpers
#
# ROOT CAUSE FIX:
#   competition_participants.team_id is varchar and was NEVER being written
#   by the teams join/invite flow, so it was always NULL.
#
#   The authoritative source for "which team is a user on?" is team_members.
#   We resolve the user's team by:
#     1. Finding all teams the user belongs to (via team_members).
#     2. Checking which of those teams has at least one OTHER member who is
#        also a participant in this competition — that's their competition team.
#     3. If none found, the user is solo.
#
#   This works without any schema changes.
# ─────────────────────────────────────────────────────────────────────────────

def _get_user_team_id(user_id: str, competition_id: str, db: Session) -> str | None:
    """
    Returns the team_id (as string) for the user in this competition,
    resolved via team_members (NOT competition_participants.team_id).

    Strategy:
      - Get all teams the user is a member of.
      - For each team, check if any other member is also a participant
        in this competition.
      - Return the first matching team_id, or None if solo.

    Why this approach: team_members is always up-to-date when someone
    joins/accepts a team invitation. competition_participants.team_id
    was historically not being written.
    """
    # All teams this user belongs to
    my_memberships = db.query(TeamMember).filter(
        TeamMember.user_id == str(user_id)
    ).all()

    if not my_memberships:
        return None

    my_team_ids = [str(m.team_id) for m in my_memberships]

    # All participants in this competition
    participants = db.query(CompetitionParticipant).filter(
        CompetitionParticipant.competition_id == competition_id,
    ).all()
    participant_user_ids = {str(p.user_id) for p in participants}

    # For each of the user's teams, find members who are also in this competition
    for team_id_str in my_team_ids:
        try:
            tid_int = int(team_id_str)
        except (ValueError, TypeError):
            continue

        team_member_ids = {
            str(m.user_id)
            for m in db.query(TeamMember).filter(TeamMember.team_id == tid_int).all()
        }
        # If any team member (including self) is a competition participant,
        # this is the user's competition team.
        if team_member_ids & participant_user_ids:
            return team_id_str

    return None


def _get_team_user_ids(team_id: str | None, current_user_id: str, competition_id: str, db: Session) -> list[str]:
    """
    Returns all user_ids who are:
      (a) members of this team (via team_members), AND
      (b) participants in this competition.

    If team_id is None, returns just [current_user_id] (solo).
    """
    if not team_id:
        return [current_user_id]

    try:
        tid_int = int(team_id)
    except (ValueError, TypeError):
        return [current_user_id]

    # All members of this team
    team_members = db.query(TeamMember).filter(
        TeamMember.team_id == tid_int
    ).all()
    team_user_ids = {str(m.user_id) for m in team_members}

    # All participants in this competition
    participants = db.query(CompetitionParticipant).filter(
        CompetitionParticipant.competition_id == competition_id,
    ).all()
    participant_user_ids = {str(p.user_id) for p in participants}

    # Intersection: team members who are also competition participants
    visible = list(team_user_ids & participant_user_ids)

    # Always include current user even if not yet in competition_participants
    if current_user_id not in visible:
        visible.append(current_user_id)

    return visible


def _get_team_name(team_id: str | None, db: Session) -> str | None:
    """Fetch team name by team_id (string or int)."""
    if not team_id:
        return None
    try:
        team = db.query(Team).filter(Team.id == int(team_id)).first()
        return team.name if team else None
    except Exception:
        return None


def _resolve_user_names(user_ids: list[str], db: Session) -> dict[str, str]:
    """Returns {user_id: display_name}."""
    if not user_ids:
        return {}
    profiles = db.query(UserProfile).filter(UserProfile.user_id.in_(user_ids)).all()
    mapping = {}
    for p in profiles:
        display = p.full_name or getattr(p, "username", None) or p.user_id
        mapping[p.user_id] = display
    for uid in user_ids:
        if uid not in mapping:
            mapping[uid] = uid
    return mapping


# ─────────────────────────────────────────────────────────────────────────────
# Dataset column / task type helpers
# ─────────────────────────────────────────────────────────────────────────────

def _peek_hidden_dataset_columns(storage_path: str) -> list[str]:
    import io
    import pandas as pd
    try:
        raw = supabase.storage.from_(STORAGE_BUCKET).download(storage_path)
        if isinstance(raw, str):
            raw = raw.encode("utf-8")
        snippet = raw[:4096]
        ext = storage_path.rsplit(".", 1)[-1].lower()
        if ext == "csv":
            df = pd.read_csv(io.BytesIO(snippet), nrows=1)
        elif ext == "jsonl":
            df = pd.read_json(io.BytesIO(snippet), lines=True, nrows=1)
        else:
            try:
                df = pd.read_csv(io.BytesIO(snippet), nrows=1)
            except Exception:
                df = pd.read_json(io.BytesIO(snippet), lines=True, nrows=1)
        return list(df.columns)
    except Exception:
        return []


def _infer_task_type_from_columns(columns: list[str], declared_task: str) -> str:
    if declared_task and declared_task.upper() not in ("", "UNKNOWN", "GENERIC"):
        return declared_task.upper()
    col_set = {c.lower() for c in columns}
    if "sentiment" in col_set:
        return "SENTIMENT_ANALYSIS"
    if {"context", "question", "answer"} & col_set:
        return "QUESTION_ANSWERING"
    if {"source", "target"} & col_set:
        return "TRANSLATION"
    if {"document", "summary"} & col_set:
        return "SUMMARIZATION"
    if {"label", "text_content"} & col_set:
        return "TEXT_CLASSIFICATION"
    if "label" in col_set:
        return "TEXT_CLASSIFICATION"
    return "GENERIC"


def _resolve_metric(competition: Competition) -> str:
    TASK_DEFAULT = {
        "TEXT_CLASSIFICATION": "accuracy",
        "SENTIMENT_ANALYSIS":  "accuracy",
        "NER":                 "f1",
        "QUESTION_ANSWERING":  "exact_match",
        "TRANSLATION":         "bleu",
        "SUMMARIZATION":       "rouge_l",
        "REGRESSION":          "rmse",
    }
    primary = (competition.primary_metric or "").strip().lower()
    if primary and primary in KNOWN_METRICS:
        return primary
    task = (competition.task_type or "").upper()
    return TASK_DEFAULT.get(task, "accuracy")


def safe_name(value: str) -> str:
    return "".join(c if c.isalnum() else "-" for c in value)[:40]


# ─────────────────────────────────────────────────────────────────────────────
# GET /competitions/{id}/experiment-registry
#
# TEAM-SCOPED: participants see only their team's experiments.
# Organizers see all experiments (for oversight).
# ─────────────────────────────────────────────────────────────────────────────

@router.get("/competitions/{competition_id}/experiment-registry")
def list_team_experiments(
    competition_id: str,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """
    Returns experiment runs scoped to the current user's team.

    Access model:
      - Organizers  → see ALL experiments (oversight role)
      - Participants in a team → see only their team's experiments
      - Solo participants (no team) → see only their own experiments
    """
    is_organizer = db.query(CompetitionOrganizer).filter(
        CompetitionOrganizer.competition_id == competition_id,
        CompetitionOrganizer.user_id == current_user.id,
    ).first()

    is_participant = db.query(CompetitionParticipant).filter(
        CompetitionParticipant.competition_id == competition_id,
        CompetitionParticipant.user_id == current_user.id,
    ).first()

    if not is_organizer and not is_participant:
        raise HTTPException(status_code=403, detail="Join the competition to view experiments")

    competition = db.query(Competition).filter(Competition.id == competition_id).first()
    if not competition:
        raise HTTPException(status_code=404, detail="Competition not found")

    # ── Determine which user_ids to show ──────────────────────────────────────
    if is_organizer:
        # Organizer sees all runs
        runs = (
            db.query(ExperimentRun)
            .filter(ExperimentRun.competition_id == competition_id)
            .order_by(ExperimentRun.created_at.desc())
            .all()
        )
        team_id          = None
        team_name        = None
        visible_user_ids = list({r.user_id for r in runs})
    else:
        # Participant: resolve team via team_members (the fix)
        team_id          = _get_user_team_id(current_user.id, competition_id, db)
        visible_user_ids = _get_team_user_ids(team_id, current_user.id, competition_id, db)
        team_name        = _get_team_name(team_id, db)

        runs = (
            db.query(ExperimentRun)
            .filter(
                ExperimentRun.competition_id == competition_id,
                ExperimentRun.user_id.in_(visible_user_ids),
            )
            .order_by(ExperimentRun.created_at.desc())
            .all()
        )

    name_map    = _resolve_user_names(list({r.user_id for r in runs}), db)
    current_uid = current_user.id
    metric_name = _resolve_metric(competition)

    result = []
    for r in runs:
        params = {}
        if r.parameters_json:
            try:
                params = json.loads(r.parameters_json)
            except Exception:
                pass

        result.append({
            "id":              r.id,
            "name":            r.name,
            "notes":           r.notes or "",
            "metric_name":     r.metric_name or "",
            "metric_value":    r.metric_value or "",
            "artifact_path":   r.artifact_path or "",
            "created_at":      r.created_at,
            "workspace_id":    r.workspace_id,
            "user_id":         r.user_id,
            "user_name":       name_map.get(r.user_id, r.user_id),
            "is_mine":         r.user_id == current_uid,
            "model_filename":  params.get("model_filename") or r.artifact_path or "model.pkl",
            "hyperparameters": params.get("hyperparameters") or {},
            "dataset_version": params.get("dataset_version") or "",
            "resource_tier":   params.get("resource_tier") or "",
            "active_file":     params.get("active_file") or "",
        })

    return {
        "competition_id":    competition_id,
        "competition_title": competition.title,
        "task_type":         competition.task_type or "",
        "primary_metric":    metric_name,
        "team_id":           team_id,
        "team_name":         team_name,
        "team_member_ids":   visible_user_ids if not is_organizer else [],
        "is_organizer_view": bool(is_organizer),
        "total":             len(result),
        "experiments":       result,
    }


# ─────────────────────────────────────────────────────────────────────────────
# POST /competitions/{id}/experiment-registry/submit
# ─────────────────────────────────────────────────────────────────────────────

@router.post("/competitions/{competition_id}/experiment-registry/submit")
def submit_from_experiment(
    competition_id: str,
    body: dict,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """
    Submit a model for evaluation.
    - Only the run owner can submit.
    - Evaluation metric comes from competition.primary_metric.
    - team_id is resolved from team_members (the fix — no longer from
      competition_participants.team_id which was always NULL).
    - Evaluation runs in an isolated Docker container.
    """

    # ── 1. Load the experiment run ────────────────────────────────────────────
    run_id = body.get("experiment_run_id")
    if not run_id:
        raise HTTPException(status_code=400, detail="experiment_run_id is required")

    run = db.query(ExperimentRun).filter(
        ExperimentRun.id == run_id,
        ExperimentRun.competition_id == competition_id,
    ).first()

    if not run:
        raise HTTPException(status_code=404, detail="Experiment run not found")

    if run.user_id != current_user.id:
        raise HTTPException(
            status_code=403,
            detail="You can only submit your own experiment runs",
        )

    # ── 2. Competition & access check ─────────────────────────────────────────
    competition = db.query(Competition).filter(Competition.id == competition_id).first()
    if not competition:
        raise HTTPException(status_code=404, detail="Competition not found")

    is_participant = db.query(CompetitionParticipant).filter(
        CompetitionParticipant.competition_id == competition_id,
        CompetitionParticipant.user_id == current_user.id,
    ).first()

    is_organizer = db.query(CompetitionOrganizer).filter(
        CompetitionOrganizer.competition_id == competition_id,
        CompetitionOrganizer.user_id == current_user.id,
    ).first()

    if not is_participant and not is_organizer:
        raise HTTPException(status_code=403, detail="You must join the competition first")

    # ── 3. Resolve model filename ─────────────────────────────────────────────
    params = {}
    if run.parameters_json:
        try:
            params = json.loads(run.parameters_json)
        except Exception:
            pass

    model_filename = params.get("model_filename") or run.artifact_path or "model.pkl"
    workspace_path = WORKSPACES_DIR / f"{safe_name(competition_id)}_{safe_name(current_user.id)}"
    model_path     = workspace_path / model_filename

    if not model_path.exists():
        raise HTTPException(
            status_code=404,
            detail=(
                f"Model file '{model_filename}' not found in your workspace. "
                f"Make sure the experiment was saved with the correct model filename."
            ),
        )

    # ── 4. Find hidden test dataset ───────────────────────────────────────────
    hidden_dataset = (
        db.query(CompetitionDataset)
        .filter(
            CompetitionDataset.competition_id == competition_id,
            CompetitionDataset.dataset_type.in_(["hidden_test", "hidden_labels"]),
        )
        .order_by(CompetitionDataset.uploaded_at.desc())
        .first()
    )

    if not hidden_dataset:
        raise HTTPException(
            status_code=404,
            detail="No hidden test dataset found. The organizer must upload one first.",
        )

    # ── 5. Resolve task type & organizer metric ───────────────────────────────
    declared_task  = competition.task_type or "TEXT_CLASSIFICATION"
    columns        = _peek_hidden_dataset_columns(hidden_dataset.storage_path)
    task_type      = _infer_task_type_from_columns(columns, declared_task)
    primary_metric = _resolve_metric(competition)

    # ── 6. Download hidden test file ──────────────────────────────────────────
    try:
        file_bytes = supabase.storage.from_(STORAGE_BUCKET).download(hidden_dataset.storage_path)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Could not download test dataset: {e}")

    # ── 7. Resolve team_id via team_members (THE FIX) ─────────────────────────
    # Previously this read competition_participants.team_id which was always NULL.
    # Now we resolve via team_members which is always populated on join/accept.
    team_id = _get_user_team_id(current_user.id, competition_id, db)

    # ── 8. Create submission record ───────────────────────────────────────────
    submission = Submission(
        id=str(uuid.uuid4()),
        competition_id=competition_id,
        user_id=current_user.id,
        team_id=team_id,           # ← now correctly set from team_members
        model_filename=model_filename,
        status="running",
        submitted_at=datetime.utcnow().isoformat(),
    )
    db.add(submission)
    db.commit()
    db.refresh(submission)

    # ── 9. Run evaluation in Docker ───────────────────────────────────────────
    score, metric_name, error = _run_evaluation_in_docker(
        model_path=str(model_path),
        test_file_bytes=file_bytes,
        test_filename=hidden_dataset.original_filename,
        task_type=task_type,
        primary_metric=primary_metric,
        submission_id=submission.id,
        detected_columns=columns,
    )

    # ── 10. Persist result ────────────────────────────────────────────────────
    if error:
        submission.status        = "failed"
        submission.error_message = error
    else:
        submission.status       = "done"
        submission.score        = score
        submission.metric_name  = metric_name
        submission.evaluated_at = datetime.utcnow().isoformat()

    db.commit()
    db.refresh(submission)

    return {
        "submission_id":     submission.id,
        "experiment_run_id": run_id,
        "experiment_name":   run.name,
        "model_filename":    model_filename,
        "task_type_used":    task_type,
        "primary_metric":    primary_metric,
        "dataset_columns":   columns,
        "status":            submission.status,
        "score":             submission.score,
        "metric_name":       submission.metric_name,
        "error":             submission.error_message,
        "submitted_at":      submission.submitted_at,
        "evaluated_at":      submission.evaluated_at,
    }


# ─────────────────────────────────────────────────────────────────────────────
# GET /competitions/{id}/leaderboard-rich
# Team-aware leaderboard: best score per team (or per user if solo).
# ─────────────────────────────────────────────────────────────────────────────

@router.get("/competitions/{competition_id}/leaderboard-rich")
def get_rich_leaderboard(
    competition_id: str,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """
    Returns the leaderboard:
      - One row per team (or per individual if no team)
      - Best submission score per team
      - Shows current user's rank
      - Marks the user's own row
      - Shows team name as the display name for team entries
      - Solo users appear with their own name

    For OLD submissions that were recorded before this fix (team_id=NULL even
    for team members), we do a best-effort re-resolution of team_id at read
    time so the leaderboard self-heals without needing a data migration.
    """
    is_organizer = db.query(CompetitionOrganizer).filter(
        CompetitionOrganizer.competition_id == competition_id,
        CompetitionOrganizer.user_id == current_user.id,
    ).first()

    is_participant = db.query(CompetitionParticipant).filter(
        CompetitionParticipant.competition_id == competition_id,
        CompetitionParticipant.user_id == current_user.id,
    ).first()

    if not is_organizer and not is_participant:
        raise HTTPException(status_code=403, detail="Join the competition to view the leaderboard")

    competition = db.query(Competition).filter(Competition.id == competition_id).first()
    if not competition:
        raise HTTPException(status_code=404, detail="Competition not found")

    primary_metric   = _resolve_metric(competition)
    higher_is_better = METRIC_HIGHER_IS_BETTER.get(primary_metric, True)

    all_done = (
        db.query(Submission)
        .filter(
            Submission.competition_id == competition_id,
            Submission.status == "done",
        )
        .all()
    )

    # ── Self-healing: re-resolve team_id for legacy NULL submissions ──────────
    # For any submission where team_id is NULL, look up the submitter's team
    # via team_members so old submissions are grouped correctly without migration.
    for s in all_done:
        if not s.team_id:
            resolved = _get_user_team_id(s.user_id, competition_id, db)
            if resolved:
                s.team_id = resolved
    # (We don't commit these — they are in-memory corrections for display only)

    # ── Build {team_key: best_submission} ─────────────────────────────────────
    # team_key = str(team_id) if set, else user_id (solo participant)
    best_by_key: dict[str, Submission] = {}
    for s in all_done:
        key = str(s.team_id) if s.team_id else s.user_id
        if key not in best_by_key:
            best_by_key[key] = s
        else:
            existing_score = float(best_by_key[key].score or 0)
            new_score      = float(s.score or 0)
            if higher_is_better:
                is_better = new_score > existing_score
            else:
                is_better = new_score < existing_score
            if is_better:
                best_by_key[key] = s

    # ── Sort ──────────────────────────────────────────────────────────────────
    ranked = sorted(
        best_by_key.values(),
        key=lambda s: float(s.score or 0),
        reverse=higher_is_better,
    )

    # ── Resolve display names ─────────────────────────────────────────────────
    all_user_ids = list({s.user_id for s in ranked})
    name_map     = _resolve_user_names(all_user_ids, db)

    team_ids = list({str(s.team_id) for s in ranked if s.team_id})
    team_name_map: dict[str, str] = {}
    for tid in team_ids:
        team_name_map[tid] = _get_team_name(tid, db) or tid

    # ── Current user's key (for highlighting their row) ───────────────────────
    current_team_id  = _get_user_team_id(current_user.id, competition_id, db)
    current_user_key = str(current_team_id) if current_team_id else current_user.id

    return {
        "competition_id":    competition_id,
        "competition_title": competition.title,
        "primary_metric":    primary_metric,
        "higher_is_better":  higher_is_better,
        "my_rank": next(
            (i + 1 for i, s in enumerate(ranked)
             if (str(s.team_id) if s.team_id else s.user_id) == current_user_key),
            None,
        ),
        "entries": [
            {
                "rank":           i + 1,
                "team_id":        str(s.team_id) if s.team_id else None,
                # team_name is the primary display name for team entries
                "team_name":      team_name_map.get(str(s.team_id)) if s.team_id else None,
                "user_id":        s.user_id,
                # user_name shown as subtitle under team name (or as main name if solo)
                "user_name":      name_map.get(s.user_id, s.user_id),
                "is_me":          (str(s.team_id) if s.team_id else s.user_id) == current_user_key,
                "score":          float(s.score) if s.score is not None else None,
                "metric_name":    s.metric_name or primary_metric,
                "submission_id":  s.id,
                "model_filename": s.model_filename,
                "submitted_at":   s.submitted_at,
                "evaluated_at":   s.evaluated_at,
            }
            for i, s in enumerate(ranked)
        ],
    }


# ─────────────────────────────────────────────────────────────────────────────
# Docker evaluation
# ─────────────────────────────────────────────────────────────────────────────

def _run_evaluation_in_docker(
    model_path: str,
    test_file_bytes: bytes,
    test_filename: str,
    task_type: str,
    primary_metric: str,
    submission_id: str,
    detected_columns: list[str],
) -> tuple[float | None, str | None, str | None]:
    """
    Spins up a Docker container with:
      --network none   → no internet access
      --cpus 1         → fair CPU quota
      --memory 2g      → fair RAM quota
      --rm             → auto-cleaned after run
      --read-only      → immutable container filesystem
      --tmpfs /tmp     → writable scratch space

    Returns (score_float, metric_name, error_string_or_None).
    """
    container_name = f"lexivia-eval-{submission_id[:12]}"

    with tempfile.TemporaryDirectory() as tmpdir:
        tmp = Path(tmpdir)

        (tmp / "model.pkl").write_bytes(Path(model_path).read_bytes())
        (tmp / test_filename).write_bytes(test_file_bytes)

        (tmp / "columns_hint.json").write_text(
            json.dumps({
                "columns":        detected_columns,
                "task_type":      task_type,
                "primary_metric": primary_metric,
            }),
            encoding="utf-8",
        )

        (tmp / "eval_runner.py").write_bytes(EVAL_RUNNER_PATH.read_bytes())

        cmd = [
            "docker", "run",
            "--rm",
            "--name",       container_name,
            "--network",    "none",
            "--cpus",       "1",
            "--memory",     "2g",
            "--read-only",
            "--tmpfs",      "/tmp:size=512m",
            "-v",           f"{str(tmp)}:/eval:ro",
            "jupyter/scipy-notebook:python-3.10",
            "python", "/eval/eval_runner.py",
            "/eval/model.pkl",
            f"/eval/{test_filename}",
            task_type,
        ]

        try:
            result = subprocess.run(
                cmd,
                capture_output=True,
                text=True,
                timeout=300,
            )
        except subprocess.TimeoutExpired:
            subprocess.run(["docker", "rm", "-f", container_name], capture_output=True)
            return None, None, "Evaluation timed out after 5 minutes"
        except FileNotFoundError:
            return None, None, (
                "Docker is not installed or not running. "
                "Start Docker Desktop and try again."
            )

        if result.returncode != 0:
            err = (result.stderr or result.stdout or "Unknown Docker error")[:600]
            return None, None, f"Evaluation container failed: {err}"

        score, metric = _parse_score_output(result.stdout)
        if score is None:
            return None, None, (
                f"Could not parse a score from evaluation output. "
                f"Raw output: {result.stdout[:300]}"
            )

        return score, metric, None


def _parse_score_output(output: str) -> tuple[float | None, str | None]:
    """Parses lines like  accuracy=0.91  or  rouge_l=0.74"""
    for line in output.splitlines():
        line = line.strip()
        if "=" in line:
            name, value = line.split("=", 1)
            name  = name.strip().lower()
            value = value.strip()
            if name in KNOWN_METRICS:
                try:
                    return float(value), name
                except ValueError:
                    continue
    return None, None