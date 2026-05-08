# routes/submissions.py
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
)
from supabase_client import supabase
from .utils import get_db, get_current_user

router = APIRouter(tags=["submissions"])

WORKSPACES_DIR = Path("./workspaces").resolve()
EVAL_RUNNER_PATH = Path(__file__).parent / "eval_runner.py"
STORAGE_BUCKET = "competition-datasets"


def safe_name(value: str):
    return "".join(c if c.isalnum() else "-" for c in value)[:40]


# ─────────────────────────────────────────────────────────────────────────────
# POST /competitions/{id}/submit
# The user says "submit this model file from my workspace"
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
    
    Steps:
    1. Check user is a participant
    2. Find the model file in their workspace
    3. Find the hidden test dataset in Supabase Storage
    4. Download the test dataset to a temp folder
    5. Run evaluation in a fresh Docker container
    6. Save score to submissions table
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
    model_path = workspace_path / model_filename

    if not model_path.exists():
        raise HTTPException(
            status_code=404,
            detail=f"Model file '{model_filename}' not found in your workspace. "
                   f"Make sure your training script saves the model as '{model_filename}'."
        )

    # ── 3. Find hidden test dataset ───────────────────────────────────────────
    hidden_dataset = db.query(CompetitionDataset).filter(
        CompetitionDataset.competition_id == competition_id,
        CompetitionDataset.dataset_type == "hidden_test",
    ).order_by(CompetitionDataset.uploaded_at.desc()).first()

    if not hidden_dataset:
        raise HTTPException(
            status_code=404,
            detail="No hidden test dataset uploaded yet. Ask the organizer to upload one."
        )

    # ── 4. Create submission record (status=pending) ──────────────────────────
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

    # ── 5. Download hidden test file from Supabase Storage ────────────────────
    try:
        file_bytes = supabase.storage.from_(STORAGE_BUCKET).download(hidden_dataset.storage_path)
    except Exception as e:
        submission.status = "failed"
        submission.error_message = f"Could not download test dataset: {e}"
        db.commit()
        raise HTTPException(status_code=500, detail=f"Could not download test dataset: {e}")

    # ── 6. Run evaluation in Docker ───────────────────────────────────────────
    score, metric_name, error = run_evaluation_in_docker(
        model_path=str(model_path),
        test_file_bytes=file_bytes,
        test_filename=hidden_dataset.original_filename,
        task_type=competition.task_type or "TEXT_CLASSIFICATION",
        submission_id=submission.id,
    )

    # ── 7. Save result ────────────────────────────────────────────────────────
    if error:
        submission.status = "failed"
        submission.error_message = error
    else:
        submission.status = "done"
        submission.score = score
        submission.metric_name = metric_name
        submission.evaluated_at = datetime.utcnow().isoformat()

    db.commit()
    db.refresh(submission)

    return {
        "submission_id": submission.id,
        "status": submission.status,
        "score": submission.score,
        "metric_name": submission.metric_name,
        "error": submission.error_message,
    }


# ─────────────────────────────────────────────────────────────────────────────
# The Docker evaluation function
# ─────────────────────────────────────────────────────────────────────────────

def run_evaluation_in_docker(
    model_path: str,
    test_file_bytes: bytes,
    test_filename: str,
    task_type: str,
    submission_id: str,
):
    """
    Creates a temporary folder, copies model + test data + eval script into it,
    spins a Docker container, runs eval_runner.py, reads the score.
    Returns (score_float, metric_name_str, error_str_or_None)
    """

    container_name = f"lexivia-eval-{submission_id[:12]}"

    with tempfile.TemporaryDirectory() as tmpdir:
        tmpdir = Path(tmpdir)

        # Copy model file into temp dir
        model_dest = tmpdir / "model.pkl"
        model_dest.write_bytes(Path(model_path).read_bytes())

        # Write test data into temp dir
        test_dest = tmpdir / test_filename
        test_dest.write_bytes(test_file_bytes)

        # Copy eval_runner.py into temp dir
        eval_dest = tmpdir / "eval_runner.py"
        eval_dest.write_bytes(EVAL_RUNNER_PATH.read_bytes())

        # Build docker run command
        # --network none  = no internet access (prevents cheating)
        # --cpus 1        = fair resource limit for evaluation
        # --memory 2g     = fair memory limit
        # --rm            = auto-delete container when done
        # -v              = mount our temp folder into the container
        cmd = [
            "docker", "run",
            "--rm",
            "--name", container_name,
            "--network", "none",
            "--cpus", "1",
            "--memory", "2g",
            "-v", f"{str(tmpdir)}:/eval",
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
                timeout=300,  # 5 minutes max
            )
        except subprocess.TimeoutExpired:
            # Force remove container if it's still running
            subprocess.run(["docker", "rm", "-f", container_name], capture_output=True)
            return None, None, "Evaluation timed out after 5 minutes"
        except FileNotFoundError:
            return None, None, "Docker is not installed or not running"

        if result.returncode != 0:
            error = result.stderr or result.stdout or "Unknown error"
            return None, None, f"Evaluation failed: {error[:500]}"

        # Parse score from stdout — format: "accuracy=0.91" or "f1=0.87"
        score, metric_name = parse_score_output(result.stdout)
        if score is None:
            return None, None, f"Could not parse score from output: {result.stdout[:200]}"

        return score, metric_name, None


def parse_score_output(output: str):
    """Reads lines like 'accuracy=0.91' or 'f1=0.87' and returns (float, str)"""
    KNOWN_METRICS = {"accuracy", "f1", "exact_match", "precision", "recall", "auc", "mse", "mae", "rmse"}
    for line in output.splitlines():
        line = line.strip()
        if "=" in line:
            name, value = line.split("=", 1)
            name = name.strip().lower()
            value = value.strip()
            if name in KNOWN_METRICS:
                try:
                    return float(value), name
                except ValueError:
                    continue
    return None, None


# ─────────────────────────────────────────────────────────────────────────────
# GET /competitions/{id}/submissions  — list my submissions
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
            "id": s.id,
            "model_filename": s.model_filename,
            "status": s.status,
            "score": s.score,
            "metric_name": s.metric_name,
            "error_message": s.error_message,
            "submitted_at": s.submitted_at,
            "evaluated_at": s.evaluated_at,
        }
        for s in submissions
    ]


# ─────────────────────────────────────────────────────────────────────────────
# GET /competitions/{id}/leaderboard  — all teams ranked by best score
# ─────────────────────────────────────────────────────────────────────────────

@router.get("/competitions/{competition_id}/leaderboard")
def get_leaderboard(
    competition_id: str,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    # Get the best score per user (highest score = best)
    all_done = db.query(Submission).filter(
        Submission.competition_id == competition_id,
        Submission.status == "done",
    ).all()

    # Group by user_id, keep best score
    best_by_user = {}
    for s in all_done:
        if s.user_id not in best_by_user:
            best_by_user[s.user_id] = s
        else:
            if (s.score or 0) > (best_by_user[s.user_id].score or 0):
                best_by_user[s.user_id] = s

    # Sort by score descending
    ranked = sorted(best_by_user.values(), key=lambda s: s.score or 0, reverse=True)

    return [
        {
            "rank": i + 1,
            "user_id": s.user_id,
            "score": s.score,
            "metric_name": s.metric_name,
            "submission_id": s.id,
            "submitted_at": s.submitted_at,
        }
        for i, s in enumerate(ranked)
    ]