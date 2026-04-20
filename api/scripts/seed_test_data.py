#!/usr/bin/env python3
"""
Seed a test user + 30 mock journal entries spread across ~4 months.

Run inside the api container:
    docker exec echovault_api python scripts/seed_test_data.py

Idempotent: if the test user already exists, deletes their existing entries
and reseeds. Safe to re-run.
"""
import os
import random
import sys
from datetime import datetime, timedelta, timezone

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.celery_app import celery_app  # noqa: F401 — registers tasks
from app.core.security import get_password_hash
from app.database import SessionLocal
from app.jobs.embedding_job import enqueue_embedding_job
from app.jobs.mood_job import enqueue_mood_job
from app.models.embedding import EntryEmbedding
from app.models.entry import Entry
from app.models.settings import Settings
from app.models.user import User

TEST_EMAIL = "dev@test.com"
TEST_USERNAME = "devuser"
TEST_PASSWORD = "password123"

# 30 entries. `days_ago` fans out from ~3 to ~125. Recurring themes (running,
# work stress, dad, dating, guitar, late-night philosophy) repeat across 30+
# day gaps so Echoes has material to surface.
ENTRIES = [
    # ~4 months ago: starting points for each theme
    {
        "days_ago": 125,
        "title": "First run in years",
        "content": "Dragged myself out for a jog this morning. Made it half a mile before my lungs gave up. I used to run cross country in high school and now I can barely get around the block. Embarrassing. But I went, which is more than I can say for the last six months. Going to try again Wednesday.",
        "tags": ["running", "fitness", "health"],
        "mood_user": 2,
    },
    {
        "days_ago": 120,
        "title": "Call with dad about the job",
        "content": "Dad called to check in and it turned into another lecture about how I should have stayed at the old company. 'Stability matters at your age.' He means well but it's exhausting having the same conversation every month. I wish he could just be proud of the leap instead of worried about it.",
        "tags": ["family", "dad", "career"],
        "mood_user": 2,
    },
    {
        "days_ago": 117,
        "title": "Picked up the guitar again",
        "content": "Found my old acoustic in the closet. Strings were dead, tuning was a mess. Restrung it and played through some chords. My fingers are soft now — C major feels like stepping on thumbtacks. But there's something grounding about it. Going to try to play a little every day.",
        "tags": ["guitar", "hobbies", "music"],
        "mood_user": 3,
    },
    {
        "days_ago": 113,
        "title": "Sprint from hell",
        "content": "Twelve-hour day. PM moved the deadline up AGAIN while adding two new features. I tried to push back in standup and got told to 'find a way.' Ate lunch at my keyboard. This cadence isn't sustainable and everyone knows it but nobody will say it out loud in a meeting.",
        "tags": ["work", "stress", "burnout"],
        "mood_user": 1,
    },
    {
        "days_ago": 108,
        "title": "Coffee with Priya",
        "content": "First proper catch-up with Priya in months. She's quitting her job to do pottery full time. Half the table was horrified for her, half was jealous. I think I'm in the jealous half. We talked for three hours and I walked home feeling weirdly hopeful about my own life for no specific reason.",
        "tags": ["friends", "reflection"],
        "mood_user": 4,
    },
    {
        "days_ago": 104,
        "title": "3am determinism spiral",
        "content": "Can't sleep. Stuck on the free will question again. If every neuron firing was determined by the state of the universe a second ago, and that by the state before, all the way back — then this entry was inevitable. But it FEELS chosen. Maybe the feeling is the only thing that matters. Going to sleep. Or being made to sleep. Whatever.",
        "tags": ["philosophy", "late-night", "free-will"],
        "mood_user": 3,
    },
    {
        "days_ago": 99,
        "title": "Ran a full mile",
        "content": "Full mile without stopping today. Slow, ugly, but continuous. I remember in high school we'd warm up with two miles. But I'm not that kid anymore and this isn't that race. This is a mile that I earned at 29 years old in January. Counts different.",
        "tags": ["running", "fitness", "progress"],
        "mood_user": 4,
    },
    {
        "days_ago": 94,
        "title": "Finished Project Hail Mary",
        "content": "Stayed up way too late finishing it. Weir writes science like it's a love letter. The friendship between Grace and Rocky wrecked me in the best way. Books about problem-solving shouldn't be this emotional but here we are. Tea-eating, fist-bumping aliens my beloved.",
        "tags": ["books", "reading"],
        "mood_user": 5,
    },
    {
        "days_ago": 89,
        "title": "First date with Alex",
        "content": "Had coffee with someone from the app. Name's Alex. Was sure it was going to be a 45-minute polite exit situation but we ended up walking around the park for two hours. They asked actual questions and listened to the answers, which seems like a low bar but apparently isn't. Texted me before I even got home.",
        "tags": ["dating", "relationships", "hopeful"],
        "mood_user": 5,
    },
    {
        "days_ago": 84,
        "title": "Work might be lifting?",
        "content": "Deadline got officially pushed after leadership finally looked at the burn-down. Didn't get an apology but I'll take the time. First day in two months I left the office before sunset. Walked home the long way. Bought myself a stupidly expensive sandwich.",
        "tags": ["work", "relief"],
        "mood_user": 4,
    },
    {
        "days_ago": 79,
        "title": "G to C transition finally clean",
        "content": "Something clicked with the guitar tonight. The G to C change that's been tripping me up for a month just... happened. Over and over, clean, without looking. Muscle memory is a magic trick your body performs while you're not paying attention.",
        "tags": ["guitar", "hobbies", "progress"],
        "mood_user": 4,
    },
    {
        "days_ago": 74,
        "title": "Argument with dad, again",
        "content": "Told dad I'm seeing someone. He asked what they do. I said they're a middle school art teacher. Long pause. 'Is that a career?' I hung up. Called mom, who sighed the sigh of a woman who's been translating between us for 30 years. I love him. I just don't know how to talk to him.",
        "tags": ["family", "dad", "conflict"],
        "mood_user": 2,
    },
    {
        "days_ago": 70,
        "title": "Alex met the friends",
        "content": "Brought Alex to game night. They held their own, made Priya laugh, and lost spectacularly at Codenames but didn't sulk about it. Walked home holding hands in the cold. I'm trying not to get ahead of myself but I'm already ahead of myself.",
        "tags": ["dating", "friends", "relationships"],
        "mood_user": 5,
    },
    {
        "days_ago": 65,
        "title": "Ran 5k",
        "content": "5k this morning. No walking breaks. I'm not fast, and my knees were talking to me by the end, but I ran the whole thing. Started thinking about signing up for a real race. Six months ago I couldn't make it around the block. Progress is absurd when you let it compound.",
        "tags": ["running", "fitness", "milestone"],
        "mood_user": 5,
    },
    {
        "days_ago": 61,
        "title": "Rainy Sunday",
        "content": "Didn't leave the apartment today. Tea, a book, the sound of rain on the fire escape. Used to feel guilty about days like this. Now I think they might be the point. Nothing produced, nothing proven. Just existing in a warm room while the world does its thing outside.",
        "tags": ["rest", "self-care", "weekend"],
        "mood_user": 4,
    },
    {
        "days_ago": 56,
        "title": "Camus on the train",
        "content": "Re-reading Myth of Sisyphus on the commute. 'One must imagine Sisyphus happy.' I used to read that as cope. Now it feels like instructions. The rock will roll back down. The inbox will never be empty. The run will be hard again tomorrow. You do it anyway because it's yours to do.",
        "tags": ["philosophy", "camus", "books"],
        "mood_user": 4,
    },
    {
        "days_ago": 51,
        "title": "Learned Wonderwall",
        "content": "I know, I know. But I can now play Wonderwall start to finish without looking at the chords. Self-respect takes a hit, but the kid who started learning guitar four months ago would be thrilled. Going to pick something less embarrassing next.",
        "tags": ["guitar", "hobbies", "music"],
        "mood_user": 4,
    },
    {
        "days_ago": 46,
        "title": "Project got canceled",
        "content": "Six months of work. All the late nights, the architecture doc I was actually proud of, the weird bug in the queue consumer I finally tracked down. Leadership 'pivoted strategic priorities.' The deck had a bullet point. I got a bullet point. Going for a long run.",
        "tags": ["work", "disappointment", "career"],
        "mood_user": 1,
    },
    {
        "days_ago": 43,
        "title": "Ran until it didn't hurt",
        "content": "Ran 7 miles after the news yesterday. Didn't plan to. Just kept going because stopping meant thinking. Somewhere around mile 5 my brain got quiet. That's the real magic of it — not the fitness, not the dopamine, the quiet. Walked home in the dark feeling almost okay.",
        "tags": ["running", "mental-health"],
        "mood_user": 3,
    },
    {
        "days_ago": 39,
        "title": "Alex asked about moving in",
        "content": "Casually, like it wasn't the biggest sentence of the week. 'Would it be crazy to look at places together in the fall?' I said 'probably' and then 'but yes.' I am 29 years old and I have never felt this normal about another person. Terrifying. Good terrifying.",
        "tags": ["dating", "relationships", "commitment"],
        "mood_user": 5,
    },
    {
        "days_ago": 34,
        "title": "Dad called",
        "content": "Dad called. Didn't mention the job, the relationship, the choices. Just asked about the running. Said he used to run before his knees gave out. Talked for half an hour about nothing important. I don't know if anything changed or if he's just tired of fighting, but I'll take it.",
        "tags": ["family", "dad", "healing"],
        "mood_user": 4,
    },
    {
        "days_ago": 30,
        "title": "Promotion talk",
        "content": "Manager sat me down and used the P-word. No timeline yet, no paperwork, but 'we're putting you on the list for the next cycle.' After the canceled project I'd written this year off. Turns out senior leadership noticed the architecture work even when the product didn't ship. Tentatively delighted.",
        "tags": ["work", "career", "achievement"],
        "mood_user": 5,
    },
    {
        "days_ago": 26,
        "title": "10k race signup",
        "content": "Signed up for a 10k in six weeks. Paid the entry fee so I can't back out. A year ago this would have been delusional. Today it's a calendar item. Training plan printed and taped to the fridge. Alex rolled their eyes supportively.",
        "tags": ["running", "fitness", "goal"],
        "mood_user": 5,
    },
    {
        "days_ago": 22,
        "title": "Late night on identity",
        "content": "Can't sleep. Thinking about the Ship of Theseus. Every cell replaced, every belief updated. The version of me from a year ago would not recognize the runner, the guitar player, the person who says 'I love you' back without calculating. Is that the same person? Does it matter? Maybe identity is a verb.",
        "tags": ["philosophy", "late-night", "identity"],
        "mood_user": 3,
    },
    {
        "days_ago": 18,
        "title": "Played a song for Alex",
        "content": "Played an actual song for Alex tonight. Voice cracked on the chorus. They cried a little, which made me cry a little, which ruined the second verse. Four months ago I couldn't make a C chord. Still can't sing. Doesn't matter.",
        "tags": ["guitar", "music", "relationships"],
        "mood_user": 5,
    },
    {
        "days_ago": 14,
        "title": "Therapy first session",
        "content": "First session with a therapist today. I kept apologizing for talking too much. She said that's what the hour is for. Talked about dad, about the canceled project, about why it's easier to run 7 miles than sit with a feeling for 7 minutes. Homework is to just notice. That's it. Notice.",
        "tags": ["therapy", "mental-health", "growth"],
        "mood_user": 4,
    },
    {
        "days_ago": 10,
        "title": "Work is good again",
        "content": "New project kicked off and it's actually interesting. Smaller team, clearer scope, a staff engineer who gives feedback like a human. Left at 6pm three days in a row this week. I forgot work could feel like this. Don't want to jinx it by saying too much.",
        "tags": ["work", "career"],
        "mood_user": 4,
    },
    {
        "days_ago": 7,
        "title": "Ran 8 miles",
        "content": "Longest run of my life. Eight miles, felt strong the whole way. Passed the half-mile mark where I'd tapped out on that first embarrassing jog in December and laughed out loud. Same sidewalk. Different body. Different head.",
        "tags": ["running", "fitness", "milestone"],
        "mood_user": 5,
    },
    {
        "days_ago": 4,
        "title": "Dinner at dad's",
        "content": "Drove out to see dad. He cooked — badly, like always — and we watched a game neither of us cared about. Alex came along. Dad called them 'kid' and asked about their teaching. No lectures, no corrections. At the door he hugged me longer than usual. Didn't say anything. Didn't need to.",
        "tags": ["family", "dad", "relationships"],
        "mood_user": 5,
    },
    {
        "days_ago": 2,
        "title": "Quiet morning",
        "content": "Alex is still asleep. Made pour-over, sat by the window, watched the light come up. Thinking about where I was four months ago: wrecked from work, avoiding dad's calls, unable to jog to the corner. None of the big things changed overnight. All of them changed a little every day until I looked up and the view was different.",
        "tags": ["reflection", "gratitude", "morning"],
        "mood_user": 5,
    },
]


def main() -> int:
    assert len(ENTRIES) == 30, f"expected 30 entries, got {len(ENTRIES)}"

    db = SessionLocal()
    try:
        user = db.query(User).filter(User.email == TEST_EMAIL).first()
        if user is None:
            user = User(
                email=TEST_EMAIL,
                username=TEST_USERNAME,
                hashed_password=get_password_hash(TEST_PASSWORD),
                is_active=True,
            )
            db.add(user)
            db.flush()
            print(f"Created user {TEST_EMAIL} (id={user.id})")
        else:
            print(f"User {TEST_EMAIL} already exists (id={user.id}) — reseeding entries")

        if db.query(Settings).filter(Settings.user_id == user.id).first() is None:
            db.add(Settings(user_id=user.id))

        existing_ids = [eid for (eid,) in db.query(Entry.id).filter(Entry.user_id == user.id).all()]
        if existing_ids:
            db.query(EntryEmbedding).filter(EntryEmbedding.entry_id.in_(existing_ids)).delete(
                synchronize_session=False
            )
            db.query(Entry).filter(Entry.user_id == user.id).delete(synchronize_session=False)
            print(f"Removed {len(existing_ids)} existing entries + embeddings")

        db.commit()

        now = datetime.now(timezone.utc)
        created_ids: list[int] = []
        for data in ENTRIES:
            created_at = now - timedelta(
                days=data["days_ago"],
                hours=random.randint(6, 22),
                minutes=random.randint(0, 59),
            )
            entry = Entry(
                user_id=user.id,
                title=data["title"],
                content=data["content"],
                tags=data["tags"],
                mood_user=data["mood_user"],
                created_at=created_at,
                is_deleted=False,
            )
            db.add(entry)
            db.flush()
            created_ids.append(entry.id)

        db.commit()
        print(f"Inserted {len(created_ids)} entries for {TEST_EMAIL}")

        for entry_id in created_ids:
            enqueue_embedding_job(entry_id)
            enqueue_mood_job(entry_id)
        print(f"Enqueued {len(created_ids)} embedding + {len(created_ids)} mood jobs")

        print()
        print("=" * 50)
        print("LOGIN CREDENTIALS")
        print("=" * 50)
        print(f"  email:    {TEST_EMAIL}")
        print(f"  username: {TEST_USERNAME}")
        print(f"  password: {TEST_PASSWORD}")
        print(f"  URL:      http://localhost:3000/login")
        return 0
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


if __name__ == "__main__":
    sys.exit(main())
