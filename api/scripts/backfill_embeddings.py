#!/usr/bin/env python3
"""
Backfill embeddings and mood inference for entries missing them.
Run from api directory: python scripts/backfill_embeddings.py [username]
"""

import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy.orm import Session
from app.database import SessionLocal
from app.models.user import User
from app.models.entry import Entry
from app.models.embedding import EntryEmbedding
from app.jobs.embedding_job import enqueue_embedding_job
from app.jobs.mood_job import enqueue_mood_job


def backfill_for_user(db: Session, username: str):
    """Enqueue embedding and mood jobs for entries missing embeddings."""
    user = db.query(User).filter(User.username == username).first()

    if not user:
        print(f"Error: User '{username}' not found.")
        return False

    # Find entries without embeddings
    entries = db.query(Entry).filter(
        Entry.user_id == user.id,
        Entry.is_deleted == False
    ).all()

    print(f"Found {len(entries)} entries for user '{username}'")

    jobs_enqueued = 0
    for entry in entries:
        # Check if embedding exists
        existing_embedding = db.query(EntryEmbedding).filter(
            EntryEmbedding.entry_id == entry.id,
            EntryEmbedding.is_active == True
        ).first()

        if not existing_embedding:
            print(f"  Enqueueing jobs for: '{entry.title}' (id: {entry.id})")
            enqueue_embedding_job(entry.id)
            enqueue_mood_job(entry.id)
            jobs_enqueued += 1
        else:
            print(f"  Skipping (already has embedding): '{entry.title}'")

    print(f"\nEnqueued {jobs_enqueued} embedding/mood job pairs.")
    print("Check worker logs: docker compose logs -f worker")
    return True


def main():
    username = "ary"
    if len(sys.argv) > 1:
        username = sys.argv[1]

    print(f"Backfilling embeddings for user: {username}")
    print("-" * 50)

    db = SessionLocal()
    try:
        backfill_for_user(db, username)
    finally:
        db.close()


if __name__ == "__main__":
    main()
