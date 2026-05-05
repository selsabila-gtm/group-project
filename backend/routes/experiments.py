import json
import uuid
import os
import socket
import subprocess
from pathlib import Path
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from fastapi.responses import FileResponse

from models import (
    Competition,
    CompetitionParticipant,
    CompetitionOrganizer,
    ExperimentWorkspace,
    ExperimentRun,
)
from .utils import get_db, get_current_user

router = APIRouter(tags=["experiments"])

WORKSPACES_DIR = Path("./workspaces").resolve()
DOCKER_IMAGE = "jupyter/scipy-notebook:python-3.10"


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
        raise HTTPException(status_code=403, detail="Join the competition before launching a workspace")

    return competition


def safe_name(value: str):
    return "".join(c if c.isalnum() else "-" for c in value)[:40]


def get_workspace_path(competition_id: str, user_id: str):
    path = WORKSPACES_DIR / f"{safe_name(competition_id)}_{safe_name(user_id)}"
    path.mkdir(parents=True, exist_ok=True)

    defaults = {
        "main_modeling.py": '# Start your model here\nprint("Hello from Lexivia workspace")\n',
        "utils.py": "# helper functions\n",
        "requirements.txt": "numpy\npandas\nscikit-learn\nmatplotlib\n",
    }

    for filename, content in defaults.items():
        file_path = path / filename
        if not file_path.exists():
            file_path.write_text(content, encoding="utf-8")

    return path


def safe_file_path(base_path: Path, filename: str):
    if not filename or ".." in filename or filename.startswith("/") or filename.startswith("\\"):
        raise HTTPException(status_code=400, detail="Invalid filename")

    path = (base_path / filename).resolve()

    if not str(path).startswith(str(base_path.resolve())):
        raise HTTPException(status_code=400, detail="Invalid filename")

    return path


def get_free_port():
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
            detail="Docker command timed out. The image may still be downloading. Run: docker pull jupyter/scipy-notebook:python-3.10",
        )
    except FileNotFoundError:
        raise HTTPException(
            status_code=500,
            detail="Docker is not installed or Docker Desktop is not running.",
        )

def docker_container_exists(container_name: str):
    result = run_cmd(["docker", "ps", "-a", "--filter", f"name=^{container_name}$", "--format", "{{.Names}}"])
    return container_name in result.stdout.splitlines()


def docker_container_running(container_name: str):
    result = run_cmd(["docker", "ps", "--filter", f"name=^{container_name}$", "--format", "{{.Names}}"])
    return container_name in result.stdout.splitlines()


def stop_and_remove_container(container_name: str):
    if docker_container_exists(container_name):
        run_cmd(["docker", "rm", "-f", container_name])


def apply_resource_limits(workspace, tier: str):
    if tier == "CPU Basic":
        workspace.cpu_limit = "2 cores"
        workspace.ram_limit = "4 GB"
        workspace.gpu_limit = "No GPU"
        workspace.storage_limit = "10 GB"
    elif tier == "GPU Pro":
        workspace.cpu_limit = "8 cores"
        workspace.ram_limit = "32 GB"
        workspace.gpu_limit = "1 dedicated GPU"
        workspace.storage_limit = "80 GB"
    else:
        workspace.cpu_limit = "4 cores"
        workspace.ram_limit = "16 GB"
        workspace.gpu_limit = "1 shared GPU"
        workspace.storage_limit = "40 GB"


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

    cmd = [
    "docker",
    "run",
    "-d",
    "--name",
    container_name,
    "-p",
    f"{port}:8888",
    "-v",
    f"{str(workspace_path)}:/home/jovyan/work",
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

    workspace.status = "running"
    workspace.resource_tier = tier
    workspace.container_id = container_id
    workspace.docker_image = DOCKER_IMAGE
    workspace.notebook_url = f"http://localhost:{port}/lab?token={token}"
    workspace.last_started_at = datetime.utcnow().isoformat()

    apply_resource_limits(workspace, tier)

    return workspace


@router.get("/competitions/{competition_id}/workspace")
def get_workspace(
    competition_id: str,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    competition = require_competition_access(competition_id, current_user.id, db)
    workspace = get_or_create_workspace(competition_id, current_user.id, competition, db)
    return workspace


@router.post("/competitions/{competition_id}/workspace/launch")
def launch_workspace(
    competition_id: str,
    body: dict,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    competition = require_competition_access(competition_id, current_user.id, db)
    workspace = get_or_create_workspace(competition_id, current_user.id, competition, db)

    tier = body.get("resource_tier", "GPU Basic")
    workspace = launch_real_jupyter(competition_id, current_user.id, tier, workspace)

    db.commit()
    db.refresh(workspace)

    return {
        "message": "Real Jupyter workspace launched in Docker",
        "workspace": workspace,
        "notebook_url": workspace.notebook_url,
    }


@router.post("/competitions/{competition_id}/workspace/jupyter")
def open_jupyter_workspace(
    competition_id: str,
    body: dict,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    return launch_workspace(competition_id, body, db, current_user)


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

    workspace.status = "stopped"
    workspace.notebook_url = None
    workspace.container_id = None

    db.commit()
    db.refresh(workspace)

    return {
        "message": "Workspace stopped and Docker container removed",
        "workspace": workspace,
    }


@router.get("/competitions/{competition_id}/workspace/files")
def list_files(
    competition_id: str,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    require_competition_access(competition_id, current_user.id, db)

    base_path = get_workspace_path(competition_id, current_user.id)
    files = [p.name for p in base_path.iterdir() if p.is_file()]

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
    path = safe_file_path(base_path, filename)

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
    content = body.get("content", "")

    base_path = get_workspace_path(competition_id, current_user.id)
    path = safe_file_path(base_path, filename)

    path.write_text(content, encoding="utf-8")

    return {"message": "File saved", "filename": filename}

@router.post("/competitions/{competition_id}/workspace/upload")
async def upload_workspace_file(
    competition_id: str,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    require_competition_access(competition_id, current_user.id, db)

    filename = file.filename
    allowed = (".py", ".txt", ".ipynb", ".csv", ".json", ".md", ".pkl")

    if not filename or not filename.endswith(allowed):
        raise HTTPException(status_code=400, detail="Unsupported file type")

    base_path = get_workspace_path(competition_id, current_user.id)
    path = safe_file_path(base_path, filename)

    content = await file.read()
    path.write_bytes(content)

    return {"message": "File uploaded", "filename": filename}


@router.post("/competitions/{competition_id}/workspace/push")
def push_workspace_changes(
    competition_id: str,
    body: dict,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    require_competition_access(competition_id, current_user.id, db)

    base_path = get_workspace_path(competition_id, current_user.id)
    message = body.get("message") or "Workspace changes pushed"

    commit_hash = uuid.uuid4().hex[:8]
    commit_file = base_path / ".lexivia_commits.json"

    files = [p.name for p in base_path.iterdir() if p.is_file() and not p.name.startswith(".")]

    commit = {
        "hash": commit_hash,
        "message": message,
        "files": files,
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
        "commit": commit,
        "history": history[:20],
    }


@router.get("/competitions/{competition_id}/workspace/pushes")
def list_workspace_pushes(
    competition_id: str,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    require_competition_access(competition_id, current_user.id, db)

    base_path = get_workspace_path(competition_id, current_user.id)
    commit_file = base_path / ".lexivia_commits.json"

    if not commit_file.exists():
        return {"history": []}

    return {"history": json.loads(commit_file.read_text(encoding="utf-8"))}

@router.get("/competitions/{competition_id}/workspace/download")
def download_workspace_file(
    competition_id: str,
    filename: str,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    require_competition_access(competition_id, current_user.id, db)

    base_path = get_workspace_path(competition_id, current_user.id)
    path = safe_file_path(base_path, filename)

    if not path.exists() or not path.is_file():
        raise HTTPException(status_code=404, detail="File not found")

    return FileResponse(
        path=str(path),
        filename=filename,
        media_type="application/octet-stream",
    )
def extract_metric_from_output(output: str):
    # Supports:
    # METRIC accuracy=0.94
    # accuracy: 0.94
    # accuracy = 0.94
    for line in output.splitlines():
        clean = line.strip()

        if clean.lower().startswith("metric "):
            clean = clean[7:].strip()

        for sep in ["=", ":"]:
            if sep in clean:
                name, value = clean.split(sep, 1)
                name = name.strip().lower()
                value = value.strip()

                if name in ["accuracy", "acc", "f1", "precision", "recall", "loss"]:
                    return name, value

    return None, None

@router.post("/competitions/{competition_id}/workspace/run")
def run_workspace_file(
    competition_id: str,
    body: dict,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    require_competition_access(competition_id, current_user.id, db)

    filename = body.get("filename")
    content = body.get("content", "")

    if not filename.endswith(".py"):
        raise HTTPException(status_code=400, detail="Only Python .py files can be executed")

    workspace = db.query(ExperimentWorkspace).filter(
        ExperimentWorkspace.competition_id == competition_id,
        ExperimentWorkspace.user_id == current_user.id,
    ).first()

    if not workspace or workspace.status != "running":
        raise HTTPException(status_code=400, detail="Launch the Jupyter/Docker workspace before running code")

    base_path = get_workspace_path(competition_id, current_user.id)
    path = safe_file_path(base_path, filename)
    path.write_text(content, encoding="utf-8")

    container_name = f"lexivia-{safe_name(competition_id)}-{safe_name(current_user.id)}"

    if not docker_container_running(container_name):
        raise HTTPException(status_code=400, detail="Docker container is not running. Relaunch workspace.")

    stdin_text = body.get("stdin", "")

    result = subprocess.run(
        ["docker", "exec", "-i", container_name, "python", f"/home/jovyan/work/{filename}"],
        input=stdin_text,
        capture_output=True,
        text=True,
        timeout=600,
    )
    metric_name, metric_value = extract_metric_from_output(result.stdout + "\n" + result.stderr)

    return {
    "stdout": result.stdout,
    "stderr": result.stderr,
    "exit_code": result.returncode,
    "metric_name": metric_name,
    "metric_value": metric_value,
    }


@router.get("/competitions/{competition_id}/experiments")
def list_experiments(
    competition_id: str,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    require_competition_access(competition_id, current_user.id, db)

    runs = db.query(ExperimentRun).filter(
        ExperimentRun.competition_id == competition_id,
        ExperimentRun.user_id == current_user.id,
    ).order_by(ExperimentRun.created_at.desc()).all()

    return runs


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
        raise HTTPException(status_code=400, detail="Launch a workspace before saving experiments")

    run = ExperimentRun(
        workspace_id=workspace.id,
        competition_id=competition_id,
        user_id=current_user.id,
        name=body.get("name") or "Untitled Experiment",
        notes=body.get("notes") or "",
        metric_name=body.get("metric_name") or "accuracy",
        metric_value=str(body.get("metric_value") or "0.00"),
        parameters_json=json.dumps(body.get("parameters") or {}),
        artifact_path=body.get("artifact_path"),
    )

    db.add(run)
    db.commit()
    db.refresh(run)

    return run