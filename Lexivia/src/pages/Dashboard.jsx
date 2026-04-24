import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import Sidebar from "../components/Sidebar";
import Topbar from "../components/Topbar";
import "./Dashboard.css";

function statusClass(status) {
    if (status === "IN PROGRESS") return "in-progress";
    if (status === "SUBMITTED") return "submitted";
    if (status === "DRAFT") return "draft";
    if (status === "OPEN") return "in-progress";
    return "";
}

function Dashboard() {
    const navigate = useNavigate();
    const userId = "demo-user-1";

    const [stats, setStats] = useState({
        total_competitions: 0,
        teams_joined: 0,
    });

    const [recentCompetitions, setRecentCompetitions] = useState([]);

    const fetchRecent = () => {
        fetch(`http://127.0.0.1:8000/dashboard/recent/${userId}`)
            .then((res) => res.json())
            .then((data) => {
                const safeData = Array.isArray(data) ? data : [];
                setRecentCompetitions(safeData);
            })
            .catch((err) =>
                console.error("Recent competitions fetch error:", err)
            );
    };

    useEffect(() => {
        fetch(`http://127.0.0.1:8000/dashboard/stats/${userId}`)
            .then((res) => res.json())
            .then((data) => setStats(data))
            .catch((err) =>
                console.error("Stats fetch error:", err)
            );

        fetchRecent();
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
                    <div className="dashboard-left full-width">
                        <div className="stats-row">
                            <div className="stat-card">
                                <div className="stat-card-top">
                                    <span className="stat-icon">🏆</span>
                                    <span className="today-badge">+2 Today</span>
                                </div>
                                <h3>{String(stats.total_competitions || 0).padStart(2, "0")}</h3>
                                <p>TOTAL COMPETITIONS</p>
                            </div>

                            <div className="stat-card">
                                <div className="stat-card-top">
                                    <span className="stat-icon">👥</span>
                                </div>
                                <h3>{String(stats.teams_joined || 0).padStart(2, "0")}</h3>
                                <p>TEAMS JOINED</p>
                            </div>
                        </div>

                        <div className="recent-card">
                            <div className="section-head">
                                <h2>Recent Competitions</h2>

                                <div className="small-actions">
                                    <button
                                        type="button"
                                        title="View all competitions"
                                        onClick={() => navigate("/competitions")}
                                    >
                                        ↗
                                    </button>

                                    <button
                                        type="button"
                                        title="Refresh"
                                        onClick={fetchRecent}
                                    >
                                        ⟳
                                    </button>
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
                                    <div
                                        className="recent-row"
                                        key={item.id}
                                        onClick={() => {
                                            if (item.competition_id) {
                                                navigate(`/competitions/${item.competition_id}`);
                                            } else {
                                                navigate(`/competitions?search=${encodeURIComponent(item.title)}`);
                                            }
                                        }}
                                        style={{ cursor: "pointer" }}
                                    >
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
                </div>
            </div>
        </div>
    );
}

export default Dashboard;