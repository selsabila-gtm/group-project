"""
services/validation_service.py

Rule-based + AI-placeholder validation pipeline.
Called BEFORE any DataSample is inserted into the database.

Each validator returns a ValidationResult with:
  - passed: bool
  - status: "validated" | "flagged" | "rejected"
  - reason: human-readable explanation
"""

import re
from dataclasses import dataclass, field
from typing import Any


# ─────────────────────────────────────────────────────────────────────────────
# Data structures
# ─────────────────────────────────────────────────────────────────────────────

@dataclass
class ValidationResult:
    passed: bool
    status: str          # "validated" | "flagged" | "rejected" | "pending"
    reasons: list[str] = field(default_factory=list)
    quality_score: float | None = None  # 0.0 – 1.0


# ─────────────────────────────────────────────────────────────────────────────
# Individual rule validators
# ─────────────────────────────────────────────────────────────────────────────

def validate_not_empty(text_content: str | None) -> ValidationResult:
    """Reject samples that have no text at all."""
    if not text_content or not text_content.strip():
        return ValidationResult(
            passed=False, status="rejected",
            reasons=["text_content is empty or whitespace only."]
        )
    return ValidationResult(passed=True, status="validated")


def validate_min_length(text_content: str, min_tokens: int = 3) -> ValidationResult:
    """Flag samples that are suspiciously short (< min_tokens words)."""
    token_count = len(text_content.split())
    if token_count < min_tokens:
        return ValidationResult(
            passed=False, status="flagged",
            reasons=[f"Text too short: {token_count} token(s), minimum is {min_tokens}."]
        )
    return ValidationResult(passed=True, status="validated")


def validate_max_length(text_content: str, max_tokens: int = 1024) -> ValidationResult:
    """Flag samples that are unusually long (> max_tokens words)."""
    token_count = len(text_content.split())
    if token_count > max_tokens:
        return ValidationResult(
            passed=False, status="flagged",
            reasons=[f"Text too long: {token_count} token(s), maximum is {max_tokens}."]
        )
    return ValidationResult(passed=True, status="validated")


def validate_no_pii(text_content: str) -> ValidationResult:
    """
    Flag samples that appear to contain PII (email addresses, phone numbers).
    Extend this regex list as needed for your domain.
    """
    email_re  = re.compile(r"[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+")
    phone_re  = re.compile(r"\b(\+?\d[\d\s\-().]{7,}\d)\b")

    found = []
    if email_re.search(text_content):
        found.append("possible email address detected")
    if phone_re.search(text_content):
        found.append("possible phone number detected")

    if found:
        return ValidationResult(
            passed=False, status="flagged",
            reasons=[f"PII detected: {', '.join(found)}."]
        )
    return ValidationResult(passed=True, status="validated")


def validate_annotation(annotation: dict | None) -> ValidationResult:
    """
    Reject samples where the annotation dict is completely empty
    (no label, no key at all). A minimal annotation is required.
    """
    if not annotation:
        return ValidationResult(
            passed=False, status="rejected",
            reasons=["Annotation is missing or empty."]
        )
    return ValidationResult(passed=True, status="validated")


# ─────────────────────────────────────────────────────────────────────────────
# AI-based validation placeholder
# Replace the body of this function with a real model call when ready.
# ─────────────────────────────────────────────────────────────────────────────

async def ai_validate_sample(
    text_content: str,
    annotation: dict,
    task_type: str = "TEXT_PROCESSING",
) -> ValidationResult:
    """
    AI-powered quality check placeholder.

    Currently returns a deterministic heuristic score. Replace the block
    marked *** with an actual LLM/classifier API call (e.g. Anthropic,
    OpenAI, or a fine-tuned HuggingFace model).

    Expected real implementation:
        response = await anthropic_client.messages.create(
            model="claude-3-haiku-...",
            system=QUALITY_SYSTEM_PROMPT,
            messages=[{"role": "user", "content": text_content}],
        )
        score = parse_score(response)

    Returns "validated" when score >= 0.6, "flagged" when >= 0.35, else "rejected".
    """

    # *** AI PLACEHOLDER — replace with real inference ***
    word_count   = len(text_content.split())
    unique_ratio = len(set(text_content.lower().split())) / max(word_count, 1)
    # Heuristic: longer, more diverse text scores higher
    score = min(1.0, (word_count / 80) * 0.5 + unique_ratio * 0.5)
    # *** END PLACEHOLDER ***

    if score >= 0.6:
        return ValidationResult(passed=True,  status="validated", quality_score=round(score, 3))
    if score >= 0.35:
        return ValidationResult(passed=False, status="flagged",   quality_score=round(score, 3),
                                reasons=["AI quality score below acceptance threshold."])
    return ValidationResult(passed=False, status="rejected", quality_score=round(score, 3),
                            reasons=["AI quality score too low — sample likely low-quality."])


# ─────────────────────────────────────────────────────────────────────────────
# Master pipeline — called by route handlers
# ─────────────────────────────────────────────────────────────────────────────

async def validate_sample(
    text_content: str | None,
    annotation: dict | None,
    task_type: str = "TEXT_PROCESSING",
    run_ai: bool = True,
) -> ValidationResult:
    """
    Run all validators in priority order.
    Returns as soon as a hard failure (rejected / flagged) is found,
    except AI validation which always runs and can upgrade a "validated"
    sample to "flagged".

    Priority:
      1. Empty check        → reject immediately
      2. Annotation check   → reject immediately
      3. Min-length check   → flag
      4. Max-length check   → flag
      5. PII check          → flag
      6. AI quality check   → validate / flag / reject
    """
    text = (text_content or "").strip()

    # 1. Empty
    r = validate_not_empty(text)
    if not r.passed:
        return r

    # 2. Annotation
    r = validate_annotation(annotation)
    if not r.passed:
        return r

    # 3. Min length
    r = validate_min_length(text)
    if not r.passed:
        return r

    # 4. Max length
    r = validate_max_length(text)
    if not r.passed:
        return r

    # 5. PII
    r = validate_no_pii(text)
    if not r.passed:
        return r

    # 6. AI quality (async — skippable for audio / bulk fast-path)
    if run_ai:
        r = await ai_validate_sample(text, annotation or {}, task_type)
        return r

    # Default: pending until a reviewer acts
    return ValidationResult(passed=True, status="pending", reasons=[])