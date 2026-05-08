"""
routes/experiments.py

Full implementation — workspace, file management, code execution,
experiment tracking, and dataset bridge (validated data → Docker container).

Key endpoints:
  GET    /competitions/{id}/workspace                  — get or create workspace record
  POST   /competitions/{id}/workspace/launch           — spin up Docker container
  POST   /competitions/{id}/workspace/stop             — stop + remove container
  POST   /competitions/{id}/workspace/jupyter          — alias: returns notebook_url
  GET    /competitions/{id}/workspace/files            — list workspace files
  GET    /competitions/{id}/workspace/file             — read one file
  POST   /competitions/{id}/workspace/file             — save one file
  POST   /competitions/{id}/workspace/upload           — upload a file into workspace
  GET    /competitions/{id}/workspace/download         — download a file
  POST   /competitions/{id}/workspace/run              — execute .py in container
  POST   /competitions/{id}/workspace/push             — fake-git commit snapshot
  GET    /competitions/{id}/workspace/pushes           — list commit history
  POST   /competitions/{id}/workspace/load-dataset     — export validated samples into
                                                         container as dataset.csv/json
  GET    /competitions/{id}/experiments                — list saved runs
  POST   /competitions/{id}/experiments                — save a run
"""

import csv
from importlib.resources import path
import io
import json
from random import random
import subprocess
import uuid
import os
import socket
from datetime import datetime
from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from fastapi.responses import FileResponse, StreamingResponse
from sqlalchemy.orm import Session
from supabase_client import supabase
from models import CompetitionDataset

from models import (
    Competition,
    CompetitionParticipant,
    CompetitionOrganizer,
    DataSample,
    ExperimentWorkspace,
    ExperimentRun,
)
from .utils import get_db, get_current_user

router = APIRouter(tags=["experiments"])

WORKSPACES_DIR = Path("./workspaces").resolve()
DOCKER_IMAGE = "jupyter/scipy-notebook:python-3.10"


# ─────────────────────────────────────────────────────────────────────────────
# Access helpers
# ─────────────────────────────────────────────────────────────────────────────

def require_competition_access(competition_id: str, user_id: str, db: Session):
    competition = db.query(Competition).filter(Competition.id == competition_id).first()
    if not competition:
        raise HTTPException(status_code=404, detail="Competition not found")

    is_organizer = db.query(CompetitionOrganizer).filter(
        CompetitionOrganizer.competition_id == competition_id,
        CompetitionOrganizer.user_id == user_id,
    ).first()

    is_participant = db.query(CompetitionParticipant).filter(
        CompetitionParticipant.competition_id == competition_id,
        CompetitionParticipant.user_id == user_id,
    ).first()

    if not is_organizer and not is_participant:
        raise HTTPException(
            status_code=403,
            detail="Join the competition before launching a workspace",
        )

    return competition


# ─────────────────────────────────────────────────────────────────────────────
# Path / filename helpers
# ─────────────────────────────────────────────────────────────────────────────

def safe_name(value: str) -> str:
    return "".join(c if c.isalnum() else "-" for c in value)[:40]


def get_workspace_path(competition_id: str, user_id: str) -> Path:
    path = WORKSPACES_DIR / f"{safe_name(competition_id)}_{safe_name(user_id)}"
    path.mkdir(parents=True, exist_ok=True)

    defaults = {
    "main_modeling.py": (
        "import pandas as pd\n\n"
        "train_df = pd.read_csv('/home/jovyan/work/data/train.csv')\n"
        "test_df = pd.read_csv('/home/jovyan/work/data/test.csv')\n\n"
        "print(train_df.head())\n"
        "print(test_df.head())\n"
    ),

    "utils.py": "# Helper functions\n",

    "requirements.txt": (
        "numpy\n"
        "pandas\n"
        "scikit-learn\n"
        "matplotlib\n"
        "torch\n"
        "transformers\n"
    ),
}

    for filename, content in defaults.items():
        fp = path / filename
        if not fp.exists():
            fp.write_text(content, encoding="utf-8")

    # Ensure data/ subdirectory exists inside the workspace
    (path / "data").mkdir(exist_ok=True)

    return path


def safe_file_path(base_path: Path, filename: str) -> Path:
    if not filename or ".." in filename or filename.startswith("/") or filename.startswith("\\"):
        raise HTTPException(status_code=400, detail="Invalid filename")

    path = (base_path / filename).resolve()

    if not str(path).startswith(str(base_path.resolve())):
        raise HTTPException(status_code=400, detail="Invalid filename")

    return path


# ─────────────────────────────────────────────────────────────────────────────
# Docker helpers
# ─────────────────────────────────────────────────────────────────────────────

def get_free_port() -> int:
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        s.bind(("127.0.0.1", 0))
        return s.getsockname()[1]


def run_cmd(cmd, timeout=600):
    try:
        return subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            timeout=timeout,
            shell=False,
        )
    except subprocess.TimeoutExpired:
        raise HTTPException(
            status_code=500,
            detail=(
                "Docker command timed out. The image may still be downloading. "
                "Run: docker pull jupyter/scipy-notebook:python-3.10"
            ),
        )
    except FileNotFoundError:
        raise HTTPException(
            status_code=500,
            detail="Docker is not installed or Docker Desktop is not running.",
        )


def docker_container_exists(container_name: str) -> bool:
    result = run_cmd([
        "docker", "ps", "-a",
        "--filter", f"name=^{container_name}$",
        "--format", "{{.Names}}",
    ])
    return container_name in result.stdout.splitlines()


def docker_container_running(container_name: str) -> bool:
    result = run_cmd([
        "docker", "ps",
        "--filter", f"name=^{container_name}$",
        "--format", "{{.Names}}",
    ])
    return container_name in result.stdout.splitlines()


def stop_and_remove_container(container_name: str):
    if docker_container_exists(container_name):
        run_cmd(["docker", "rm", "-f", container_name])

TIER_LIMITS = {
    "CPU Basic": {"cpus": "2", "memory": "4g"},
    "GPU Basic": {"cpus": "4", "memory": "16g"},
    "GPU Pro":   {"cpus": "8", "memory": "32g"},
}

def apply_resource_limits(workspace, tier: str):
    tiers = {
        "CPU Basic": ("2 cores", "4 GB",  "No GPU",          "10 GB"),
        "GPU Basic": ("4 cores", "16 GB", "1 shared GPU",    "40 GB"),
        "GPU Pro":   ("8 cores", "32 GB", "1 dedicated GPU", "80 GB"),
    }
    cpu, ram, gpu, disk = tiers.get(tier, tiers["GPU Basic"])
    workspace.cpu_limit     = cpu
    workspace.ram_limit     = ram
    workspace.gpu_limit     = gpu
    workspace.storage_limit = disk


# ─────────────────────────────────────────────────────────────────────────────
# Workspace DB helpers
# ─────────────────────────────────────────────────────────────────────────────

def get_or_create_workspace(competition_id: str, user_id: str, competition, db: Session):
    workspace = db.query(ExperimentWorkspace).filter(
        ExperimentWorkspace.competition_id == competition_id,
        ExperimentWorkspace.user_id == user_id,
    ).first()

    if not workspace:
        workspace = ExperimentWorkspace(
            competition_id=competition_id,
            user_id=user_id,
            name=f"{competition.title} Workspace",
            status="stopped",
            docker_image=DOCKER_IMAGE,
            resource_tier="GPU Basic",
            notebook_url=None,
        )
        db.add(workspace)
        db.commit()
        db.refresh(workspace)

    return workspace


def launch_real_jupyter(competition_id: str, user_id: str, tier: str, workspace):
    workspace_path = get_workspace_path(competition_id, user_id)
    container_name = f"lexivia-{safe_name(competition_id)}-{safe_name(user_id)}"

    if docker_container_exists(container_name):
        stop_and_remove_container(container_name)

    port = get_free_port()
    token = uuid.uuid4().hex

    limits = TIER_LIMITS.get(tier, TIER_LIMITS["CPU Basic"])

    cmd = [
        "docker", "run", "-d",
        "--name", container_name,
        "--cpus", limits["cpus"],       # ← actually enforces CPU limit now
        "--memory", limits["memory"],   # ← actually enforces RAM limit now
        "-p", f"{port}:8888",
        "-v", f"{str(workspace_path)}:/home/jovyan/work",
        DOCKER_IMAGE,
        "start-notebook.sh",
        f"--ServerApp.token={token}",
        "--ServerApp.password=",
        "--ServerApp.allow_origin=*",
    ]

    result = run_cmd(cmd)

    if result.returncode != 0:
        raise HTTPException(
            status_code=500,
            detail=f"Docker failed: {result.stderr or result.stdout}",
        )

    container_id = result.stdout.strip()

    workspace.status        = "running"
    workspace.resource_tier = tier
    workspace.container_id  = container_id
    workspace.docker_image  = DOCKER_IMAGE
    workspace.notebook_url  = f"http://localhost:{port}/lab?token={token}"
    workspace.last_started_at = datetime.utcnow().isoformat()

    apply_resource_limits(workspace, tier)

    return workspace


# ─────────────────────────────────────────────────────────────────────────────
# Metric extraction
# ─────────────────────────────────────────────────────────────────────────────

def extract_metric_from_output(output: str):
    """
    Scans stdout for lines matching any of:
      accuracy: 0.94
      accuracy = 0.94
      METRIC accuracy=0.94
      f1_score: 0.87
    Supports: accuracy, acc, f1, f1_score, precision, recall, loss, auc, mse, mae, rmse
    """
    METRIC_NAMES = {
        "accuracy", "acc", "f1", "f1_score",
        "precision", "recall", "loss", "auc", "mse", "mae", "rmse",
    }

    for line in output.splitlines():
        clean = line.strip()

        # Strip optional "METRIC " prefix
        if clean.lower().startswith("metric "):
            clean = clean[7:].strip()

        for sep in ["=", ":"]:
            if sep in clean:
                name, value = clean.split(sep, 1)
                name  = name.strip().lower().replace(" ", "_")
                value = value.strip().split()[0]  # handle trailing whitespace/units

                if name in METRIC_NAMES:
                    try:
                        float(value)  # validate it's numeric
                        return name, value
                    except ValueError:
                        continue

    return None, None


# ─────────────────────────────────────────────────────────────────────────────
# Dataset bridge — exports validated samples into the Docker container
# ─────────────────────────────────────────────────────────────────────────────

def _parse_annotation(annotation) -> dict:
    if annotation is None:
        return {}
    if isinstance(annotation, dict):
        return annotation
    try:
        result = json.loads(annotation)
        return result if isinstance(result, dict) else {}
    except Exception:
        return {}


def _build_dataset_rows(competition_id: str, db: Session, version_tag: str | None = None) -> list[dict]:
    """
    Returns all validated samples for the competition as a list of flat dicts,
    ready to write to CSV or JSON.
    """
    q = (
        db.query(DataSample)
        .filter(
            DataSample.competition_id == competition_id,
            DataSample.status == "validated",
        )
    )
    if version_tag:
        q = q.filter(DataSample.version_tag == version_tag)

    samples = q.order_by(DataSample.submitted_at.asc()).all()

    rows = []
    for s in samples:
        ann   = _parse_annotation(s.annotation)
        label = (
            ann.get("label")
            or ann.get("labels")
            or ann.get("sentiment")
            or ann.get("summary")
            or ann.get("target")
            or ann.get("output")
            or ann.get("answer")
            or ""
        )             
        if isinstance(label, list):
            label = "|".join(str(l) for l in label)

        rows.append({
            "id":           str(s.id),
            "text_content": s.text_content or "",
            "label":        str(label),
            "audio_url":    s.audio_url or "",
            "quality_score": s.quality_score if s.quality_score is not None else "",
            "version_tag":  s.version_tag or "",
            "submitted_at": str(s.submitted_at) if s.submitted_at else "",
            # Full annotation blob for NER / QA / complex tasks
            "annotation_json": json.dumps(ann, ensure_ascii=False),
        })

    return rows


# ─────────────────────────────────────────────────────────────────────────────
# Routes — workspace lifecycle
# ─────────────────────────────────────────────────────────────────────────────

@router.get("/competitions/{competition_id}/workspace")
def get_workspace(
    competition_id: str,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    competition = require_competition_access(competition_id, current_user.id, db)
    workspace   = get_or_create_workspace(competition_id, current_user.id, competition, db)
    return workspace


@router.post("/competitions/{competition_id}/workspace/launch")
def launch_workspace(
    competition_id: str,
    body: dict,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    competition = require_competition_access(competition_id, current_user.id, db)
    workspace   = get_or_create_workspace(competition_id, current_user.id, competition, db)

    tier      = body.get("resource_tier", "GPU Basic")
    workspace = launch_real_jupyter(competition_id, current_user.id, tier, workspace)

    db.commit()
    db.refresh(workspace)

    return {
        "message":      "Jupyter workspace launched in Docker",
        "workspace":    workspace,
        "notebook_url": workspace.notebook_url,
    }


@router.post("/competitions/{competition_id}/workspace/stop")
def stop_workspace(
    competition_id: str,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    require_competition_access(competition_id, current_user.id, db)

    workspace = db.query(ExperimentWorkspace).filter(
        ExperimentWorkspace.competition_id == competition_id,
        ExperimentWorkspace.user_id == current_user.id,
    ).first()

    if not workspace:
        raise HTTPException(status_code=404, detail="Workspace not found")

    container_name = f"lexivia-{safe_name(competition_id)}-{safe_name(current_user.id)}"
    stop_and_remove_container(container_name)

    workspace.status       = "stopped"
    workspace.notebook_url = None
    workspace.container_id = None

    db.commit()
    db.refresh(workspace)

    return {
        "message":   "Workspace stopped and Docker container removed",
        "workspace": workspace,
    }


@router.post("/competitions/{competition_id}/workspace/jupyter")
def open_jupyter_workspace(
    competition_id: str,
    body: dict,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """
    Returns the existing notebook_url if the workspace is already running,
    otherwise launches a new container. Called by the 'Open Jupyter' button
    when notebook_url is not yet available.
    """
    competition = require_competition_access(competition_id, current_user.id, db)
    workspace   = get_or_create_workspace(competition_id, current_user.id, competition, db)

    if workspace.status == "running" and workspace.notebook_url:
        return {
            "notebook_url": workspace.notebook_url,
            "workspace":    workspace,
        }

    # Not running — launch it now
    tier      = body.get("resource_tier", workspace.resource_tier or "GPU Basic")
    workspace = launch_real_jupyter(competition_id, current_user.id, tier, workspace)

    db.commit()
    db.refresh(workspace)

    return {
        "notebook_url": workspace.notebook_url,
        "workspace":    workspace,
    }


# ─────────────────────────────────────────────────────────────────────────────
# Routes — file management
# ─────────────────────────────────────────────────────────────────────────────

@router.get("/competitions/{competition_id}/workspace/files")
def list_files(
    competition_id: str,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    require_competition_access(competition_id, current_user.id, db)

    base_path = get_workspace_path(competition_id, current_user.id)

    files = sorted(
        str(p.relative_to(base_path)).replace("\\", "/")
        for p in base_path.rglob("*")
        if p.is_file() and not p.name.startswith(".")
    )

    return {"files": files}


@router.get("/competitions/{competition_id}/workspace/file")
def get_file(
    competition_id: str,
    filename: str,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    require_competition_access(competition_id, current_user.id, db)

    base_path = get_workspace_path(competition_id, current_user.id)
    stored_filename = filename
    path = safe_file_path(base_path, stored_filename)

    if not path.exists():
        raise HTTPException(status_code=404, detail="File not found")

    return {"content": path.read_text(encoding="utf-8")}


@router.post("/competitions/{competition_id}/workspace/file")
def save_file(
    competition_id: str,
    body: dict,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    require_competition_access(competition_id, current_user.id, db)

    filename = body.get("filename")
    content  = body.get("content", "")

    base_path = get_workspace_path(competition_id, current_user.id)
    stored_filename = filename
    path = safe_file_path(base_path, stored_filename)

    path.write_text(content, encoding="utf-8")

    return {"message": "File saved", "filename": stored_filename}


@router.post("/competitions/{competition_id}/workspace/upload")
async def upload_workspace_file(
    competition_id: str,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    require_competition_access(competition_id, current_user.id, db)

    filename = file.filename
    allowed  = (".py", ".txt", ".ipynb", ".csv", ".json", ".md", ".pkl")

    if not filename or not filename.endswith(allowed):
        raise HTTPException(status_code=400, detail="Unsupported file type")

    base_path = get_workspace_path(competition_id, current_user.id)
    stored_filename = filename
    path = safe_file_path(base_path, stored_filename)

    content = await file.read()
    path.write_bytes(content)

    return {"message": "File uploaded", "filename": stored_filename}


@router.get("/competitions/{competition_id}/workspace/download")
def download_workspace_file(
    competition_id: str,
    filename: str,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    require_competition_access(competition_id, current_user.id, db)

    base_path = get_workspace_path(competition_id, current_user.id)
    stored_filename = filename
    path = safe_file_path(base_path, stored_filename)

    if not path.exists() or not path.is_file():
        raise HTTPException(status_code=404, detail="File not found")

    return FileResponse(
        path=str(path),
        filename=filename,
        media_type="application/octet-stream",
    )


# ─────────────────────────────────────────────────────────────────────────────
# Routes — run Python code
# ─────────────────────────────────────────────────────────────────────────────

@router.post("/competitions/{competition_id}/workspace/run")
def run_workspace_file(
    competition_id: str,
    body: dict,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    require_competition_access(competition_id, current_user.id, db)

    filename = body.get("filename", "")
    content  = body.get("content", "")

    if not filename.endswith(".py"):
        raise HTTPException(status_code=400, detail="Only Python .py files can be executed")

    workspace = db.query(ExperimentWorkspace).filter(
        ExperimentWorkspace.competition_id == competition_id,
        ExperimentWorkspace.user_id == current_user.id,
    ).first()

    if not workspace or workspace.status != "running":
        raise HTTPException(
            status_code=400,
            detail="Launch the Jupyter/Docker workspace before running code",
        )

    base_path = get_workspace_path(competition_id, current_user.id)
    stored_filename = filename
    path = safe_file_path(base_path, stored_filename)
    path.write_text(content, encoding="utf-8")

    container_name = f"lexivia-{safe_name(competition_id)}-{safe_name(current_user.id)}"

    if not docker_container_running(container_name):
        # Container died without us knowing — update DB status
        workspace.status       = "stopped"
        workspace.notebook_url = None
        db.commit()
        raise HTTPException(
            status_code=400,
            detail="Docker container is not running. Please relaunch the workspace.",
        )

    stdin_text = body.get("stdin", "")
    if stdin_text and not stdin_text.endswith("\n"):
        stdin_text += "\n"

    try:
        result = subprocess.run(
            [
                "docker", "exec", "-i",
                "-w", "/home/jovyan/work",
                container_name,
                "python", f"/home/jovyan/work/{filename}",
            ],
        input=stdin_text,
        capture_output=True,
        text=True,
        timeout=600,
    )
    except subprocess.TimeoutExpired:
        raise HTTPException(
            status_code=500,
            detail="Python execution timed out",
        )
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Execution failed: {str(e)}",
        )

    combined_output = result.stdout + "\n" + result.stderr
    metric_name, metric_value = None, None

    return {
        "stdout":       result.stdout,
        "stderr":       result.stderr,
        "exit_code":    result.returncode,
        "metric_name":  metric_name,
        "metric_value": metric_value,
    }


# ─────────────────────────────────────────────────────────────────────────────
# Routes — dataset bridge
# ─────────────────────────────────────────────────────────────────────────────

@router.post("/competitions/{competition_id}/workspace/load-dataset")
def load_dataset_into_workspace(
    competition_id: str,
    body: dict,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    require_competition_access(competition_id, current_user.id, db)

    competition = db.query(Competition).filter(
        Competition.id == competition_id
    ).first()

    if not competition:
        raise HTTPException(status_code=404, detail="Competition not found")

    version_tag = body.get("version_tag")
    fmt = body.get("format", "both")

    rows = _build_dataset_rows(
        competition_id,
        db,
        version_tag=version_tag,
    )

    if not rows:
        label = f" in version {version_tag}" if version_tag else ""

        raise HTTPException(
            status_code=404,
            detail=(
                f"No validated samples found{label}. "
                "Go to Dataset Hub → validate some samples first."
            ),
        )

    import random

    random.seed(42)
    random.shuffle(rows)

    split_idx = max(1, int(len(rows) * 0.8))

    train_rows = rows[:split_idx]
    test_rows = rows[split_idx:]

    base_path = get_workspace_path(
        competition_id,
        current_user.id,
    )

    data_dir = base_path / "data"
    data_dir.mkdir(exist_ok=True)

    written = []

    def write_csv(path, data):
        if not data:
            return

        with path.open("w", newline="", encoding="utf-8") as f:
            writer = csv.DictWriter(
                f,
                fieldnames=data[0].keys(),
            )
            writer.writeheader()
            writer.writerows(data)

    if fmt in ("csv", "both"):
        write_csv(data_dir / "train.csv", train_rows)
        write_csv(data_dir / "test.csv", test_rows)

        written.extend([
            "data/train.csv",
            "data/test.csv",
        ])

    if fmt in ("json", "both"):
        (data_dir / "train.json").write_text(
            json.dumps(train_rows, ensure_ascii=False, indent=2),
            encoding="utf-8",
        )

        (data_dir / "test.json").write_text(
            json.dumps(test_rows, ensure_ascii=False, indent=2),
            encoding="utf-8",
        )

        written.extend([
            "data/train.json",
            "data/test.json",
        ])

    return {
        "message": (
            f"Dataset split into train/test "
            f"({len(train_rows)} train, {len(test_rows)} test)"
        ),
        "sample_count": len(rows),
        "train_count": len(train_rows),
        "test_count": len(test_rows),
        "version_tag": version_tag,
        "files_written": written,
        "container_paths": [
            f"/home/jovyan/work/{f}" for f in written
        ],
        "usage_hint": (
            "import pandas as pd\n"
            "train_df = pd.read_csv('/home/jovyan/work/data/train.csv')\n"
            "test_df = pd.read_csv('/home/jovyan/work/data/test.csv')\n"
            "print(train_df.shape)\n"
            "print(test_df.shape)"
        ),
    }

# ─────────────────────────────────────────────────────────────────────────────
# Routes — git-style push history
# ─────────────────────────────────────────────────────────────────────────────

@router.post("/competitions/{competition_id}/workspace/push")
def push_workspace_changes(
    competition_id: str,
    body: dict,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    require_competition_access(competition_id, current_user.id, db)

    base_path   = get_workspace_path(competition_id, current_user.id)
    message     = body.get("message") or "Workspace changes pushed"
    commit_hash = uuid.uuid4().hex[:8]
    commit_file = base_path / ".lexivia_commits.json"

    files = [
        p.name
        for p in base_path.iterdir()
        if p.is_file() and not p.name.startswith(".")
    ]

    commit = {
        "hash":       commit_hash,
        "message":    message,
        "files":      files,
        "created_at": datetime.utcnow().isoformat(),
    }

    history = []
    if commit_file.exists():
        try:
            history = json.loads(commit_file.read_text(encoding="utf-8"))
        except Exception:
            history = []

    history.insert(0, commit)
    commit_file.write_text(json.dumps(history[:20], indent=2), encoding="utf-8")

    return {
        "message": "Changes pushed",
        "commit":  commit,
        "history": history[:20],
    }


@router.get("/competitions/{competition_id}/workspace/pushes")
def list_workspace_pushes(
    competition_id: str,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    require_competition_access(competition_id, current_user.id, db)

    base_path   = get_workspace_path(competition_id, current_user.id)
    commit_file = base_path / ".lexivia_commits.json"

    if not commit_file.exists():
        return {"history": []}

    return {"history": json.loads(commit_file.read_text(encoding="utf-8"))}


# ─────────────────────────────────────────────────────────────────────────────
# Routes — experiment runs
# ─────────────────────────────────────────────────────────────────────────────

@router.get("/competitions/{competition_id}/experiments")
def list_experiments(
    competition_id: str,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    require_competition_access(competition_id, current_user.id, db)

    runs = (
        db.query(ExperimentRun)
        .filter(
            ExperimentRun.competition_id == competition_id,
            ExperimentRun.user_id == current_user.id,
        )
        .order_by(ExperimentRun.created_at.desc())
        .all()
    )

    return runs

def compute_model_accuracy_from_test_csv(base_path: Path, model_filename: str):
    import pickle
    import pandas as pd
    from sklearn.metrics import accuracy_score

    model_path = safe_file_path(base_path, model_filename)
    test_path = base_path / "data" / "test.csv"

    if not model_path.exists():
        raise HTTPException(
            status_code=400,
            detail=f"Model file not found: {model_filename}. Run your training code first.",
        )

    if not test_path.exists():
        raise HTTPException(
            status_code=400,
            detail="test.csv not found. Click Load Dataset before saving the model.",
        )

    test_df = pd.read_csv(test_path)

    if "text_content" not in test_df.columns or "label" not in test_df.columns:
        raise HTTPException(
            status_code=400,
            detail="test.csv must contain text_content and label columns.",
        )

    with model_path.open("rb") as f:
        model = pickle.load(f)

    preds = model.predict(test_df["text_content"])
    accuracy = accuracy_score(test_df["label"].astype(str), [str(p) for p in preds])

    return "accuracy", str(round(float(accuracy), 4))

@router.post("/competitions/{competition_id}/experiments")
def save_experiment(
    competition_id: str,
    body: dict,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    require_competition_access(competition_id, current_user.id, db)

    workspace = db.query(ExperimentWorkspace).filter(
        ExperimentWorkspace.competition_id == competition_id,
        ExperimentWorkspace.user_id == current_user.id,
    ).first()

    if not workspace:
        raise HTTPException(status_code=400, detail="Launch a workspace before saving model")

    base_path = get_workspace_path(competition_id, current_user.id)
    model_filename = body.get("model_filename") or body.get("artifact_path") or "model.pkl"

    metric_name, metric_value = compute_model_accuracy_from_test_csv(
    base_path,
    model_filename,
)

    run = ExperimentRun(
        workspace_id=workspace.id,
        competition_id=competition_id,
        user_id=current_user.id,
        name=body.get("name") or "Untitled Model",
        notes=body.get("notes") or "",
        metric_name=metric_name,
        metric_value=metric_value,
        parameters_json=json.dumps({
            "dataset_version": body.get("dataset_version"),
            "dataset_files": body.get("dataset_files") or [],
            "hyperparameters": body.get("hyperparameters") or {},
            "resource_tier": body.get("resource_tier"),
            "active_file": body.get("active_file"),
            "model_filename": body.get("model_filename"),
        }),
        artifact_path=body.get("artifact_path"),
    )

    db.add(run)
    db.commit()
    db.refresh(run)
    return run


def _read_csv_from_supabase(storage_path: str):
    import pandas as pd
    import io

    try:
        raw = supabase.storage.from_("competition-datasets").download(storage_path)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Hidden dataset download failed: {exc}")

    if isinstance(raw, str):
        raw = raw.encode("utf-8")

    return pd.read_csv(io.BytesIO(raw))


def compute_accuracy_from_predictions(competition_id: str, base_path: Path, db: Session):
    """
    Advanced hidden evaluation.

    User workspace contains:
      predictions.csv -> id,prediction

    Backend-only hidden dataset contains:
      id,label

    Hidden labels are NEVER written into /home/jovyan/work.
    """

    predictions_path = base_path / "predictions.csv"

    if not predictions_path.exists():
        raise HTTPException(
            status_code=400,
            detail="predictions.csv was not created. Your code must create predictions.csv with columns: id,prediction"
        )

    hidden_dataset = (
        db.query(CompetitionDataset)
        .filter(
            CompetitionDataset.competition_id == competition_id,
            CompetitionDataset.dataset_type.in_(["hidden_test", "hidden_labels"])
        )
        .order_by(CompetitionDataset.uploaded_at.desc())
        .first()
    )

    if not hidden_dataset:
        raise HTTPException(
            status_code=400,
            detail="No hidden evaluation dataset found. Organizer must upload hidden_labels.csv with columns: id,label"
        )

    import pandas as pd

    preds = pd.read_csv(predictions_path)
    labels = _read_csv_from_supabase(hidden_dataset.storage_path)

    if "id" not in preds.columns or "prediction" not in preds.columns:
        raise HTTPException(
            status_code=400,
            detail="predictions.csv must contain columns: id,prediction",
        )

    if "id" not in labels.columns or "label" not in labels.columns:
        raise HTTPException(
            status_code=400,
            detail="Hidden dataset must contain columns: id,label",
        )

    preds["id"] = preds["id"].astype(str)
    labels["id"] = labels["id"].astype(str)

    merged = labels.merge(preds, on="id", how="inner")

    if merged.empty:
        raise HTTPException(
            status_code=400,
            detail="No matching ids between predictions.csv and hidden labels.",
        )

    accuracy = (
        merged["label"].astype(str).str.strip()
        == merged["prediction"].astype(str).str.strip()
    ).mean()

    return "accuracy", str(round(float(accuracy), 4))
