"""
scripts/migrate_validate_existing.py

Run this ONCE from the backend/ directory to validate all existing
"pending" samples using the rule-based pipeline (no AI, for speed).

Usage:
    cd backend
    python scripts/migrate_validate_existing.py

Add --ai flag to also run AI scoring (much slower):
    python scripts/migrate_validate_existing.py --ai
"""

import asyncio
import sys
import os

# Make sure backend modules are importable
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import json
from database import SessionLocal
from models import DataSample
from services.validation_service import validate_sample


async def run(use_ai: bool = False):
    db = SessionLocal()
    try:
        pending = db.query(DataSample).filter(DataSample.status == "pending").all()
        total   = len(pending)
        print(f"Found {total} pending samples. Starting validation (AI={'ON' if use_ai else 'OFF'})…\n")

        counts = {"validated": 0, "flagged": 0, "rejected": 0, "skipped": 0}

        for i, sample in enumerate(pending, 1):
            # Parse annotation
            try:
                ann = json.loads(sample.annotation) if sample.annotation else {}
            except Exception:
                ann = {}

            result = await validate_sample(
                text_content=sample.text_content,
                annotation=ann,
                task_type="TEXT_PROCESSING",
                run_ai=use_ai,
            )

            sample.status = result.status
            if result.quality_score is not None:
                sample.quality_score = str(result.quality_score)

            counts[result.status] = counts.get(result.status, 0) + 1

            # Commit in batches of 500 for performance
            if i % 500 == 0:
                db.commit()
                print(f"  [{i}/{total}] validated={counts['validated']} "
                      f"flagged={counts['flagged']} rejected={counts['rejected']}")

        db.commit()
        print(f"\nDone! Results:")
        for status, n in counts.items():
            print(f"  {status}: {n}")

    finally:
        db.close()


if __name__ == "__main__":
    use_ai = "--ai" in sys.argv
    asyncio.run(run(use_ai=use_ai))