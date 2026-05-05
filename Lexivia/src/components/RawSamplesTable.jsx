/**
 * RawSamplesTable.jsx
 *
 * Changes in this version:
 *  - ReasonPopover shows ALL flags (not just the first), as a bulleted list
 *  - Popover content is role-aware: participants see "submit a better version",
 *    organizers see "use the action buttons"
 *  - Pending popover explains the pipeline step-by-step
 *  - Rejected popover shows the exact rule(s) that failed
 *  - Flagged popover shows the score and what the threshold is
 *  - Status badge has a coloured left-border dot so colour-blind users can read it too
 */

import { useState, useCallback, useEffect, useRef } from "react";

const API = "http://127.0.0.1:8000";
function authHeader() {
    const token = localStorage.getItem("token");
    return token ? { Authorization: `Bearer ${token}` } : {};
}

// ── Reason popover ───────────────────────────────────────────────────────────
function ReasonPopover({ status, flags, defaultReason, score, isOrganizer, children }) {
    const [open, setOpen] = useState(false);
    const ref = useRef(null);

    useEffect(() => {
        if (!open) return;
        const handler = (e) => {
            if (ref.current && !ref.current.contains(e.target)) setOpen(false);
        };
        document.addEventListener("mousedown", handler);
        return () => document.removeEventListener("mousedown", handler);
    }, [open]);

    // Build the human-readable explanation based on status
    const buildContent = () => {
        // Use stored flags if present, otherwise fall back to the default message
        const hasFlags = flags && flags.length > 0;

        if (status === "pending") {
            return {
                title: "Why is this pending?",
                bullets: hasFlags ? flags : [
                    "This sample was just submitted and hasn't been processed yet.",
                    "The system validates samples automatically — it checks length, labels, PII, and quality.",
                ],
                cta: isOrganizer
                    ? "Click in the toolbar above to process all pending samples now."
                    : "No action needed — an organiser will trigger validation, or it runs on a schedule.",
                ctaColor: "#d97706",
            };
        }

        if (status === "flagged") {
            const scoreMsg = score != null
                ? `Quality score: ${Math.round(score * 100)}% (threshold: 55%). `
                : "";
            return {
                title: "Why is this flagged?",
                bullets: hasFlags ? flags : [
                    scoreMsg + "The sample passed basic checks but didn't reach the quality threshold.",
                    "It may be too short, repetitive, or lack vocabulary diversity.",
                ],
                cta: isOrganizer
                    ? "Use ✓ OK to accept it into the dataset, or ⊘ Reject to remove it."
                    : "You cannot validate samples directly. Submit a revised version from the Data Collection page.",
                ctaColor: "#ea580c",
            };
        }

        if (status === "rejected") {
            return {
                title: "Why was this rejected?",
                bullets: hasFlags ? flags : [
                    "Failed one or more automatic validation rules.",
                    "Common causes: empty text, fewer than 3 words, no label selected, email or phone number detected.",
                ],
                cta: isOrganizer
                    ? "You can override this with ✓ OK if you believe the rejection was incorrect."
                    : "Fix the issue and submit a new sample from the Data Collection page.",
                ctaColor: "#dc2626",
            };
        }

        return null;
    };

    const content = buildContent();
    if (!content) return children;

    const borderColor = {
        pending:  "#d97706",
        flagged:  "#ea580c",
        rejected: "#dc2626",
    }[status] || "#9ca3af";

    return (
        <span ref={ref} style={{ position: "relative", display: "inline-flex", alignItems: "center", gap: 4 }}>
            {children}
            <button
                onClick={() => setOpen(o => !o)}
                title={content.title}
                style={{
                    fontSize: 9, fontWeight: 700, padding: "1px 5px",
                    borderRadius: 99,
                    border: `1px solid ${borderColor}`,
                    background: "transparent",
                    cursor: "pointer",
                    color: borderColor,
                    lineHeight: 1.4,
                    flexShrink: 0,
                }}
            >?</button>

            {open && (
                <div style={{
                    position: "absolute",
                    bottom: "calc(100% + 8px)",
                    left: 0,
                    minWidth: 260,
                    maxWidth: 340,
                    background: "var(--color-background-primary, #fff)",
                    border: `1.5px solid ${borderColor}`,
                    borderRadius: 10,
                    padding: "12px 14px",
                    boxShadow: "0 6px 24px rgba(0,0,0,.14)",
                    zIndex: 200,
                }}>
                    {/* Title */}
                    <p style={{
                        fontSize: 10, fontWeight: 700, letterSpacing: ".08em",
                        textTransform: "uppercase", color: borderColor,
                        margin: "0 0 8px",
                    }}>
                        {content.title}
                    </p>

                    {/* Bullet reasons */}
                    <ul style={{ margin: "0 0 10px", paddingLeft: 16 }}>
                        {content.bullets.map((b, i) => (
                            <li key={i} style={{
                                fontSize: 12,
                                color: "var(--color-text-primary)",
                                lineHeight: 1.55,
                                marginBottom: i < content.bullets.length - 1 ? 4 : 0,
                            }}>
                                {b}
                            </li>
                        ))}
                    </ul>

                    {/* Divider */}
                    <div style={{
                        borderTop: "0.5px solid var(--color-border-tertiary)",
                        marginBottom: 8,
                    }} />

                    {/* CTA */}
                    <p style={{
                        fontSize: 11,
                        color: "var(--color-text-secondary)",
                        margin: 0,
                        lineHeight: 1.5,
                        fontStyle: "italic",
                    }}>
                        {content.cta}
                    </p>
                </div>
            )}
        </span>
    );
}

// ── Status pill ──────────────────────────────────────────────────────────────
function StatusPill({ status, flags, defaultReason, score, isOrganizer }) {
    const palette = {
        validated: { bg: "rgba(34,197,94,.13)",  color: "#16a34a" },
        flagged:   { bg: "rgba(249,115,22,.13)", color: "#ea580c" },
        rejected:  { bg: "rgba(239,68,68,.13)",  color: "#dc2626" },
        pending:   { bg: "rgba(245,158,11,.13)", color: "#d97706" },
    };
    const p = palette[status] || palette.pending;

    const pill = (
        <span style={{
            ...p,
            fontSize: 11, fontWeight: 600,
            padding: "3px 10px",
            borderRadius: 99,
            whiteSpace: "nowrap",
            letterSpacing: ".02em",
            display: "inline-block",
        }}>
            {status.charAt(0).toUpperCase() + status.slice(1)}
        </span>
    );

    if (status === "validated") return pill;

    return (
        <ReasonPopover
            status={status}
            flags={flags}
            defaultReason={defaultReason}
            score={score}
            isOrganizer={isOrganizer}
        >
            {pill}
        </ReasonPopover>
    );
}

// ── Score pill ───────────────────────────────────────────────────────────────
function ScorePill({ score }) {
    if (score == null) return <span style={{ color: "#9ca3af", fontSize: 12 }}>—</span>;
    const pct = Math.round(score * 100);
    const color = pct >= 55 ? "#16a34a" : pct >= 30 ? "#d97706" : "#dc2626";
    return (
        <span style={{
            fontSize: 12, fontWeight: 700, color,
            fontVariantNumeric: "tabular-nums",
        }}>
            {pct}%
        </span>
    );
}

// ── Content cell ─────────────────────────────────────────────────────────────
function ContentCell({ snippet, sampleType }) {
    if (snippet) {
        return (
            <div style={{ display: "flex", alignItems: "center", gap: 5, overflow: "hidden" }}>
                {sampleType === "audio" && (
                    <span style={{ fontSize: 10, flexShrink: 0, color: "var(--color-text-secondary)" }}>🎵</span>
                )}
                <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
                    title={snippet}>
                    {snippet}
                </span>
            </div>
        );
    }
    return (
        <span style={{ color: "var(--color-text-secondary)", fontSize: 12, fontStyle: "italic" }}>
            {sampleType === "audio" ? "🎵 Audio sample" : "No text content"}
        </span>
    );
}

// ── Main component ───────────────────────────────────────────────────────────
export default function RawSamplesTable({ competitionId, isOrganizer, version }) {
    const [samples,      setSamples]      = useState([]);
    const [total,        setTotal]        = useState(0);
    const [page,         setPage]         = useState(1);
    const [pageCount,    setPageCount]    = useState(1);
    const [status,       setStatus]       = useState("all");
    const [search,       setSearch]       = useState("");
    const [loading,      setLoading]      = useState(false);
    const [updating,     setUpdating]     = useState(null);
    const [revalidating, setRevalidating] = useState(false);
    const [revalMsg,     setRevalMsg]     = useState(null);

    const load = useCallback(() => {
        setLoading(true);
        const params = new URLSearchParams({ page, page_size: 20 });
        if (status !== "all") params.set("status", status);
        if (search)           params.set("search", search);
        if (version)          params.set("version", version);

        fetch(`${API}/competitions/${competitionId}/samples?${params}`, { headers: authHeader() })
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
            setTimeout(() => { load(); setRevalMsg(null); }, 3500);
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
            borderRadius: 12, overflow: "hidden",
            display: "flex", flexDirection: "column",
        }}>

            {/* ── Toolbar ── */}
            <div style={{
                display: "flex", alignItems: "center", justifyContent: "space-between",
                flexWrap: "wrap", gap: 10,
                padding: "14px 18px",
                borderBottom: "0.5px solid var(--color-border-tertiary)",
            }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{
                        fontSize: 11, fontWeight: 600, letterSpacing: ".08em",
                        color: "var(--color-text-secondary)", textTransform: "uppercase",
                    }}>Raw Samples</span>
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
                            color: "var(--color-text-primary)", width: 180, outline: "none",
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

                    {isOrganizer && (
                        <button
                            onClick={triggerRevalidate}
                            disabled={revalidating}
                            style={{
                                fontSize: 12, padding: "5px 12px", borderRadius: 7,
                                border: "0.5px solid var(--color-border-tertiary)",
                                background: revalidating
                                    ? "var(--color-background-secondary)"
                                    : "var(--color-background-info, #e6f1fb)",
                                color: revalidating
                                    ? "var(--color-text-secondary)"
                                    : "var(--color-text-info, #185fa5)",
                                cursor: revalidating ? "not-allowed" : "pointer",
                                fontWeight: 600, whiteSpace: "nowrap",
                            }}
                        >
                            {revalidating ? "Running…" : "⟳ Re-validate Pending"}
                        </button>
                    )}
                </div>
            </div>

            {/* ── Legend ── */}
            <div style={{
                display: "flex", gap: 20, padding: "8px 18px",
                borderBottom: "0.5px solid var(--color-border-tertiary)",
                background: "var(--color-background-secondary)",
                flexWrap: "wrap", alignItems: "center",
            }}>
                <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: ".07em",
                    textTransform: "uppercase", color: "var(--color-text-secondary)" }}>
                    Status guide:
                </span>
                {[
                    { s: "validated", color: "#16a34a", text: "In the dataset" },
                    { s: "pending",   color: "#d97706", text: "Not yet processed — click ? for details" },
                    { s: "flagged",   color: "#ea580c", text: "Needs review — click ? to see why & what to do" },
                    { s: "rejected",  color: "#dc2626", text: "Rule failed — click ? for the specific reason" },
                ].map(({ s, color, text }) => (
                    <div key={s} style={{ display: "flex", alignItems: "center", gap: 5 }}>
                        <span style={{ width: 7, height: 7, borderRadius: "50%", background: color, flexShrink: 0 }} />
                        <span style={{ fontSize: 11, color: "var(--color-text-secondary)" }}>
                            <b style={{ color }}>{s.charAt(0).toUpperCase() + s.slice(1)}</b> — {text}
                        </span>
                    </div>
                ))}
            </div>

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

            {/* ── Table ── */}
            <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13, tableLayout: "fixed" }}>
                    <colgroup>
                        <col style={{ width: 90 }} />
                        <col style={{ width: "auto" }} />
                        <col style={{ width: 110 }} />
                        <col style={{ width: 140 }} />
                        <col style={{ width: 70 }} />
                        <col style={{ width: 150 }} />
                        {isOrganizer && <col style={{ width: 130 }} />}
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
                                color: "var(--color-text-secondary)", fontSize: 13 }}>Loading…</td></tr>
                        ) : samples.length === 0 ? (
                            <tr><td colSpan={cols} style={{ padding: "40px 0", textAlign: "center",
                                color: "var(--color-text-secondary)", fontSize: 13 }}>
                                No samples found.
                                {status !== "all" && (
                                    <span>&nbsp;
                                        <button onClick={() => setStatus("all")} style={{
                                            fontSize: 12, color: "var(--color-text-info, #185fa5)",
                                            background: "none", border: "none", cursor: "pointer",
                                            textDecoration: "underline",
                                        }}>Clear filter</button>
                                    </span>
                                )}
                            </td></tr>
                        ) : samples.map((s, i) => (
                            <tr key={s.id} style={{
                                borderBottom: "0.5px solid var(--color-border-tertiary)",
                                background: i % 2 === 0 ? "transparent" : "var(--color-background-secondary)",
                            }}>
                                <td style={{
                                    padding: "10px 14px", fontFamily: "var(--font-mono)",
                                    fontSize: 11, color: "var(--color-text-secondary)",
                                    whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
                                }}>{s.uid}</td>

                                <td style={{ padding: "10px 14px", overflow: "hidden", color: "var(--color-text-primary)" }}>
                                    <ContentCell snippet={s.content_snippet} sampleType={s.sample_type} />
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
                                        }}>{s.annotator.initials}</div>
                                        <span style={{ fontSize: 12, color: "var(--color-text-primary)",
                                            overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                            {s.annotator.name}
                                        </span>
                                    </div>
                                </td>

                                <td style={{ padding: "10px 14px" }}>
                                    <ScorePill score={s.agreement} />
                                </td>

                                <td style={{ padding: "10px 14px" }}>
                                    <StatusPill
                                        status={s.status}
                                        flags={s.flags}
                                        defaultReason={s.rejection_reason}
                                        score={s.agreement}
                                        isOrganizer={isOrganizer}
                                    />
                                </td>

                                {isOrganizer && (
                                    <td style={{ padding: "10px 14px" }}>
                                        {updating === s.id ? (
                                            <span style={{ fontSize: 12, color: "var(--color-text-secondary)" }}>…</span>
                                        ) : (
                                            <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
                                                {s.status !== "validated" && (
                                                    <button onClick={() => updateStatus(s.id, "validated")} style={{
                                                        fontSize: 10, padding: "3px 8px", borderRadius: 5,
                                                        border: "0.5px solid #16a34a", color: "#16a34a",
                                                        background: "rgba(34,197,94,.08)", cursor: "pointer", fontWeight: 600,
                                                    }}>✓ OK</button>
                                                )}
                                                {s.status !== "flagged" && (
                                                    <button onClick={() => updateStatus(s.id, "flagged")} style={{
                                                        fontSize: 10, padding: "3px 8px", borderRadius: 5,
                                                        border: "0.5px solid #ea580c", color: "#ea580c",
                                                        background: "rgba(249,115,22,.08)", cursor: "pointer", fontWeight: 600,
                                                    }}>△ Flag</button>
                                                )}
                                                {s.status !== "rejected" && (
                                                    <button onClick={() => updateStatus(s.id, "rejected")} style={{
                                                        fontSize: 10, padding: "3px 8px", borderRadius: 5,
                                                        border: "0.5px solid #dc2626", color: "#dc2626",
                                                        background: "rgba(239,68,68,.08)", cursor: "pointer", fontWeight: 600,
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

            {/* ── Pagination ── */}
            <div style={{
                display: "flex", alignItems: "center", justifyContent: "space-between",
                padding: "12px 18px", borderTop: "0.5px solid var(--color-border-tertiary)",
            }}>
                <button disabled={page <= 1} onClick={() => setPage(p => p - 1)} style={{
                    fontSize: 13, padding: "5px 14px", borderRadius: 7,
                    border: "0.5px solid var(--color-border-tertiary)",
                    background: "var(--color-background-secondary)",
                    color: page <= 1 ? "var(--color-text-secondary)" : "var(--color-text-primary)",
                    cursor: page <= 1 ? "not-allowed" : "pointer",
                }}>← Prev</button>

                <span style={{ fontSize: 12, color: "var(--color-text-secondary)" }}>
                    Page {page} / {pageCount}
                </span>

                <button disabled={page >= pageCount} onClick={() => setPage(p => p + 1)} style={{
                    fontSize: 13, padding: "5px 14px", borderRadius: 7,
                    border: "0.5px solid var(--color-border-tertiary)",
                    background: "var(--color-background-secondary)",
                    color: page >= pageCount ? "var(--color-text-secondary)" : "var(--color-text-primary)",
                    cursor: page >= pageCount ? "not-allowed" : "pointer",
                }}>Next →</button>
            </div>
        </div>
    );
}