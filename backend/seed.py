from database import SessionLocal
from models import DashboardStat, Competition, RecentCompetition, Notification

db = SessionLocal()

user_id = "demo-user-1"

existing_stats = db.query(DashboardStat).filter(DashboardStat.user_id == user_id).first()
if not existing_stats:
    db.add(
        DashboardStat(
            user_id=user_id,
            total_competitions=99,
            teams_joined=7,
        )
    )

if db.query(Competition).count() == 0:
    db.add_all([
        Competition(
            category="TEXT PROCESSING",
            status="OPEN",
            title="Semantic Drift v4.2",
            description="Detect subtle shifts in contextual meaning across long-form legal and scientific documents.",
            stat1_label="TOP SCORE",
            stat1_value="0.982",
            stat2_label="REWARD",
            stat2_value="$12,500",
            footer="👤👤 +124",
            muted=False,
        ),
        Competition(
            category="AUDIO SYNTHESIS",
            status="OPEN",
            title="Echo-Locate Subtones",
            description="Isolate emotional sub-frequencies in noisy environments to improve speech understanding.",
            stat1_label="PARTICIPANTS",
            stat1_value="432",
            stat2_label="DEADLINE",
            stat2_value="14d",
            footer="👤👤 +58",
            muted=False,
        ),
        Competition(
            category="TRANSLATION",
            status="CLOSED",
            title="Polyglot Zero-Shot",
            description="Evaluation of zero-shot translation capabilities across 14 low-resource languages.",
            stat1_label="FINAL WINNER",
            stat1_value="Omni-AI",
            stat2_label="ACCURACY",
            stat2_value="94.1%",
            footer="ARCHIVED",
            muted=True,
        ),
        Competition(
            category="COGNITIVE LOGIC",
            status="OPEN",
            title="Recursive Reasoner",
            description="Measure the chain-of-thought efficiency of LLMs when solving recursive symbolic tasks.",
            stat1_label="ENTRIES",
            stat1_value="1,024",
            stat2_label="HARDWARE",
            stat2_value="H100 Cap",
            footer="👤 +26",
            muted=False,
        ),
    ])

if db.query(RecentCompetition).filter(RecentCompetition.user_id == user_id).count() == 0:
    db.add_all([
        RecentCompetition(
            user_id=user_id,
            title="SQuAD v2.0 Global Bench",
            type="QUESTION ANSWERING",
            status="IN PROGRESS",
            score="--",
            sync="Just now",
            icon="◎",
        ),
        RecentCompetition(
            user_id=user_id,
            title="Multi-Lingual Translation",
            type="TRANSLATION TASK",
            status="SUBMITTED",
            score="0.892 BLEU",
            sync="14 mins ago",
            icon="文",
        ),
        RecentCompetition(
            user_id=user_id,
            title="XSum News Summarization",
            type="SUMMARIZATION",
            status="DRAFT",
            score="--",
            sync="1 hour ago",
            icon="▣",
        ),
    ])

if db.query(Notification).filter(Notification.user_id == user_id).count() == 0:
    db.add_all([
        Notification(
            user_id=user_id,
            title='Project "X-NLI-V2" Archived',
            message="Data saved to your persistent storage node.",
            time="2 minutes ago",
            highlighted=True,
            actions=False,
        ),
        Notification(
            user_id=user_id,
            title="Tier Upgrade Confirmed",
            message="You are now a verified Pro Tier Researcher.",
            time="1 hour ago",
            highlighted=False,
            actions=False,
        ),
        Notification(
            user_id=user_id,
            title="Team Invite",
            message='User @nlp_master invited you to "Transformers-R-Us".',
            time="1 hour ago",
            highlighted=False,
            actions=True,
        ),
        Notification(
            user_id=user_id,
            title="Login Detected",
            message="New session started from OS X 10.15.7",
            time="4 hours ago",
            highlighted=False,
            actions=False,
        ),
    ])

db.commit()
db.close()

print("Seeded successfully")