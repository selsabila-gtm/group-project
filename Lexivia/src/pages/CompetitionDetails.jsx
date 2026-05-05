import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import "./CompetitionDetails.css";
import Topbar from "../components/Topbar";
import Sidebar from "../components/Sidebar";

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
    if (String(value).startsWith("$")) return value;
    return `$${Number(value).toLocaleString()}`;
}

function complexityText(level) {
    if (level === 0) return "Level 1: Basic Text Classification";
    if (level === 1) return "Level 2: Intermediate NER";
    if (level === 2) return "Level 3: Advanced Semantic Mapping";
    if (level === 3) return "Level 4: Expert Multi-Task Learning";
    return "Level not selected";
}

function CompetitionDetails() {
    const { competitionId } = useParams();
    const navigate = useNavigate();

    const [competition, setCompetition] = useState(null);
    const [loading, setLoading] = useState(true);
    const [joining, setJoining] = useState(false);
    const [activeTab, setActiveTab] = useState("overview");
    const [monitoring, setMonitoring] = useState(null);
    const [isJoined, setIsJoined] = useState(false);

    useEffect(() => {
        window.scrollTo(0, 0);

        const token = localStorage.getItem("token");

        fetch(`http://127.0.0.1:8000/competitions/${competitionId}`, {
            headers: {
                Authorization: `Bearer ${token}`,
            },
        })
            .then((res) => {
                if (!res.ok) throw new Error("Competition not found");
                return res.json();
            })
            .then((data) => setCompetition(data))
            .catch((err) => {
                console.error(err);
                alert("Competition not found");
                navigate("/competitions");
            })
            .finally(() => setLoading(false));
    }, [competitionId, navigate]);

    useEffect(() => {
        const token = localStorage.getItem("token");

        fetch(`http://127.0.0.1:8000/competitions/${competitionId}/monitoring`, {
            headers: {
                Authorization: `Bearer ${token}`,
            },
        })
            .then((res) => res.json())
            .then((data) => {
                console.log("MONITORING DATA:", data);
                setMonitoring(data);
                if (data.user_role === "organizer") setIsJoined(false);
                if (data.user_role === "participant") setIsJoined(true);
            })
            .catch((err) => console.error("Monitoring fetch error:", err));
    }, [competitionId]);

    useEffect(() => {
        const token = localStorage.getItem("token");

        fetch(`http://127.0.0.1:8000/competitions/${competitionId}/is-joined`, {
            headers: {
                Authorization: `Bearer ${token}`,
            },
        })
            .then((res) => res.json())
            .then((data) => {
                if (data.user_role === "organizer") setIsJoined(false);
                else setIsJoined(data.joined === true);
            })
            .catch((err) => console.error("Joined check error:", err));
    }, [competitionId]);

    const datasets = useMemo(() => {
        return [];
    }, [competition]);

    const requiredSkills = useMemo(() => {
        return safeJson(competition?.required_skills, []);
    }, [competition]);

    const joinCompetition = async () => {
        try {
            setJoining(true);

            const token = localStorage.getItem("token");

            const res = await fetch(
                `http://127.0.0.1:8000/competitions/${competitionId}/join`,
                {
                    method: "POST",
                    headers: {
                        Authorization: `Bearer ${token}`,
                    },
                }
            );

            const data = await res.json();

            if (!res.ok) {
                alert(data.detail || "Could not join competition");
                return;
            }

            setIsJoined(true);
            alert("Joined competition successfully");

            // go directly to data collection
            navigate(`/competitions/${competitionId}/data-collection`);
        } catch (error) {
            console.error(error);
            alert("Backend error while joining competition");
        } finally {
            setJoining(false);
        }
    };

    if (loading) return <div className="details-loading">Loading competition...</div>;
    if (!competition) return null;

    const prize =
        competition.prize_pool !== null && competition.prize_pool !== undefined
            ? money(competition.prize_pool)
            : competition.stat1_label === "REWARD"
                ? competition.stat1_value
                : "TBD";

    return (
        <div className="details-shell">
            <Sidebar />

            <div className="details-page">
                <Topbar />

                <main className="details-main">
                    <section className="details-hero">
                        <button
                            type="button"
                            className="back-button"
                            onClick={() => {
                                if (window.history.length > 1) {
                                    navigate(-1);
                                } else {
                                    navigate("/competitions");
                                }
                            }}
                        >
                            ← Back to Competitions
                        </button>

                        <div>
                            <div className="details-meta">
                                <span className="requirement-badge">
                                    {competition.status === "OPEN"
                                        ? "HIGH PRECISION REQUIRED"
                                        : competition.status}
                                </span>
                                <span>Competition ID: {competition.id}</span>
                            </div>

                            <h1>{competition.title}</h1>

                            <div className="details-dates">
                                <span>▣ Started {competition.start_date || "Not set"}</span>
                                <span>▣ Ends {competition.end_date || "Not set"}</span>
                            </div>
                        </div>

                        <div className="details-hero-actions">
                            <div className="prize-card">
                                <span>TOTAL PRIZE POOL</span>
                                <strong>{prize}</strong>
                            </div>

                            {(monitoring?.is_organizer === true || competition.is_organizer === true || competition.user_role === "organizer") ? (
                                <button
                                    className="organizer-badge clickable"
                                    onClick={() => navigate(`/competitions/${competitionId}/organizer`)}
                                >
                                    Check Dashboard →
                                </button>
                            ) : (isJoined || monitoring?.user_role === "participant" || competition.user_role === "participant") ? (
                                <button
                                    className="organizer-badge clickable"
                                    onClick={() => navigate(`/competitions/${competitionId}/data-collection`)}
                                >
                                    Check Competition →
                                </button>
                            ) : (
                                <button
                                    type="button"
                                    className="join-btn"
                                    onClick={joinCompetition}
                                    disabled={joining || competition.status !== "OPEN"}
                                >
                                    {joining ? "Joining..." : "Join Competition →"}
                                </button>
                            )}
                        </div>
                    </section>

                    <nav className="details-tabs">
                        <button className={activeTab === "overview" ? "active" : ""} onClick={() => setActiveTab("overview")}>Overview</button>
                        <button className={activeTab === "rules" ? "active" : ""} onClick={() => setActiveTab("rules")}>Rules</button>
                        <button className={activeTab === "datasets" ? "active" : ""} onClick={() => setActiveTab("datasets")}>Datasets</button>
                        <button className={activeTab === "leaderboard" ? "active" : ""} onClick={() => setActiveTab("leaderboard")}>Leaderboard</button>
                        <button className={activeTab === "teams" ? "active" : ""} onClick={() => setActiveTab("teams")}>Teams</button>
                        {monitoring && monitoring.is_organizer === true && (
                            <button
                                className={activeTab === "monitoring" ? "active" : ""}
                                onClick={() => setActiveTab("monitoring")}
                            >
                                Monitoring
                            </button>
                        )}
                    </nav>

                    {activeTab === "overview" && (
                        <div className="details-layout">
                            <div className="details-left">
                                <section className="overview-card">
                                    <h2>▣ Overview</h2>
                                    <p className="overview-text">{competition.description}</p>

                                    <div className="info-grid">
                                        <div className="info-box">
                                            <h3>EVALUATION METRICS</h3>

                                            <div className="metric-row">
                                                <span>Primary: {competition.primary_metric || "Not selected"}</span>
                                                <div className="metric-bar">
                                                    <div style={{ width: competition.primary_metric ? "82%" : "20%" }}></div>
                                                </div>
                                            </div>

                                            <div className="metric-row">
                                                <span>Secondary: {competition.secondary_metric || "Not selected"}</span>
                                                <div className="metric-bar small">
                                                    <div style={{ width: competition.secondary_metric ? "48%" : "20%" }}></div>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="info-box">
                                            <h3>CHALLENGE COMPLEXITY</h3>

                                            <div className="complexity-bars">
                                                {[0, 1, 2, 3].map((bar) => (
                                                    <span
                                                        key={bar}
                                                        className={bar <= (competition.complexity_level || 0) ? "" : "muted"}
                                                    ></span>
                                                ))}
                                            </div>

                                            <strong>{complexityText(competition.complexity_level)}</strong>

                                            <p>
                                                Task type: {competition.task_type || competition.category}.{" "}
                                                {requiredSkills.length > 0
                                                    ? `Required skills: ${requiredSkills.join(", ")}.`
                                                    : "No required skills specified."}
                                            </p>
                                        </div>
                                    </div>
                                </section>
                            </div>

                            <aside className="details-right">
                                <section className="side-card performers-card">
                                    <h3>TOP PERFORMERS</h3>

                                    <div className="performer first">
                                        <strong>01</strong>
                                        <div>
                                            <b>No submissions yet</b>
                                            <p>{competition.primary_metric || "Metric"}: pending</p>
                                        </div>
                                        <span>BEST</span>
                                    </div>

                                    <button type="button">Full Leaderboard</button>
                                </section>

                                <section className="side-card milestones-card">
                                    <h3>KEY MILESTONES</h3>

                                    <div className="milestone active">
                                        <span></span>
                                        <div>
                                            <b>Submissions Open</b>
                                            <p>{competition.start_date || "Not set"}</p>
                                        </div>
                                    </div>

                                    <div className="milestone">
                                        <span></span>
                                        <div>
                                            <b>Model Validation Phase</b>
                                            <p>{competition.validation_date || "Not set"}</p>
                                        </div>
                                    </div>

                                    <div className="milestone">
                                        <span></span>
                                        <div>
                                            <b>Final Leaderboard Freeze</b>
                                            <p>{competition.freeze_date || "Not set"}</p>
                                        </div>
                                    </div>

                                    <div className="milestone">
                                        <span></span>
                                        <div>
                                            <b>Competition End</b>
                                            <p>{competition.end_date || "Not set"}</p>
                                        </div>
                                    </div>
                                </section>

                                <section className="teams-card">
                                    <span>♙</span>
                                    <div>
                                        <strong>{competition.max_teams || "∞"}</strong>
                                        <p>Max Teams</p>
                                    </div>
                                </section>
                            </aside>
                        </div>
                    )}

                    {activeTab === "rules" && (
                        <section className="overview-card">
                            <h2>▣ Rules</h2>
                            <p className="overview-text">
                                {competition.additional_rules || "No additional rules configured."}
                            </p>

                            <div className="info-grid">
                                <div className="info-box">
                                    <h3>TEAM RULES</h3>
                                    <p>Max teams: {competition.max_teams || "Unlimited"}</p>
                                    <p>Min members: {competition.min_members || "Not set"}</p>
                                    <p>Max members: {competition.max_members || "Not set"}</p>
                                </div>

                                <div className="info-box">
                                    <h3>SUBMISSION RULES</h3>
                                    <p>Max submissions/day: {competition.max_submissions_per_day || "Not set"}</p>
                                    <p>External data: {competition.allow_external_data ? "Allowed" : "Not allowed"}</p>
                                    <p>Pretrained models: {competition.allow_pretrained_models ? "Allowed" : "Not allowed"}</p>
                                    <p>Code sharing: {competition.require_code_sharing ? "Required" : "Not required"}</p>
                                </div>
                            </div>
                        </section>
                    )}

                    {activeTab === "datasets" && (
                        <section className="datasets-card">
                            <div className="datasets-head">
                                <h2>▣ Available Datasets</h2>
                                <button type="button">View File Documentation</button>
                            </div>

                            <div className="dataset-row">
                                <div>
                                    <strong>{competition.datasets_count || 0} dataset file(s) configured</strong>
                                    <p>Dataset files are stored in the competition_datasets table.</p>
                                </div>
                            </div>
                        </section>
                    )}

                    {activeTab === "leaderboard" && (
                        <section className="overview-card">
                            <h2>▣ Leaderboard</h2>
                            <p className="overview-text">No model submissions yet.</p>
                        </section>
                    )}

                    {activeTab === "teams" && (
                        <section className="overview-card">
                            <h2>▣ Teams</h2>
                            <p className="overview-text">
                                Maximum teams: {competition.max_teams || "Unlimited"}
                            </p>
                        </section>
                    )}

                    {activeTab === "monitoring" && monitoring && monitoring.is_organizer === true && (
                        <section className="monitoring-card">
                            <h2>▣ Organizer Monitoring</h2>
                            <p>Track participation, data collection, and model performance.</p>

                            <div className="monitoring-grid">
                                <div className="monitoring-box">
                                    <span>PARTICIPATION</span>
                                    <strong>{monitoring?.participants_count ?? 0}</strong>
                                    <p>Participants joined</p>
                                </div>

                                <div className="monitoring-box">
                                    <span>TEAMS</span>
                                    <strong>{monitoring?.teams_count ?? 0}</strong>
                                    <p>Max teams: {monitoring?.max_teams || "Unlimited"}</p>
                                </div>

                                <div className="monitoring-box">
                                    <span>DATA COLLECTION</span>
                                    <strong>{monitoring?.datasets_count ?? 0}</strong>
                                    <p>{monitoring?.data_collection_status || "Pending"}</p>
                                </div>

                                <div className="monitoring-box">
                                    <span>MODEL PERFORMANCE</span>
                                    <strong>{monitoring?.best_score || "Pending"}</strong>
                                    <p>{monitoring?.primary_metric || "Metric not selected"}</p>
                                </div>

                                <div className="monitoring-box">
                                    <span>SUBMISSIONS</span>
                                    <strong>{monitoring?.submissions_count ?? 0}</strong>
                                    <p>{monitoring?.leaderboard_status || "Waiting"}</p>
                                </div>
                            </div>
                        </section>
                    )}
                </main>
            </div>
        </div>
    );
}

export default CompetitionDetails;