# routes/submissions.py
#
# CHANGES vs previous version:
#  - submit_model: records team_id on the submission row
#  - submit_model: passes primary_metric to the Docker evaluator
#  - leaderboard: groups by team (best score per team, not per user)
#  - leaderboard: sorts correctly for lower-is-better metrics

import os
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
    ExperimentWorkspace,
    Submission,
    UserProfile,
)
from supabase_client import supabase
from .utils import get_db, get_current_user

router = APIRouter(tags=["submissions"])

WORKSPACES_DIR   = Path("./workspaces").resolve()
EVAL_RUNNER_PATH = Path(__file__).parent / "eval_runner.py"
STORAGE_BUCKET   = "competition-datasets"

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
}


def safe_name(value: str):
    return "".join(c if c.isalnum() else "-" for c in value)[:40]


def _resolve_metric(competition: Competition) -> str:
    primary = (competition.primary_metric or "").strip().lower()
    if primary and primary in KNOWN_METRICS:
        return primary
    task = (competition.task_type or "").upper()
    return TASK_DEFAULT_METRIC.get(task, "accuracy")


def _get_user_team_id(user_id: str, competition_id: str, db: Session) -> str | None:
    """
    Returns the team_id (as str) for the user in this competition, or None.

    Two-phase lookup:
      1. competition_participants.team_id (fast path — already stamped)
      2. team_members cross-referenced with competition participants (covers the
         common case where team_id was never written to the participant row)
    """
    from models_teams import TeamMember  # local import to avoid circular deps

    # Phase 1 — already stored
    participant = db.query(CompetitionParticipant).filter(
        CompetitionParticipant.competition_id == competition_id,
        CompetitionParticipant.user_id == user_id,
    ).first()
    if participant and participant.team_id:
        return str(participant.team_id)

    # Phase 2 — look through team_members
    try:
        user_teams = db.query(TeamMember).filter(
            TeamMember.user_id == str(user_id),
        ).all()
        for tm in user_teams:
            teammate_ids = [
                str(m.user_id)
                for m in db.query(TeamMember).filter(TeamMember.team_id == tm.team_id).all()
            ]
            overlap = db.query(CompetitionParticipant).filter(
                CompetitionParticipant.competition_id == competition_id,
                CompetitionParticipant.user_id.in_(teammate_ids),
            ).first()
            if overlap:
                return str(tm.team_id)
    except Exception:
        pass

    return None


# ─────────────────────────────────────────────────────────────────────────────
# POST /competitions/{id}/submit
# ─────────────────────────────────────────────────────────────────────────────

@router.post("/competitions/{competition_id}/submit")
def submit_model(
    competition_id: str,
    body: dict,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """
    body = { "model_filename": "model.pkl" }
    """

    # ── 1. Check participation ────────────────────────────────────────────────
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

    # ── 2. Find model file in workspace ──────────────────────────────────────
    model_filename = body.get("model_filename", "model.pkl")
    workspace_path = WORKSPACES_DIR / f"{safe_name(competition_id)}_{safe_name(current_user.id)}"
    model_path     = workspace_path / model_filename

    if not model_path.exists():
        raise HTTPException(
            status_code=404,
            detail=f"Model file '{model_filename}' not found in your workspace.",
        )

    # ── 3. Find hidden test dataset ───────────────────────────────────────────
    hidden_dataset = db.query(CompetitionDataset).filter(
        CompetitionDataset.competition_id == competition_id,
        CompetitionDataset.dataset_type == "hidden_test",
    ).order_by(CompetitionDataset.uploaded_at.desc()).first()

    if not hidden_dataset:
        raise HTTPException(
            status_code=404,
            detail="No hidden test dataset uploaded yet.",
        )

    # ── 4. Resolve metric & team ──────────────────────────────────────────────
    primary_metric = _resolve_metric(competition)
    team_id        = _get_user_team_id(current_user.id, competition_id, db)

    # ── 5. Create submission record ───────────────────────────────────────────
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

    # ── 6. Download hidden test file ──────────────────────────────────────────
    try:
        file_bytes = supabase.storage.from_(STORAGE_BUCKET).download(hidden_dataset.storage_path)
    except Exception as e:
        submission.status = "failed"
        submission.error_message = f"Could not download test dataset: {e}"
        db.commit()
        raise HTTPException(status_code=500, detail=f"Could not download test dataset: {e}")

    # ── 7. Run evaluation in Docker ───────────────────────────────────────────
    score, metric_name, error = run_evaluation_in_docker(
        model_path=str(model_path),
        test_file_bytes=file_bytes,
        test_filename=hidden_dataset.original_filename,
        task_type=competition.task_type or "TEXT_CLASSIFICATION",
        primary_metric=primary_metric,
        submission_id=submission.id,
    )

    # ── 8. Save result ────────────────────────────────────────────────────────
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
        "submission_id": submission.id,
        "status":        submission.status,
        "score":         submission.score,
        "metric_name":   submission.metric_name,
        "error":         submission.error_message,
    }


# ─────────────────────────────────────────────────────────────────────────────
# Docker evaluation
#
# NOTE ON KUBERNETES:
# When running in production with many concurrent teams, replace subprocess.run()
# with a Kubernetes Job submission via the `kubernetes` Python client:
#
#   from kubernetes import client, config
#   config.load_incluster_config()   # or load_kube_config() locally
#   batch_v1 = client.BatchV1Api()
#   job = build_eval_job_manifest(submission_id, model_path, ...)
#   batch_v1.create_namespaced_job("default", job)
#   # Then poll job status or use a webhook to update submission.status
#
# K8s advantages over subprocess for production:
#   - Auto-scheduling across nodes (many teams can submit simultaneously)
#   - Resource quotas enforced by K8s, not Docker flags
#   - Job retry on node failure
#   - Full audit trail in K8s events
#
# For local development, Docker subprocess is correct and sufficient.
# ─────────────────────────────────────────────────────────────────────────────

def run_evaluation_in_docker(
    model_path: str,
    test_file_bytes: bytes,
    test_filename: str,
    task_type: str,
    primary_metric: str,
    submission_id: str,
):
    """
    Returns (score_float, metric_name_str, error_str_or_None)
    """
    import json
    container_name = f"lexivia-eval-{submission_id[:12]}"

    with tempfile.TemporaryDirectory() as tmpdir:
        tmpdir = Path(tmpdir)

        (tmpdir / "model.pkl").write_bytes(Path(model_path).read_bytes())
        (tmpdir / test_filename).write_bytes(test_file_bytes)
        (tmpdir / "eval_runner.py").write_bytes(EVAL_RUNNER_PATH.read_bytes())

        # Write hint including the organizer's chosen metric
        (tmpdir / "columns_hint.json").write_text(
            json.dumps({
                "task_type":      task_type,
                "primary_metric": primary_metric,
            }),
            encoding="utf-8",
        )

        cmd = [
            "docker", "run",
            "--rm",
            "--name",    container_name,
            "--network", "none",
            "--cpus",    "1",
            "--memory",  "2g",
            "--read-only",
            "--tmpfs",   "/tmp:size=512m",
            "-v",        f"{str(tmpdir)}:/eval:ro",
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
            return None, None, "Docker is not installed or not running"

        if result.returncode != 0:
            error = result.stderr or result.stdout or "Unknown error"
            return None, None, f"Evaluation failed: {error[:500]}"

        score, metric_name = parse_score_output(result.stdout)
        if score is None:
            return None, None, f"Could not parse score from output: {result.stdout[:200]}"

        return score, metric_name, None


def parse_score_output(output: str):
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


# ─────────────────────────────────────────────────────────────────────────────
# GET /competitions/{id}/submissions
# ─────────────────────────────────────────────────────────────────────────────

@router.get("/competitions/{competition_id}/submissions")
def list_my_submissions(
    competition_id: str,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    submissions = db.query(Submission).filter(
        Submission.competition_id == competition_id,
        Submission.user_id == current_user.id,
    ).order_by(Submission.submitted_at.desc()).all()

    return [
        {
            "id":              s.id,
            "model_filename":  s.model_filename,
            "team_id":         s.team_id,
            "status":          s.status,
            "score":           s.score,
            "metric_name":     s.metric_name,
            "error_message":   s.error_message,
            "submitted_at":    s.submitted_at,
            "evaluated_at":    s.evaluated_at,
        }
        for s in submissions
    ]


# ─────────────────────────────────────────────────────────────────────────────
# GET /competitions/{id}/leaderboard — simple leaderboard (team-aware)
# ─────────────────────────────────────────────────────────────────────────────

@router.get("/competitions/{competition_id}/leaderboard")
def get_leaderboard(
    competition_id: str,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    competition = db.query(Competition).filter(Competition.id == competition_id).first()
    if not competition:
        raise HTTPException(status_code=404, detail="Competition not found")

    primary_metric   = _resolve_metric(competition)
    higher_is_better = METRIC_HIGHER_IS_BETTER.get(primary_metric, True)

    all_done = db.query(Submission).filter(
        Submission.competition_id == competition_id,
        Submission.status == "done",
    ).all()

    # Best score per team (or user if no team)
    # Also retroactively resolve team_id for old submissions stored without it
    best_by_key: dict[str, Submission] = {}
    for s in all_done:
        effective_team_id = s.team_id or _get_user_team_id(s.user_id, competition_id, db)
        key = effective_team_id if effective_team_id else s.user_id
        if key not in best_by_key:
            best_by_key[key] = s
        else:
            existing = best_by_key[key].score or 0
            new      = s.score or 0
            if higher_is_better and new > existing:
                best_by_key[key] = s
            elif not higher_is_better and new < existing:
                best_by_key[key] = s

    ranked = sorted(
        best_by_key.values(),
        key=lambda s: s.score or 0,
        reverse=higher_is_better,
    )

    return [
        {
            "rank":          i + 1,
            "user_id":       s.user_id,
            "team_id":       s.team_id,
            "score":         s.score,
            "metric_name":   s.metric_name,
            "submission_id": s.id,
            "submitted_at":  s.submitted_at,
        }
        for i, s in enumerate(ranked)
    ]