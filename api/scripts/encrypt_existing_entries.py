#!/usr/bin/env python3
"""
Encrypt plaintext entry title/content/reflection rows already in the database.

Requires ENCRYPTION_KEY in the environment (same key the API uses). Safe to
re-run: rows that already start with encv1: are skipped.

Run from api directory:
  python scripts/encrypt_existing_entries.py
  python scripts/encrypt_existing_entries.py --dry-run
"""

import argparse
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy import text

from app.core.config import settings
from app.core.encryption import encrypt_content, is_encrypted_at_rest
from app.database import SessionLocal

_ENCRYPTED_FIELDS = ("title", "content", "reflection")


def encrypt_existing_entries(*, dry_run: bool = False) -> int:
    if not settings.encryption_key:
        print(
            "Error: ENCRYPTION_KEY is not set. Generate one with:\n"
            '  python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"'
        )
        return 1

    db = SessionLocal()
    updated_rows = 0
    try:
        rows = db.execute(
            text("SELECT id, title, content, reflection FROM entries")
        ).fetchall()

        for row in rows:
            updates: dict[str, str] = {}
            for field in _ENCRYPTED_FIELDS:
                raw = getattr(row, field)
                if raw and not is_encrypted_at_rest(raw):
                    updates[field] = encrypt_content(raw)

            if not updates:
                continue

            updated_rows += 1
            if dry_run:
                print(f"  would encrypt entry id={row.id} fields={list(updates)}")
                continue

            set_clause = ", ".join(f"{col} = :{col}" for col in updates)
            db.execute(
                text(f"UPDATE entries SET {set_clause} WHERE id = :id"),
                {"id": row.id, **updates},
            )

        if not dry_run:
            db.commit()
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()

    action = "Would encrypt" if dry_run else "Encrypted"
    print(f"{action} {updated_rows} entr{'y' if updated_rows == 1 else 'ies'}.")
    return 0


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Print which rows would change without writing",
    )
    args = parser.parse_args()
    raise SystemExit(encrypt_existing_entries(dry_run=args.dry_run))


if __name__ == "__main__":
    main()
