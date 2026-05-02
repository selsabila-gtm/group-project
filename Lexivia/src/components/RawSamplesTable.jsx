/**
 * RawSamplesTable.jsx  — drop-in replacement for the inline component
 * in DatasetHub.jsx
 *
 * Fixes vs original:
 *  - Default status filter is "all" (was "Validated" → showed nothing)
 *  - Revalidate button for organizers (calls POST /revalidate)
 *  - Cleaner table layout with proper column widths
 *  - Score rendered as colored pill, not raw float
 *  - Status pill styled inline (no external CSS dependency)
 *  - Action buttons clearly labeled, not just symbols
 */

import { useState, useCallback, useEffect } from "react";

const API = "http://127.0.0.1:8000";
function authHeader() {
    const token = localStorage.getItem("token");
    return token ? { Authorization: `Bearer ${token}` } : {};
}

// ── Status pill ──────────────────────────────────────────────────────────────
function StatusPill({ status }) {
    const styles = {
        validated: { background: "rgba(34,197,94,.13)",  color: "#16a34a" },
        flagged:   { background: "rgba(249,115,22,.13)", color: "#ea580c" },
        rejected:  { background: "rgba(239,68,68,.13)",  color: "#dc2626" },
        pending:   { background: "rgba(245,158,11,.13)", color: "#d97706" },
    };
    const s = styles[status] || styles.pending;
    return (
        <span style={{
            ...s,
            fontSize: 11, fontWeight: 600, padding: "3px 10px",
            borderRadius: 99, whiteSpace: "nowrap", letterSpacing: ".02em",
        }}>
            {status.charAt(0).toUpperCase() + status.slice(1)}
        </span>
    );
}

// ── Quality score pill ───────────────────────────────────────────────────────
function ScorePill({ score }) {
    if (score == null) return <span style={{ color: "#9ca3af", fontSize: 12 }}>—</span>;
    const pct = Math.round(score * 100);
    const color = pct >= 60 ? "#16a34a" : pct >= 35 ? "#d97706" : "#dc2626";
    return (
        <span style={{ fontSize: 12, fontWeight: 600, color, fontVariantNumeric: "tabular-nums" }}>
            {pct}%
        </span>
    );
}

// ── Main component ───────────────────────────────────────────────────────────
export default function RawSamplesTable({ competitionId, isOrganizer, version }) {
    const [samples,     setSamples]     = useState([]);
    const [total,       setTotal]       = useState(0);
    const [page,        setPage]        = useState(1);
    const [pageCount,   setPageCount]   = useState(1);
    const [status,      setStatus]      = useState("all");   // ← FIX: was "validated"
    const [search,      setSearch]      = useState("");
    const [loading,     setLoading]     = useState(false);
    const [updating,    setUpdating]    = useState(null);
    const [revalidating,setRevalidating]= useState(false);
    const [revalMsg,    setRevalMsg]    = useState(null);

    const load = useCallback(() => {
        setLoading(true);
        const params = new URLSearchParams({ page, page_size: 20 });
        if (status !== "all") params.set("status", status);
        if (search)           params.set("search", search);
        if (version)          params.set("version", version);

        fetch(
            `${API}/competitions/${competitionId}/samples?${params}`,
            { headers: authHeader() }
        )
            .then(r => r.json())
            .then(d => {
                setSamples(d.items || []);
                setTotal(d.total || 0);
                setPageCount(d.pages || 1);
            })
            .catch(console.error)
            .finally(() => setLoading(false));
    }, [competitionId, page, status, search, version]);

    useEffect(() => { load(); }, [load]);

    const updateStatus = async (sampleId, newStatus) => {
        setUpdating(sampleId);
        try {
            await fetch(`${API}/data-samples/${sampleId}/status`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json", ...authHeader() },
                body: JSON.stringify({ status: newStatus }),
            });
            load();
        } catch (e) { console.error(e); }
        finally { setUpdating(null); }
    };

    const triggerRevalidate = async () => {
        setRevalidating(true);
        setRevalMsg(null);
        try {
            const res = await fetch(
                `${API}/competitions/${competitionId}/revalidate`,
                { method: "POST", headers: authHeader() }
            );
            const d = await res.json();
            setRevalMsg(`✓ ${d.message}`);
            // Poll until pending count drops — simple: reload after 3s
            setTimeout(() => { load(); setRevalMsg(null); }, 3000);
        } catch {
            setRevalMsg("⚠ Revalidation request failed");
        } finally {
            setRevalidating(false);
        }
    };

    const cols = isOrganizer ? 7 : 6;

    return (
        <div style={{
            background: "var(--color-background-primary, #fff)",
            border: "0.5px solid var(--color-border-tertiary)",
            borderRadius: 12,
            overflow: "hidden",
            display: "flex",
            flexDirection: "column",
        }}>
            {/* ── Toolbar ──────────────────────────────────────────────── */}
            <div style={{
                display: "flex", alignItems: "center", justifyContent: "space-between",
                flexWrap: "wrap", gap: 10,
                padding: "14px 18px", borderBottom: "0.5px solid var(--color-border-tertiary)",
            }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ fontSize: 11, fontWeight: 600, letterSpacing: ".08em",
                                   color: "var(--color-text-secondary)", textTransform: "uppercase" }}>
                        Raw Samples
                    </span>
                    <span style={{
                        fontSize: 11, fontWeight: 600, padding: "1px 8px",
                        background: "var(--color-background-secondary)",
                        border: "0.5px solid var(--color-border-tertiary)",
                        borderRadius: 99, color: "var(--color-text-secondary)",
                    }}>
                        {total.toLocaleString()}
                    </span>
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                    <input
                        style={{
                            fontSize: 13, padding: "5px 10px", borderRadius: 7,
                            border: "0.5px solid var(--color-border-tertiary)",
                            background: "var(--color-background-secondary)",
                            color: "var(--color-text-primary)", width: 180,
                            outline: "none",
                        }}
                        placeholder="Search text…"
                        value={search}
                        onChange={e => { setSearch(e.target.value); setPage(1); }}
                    />
                    <select
                        style={{
                            fontSize: 13, padding: "5px 10px", borderRadius: 7,
                            border: "0.5px solid var(--color-border-tertiary)",
                            background: "var(--color-background-secondary)",
                            color: "var(--color-text-primary)", cursor: "pointer",
                        }}
                        value={status}
                        onChange={e => { setStatus(e.target.value); setPage(1); }}
                    >
                        {["all","validated","flagged","rejected","pending"].map(s => (
                            <option key={s} value={s}>
                                {s === "all" ? "All statuses" : s.charAt(0).toUpperCase() + s.slice(1)}
                            </option>
                        ))}
                    </select>

                    {/* Revalidate button — organizers only */}
                    {isOrganizer && (
                        <button
                            onClick={triggerRevalidate}
                            disabled={revalidating}
                            style={{
                                fontSize: 12, padding: "5px 12px", borderRadius: 7,
                                border: "0.5px solid var(--color-border-tertiary)",
                                background: revalidating ? "var(--color-background-secondary)" : "var(--color-background-info, #e6f1fb)",
                                color: revalidating ? "var(--color-text-secondary)" : "var(--color-text-info, #185fa5)",
                                cursor: revalidating ? "not-allowed" : "pointer",
                                fontWeight: 600, whiteSpace: "nowrap",
                            }}
                        >
                            {revalidating ? "Running…" : "⟳ Re-validate Pending"}
                        </button>
                    )}
                </div>
            </div>

            {/* Revalidation message */}
            {revalMsg && (
                <div style={{
                    padding: "8px 18px", fontSize: 12,
                    background: "var(--color-background-success, #eaf3de)",
                    color: "var(--color-text-success, #3b6d11)",
                    borderBottom: "0.5px solid var(--color-border-tertiary)",
                }}>
                    {revalMsg}
                </div>
            )}

            {/* ── Table ────────────────────────────────────────────────── */}
            <div style={{ overflowX: "auto" }}>
                <table style={{
                    width: "100%", borderCollapse: "collapse",
                    fontSize: 13, tableLayout: "fixed",
                }}>
                    <colgroup>
                        <col style={{ width: 90 }} />
                        <col style={{ width: "auto" }} />
                        <col style={{ width: 110 }} />
                        <col style={{ width: 140 }} />
                        <col style={{ width: 70 }} />
                        <col style={{ width: 100 }} />
                        {isOrganizer && <col style={{ width: 120 }} />}
                    </colgroup>
                    <thead>
                        <tr style={{ borderBottom: "0.5px solid var(--color-border-tertiary)" }}>
                            {["ID","Content","Label","Annotator","Score","Status",
                              ...(isOrganizer ? ["Actions"] : [])].map(h => (
                                <th key={h} style={{
                                    padding: "10px 14px", textAlign: "left",
                                    fontSize: 10, fontWeight: 600, letterSpacing: ".07em",
                                    color: "var(--color-text-secondary)", textTransform: "uppercase",
                                    whiteSpace: "nowrap",
                                }}>{h}</th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {loading ? (
                            <tr><td colSpan={cols} style={{ padding: "32px 0", textAlign: "center",
                                color: "var(--color-text-secondary)", fontSize: 13 }}>
                                Loading…
                            </td></tr>
                        ) : samples.length === 0 ? (
                            <tr><td colSpan={cols} style={{ padding: "40px 0", textAlign: "center",
                                color: "var(--color-text-secondary)", fontSize: 13 }}>
                                No samples found.
                                {status !== "all" && (
                                    <span> &nbsp;<button
                                        onClick={() => setStatus("all")}
                                        style={{ fontSize: 12, color: "var(--color-text-info, #185fa5)",
                                                 background: "none", border: "none", cursor: "pointer",
                                                 textDecoration: "underline" }}>
                                        Clear filter
                                    </button></span>
                                )}
                            </td></tr>
                        ) : samples.map((s, i) => (
                            <tr key={s.id} style={{
                                borderBottom: "0.5px solid var(--color-border-tertiary)",
                                background: i % 2 === 0
                                    ? "transparent"
                                    : "var(--color-background-secondary)",
                            }}>
                                <td style={{ padding: "10px 14px", fontFamily: "var(--font-mono)",
                                             fontSize: 11, color: "var(--color-text-secondary)",
                                             whiteSpace: "nowrap", overflow: "hidden",
                                             textOverflow: "ellipsis" }}>
                                    {s.uid}
                                </td>
                                <td style={{ padding: "10px 14px", overflow: "hidden",
                                             textOverflow: "ellipsis", whiteSpace: "nowrap",
                                             color: "var(--color-text-primary)" }}
                                    title={s.content_snippet}>
                                    {s.content_snippet || <span style={{ color: "var(--color-text-secondary)" }}>—</span>}
                                </td>
                                <td style={{ padding: "10px 14px", overflow: "hidden",
                                             textOverflow: "ellipsis", whiteSpace: "nowrap",
                                             color: "var(--color-text-primary)" }}>
                                    {s.label || <span style={{ color: "var(--color-text-secondary)" }}>—</span>}
                                </td>
                                <td style={{ padding: "10px 14px" }}>
                                    <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                                        <div style={{
                                            width: 26, height: 26, borderRadius: "50%", flexShrink: 0,
                                            background: "var(--color-background-info, #e6f1fb)",
                                            color: "var(--color-text-info, #185fa5)",
                                            display: "flex", alignItems: "center", justifyContent: "center",
                                            fontSize: 10, fontWeight: 600,
                                        }}>
                                            {s.annotator.initials}
                                        </div>
                                        <span style={{ fontSize: 12, color: "var(--color-text-primary)",
                                                       overflow: "hidden", textOverflow: "ellipsis",
                                                       whiteSpace: "nowrap" }}>
                                            {s.annotator.name}
                                        </span>
                                    </div>
                                </td>
                                <td style={{ padding: "10px 14px" }}>
                                    <ScorePill score={s.agreement} />
                                </td>
                                <td style={{ padding: "10px 14px" }}>
                                    <StatusPill status={s.status} />
                                </td>
                                {isOrganizer && (
                                    <td style={{ padding: "10px 14px" }}>
                                        {updating === s.id ? (
                                            <span style={{ fontSize: 12, color: "var(--color-text-secondary)" }}>…</span>
                                        ) : (
                                            <div style={{ display: "flex", gap: 5 }}>
                                                {s.status !== "validated" && (
                                                    <button onClick={() => updateStatus(s.id, "validated")}
                                                        style={{
                                                            fontSize: 10, padding: "3px 8px", borderRadius: 5,
                                                            border: "0.5px solid #16a34a", color: "#16a34a",
                                                            background: "rgba(34,197,94,.08)", cursor: "pointer",
                                                            fontWeight: 600,
                                                        }}>✓ OK</button>
                                                )}
                                                {s.status !== "flagged" && (
                                                    <button onClick={() => updateStatus(s.id, "flagged")}
                                                        style={{
                                                            fontSize: 10, padding: "3px 8px", borderRadius: 5,
                                                            border: "0.5px solid #ea580c", color: "#ea580c",
                                                            background: "rgba(249,115,22,.08)", cursor: "pointer",
                                                            fontWeight: 600,
                                                        }}>△ Flag</button>
                                                )}
                                                {s.status !== "rejected" && (
                                                    <button onClick={() => updateStatus(s.id, "rejected")}
                                                        style={{
                                                            fontSize: 10, padding: "3px 8px", borderRadius: 5,
                                                            border: "0.5px solid #dc2626", color: "#dc2626",
                                                            background: "rgba(239,68,68,.08)", cursor: "pointer",
                                                            fontWeight: 600,
                                                        }}>⊘ Reject</button>
                                                )}
                                            </div>
                                        )}
                                    </td>
                                )}
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* ── Pagination ───────────────────────────────────────────── */}
            <div style={{
                display: "flex", alignItems: "center", justifyContent: "space-between",
                padding: "12px 18px", borderTop: "0.5px solid var(--color-border-tertiary)",
            }}>
                <button
                    disabled={page <= 1}
                    onClick={() => setPage(p => p - 1)}
                    style={{
                        fontSize: 13, padding: "5px 14px", borderRadius: 7,
                        border: "0.5px solid var(--color-border-tertiary)",
                        background: "var(--color-background-secondary)",
                        color: page <= 1 ? "var(--color-text-secondary)" : "var(--color-text-primary)",
                        cursor: page <= 1 ? "not-allowed" : "pointer",
                    }}
                >← Prev</button>

                <span style={{ fontSize: 12, color: "var(--color-text-secondary)" }}>
                    Page {page} / {pageCount}
                </span>

                <button
                    disabled={page >= pageCount}
                    onClick={() => setPage(p => p + 1)}
                    style={{
                        fontSize: 13, padding: "5px 14px", borderRadius: 7,
                        border: "0.5px solid var(--color-border-tertiary)",
                        background: "var(--color-background-secondary)",
                        color: page >= pageCount ? "var(--color-text-secondary)" : "var(--color-text-primary)",
                        cursor: page >= pageCount ? "not-allowed" : "pointer",
                    }}
                >Next →</button>
            </div>
        </div>
    );
}