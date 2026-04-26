from fastapi import Header, HTTPException
from sqlalchemy.orm import Session
from database import SessionLocal
from supabase_client import supabase


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def get_current_user(authorization: str = Header(...)):
    """Validates the Bearer token and returns the Supabase user object."""
    try:
        token = authorization.split(" ")[1]
        response = supabase.auth.get_user(token)

        if not response or not response.user:
            raise HTTPException(status_code=401, detail="Invalid token")

        return response.user

    except HTTPException:
        raise
    except Exception:
        raise HTTPException(status_code=401, detail="Invalid or missing token")


def get_icon_for_task(task_type: str) -> str:
    task = (task_type or "").upper()
    if "TRANSLATION" in task:
        return "文"
    if "AUDIO" in task:
        return "◉"
    if "TEXT" in task:
        return "◎"
    if "COGNITIVE" in task:
        return "▣"
    if "QUESTION" in task:
        return "Q"
    if "SUMMARIZATION" in task:
        return "▤"
    return "◎"
