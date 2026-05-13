"""
routes/experiment_registry.py

New endpoints for the Experiment Registry page.
Keeps all existing experiments.py logic untouched.

Endpoints:
  GET  /competitions/{id}/experiment-registry          — all runs for this competition
                                                         across ALL users, with user names
  POST /competitions/{id}/experiment-registry/submit   — pick an experiment run, evaluate
                                                         against hidden dataset in Docker,
                                                         save to submissions table
  GET  /competitions/{id}/leaderboard                  — already in submissions.py,
                                                         but we add user name resolution here
                                                         as a richer alternative endpoint
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
    UserProfile,          # make sure this is exported from models.py
)
from supabase_client import supabase
from .utils import get_db, get_current_user

router = APIRouter(tags=["experiment-registry"])

WORKSPACES_DIR     = Path("./workspaces").resolve()
EVAL_RUNNER_PATH   = Path(__file__).parent / "eval_runner.py"
STORAGE_BUCKET     = "competition-datasets"


# ─────────────────────────────────────────────────────────────────────────────
# Helpers
# ─────────────────────────────────────────────────────────────────────────────

def safe_name(value: str) -> str:
    return "".join(c if c.isalnum() else "-" for c in value)[:40]


def _resolve_user_names(user_ids: list[str], db: Session) -> dict[str, str]:
    """
    Returns {user_id: display_name} for a list of user IDs.
    Falls back to user_id itself when no profile row exists.
    """
    if not user_ids:
        return {}
    profiles = (
        db.query(UserProfile)
        .filter(UserProfile.user_id.in_(user_ids))
        .all()
    )
    mapping = {}
    for p in profiles:
        display = p.full_name or p.username or p.user_id
        mapping[p.user_id] = display
    # fill in any missing ids
    for uid in user_ids:
        if uid not in mapping:
            mapping[uid] = uid
    return mapping


def _peek_hidden_dataset_columns(storage_path: str) -> list[str]:
    """
    Downloads just the first ~4 KB of the hidden dataset from Supabase
    and returns the column names.  Works for CSV and JSONL.
    Returns [] on any failure so callers can fall back gracefully.
    """
    import io
    import pandas as pd

    try:
        raw = supabase.storage.from_(STORAGE_BUCKET).download(storage_path)
    except Exception:
        return []

    if isinstance(raw, str):
        raw = raw.encode("utf-8")

    # Only read first 4 KB to get header
    snippet = raw[:4096]
    ext = storage_path.rsplit(".", 1)[-1].lower()

    try:
        if ext == "csv":
            df = pd.read_csv(io.BytesIO(snippet), nrows=1)
        elif ext == "jsonl":
            df = pd.read_json(io.BytesIO(snippet), lines=True, nrows=1)
        else:
            # Try CSV first, then JSONL
            try:
                df = pd.read_csv(io.BytesIO(snippet), nrows=1)
            except Exception:
                df = pd.read_json(io.BytesIO(snippet), lines=True, nrows=1)
        return list(df.columns)
    except Exception:
        return []


def _infer_task_type_from_columns(columns: list[str], declared_task: str) -> str:
    """
    If the competition task_type is unknown/generic, try to infer from column names.
    Otherwise trust the declared value.
    """
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


# ─────────────────────────────────────────────────────────────────────────────
# GET /competitions/{id}/experiment-registry
# Returns every ExperimentRun for this competition (all users) + user names.
# ─────────────────────────────────────────────────────────────────────────────

@router.get("/competitions/{competition_id}/experiment-registry")
def list_all_experiments(
    competition_id: str,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """
    Returns all experiment runs for this competition across all users.
    Each row includes the submitter's display name.

    Access:
      - Organizers  → see everyone
      - Participants → see everyone (transparency / fairness tracking)
    """
    # Auth: must be participant or organizer
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

    runs = (
        db.query(ExperimentRun)
        .filter(ExperimentRun.competition_id == competition_id)
        .order_by(ExperimentRun.created_at.desc())
        .all()
    )

    # Batch-resolve user names
    user_ids   = list({r.user_id for r in runs})
    name_map   = _resolve_user_names(user_ids, db)
    current_uid = current_user.id

    result = []
    for r in runs:
        params = {}
        if r.parameters_json:
            try:
                params = json.loads(r.parameters_json)
            except Exception:
                params = {}

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
            # Flattened params for display
            "model_filename":  params.get("model_filename") or r.artifact_path or "model.pkl",
            "hyperparameters": params.get("hyperparameters") or {},
            "dataset_version": params.get("dataset_version") or "",
            "resource_tier":   params.get("resource_tier") or "",
            "active_file":     params.get("active_file") or "",
        })

    return {
        "competition_id":   competition_id,
        "competition_title": competition.title,
        "task_type":        competition.task_type or "",
        "total":            len(result),
        "experiments":      result,
    }


# ─────────────────────────────────────────────────────────────────────────────
# POST /competitions/{id}/experiment-registry/submit
#
# Body: { "experiment_run_id": "<uuid>" }
#
# Steps:
#   1. Verify the run belongs to the current user
#   2. Find model file in their workspace
#   3. Find hidden test dataset in Supabase Storage
#   4. Peek at column names to confirm / infer task type
#   5. Run evaluation in isolated Docker container (no network)
#   6. Save result to submissions table
# ─────────────────────────────────────────────────────────────────────────────

@router.post("/competitions/{competition_id}/experiment-registry/submit")
def submit_from_experiment(
    competition_id: str,
    body: dict,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """
    Submit a model that was saved as an ExperimentRun.
    The model .pkl is read from the user's local workspace folder.
    Evaluation runs in an offline Docker container against the hidden dataset.
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

    # ── 2. Resolve competition & access ──────────────────────────────────────
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

    # ── 3. Resolve model filename from experiment params ──────────────────────
    params = {}
    if run.parameters_json:
        try:
            params = json.loads(run.parameters_json)
        except Exception:
            pass

    model_filename = (
        params.get("model_filename")
        or run.artifact_path
        or "model.pkl"
    )

    workspace_path = WORKSPACES_DIR / f"{safe_name(competition_id)}_{safe_name(current_user.id)}"
    model_path     = workspace_path / model_filename

    if not model_path.exists():
        raise HTTPException(
            status_code=404,
            detail=(
                f"Model file '{model_filename}' not found in your workspace. "
                f"Make sure the experiment was saved with the correct model filename "
                f"and the file still exists at: {model_path}"
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
            detail=(
                "No hidden test dataset found for this competition. "
                "The organizer must upload a hidden_test dataset before submissions can be evaluated."
            ),
        )

    # ── 5. Peek at hidden dataset columns → infer task type ──────────────────
    declared_task = competition.task_type or "TEXT_CLASSIFICATION"
    columns       = _peek_hidden_dataset_columns(hidden_dataset.storage_path)
    task_type     = _infer_task_type_from_columns(columns, declared_task)

    # ── 6. Download hidden test file ──────────────────────────────────────────
    try:
        file_bytes = supabase.storage.from_(STORAGE_BUCKET).download(hidden_dataset.storage_path)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Could not download test dataset: {e}")

    # ── 7. Create submission record (status=running) ──────────────────────────
    submission = Submission(
        id=str(uuid.uuid4()),
        competition_id=competition_id,
        user_id=current_user.id,
        model_filename=model_filename,
        status="running",
        submitted_at=datetime.utcnow().isoformat(),
    )
    db.add(submission)
    db.commit()
    db.refresh(submission)

    # ── 8. Run evaluation in Docker ───────────────────────────────────────────
    score, metric_name, error = _run_evaluation_in_docker(
        model_path=str(model_path),
        test_file_bytes=file_bytes,
        test_filename=hidden_dataset.original_filename,
        task_type=task_type,
        submission_id=submission.id,
        detected_columns=columns,
    )

    # ── 9. Persist result ─────────────────────────────────────────────────────
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
        "submission_id":    submission.id,
        "experiment_run_id": run_id,
        "experiment_name":  run.name,
        "model_filename":   model_filename,
        "task_type_used":   task_type,
        "dataset_columns":  columns,
        "status":           submission.status,
        "score":            submission.score,
        "metric_name":      submission.metric_name,
        "error":            submission.error_message,
        "submitted_at":     submission.submitted_at,
        "evaluated_at":     submission.evaluated_at,
    }


# ─────────────────────────────────────────────────────────────────────────────
# GET /competitions/{id}/leaderboard-rich
# Like leaderboard in submissions.py but with user names and experiment names.
# ─────────────────────────────────────────────────────────────────────────────

@router.get("/competitions/{competition_id}/leaderboard-rich")
def get_rich_leaderboard(
    competition_id: str,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """
    Returns the leaderboard for a competition:
      - One row per user (best submission score)
      - Includes display name
      - Marks the current user's own row
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

    all_done = (
        db.query(Submission)
        .filter(
            Submission.competition_id == competition_id,
            Submission.status == "done",
        )
        .all()
    )

    # Best score per user
    best_by_user: dict[str, Submission] = {}
    for s in all_done:
        if s.user_id not in best_by_user:
            best_by_user[s.user_id] = s
        else:
            if (s.score or 0) > (best_by_user[s.user_id].score or 0):
                best_by_user[s.user_id] = s

    ranked = sorted(best_by_user.values(), key=lambda s: s.score or 0, reverse=True)

    user_ids = [s.user_id for s in ranked]
    name_map = _resolve_user_names(user_ids, db)

    return [
        {
            "rank":         i + 1,
            "user_id":      s.user_id,
            "user_name":    name_map.get(s.user_id, s.user_id),
            "is_me":        s.user_id == current_user.id,
            "score":        float(s.score) if s.score is not None else None,
            "metric_name":  s.metric_name,
            "submission_id": s.id,
            "model_filename": s.model_filename,
            "submitted_at": s.submitted_at,
            "evaluated_at": s.evaluated_at,
        }
        for i, s in enumerate(ranked)
    ]


# ─────────────────────────────────────────────────────────────────────────────
# Docker evaluation  (self-contained, offline, resource-limited)
# ─────────────────────────────────────────────────────────────────────────────

def _run_evaluation_in_docker(
    model_path: str,
    test_file_bytes: bytes,
    test_filename: str,
    task_type: str,
    submission_id: str,
    detected_columns: list[str],
) -> tuple[float | None, str | None, str | None]:
    """
    Spins up a Docker container with:
      --network none   → no internet access (prevents cheating / data leakage)
      --cpus 1         → fair CPU quota per evaluation job
      --memory 2g      → fair RAM quota per evaluation job
      --rm             → auto-cleaned after run

    Copies model.pkl + hidden test file + eval_runner.py into a temp dir,
    mounts it read-only into the container, runs eval_runner.py,
    and parses the printed score.

    Returns (score_float, metric_name, error_string_or_None).
    """
    container_name = f"lexivia-eval-{submission_id[:12]}"

    with tempfile.TemporaryDirectory() as tmpdir:
        tmp = Path(tmpdir)

        # Copy model
        (tmp / "model.pkl").write_bytes(Path(model_path).read_bytes())

        # Write hidden test data
        (tmp / test_filename).write_bytes(test_file_bytes)

        # Write detected columns hint so eval_runner can adapt
        (tmp / "columns_hint.json").write_text(
            json.dumps({"columns": detected_columns, "task_type": task_type}),
            encoding="utf-8",
        )

        # Copy eval_runner
        (tmp / "eval_runner.py").write_bytes(EVAL_RUNNER_PATH.read_bytes())

        cmd = [
            "docker", "run",
            "--rm",
            "--name",    container_name,
            "--network", "none",          # ← no internet — data-leakage prevention
            "--cpus",    "1",             # ← CPU quota
            "--memory",  "2g",            # ← RAM quota
            "-v",        f"{str(tmp)}:/eval:ro",   # read-only mount
            # writable /tmp so model can be loaded in-process
            "--tmpfs",   "/tmp:size=512m",
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
                timeout=300,  # 5-minute wall-clock limit
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
                f"Could not parse a score from the evaluation output. "
                f"Raw output: {result.stdout[:300]}"
            )

        return score, metric, None


def _parse_score_output(output: str) -> tuple[float | None, str | None]:
    """Parses lines like  accuracy=0.91  or  f1=0.87"""
    KNOWN = {
        "accuracy", "f1", "exact_match", "precision",
        "recall", "auc", "mse", "mae", "rmse", "bleu", "rouge_l", "wer",
    }
    for line in output.splitlines():
        line = line.strip()
        if "=" in line:
            name, value = line.split("=", 1)
            name  = name.strip().lower()
            value = value.strip()
            if name in KNOWN:
                try:
                    return float(value), name
                except ValueError:
                    continue
    return None, None