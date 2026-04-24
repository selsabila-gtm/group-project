import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import "./CompetitionDetails.css";
import Topbar from "../components/Topbar";

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
    if (level === 1) return "Level 1: Basic Text Classification";
    if (level === 2) return "Level 2: Intermediate NER";
    if (level === 3) return "Level 3: Advanced Semantic Mapping";
    if (level === 4) return "Level 4: Expert Multi-Task Learning";
    return "Level not selected";
}

function CompetitionDetails() {
    const { competitionId } = useParams();
    const navigate = useNavigate();

    const [competition, setCompetition] = useState(null);
    const [loading, setLoading] = useState(true);
    const [joining, setJoining] = useState(false);

    useEffect(() => {
        window.scrollTo(0, 0);

        fetch(`http://127.0.0.1:8000/competitions/${competitionId}`)
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

    const datasets = useMemo(() => {
        return safeJson(competition?.datasets_json, []);
    }, [competition]);

    const requiredSkills = useMemo(() => {
        return safeJson(competition?.required_skills, []);
    }, [competition]);

    const joinCompetition = async () => {
        try {
            setJoining(true);

            const res = await fetch(
                `http://127.0.0.1:8000/competitions/${competitionId}/join`,
                { method: "POST" }
            );

            const data = await res.json();

            if (!res.ok) {
                alert(data.detail || "Could not join competition");
                return;
            }

            alert("Joined competition successfully");
            navigate("/competitions");
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
        <div className="details-page">
            <Topbar />

            <main className="details-main">
                <section className="details-hero">
                    <button
                        type="button"
                        className="back-button"
                        onClick={() => navigate("/competitions")}
                    >
                        ← Back to Competitions
                    </button>
                    <div>
                        <div className="details-meta">
                            <span className="requirement-badge">
                                {competition.status === "OPEN" ? "HIGH PRECISION REQUIRED" : competition.status}
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

                        <button
                            type="button"
                            className="join-btn"
                            onClick={joinCompetition}
                            disabled={joining || competition.status !== "OPEN"}
                        >
                            {joining ? "Joining..." : "Join Competition →"}
                        </button>
                    </div>
                </section>

                <nav className="details-tabs">
                    <button className="active">Overview</button>
                    <button>Rules</button>
                    <button>Datasets</button>
                    <button>Leaderboard</button>
                    <button>Teams</button>
                </nav>

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
                                        {[1, 2, 3, 4, 5].map((bar) => (
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

                        <section className="datasets-card">
                            <div className="datasets-head">
                                <h2>▣ Available Datasets</h2>
                                <button type="button">View File Documentation</button>
                            </div>

                            {datasets.length === 0 ? (
                                <div className="dataset-row">
                                    <div>
                                        <strong>No datasets configured</strong>
                                        <p>The organizer did not add dataset requirements yet.</p>
                                    </div>
                                </div>
                            ) : (
                                datasets.map((dataset, index) => (
                                    <div className="dataset-row" key={index}>
                                        <div>
                                            <strong>{dataset.name || `Dataset ${index + 1}`}</strong>
                                            <p>
                                                {dataset.format || "Unknown format"} •{" "}
                                                {dataset.size || "Size not specified"} •{" "}
                                                {dataset.description || "No description"}
                                            </p>
                                        </div>
                                        <span>⇩</span>
                                    </div>
                                ))
                            )}
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
            </main>
        </div>
    );
}

export default CompetitionDetails;