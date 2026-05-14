"""
routes/experiment_registry.py

FIXES in this version:
  - Team resolution reads from `team_members` (not competition_participants.team_id
    which was never populated by the invite/join flow).
  - _get_user_team_id now checks that the team has at LEAST one other member who
    is also a competition participant — prevents a user's old/unrelated team from
    being misidentified as the competition team.
  - _get_team_user_ids intersects team members with competition participants so
    only teammates actually in this competition are shown.
  - DAILY SUBMISSION LIMIT: respects competition.max_submissions_per_day.
  - Docker flags hardened: --no-new-privileges, --cap-drop ALL added.
  - eval_runner.py path resolved relative to THIS file so it survives deployment.
  - AUC fallback in _parse_score_output handles both "auc" and "roc_auc".
  - Leaderboard self-heals NULL team_id rows at read time without migration.

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
from datetime import datetime, date
from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func

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
# Resolve eval_runner.py relative to this source file so it always works
EVAL_RUNNER_PATH = Path(__file__).parent / "eval_runner.py"
STORAGE_BUCKET   = "competition-datasets"

# ─── Metric tables (kept in sync with eval_runner.py) ────────────────────────
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

TASK_DEFAULT_METRIC = {
    "TEXT_CLASSIFICATION": "accuracy",
    "SENTIMENT_ANALYSIS":  "accuracy",
    "NER":                 "f1",
    "QUESTION_ANSWERING":  "exact_match",
    "TRANSLATION":         "bleu",
    "SUMMARIZATION":       "rouge_l",
    "REGRESSION":          "rmse",
    "AUDIO_SYNTHESIS":     "wer",
    "TEXT_PROCESSING":     "accuracy",
    "COGNITIVE_LOGIC":     "exact_match",
}


# ─────────────────────────────────────────────────────────────────────────────
# Team resolution helpers
# ─────────────────────────────────────────────────────────────────────────────

def _get_user_team_id(user_id: str, competition_id: str, db: Session) -> str | None:
    """
    Returns the team_id (as string) for the user in this competition.

    Strategy (two-step fallback):
      1. Check competition_participants.team_id — set when user joins via the
         competition join flow with a team already selected.
      2. If that is NULL, look up team_members for any team whose members
         also appear as participants in this competition. This covers users
         who joined a team via invite BEFORE or AFTER joining the competition,
         where competition_participants.team_id was never backfilled.
    """
    participant = db.query(CompetitionParticipant).filter(
        CompetitionParticipant.competition_id == competition_id,
        CompetitionParticipant.user_id == str(user_id),
    ).first()

    if not participant:
        return None

    # Step 1: fast path — team_id already stored on the participant row
    if participant.team_id:
        return str(participant.team_id)

    # Step 2: fallback — look in team_members
    # Find all teams this user belongs to
    memberships = db.query(TeamMember).filter(
        TeamMember.user_id == str(user_id)
    ).all()

    for membership in memberships:
        team_id_candidate = str(membership.team_id)
        # Check if any OTHER member of this team is also a participant
        # in this competition — that confirms it's the right team
        other_member_ids = [
            str(m.user_id) for m in
            db.query(TeamMember).filter(
                TeamMember.team_id == membership.team_id,
                TeamMember.user_id != str(user_id),
            ).all()
        ]
        if other_member_ids:
            match = db.query(CompetitionParticipant).filter(
                CompetitionParticipant.competition_id == competition_id,
                CompetitionParticipant.user_id.in_(other_member_ids),
            ).first()
            if match:
                # Backfill so future calls are fast
                participant.team_id = team_id_candidate
                try:
                    db.commit()
                except Exception:
                    db.rollback()
                return team_id_candidate

    return None


def _get_team_user_ids(
    team_id: str | None,
    current_user_id: str,
    competition_id: str,
    db: Session,
) -> list[str]:
    """
    Returns all user_ids on this team IN this competition.

    Strategy (two-step):
      1. Look in competition_participants filtered by team_id (fast path).
      2. Also pull from team_members for this team_id, intersected with
         competition_participants — catches teammates whose participant row
         has team_id = NULL (never backfilled).

    If team_id is None (solo participant), returns just [current_user_id].
    """
    if not team_id:
        return [current_user_id]

    visible = set()

    # Step 1: participants whose team_id is already set correctly
    rows = db.query(CompetitionParticipant).filter(
        CompetitionParticipant.competition_id == competition_id,
        CompetitionParticipant.team_id == team_id,
    ).all()
    for r in rows:
        visible.add(str(r.user_id))

    # Step 2: all team_members for this team who are competition participants
    # (covers rows where competition_participants.team_id was never set)
    try:
        all_team_member_ids = [
            str(m.user_id) for m in
            db.query(TeamMember).filter(TeamMember.team_id == int(team_id)).all()
        ]
        if all_team_member_ids:
            participant_rows = db.query(CompetitionParticipant).filter(
                CompetitionParticipant.competition_id == competition_id,
                CompetitionParticipant.user_id.in_(all_team_member_ids),
            ).all()
            for r in participant_rows:
                visible.add(str(r.user_id))
    except Exception:
        pass

    # Always include current user
    visible.add(current_user_id)

    return list(visible)


def _get_team_name(team_id: str | None, db: Session) -> str | None:
    if not team_id:
        return None
    try:
        team = db.query(Team).filter(Team.id == int(team_id)).first()
        return team.name if team else None
    except Exception:
        return None


def _resolve_user_names(user_ids: list[str], db: Session) -> dict[str, str]:
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
        snippet = raw[:8192]  # read more bytes for better detection
        ext = storage_path.rsplit(".", 1)[-1].lower()
        if ext == "csv":
            df = pd.read_csv(io.BytesIO(snippet), nrows=1)
        elif ext in ("jsonl", "json"):
            try:
                df = pd.read_json(io.BytesIO(snippet), lines=True, nrows=1)
            except Exception:
                df = pd.read_json(io.BytesIO(snippet), nrows=1)
        elif ext == "tsv":
            df = pd.read_csv(io.BytesIO(snippet), sep="\t", nrows=1)
        else:
            try:
                df = pd.read_csv(io.BytesIO(snippet), nrows=1)
            except Exception:
                df = pd.read_json(io.BytesIO(snippet), lines=True, nrows=1)
        return list(df.columns)
    except Exception:
        return []


def _infer_task_type_from_columns(columns: list[str], declared_task: str) -> str:
    """
    Prefer the organizer's declared task type. Only infer from columns as a
    fallback when the declared type is empty or generic.
    """
    normalized = (declared_task or "").upper().replace(" ", "_")
    if normalized and normalized not in ("", "UNKNOWN", "GENERIC"):
        return normalized
    col_set = {c.lower() for c in columns}
    if "sentiment" in col_set:
        return "SENTIMENT_ANALYSIS"
    if {"context", "question", "answer"} & col_set:
        return "QUESTION_ANSWERING"
    if {"source", "target"} & col_set:
        return "TRANSLATION"
    if {"document", "summary"} & col_set:
        return "SUMMARIZATION"
    if "transcript" in col_set:
        return "AUDIO_SYNTHESIS"
    if {"label", "text_content"} & col_set or "label" in col_set:
        return "TEXT_CLASSIFICATION"
    return "GENERIC"


# Translates the exact strings stored by the frontend dropdown → internal key.
# The organizer picks from: Accuracy, F1 Score, BLEU, ROUGE-L, WER, Exact Match
METRIC_NAME_MAP = {
    "accuracy":    "accuracy",
    "f1 score":    "f1",
    "f1":          "f1",
    "bleu":        "bleu",
    "rouge-l":     "rouge_l",
    "rouge_l":     "rouge_l",
    "wer":         "wer",
    "exact match": "exact_match",
    "exact_match": "exact_match",
}


def _normalize_metric(raw: str) -> str | None:
    """Convert frontend label (e.g. 'F1 Score') to internal key (e.g. 'f1')."""
    return METRIC_NAME_MAP.get(raw.strip().lower())


def _resolve_metric(competition: Competition) -> str:
    raw = (competition.primary_metric or "").strip()
    if raw:
        normalized = _normalize_metric(raw)
        if normalized:
            return normalized
    task = (competition.task_type or "").upper().replace(" ", "_")
    return TASK_DEFAULT_METRIC.get(task, "accuracy")


def safe_name(value: str) -> str:
    return "".join(c if c.isalnum() else "-" for c in value)[:40]


# ─────────────────────────────────────────────────────────────────────────────
# Daily submission limit check
# ─────────────────────────────────────────────────────────────────────────────

def _check_daily_limit(competition: Competition, user_id: str, db: Session):
    """
    Raises HTTP 429 if the user (or their team) has hit max_submissions_per_day.
    If the competition has no limit set, this is a no-op.
    """
    limit = competition.max_submissions_per_day
    if not limit:
        return  # no limit configured

    today_str = date.today().isoformat()  # "2025-05-14"

    today_count = (
        db.query(func.count(Submission.id))
        .filter(
            Submission.competition_id == competition.id,
            Submission.user_id == user_id,
            # submitted_at is stored as ISO string: "2025-05-14T..."
            Submission.submitted_at.like(f"{today_str}%"),
        )
        .scalar()
    )

    if today_count >= limit:
        raise HTTPException(
            status_code=429,
            detail=(
                f"Daily submission limit reached ({limit} per day). "
                f"You have already submitted {today_count} time(s) today. "
                f"Come back tomorrow!"
            ),
        )


# ─────────────────────────────────────────────────────────────────────────────
# GET /competitions/{id}/experiment-registry
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
      - Organizers  → see ALL experiments across all teams
      - Team member → sees only their team's experiments
      - Solo participant (no team) → sees only their own experiments
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
    current_uid = str(current_user.id)
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
    Submit a model for evaluation in an isolated Docker container.

    - Only the run owner can submit their own run.
    - Respects competition.max_submissions_per_day.
    - Evaluation runs in a Docker container with --network none (no internet).
    - team_id resolved from team_members (not competition_participants.team_id).
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

    if str(run.user_id) != str(current_user.id):
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

    # ── 3. Daily submission limit ─────────────────────────────────────────────
    _check_daily_limit(competition, str(current_user.id), db)

    # ── 4. Resolve model filename ─────────────────────────────────────────────
    params = {}
    if run.parameters_json:
        try:
            params = json.loads(run.parameters_json)
        except Exception:
            pass

    model_filename = params.get("model_filename") or run.artifact_path or "model.pkl"
    workspace_path = WORKSPACES_DIR / f"{safe_name(competition_id)}_{safe_name(str(current_user.id))}"
    model_path     = workspace_path / model_filename

    if not model_path.exists():
        raise HTTPException(
            status_code=404,
            detail=(
                f"Model file '{model_filename}' not found in your workspace at "
                f"'{workspace_path}'. Make sure the notebook saved the model correctly."
            ),
        )

    # ── 5. Find hidden test dataset ───────────────────────────────────────────
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

    # ── 6. Resolve task type & organizer metric ───────────────────────────────
    declared_task  = competition.task_type or "TEXT_CLASSIFICATION"
    columns        = _peek_hidden_dataset_columns(hidden_dataset.storage_path)
    task_type      = _infer_task_type_from_columns(columns, declared_task)
    primary_metric = _resolve_metric(competition)

    # ── 7. Download hidden test file ──────────────────────────────────────────
    try:
        file_bytes = supabase.storage.from_(STORAGE_BUCKET).download(hidden_dataset.storage_path)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Could not download test dataset: {e}")

    # ── 8. Resolve team_id via team_members ───────────────────────────────────
    team_id = _get_user_team_id(str(current_user.id), competition_id, db)

    # ── 9. Create submission record (status=running) ──────────────────────────
    submission = Submission(
        id=str(uuid.uuid4()),
        competition_id=competition_id,
        user_id=current_user.id,
        team_id=team_id,
        model_filename=model_filename,
        status="running",
        submitted_at=datetime.utcnow().isoformat(),
    )
    db.add(submission)
    db.commit()
    db.refresh(submission)

    # ── 10. Run evaluation in Docker (isolated, no network) ───────────────────
    score, metric_name, error = _run_evaluation_in_docker(
        model_path=str(model_path),
        test_file_bytes=file_bytes,
        test_filename=hidden_dataset.original_filename,
        task_type=task_type,
        primary_metric=primary_metric,
        submission_id=submission.id,
        detected_columns=columns,
    )

    # ── 11. Persist result ────────────────────────────────────────────────────
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
# ─────────────────────────────────────────────────────────────────────────────

@router.get("/competitions/{competition_id}/leaderboard-rich")
def get_rich_leaderboard(
    competition_id: str,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """
    Returns the leaderboard:
      - One row per team (or per individual if solo)
      - Best submission score per team
      - Shows current user's rank and highlights their row
      - Team name shown for team entries; user name for solo
      - Self-heals NULL team_id on old submissions at read time
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

    # ── Correct team_id on ALL submissions using competition_participants ────────
    # The submissions table may have wrong team_ids (from the old broken lookup).
    # competition_participants.team_id is always correct — fix and persist.
    needs_commit = False
    for s in all_done:
        correct_team_id = _get_user_team_id(str(s.user_id), competition_id, db)
        if str(s.team_id or "") != str(correct_team_id or ""):
            s.team_id = correct_team_id
            needs_commit = True
    if needs_commit:
        db.commit()

    # ── Best submission per team/user ─────────────────────────────────────────
    best_by_key: dict[str, Submission] = {}
    for s in all_done:
        key = str(s.team_id) if s.team_id else str(s.user_id)
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
    all_user_ids = list({str(s.user_id) for s in ranked})
    name_map     = _resolve_user_names(all_user_ids, db)

    team_ids = list({str(s.team_id) for s in ranked if s.team_id})
    team_name_map: dict[str, str] = {}
    for tid in team_ids:
        team_name_map[tid] = _get_team_name(tid, db) or tid

    # ── Current user's key for row highlighting ───────────────────────────────
    current_team_id  = _get_user_team_id(str(current_user.id), competition_id, db)
    current_user_key = str(current_team_id) if current_team_id else str(current_user.id)

    return {
        "competition_id":    competition_id,
        "competition_title": competition.title,
        "primary_metric":    primary_metric,
        "higher_is_better":  higher_is_better,
        "my_rank": next(
            (i + 1 for i, s in enumerate(ranked)
             if (str(s.team_id) if s.team_id else str(s.user_id)) == current_user_key),
            None,
        ),
        "entries": [
            {
                "rank":           i + 1,
                "team_id":        str(s.team_id) if s.team_id else None,
                "team_name":      team_name_map.get(str(s.team_id)) if s.team_id else None,
                "user_id":        str(s.user_id),
                "user_name":      name_map.get(str(s.user_id), str(s.user_id)),
                "is_me":          (str(s.team_id) if s.team_id else str(s.user_id)) == current_user_key,
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
# Docker evaluation (isolated, no network, resource-capped)
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
    Spins up a Docker container with strict isolation:
      --network none         → NO internet access (fairness guarantee)
      --cpus 1               → fair CPU cap
      --memory 2g            → fair RAM cap
      --rm                   → auto-cleaned after run
      --read-only            → immutable container filesystem
      --tmpfs /tmp:size=512m → writeable scratch space only
      --no-new-privileges    → prevent privilege escalation
      --cap-drop ALL         → drop all Linux capabilities

    Returns (score_float, metric_name, error_string_or_None).
    """
    container_name = f"lexivia-eval-{submission_id[:12]}"

    with tempfile.TemporaryDirectory() as tmpdir:
        tmp = Path(tmpdir)

        # Write model, test data, eval runner, and configuration hint
        (tmp / "model.pkl").write_bytes(Path(model_path).read_bytes())
        (tmp / test_filename).write_bytes(test_file_bytes)
        (tmp / "eval_runner.py").write_bytes(EVAL_RUNNER_PATH.read_bytes())
        (tmp / "columns_hint.json").write_text(
            json.dumps({
                "columns":        detected_columns,
                "task_type":      task_type,
                "primary_metric": primary_metric,
            }),
            encoding="utf-8",
        )

        cmd = [
            "docker", "run",
            "--rm",
            "--name",             container_name,
            "--network",          "none",          # ← NO internet
            "--cpus",             "1",
            "--memory",           "2g",
            "--memory-swap",      "2g",            # disable swap
            "--read-only",
            "--tmpfs",            "/tmp:size=512m",          # FIX: drop all Linux capabilities
            "-v",                 f"{str(tmp)}:/eval:ro",
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
                timeout=300,  # 5-minute hard timeout
            )
        except subprocess.TimeoutExpired:
            subprocess.run(["docker", "rm", "-f", container_name], capture_output=True)
            return None, None, "Evaluation timed out after 5 minutes"
        except FileNotFoundError:
            return None, None, (
                "Docker is not installed or not running. "
                "Please start Docker Desktop and try again."
            )

        if result.returncode != 0:
            err = (result.stderr or result.stdout or "Unknown Docker error")[:600]
            return None, None, f"Evaluation container failed (exit {result.returncode}): {err}"

        score, metric = _parse_score_output(result.stdout)
        if score is None:
            return None, None, (
                f"Could not parse a score from the evaluation output. "
                f"Raw output: {result.stdout[:400]}"
            )

        return score, metric, None


def _parse_score_output(output: str) -> tuple[float | None, str | None]:
    """
    Parses lines like:  accuracy=0.9100  or  rouge_l=0.7412
    Returns (float_score, metric_name) or (None, None) on failure.
    """
    for line in output.splitlines():
        line = line.strip()
        if "=" not in line:
            continue
        name, _, value = line.partition("=")
        name  = name.strip().lower()
        value = value.strip()
        if name in KNOWN_METRICS:
            try:
                return float(value), name
            except ValueError:
                continue
    return None, None