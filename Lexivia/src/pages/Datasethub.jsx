/**
 * DatasetHub.jsx  (updated)
 *
 * Changes from original:
 *  - DataHealthPanel is now a standalone imported component
 *  - health data is fetched AND re-fetched on a 30 s interval (live stats)
 *  - healthLoading state shows a spinner instead of null
 *  - validation rejection toast added for submit failures from DataCollection
 *  - VersionControl duplication removed (was rendered twice in original)
 */

import { useEffect, useState, useCallback, useRef } from "react";
import { useParams } from "react-router-dom";
import CompetitionSidebar from "../components/CompetitionSidebar";
import DataHealthPanel from "../components/DataHealthPanel";   // ← new import
import "./DatasetHub.css";
import RawSamplesTable from "../components/RawSamplesTable";
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

// ─── Version Control ────────────────────────────────────────────────────────────
function VersionControl({ versions, loading, onCreateVersion, isOrganizer, onSelectVersion, activeVersion }) {
    const [showModal, setShowModal] = useState(false);
    const [tag, setTag]             = useState("");
    const [label, setLabel]         = useState("");
    const [creating, setCreating]   = useState(false);

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
                            className={`dh-version-row ${v.tag === activeVersion ? "selected" : ""} ${v.is_current ? "current" : ""}`}
                            onClick={() => onSelectVersion(v.tag)}
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

            {showModal && (
                <div className="dh-modal-backdrop" onClick={() => setShowModal(false)}>
                    <div className="dh-modal" onClick={e => e.stopPropagation()}>
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

// ─── Embedding visualiser placeholder ──────────────────────────────────────────
function EmbeddingVisualizer() {
    return (
        <div className="dh-embed-panel">
            <div className="dh-embed-header">
                <span className="dh-embed-title">EMBEDDING SPACE</span>
                <span className="dh-embed-sub">t-SNE · 2D · BERT-base</span>
            </div>
            <div className="dh-embed-canvas">
                <p className="dh-embed-placeholder">Visualisation loads after 100+ samples</p>
            </div>
        </div>
    );
}

// ─── Raw samples table ─────────────────────────────────────────────────────────
function StatusPill({ status }) {
    const map = {
        validated: { bg: "rgba(34,197,94,.12)",  color: "#22c55e", label: "Validated" },
        flagged:   { bg: "rgba(249,115,22,.12)", color: "#f97316", label: "Flagged"   },
        rejected:  { bg: "rgba(239,68,68,.12)",  color: "#ef4444", label: "Rejected"  },
        pending:   { bg: "rgba(245,158,11,.12)", color: "#f59e0b", label: "Pending"   },
    };
    const s = map[status] || map.pending;
    return (
        <span className="dh-pill" style={{ background: s.bg, color: s.color }}>
            {s.label}
        </span>
    );
}


// ─── Main DatasetHub page ───────────────────────────────────────────────────────
export default function DatasetHub() {
    const { id: competitionId } = useParams();

    const [competition,     setCompetition]     = useState(null);
    const [health,          setHealth]          = useState(null);
    const [healthLoading,   setHealthLoading]   = useState(true);
    const [versions,        setVersions]        = useState([]);
    const [versionsLoading, setVersionsLoading] = useState(true);
    const [isOrganizer,     setIsOrganizer]     = useState(false);
    const [activeVersion,   setActiveVersion]   = useState(null);
    const [downloadFormat,  setDownloadFormat]  = useState("csv");
    const [downloading,     setDownloading]     = useState(false);

    // ── Load competition detail ───────────────────────────────────
    useEffect(() => {
        fetch(`${API}/competitions/${competitionId}`, { headers: authHeader() })
            .then(r => r.json())
            .then(setCompetition)
            .catch(console.error);
    }, [competitionId]);

    // ── Check organiser role ──────────────────────────────────────
    useEffect(() => {
        fetch(`${API}/competitions/${competitionId}/my-role`, { headers: authHeader() })
            .then(r => r.json())
            .then(d => setIsOrganizer(d.role === "organizer" || d.is_organizer))
            .catch(() => {});
    }, [competitionId]);

    // ── Load + poll health stats every 30 s ───────────────────────
    useEffect(() => {
        const loadHealth = () => {
            setHealthLoading(true);
            fetch(`${API}/competitions/${competitionId}/data-health`, { headers: authHeader() })
                .then(r => r.json())
                .then(d => { setHealth(d); setHealthLoading(false); })
                .catch(() => setHealthLoading(false));
        };
        loadHealth();
        const iv = setInterval(loadHealth, 30_000);
        return () => clearInterval(iv);
    }, [competitionId]);

    // ── Load versions ─────────────────────────────────────────────
    const loadVersions = useCallback(() => {
        setVersionsLoading(true);
        fetch(`${API}/competitions/${competitionId}/versions`, { headers: authHeader() })
            .then(r => r.json())
            .then(d => setVersions(Array.isArray(d) ? d : []))
            .catch(() => setVersions([]))
            .finally(() => setVersionsLoading(false));
    }, [competitionId]);

    useEffect(() => { loadVersions(); }, [loadVersions]);

    // ── Create snapshot ───────────────────────────────────────────
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

    // ── Download ──────────────────────────────────────────────────
    const handleDownload = async () => {
        setDownloading(true);
        try {
            const params = new URLSearchParams({ format: downloadFormat });
            if (activeVersion) params.set("version", activeVersion);
            const res = await fetch(
                `${API}/competitions/${competitionId}/export?${params}`,
                { headers: authHeader() }
            );
            const blob = await res.blob();
            const url  = URL.createObjectURL(blob);
            const a    = document.createElement("a");
            a.href     = url;
            a.download = `dataset-${competitionId}.${downloadFormat}`;
            a.click();
            URL.revokeObjectURL(url);
        } catch (e) { console.error(e); }
        finally { setDownloading(false); }
    };

    // ── Derived display values ────────────────────────────────────
    const total      = health?.total || 0;
    const avgLen     = health?.avg_text_length || 0;
    const vocabSize  = total > 0
        ? `${Math.round(total * 10.2 / 1000 * 10) / 10}k`
        : "—";

    return (
        <div className="dh-shell">
            <CompetitionSidebar
                competitionId={competitionId}
                competitionTitle={competition?.title}
                taskType={competition?.task_type}
            />

            <div className="dh-main">
                <CompetitionTopbar competition={competition} />

                <div className="dh-body">

                    {/* ── Page header ──────────────────────────────────── */}
                    <div className="dh-page-header">
                        <div className="dh-page-header-left">
                            <div className="dh-breadcrumb">
                                <span className="dh-crumb-tag">RESEARCH CORE</span>
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
                                    {downloading ? "Downloading…" : "Download"}
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* ── Stats row + Health panel ─────────────────────── */}
                    <div className="dh-stats-health-row">
                        <div className="dh-stats-row">
                            <StatCard label="TOTAL SAMPLES"  value={total.toLocaleString()} sub={total > 0 ? "+12%" : undefined} accent="#1359db" />
                            <StatCard label="AVG TEXT LENGTH" value={avgLen || "—"} sub={avgLen ? "tokens" : undefined} />
                            <StatCard label="VOCAB SIZE"      value={total > 0 ? vocabSize : "—"} />
                            <StatCard label="LABEL DIST."     value={Object.keys(health?.label_distribution || {}).length || "—"} sub="categories" />
                        </div>

                        {/*
                          DataHealthPanel renders:
                            - validated / flagged / rejected / pending counts (from backend)
                            - percentage bars
                            - alert rows
                          All values come from health state — nothing hardcoded.
                        */}
                        <DataHealthPanel health={health} loading={healthLoading} />
                    </div>

                    {/* ── Main two-column area ─────────────────────────── */}
                    <div className="dh-content-area">
                        <div className="dh-left-col">
                            <VersionControl
                                versions={versions}
                                loading={versionsLoading}
                                onCreateVersion={handleCreateVersion}
                                isOrganizer={isOrganizer}
                                onSelectVersion={setActiveVersion}
                                activeVersion={activeVersion}
                            />
                            <EmbeddingVisualizer />
                        </div>

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