"""
scripts/migrate_validate_existing.py  (fixed)

Root cause: existing samples have annotation="{}" or annotation=None,
which validate_annotation() hard-rejects — causing 100% rejection rate.

This script uses a RELAXED pipeline:
  - Empty text        -> rejected
  - Text too short    -> flagged
  - PII detected      -> flagged
  - Empty annotation  -> pending (human review, not rejected)
  - Otherwise         -> validated

Run from backend/ directory:
    python scripts/migrate_validate_existing.py

Dry-run first to preview without writing:
    python scripts/migrate_validate_existing.py --dry-run
"""

import asyncio, sys, os, json
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from database import SessionLocal
from models import DataSample
from services.validation_service import (
    validate_not_empty, validate_min_length,
    validate_max_length, validate_no_pii, ValidationResult,
)


def is_annotation_meaningful(raw):
    if not raw:
        return False
    try:
        ann = json.loads(raw)
    except Exception:
        return False
    if isinstance(ann, dict):
        return any(v not in ("", None, [], {}) for v in ann.values())
    if isinstance(ann, list):
        return len(ann) > 0
    return False


async def validate_existing(text_content, annotation_raw):
    text = (text_content or "").strip()

    for check in [validate_not_empty, validate_min_length, validate_max_length, validate_no_pii]:
        r = check(text) if check != validate_not_empty else validate_not_empty(text)
        if not r.passed:
            return r

    if not is_annotation_meaningful(annotation_raw):
        return ValidationResult(passed=False, status="pending",
                                reasons=["Empty annotation — needs review."])

    return ValidationResult(passed=True, status="validated")


async def run(dry_run=False):
    db = SessionLocal()
    try:
        # Show 3 sample rows so you can diagnose the data
        rows = db.query(DataSample).filter(DataSample.status == "pending").limit(3).all()
        print("── Data preview (first 3 rows) ──")
        for s in rows:
            print(f"  text: {repr((s.text_content or '')[:80])}")
            print(f"  annotation: {repr(s.annotation)}")
            print()

        pending = db.query(DataSample).filter(DataSample.status == "pending").all()
        total = len(pending)
        print(f"Found {total} pending. {'DRY RUN' if dry_run else 'Processing…'}\n")

        counts = {"validated": 0, "flagged": 0, "rejected": 0, "pending": 0}
        for i, s in enumerate(pending, 1):
            r = await validate_existing(s.text_content, s.annotation)
            counts[r.status] += 1
            if not dry_run:
                s.status = r.status
            if not dry_run and i % 500 == 0:
                db.commit()
                print(f"  [{i}/{total}]", " ".join(f"{k}={v}" for k, v in counts.items()))

        if not dry_run:
            db.commit()

        print(f"\n{'Preview' if dry_run else 'Done'}:")
        for k, v in counts.items():
            print(f"  {k}: {v} ({round(v/total*100,1) if total else 0}%)")
    finally:
        db.close()

if __name__ == "__main__":
    asyncio.run(run("--dry-run" in sys.argv))