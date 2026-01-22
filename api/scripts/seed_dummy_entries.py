#!/usr/bin/env python3
"""
Seed dummy journal entries for testing/demo purposes.
Run from api/ directory: python scripts/seed_dummy_entries.py
"""
import sys
import os
from datetime import datetime, timedelta
import random

# Add parent directory to path for imports
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from app.models.user import User
from app.models.entry import Entry
from app.database import Base

# Database URL - uses same as docker-compose
DATABASE_URL = os.environ.get(
    "DATABASE_URL",
    "postgresql+psycopg://echovault:echovault@localhost:5432/echovault"
)

# Dummy entries with various moods and topics
DUMMY_ENTRIES = [
    {
        "title": "Coffee with Sarah",
        "content": """Had coffee with Sarah today after almost three months. It was really nice catching up with her. She's been going through a rough patch with her job, and I tried my best to be supportive. We talked for hours about old times and future plans. I forgot how much I missed these long conversations. Sometimes friendships need nurturing, and I'm glad we made time for each other. Planning to make this a monthly thing.""",
        "tags": ["friends", "coffee", "relationships"],
        "mood_user": 4,
        "days_ago": 45
    },
    {
        "title": "Watched Oppenheimer",
        "content": """Finally watched Oppenheimer. The cinematography was stunning - those IMAX shots of the bomb test were breathtaking. Cillian Murphy absolutely deserved that Oscar. The movie left me thinking about the weight of scientific discovery and moral responsibility. Three hours flew by. I love when a film stays with you long after the credits roll. Need to rewatch some Nolan classics now.""",
        "tags": ["movies", "nolan", "oppenheimer"],
        "mood_user": 5,
        "days_ago": 38
    },
    {
        "title": "Work stress hitting hard",
        "content": """Another frustrating day at work. The deadline for the product launch keeps getting moved up, but the scope keeps expanding. Had a tense meeting with the PM where I tried to explain that we can't do quality work under these conditions. They nodded but I doubt anything will change. Coming home exhausted every day. Need to find better ways to manage this stress or it's going to burn me out.""",
        "tags": ["work", "stress", "burnout"],
        "mood_user": 2,
        "days_ago": 30
    },
    {
        "title": "First time bouldering",
        "content": """Tried indoor bouldering for the first time with Jake. My forearms are absolutely destroyed but it was so much fun! There's something primal about climbing - problem-solving with your body. Failed spectacularly on a V2 route but managed to complete a few V0s and V1s. Already want to go back. Might have found a new hobby. My grip strength needs serious work though.""",
        "tags": ["bouldering", "hobbies", "fitness", "friends"],
        "mood_user": 5,
        "days_ago": 25
    },
    {
        "title": "Argument with Mom",
        "content": """Had a difficult conversation with Mom today about her visiting next month. It escalated into an argument about boundaries and expectations. She doesn't understand why I can't take a week off work just because she wants to visit. I feel guilty but also frustrated. We've always had this push and pull. Need to find a balance between being a good son and protecting my own mental health. Texted her later to apologize for raising my voice.""",
        "tags": ["family", "relationships", "boundaries"],
        "mood_user": 2,
        "days_ago": 20
    },
    {
        "title": "Cooking experiment success",
        "content": """Made homemade ramen from scratch today - the whole thing, broth and all. Took nearly 6 hours but the result was incredible. The soft-boiled eggs came out perfect, golden yolks and everything. Posted pics and got so many nice comments. There's something deeply satisfying about creating a meal from scratch. Cooking is becoming my meditation. Already planning what to try next weekend.""",
        "tags": ["cooking", "hobbies", "food", "weekend"],
        "mood_user": 5,
        "days_ago": 15
    },
    {
        "title": "Feeling isolated lately",
        "content": """Been feeling disconnected from everyone lately. Working from home has its perks but the isolation is real. Realized I haven't had a meaningful in-person conversation in almost two weeks. Scrolling through social media just makes it worse - everyone seems to be living fuller lives. I know comparison is the thief of joy but it's hard not to. Maybe I should join a club or something to meet new people.""",
        "tags": ["loneliness", "mental-health", "wfh"],
        "mood_user": 2,
        "days_ago": 12
    },
    {
        "title": "Promotion talk went well",
        "content": """Had my performance review today and my manager hinted strongly at a promotion coming in Q2. All the late nights and extra effort might actually be paying off. She specifically mentioned the architecture redesign I led last quarter. Feeling validated but also cautious - don't want to count chickens before they hatch. Celebrated with a nice dinner. Whatever happens, at least I know my work is being recognized.""",
        "tags": ["work", "career", "achievement"],
        "mood_user": 4,
        "days_ago": 8
    },
    {
        "title": "Date night disaster",
        "content": """The date tonight was... not great. We had nothing in common and the conversation felt forced the entire time. They spent half the dinner on their phone. I tried to be engaging but it was like talking to a wall. At least the restaurant was good. Starting to wonder if dating apps are even worth the effort. Maybe I should take a break and focus on other things for a while. Quality over quantity.""",
        "tags": ["dating", "relationships", "weekend"],
        "mood_user": 2,
        "days_ago": 5
    },
    {
        "title": "Sunday morning peace",
        "content": """Woke up early, made pour-over coffee, and spent the morning reading on the balcony. The weather was perfect - crisp but sunny. Finished the book I've been reading for weeks. No plans, no obligations, just existing peacefully. These quiet moments are what I live for. Sometimes the best days are the ones where nothing happens at all. Feeling recharged and ready for the week ahead.""",
        "tags": ["weekend", "self-care", "reading", "peace"],
        "mood_user": 5,
        "days_ago": 2
    }
]

# Additional entries - movies, philosophy, TV show appreciation
EXTRA_ENTRIES = [
    # Day 45 - same as Coffee with Sarah
    {
        "title": "Rewatched Blade Runner 2049",
        "content": """Put on Blade Runner 2049 again. Villeneuve is a master. Every single frame could be a painting. The way he uses silence and negative space - most directors would be terrified of those long pauses but he leans into them. K's journey from obedient replicant to someone who believes he might matter, only to discover he doesn't - and choosing to matter anyway. That's the whole human condition right there. We're all looking for proof we're special, but maybe the point is to choose meaning regardless. Roger Deakins deserved every award for this cinematography. That orange Vegas sequence lives rent-free in my head.""",
        "tags": ["movies", "blade-runner", "villeneuve", "sci-fi"],
        "mood_user": 5,
        "days_ago": 45
    },
    {
        "title": "On the nature of identity",
        "content": """Can't stop thinking about the Ship of Theseus lately. If you replace every plank of a ship, is it still the same ship? Applied to humans - every cell in our body gets replaced over years. The me from 10 years ago shares almost no physical matter with current me. Are we the same person? I think continuity of consciousness is the answer but that's shaky too. We lose consciousness every night when we sleep. Are we dying and being reborn each morning? And if a perfect copy of you was made, with all your memories, which one is really you? Both? Neither? Philosophy breaks my brain in the best way. Need to read more Parfit.""",
        "tags": ["philosophy", "identity", "consciousness", "thoughts"],
        "mood_user": 4,
        "days_ago": 45
    },
    # Day 38 - same as Oppenheimer
    {
        "title": "Mr. Robot appreciation post",
        "content": """Started rewatching Mr. Robot and god this show is a masterpiece. Elliot Alderson might be the most well-written character in television history. The way Sam Esmail portrays mental illness - it's not glamorized, it's not demonized, it's just... shown. Raw and real. The cinematography with all those uncomfortable framings where characters are pushed to the edges - it makes you feel as off-balance as Elliot does. And Rami Malek. The way he can convey entire emotional arcs with just his eyes. The twist at the end of season 1 genuinely broke me. "You're not seeing what's above you." Chills every time. This show understood something about alienation in the digital age that nothing else has captured.""",
        "tags": ["tv-shows", "mr-robot", "mental-health", "appreciation"],
        "mood_user": 5,
        "days_ago": 38
    },
    {
        "title": "The absurdity of everything",
        "content": """Reading Camus again. The Myth of Sisyphus hits different when you're older. "One must imagine Sisyphus happy." That used to sound like cope to me. Now I get it. The rock will always roll back down. The inbox will never be empty. The laundry will always need doing. Life is repetition without inherent meaning. But that's not depressing - it's liberating. If nothing matters cosmically, then what matters is what we decide matters. Sisyphus owns his rock. That's the rebellion. Not suicide, not false hope in gods, just... owning your struggle. Making it yours. Rolling the rock because YOU choose to. Camus would've been a great shitposter.""",
        "tags": ["philosophy", "camus", "absurdism", "existentialism"],
        "mood_user": 4,
        "days_ago": 38
    },
    # Day 30 - same as Work stress
    {
        "title": "Why Saul Goodman is a tragic masterpiece",
        "content": """Been thinking about Jimmy McGill becoming Saul Goodman. What makes that transformation so devastating is how understandable each step is. Chuck's rejection, Kim's departure, the constant message that playing it straight gets you nowhere. "I broke my boy." Howard saw it. Everyone saw it but couldn't stop it. The tragedy isn't that Jimmy is evil - it's that Saul is a defense mechanism. It's Jimmy protecting himself from a world that kept kicking him while he was down. And then in the finale, choosing to be Jimmy again, accepting the consequences, proving Chuck wrong by proving Chuck right - the character writing here is insane. Bob Odenkirk deserved every Emmy they never gave him.""",
        "tags": ["tv-shows", "better-call-saul", "breaking-bad", "character-study"],
        "mood_user": 4,
        "days_ago": 30
    },
    {
        "title": "Late night determinism spiral",
        "content": """3am thought: if the universe is deterministic, if every action is just atoms bouncing around according to physics, do we have free will? Every thought I'm having right now was determined by the state of the universe at the big bang. This journal entry was inevitable. My choice to write it wasn't a choice at all. But it FEELS like choice. Consciousness is weird. Maybe free will is like a user interface - the actual computation happening underneath is deterministic but we experience it as choice because that's useful for survival. Or maybe quantum indeterminacy saves us? But randomness isn't freedom either. Ugh. Why do I do this to myself at 3am. Going to sleep now. Or am I? Was this decision made for me 14 billion years ago?""",
        "tags": ["philosophy", "free-will", "determinism", "late-night"],
        "mood_user": 3,
        "days_ago": 30
    },
    # Day 25 - same as Bouldering
    {
        "title": "There Will Be Blood thoughts",
        "content": """Watched There Will Be Blood for maybe the fifth time. Daniel Day-Lewis as Daniel Plainview is terrifying because you understand him. "I have a competition in me." He's not a villain who wants to do evil - he's a man whose drive for success has hollowed him out completely. That final scene with the bowling alley. "I'm finished." The ambiguity of whether he means the milkshake or himself or everything. Paul Thomas Anderson never explains, never moralizes, just shows. And that score by Jonny Greenwood - dissonant, oppressive, brilliant. This movie is about capitalism eating the soul. It's about loneliness as the price of ambition. It's about milkshakes. Masterpiece.""",
        "tags": ["movies", "there-will-be-blood", "pta", "daniel-day-lewis"],
        "mood_user": 5,
        "days_ago": 25
    },
    {
        "title": "On the hedonic treadmill",
        "content": """The hedonic treadmill is brutal when you really think about it. Win the lottery? You'll adapt and be back to baseline happiness in like a year. Get paralyzed in an accident? Same thing - you'll adapt and return to roughly your previous happiness level. We're not wired for sustained happiness, just for wanting. Evolution doesn't care if you're happy, just if you keep chasing. Every achievement, every acquisition, every milestone - there's a brief spike and then we're looking for the next thing. It's exhausting and also kind of beautiful? The treadmill means we're resilient. Bad things don't destroy us permanently. But it also means the American Dream is kind of a scam. More stuff won't make you happier. Only thing that seems to beat the treadmill is relationships and meaningful work. Noted.""",
        "tags": ["philosophy", "psychology", "happiness", "thoughts"],
        "mood_user": 3,
        "days_ago": 25
    },
    # Day 20 - same as Argument with Mom
    {
        "title": "Whiplash is actually terrifying",
        "content": """Watched Whiplash again and I have conflicting feelings. JK Simmons deserved that Oscar obviously - Fletcher is one of the great movie villains. But here's the thing that bothers me: the movie kind of agrees with him? Andrew becomes great BECAUSE of the abuse. The final scene is triumphant. He earns Fletcher's approval. But that's... bad? Right? The movie shows abuse working, which is dangerous. Or maybe it's saying Andrew is now just as broken as Fletcher, and we're meant to see that ending as tragedy masked as triumph. Damien Chazelle loves his ambiguous endings. The drumming sequences are edited like action scenes and it works perfectly. Cinema.""",
        "tags": ["movies", "whiplash", "jazz", "film-analysis"],
        "mood_user": 4,
        "days_ago": 20
    },
    {
        "title": "What even is time",
        "content": """Trying to wrap my head around time. Block universe theory says past, present, and future all exist simultaneously - we just experience time as flowing because of how our brains work. But if the future already exists, then it's fixed, then we're back to determinism. Unless the block universe is constantly branching (many worlds interpretation). Every decision creates new blocks. Infinite yous living infinite lives. Somewhere there's a version of me who became a marine biologist. Is he happier? Does it matter if I can't access those branches? And what about the present moment - it has no duration, really. The instant you try to observe "now" it's already the past. We're always living in the recent past, processing delayed signals from reality. The present is a comfortable illusion. Okay brain, time for bed.""",
        "tags": ["philosophy", "physics", "time", "consciousness"],
        "mood_user": 3,
        "days_ago": 20
    },
    # Day 15 - same as Cooking experiment
    {
        "title": "No Country for Old Men is perfect",
        "content": """Watched No Country for Old Men. The Coens at their absolute peak. Chigurh is terrifying because he's not really human - he's more like a force of nature, chaos with a bad haircut and a coin. That gas station scene is one of the most tense things ever filmed and literally nothing happens. "What's the most you ever lost on a coin toss?" The ending used to frustrate me - where's the climax, the confrontation? But that IS the point. Sometimes evil wins. Sometimes the hero dies offscreen. The universe doesn't owe us narrative satisfaction. Tommy Lee Jones' monologue about the dream, about his father carrying fire in the darkness - that's the movie's real ending. It's about aging, about a world that's leaving you behind, about carrying on anyway. Cinema as philosophy.""",
        "tags": ["movies", "coen-brothers", "no-country", "cinema"],
        "mood_user": 5,
        "days_ago": 15
    },
    {
        "title": "The simulation question",
        "content": """Okay so the simulation argument: if any civilization ever develops the ability to create realistic simulations of consciousness, they'd probably create many of them. Which means simulated beings vastly outnumber "real" ones. Which means we're almost certainly in a simulation. The math checks out and I hate it. But also... does it matter? If the simulation is indistinguishable from reality, isn't it just reality for us? The pain is real, the joy is real, the relationships are real. Unless the simulators are watching and judging. In which case hi I guess? Please don't delete me. Unless you're just an NPC in my simulation. This is recursive and I need to stop. Either way, be kind to the NPCs.""",
        "tags": ["philosophy", "simulation", "reality", "thoughts"],
        "mood_user": 4,
        "days_ago": 15
    },
    # Day 12 - same as Feeling isolated
    {
        "title": "The Thing (1982) appreciation",
        "content": """Revisited John Carpenter's The Thing. Still holds up as one of the best horror films ever made. The practical effects by Rob Bottin are somehow more disturbing than any CGI because they're REAL. They're actually there on set, being gross and impossible. But what makes the movie great isn't the monster - it's the paranoia. You can't trust anyone. That blood test scene is peak tension filmmaking. And the ambiguous ending - are MacReady and Childs both human? Neither? The theory that the bottle Childs drinks from is gasoline and he doesn't react... suggesting he's the Thing... chef's kiss. Carpenter understood that the scariest thing isn't the monster, it's not knowing who the monster is. Also Ennio Morricone's minimalist score. Perfection.""",
        "tags": ["movies", "horror", "john-carpenter", "the-thing"],
        "mood_user": 4,
        "days_ago": 12
    },
    {
        "title": "Mortality thoughts",
        "content": """Sometimes I remember I'm going to die and it just... hits. Not in a morbid way exactly, more like suddenly being aware you're on a moving train. Most of the time we ignore it, distract ourselves with the daily noise. But then there's a quiet moment and boom - you remember you have a limited number of heartbeats and no one knows the count. It should be paralyzing but honestly it's clarifying? Like, what am I doing that I actually care about? What would I regret not doing? The Stoics were onto something with memento mori. Keep death close as a reminder to actually live. Ernest Becker wrote about how all of civilization is just elaborate death denial. We build monuments and have kids and create art to feel immortal. The denial of death. Heavy stuff for a Tuesday.""",
        "tags": ["philosophy", "mortality", "stoicism", "thoughts"],
        "mood_user": 3,
        "days_ago": 12
    },
    # Day 8 - same as Promotion talk
    {
        "title": "Prisoners is underrated",
        "content": """Watched Prisoners (2013). Villeneuve before he became the sci-fi king. This movie is BLEAK. Hugh Jackman losing his mind, turning into a monster to find his daughter. And the question it poses - how far would you go? At what point does the protector become worse than the threat? Jake Gyllenhaal blinking constantly because his character doesn't blink, an actual choice he made. The religious symbolism throughout - snakes, mazes, confession. That ending shot with the whistle, cutting to black before we know if Loki hears it. Villeneuve really said "I'm not going to give you catharsis and you're going to respect me for it." And he's right. This man does not miss. Everything he touches is gold. DUNE 2 WHEN.""",
        "tags": ["movies", "villeneuve", "prisoners", "thriller"],
        "mood_user": 4,
        "days_ago": 8
    },
    {
        "title": "Why do we need meaning",
        "content": """Humans are meaning-making machines. We see faces in clouds, patterns in random noise, purpose in chaos. It's probably evolutionary - seeing a tiger in the bushes when there isn't one costs less than missing a tiger that's actually there. But now we're stuck with this meaning-seeking brain in a universe that doesn't provide any. So we make our own. Religion, philosophy, career, family, art, fandom - all attempts to answer "why am I here?" I used to think finding the One True Meaning was the goal. Now I think it's more like a garden - you plant different meanings, tend to them, and some flourish while others don't. Meaning as practice rather than discovery. Camus again: we create meaning through living fully. Even if it's absurd. Especially because it's absurd.""",
        "tags": ["philosophy", "meaning", "existentialism", "thoughts"],
        "mood_user": 4,
        "days_ago": 8
    },
    # Day 5 - same as Date night disaster
    {
        "title": "Eternal Sunshine rewatch",
        "content": """Eternal Sunshine of the Spotless Mind. Kaufman and Gondry made something so specifically weird and universally true. The idea of erasing someone from your memory - would you do it? The pain of heartbreak is brutal but it's also... proof that you loved? "How happy is the blameless vestal's lot! The world forgetting, by the world forgot." But Joel and Clementine choose to try again even knowing they'll probably hurt each other again. That's either incredibly hopeful or incredibly stupid. Maybe both. Maybe that's what love is. Jim Carrey doing serious roles is always a revelation. And Kate Winslet's Clementine is manic pixie dream girl deconstruction before that was a thing. This movie is for anyone who's ever loved and lost. So, everyone.""",
        "tags": ["movies", "eternal-sunshine", "kaufman", "romance"],
        "mood_user": 4,
        "days_ago": 5
    },
    {
        "title": "The paradox of choice",
        "content": """Barry Schwartz was right about the paradox of choice. More options should make us happier but they don't. They make us more anxious. Every choice is now a referendum on our identity. Which streaming service says the right things about me? What does my coffee order communicate? We're paralyzed by infinite options and terrified of choosing wrong. Dating apps are the perfect example - infinite potential matches means no one seems good enough. There's always someone better one swipe away. Our grandparents married whoever lived in their village and they were fine. Not saying we should go back to that but maybe constraint is actually freedom? Narrowing options lets you commit. Commitment lets you go deep. Going deep is where satisfaction lives. Less is more. Embrace your constraints.""",
        "tags": ["philosophy", "psychology", "modern-life", "choices"],
        "mood_user": 3,
        "days_ago": 5
    },
    # Day 2 - same as Sunday morning peace
    {
        "title": "Mulholland Drive fever dream",
        "content": """Watched Mulholland Drive. David Lynch doesn't make movies - he makes experiences. Trying to explain the plot is pointless because it's not really about plot. It's about feeling. That diner scene with the man behind Winkies. The audition scene where Betty just transforms into a completely different person. The blue box. Club Silencio. "No hay banda. There is no band." It's a movie about Hollywood, about dreams, about identity, about the stories we tell ourselves to cope with reality. Or it's about nothing and Lynch just vibes. Either interpretation is valid. The scene where Betty and Rita find the decomposing body - real terror achieved through pure craft. Lynch is operating on a different frequency than everyone else in cinema.""",
        "tags": ["movies", "david-lynch", "mulholland-drive", "surreal"],
        "mood_user": 5,
        "days_ago": 2
    },
    {
        "title": "On authenticity",
        "content": """What does it mean to be authentic? We perform different versions of ourselves constantly. Work self, friend self, family self, online self. Are any of them "real"? Maybe authenticity isn't about finding some core true self but about choosing which performances feel right. We're all just layers of masks and that's okay. The search for the "real me" underneath might be a trap. There is no base layer - it's masks all the way down. So the question becomes: which masks do I want to wear? Which performances align with my values? Sartre said we are what we do. Not some essence waiting to be discovered but an existence creating itself through action. Be who you want to be by doing what you want to do. Identity as verb, not noun. Pretty freeing actually.""",
        "tags": ["philosophy", "identity", "authenticity", "sartre"],
        "mood_user": 4,
        "days_ago": 2
    }
]


def main():
    username = "ary"

    # Create database connection
    engine = create_engine(DATABASE_URL)
    Session = sessionmaker(bind=engine)
    session = Session()

    try:
        # Find user
        user = session.query(User).filter(User.username == username).first()
        if not user:
            print(f"User '{username}' not found. Available users:")
            users = session.query(User).all()
            for u in users:
                print(f"  - {u.username} (id: {u.id})")
            return 1

        print(f"Found user: {user.username} (id: {user.id})")

        # Mental health journey and philosophical entries
        mental_health_entries = [
            {
                "title": "Finally talked to a psychiatrist",
                "content": """Took the leap and saw a psychiatrist today. Been putting it off for years because of stigma, cost, fear of being "broken." She was kind. Listened without judgment. We talked about the mood swings, the emptiness that comes out of nowhere, the way I can go from fine to devastated in an hour. She mentioned BPD as a possibility - not a diagnosis yet, but something to explore. Also depression, obviously. She prescribed sertraline, starting low. I'm scared of medication changing who I am. But also... who I am right now isn't working. Maybe different isn't worse. Maybe it's just different. Picking up the prescription tomorrow. Here goes nothing.""",
                "tags": ["mental-health", "psychiatry", "medication", "bpd"],
                "mood_user": 3,
                "days_ago": 42
            },
            {
                "title": "Week one on sertraline",
                "content": """Side effects hitting hard. Nausea, weird dreams, feeling kind of foggy. They said it takes 4-6 weeks to really work so I'm trying to be patient. The dreams are wild though - vivid, strange, sometimes disturbing. Woke up at 3am convinced something terrible had happened. It hadn't. Just my brain adjusting to new chemistry. Reading about other people's experiences online - some say it saved their life, others say it made them numb. Trying not to catastrophize. Give it time. Trust the process. But god, the waiting is hard when you're already struggling.""",
                "tags": ["mental-health", "antidepressants", "sertraline", "side-effects"],
                "mood_user": 2,
                "days_ago": 35
            },
            {
                "title": "The void and the self",
                "content": """3am thoughts about consciousness again. What is the self? There's this Buddhist idea that the self is an illusion - just a story we tell to create continuity from moment to moment. But if there's no self, who's suffering? Who's asking the question? Maybe the self is more like a process than a thing. A verb masquerading as a noun. "I" am not a fixed entity but a pattern that persists through time, like a wave in the ocean. The wave is real, but it's not separate from the water. It's just water doing a particular thing temporarily. Maybe that's what we are - the universe briefly pretending to be separate from itself. Heavy thoughts for a Tuesday. Need to sleep.""",
                "tags": ["philosophy", "consciousness", "buddhism", "late-night"],
                "mood_user": 3,
                "days_ago": 28
            },
            {
                "title": "Learning about BPD",
                "content": """Deep dive into BPD resources today. The DSM criteria feel uncomfortably accurate. Fear of abandonment - check. Unstable relationships - check. Identity disturbance - big check. Emotional volatility - the mood swings that confuse everyone including me. The shame spiral after every outburst. Always feeling too much or nothing at all. But here's what's helping: it's not a character flaw. It's a pattern that developed, usually from invalidating environments in childhood. The brain learned to be hypervigilant, to feel everything at 11. And patterns can be unlearned. DBT apparently helps a lot. Looking into therapists who specialize in it. For the first time in a while, I feel like maybe there's a path forward.""",
                "tags": ["mental-health", "bpd", "self-discovery", "therapy"],
                "mood_user": 3,
                "days_ago": 18
            },
            {
                "title": "On suffering and meaning",
                "content": """Viktor Frankl wrote that those who have a why can bear almost any how. Man's Search for Meaning is devastating and beautiful. He survived Auschwitz by finding purpose in his suffering - planning to write about it, thinking of his wife, helping other prisoners. The lesson isn't that suffering is good. It's that meaning can exist alongside suffering. We can't always control our circumstances but we can choose our response. Stoicism says something similar - focus on what you can control, accept what you can't. Easier said than done when your brain chemistry is fighting you. But the philosophy helps. Something to hold onto when the void gets loud.""",
                "tags": ["philosophy", "frankl", "stoicism", "meaning", "mental-health"],
                "mood_user": 4,
                "days_ago": 15
            },
            {
                "title": "The meds might be working?",
                "content": """Six weeks on sertraline and something's different. The lows aren't as low. That feeling of being underwater, of everything requiring impossible effort - it's still there sometimes but it lifts faster. I cried at a commercial yesterday and it felt... normal? Like a normal human emotional response instead of the beginning of a spiral. The constant background anxiety has quieted from a scream to a murmur. I can think more clearly. I'm not cured - I don't think that's how this works. But I have more capacity to cope. The medication isn't happiness, it's bandwidth. Space to do the work. Starting DBT next month. Cautiously optimistic for the first time in a long time.""",
                "tags": ["mental-health", "antidepressants", "progress", "hope"],
                "mood_user": 4,
                "days_ago": 8
            },
            {
                "title": "Radical acceptance",
                "content": """Learning about radical acceptance in my DBT prep reading. It's not about approving of painful things or giving up. It's about acknowledging reality as it is, not as we wish it were. Fighting against what's already happened is suffering on top of suffering. The past is fixed. The present is what it is. We can only act from here. Applied to mental illness: I have BPD traits. That's not good or bad, it just is. Wishing I was neurotypical doesn't help. Accepting where I am lets me work with what I have. It's like... you can't navigate if you refuse to look at the map because you don't like your starting location. Radical acceptance is looking at the map. Then you can move.""",
                "tags": ["mental-health", "dbt", "philosophy", "acceptance", "growth"],
                "mood_user": 4,
                "days_ago": 3
            }
        ]

        # Political rants - social liberal perspective
        political_entries = [
            {
                "title": "Book bans are getting out of hand",
                "content": """Another state just banned a list of books from school libraries. Toni Morrison. Art Spiegelman's Maus. Books about Ruby Bridges. We're banning books about the Holocaust and civil rights in 2025. Let that sink in. The party of "free speech" is literally removing books from shelves because they make some parents uncomfortable. God forbid children learn that history was complicated and that marginalized people exist. The irony of banning Fahrenheit 451 in some districts is too on the nose. These are the same people who cry about cancel culture while canceling entire literary canons. What are we so afraid of? That kids might develop empathy? Critical thinking? The ability to understand perspectives different from their parents'? This isn't about protecting children - it's about controlling narratives. And it's working.""",
                "tags": ["politics", "education", "book-bans", "free-speech"],
                "mood_user": 2,
                "days_ago": 35
            },
            {
                "title": "Healthcare rant",
                "content": """Got the bill for my ER visit last month. $4,200 for what amounted to 3 hours, some tests, and being told I was fine. WITH insurance. This is insane. We pay more per capita than any other developed nation and get worse outcomes. People are rationing insulin. GoFundMe is a healthcare plan for millions. And somehow we've convinced ourselves that universal healthcare is "radical" when literally every other wealthy country has figured this out. The argument that we can't afford it falls apart when you realize we already spend more - we just let insurance companies take their cut. 30% of healthcare spending goes to administrative costs because of our byzantine system of private insurers. But sure, let's keep pretending the "free market" will solve this while people choose between medication and rent. The cruelty is the point.""",
                "tags": ["politics", "healthcare", "inequality", "rant"],
                "mood_user": 2,
                "days_ago": 22
            },
            {
                "title": "Climate despair and frustration",
                "content": """Record temperatures again. Wildfires. Flooding. The hottest year on record for the third year in a row. And we're still debating whether it's real. Oil companies knew about this in the 1970s and spent billions on disinformation. Now they're rebranding as "energy companies" while lobbying against every meaningful policy. We have the technology to transition. We have the economic case - renewables are cheaper now. We just don't have the political will because fossil fuel money owns too many politicians. Young people will inherit a planet we knew how to save and chose not to because quarterly profits mattered more. The gaslighting is exhausting - "why aren't you having kids?" Because you made the planet unlivable! "Why are young people so anxious?" BECAUSE THIS. I try to stay hopeful but some days the scale of institutional failure is overwhelming. We needed radical action 20 years ago. Now we need a miracle.""",
                "tags": ["politics", "climate", "environment", "frustration"],
                "mood_user": 1,
                "days_ago": 10
            }
        ]

        # Add entries - combine all entry lists
        all_entries = DUMMY_ENTRIES + EXTRA_ENTRIES + political_entries + mental_health_entries
        now = datetime.utcnow()
        entries_added = 0

        for entry_data in all_entries:
            # Calculate backdated timestamp with some random hour/minute variation
            days_ago = entry_data["days_ago"]
            random_hours = random.randint(8, 22)  # Between 8am and 10pm
            random_minutes = random.randint(0, 59)
            created_at = now - timedelta(
                days=days_ago,
                hours=random_hours,
                minutes=random_minutes
            )

            entry = Entry(
                user_id=user.id,
                title=entry_data["title"],
                content=entry_data["content"],
                tags=entry_data["tags"],
                mood_user=entry_data["mood_user"],
                created_at=created_at,
                is_deleted=False
            )
            session.add(entry)
            entries_added += 1
            print(f"  Added: '{entry_data['title']}' (mood: {entry_data['mood_user']}, {days_ago} days ago)")

        session.commit()
        print(f"\nSuccessfully added {entries_added} entries for user '{username}'")
        return 0

    except Exception as e:
        session.rollback()
        print(f"Error: {e}")
        return 1
    finally:
        session.close()


if __name__ == "__main__":
    sys.exit(main())
