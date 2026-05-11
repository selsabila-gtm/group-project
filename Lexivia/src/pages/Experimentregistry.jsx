/**
 * ExperimentRegistry.jsx
 *
 * Standalone page — accessible from the competition sidebar under "Experiments".
 * Shows every saved ExperimentRun across all users in this competition.
 * Each row shows: run name, user name, metric, architecture/params, date, status.
 *
 * A user can select one of THEIR OWN runs and click "Submit Model" →
 * the run is evaluated against the hidden test dataset in an offline Docker
 * container → result saved to submissions table.
 */

import { useEffect, useState, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import CompetitionSidebar from "../components/CompetitionSidebar";
import "../Styles/ExperimentRegistry.css";

const API = "http://127.0.0.1:8000";

// ─── Auth helpers ──────────────────────────────────────────────────────────

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

// ─── Tiny helpers ──────────────────────────────────────────────────────────

function fmtDate(iso) {
    if (!iso) return "—";
    try {
        return new Date(iso).toLocaleString(undefined, {
            month: "short",
            day: "numeric",
            hour: "2-digit",
            minute: "2-digit",
        });
    } catch {
        return iso;
    }
}

function metricBadgeClass(val) {
    const n = parseFloat(val);
    if (isNaN(n)) return "er-badge er-badge--neutral";
    if (n >= 0.9)  return "er-badge er-badge--high";
    if (n >= 0.75) return "er-badge er-badge--mid";
    return "er-badge er-badge--low";
}

// ─── Sub-components ────────────────────────────────────────────────────────

function SubmitModal({ run, onClose, onConfirm, submitting, result }) {
    return (
        <div className="er-overlay" onClick={!submitting ? onClose : undefined}>
            <div className="er-modal" onClick={(e) => e.stopPropagation()}>
                <div className="er-modal-header">
                    <span className="er-modal-title">Submit Model for Evaluation</span>
                    {!submitting && (
                        <button className="er-modal-close" onClick={onClose}>✕</button>
                    )}
                </div>

                {!result ? (
                    <>
                        <div className="er-modal-body">
                            <div className="er-modal-info-row">
                                <span className="er-modal-label">Experiment</span>
                                <span className="er-modal-val">{run.name}</span>
                            </div>
                            <div className="er-modal-info-row">
                                <span className="er-modal-label">Model file</span>
                                <code className="er-modal-code">{run.model_filename || "model.pkl"}</code>
                            </div>
                            <div className="er-modal-info-row">
                                <span className="er-modal-label">Local metric</span>
                                <span className="er-modal-val">
                                    {run.metric_name
                                        ? `${run.metric_name} = ${run.metric_value}`
                                        : "not recorded"}
                                </span>
                            </div>

                            <div className="er-modal-note">
                                The model will be evaluated against the <strong>hidden test dataset</strong>{" "}
                                inside an <strong>offline Docker container</strong> (no internet access).
                                This may take up to 5 minutes.
                            </div>
                        </div>

                        <div className="er-modal-footer">
                            <button
                                className="er-btn er-btn--ghost"
                                onClick={onClose}
                                disabled={submitting}
                            >
                                Cancel
                            </button>
                            <button
                                className="er-btn er-btn--primary"
                                onClick={onConfirm}
                                disabled={submitting}
                            >
                                {submitting ? (
                                    <span className="er-spinner-row">
                                        <span className="er-spinner" />
                                        Evaluating…
                                    </span>
                                ) : (
                                    "Submit & Evaluate"
                                )}
                            </button>
                        </div>
                    </>
                ) : (
                    // Result panel
                    <div className="er-modal-body">
                        {result.error ? (
                            <div className="er-result er-result--fail">
                                <div className="er-result-icon">✕</div>
                                <div className="er-result-title">Evaluation Failed</div>
                                <pre className="er-result-detail">{result.error}</pre>
                            </div>
                        ) : (
                            <div className="er-result er-result--ok">
                                <div className="er-result-icon">✓</div>
                                <div className="er-result-title">Evaluation Complete</div>
                                <div className="er-result-score">
                                    <span className="er-result-metric">{result.metric_name}</span>
                                    <span className="er-result-num">
                                        {parseFloat(result.score).toFixed(4)}
                                    </span>
                                </div>
                                <div className="er-result-sub">
                                    Task: <strong>{result.task_type_used}</strong>
                                    {result.dataset_columns?.length > 0 && (
                                        <> · Columns detected:{" "}
                                            <code>{result.dataset_columns.join(", ")}</code>
                                        </>
                                    )}
                                </div>
                            </div>
                        )}

                        <div className="er-modal-footer">
                            <button className="er-btn er-btn--primary" onClick={onClose}>
                                Close
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

// ─── Main page ─────────────────────────────────────────────────────────────

export default function ExperimentRegistry() {
    const { competitionId } = useParams();
    const navigate = useNavigate();

    const [data, setData]             = useState(null);       // full API response
    const [loading, setLoading]       = useState(true);
    const [error, setError]           = useState("");

    // Table controls
    const [search, setSearch]         = useState("");
    const [onlyMine, setOnlyMine]     = useState(false);
    const [sortKey, setSortKey]       = useState("created_at");
    const [sortDir, setSortDir]       = useState("desc");

    // Submit flow
    const [selectedRun, setSelectedRun]   = useState(null);
    const [submitting, setSubmitting]     = useState(false);
    const [submitResult, setSubmitResult] = useState(null);

    // Toast
    const [toast, setToast]   = useState("");
    const showToast = (msg) => {
        setToast(msg);
        setTimeout(() => setToast(""), 3000);
    };

    // ── Fetch ────────────────────────────────────────────────────────────────

    const fetchRegistry = useCallback(async () => {
        setLoading(true);
        setError("");
        try {
            const res = await fetch(
                `${API}/competitions/${competitionId}/experiment-registry`,
                { headers: authHeader() }
            );
            if (res.status === 401) return clearAuthAndGoLogin();
            const json = await res.json();
            if (!res.ok) throw new Error(json.detail || "Failed to load experiments");
            setData(json);
        } catch (e) {
            setError(String(e.message || e));
        } finally {
            setLoading(false);
        }
    }, [competitionId]);

    useEffect(() => {
        fetchRegistry();
    }, [fetchRegistry]);

    // ── Sort / filter helpers ────────────────────────────────────────────────

    const toggleSort = (key) => {
        if (sortKey === key) {
            setSortDir((d) => (d === "asc" ? "desc" : "asc"));
        } else {
            setSortKey(key);
            setSortDir("desc");
        }
    };

    const sortArrow = (key) => {
        if (sortKey !== key) return <span className="er-sort-arrow er-sort-arrow--idle">↕</span>;
        return (
            <span className="er-sort-arrow er-sort-arrow--active">
                {sortDir === "asc" ? "↑" : "↓"}
            </span>
        );
    };

    const filteredRuns = (() => {
        if (!data?.experiments) return [];
        let list = [...data.experiments];

        if (onlyMine) list = list.filter((r) => r.is_mine);

        if (search.trim()) {
            const q = search.toLowerCase();
            list = list.filter(
                (r) =>
                    r.name.toLowerCase().includes(q) ||
                    r.user_name.toLowerCase().includes(q) ||
                    (r.notes || "").toLowerCase().includes(q) ||
                    (r.resource_tier || "").toLowerCase().includes(q)
            );
        }

        list.sort((a, b) => {
            let va = a[sortKey] ?? "";
            let vb = b[sortKey] ?? "";
            if (sortKey === "metric_value") {
                va = parseFloat(va) || 0;
                vb = parseFloat(vb) || 0;
            }
            if (va < vb) return sortDir === "asc" ? -1 : 1;
            if (va > vb) return sortDir === "asc" ? 1 : -1;
            return 0;
        });

        return list;
    })();

    // ── Submit ───────────────────────────────────────────────────────────────

    const handleSubmit = async () => {
        if (!selectedRun) return;
        setSubmitting(true);
        setSubmitResult(null);

        try {
            const res = await fetch(
                `${API}/competitions/${competitionId}/experiment-registry/submit`,
                {
                    method: "POST",
                    headers: { "Content-Type": "application/json", ...authHeader() },
                    body: JSON.stringify({ experiment_run_id: selectedRun.id }),
                }
            );
            if (res.status === 401) return clearAuthAndGoLogin();
            const json = await res.json();
            if (!res.ok) throw new Error(json.detail || "Submission failed");
            setSubmitResult(json);
            if (!json.error) showToast("Model submitted and evaluated ✓");
        } catch (e) {
            setSubmitResult({ error: String(e.message || e) });
        } finally {
            setSubmitting(false);
        }
    };

    const closeModal = () => {
        setSelectedRun(null);
        setSubmitResult(null);
        if (!submitResult?.error) fetchRegistry(); // refresh after successful submit
    };

    // ── Render ───────────────────────────────────────────────────────────────

    if (loading) {
        return (
            <div className="er-root">
                <CompetitionSidebar />
                <div className="er-main">
                    <div className="er-loading">
                        <span className="er-spinner er-spinner--lg" />
                        <p>Loading experiment registry…</p>
                    </div>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="er-root">
                <CompetitionSidebar />
                <div className="er-main">
                    <div className="er-error">
                        <span className="er-error-icon">⚠</span>
                        <p>{error}</p>
                        <button className="er-btn er-btn--ghost" onClick={fetchRegistry}>
                            Retry
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    const experiments = filteredRuns;
    const totalAll    = data?.total ?? 0;
    const taskType    = data?.task_type || "";

    return (
        <div className="er-root">
            <CompetitionSidebar />

            <div className="er-main">

                {/* ── Header ── */}
                <div className="er-page-header">
                    <div className="er-page-header-left">
                        <div className="er-page-eyebrow">EXPERIMENTAL WORKFLOW</div>
                        <h1 className="er-page-title">Experiment Registry</h1>
                        {taskType && (
                            <span className="er-task-chip">{taskType.replace(/_/g, " ")}</span>
                        )}
                    </div>

                    <div className="er-page-header-right">
                        <button
                            className="er-btn er-btn--outline"
                            onClick={() => navigate(`/competitions/${competitionId}/experiments`)}
                        >
                            ← Back to Workspace
                        </button>
                        <button
                            className="er-btn er-btn--outline"
                            onClick={fetchRegistry}
                            title="Refresh"
                        >
                            ↻
                        </button>
                    </div>
                </div>

                {/* ── Stats strip ── */}
                <div className="er-stats-strip">
                    <div className="er-stat">
                        <span className="er-stat-num">{totalAll}</span>
                        <span className="er-stat-lbl">Total Runs</span>
                    </div>
                    <div className="er-stat">
                        <span className="er-stat-num">
                            {data?.experiments?.filter((r) => r.is_mine).length ?? 0}
                        </span>
                        <span className="er-stat-lbl">My Runs</span>
                    </div>
                    <div className="er-stat">
                        <span className="er-stat-num">
                            {
                                new Set(data?.experiments?.map((r) => r.user_id) ?? [])
                                    .size
                            }
                        </span>
                        <span className="er-stat-lbl">Contributors</span>
                    </div>
                    <div className="er-stat">
                        <span className="er-stat-num">
                            {data?.experiments?.filter(
                                (r) => r.metric_value && parseFloat(r.metric_value) >= 0.9
                            ).length ?? 0}
                        </span>
                        <span className="er-stat-lbl">High-score Runs</span>
                    </div>
                </div>

                {/* ── Toolbar ── */}
                <div className="er-toolbar">
                    <div className="er-search-wrap">
                        <span className="er-search-icon">⌕</span>
                        <input
                            className="er-search"
                            placeholder="Search by name, user, notes…"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                        />
                    </div>

                    <label className="er-toggle-label">
                        <input
                            type="checkbox"
                            className="er-toggle-input"
                            checked={onlyMine}
                            onChange={(e) => setOnlyMine(e.target.checked)}
                        />
                        <span className="er-toggle-track">
                            <span className="er-toggle-thumb" />
                        </span>
                        <span className="er-toggle-text">My runs only</span>
                    </label>
                </div>

                {/* ── Table ── */}
                <div className="er-table-wrap">
                    <table className="er-table">
                        <thead>
                            <tr>
                                <th className="er-th er-th--check" />
                                <th
                                    className="er-th er-th--sortable"
                                    onClick={() => toggleSort("name")}
                                >
                                    Run {sortArrow("name")}
                                </th>
                                <th
                                    className="er-th er-th--sortable"
                                    onClick={() => toggleSort("user_name")}
                                >
                                    User {sortArrow("user_name")}
                                </th>
                                <th className="er-th">Model File</th>
                                <th
                                    className="er-th er-th--sortable"
                                    onClick={() => toggleSort("metric_value")}
                                >
                                    Local Metric {sortArrow("metric_value")}
                                </th>
                                <th className="er-th">Resource Tier</th>
                                <th
                                    className="er-th er-th--sortable"
                                    onClick={() => toggleSort("created_at")}
                                >
                                    Saved At {sortArrow("created_at")}
                                </th>
                                <th className="er-th er-th--action">Submit</th>
                            </tr>
                        </thead>

                        <tbody>
                            {experiments.length === 0 ? (
                                <tr>
                                    <td colSpan={8} className="er-empty">
                                        {onlyMine
                                            ? "You have no saved experiment runs yet. Train a model in your workspace and click Save Model."
                                            : "No experiment runs found for this competition yet."}
                                    </td>
                                </tr>
                            ) : (
                                experiments.map((run) => (
                                    <tr
                                        key={run.id}
                                        className={`er-row ${run.is_mine ? "er-row--mine" : ""}`}
                                    >
                                        {/* Run ID / name */}
                                        <td className="er-td er-td--check">
                                            {run.is_mine && (
                                                <span className="er-mine-dot" title="Your run" />
                                            )}
                                        </td>

                                        <td className="er-td">
                                            <div className="er-run-name">{run.name}</div>
                                            <div className="er-run-id">
                                                {String(run.id).slice(0, 8)}
                                            </div>
                                            {run.notes && (
                                                <div className="er-run-notes" title={run.notes}>
                                                    {run.notes.length > 60
                                                        ? run.notes.slice(0, 60) + "…"
                                                        : run.notes}
                                                </div>
                                            )}
                                        </td>

                                        {/* User */}
                                        <td className="er-td">
                                            <div className="er-user-cell">
                                                <div className="er-avatar">
                                                    {run.user_name.slice(0, 1).toUpperCase()}
                                                </div>
                                                <span className={`er-username ${run.is_mine ? "er-username--me" : ""}`}>
                                                    {run.user_name}
                                                    {run.is_mine && (
                                                        <span className="er-you-tag"> (you)</span>
                                                    )}
                                                </span>
                                            </div>
                                        </td>

                                        {/* Model file */}
                                        <td className="er-td">
                                            <code className="er-filename">
                                                {run.model_filename || "model.pkl"}
                                            </code>
                                        </td>

                                        {/* Metric */}
                                        <td className="er-td er-td--metric">
                                            {run.metric_value ? (
                                                <span className={metricBadgeClass(run.metric_value)}>
                                                    {run.metric_name && (
                                                        <span className="er-badge-label">
                                                            {run.metric_name}
                                                        </span>
                                                    )}
                                                    {parseFloat(run.metric_value).toFixed(4)}
                                                </span>
                                            ) : (
                                                <span className="er-badge er-badge--neutral">—</span>
                                            )}
                                        </td>

                                        {/* Resource tier */}
                                        <td className="er-td">
                                            <span className="er-tier-chip">
                                                {run.resource_tier || "—"}
                                            </span>
                                        </td>

                                        {/* Date */}
                                        <td className="er-td er-td--date">
                                            {fmtDate(run.created_at)}
                                        </td>

                                        {/* Submit action */}
                                        <td className="er-td er-td--action">
                                            {run.is_mine ? (
                                                <button
                                                    className="er-submit-btn"
                                                    onClick={() => {
                                                        setSelectedRun(run);
                                                        setSubmitResult(null);
                                                    }}
                                                >
                                                    Submit
                                                </button>
                                            ) : (
                                                <span className="er-submit-na" title="You can only submit your own runs">
                                                    —
                                                </span>
                                            )}
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>

                <div className="er-table-footer">
                    Showing {experiments.length} of {totalAll} runs
                </div>
            </div>

            {/* ── Submit Modal ── */}
            {selectedRun && (
                <SubmitModal
                    run={selectedRun}
                    onClose={closeModal}
                    onConfirm={handleSubmit}
                    submitting={submitting}
                    result={submitResult}
                />
            )}

            {/* ── Toast ── */}
            {toast && <div className="er-toast">{toast}</div>}
        </div>
    );
}
