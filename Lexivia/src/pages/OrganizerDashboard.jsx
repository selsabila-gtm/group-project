import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import Sidebar from "../components/Sidebar";
import "./OrganizerDashboard.css";

function safeJson(value, fallback = []) {
    try {
        if (!value) return fallback;
        const parsed = JSON.parse(value);
        return Array.isArray(parsed) ? parsed : fallback;
    } catch {
        return fallback;
    }
}

function money(value) {
    if (value === null || value === undefined || value === "") return "TBD";
    return `$${Number(value).toLocaleString()}`;
}

function OrganizerDashboard() {
    const { competitionId } = useParams();
    const navigate = useNavigate();

    const [competition, setCompetition] = useState(null);
    const [monitoring, setMonitoring] = useState(null);
    const [loading, setLoading] = useState(true);

    const token = localStorage.getItem("token");

    async function handleDeleteCompetition() {
        const confirmDelete = window.confirm(
            "Are you sure you want to delete this competition?"
        );

        if (!confirmDelete) return;

        try {
            const res = await fetch(
                `http://127.0.0.1:8000/competitions/${competitionId}`,
                {
                    method: "DELETE",
                    headers: {
                        Authorization: `Bearer ${token}`,
                    },
                }
            );

            if (!res.ok) {
                const error = await res.json();
                throw new Error(error.detail || "Delete failed");
            }

            alert("Competition deleted successfully.");
            navigate("/competitions?tab=organizing");
        } catch (error) {
            console.error(error);
            alert(error.message || "Could not delete competition.");
        }
    }

    useEffect(() => {
        if (!token) {
            navigate("/login");
            return;
        }

        async function loadDashboard() {
            try {
                const [competitionRes, monitoringRes] = await Promise.all([
                    fetch(`http://127.0.0.1:8000/competitions/${competitionId}`, {
                        headers: { Authorization: `Bearer ${token}` },
                    }),
                    fetch(`http://127.0.0.1:8000/competitions/${competitionId}/monitoring`, {
                        headers: { Authorization: `Bearer ${token}` },
                    }),
                ]);

                if (!competitionRes.ok) throw new Error("Competition not found");

                const competitionData = await competitionRes.json();
                const monitoringData = await monitoringRes.json();

                if (monitoringData.is_organizer !== true) {
                    alert("Only the organizer can access this dashboard.");
                    navigate(`/competitions/${competitionId}`);
                    return;
                }

                setCompetition(competitionData);
                setMonitoring(monitoringData);
            } catch (error) {
                console.error(error);
                alert("Could not load organizer dashboard.");
                navigate("/competitions");
            } finally {
                setLoading(false);
            }
        }

        loadDashboard();
    }, [competitionId, navigate, token]);

    useEffect(() => {
        if (!token) return;

        const interval = setInterval(() => {
            fetch(`http://127.0.0.1:8000/competitions/${competitionId}/monitoring`, {
                headers: { Authorization: `Bearer ${token}` },
            })
                .then((res) => res.json())
                .then(setMonitoring)
                .catch(() => { });
        }, 5000);

        return () => clearInterval(interval);
    }, [competitionId, token]);

    const datasets = useMemo(
        () => safeJson(competition?.datasets_json, []),
        [competition]
    );

    const milestones = useMemo(() => {
        const extra = safeJson(competition?.milestones_json, []);
        return [
            { title: "Submission Open", date: competition?.start_date },
            { title: "Model Validation", date: competition?.validation_date },
            { title: "Final Leaderboard", date: competition?.freeze_date },
            { title: "Competition End", date: competition?.end_date },
            ...extra,
        ];
    }, [competition]);

    if (loading) {
        return (
            <div className="organizer-layout">
                <Sidebar />
                <main className="organizer-main">
                    <p className="organizer-loading">Loading organizer dashboard...</p>
                </main>
            </div>
        );
    }

    if (!competition || !monitoring) return null;

    return (
        <div className="organizer-layout">
            <Sidebar />

            <main className="organizer-main">
                <div className="organizer-topbar">
                    <input
                        className="organizer-search"
                        placeholder="Search competitions, datasets, teams..."
                    />

                    <div className="organizer-icons">
                        <span>🔔</span>
                        <span>☰</span>
                        <span>👤</span>
                    </div>
                </div>

                <section className="organizer-header">
                    <div>
                        <button
                            className="back-btn"
                            onClick={() => navigate("/competitions?tab=organizing")}
                        >
                            ← Back to Competitions
                        </button>

                        <div className="organizer-title-row">
                            <h1>{competition.title}</h1>
                            <span className="badge badge-open">{competition.status}</span>
                            <span className="badge badge-organizing">ORGANIZING</span>
                        </div>

                        <p>
                            Manage your competition, review submissions, and track progress.
                        </p>
                    </div>

                    <div className="organizer-actions">
                        <button
                            onClick={() =>
                                navigate(`/edit-competition/${competitionId}`, {
                                    state: { competition },
                                })
                            }
                        >
                            Edit Competition
                        </button>

                        <button className="danger" onClick={handleDeleteCompetition}>
                            Delete
                        </button>
                    </div>
                </section>

                <section className="stat-grid">
                    <div className="stat-card">
                        <span>Total Participants</span>
                        <strong>{monitoring.participants_count ?? 0}</strong>
                        <p>↗ live from joined users</p>
                    </div>

                    <div className="stat-card">
                        <span>Active Teams</span>
                        <strong>{monitoring.teams_count ?? 0}</strong>
                        <p>Max teams: {monitoring.max_teams || "Unlimited"}</p>
                    </div>

                    <div className="stat-card">
                        <span>Total Submissions</span>
                        <strong>{monitoring.submissions_count ?? 0}</strong>
                        <p>{monitoring.leaderboard_status}</p>
                    </div>

                    <div className="stat-card">
                        <span>Prize Pool</span>
                        <strong>{money(competition.prize_pool)}</strong>
                        <p>Ends {competition.end_date || "Not set"}</p>
                    </div>
                </section>

                <section className="organizer-content-grid">
                    <div className="panel large-panel">
                        <h2>Competition Overview</h2>
                        <p className="overview-text">{competition.description}</p>

                        <div className="overview-grid">
                            <div>
                                <h4>Evaluation Metrics</h4>
                                <p>Primary: {competition.primary_metric || "Not selected"}</p>
                                <p>Secondary: {competition.secondary_metric || "Not selected"}</p>
                            </div>

                            <div>
                                <h4>Key Milestones</h4>
                                {milestones.map((item, index) => (
                                    <p key={index}>
                                        ✓ {item.title} - {item.date || "Not set"}
                                    </p>
                                ))}
                            </div>
                        </div>

                        <div className="blue-note">
                            <strong>Submission Activity</strong>
                            <p>
                                {monitoring.submissions_count === 0
                                    ? "No model submissions yet. Waiting for participants to start submitting."
                                    : `${monitoring.submissions_count} submissions received.`}
                            </p>
                        </div>
                    </div>

                    <div className="panel">
                        <h2>Top Performers</h2>

                        <div className="empty-state">
                            <strong>No leaderboard yet</strong>
                            <p>
                                Top teams will appear after model submissions are validated.
                            </p>
                        </div>

                        <button className="full-btn">View Full Leaderboard</button>
                    </div>
                </section>

                <section className="panel">
                    <div className="section-row">
                        <h2>Data Collection</h2>
                        <span>{monitoring.data_collection_status}</span>
                    </div>

                    {datasets.length === 0 ? (
                        <div className="empty-state">
                            <strong>No datasets configured</strong>
                            <p>Add datasets from the competition creation flow.</p>
                        </div>
                    ) : (
                        <div className="dataset-grid">
                            {datasets.map((dataset, index) => (
                                <div className="dataset-card" key={index}>
                                    <strong>{dataset.name || `Dataset ${index + 1}`}</strong>
                                    <p>{dataset.type || "Unknown type"}</p>
                                    <span>{dataset.visibility || "Private"}</span>
                                </div>
                            ))}
                        </div>
                    )}
                </section>

                <section className="panel">
                    <div className="section-row">
                        <h2>Recent Submissions</h2>
                        <button>Export All</button>
                    </div>

                    <table className="submission-table">
                        <thead>
                            <tr>
                                <th>Team</th>
                                <th>Score</th>
                                <th>Time</th>
                                <th>Status</th>
                                <th>Actions</th>
                            </tr>
                        </thead>

                        <tbody>
                            <tr>
                                <td colSpan="5" className="table-empty">
                                    No submissions yet.
                                </td>
                            </tr>
                        </tbody>
                    </table>
                </section>
            </main>
        </div>
    );
}

export default OrganizerDashboard;