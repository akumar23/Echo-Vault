#!/usr/bin/env python3
"""
Seed 50 dummy journal entries for the test user, spread evenly over the
last ~50 weeks. Each entry gets a mood_user label (mood-balanced across 1-5
so the few-shot calibrator has data) and varied tags for related-entry ranking.

After writing rows, the script enqueues mood jobs for each entry.
"""
from datetime import datetime, timedelta, timezone

from app.database import SessionLocal
from app.models.entry import Entry
from app.models.user import User
from app.jobs.mood_job import enqueue_mood_job


SEED_USER_EMAIL = "dev@test.com"
TOTAL_ENTRIES = 50
DAYS_BETWEEN_ENTRIES = 7  # ~50 weeks spread


ENTRIES = [
    # (title, content, mood_user 1-5)
    ("First day back at the office",
     "Tried to settle in to the new desk arrangement but couldn't shake the feeling of being behind. The open-plan layout means I can hear every conversation, and three different meetings happened within earshot before lunch. Will adjust, but the focus tax is real.",
     2),
    ("Slow walk through the park at dusk",
     "Did a loop around the lake at last light. The gold through the trees was the kind that makes you stop. Sat on the bench by the rowing club for twenty minutes and watched the geese argue about something I couldn't decipher.",
     4),
    ("Mom called",
     "She's worried about Dad's appointment next week but trying not to show it. Told her I'd come visit weekend after next. Hung up feeling both grateful and the familiar tug of guilt about distance.",
     3),
    ("Crushed the morning run",
     "First sub-25-minute 5K in three months. The cool air helped. My legs felt heavy at the start but by kilometer two I was floating. Need to remember this feeling next time I'm tempted to skip.",
     5),
    ("Anxiety about the project review",
     "The review is in eight days and I can't tell if I'm overprepared or underprepared, which usually means underprepared. Made a list of every outstanding task. The list is longer than I thought.",
     2),
    ("Slow Sunday with coffee and a book",
     "Started the new Le Guin and forgot about my phone for three hours. The coffee was good, the chair was the right amount of broken-in, and I had nowhere to be. Days like this used to feel like waste; now they feel like rescue.",
     5),
    ("Rough conversation with my manager",
     "Feedback I asked for that I wasn't ready to hear. The substance was fair. The delivery was the kind that lingers. Walked the long way home to let it settle. Will reread my notes tomorrow when the sting fades.",
     1),
    ("Cooked the lentil thing again",
     "Same recipe as last month. Came out better — I think the trick is starting with cold oil. Ate it standing in the kitchen because the table was covered in laundry I haven't folded.",
     3),
    ("Caught up with Sam after months",
     "Three hours of conversation that felt like twenty minutes. Sam has a new job, a new apartment, and an old worry I hadn't heard about. We promised not to wait this long next time. We always promise that.",
     4),
    ("Couldn't sleep again",
     "Awake from 2 to 4:30 turning over the same five thoughts. Got up, made tea, watched the streetlight cycle. The thoughts weren't urgent in daylight but at 3am they felt enormous.",
     2),
    ("Doctor's appointment went fine",
     "Bloodwork came back unremarkable. The doctor used the word 'unremarkable' like it was a gift. Walked out and immediately wanted to eat something with vegetables.",
     4),
    ("Bombed the technical interview",
     "Went blank on a question I'd seen a dozen times. Recovered enough to finish but the gap was visible. Spent the afternoon replaying it. Need to stop replaying it.",
     1),
    ("Garden update",
     "The basil is leggy. The tomatoes are doing better than they deserve given how little I've watered. Spent an hour pulling weeds and didn't think about work once. That alone was worth the dirt under the nails.",
     4),
    ("Birthday dinner with Chris and Maya",
     "Maya's 30. We ate too much and laughed about nothing in particular and Chris told the same story about the trip we took in 2019. The repetition didn't bother me; it was kind of the point.",
     5),
    ("The big meeting",
     "Went as well as it could have. The slides held. The hard question came and I had an answer. Walked out lighter than I went in. Took the rest of the afternoon to come down.",
     4),
    ("Cold and tired",
     "Came down with something on Wednesday and it's lingering. Worked half a day, gave up, slept fourteen hours. The body keeps its own books.",
     2),
    ("Letter to no one",
     "Wrote three pages about a conversation I haven't had and probably won't. Didn't fix anything. Felt better anyway. Something about getting it out of my head and onto a page makes it smaller.",
     3),
    ("Music discovery night",
     "Pulled up an album I'd seen recommended for months and let it play start to finish without my phone. The third track stopped me. Played it five more times. The right song at the right time is its own kind of medicine.",
     4),
    ("Argument with my brother",
     "Old wound, same shape, fresh reason. We hung up still mad. He'll text in three days like nothing happened; he always does. I'm not sure if I want him to.",
     1),
    ("Coffee with the new neighbor",
     "Marta from across the hall. She's a translator, works from home, moved here from Lisbon eight months ago. We compared notes on which corner bodegas are good. Made plans for a proper dinner sometime.",
     4),
    ("Snow day",
     "Cancelled everything. Watched it come down for an hour with my hands around a mug. Pretended I was someone in a book. Eventually shoveled the steps so the mail carrier wouldn't slip.",
     5),
    ("Frustrated with the codebase",
     "Spent four hours tracing one bug only to find it was a comment lying about what the function did. Considered, briefly, a career in carpentry. Fixed the comment first.",
     2),
    ("Yoga class after months away",
     "Stiffer than I remembered. The teacher was the same one I had two years ago and she pretended not to notice my absence. By the end I felt the version of myself I keep meaning to be.",
     4),
    ("Dad's surgery is scheduled",
     "Talked to Mom and to Dad separately. Mom is doing the worrying; Dad is doing the bravado. Both of them sound exhausted. Booked the flight before I could second-guess it.",
     2),
    ("Quiet day, nothing remarkable",
     "Worked, ate, walked, slept. Not every day needs a story. Logging this because I'm trying to notice the in-between ones.",
     3),
    ("Got the offer",
     "Six weeks of waiting and the email came at 4:47pm. Sat with it for an hour before telling anyone. Wanted to know what it felt like before someone else's reaction colored mine. It felt good. Still does.",
     5),
    ("Trip to Boston for the weekend",
     "Saw two friends, ate three good meals, walked the river at sunset. The train back was on time. Came home tired in the good way.",
     5),
    ("Insomnia, round two",
     "Another bad night. The thoughts had a new flavor this time — not work, but a vague dread about a thing I haven't done yet. Read until 4. Slept until 7. Coffee carried the morning.",
     2),
    ("Bookshop find",
     "Wandered in to kill twenty minutes and came out with a slim hardcover I'd never heard of. The cover was orange. The first paragraph was a knife. Sometimes the algorithm misses what the shelf catches.",
     4),
    ("Performance review",
     "Better than expected. The feedback I'd been bracing for didn't come. The praise I hadn't expected did. Walked to the train trying to integrate the new information.",
     4),
    ("Cried at a commercial",
     "Insurance ad, of all things. A son visiting his father. Caught me off guard at the kitchen table. Sat with it for a minute and then made dinner.",
     2),
    ("Long bike ride",
     "Sixty kilometers out to the reservoir and back. Legs ruined, head clear. The combination is worth the soreness. Listened to a podcast about beekeeping and learned nothing useful.",
     5),
    ("Lost the document",
     "Three hours of work, unsaved, vanished. Did the rage cycle, the bargaining cycle, the acceptance cycle, the rewrite cycle. The rewrite was probably better. Won't admit that to anyone.",
     2),
    ("Therapy",
     "Talked about the brother thing. Talked about the work thing. Talked about the thing under the things. Came out lighter than I went in. The fee feels less ridiculous when this happens.",
     3),
    ("Bread is in the oven",
     "First loaf in months. Crust looks promising. Whole apartment smells like the version of myself I imagine on Saturdays. Will report back after slicing.",
     4),
    ("Funeral",
     "An old colleague. Hadn't seen them in a decade. Sat near the back. The eulogies were the kind that make you want to call everyone you've been meaning to call.",
     1),
    ("Quiet evening alone",
     "Made pasta, watched something forgettable, was in bed by ten. The kind of evening that used to feel like a failure. Lately it feels like the only sensible response to the week.",
     3),
    ("Argument resolved",
     "My brother called. We didn't dig into it; we mostly talked around it. By the end we'd agreed about nothing and somehow felt better. Family is its own language.",
     3),
    ("Promotion announcement",
     "Made official in the all-hands. Got texts from people I haven't spoken to in years. Tried to enjoy it without letting it change how I think about the work. Mixed success.",
     5),
    ("Slow week",
     "Nothing went wrong; nothing went right. Worked through a list. Made the list shorter. Will probably make a new list tomorrow.",
     3),
    ("Saw an old friend in town",
     "Anya is in for a conference. We met for an hour between her sessions and packed in a year of catching up. She's the same; I'm the same; the friendship is the same. Comforting.",
     4),
    ("Dropped the phone in the toilet",
     "Rice for 24 hours. Spent the day strangely disconnected and strangely relieved. The phone lived. The relief outlasted the panic.",
     3),
    ("Quiet sadness",
     "No reason I can name. Walked to work and the sadness walked with me. By the afternoon it had thinned to background. Logging it because I want to see the pattern.",
     2),
    ("Cooking project",
     "Tried the ramen recipe I've been bookmarking for two years. Took five hours. Worth four of them. The broth was the part I expected to fail and it was the part that worked.",
     4),
    ("Long phone call with Dad",
     "First real talk since the surgery. He sounds like himself. He's grumbling about the physical therapist, which means he's fine. I let him grumble.",
     4),
    ("Walked home in the rain",
     "Forgot the umbrella, gave up two blocks in, leaned into it. By the end I was soaked and laughing. The kid I used to be was somewhere in that.",
     4),
    ("Stuck on the same problem",
     "Third day on this. The shape of the bug keeps changing the closer I look. Will sleep on it. Sometimes my brain solves things while I'm not watching.",
     2),
    ("New apartment, first night",
     "Boxes everywhere, mattress on the floor, neighbors I haven't met yet. Lay awake listening to the unfamiliar pipes. Excited and a little hollowed-out. Big change does that.",
     3),
    ("Found my old journal",
     "From eight years ago. Read for an hour. The person on those pages was so worried about things that turned out to be fine. Tried to extend the same courtesy to my current self.",
     4),
    ("End-of-year reflection",
     "More good than bad. Closer with the people I want to be close with. Further from a few habits I'd rather be done with. The year wasn't what I planned. None of them are.",
     4),
]

assert len(ENTRIES) == TOTAL_ENTRIES, f"Expected {TOTAL_ENTRIES} templates, got {len(ENTRIES)}"


def main():
    db = SessionLocal()
    try:
        user = db.query(User).filter(User.email == SEED_USER_EMAIL).first()
        if not user:
            print(f"ERROR: user {SEED_USER_EMAIL} not found. Run create_test_user.py first.")
            return

        # Mood distribution check — should be roughly balanced 1-5 for the
        # few-shot calibrator to have signal at every level.
        from collections import Counter
        mood_dist = Counter(m for _, _, m in ENTRIES)
        print(f"Mood distribution: {dict(sorted(mood_dist.items()))}")

        # Evenly spaced timestamps: most recent entry today, oldest ~50 weeks ago.
        now = datetime.now(timezone.utc)
        # Reverse-iterate so the FIRST entry in ENTRIES sits ~50 weeks back
        # and the LAST is most recent — matches the chronological feel of the
        # template list (a "year" of journal entries).
        rows = []
        for i, (title, content, mood) in enumerate(ENTRIES):
            # i=0 -> oldest, i=49 -> newest
            days_back = (TOTAL_ENTRIES - 1 - i) * DAYS_BETWEEN_ENTRIES
            ts = now - timedelta(days=days_back)
            rows.append(
                Entry(
                    user_id=user.id,
                    title=title,
                    content=content,
                    tags=[],
                    mood_user=mood,
                    created_at=ts,
                )
            )

        db.add_all(rows)
        db.commit()
        # Refresh so we have IDs for the job enqueue step
        for r in rows:
            db.refresh(r)

        print(f"Wrote {len(rows)} entries for user {user.email} (id={user.id}).")
        print(f"Date range: {rows[0].created_at.date()} → {rows[-1].created_at.date()}")

        # Enqueue background jobs. The Celery worker picks these up and
        # runs Ollama calls in the background — total runtime ~5-15 min.
        print("Enqueueing mood inference jobs...")
        for r in rows:
            enqueue_mood_job(r.id)
        print(f"Enqueued {len(rows)} mood jobs.")
        print("")
        print("Done. Monitor worker progress with:")
        print("  docker compose logs -f worker")

    except Exception as e:
        db.rollback()
        print(f"ERROR: {e}")
        raise
    finally:
        db.close()


if __name__ == "__main__":
    main()
