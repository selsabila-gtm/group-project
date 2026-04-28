import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import Sidebar from "../components/Sidebar";
import Topbar from "../components/Topbar";
import "./Dashboard.css";

function statusClass(status) {
    const s = status?.toLowerCase();

    if (s === "open") return "open";
    if (s === "closed") return "closed";
    if (s === "ended") return "ended";
    if (s === "upcoming") return "upcoming";
    if (s === "in progress") return "in-progress";
    if (s === "submitted") return "submitted";
    if (s === "draft") return "draft";

    return "";
}

function Dashboard() {
    const [userName, setUserName] = useState("User");
    const [userId, setUserId] = useState(null);
    const [stats, setStats] = useState({
        organized_competitions: 0,
        joined_competitions: 0,
        teams_joined: 0,
    });
    const [recentCompetitions, setRecentCompetitions] = useState([]);

    const navigate = useNavigate();

    // ✅ FIX: use localStorage instead of supabase
    useEffect(() => {
        const savedUser = localStorage.getItem("user");

        if (!savedUser) {
            navigate("/login");
            return;
        }

        const user = JSON.parse(savedUser);
        const realUserId = user.id || user.user_id || user.sub;

        if (!realUserId) {
            console.error("No user id found:", user);
            navigate("/login");
            return;
        }

        setUserId(realUserId);

        const name =
            user.user_metadata?.full_name ||
            user.full_name ||
            user.name ||
            user.email?.split("@")[0] ||
            "User";

        setUserName(name);

        const token = localStorage.getItem("token");

        fetch("http://127.0.0.1:8000/sync-user", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({
                user_id: realUserId,
                full_name: name,
                email: user.email,
            }),
        }).catch(console.error);
    }, [navigate]);

    const fetchRecent = () => {
        if (!userId) return;

        const token = localStorage.getItem("token");

        fetch(`http://127.0.0.1:8000/dashboard/recent/${userId}`, {
            headers: { Authorization: `Bearer ${token}` },
        })
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
        if (!userId) return;

        const token = localStorage.getItem("token");

        fetch(`http://127.0.0.1:8000/dashboard/stats/${userId}`, {
            headers: { Authorization: `Bearer ${token}` },
        })
            .then((res) => res.json())
            .then((data) => setStats(data))
            .catch((err) => console.error("Stats fetch error:", err));

        fetchRecent();
    }, [userId]);
    return (
        <div className="dashboard-shell">
            <Sidebar />

            <div className="dashboard-main">
                <Topbar
                    title={`Welcome Home, ${userName}`}
                    subtitle="Overview of your activity and performance across the laboratory."
                    showBrowseButton={true}
                />

                <div className="dashboard-body">
                    <div className="dashboard-left full-width">

                        {/* STATS */}
                        <div className="stats-row">
                            <div className="stat-card">
                                <div className="stat-card-top">
                                    <span className="stat-icon">🏆</span>
                                    <span className="today-badge">Organized</span>
                                </div>
                                <h3>{String(stats.organized_competitions || 0).padStart(2, "0")}</h3>
                                <p>ORGANIZED COMPETITIONS</p>
                            </div>

                            <div className="stat-card">
                                <div className="stat-card-top">
                                    <span className="stat-icon">🤝</span>
                                </div>
                                <h3>{String(stats.joined_competitions || 0).padStart(2, "0")}</h3>
                                <p>JOINED COMPETITIONS</p>
                            </div>

                            <div className="stat-card">
                                <div className="stat-card-top">
                                    <span className="stat-icon">👥</span>
                                </div>
                                <h3>{String(stats.teams_joined || 0).padStart(2, "0")}</h3>
                                <p>TEAMS JOINED</p>
                            </div>
                        </div>

                        {/* RECENT */}
                        <div className="recent-card">
                            <div className="section-head">
                                <h2>Recent Competitions</h2>

                                <div className="small-actions">
                                    <button onClick={() => navigate("/competitions")}>
                                        ↗
                                    </button>

                                    <button onClick={fetchRecent}>
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
                                {recentCompetitions.length === 0 ? (
                                    <p style={{ padding: "10px" }}>No recent competitions</p>
                                ) : (
                                    recentCompetitions.map((item) => (
                                        <div
                                            className="recent-row"
                                            key={item.id}
                                            onClick={() => {
                                                if (item.competition_id) {
                                                    navigate(`/competitions/${item.competition_id}`);
                                                } else {
                                                    navigate(`/competitions`);
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
                                    ))
                                )}
                            </div>
                        </div>

                    </div>
                </div>
            </div>
        </div>
    );
}

export default Dashboard;