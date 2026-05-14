/**
 * Leaderboard.jsx
 *
 * CHANGES vs previous version:
 *  - FIX: 401 now shows "session expired" + Retry/Login buttons instead of
 *    immediately wiping localStorage — stops the random logout bug.
 *  - All emoji replaced with inline SVG icons
 *  - Light/white theme (leaderboard.css)
 */

import { useEffect, useState, useCallback, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "../config/supabase.js";
import CompetitionSidebar from "../components/CompetitionSidebar";
import CompetitionTopbar from "../components/CompetitionTopbar";
import "../Styles/leaderboard.css";

const API = "http://127.0.0.1:8000";

// ─── Auth helpers (same pattern as all other pages) ───────────────────────────

async function getFreshToken() {
    const {
        data: { session },
        error,
    } = await supabase.auth.getSession();

    if (error) {
        console.warn("Supabase session error:", error);
    }

    if (session?.access_token) {
        localStorage.setItem("token", session.access_token);
        localStorage.setItem("user", JSON.stringify(session.user));
        return session.access_token;
    }

    return (
        localStorage.getItem("token") ||
        localStorage.getItem("access_token") ||
        localStorage.getItem("jwt")
    );
}

function clearAuthAndGoLogin() {
    localStorage.removeItem("token");
    localStorage.removeItem("access_token");
    localStorage.removeItem("jwt");
    localStorage.removeItem("user");

    window.location.href = "/login";
}

async function fetchWithFreshAuth(url, options = {}) {
    let token = await getFreshToken();

    let res = await fetch(url, {
        ...options,
        headers: {
            ...(options.headers || {}),
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
    });

    if (res.status !== 401) {
        return res;
    }

    const { data, error } = await supabase.auth.refreshSession();

    if (!error && data.session?.access_token) {
        token = data.session.access_token;

        localStorage.setItem("token", token);
        localStorage.setItem("user", JSON.stringify(data.session.user));

        res = await fetch(url, {
            ...options,
            headers: {
                ...(options.headers || {}),
                Authorization: `Bearer ${token}`,
            },
        });
    }

    return res;
}

// ─── Icons ────────────────────────────────────────────────────────────────────

function IconTrophy({ size = 20 }) {
    return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
            stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M6 9H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h2" />
            <path d="M18 9h2a2 2 0 0 0 2-2V5a2 2 0 0 0-2-2h-2" />
            <path d="M6 2h12v10a6 6 0 0 1-12 0V2z" />
            <path d="M12 18v4" /><path d="M8 22h8" />
        </svg>
    );
}

/** Replaces 🥇🥈🥉 */
function MedalIcon({ rank }) {
    const map = {
        1: { color: "#b45309", bg: "rgba(180,83,9,0.10)" },
        2: { color: "#64748b", bg: "rgba(100,116,139,0.10)" },
        3: { color: "#92400e", bg: "rgba(146,64,14,0.10)" },
    };
    const c = map[rank];
    if (!c) return null;
    return (
        <span style={{
            display: "inline-flex", alignItems: "center", justifyContent: "center",
            width: 26, height: 26, borderRadius: "50%",
            background: c.bg, color: c.color, flexShrink: 0,
        }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
                stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="8" r="6" />
                <path d="M8.21 13.89L7 23l5-3 5 3-1.21-9.12" />
            </svg>
        </span>
    );
}

function IconChevronLeft({ size = 13 }) {
    return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
            stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6" />
        </svg>
    );
}
function IconRefresh({ size = 13 }) {
    return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
            stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="1 4 1 10 7 10" />
            <path d="M3.51 15a9 9 0 1 0 .49-4.5" />
        </svg>
    );
}
function IconUsers({ size = 11 }) {
    return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
            stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
            <circle cx="9" cy="7" r="4" />
            <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
            <path d="M16 3.13a4 4 0 0 1 0 7.75" />
        </svg>
    );
}
function IconWarning({ size = 28 }) {
    return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
            stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
            <line x1="12" y1="9" x2="12" y2="13" />
            <line x1="12" y1="17" x2="12.01" y2="17" />
        </svg>
    );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtDate(iso) {
    if (!iso) return "—";
    try {
        return new Date(iso).toLocaleString(undefined, {
            month: "short", day: "numeric",
            hour: "2-digit", minute: "2-digit",
        });
    } catch { return iso; }
}

function fmtScore(val) {
    if (val === null || val === undefined) return "—";
    const n = parseFloat(val);
    if (isNaN(n)) return "—";
    return n.toFixed(4);
}

// ─── Rank badge ───────────────────────────────────────────────────────────────

function RankBadge({ rank, isMe }) {
    if (rank <= 3) {
        return (
            <span className={`lb-rank ${isMe ? "lb-rank--me" : ""}`}>
                <MedalIcon rank={rank} />
            </span>
        );
    }
    return <span className={`lb-rank ${isMe ? "lb-rank--me" : ""}`}>#{rank}</span>;
}

// ─── Score bar ────────────────────────────────────────────────────────────────

function ScoreBar({ score, maxScore, higherIsBetter }) {
    if (score === null || maxScore === null || maxScore === 0) return null;
    const pct = higherIsBetter
        ? (score / maxScore) * 100
        : (maxScore / Math.max(score, 0.0001)) * 100;
    return (
        <div className="lb-bar-track">
            <div className="lb-bar-fill" style={{ width: `${Math.min(Math.max(pct, 2), 100)}%` }} />
        </div>
    );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function Leaderboard() {
    const { competitionId } = useParams();
    const navigate = useNavigate();

    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [lastUpdated, setLastUpdated] = useState(null);
    const timerRef = useRef(null);

    // Force light background
    useEffect(() => {
        document.body.style.background = "#f4f6fa";
        document.body.style.color = "#111827";
        const root = document.getElementById("root");
        if (root) root.style.background = "#f4f6fa";
        return () => {
            document.body.style.background = "";
            document.body.style.color = "";
            if (root) root.style.background = "";
        };
    }, []);

    // ── Fetch ─────────────────────────────────────────────────────────────────

    const fetchLeaderboard = useCallback(async (silent = false) => {
        if (!silent) setLoading(true);
        setError("");

        try {
            const res = await fetchWithFreshAuth(
                `${API}/competitions/${competitionId}/leaderboard-rich`
            );

            if (res.status === 401) {
                setError("__401__");
                if (!silent) setLoading(false);
                return;
            }

            const json = await res.json();

            if (!res.ok) {
                throw new Error(json.detail || "Failed to load leaderboard");
            }

            setData(json);
            setLastUpdated(new Date());
        } catch (e) {
            setError(String(e.message || e));
        } finally {
            if (!silent) setLoading(false);
        }
    }, [competitionId]);

    useEffect(() => {
        fetchLeaderboard();
        timerRef.current = setInterval(() => fetchLeaderboard(true), 30_000);
        return () => clearInterval(timerRef.current);
    }, [fetchLeaderboard]);

    // ── Loading / error states ────────────────────────────────────────────────

    if (loading) {
        return (
            <div className="lb-root">
                <CompetitionSidebar competitionId={competitionId} />
                <div className="lb-main">
                    <CompetitionTopbar
                        competitionId={competitionId}
                        competitionTitle="Competition"
                        status="LAB ACTIVE"
                    />

                    <div className="lb-loading">
                        <span className="lb-spinner" />
                        <p>Loading leaderboard…</p>
                    </div>
                </div>
            </div>
        );
    }

    if (error === "__401__") {
        return (
            <div className="lb-root">
                <CompetitionSidebar competitionId={competitionId} />
                <div className="lb-main">
                    <CompetitionTopbar
                        competitionId={competitionId}
                        competitionTitle="Competition"
                        status="LAB ACTIVE"
                    />

                    <div className="lb-error">
                        <IconWarning size={28} />
                        <p>Your session has expired.</p>
                        <div style={{ display: "flex", gap: 10 }}>
                            <button className="lb-btn lb-btn--ghost" onClick={() => fetchLeaderboard()}>Retry</button>
                            <button className="lb-btn lb-btn--primary" onClick={clearAuthAndGoLogin}>Log in again</button>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="lb-root">
                <CompetitionSidebar competitionId={competitionId} />

                <div className="lb-main">
                    <CompetitionTopbar
                        competitionId={competitionId}
                        competitionTitle="Competition"
                        status="LAB ACTIVE"
                    />

                    <div className="lb-error">
                        <IconWarning size={28} />
                        <p>{error}</p>
                        <button className="lb-btn lb-btn--ghost" onClick={() => fetchLeaderboard()}>Retry</button>
                    </div>
                </div>
            </div>
        );
    }

    const entries = data?.entries ?? [];
    const myRank = data?.my_rank;
    const primaryMetric = data?.primary_metric || "accuracy";
    const higherIsBetter = data?.higher_is_better ?? true;
    const competitionTitle = data?.competition_title || "";

    const maxScore = entries.reduce((max, e) => {
        const s = e.score ?? 0;
        return s > max ? s : max;
    }, 0);

    return (
        <div className="lb-root">
            <CompetitionSidebar
                competitionId={competitionId}
                competitionTitle={competitionTitle || "Competition"}
            />

            <div className="lb-main">
                <CompetitionTopbar
                    competitionId={competitionId}
                    competitionTitle={competitionTitle || "Competition"}
                    status="LAB ACTIVE"
                />

                <div className="lb-content">
                    {/* ── Header ── */}
                    <div className="lb-page-header">
                        <div className="lb-page-header-left">
                            <div className="lb-page-eyebrow">COMPETITION</div>
                            <h1 className="lb-page-title">
                                <span className="lb-title-icon"><IconTrophy size={18} /></span>
                                Leaderboard
                            </h1>
                            {competitionTitle && (
                                <div className="lb-competition-name">{competitionTitle}</div>
                            )}
                            <div className="lb-header-chips">
                                <span className="lb-metric-chip">
                                    Metric: <strong>{primaryMetric}</strong>
                                </span>
                                <span className={`lb-order-chip ${higherIsBetter ? "lb-order-chip--higher" : "lb-order-chip--lower"}`}>
                                    {higherIsBetter ? "↑ Higher is better" : "↓ Lower is better"}
                                </span>
                            </div>
                        </div>

                        <div className="lb-page-header-right">
                            <button
                                className="lb-btn lb-btn--outline"
                                onClick={() => navigate(`/competitions/${competitionId}/experiment-registry`)}
                            >
                                <IconChevronLeft /> Experiments
                            </button>
                            <button
                                className="lb-btn lb-btn--outline"
                                onClick={() => fetchLeaderboard()}
                                title="Refresh"
                            >
                                <IconRefresh />
                            </button>
                        </div>
                    </div>

                    {/* ── My rank banner ── */}
                    {myRank && (
                        <div className="lb-my-rank-banner">
                            <div className="lb-my-rank-left">
                                <span className="lb-my-rank-label">Your Rank</span>
                                <span className="lb-my-rank-num">
                                    {myRank <= 3 ? <MedalIcon rank={myRank} /> : `#${myRank}`}
                                </span>
                            </div>
                            <div className="lb-my-rank-right">
                                {entries.find((e) => e.is_me) && (
                                    <>
                                        <div className="lb-my-rank-score">
                                            <span className="lb-my-rank-score-val">
                                                {fmtScore(entries.find((e) => e.is_me)?.score)}
                                            </span>
                                            <span className="lb-my-rank-score-metric">{primaryMetric}</span>
                                        </div>
                                        <div className="lb-my-rank-team">
                                            {entries.find((e) => e.is_me)?.team_name
                                                ? <><IconUsers size={11} /> {entries.find((e) => e.is_me).team_name}</>
                                                : <span className="lb-solo-tag">Solo participant</span>}
                                        </div>
                                    </>
                                )}
                            </div>
                        </div>
                    )}

                    {/* ── Stats strip ── */}
                    <div className="lb-stats-strip">
                        <div className="lb-stat">
                            <span className="lb-stat-num">{entries.length}</span>
                            <span className="lb-stat-lbl">Teams / Participants</span>
                        </div>
                        <div className="lb-stat">
                            <span className="lb-stat-num">{entries[0] ? fmtScore(entries[0].score) : "—"}</span>
                            <span className="lb-stat-lbl">Best Score</span>
                        </div>
                        <div className="lb-stat">
                            <span className="lb-stat-num">
                                {lastUpdated
                                    ? lastUpdated.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
                                    : "—"}
                            </span>
                            <span className="lb-stat-lbl">Last Updated</span>
                        </div>
                        <div className="lb-stat">
                            <span className="lb-stat-num">{primaryMetric}</span>
                            <span className="lb-stat-lbl">Primary Metric</span>
                        </div>
                    </div>

                    {/* ── Table ── */}
                    {entries.length === 0 ? (
                        <div className="lb-empty">
                            <div className="lb-empty-icon"><IconTrophy size={26} /></div>
                            <div className="lb-empty-title">No submissions yet</div>
                            <p className="lb-empty-sub">
                                Be the first to submit a model from the{" "}
                                <button
                                    className="lb-link"
                                    onClick={() => navigate(`/competitions/${competitionId}/experiment-registry`)}
                                >
                                    Experiment Registry
                                </button>.
                            </p>
                        </div>
                    ) : (
                        <div className="lb-table-wrap">
                            <table className="lb-table">
                                <thead>
                                    <tr>
                                        <th className="lb-th lb-th--rank">Rank</th>
                                        <th className="lb-th">Team / Participant</th>
                                        <th className="lb-th lb-th--score">Score ({primaryMetric})</th>
                                        <th className="lb-th lb-th--bar" />
                                        <th className="lb-th">Model</th>
                                        <th className="lb-th">Submitted</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {entries.map((entry) => (
                                        <tr
                                            key={entry.submission_id}
                                            className={`lb-row ${entry.is_me ? "lb-row--me" : ""} ${entry.rank <= 3 ? `lb-row--top${entry.rank}` : ""}`}
                                        >
                                            <td className="lb-td lb-td--rank">
                                                <RankBadge rank={entry.rank} isMe={entry.is_me} />
                                            </td>
                                            <td className="lb-td">
                                                <div className="lb-participant-cell">
                                                    <div className="lb-avatar">
                                                        {(entry.team_name || entry.user_name || "?").slice(0, 1).toUpperCase()}
                                                    </div>
                                                    <div>
                                                        <div className="lb-participant-name">
                                                            {entry.team_name && (
                                                                <span className="lb-team-icon"><IconUsers size={11} /></span>
                                                            )}
                                                            {entry.team_name || entry.user_name}
                                                            {entry.is_me && <span className="lb-you-tag"> (you)</span>}
                                                        </div>
                                                        {entry.team_name ? (
                                                            <div className="lb-participant-sub">submitted by {entry.user_name}</div>
                                                        ) : (
                                                            <div className="lb-participant-sub lb-participant-sub--solo">Solo participant</div>
                                                        )}
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="lb-td lb-td--score">
                                                <span className={`lb-score ${entry.rank === 1 ? "lb-score--first" : ""}`}>
                                                    {fmtScore(entry.score)}
                                                </span>
                                            </td>
                                            <td className="lb-td lb-td--bar">
                                                <ScoreBar score={entry.score} maxScore={maxScore} higherIsBetter={higherIsBetter} />
                                            </td>
                                            <td className="lb-td">
                                                <code className="lb-filename">{entry.model_filename || "—"}</code>
                                            </td>
                                            <td className="lb-td lb-td--date">{fmtDate(entry.submitted_at)}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}

                    <div className="lb-table-footer">
                        Auto-refreshes every 30 seconds · {entries.length} participant{entries.length !== 1 ? "s" : ""} · Metric: {primaryMetric} ({higherIsBetter ? "higher" : "lower"} is better)
                    </div>
                </div>
            </div>
        </div>
    );
}
