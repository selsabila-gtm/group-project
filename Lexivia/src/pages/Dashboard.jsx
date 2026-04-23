import { useEffect, useState } from "react";
import Sidebar from "../components/Sidebar";
import Topbar from "../components/Topbar";
import "./Dashboard.css";

function statusClass(status) {
    if (status === "IN PROGRESS") return "in-progress";
    if (status === "SUBMITTED") return "submitted";
    if (status === "DRAFT") return "draft";
    return "";
}

function Dashboard() {
    const userId = "demo-user-1";

    const [stats, setStats] = useState({
        total_competitions: 0,
        teams_joined: 0,
    });
    const [recentCompetitions, setRecentCompetitions] = useState([]);
    const [notifications, setNotifications] = useState([]);

    useEffect(() => {
        fetch(`http://127.0.0.1:8000/dashboard/stats/${userId}`)
            .then((res) => res.json())
            .then((data) => setStats(data))
            .catch((err) => console.error("Stats fetch error:", err));

        fetch(`http://127.0.0.1:8000/dashboard/recent/${userId}`)
            .then((res) => res.json())
            .then((data) => setRecentCompetitions(data))
            .catch((err) => console.error("Recent competitions fetch error:", err));

        fetch(`http://127.0.0.1:8000/dashboard/notifications/${userId}`)
            .then((res) => res.json())
            .then((data) => setNotifications(data))
            .catch((err) => console.error("Notifications fetch error:", err));
    }, []);

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
                                <h3>{String(stats.total_competitions).padStart(2, "0")}</h3>
                                <p>TOTAL COMPETITIONS</p>
                            </div>

                            <div className="stat-card">
                                <div className="stat-card-top">
                                    <span className="stat-icon">👥</span>
                                </div>
                                <h3>{String(stats.teams_joined).padStart(2, "0")}</h3>
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
                                    <div className="recent-row" key={item.id}>
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
                                        key={note.id}
                                        className={
                                            note.highlighted
                                                ? "notification-item highlighted"
                                                : "notification-item"
                                        }
                                    >
                                        <h3>{note.title}</h3>
                                        <p>{note.message}</p>
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