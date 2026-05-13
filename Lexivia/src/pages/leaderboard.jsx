/**
 * Leaderboard.jsx
 *
 * Full leaderboard page for a competition.
 *
 * Features:
 *  - Shows best score per team (or per user if solo)
 *  - Highlights the current user's row and shows their rank prominently
 *  - Displays the competition's primary metric
 *  - Medal icons for top 3
 *  - "higher is better" vs "lower is better" aware sorting
 *  - Auto-refreshes every 30s while any submission is running
 */

import { useEffect, useState, useCallback, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import CompetitionSidebar from "../components/CompetitionSidebar";
import "../Styles/leaderboard.css";

const API = "http://localhost:8000";

function getToken() {
    return (
        localStorage.getItem("token") ||
        localStorage.getItem("access_token") ||
        localStorage.getItem("jwt")
    );
}
function authHeader() {
    const t = getToken();
    return t ? { Authorization: `Bearer ${t}` } : {};
}
function clearAuthAndGoLogin() {
    ["token", "access_token", "jwt"].forEach((k) => localStorage.removeItem(k));
    window.location.href = "/login";
}

function fmtDate(iso) {
    if (!iso) return "—";
    try {
        return new Date(iso).toLocaleString(undefined, {
            month: "short", day: "numeric",
            hour: "2-digit", minute: "2-digit",
        });
    } catch {
        return iso;
    }
}

function fmtScore(val, metric) {
    if (val === null || val === undefined) return "—";
    const n = parseFloat(val);
    if (isNaN(n)) return "—";
    // Show more decimals for metrics where small differences matter
    const highPrecision = ["bleu", "rouge_l", "rouge_1", "rouge_2", "wer", "cer", "mse", "mae", "rmse"];
    return highPrecision.includes(metric) ? n.toFixed(4) : n.toFixed(4);
}

function medalIcon(rank) {
    if (rank === 1) return "🥇";
    if (rank === 2) return "🥈";
    if (rank === 3) return "🥉";
    return null;
}

function RankBadge({ rank, isMe }) {
    const medal = medalIcon(rank);
    if (medal) {
        return <span className={`lb-rank lb-rank--medal ${isMe ? "lb-rank--me" : ""}`}>{medal}</span>;
    }
    return (
        <span className={`lb-rank ${isMe ? "lb-rank--me" : ""}`}>
            #{rank}
        </span>
    );
}

// Score bar — visual representation relative to best score
function ScoreBar({ score, maxScore, higherIsBetter }) {
    if (score === null || maxScore === null || maxScore === 0) return null;
    const pct = higherIsBetter
        ? (score / maxScore) * 100
        : (maxScore / Math.max(score, 0.0001)) * 100;
    const clampedPct = Math.min(Math.max(pct, 2), 100);
    return (
        <div className="lb-bar-track">
            <div
                className="lb-bar-fill"
                style={{ width: `${clampedPct}%` }}
            />
        </div>
    );
}

export default function Leaderboard() {
    const { competitionId } = useParams();
    const navigate = useNavigate();

    const [data, setData]       = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError]     = useState("");
    const [lastUpdated, setLastUpdated] = useState(null);
    const timerRef = useRef(null);

    const fetchLeaderboard = useCallback(async (silent = false) => {
        if (!silent) setLoading(true);
        setError("");
        try {
            const res = await fetch(
                `${API}/competitions/${competitionId}/leaderboard-rich`,
                { headers: authHeader() }
            );
            if (res.status === 401) return clearAuthAndGoLogin();
            const json = await res.json();
            if (!res.ok) throw new Error(json.detail || "Failed to load leaderboard");
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
        // Auto-refresh every 30s
        timerRef.current = setInterval(() => fetchLeaderboard(true), 30_000);
        return () => clearInterval(timerRef.current);
    }, [fetchLeaderboard]);

    if (loading) {
        return (
            <div className="lb-root">
                <CompetitionSidebar />
                <div className="lb-main">
                    <div className="lb-loading">
                        <span className="lb-spinner" />
                        <p>Loading leaderboard…</p>
                    </div>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="lb-root">
                <CompetitionSidebar />
                <div className="lb-main">
                    <div className="lb-error">
                        <span>⚠</span>
                        <p>{error}</p>
                        <button className="lb-btn lb-btn--ghost" onClick={() => fetchLeaderboard()}>
                            Retry
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    const entries          = data?.entries ?? [];
    const myRank           = data?.my_rank;
    const primaryMetric    = data?.primary_metric || "accuracy";
    const higherIsBetter   = data?.higher_is_better ?? true;
    const competitionTitle = data?.competition_title || "";

    // Best score for the score bar
    const maxScore = entries.reduce((max, e) => {
        const s = e.score ?? 0;
        return s > max ? s : max;
    }, 0);

    return (
        <div className="lb-root">
            <CompetitionSidebar />

            <div className="lb-main">

                {/* ── Header ── */}
                <div className="lb-page-header">
                    <div className="lb-page-header-left">
                        <div className="lb-page-eyebrow">COMPETITION</div>
                        <h1 className="lb-page-title">🏆 Leaderboard</h1>
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
                            ← Experiments
                        </button>
                        <button
                            className="lb-btn lb-btn--outline"
                            onClick={() => fetchLeaderboard()}
                            title="Refresh"
                        >
                            ↻
                        </button>
                    </div>
                </div>

                {/* ── My rank banner ── */}
                {myRank && (
                    <div className="lb-my-rank-banner">
                        <div className="lb-my-rank-left">
                            <span className="lb-my-rank-label">Your Rank</span>
                            <span className="lb-my-rank-num">
                                {medalIcon(myRank) || `#${myRank}`}
                            </span>
                        </div>
                        <div className="lb-my-rank-right">
                            {entries.find((e) => e.is_me) && (
                                <>
                                    <div className="lb-my-rank-score">
                                        <span className="lb-my-rank-score-val">
                                            {fmtScore(entries.find((e) => e.is_me)?.score, primaryMetric)}
                                        </span>
                                        <span className="lb-my-rank-score-metric">{primaryMetric}</span>
                                    </div>
                                    <div className="lb-my-rank-team">
                                        {entries.find((e) => e.is_me)?.team_name
                                            ? <>🏷 {entries.find((e) => e.is_me).team_name}</>
                                            : <span className="lb-solo-tag">Solo participant</span>
                                        }
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
                        <span className="lb-stat-num">
                            {entries[0] ? fmtScore(entries[0].score, primaryMetric) : "—"}
                        </span>
                        <span className="lb-stat-lbl">Best Score</span>
                    </div>
                    <div className="lb-stat">
                        <span className="lb-stat-num">
                            {lastUpdated ? lastUpdated.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "—"}
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
                        <div className="lb-empty-icon">🏆</div>
                        <div className="lb-empty-title">No submissions yet</div>
                        <p className="lb-empty-sub">
                            Be the first to submit a model from the{" "}
                            <button
                                className="lb-link"
                                onClick={() => navigate(`/competitions/${competitionId}/experiment-registry`)}
                            >
                                Experiment Registry
                            </button>
                            .
                        </p>
                    </div>
                ) : (
                    <div className="lb-table-wrap">
                        <table className="lb-table">
                            <thead>
                                <tr>
                                    <th className="lb-th lb-th--rank">Rank</th>
                                    <th className="lb-th">Team / Participant</th>
                                    <th className="lb-th lb-th--score">
                                        Score ({primaryMetric})
                                    </th>
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
                                                <div className="lb-participant-info">
                                                    <div className="lb-participant-name">
                                                        {entry.team_name
                                                            ? <>
                                                                <span className="lb-team-icon">🏷</span>
                                                                {entry.team_name}
                                                              </>
                                                            : entry.user_name
                                                        }
                                                        {entry.is_me && (
                                                            <span className="lb-you-tag"> (you)</span>
                                                        )}
                                                    </div>
                                                    {entry.team_name ? (
                                                        <div className="lb-participant-sub">
                                                            submitted by {entry.user_name}
                                                        </div>
                                                    ) : (
                                                        <div className="lb-participant-sub lb-participant-sub--solo">
                                                            Solo participant
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        </td>

                                        <td className="lb-td lb-td--score">
                                            <span className={`lb-score ${entry.rank === 1 ? "lb-score--first" : ""}`}>
                                                {fmtScore(entry.score, primaryMetric)}
                                            </span>
                                        </td>

                                        <td className="lb-td lb-td--bar">
                                            <ScoreBar
                                                score={entry.score}
                                                maxScore={maxScore}
                                                higherIsBetter={higherIsBetter}
                                            />
                                        </td>

                                        <td className="lb-td">
                                            <code className="lb-filename">
                                                {entry.model_filename || "—"}
                                            </code>
                                        </td>

                                        <td className="lb-td lb-td--date">
                                            {fmtDate(entry.submitted_at)}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}

                <div className="lb-table-footer">
                    Auto-refreshes every 30 seconds ·{" "}
                    {entries.length} participant{entries.length !== 1 ? "s" : ""} ·{" "}
                    Metric: {primaryMetric} ({higherIsBetter ? "higher" : "lower"} is better)
                </div>
            </div>
        </div>
    );
}
