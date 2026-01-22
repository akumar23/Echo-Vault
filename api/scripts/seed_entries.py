#!/usr/bin/env python3
"""
Seed script to add dummy journal entries for a user.
Run from api directory: python scripts/seed_entries.py
"""

import sys
import os
from datetime import datetime, timedelta
import random

# Add parent directory to path for imports
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy.orm import Session
from app.database import SessionLocal
from app.models.user import User
from app.models.entry import Entry

# Dummy entries with varied moods and topics
DUMMY_ENTRIES = [
    {
        "title": "First date jitters",
        "content": """Had coffee with Sarah today. I was so nervous I almost spilled my latte twice. But once we started talking, everything just flowed. We talked for three hours without even noticing. She has this amazing laugh that makes her whole face light up. Already looking forward to seeing her again. Maybe I'm getting ahead of myself, but there's definitely something special here.""",
        "tags": ["relationships", "dating", "hopeful"],
        "mood_user": 4,
        "days_ago": 45,
    },
    {
        "title": "Watched Oppenheimer",
        "content": """Finally got around to watching Oppenheimer. Three hours flew by. Cillian Murphy's performance was haunting - the way he portrayed the weight of creating something so destructive. The film left me thinking about moral responsibility and the things we create that take on lives of their own. Also, that courtroom scene was intense. Nolan really outdid himself with the non-linear storytelling.""",
        "tags": ["movies", "reflection", "history"],
        "mood_user": 3,
        "days_ago": 38,
    },
    {
        "title": "Work is draining me",
        "content": """Another 12-hour day. The sprint deadline is killing us. Manager keeps adding features but won't adjust the timeline. I barely have time to eat lunch at my desk. Starting to feel like just a code-producing machine. The worst part is I know this isn't sustainable but don't see a way out right now. Need to start setting better boundaries.""",
        "tags": ["work", "stress", "burnout"],
        "mood_user": 2,
        "days_ago": 32,
    },
    {
        "title": "Sunday morning basketball",
        "content": """Played pickup basketball at the park this morning. It's been months since I touched a ball. My shot was rusty but my legs held up better than expected. There's something pure about playing a sport just for fun - no stakes, just movement and laughter. Made a sweet crossover that got everyone hyped. Need to make this a regular thing again.""",
        "tags": ["hobbies", "basketball", "exercise"],
        "mood_user": 5,
        "days_ago": 28,
    },
    {
        "title": "Argument with dad",
        "content": """Called dad about Thanksgiving plans and somehow it turned into another argument about my career choices. He still doesn't understand why I left the stable corporate job for a startup. \"Security matters\" he keeps saying. I know he's coming from a place of love and his own experiences, but I wish he could see that I need to take risks now while I can. Left the call feeling frustrated and misunderstood.""",
        "tags": ["family", "conflict", "career"],
        "mood_user": 2,
        "days_ago": 25,
    },
    {
        "title": "Learning guitar progress",
        "content": """Finally nailed the chord transition from G to C without looking! It's a small thing but after weeks of clumsy fumbling, my fingers are starting to develop muscle memory. Practiced for an hour today and it flew by. Working on Wonderwall now (yes, I know it's cliche but it's a good beginner song). The calluses on my fingertips are becoming a badge of honor.""",
        "tags": ["hobbies", "guitar", "learning", "music"],
        "mood_user": 4,
        "days_ago": 20,
    },
    {
        "title": "Project got canceled",
        "content": """The project I've been pouring my heart into for 6 months got axed today. Leadership decided to \"pivot strategic priorities.\" All that code, all those late nights, all those problems I solved - just gone. I know intellectually that this happens in tech, but it still stings. Feeling pretty demotivated. What was even the point?""",
        "tags": ["work", "disappointment", "career"],
        "mood_user": 1,
        "days_ago": 15,
    },
    {
        "title": "Rainy day reading",
        "content": """Spent the whole afternoon on the couch with a cup of tea and finished \"Project Hail Mary.\" What a ride. The science was fascinating and the emotional core of the story really got to me. Sometimes a rainy day indoors with a good book is exactly what the soul needs. No guilt, no productivity pressure, just pure enjoyment.""",
        "tags": ["reading", "books", "relaxation"],
        "mood_user": 4,
        "days_ago": 12,
    },
    {
        "title": "Friend's wedding",
        "content": """Mark and Lisa's wedding was beautiful. Seeing two people so clearly in love made my heart full. But I'd be lying if I said there wasn't a small pang of loneliness watching everyone slow dance with their partners. At 28, weddings hit different. Still, the open bar helped, and catching up with old college friends was genuinely great. Mixed emotions kind of day.""",
        "tags": ["friends", "wedding", "relationships", "reflection"],
        "mood_user": 3,
        "days_ago": 7,
    },
    {
        "title": "Morning run breakthrough",
        "content": """Ran 5 miles without stopping for the first time ever! Started this running habit two months ago barely able to do one mile. The key was slowing down and not caring about pace. This morning, everything clicked - my breathing was steady, my legs felt strong, and I actually enjoyed it instead of counting down the minutes. Proof that consistency beats intensity.""",
        "tags": ["running", "fitness", "achievement", "health"],
        "mood_user": 5,
        "days_ago": 3,
    },
]


def seed_entries_for_user(db: Session, username: str):
    """Add dummy entries for the specified user."""
    user = db.query(User).filter(User.username == username).first()

    if not user:
        print(f"Error: User '{username}' not found in database.")
        print("Available users:")
        users = db.query(User).all()
        for u in users:
            print(f"  - {u.username} (id: {u.id})")
        return False

    print(f"Found user '{username}' (id: {user.id})")

    # Add entries
    entries_created = 0
    for entry_data in DUMMY_ENTRIES:
        created_at = datetime.now() - timedelta(
            days=entry_data["days_ago"],
            hours=random.randint(0, 23),
            minutes=random.randint(0, 59)
        )

        entry = Entry(
            user_id=user.id,
            title=entry_data["title"],
            content=entry_data["content"],
            tags=entry_data["tags"],
            mood_user=entry_data["mood_user"],
            created_at=created_at,
            is_deleted=False,
        )
        db.add(entry)
        entries_created += 1
        print(f"  Created: '{entry_data['title']}' (mood: {entry_data['mood_user']}, date: {created_at.strftime('%Y-%m-%d')})")

    db.commit()
    print(f"\nSuccessfully created {entries_created} entries for user '{username}'.")
    return True


def main():
    username = "ary"  # Default user

    if len(sys.argv) > 1:
        username = sys.argv[1]

    print(f"Seeding journal entries for user: {username}")
    print("-" * 50)

    db = SessionLocal()
    try:
        seed_entries_for_user(db, username)
    finally:
        db.close()


if __name__ == "__main__":
    main()
