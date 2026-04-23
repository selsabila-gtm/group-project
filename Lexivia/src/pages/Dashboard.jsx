import Sidebar from "../components/Sidebar";
import Topbar from "../components/Topbar";
import "./Dashboard.css";

const recentCompetitions = [
    {
        title: "SQuAD v2.0 Global Bench",
        type: "QUESTION ANSWERING",
        status: "IN PROGRESS",
        score: "--",
        sync: "Just now",
        icon: "◎",
    },
    {
        title: "Multi-Lingual Translation",
        type: "TRANSLATION TASK",
        status: "SUBMITTED",
        score: "0.892 BLEU",
        sync: "14 mins ago",
        icon: "文",
    },
    {
        title: "XSum News Summarization",
        type: "SUMMARIZATION",
        status: "DRAFT",
        score: "--",
        sync: "1 hour ago",
        icon: "▣",
    },
];

const notifications = [
    {
        title: 'Project "X-NLI-V2" Archived',
        text: "Data saved to your persistent storage node.",
        time: "2 minutes ago",
        highlighted: true,
    },
    {
        title: "Tier Upgrade Confirmed",
        text: "You are now a verified Pro Tier Researcher.",
        time: "1 hour ago",
    },
    {
        title: "Team Invite",
        text: 'User @nlp_master invited you to "Transformers-R-Us".',
        time: "1 hour ago",
        actions: true,
    },
    {
        title: "Login Detected",
        text: "New session started from OS X 10.15.7",
        time: "4 hours ago",
    },
];

function statusClass(status) {
    if (status === "IN PROGRESS") return "in-progress";
    if (status === "SUBMITTED") return "submitted";
    if (status === "DRAFT") return "draft";
    return "";
}

function Dashboard() {
    return (
        <div className="dashboard-shell">
            <Sidebar />

            <div className="dashboard-main">
                <Topbar
                    title="Welcome Home, 0x4"
                    subtitle="Overview of your activity and performance across the laboratory."
                    showBrowseButton={true}
                />

                <div className="dashboard-body">
                    <div className="dashboard-left">
                        <div className="stats-row">
                            <div className="stat-card">
                                <div className="stat-card-top">
                                    <span className="stat-icon">🏆</span>
                                    <span className="today-badge">+2 Today</span>
                                </div>
                                <h3>12</h3>
                                <p>TOTAL COMPETITIONS</p>
                            </div>

                            <div className="stat-card">
                                <div className="stat-card-top">
                                    <span className="stat-icon">👥</span>
                                </div>
                                <h3>04</h3>
                                <p>TEAMS JOINED</p>
                            </div>
                        </div>

                        <div className="recent-card">
                            <div className="section-head">
                                <h2>Recent Competitions</h2>
                                <div className="small-actions">
                                    <button type="button">⋯</button>
                                    <button type="button">⋯</button>
                                </div>
                            </div>

                            <div className="recent-head">
                                <span>COMPETITION / TASK</span>
                                <span>STATUS</span>
                                <span>SCORE</span>
                                <span>LAST SYNC</span>
                            </div>

                            <div className="recent-list">
                                {recentCompetitions.map((item) => (
                                    <div className="recent-row" key={item.title}>
                                        <div className="recent-main">
                                            <div className="recent-icon">{item.icon}</div>
                                            <div>
                                                <h3>{item.title}</h3>
                                                <p>{item.type}</p>
                                            </div>
                                        </div>

                                        <div>
                                            <span className={`status-pill ${statusClass(item.status)}`}>
                                                {item.status}
                                            </span>
                                        </div>

                                        <div className="recent-score">{item.score}</div>
                                        <div className="recent-sync">{item.sync}</div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>

                    <div className="dashboard-right">
                        <div className="notifications-card">
                            <div className="section-head">
                                <h2>Notifications</h2>
                                <button type="button" className="clear-all">
                                    CLEAR ALL
                                </button>
                            </div>

                            <div className="notifications-list">
                                {notifications.map((note) => (
                                    <div
                                        key={note.title}
                                        className={
                                            note.highlighted
                                                ? "notification-item highlighted"
                                                : "notification-item"
                                        }
                                    >
                                        <h3>{note.title}</h3>
                                        <p>{note.text}</p>
                                        <span>{note.time}</span>

                                        {note.actions && (
                                            <div className="notification-actions">
                                                <button type="button" className="accept-btn">
                                                    Accept
                                                </button>
                                                <button type="button" className="ignore-btn">
                                                    Ignore
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>

                <button type="button" className="floating-plus">
                    +
                </button>
            </div>
        </div>
    );
}

export default Dashboard;