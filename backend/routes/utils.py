# routes/utils.py
#
# Single source of truth for:
#   - DB session injection
#   - Supabase JWT verification  ← the ONE auth system used across all routes
#   - Icon helper
#
# NOTE: The standalone auth.py in the project root (using jose + SECRET_KEY)
# is NOT used by any route and should be deleted or left unused. All routes
# import get_current_user from HERE, which delegates to Supabase.

from fastapi import Header, HTTPException
from sqlalchemy.orm import Session
from database import SessionLocal
from supabase_client import supabase


# ── Database ──────────────────────────────────────────────────────────────────

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


# ── Auth ──────────────────────────────────────────────────────────────────────

def get_current_user(authorization: str = Header(...)):
    """
    Validates the Supabase Bearer token from the Authorization header.

    Returns the Supabase user object on success.
    Raises HTTP 401 on any failure (missing token, invalid token, expired token).

    The user object has:
      .id          → UUID string (use as user_id throughout)
      .email       → str
      .user_metadata → dict  (contains 'full_name' etc.)
    """
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing or malformed Authorization header")

    token = authorization.split(" ", 1)[1].strip()
    if not token:
        raise HTTPException(status_code=401, detail="Empty token")

    try:
        response = supabase.auth.get_user(token)
    except Exception as e:
        # Supabase raises AuthApiError for expired/invalid tokens
        raise HTTPException(status_code=401, detail="Invalid or expired token")

    if not response or not response.user:
        raise HTTPException(status_code=401, detail="Invalid token")

    return response.user


# ── Icon helper ────────────────────────────────────────────────────────────────

def get_icon_for_task(task_type: str) -> str:
    task = (task_type or "").upper()
    if "TRANSLATION"       in task: return "⇄"
    if "AUDIO_TRANSCRIPTION" in task: return "◉"
    if "SPEECH_EMOTION"    in task: return "◕"
    if "AUDIO_EVENT"       in task: return "▣"
    if "NER"               in task: return "▦"
    if "SENTIMENT"         in task: return "◕"
    if "QUESTION"          in task: return "◈"
    if "SUMMARIZATION"     in task: return "▤"
    return "◉"  # TEXT_CLASSIFICATION default