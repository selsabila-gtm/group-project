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
    const [hasPendingRequest, setHasPendingRequest] = useState(false);

    // Team-join modal state
    const [showTeamModal, setShowTeamModal] = useState(false);
    const [myTeams, setMyTeams] = useState([]);
    const [selectedTeamId, setSelectedTeamId] = useState("");
    const [joinMessage, setJoinMessage] = useState("");
    const [teamsLoading, setTeamsLoading] = useState(false);

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
            .then((data) => {
                setCompetition(data);
                if (data.has_pending_request) setHasPendingRequest(true);
            })
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

    // ── Load user's teams for team-join modal ─────────────────────────────────
    const loadMyTeams = async () => {
        setTeamsLoading(true);
        try {
            const token = localStorage.getItem("token");
            const res = await fetch(`http://127.0.0.1:8000/teams?tab=mine&limit=50`, {
                headers: { Authorization: `Bearer ${token}` },
            });
            const data = await res.json();
            setMyTeams(data.teams ?? []);
        } catch (e) {
            console.error(e);
        } finally {
            setTeamsLoading(false);
        }
    };

    const openJoinModal = () => {
        setShowTeamModal(true);
        loadMyTeams();
    };

    // Solo join (individual, no team)
    const joinSolo = async () => {
        try {
            setJoining(true);
            const token = localStorage.getItem("token");
            const res = await fetch(`http://127.0.0.1:8000/competitions/${competitionId}/join`, {
                method: "POST",
                headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
                body: JSON.stringify({ message: joinMessage }),
            });
            const data = await res.json();
            if (!res.ok) { alert(data.detail || "Could not join competition"); return; }

            if (data.status === "pending") {
                setHasPendingRequest(true);
                alert("Your request has been submitted and is awaiting organizer approval.");
            } else {
                setIsJoined(true);
                navigate(`/competitions/${competitionId}/data-collection`);
            }
        } catch (error) {
            console.error(error);
            alert("Backend error while joining competition");
        } finally {
            setJoining(false);
        }
    };

    // Team join (leader submits on behalf of team)
    const joinAsTeam = async () => {
        if (!selectedTeamId) {
            alert("Please select a team.")
            return
        }

        try {
            setJoining(true)

            const token = localStorage.getItem("token")

            const res = await fetch(`http://127.0.0.1:8000/competitions/${competitionId}/join-team`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify({
                    team_id: selectedTeamId,
                    message: joinMessage,
                }),
            })

            const text = await res.text()

            let data = {}
            try {
                data = text ? JSON.parse(text) : {}
            } catch {
                data = { detail: text }
            }

            if (!res.ok) {
                alert(data.detail || "Could not submit team join request")
                return
            }

            setShowTeamModal(false)

            if (data.status === "pending") {
                setHasPendingRequest(true)
                alert("Team join request submitted and is awaiting organizer approval.")
            } else {
                setIsJoined(true)
                navigate(`/competitions/${competitionId}/data-collection`)
            }
        } catch (error) {
            console.error(error)
            alert(error.message || "Backend error while joining competition")
        } finally {
            setJoining(false)
        }
    }

    // Legacy shim — called by the plain "Join Competition" button when no team size is required
    const joinCompetition = joinSolo;

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
                            ) : hasPendingRequest ? (
                                <button
                                    type="button"
                                    className="join-btn"
                                    disabled
                                    style={{ opacity: 0.7, cursor: "not-allowed", background: "#f59e0b" }}
                                >
                                    ⏳ Request Pending…
                                </button>
                            ) : (
                                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                                    {/* If team size required → show team-join button; always also offer solo join */}
                                    {(competition.min_members > 1 || competition.max_members > 1) ? (
                                        <>
                                            <button
                                                type="button"
                                                className="join-btn"
                                                onClick={openJoinModal}
                                                disabled={joining || competition.status !== "OPEN"}
                                            >
                                                {joining ? "Submitting…" : "Join with Team →"}
                                            </button>
                                            <button
                                                type="button"
                                                className="join-btn"
                                                style={{ background: "#6b7280", fontSize: 13, padding: "10px 18px" }}
                                                onClick={joinSolo}
                                                disabled={joining || competition.status !== "OPEN"}
                                            >
                                                Join Solo
                                            </button>
                                        </>
                                    ) : (
                                        <button
                                            type="button"
                                            className="join-btn"
                                            onClick={joinCompetition}
                                            disabled={joining || competition.status !== "OPEN"}
                                        >
                                            {joining ? "Joining…" : competition.join_method === "manual" ? "Request to Join →" : "Join Competition →"}
                                        </button>
                                    )}
                                </div>
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

            {/* ── Team Join Modal ─────────────────────────────────────────── */}
            {showTeamModal && (
                <div style={{
                    position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)",
                    display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000,
                }}>
                    <div style={{
                        background: "#fff", borderRadius: 16, padding: "32px 28px",
                        width: "100%", maxWidth: 480, boxShadow: "0 20px 60px rgba(0,0,0,0.18)",
                    }}>
                        <h2 style={{ margin: "0 0 6px", fontSize: 20, fontWeight: 700, color: "#1a1c20" }}>
                            Join as a Team
                        </h2>
                        <p style={{ margin: "0 0 20px", color: "#6b7280", fontSize: 13 }}>
                            Only team leaders can submit on behalf of their team.
                            {competition.min_members && ` Required team size: ${competition.min_members}${competition.max_members && competition.max_members !== competition.min_members ? `–${competition.max_members}` : ""} members.`}
                        </p>

                        {teamsLoading ? (
                            <p style={{ color: "#aaa", fontSize: 13 }}>Loading your teams…</p>
                        ) : myTeams.length === 0 ? (
                            <div style={{ padding: "16px", background: "#f9fafb", borderRadius: 8, color: "#6b7280", fontSize: 13 }}>
                                You are not a member of any team yet.{" "}
                                <button
                                    type="button"
                                    onClick={() => navigate("/teams")}
                                    style={{ color: "#2d5cf6", background: "none", border: "none", cursor: "pointer", fontWeight: 600, padding: 0 }}
                                >
                                    Create or join a team →
                                </button>
                            </div>
                        ) : (
                            <div style={{ display: "flex", flexDirection: "column", gap: 10, maxHeight: 220, overflowY: "auto", marginBottom: 16 }}>
                                {myTeams.map((team) => (
                                    <label
                                        key={team.id}
                                        style={{
                                            display: "flex", alignItems: "center", gap: 12,
                                            padding: "12px 14px", borderRadius: 10, cursor: "pointer",
                                            border: `2px solid ${selectedTeamId === String(team.id) ? "#2d5cf6" : "#e5e7eb"}`,
                                            background: selectedTeamId === String(team.id) ? "#f0f4ff" : "#fafafa",
                                            transition: "all 0.15s",
                                        }}
                                    >
                                        <input
                                            type="radio"
                                            name="team"
                                            value={String(team.id)}
                                            checked={selectedTeamId === String(team.id)}
                                            disabled={team.current_user_role !== "leader"}
                                            onChange={() => setSelectedTeamId(String(team.id))}
                                            style={{ accentColor: "#2d5cf6" }}
                                        />
                                        <div>
                                            <div style={{ fontWeight: 600, fontSize: 14, color: "#1a1c20" }}>{team.name}</div>
                                            <div style={{ fontSize: 12, color: "#9ca3af" }}>{team.member_count} member{team.member_count !== 1 ? "s" : ""}</div>
                                        </div>
                                        {team.current_user_role !== "leader" && (
                                            <span style={{ marginLeft: "auto", fontSize: 10, color: "#f59e0b", fontWeight: 700 }}>NOT LEADER</span>
                                        )}
                                    </label>
                                ))}
                            </div>
                        )}

                        {competition.join_method === "manual" && (
                            <div style={{ marginBottom: 16 }}>
                                <label style={{ display: "block", fontSize: 13, fontWeight: 600, marginBottom: 6, color: "#374151" }}>
                                    Message to organizer (optional)
                                </label>
                                <textarea
                                    rows={3}
                                    placeholder="Tell the organizer why your team should be accepted…"
                                    value={joinMessage}
                                    onChange={(e) => setJoinMessage(e.target.value)}
                                    style={{
                                        width: "100%", boxSizing: "border-box", padding: "10px 12px",
                                        border: "1px solid #d1d5db", borderRadius: 8, fontSize: 13,
                                        fontFamily: "inherit", resize: "vertical",
                                    }}
                                />
                            </div>
                        )}

                        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 8 }}>
                            <button
                                type="button"
                                onClick={() => { setShowTeamModal(false); setSelectedTeamId(""); setJoinMessage(""); }}
                                style={{
                                    padding: "10px 20px", borderRadius: 9, border: "1.5px solid #d1d5db",
                                    background: "#fff", fontWeight: 600, fontSize: 13, cursor: "pointer",
                                }}
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                onClick={joinAsTeam}
                                disabled={joining || !selectedTeamId}
                                style={{
                                    padding: "10px 24px", borderRadius: 9, border: "none",
                                    background: joining || !selectedTeamId ? "#93c5fd" : "#2d5cf6",
                                    color: "#fff", fontWeight: 700, fontSize: 13,
                                    cursor: joining || !selectedTeamId ? "not-allowed" : "pointer",
                                }}
                            >
                                {joining ? "Submitting…" : competition.join_method === "manual" ? "Request to Join" : "Join Competition"}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

export default CompetitionDetails;