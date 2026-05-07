"""
services/validation_service.py  — full rewrite

Key changes:
  1. System NO LONGER auto-validates. After passing all rules the status
     is "scored" — the sample waits for 2 human annotators to approve it.
  2. ValidationResult now carries a detailed score_breakdown dict so the
     user can see EXACTLY why a sample scored 72% (which rule contributed what).
  3. Each rule returns a sub-score (0.0-1.0) + pass/fail + explanation.
  4. Task-type-aware validation: QA samples check question+answer fields,
     NER checks entity spans, Translation checks both source+target, etc.
  5. Status flow:
       pending  → scored (system done, waiting for human review)
       scored   → can_be_validated (≥2 annotator approvals received)
       can_be_validated → validated (organiser final stamp, or auto after N approvals)
       any      → flagged (system or human concern)
       any      → rejected (hard rule failure OR human rejection)
"""

import re
from dataclasses import dataclass, field
from typing import Any


REQUIRED_APPROVALS = 2   # minimum annotators needed to validate a sample


# ─────────────────────────────────────────────────────────────────────────────
# Score breakdown entry
# ─────────────────────────────────────────────────────────────────────────────

@dataclass
class RuleResult:
    rule:        str          # machine key e.g. "length"
    label:       str          # human label e.g. "Text Length"
    passed:      bool
    score:       float        # 0.0 – 1.0 contribution
    weight:      float        # how much this rule counts toward total
    explanation: str          # exactly why: "Word count: 12. Good length (≥ 10 words)"
    severity:    str = "info" # "ok" | "warn" | "error"


# ─────────────────────────────────────────────────────────────────────────────
# ValidationResult — richer than before
# ─────────────────────────────────────────────────────────────────────────────

@dataclass
class ValidationResult:
    passed:          bool
    status:          str            # "scored" | "flagged" | "rejected" | "pending"
    reasons:         list[str] = field(default_factory=list)
    quality_score:   float | None = None   # 0.0 – 1.0 overall
    score_breakdown: list[dict] = field(default_factory=list)  # list of RuleResult dicts
    hard_failures:   list[str]  = field(default_factory=list)  # immediate reject reasons


# ─────────────────────────────────────────────────────────────────────────────
# Individual rule checkers — each returns a RuleResult
# ─────────────────────────────────────────────────────────────────────────────

def _rule_not_empty(text: str) -> RuleResult:
    passed = bool(text and text.strip())
    return RuleResult(
        rule="empty_check", label="Content Present",
        passed=passed, score=1.0 if passed else 0.0, weight=1.0,
        explanation="Text content is present and non-empty." if passed
                    else "REJECTED: Text content is empty or whitespace only.",
        severity="ok" if passed else "error",
    )


def _rule_min_length(text: str, min_words: int = 3) -> RuleResult:
    count = len(text.split())
    passed = count >= min_words
    score  = min(1.0, count / max(min_words * 3, 10))   # reaches 1.0 at 3× minimum
    return RuleResult(
        rule="min_length", label="Minimum Length",
        passed=passed, score=score, weight=0.15,
        explanation=(
            f"Word count: {count}. "
            + (f"Meets minimum of {min_words} words." if passed
               else f"Too short — minimum is {min_words} words. Add more content.")
        ),
        severity="ok" if passed else "warn",
    )


def _rule_max_length(text: str, max_words: int = 1024) -> RuleResult:
    count  = len(text.split())
    passed = count <= max_words
    score  = 1.0 if passed else max(0.0, 1 - (count - max_words) / max_words)
    return RuleResult(
        rule="max_length", label="Maximum Length",
        passed=passed, score=score, weight=0.05,
        explanation=(
            f"Word count: {count}. "
            + (f"Within the {max_words}-word limit." if passed
               else f"Exceeds {max_words}-word limit by {count - max_words} words. Trim the content.")
        ),
        severity="ok" if passed else "warn",
    )


def _rule_pii(text: str) -> RuleResult:
    email_re = re.compile(r"[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+")
    phone_re = re.compile(r"\b(\+?\d[\d\s\-().]{7,}\d)\b")
    found = []
    if email_re.search(text):
        found.append("email address")
    if phone_re.search(text):
        found.append("phone number")
    passed = len(found) == 0
    return RuleResult(
        rule="pii_check", label="PII Detection",
        passed=passed, score=1.0 if passed else 0.0, weight=0.10,
        explanation=(
            "No personal information detected." if passed
            else f"FLAGGED: Possible {', '.join(found)} detected. Remove personal data before submitting."
        ),
        severity="ok" if passed else "warn",
    )


def _rule_vocabulary_diversity(text: str) -> RuleResult:
    words = text.lower().split()
    if not words:
        return RuleResult(rule="diversity", label="Vocabulary Diversity",
                          passed=False, score=0.0, weight=0.20,
                          explanation="No words to analyse.", severity="warn")
    ratio = len(set(words)) / len(words)
    passed = ratio >= 0.40
    return RuleResult(
        rule="diversity", label="Vocabulary Diversity",
        passed=passed, score=round(ratio, 3), weight=0.20,
        explanation=(
            f"Unique-word ratio: {round(ratio * 100)}% "
            f"({len(set(words))} unique / {len(words)} total). "
            + ("Good vocabulary variety." if passed
               else "Low diversity — text is repetitive. Use more varied vocabulary.")
        ),
        severity="ok" if ratio >= 0.40 else "warn" if ratio >= 0.25 else "error",
    )


def _rule_annotation_present(annotation: dict | None, task_type: str) -> RuleResult:
    """Check that the annotation contains the required fields for this task type."""
    if not annotation:
        return RuleResult(
            rule="annotation", label="Annotation Complete",
            passed=False, score=0.0, weight=1.0,
            explanation="REJECTED: No annotation provided. A label/answer is required.",
            severity="error",
        )

    required = _required_annotation_fields(task_type)
    missing  = [f for f in required if not annotation.get(f)]

    if missing:
        return RuleResult(
            rule="annotation", label="Annotation Complete",
            passed=False, score=0.0, weight=1.0,
            explanation=f"REJECTED: Missing required annotation fields: {', '.join(missing)}.",
            severity="error",
        )

    return RuleResult(
        rule="annotation", label="Annotation Complete",
        passed=True, score=1.0, weight=1.0,
        explanation=f"All required fields present: {', '.join(required)}.",
        severity="ok",
    )


def _required_annotation_fields(task_type: str) -> list[str]:
    return {
        "TEXT_CLASSIFICATION":  ["labels"],
        "NER":                  ["entities"],
        "SENTIMENT_ANALYSIS":   ["sentiment"],
        "TRANSLATION":          ["translation"],
        "QUESTION_ANSWERING":   ["question", "answer"],
        "SUMMARIZATION":        ["summary"],
        "AUDIO_SYNTHESIS":      ["transcript"],
        "AUDIO_TRANSCRIPTION":  ["transcript"],
        "SPEECH_EMOTION":       ["emotion"],
        "AUDIO_EVENT_DETECTION":["events"],
    }.get(task_type.upper().replace(" ", "_"), ["label"])


def _rule_task_specific(text: str, annotation: dict, task_type: str) -> RuleResult | None:
    """
    Task-specific quality checks. Returns None if no specific check applies.
    """
    tt = task_type.upper().replace(" ", "_")

    if tt == "QUESTION_ANSWERING":
        question = annotation.get("question", "")
        answer   = annotation.get("answer", "")
        context  = text
        q_words  = len(question.split())
        a_words  = len(answer.split())
        # Check answer is found in context (extractive QA)
        answer_in_context = answer.lower() in context.lower() if answer else False
        score = 0.0
        parts = []
        if q_words >= 3:
            score += 0.4; parts.append(f"question has {q_words} words ✓")
        else:
            parts.append(f"question too short ({q_words} words) ✗")
        if a_words >= 1:
            score += 0.3; parts.append(f"answer present ✓")
        else:
            parts.append("answer is empty ✗")
        if answer_in_context:
            score += 0.3; parts.append("answer found in context ✓")
        else:
            parts.append("answer not found verbatim in context (ok for abstractive)")
        return RuleResult(
            rule="task_qa", label="QA Quality",
            passed=score >= 0.5, score=round(score, 2), weight=0.25,
            explanation="QA checks: " + "; ".join(parts),
            severity="ok" if score >= 0.7 else "warn" if score >= 0.4 else "error",
        )

    if tt == "TRANSLATION":
        source = text
        target = annotation.get("translation", "")
        s_words = len(source.split())
        t_words = len(target.split())
        ratio   = t_words / max(s_words, 1)
        # Translation should be roughly similar length (0.5x – 2x)
        length_ok = 0.5 <= ratio <= 2.0
        score = 0.5 + (0.5 if length_ok else 0.0)
        return RuleResult(
            rule="task_translation", label="Translation Quality",
            passed=length_ok, score=round(score, 2), weight=0.25,
            explanation=(
                f"Source: {s_words} words, Translation: {t_words} words "
                f"(ratio: {round(ratio, 2)}). "
                + ("Length ratio looks reasonable." if length_ok
                   else "Length ratio unusual — translation may be incomplete or inflated.")
            ),
            severity="ok" if length_ok else "warn",
        )

    if tt == "NER":
        entities = annotation.get("entities", [])
        if not entities:
            return RuleResult(
                rule="task_ner", label="Entity Spans",
                passed=False, score=0.0, weight=0.25,
                explanation="No entity spans annotated. At least one entity required.",
                severity="warn",
            )
        valid = [e for e in entities if e.get("label") and e.get("text")]
        return RuleResult(
            rule="task_ner", label="Entity Spans",
            passed=len(valid) > 0, score=min(1.0, len(valid) / 3), weight=0.25,
            explanation=f"{len(valid)} valid entity span(s) annotated ({', '.join(set(e['label'] for e in valid))}).",
            severity="ok",
        )

    if tt == "SENTIMENT_ANALYSIS":
        sentiment = annotation.get("sentiment", "")
        confidence = float(annotation.get("confidence", 0.5))
        valid_sentiments = {"positive", "negative", "neutral", "mixed"}
        ok = sentiment in valid_sentiments
        return RuleResult(
            rule="task_sentiment", label="Sentiment Label",
            passed=ok, score=confidence if ok else 0.0, weight=0.20,
            explanation=(
                f"Sentiment: '{sentiment}', Confidence: {round(confidence * 100)}%. "
                + ("Valid sentiment label." if ok
                   else f"Invalid sentiment '{sentiment}'. Use: {', '.join(valid_sentiments)}.")
            ),
            severity="ok" if ok else "error",
        )

    if tt == "SUMMARIZATION":
        doc_words     = len(text.split())
        summary_words = len(annotation.get("summary", "").split())
        ratio         = summary_words / max(doc_words, 1)
        target        = 0.10
        ok            = 0.05 <= ratio <= 0.20
        return RuleResult(
            rule="task_summary", label="Summary Ratio",
            passed=ok, score=1.0 if ok else 0.5, weight=0.20,
            explanation=(
                f"Document: {doc_words} words → Summary: {summary_words} words "
                f"({round(ratio * 100)}% of source). "
                + (f"Good ratio (target ~{round(target*100)}%)." if ok
                   else "Summary too long or too short relative to source document.")
            ),
            severity="ok" if ok else "warn",
        )

    return None   # no task-specific check


# ─────────────────────────────────────────────────────────────────────────────
# Master pipeline
# ─────────────────────────────────────────────────────────────────────────────

async def validate_sample(
    text_content: str | None,
    annotation:   dict | None,
    task_type:    str = "TEXT_CLASSIFICATION",
    run_ai:       bool = True,
) -> ValidationResult:
    """
    Full validation pipeline. Returns a scored result — NOT auto-validated.

    Status flow after this function:
      "rejected" → hard rule failure, sample is NOT saved
      "flagged"  → soft concern, saved but needs human attention
      "scored"   → passed all rules, saved, waiting for ≥2 annotator approvals

    The system NEVER sets status="validated" directly.
    That requires REQUIRED_APPROVALS (2) human annotations via the approval endpoint.
    """
    text = (text_content or "").strip()
    ann  = annotation or {}
    tt   = task_type.upper().replace(" ", "_")

    rules:         list[RuleResult] = []
    hard_failures: list[str]        = []
    soft_flags:    list[str]        = []

    # ── Hard check 1: must have content ──────────────────────────────────────
    r_empty = _rule_not_empty(text)
    rules.append(r_empty)
    if not r_empty.passed:
        hard_failures.append(r_empty.explanation)
        return ValidationResult(
            passed=False, status="rejected",
            reasons=hard_failures,
            score_breakdown=[_to_dict(r) for r in rules],
            hard_failures=hard_failures,
        )

    # ── Hard check 2: annotation must be present and correct ─────────────────
    r_ann = _rule_annotation_present(ann, tt)
    rules.append(r_ann)
    if not r_ann.passed:
        hard_failures.append(r_ann.explanation)
        return ValidationResult(
            passed=False, status="rejected",
            reasons=hard_failures,
            score_breakdown=[_to_dict(r) for r in rules],
            hard_failures=hard_failures,
        )

    # ── Soft checks — all run, issues collected ───────────────────────────────
    r_min = _rule_min_length(text)
    rules.append(r_min)
    if not r_min.passed:
        soft_flags.append(r_min.explanation)

    r_max = _rule_max_length(text)
    rules.append(r_max)
    if not r_max.passed:
        soft_flags.append(r_max.explanation)

    r_pii = _rule_pii(text)
    rules.append(r_pii)
    if not r_pii.passed:
        soft_flags.append(r_pii.explanation)

    r_div = _rule_vocabulary_diversity(text)
    rules.append(r_div)
    if not r_div.passed:
        soft_flags.append(r_div.explanation)

    # ── Task-specific check ───────────────────────────────────────────────────
    r_task = _rule_task_specific(text, ann, tt)
    if r_task:
        rules.append(r_task)
        if not r_task.passed:
            soft_flags.append(r_task.explanation)

    # ── Compute weighted quality score ────────────────────────────────────────
    total_weight = sum(r.weight for r in rules)
    weighted_sum = sum(r.score * r.weight for r in rules)
    quality_score = round(weighted_sum / max(total_weight, 0.001), 3)

    # Annotate each rule with its % contribution to the final score
    for r in rules:
        r.explanation += f"  [contributes {round(r.weight / total_weight * 100)}% to score]"

    breakdown = [_to_dict(r) for r in rules]

    # ── Decide status ─────────────────────────────────────────────────────────
    # PII or very low score → flag (human must review before approvals counted)
    if r_pii and not r_pii.passed:
        return ValidationResult(
            passed=False, status="flagged",
            reasons=soft_flags,
            quality_score=quality_score,
            score_breakdown=breakdown,
        )

    if quality_score < 0.30:
        soft_flags.append(
            f"Overall quality score {round(quality_score * 100)}% is below 30% — "
            "sample is likely low quality. Consider rewriting."
        )
        return ValidationResult(
            passed=False, status="flagged",
            reasons=soft_flags,
            quality_score=quality_score,
            score_breakdown=breakdown,
        )

    # Everything else → "scored": system is done, humans take over
    # The status "scored" means: passed automated checks, ready for annotator review
    reasons = soft_flags if soft_flags else [
        f"Automated checks passed. Quality score: {round(quality_score * 100)}%. "
        f"Needs {REQUIRED_APPROVALS} annotator approvals to become validated."
    ]

    return ValidationResult(
        passed=True,
        status="scored",
        reasons=reasons,
        quality_score=quality_score,
        score_breakdown=breakdown,
    )


def _to_dict(r: RuleResult) -> dict:
    return {
        "rule":        r.rule,
        "label":       r.label,
        "passed":      r.passed,
        "score":       r.score,
        "score_pct":   round(r.score * 100),
        "weight":      r.weight,
        "explanation": r.explanation,
        "severity":    r.severity,
    }