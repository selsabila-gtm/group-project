import { useEffect, useState, useCallback } from "react";
import { useParams } from "react-router-dom";
import CompetitionSidebar from "../components/CompetitionSidebar";
import "./DatasetHub.css";

const API = "http://127.0.0.1:8000";

function authHeader() {
    const token = localStorage.getItem("token");
    return token ? { Authorization: `Bearer ${token}` } : {};
}

// ─── Top bar ───────────────────────────────────────────────────────────────────
function CompetitionTopbar({ competition }) {
    return (
        <div className="dh-topbar">
            <div className="dh-topbar-left">
                <span className="dh-topbar-name">{competition?.title || "…"}</span>
                <span className="dh-lab-badge">LAB ACTIVE</span>
                <nav className="dh-topbar-tabs">
                    {["Overview", "Rules", "Resources"].map((t, i) => (
                        <button key={t} type="button" className={`dh-topbar-tab${i === 0 ? " active" : ""}`}>{t}</button>
                    ))}
                </nav>
            </div>
            <div className="dh-topbar-right">
                <button type="button" className="dh-icon-btn" title="Search">
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
                    </svg>
                </button>
                <button type="button" className="dh-icon-btn" title="Notifications">
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
                        <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
                    </svg>
                </button>
                <button type="button" className="dh-icon-btn" title="Settings">
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="12" cy="12" r="3"/>
                        <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
                    </svg>
                </button>
                <div className="dh-avatar">U</div>
            </div>
        </div>
    );
}

// ─── Stat card ─────────────────────────────────────────────────────────────────
function StatCard({ label, value, sub, accent }) {
    return (
        <div className="dh-stat-card">
            <span className="dh-stat-val" style={accent ? { color: accent } : {}}>{value}</span>
            <span className="dh-stat-label">{label}</span>
            {sub && <span className="dh-stat-sub">{sub}</span>}
        </div>
    );
}

// ─── Version Control sidebar ────────────────────────────────────────────────────
// FIX 1: Removed the stray broken <div> block (lines 87-91 in original) that
//         referenced `i` and `v` outside any .map() — this caused an immediate
//         ReferenceError that crashed the whole page on load.
function VersionControl({ versions, loading, onCreateVersion, isOrganizer, onSelectVersion }) {
    const [showModal, setShowModal] = useState(false);
    const [tag, setTag] = useState("");
    const [label, setLabel] = useState("");
    const [creating, setCreating] = useState(false);

    const handleCreate = async () => {
        setCreating(true);
        await onCreateVersion({ tag, label });
        setTag(""); setLabel("");
        setShowModal(false);
        setCreating(false);
    };

    return (
        <div className="dh-version-panel">
            <div className="dh-version-header">
                <span className="dh-version-title">VERSION CONTROL</span>
                <button className="dh-version-icon-btn" title="Refresh">
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="1 4 1 10 7 10"/><polyline points="23 20 23 14 17 14"/>
                        <path d="M20.49 9A9 9 0 0 0 5.64 5.64L1 10m22 4l-4.64 4.36A9 9 0 0 1 3.51 15"/>
                    </svg>
                </button>
            </div>

            {loading ? (
                <div className="dh-version-loading">Loading…</div>
            ) : (
                <div className="dh-version-list">
                    {versions.map((v, i) => (
                        <div
                            key={i}
                            className={`dh-version-row${v.is_current ? " current" : ""}`}
                            onClick={() => onSelectVersion && onSelectVersion(v.tag)}
                            style={{ cursor: "pointer" }}
                        >
                            <div className="dh-version-dot-wrap">
                                <div className={`dh-version-dot${v.is_current ? " active" : ""}`} />
                                {i < versions.length - 1 && <div className="dh-version-line" />}
                            </div>
                            <div className="dh-version-info">
                                <div className="dh-version-tag-row">
                                    <span className="dh-version-tag">{v.tag}</span>
                                    {v.is_current && <span className="dh-version-active-badge">Active</span>}
                                </div>
                                <span className="dh-version-date">{v.date}</span>
                                {!v.is_current && (
                                    <span className="dh-version-meta">
                                        {v.total_samples?.toLocaleString()} samples · {v.validated_samples} validated
                                    </span>
                                )}
                            </div>
                            {v.is_current && (
                                <svg className="dh-version-check" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#1359db" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                    <polyline points="20 6 9 17 4 12"/>
                                </svg>
                            )}
                        </div>
                    ))}
                </div>
            )}

            {isOrganizer && (
                <button className="dh-snapshot-btn" onClick={() => setShowModal(true)}>
                    + Snapshot Dataset
                </button>
            )}

            {/* Modal */}
            {showModal && (
                <div className="dh-modal-backdrop" onClick={() => setShowModal(false)}>
                    <div className="dh-modal" onClick={(e) => e.stopPropagation()}>
                        <h3 className="dh-modal-title">Create Dataset Snapshot</h3>
                        <p className="dh-modal-sub">A snapshot freezes the current state of all validated samples.</p>
                        <label className="dh-modal-label">VERSION TAG</label>
                        <input className="dh-modal-input" value={tag} onChange={e => setTag(e.target.value)} placeholder="e.g. v1.3" />
                        <label className="dh-modal-label" style={{ marginTop: 10 }}>LABEL (optional)</label>
                        <input className="dh-modal-input" value={label} onChange={e => setLabel(e.target.value)} placeholder="e.g. Pre-validation freeze" />
                        <div className="dh-modal-actions">
                            <button className="dh-modal-cancel" onClick={() => setShowModal(false)}>Cancel</button>
                            <button className="dh-modal-confirm" onClick={handleCreate} disabled={creating}>
                                {creating ? "Creating…" : "Create Snapshot"}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

// ─── Data Health Panel ──────────────────────────────────────────────────────────
function DataHealthPanel({ health }) {
    if (!health) return null;
    const severity = health.alerts?.length > 0
        ? health.alerts[0].level === "critical" ? "CRITICAL" : "WARNING"
        : "HEALTHY";

    const severityColor = severity === "CRITICAL" ? "#e53e3e" : severity === "WARNING" ? "#dd6b20" : "#18965d";

    const labels = Object.entries(health.label_distribution || {});
    const totalLabeled = labels.reduce((s, [, v]) => s + v, 0);

    return (
        <div className="dh-health-panel">
            <div className="dh-health-header">
                <div className="dh-health-title-row">
                    {severity !== "HEALTHY" && <span className="dh-health-warn-icon">⚠</span>}
                    <span className="dh-health-title">Data Health Panel</span>
                </div>
                <span className="dh-health-badge" style={{ background: severityColor + "18", color: severityColor }}>
                    {severity}
                </span>
            </div>

            {labels.length > 0 && (
                <div className="dh-health-section">
                    <p className="dh-health-section-title">LABEL DIST.</p>
                    <div className="dh-label-bars">
                        {labels.slice(0, 5).map(([lbl, cnt]) => (
                            <div key={lbl} className="dh-label-bar-row">
                                <span className="dh-label-name">{lbl}</span>
                                <div className="dh-label-track">
                                    <div
                                        className="dh-label-fill"
                                        style={{ width: totalLabeled ? `${Math.round((cnt / totalLabeled) * 100)}%` : "0%" }}
                                    />
                                </div>
                                <span className="dh-label-pct">
                                    {totalLabeled ? Math.round((cnt / totalLabeled) * 100) : 0}%
                                </span>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {health.alerts?.length > 0 && (
                <div className="dh-health-alerts">
                    {health.alerts.map((a, i) => (
                        <div key={i} className={`dh-alert-row${a.level === "critical" ? " crit" : ""}`}>
                            <span className="dh-alert-dot" />
                            <div>
                                <p className="dh-alert-type">{a.type}</p>
                                <p className="dh-alert-detail">{a.detail}</p>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            <div className="dh-health-grid">
                <div className="dh-health-cell">
                    <span className="dh-health-num" style={{ color: "#18965d" }}>{health.validated}</span>
                    <span className="dh-health-cell-label">VALIDATED</span>
                </div>
                <div className="dh-health-cell">
                    <span className="dh-health-num" style={{ color: "#e53e3e" }}>{health.flagged}</span>
                    <span className="dh-health-cell-label">FLAGGED</span>
                </div>
                <div className="dh-health-cell">
                    <span className="dh-health-num" style={{ color: "#dd6b20" }}>{health.rejected}</span>
                    <span className="dh-health-cell-label">REJECTED</span>
                </div>
                <div className="dh-health-cell">
                    <span className="dh-health-num" style={{ color: "#8d94a8" }}>{health.pending}</span>
                    <span className="dh-health-cell-label">PENDING</span>
                </div>
            </div>

            {health.avg_text_length > 0 && (
                <div className="dh-health-meta">
                    <span>AVG TEXT LENGTH</span>
                    <span className="dh-health-meta-val">{health.avg_text_length} tokens</span>
                </div>
            )}
        </div>
    );
}

// ─── Label badge ──────────────────────────────────────────────────────────────
const LABEL_COLORS = {
    ORG:      { bg: "#fff3f3", color: "#c53030" },
    LOC:      { bg: "#ebf8ff", color: "#2b6cb0" },
    PERSON:   { bg: "#f0fff4", color: "#276749" },
    MISC:     { bg: "#faf5ff", color: "#6b46c1" },
    Finance:  { bg: "#fffff0", color: "#975a16" },
    Positive: { bg: "#f0fff4", color: "#276749" },
    Negative: { bg: "#fff5f5", color: "#c53030" },
    Neutral:  { bg: "#f7fafc", color: "#4a5568" },
};

function LabelBadge({ label }) {
    if (!label) return <span className="dh-no-label">—</span>;
    const style = LABEL_COLORS[label] || { bg: "#eef3ff", color: "#1359db" };
    return (
        <span className="dh-label-badge" style={{ background: style.bg, color: style.color }}>
            {label.toUpperCase()}
        </span>
    );
}

// ─── Status badge ─────────────────────────────────────────────────────────────
function StatusBadge({ status }) {
    const map = {
        validated: { label: "VALIDATED", color: "#18965d", bg: "#e5fbf0" },
        flagged:   { label: "FLAGGED",   color: "#dd6b20", bg: "#fef3e8" },
        rejected:  { label: "REJECTED",  color: "#c53030", bg: "#fff5f5" },
        pending:   { label: "PENDING",   color: "#8d94a8", bg: "#f7f8fc" },
    };
    const s = map[status] || map.pending;
    return (
        <span className="dh-status-badge" style={{ background: s.bg, color: s.color }}>
            {s.label}
        </span>
    );
}

// ─── Agreement score ──────────────────────────────────────────────────────────
function AgreementScore({ value }) {
    if (value === null || value === undefined) return <span className="dh-agree-na">—</span>;
    const color = value >= 0.8 ? "#1d2333" : value >= 0.5 ? "#dd6b20" : "#e53e3e";
    return (
        <span className="dh-agree-score" style={{ color }}>
            {value.toFixed(2)}
            <span className="dh-agree-bar" style={{ background: color, width: `${value * 100}%` }} />
        </span>
    );
}

// ─── Action buttons for a row ─────────────────────────────────────────────────
function RowActions({ sample, onUpdate, isOrganizer }) {
    const [loading, setLoading] = useState(false);

    const setStatus = async (status) => {
        setLoading(true);
        await onUpdate(sample.id, status);
        setLoading(false);
    };

    if (!isOrganizer) {
        if (sample.status === "flagged") return <span className="dh-action-done">Flagged</span>;
        return (
            <button
                className="dh-action-flag"
                disabled={loading}
                onClick={() => setStatus("flagged")}
                title="Flag this sample"
            >
                ⚑ Flag
            </button>
        );
    }

    return (
        <div className="dh-action-group">
            {sample.status !== "validated" && (
                <button className="dh-action-validate" disabled={loading} onClick={() => setStatus("validated")} title="Validate">
                    ✓
                </button>
            )}
            {sample.status !== "flagged" && (
                <button className="dh-action-flagbtn" disabled={loading} onClick={() => setStatus("flagged")} title="Flag">
                    ⚑
                </button>
            )}
            {sample.status !== "rejected" && (
                <button className="dh-action-reject" disabled={loading} onClick={() => setStatus("rejected")} title="Reject">
                    ✕
                </button>
            )}
        </div>
    );
}

// ─── Raw Samples table ─────────────────────────────────────────────────────────
// FIX 3: statusFilter and search were never included in the URLSearchParams,
//         so filtering/search had no effect. Now correctly passed to the API.
function RawSamplesTable({ competitionId, isOrganizer, version }) {
    const [items, setItems]             = useState([]);
    const [total, setTotal]             = useState(0);
    const [page, setPage]               = useState(1);
    const [pages, setPages]             = useState(1);
    const [statusFilter, setStatus]     = useState("all");
    const [search, setSearch]           = useState("");
    const [searchInput, setSearchInput] = useState("");
    const [loading, setLoading]         = useState(false);
    const [activeView, setActiveView]   = useState("Table View");

    const load = useCallback(async () => {
        setLoading(true);
        try {
            // FIX 3: Include statusFilter and search in the request params
            const qp = new URLSearchParams({ page, page_size: 10 });
            if (statusFilter && statusFilter !== "all") qp.set("status", statusFilter);
            if (search) qp.set("search", search);
            if (version) qp.set("version", version);

            const res = await fetch(
                `${API}/competitions/${competitionId}/samples?${qp}`,
                { headers: authHeader() }
            );
            const data = await res.json();
            setItems(data.items || []);
            setTotal(data.total || 0);
            setPages(data.pages || 1);
        } catch {
            /* ignore */
        } finally {
            setLoading(false);
        }
    }, [competitionId, page, statusFilter, search, version]);

    useEffect(() => { load(); }, [load]);

    const handleStatusUpdate = async (sampleId, newStatus) => {
        try {
            await fetch(`${API}/data-samples/${sampleId}/status`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json", ...authHeader() },
                body: JSON.stringify({ status: newStatus }),
            });
            await load();
        } catch { /* ignore */ }
    };

    const STATUS_FILTERS = ["all", "pending", "validated", "flagged", "rejected"];

    return (
        <div className="dh-table-card">
            <div className="dh-table-header">
                <div className="dh-table-title-row">
                    <h2 className="dh-table-title">Raw Samples</h2>
                    <div className="dh-view-toggle">
                        {["Table View", "Visual Explorer"].map((v) => (
                            <button
                                key={v}
                                className={`dh-view-btn${activeView === v ? " active" : ""}`}
                                onClick={() => setActiveView(v)}
                            >{v}</button>
                        ))}
                    </div>
                </div>
                <div className="dh-table-controls">
                    <div className="dh-search-wrap">
                        <svg className="dh-search-icon" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
                        </svg>
                        <input
                            className="dh-search-input"
                            placeholder="Search UID or snippet…"
                            value={searchInput}
                            onChange={e => setSearchInput(e.target.value)}
                            onKeyDown={e => { if (e.key === "Enter") { setPage(1); setSearch(searchInput); } }}
                        />
                    </div>
                    <div className="dh-status-filters">
                        {STATUS_FILTERS.map(f => (
                            <button
                                key={f}
                                className={`dh-filter-btn${statusFilter === f ? " active" : ""}`}
                                onClick={() => { setStatus(f); setPage(1); }}
                            >
                                {f === "all" ? "All" : f.charAt(0).toUpperCase() + f.slice(1)}
                            </button>
                        ))}
                    </div>
                    <button className="dh-tune-btn" title="Filter options">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <line x1="4" y1="6" x2="20" y2="6"/>
                            <line x1="8" y1="12" x2="16" y2="12"/>
                            <line x1="11" y1="18" x2="13" y2="18"/>
                        </svg>
                    </button>
                </div>
            </div>

            {activeView === "Visual Explorer" ? (
                <VisualExplorer items={items} loading={loading} />
            ) : (
                <>
                    <table className="dh-table">
                        <thead>
                            <tr>
                                <th>UID</th>
                                <th>CONTENT SNIPPET</th>
                                <th>LABEL</th>
                                <th>ANNOTATOR</th>
                                <th>AGREEMENT</th>
                                <th>STATUS</th>
                                {isOrganizer && <th>ACTIONS</th>}
                            </tr>
                        </thead>
                        <tbody>
                            {loading ? (
                                <tr><td colSpan={isOrganizer ? 7 : 6} className="dh-table-loading">Loading…</td></tr>
                            ) : items.length === 0 ? (
                                <tr><td colSpan={isOrganizer ? 7 : 6} className="dh-table-empty">No samples found</td></tr>
                            ) : items.map((row) => (
                                <tr key={row.id} className={`dh-table-row status-${row.status}`}>
                                    <td className="dh-uid">{row.uid}</td>
                                    <td className="dh-snippet">
                                        <span className="dh-snippet-text">
                                            "{row.content_snippet || row.uid}"
                                        </span>
                                    </td>
                                    <td><LabelBadge label={row.label} /></td>
                                    <td>
                                        <div className="dh-annotator">
                                            <div className="dh-annotator-avatar">{row.annotator?.initials}</div>
                                            <span>{row.annotator?.name}</span>
                                        </div>
                                    </td>
                                    <td><AgreementScore value={row.agreement} /></td>
                                    <td><StatusBadge status={row.status} /></td>
                                    {isOrganizer && (
                                        <td>
                                            <RowActions
                                                sample={row}
                                                onUpdate={handleStatusUpdate}
                                                isOrganizer={isOrganizer}
                                            />
                                        </td>
                                    )}
                                </tr>
                            ))}
                        </tbody>
                    </table>

                    <div className="dh-pagination">
                        <span className="dh-page-info">
                            Showing {items.length} of {total.toLocaleString()} samples
                        </span>
                        <div className="dh-page-btns">
                            <button
                                className="dh-page-btn"
                                disabled={page <= 1}
                                onClick={() => setPage(p => p - 1)}
                            >Previous</button>
                            <button
                                className="dh-page-btn primary"
                                disabled={page >= pages}
                                onClick={() => setPage(p => p + 1)}
                            >Next</button>
                        </div>
                    </div>
                </>
            )}
        </div>
    );
}

// ─── Visual Explorer (card grid view) ─────────────────────────────────────────
function VisualExplorer({ items, loading }) {
    if (loading) return <div className="dh-visual-loading">Loading…</div>;
    if (!items.length) return <div className="dh-visual-empty">No samples</div>;

    return (
        <div className="dh-visual-grid">
            {items.map(row => (
                <div key={row.id} className={`dh-visual-card status-${row.status}`}>
                    <div className="dh-visual-uid">{row.uid}</div>
                    <p className="dh-visual-snippet">"{row.content_snippet}"</p>
                    <div className="dh-visual-footer">
                        <LabelBadge label={row.label} />
                        <StatusBadge status={row.status} />
                    </div>
                    <div className="dh-visual-annotator">
                        <div className="dh-annotator-avatar sm">{row.annotator?.initials}</div>
                        <span>{row.annotator?.name}</span>
                        {row.agreement !== null && row.agreement !== undefined && (
                            <span className="dh-visual-agree">{row.agreement.toFixed(2)}</span>
                        )}
                    </div>
                </div>
            ))}
        </div>
    );
}

// ─── Embedding Visualizer teaser ──────────────────────────────────────────────
function EmbeddingVisualizer() {
    return (
        <div className="dh-embed-card">
            <div className="dh-embed-bg" aria-hidden="true">
                {Array.from({ length: 28 }).map((_, i) => (
                    <div
                        key={i}
                        className="dh-embed-dot"
                        style={{
                            left:    `${10 + Math.sin(i * 2.5) * 35 + (i * 7 % 20)}%`,
                            top:     `${15 + Math.cos(i * 1.8) * 30 + (i * 11 % 25)}%`,
                            opacity: 0.15 + (i % 5) * 0.08,
                            width:   `${3 + (i % 4)}px`,
                            height:  `${3 + (i % 4)}px`,
                        }}
                    />
                ))}
            </div>
            <div className="dh-embed-content">
                <span className="dh-embed-label">EMBEDDING VISUALIZER</span>
                <p className="dh-embed-desc">View high-dimensional clusters in 3D projection.</p>
            </div>
        </div>
    );
}

// ─── Main DatasetHub page ──────────────────────────────────────────────────────
export default function DatasetHub() {
    // FIX 4: Renamed local variable from `params` to `routeParams` to avoid
    //        shadowing the `params` name used inside handleDownload's
    //        URLSearchParams construction.
    const routeParams   = useParams();
    const competitionId = routeParams.id ?? routeParams.competitionId;

    const [activeVersion,    setActiveVersion]    = useState(null);
    const [competition,      setCompetition]      = useState(null);
    const [health,           setHealth]           = useState(null);
    const [versions,         setVersions]         = useState([]);
    const [versionsLoading,  setVersionsLoading]  = useState(true);
    const [isOrganizer,      setIsOrganizer]      = useState(false);
    const [downloadFormat,   setDownloadFormat]   = useState("csv");
    const [downloading,      setDownloading]      = useState(false);

    const loadVersions = useCallback(() => {
        setVersionsLoading(true);
        fetch(`${API}/competitions/${competitionId}/versions`, { headers: authHeader() })
            .then(r => r.json())
            .then(d => setVersions(Array.isArray(d) ? d : []))
            .catch(() => setVersions([]))
            .finally(() => setVersionsLoading(false));
    }, [competitionId]);

    useEffect(() => {
        if (!competitionId) return;

        fetch(`${API}/competitions/${competitionId}`, { headers: authHeader() })
            .then(r => r.json()).then(setCompetition).catch(() => {});

        fetch(`${API}/competitions/${competitionId}/monitoring`, { headers: authHeader() })
            .then(r => r.json())
            .then(d => setIsOrganizer(d.is_organizer || false))
            .catch(() => {});

        fetch(`${API}/competitions/${competitionId}/data-health`, { headers: authHeader() })
            .then(r => r.json()).then(setHealth).catch(() => {});

        loadVersions();
    }, [competitionId, loadVersions]);

    const handleCreateVersion = async (body) => {
        try {
            await fetch(`${API}/competitions/${competitionId}/versions`, {
                method: "POST",
                headers: { "Content-Type": "application/json", ...authHeader() },
                body: JSON.stringify(body),
            });
            loadVersions();
        } catch { /* ignore */ }
    };

    // FIX 4: Renamed URLSearchParams variable from `params` to `dlParams`
    //        to avoid any name collision with routeParams / useParams.
    const handleDownload = async () => {
        setDownloading(true);
        try {
            const dlParams = new URLSearchParams({
                page: 1,
                page_size: 1000,
                status: "validated",
                ...(activeVersion ? { version: activeVersion } : {}),
            });
            const res  = await fetch(
                `${API}/competitions/${competitionId}/samples?${dlParams}`,
                { headers: authHeader() }
            );
            const data  = await res.json();
            const items = data.items || [];

            if (items.length === 0) {
                alert("No validated samples to download yet.");
                return;
            }

            let content  = "";
            let filename = "";
            let mimeType = "";

            if (downloadFormat === "csv") {
                const header = "uid,content_snippet,label,annotator,agreement,status";
                const rows   = items.map(r =>
                    `"${r.uid}","${(r.content_snippet || "").replace(/"/g, '""')}","${r.label || ""}","${r.annotator?.name}","${r.agreement ?? ""}","${r.status}"`
                );
                content  = [header, ...rows].join("\n");
                filename = `dataset-${competitionId}.csv`;
                mimeType = "text/csv";

            } else if (downloadFormat === "json") {
                content  = JSON.stringify(items, null, 2);
                filename = `dataset-${competitionId}.json`;
                mimeType = "application/json";

            } else if (downloadFormat === "conll") {
                content = items.map(r => {
                    const tokens = (r.content_snippet || "").split(/\s+/);
                    const label  = r.label || "O";
                    return tokens.map((tok, i) =>
                        `${tok}\t${i === 0 ? "B-" : "I-"}${label}`
                    ).join("\n");
                }).join("\n\n");
                filename = `dataset-${competitionId}.conll`;
                mimeType = "text/plain";
            }

            const blob = new Blob([content], { type: mimeType });
            const url  = URL.createObjectURL(blob);
            const a    = document.createElement("a");
            a.href     = url;
            a.download = filename;
            a.click();
            URL.revokeObjectURL(url);

        } catch (err) {
            console.error(err);
            alert("Download failed — please try again.");
        } finally {
            setDownloading(false);
        }
    };

    const total     = health?.total           || 0;
    const avgLen    = health?.avg_text_length  || 0;
    const vocabSize = health ? Math.round(total * 10.2 / 1000 * 10) / 10 + "k" : "—";

    return (
        <div className="dh-shell">
            <CompetitionSidebar
                competitionId={competitionId}
                competitionTitle={competition?.title}
                taskType={competition?.task_type}
            />

            {/* FIX 2: VersionControl was rendered TWICE — once here outside
                dh-main (without onSelectVersion), and again inside dh-left-col.
                Removed the duplicate outside dh-main; it now only lives inside
                dh-left-col where it belongs. */}

            <div className="dh-main">
                <CompetitionTopbar competition={competition} />

                <div className="dh-body">

                    {/* ── Dataset header ─────────────────────────────────── */}
                    <div className="dh-page-header">
                        <div className="dh-page-header-left">
                            <div className="dh-breadcrumb">
                                <span className="dh-crumb-tag">RESEARCH CORE</span>
                                <span className="dh-crumb-time">
                                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                        <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
                                    </svg>
                                    Last indexed 2 hours ago
                                </span>
                            </div>
                            <h1 className="dh-page-title">
                                {competition?.title || "Dataset Hub"}
                            </h1>
                            <p className="dh-page-desc">{competition?.description || ""}</p>
                        </div>
                        <div className="dh-page-header-right">
                            <div className="dh-download-group">
                                <select
                                    className="dh-format-select"
                                    value={downloadFormat}
                                    onChange={e => setDownloadFormat(e.target.value)}
                                >
                                    <option value="csv">CSV</option>
                                    <option value="json">JSON</option>
                                    <option value="conll">CoNLL</option>
                                </select>
                                <button className="dh-download-btn" onClick={handleDownload} disabled={downloading}>
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                                        <polyline points="7 10 12 15 17 10"/>
                                        <line x1="12" y1="15" x2="12" y2="3"/>
                                    </svg>
                                    {downloading ? "Downloading…" : "Download"}
                                </button>
                            </div>
                            <button className="dh-mount-btn">
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <rect x="2" y="3" width="20" height="14" rx="2" ry="2"/>
                                    <line x1="8" y1="21" x2="16" y2="21"/>
                                    <line x1="12" y1="17" x2="12" y2="21"/>
                                </svg>
                                Mount in Workspace
                            </button>
                        </div>
                    </div>

                    {/* ── Stats row + Health panel ───────────────────────── */}
                    <div className="dh-stats-health-row">
                        <div className="dh-stats-row">
                            <StatCard
                                label="TOTAL SAMPLES"
                                value={total.toLocaleString()}
                                sub={total > 0 ? "+12%" : undefined}
                                accent="#1359db"
                            />
                            <StatCard
                                label="AVG TEXT LENGTH"
                                value={avgLen || "—"}
                                sub={avgLen ? "tokens" : undefined}
                            />
                            <StatCard
                                label="VOCAB SIZE"
                                value={total > 0 ? vocabSize : "—"}
                            />
                            <StatCard
                                label="LABEL DIST."
                                value={Object.keys(health?.label_distribution || {}).length || "—"}
                                sub="categories"
                            />
                        </div>
                        <DataHealthPanel health={health} />
                    </div>

                    {/* ── Main two-column area ───────────────────────────── */}
                    <div className="dh-content-area">
                        {/* Left: version control + embedding visualizer */}
                        <div className="dh-left-col">
                            <VersionControl
                                versions={versions}
                                loading={versionsLoading}
                                onCreateVersion={handleCreateVersion}
                                isOrganizer={isOrganizer}
                                onSelectVersion={setActiveVersion}
                            />
                            <EmbeddingVisualizer />
                        </div>

                        {/* Right: raw samples table */}
                        <div className="dh-right-col">
                            <RawSamplesTable
                                competitionId={competitionId}
                                isOrganizer={isOrganizer}
                                version={activeVersion}
                            />
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
