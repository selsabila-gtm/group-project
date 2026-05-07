/**
 * RawSamplesTable.jsx — complete rewrite
 *
 * 1. Dynamic columns from backend (task-type aware)
 * 2. Score breakdown popover — explains exactly why a sample scored X%
 * 3. Approval flow — Approve / Reject / Flag buttons + progress bar
 * 4. Annotator audit trail — who approved/rejected, when, with notes
 * 5. Status: scored → can_be_validated → validated (needs 2 approvals)
 */

import { useState, useCallback, useEffect, useRef } from "react";

const API           = "http://127.0.0.1:8000";
const REQUIRED      = 2;   // must match backend REQUIRED_APPROVALS

function authHeader() {
    const token = localStorage.getItem("token");
    return token ? { Authorization: `Bearer ${token}` } : {};
}

// ── Score breakdown popover ──────────────────────────────────────────────────
function ScoreBreakdownPopover({ score, breakdown, children }) {
    const [open, setOpen] = useState(false);
    const ref = useRef(null);

    useEffect(() => {
        if (!open) return;
        const h = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
        document.addEventListener("mousedown", h);
        return () => document.removeEventListener("mousedown", h);
    }, [open]);

    // Show score even if breakdown is missing (pre-migration rows or audio samples)
    if (!breakdown || breakdown.length === 0) {
        if (score == null) {
            return <span style={{ fontSize:12, color:"#9ca3af" }}>—</span>;
        }
        const pct = Math.round(score * 100);
        const color = pct >= 70 ? "#16a34a" : pct >= 40 ? "#d97706" : "#dc2626";
        return (
            <span style={{ fontSize:12, fontWeight:800, color, fontVariantNumeric:"tabular-nums" }}>
                {pct}%
            </span>
        );
    }

    const pct   = Math.round((score || 0) * 100);
    const color = pct >= 70 ? "#16a34a" : pct >= 40 ? "#d97706" : "#dc2626";

    const severityColor = { ok:"#16a34a", warn:"#d97706", error:"#dc2626", info:"#6b7280" };

    return (
        <span ref={ref} style={{ position:"relative", display:"inline-flex", alignItems:"center", gap:4 }}>
            <button
                onClick={() => setOpen(o => !o)}
                style={{
                    background:"none", border:"none", cursor:"pointer", padding:0,
                    display:"flex", alignItems:"center", gap:4,
                }}
            >
                <span style={{ fontSize:12, fontWeight:800, color, fontVariantNumeric:"tabular-nums" }}>
                    {pct}%
                </span>
                <span style={{
                    fontSize:9, fontWeight:700, color:"#fff",
                    background: color, borderRadius:99, padding:"1px 5px",
                }}>WHY?</span>
            </button>

            {open && (
                <div style={{
                    position:"fixed",
                    top: ref.current ? (() => {
                        const rect = ref.current.getBoundingClientRect();
                        const spaceBelow = window.innerHeight - rect.bottom;
                        return spaceBelow > 400 ? rect.bottom + 6 : Math.max(10, rect.top - 6 - 400);
                    })() : 200,
                    left: ref.current
                        ? Math.min(ref.current.getBoundingClientRect().left, window.innerWidth - 430)
                        : 100,
                    minWidth:320, maxWidth:420,
                    background:"#fff",
                    border:"1.5px solid #e8edf8", borderRadius:12,
                    boxShadow:"0 8px 32px rgba(0,0,0,.18)", zIndex:9999,
                    padding:"14px 16px",
                    maxHeight: "80vh", overflowY: "auto",
                }}>
                    {/* Header */}
                    <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:10 }}>
                        <p style={{ margin:0, fontSize:11, fontWeight:800, letterSpacing:".08em",
                            textTransform:"uppercase", color:"#4f586f" }}>Score Breakdown</p>
                        <span style={{ fontSize:18, fontWeight:900, color }}>{pct}%</span>
                    </div>

                    {/* Overall progress bar */}
                    <div style={{ height:5, background:"#eef3ff", borderRadius:99, overflow:"hidden", marginBottom:12 }}>
                        <div style={{ width:`${pct}%`, height:"100%", background:color, borderRadius:99,
                            transition:"width .3s" }} />
                    </div>

                    {/* Per-rule rows */}
                    <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
                        {breakdown.map((rule, i) => (
                            <div key={i} style={{
                                background: rule.passed ? "rgba(34,197,94,.04)" : "rgba(239,68,68,.04)",
                                border: `1px solid ${rule.passed ? "rgba(34,197,94,.15)" : "rgba(239,68,68,.15)"}`,
                                borderRadius:8, padding:"8px 10px",
                            }}>
                                <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:3 }}>
                                    <span style={{ fontSize:11, fontWeight:700,
                                        color: severityColor[rule.severity] || "#4f586f" }}>
                                        {rule.passed ? "✓" : "✗"} {rule.label}
                                    </span>
                                    <span style={{ fontSize:11, fontWeight:800,
                                        color: severityColor[rule.severity] || "#4f586f" }}>
                                        {rule.score_pct}%
                                    </span>
                                </div>
                                {/* Sub-bar */}
                                <div style={{ height:3, background:"#eef3ff", borderRadius:99, overflow:"hidden", marginBottom:5 }}>
                                    <div style={{ width:`${rule.score_pct}%`, height:"100%",
                                        background: severityColor[rule.severity] || "#9ca3af",
                                        borderRadius:99 }} />
                                </div>
                                <p style={{ margin:0, fontSize:10, color:"#6b7280", lineHeight:1.5 }}>
                                    {/* Strip the [contributes X%] suffix for cleaner display */}
                                    {(rule.explanation || "").replace(/\s*\[contributes.*?\]/g, "")}
                                </p>
                                <p style={{ margin:"3px 0 0", fontSize:9, color:"#b0b8cc", fontStyle:"italic" }}>
                                    Weight: {Math.round(rule.weight * 100)}% of total score
                                </p>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </span>
    );
}

// ── Approval progress ────────────────────────────────────────────────────────
function ApprovalProgress({ approvalCount, needed, approvals }) {
    const [open, setOpen] = useState(false);
    const ref = useRef(null);

    useEffect(() => {
        if (!open) return;
        const h = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
        document.addEventListener("mousedown", h);
        return () => document.removeEventListener("mousedown", h);
    }, [open]);

    const done  = approvalCount || 0;
    const total = REQUIRED;
    const pct   = Math.min(100, Math.round(done / total * 100));
    const color = done >= total ? "#16a34a" : "#d97706";

    return (
        <span ref={ref} style={{ position:"relative", display:"inline-flex", alignItems:"center", gap:4 }}>
            <button onClick={() => setOpen(o => !o)} style={{
                background:"none", border:"none", cursor:"pointer", padding:0,
                display:"flex", alignItems:"center", gap:4,
            }}>
                {/* Mini dots */}
                {Array.from({length:total}).map((_, i) => (
                    <span key={i} style={{
                        width:8, height:8, borderRadius:"50%",
                        background: i < done ? color : "#e5e7eb",
                        border:`1px solid ${i < done ? color : "#d1d5db"}`,
                    }} />
                ))}
                <span style={{ fontSize:10, fontWeight:700, color }}>
                    {done}/{total}
                </span>
            </button>

            {open && approvals && approvals.length > 0 && (
                <div style={{
                    position:"fixed",
                    top: ref.current ? (() => {
                        const rect = ref.current.getBoundingClientRect();
                        const spaceBelow = window.innerHeight - rect.bottom;
                        return spaceBelow > 200 ? rect.bottom + 6 : Math.max(10, rect.top - 6 - 200);
                    })() : 200,
                    left: ref.current
                        ? Math.min(ref.current.getBoundingClientRect().left, window.innerWidth - 270)
                        : 100,
                    minWidth:250,
                    background:"#fff",
                    border:"1.5px solid #e8edf8", borderRadius:10,
                    boxShadow:"0 6px 24px rgba(0,0,0,.15)", zIndex:9999, padding:"12px 14px",
                }}>
                    <p style={{ margin:"0 0 8px", fontSize:10, fontWeight:800, letterSpacing:".08em",
                        textTransform:"uppercase", color:"#4f586f" }}>Annotator Actions</p>
                    {approvals.map((a, i) => {
                        const actionColor = a.action==="approve" ? "#16a34a"
                            : a.action==="reject" ? "#dc2626" : "#d97706";
                        const actionIcon = a.action==="approve" ? "✓"
                            : a.action==="reject" ? "✗" : "△";
                        const dt = a.timestamp ? new Date(a.timestamp).toLocaleString() : "";
                        return (
                            <div key={i} style={{
                                display:"flex", gap:8, alignItems:"flex-start",
                                paddingBottom:6, marginBottom: i<approvals.length-1 ? 6 : 0,
                                borderBottom: i<approvals.length-1 ? "1px solid #f0f3fb" : "none",
                            }}>
                                <span style={{ fontSize:12, color:actionColor, fontWeight:700,
                                    width:16, flexShrink:0, paddingTop:1 }}>{actionIcon}</span>
                                <div>
                                    <p style={{ margin:0, fontSize:12, fontWeight:700,
                                        color:"var(--color-text-primary,#1d2333)" }}>{a.name}</p>
                                    <p style={{ margin:"1px 0 0", fontSize:10, color:"#6b7280" }}>
                                        {dt}
                                    </p>
                                    {a.note && (
                                        <p style={{ margin:"2px 0 0", fontSize:11,
                                            color:"#4f586f", fontStyle:"italic" }}>"{a.note}"</p>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </span>
    );
}

// ── Status pill with reason popover ─────────────────────────────────────────
function StatusPill({ status, flags, score, approvalCount, isOrganizer }) {
    const [open, setOpen] = useState(false);
    const ref = useRef(null);

    useEffect(() => {
        if (!open) return;
        const h = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
        document.addEventListener("mousedown", h);
        return () => document.removeEventListener("mousedown", h);
    }, [open]);

    const palette = {
        validated:         { bg:"rgba(34,197,94,.13)",  color:"#16a34a", label:"Validated" },
        can_be_validated:  { bg:"rgba(19,89,219,.13)",  color:"#1359db", label:"Ready" },
        scored:            { bg:"rgba(139,92,246,.13)", color:"#7c3aed", label:"Scored" },
        flagged:           { bg:"rgba(249,115,22,.13)", color:"#ea580c", label:"Flagged" },
        rejected:          { bg:"rgba(239,68,68,.13)",  color:"#dc2626", label:"Rejected" },
        pending:           { bg:"rgba(245,158,11,.13)", color:"#d97706", label:"Pending" },
    };
    const p = palette[status] || palette.pending;

    const getMessage = () => {
        if (status === "validated")
            return { title:"Validated ✓", body:"This sample has been validated by an organiser and is in the dataset." };
        if (status === "can_be_validated")
            return { title:"Ready for Final Validation", body:`Received ${REQUIRED}/${REQUIRED} annotator approvals. An organiser can now click ✓ Validate to add it to the dataset.` };
        if (status === "scored")
            return { title:"Awaiting Annotator Approvals", body:`System scored this sample (${Math.round((score||0)*100)}%). Needs ${Math.max(0, REQUIRED - (approvalCount||0))} more annotator approval(s). Use the ✓ Approve button on the right.` };
        if (status === "flagged") {
            const reasons = flags && flags.length > 0
                ? flags.join(" • ")
                : "Flagged by automated checks or an annotator.";
            return { title:"Flagged for Review", body: reasons };
        }
        if (status === "rejected") {
            const reasons = flags && flags.length > 0
                ? flags.join(" • ")
                : "Failed automated validation — the text may be empty, too short (under 3 words), missing a label, or contain personal data (email/phone).";
            return { title:"Rejected — Reason", body: reasons };
        }
        return { title:"Pending", body:"Submitted, awaiting automated scoring." };
    };

    const msg = getMessage();

    return (
        <span ref={ref} style={{ position:"relative", display:"inline-flex", alignItems:"center", gap:3 }}>
            <span style={{ ...p, fontSize:11, fontWeight:700, padding:"3px 10px",
                borderRadius:99, whiteSpace:"nowrap", letterSpacing:".02em" }}>
                {p.label}
            </span>
            {status !== "validated" && (
                <button onClick={() => setOpen(o=>!o)} style={{
                    fontSize:9, fontWeight:700, padding:"1px 5px", borderRadius:99,
                    border:`1px solid ${p.color}`, background:"transparent",
                    cursor:"pointer", color:p.color, lineHeight:1.4, flexShrink:0,
                }}>?</button>
            )}
            {open && (
                <div style={{
                    position:"fixed",
                    top: ref.current
                        ? (() => {
                            const rect = ref.current.getBoundingClientRect();
                            const spaceBelow = window.innerHeight - rect.bottom;
                            return spaceBelow > 160
                                ? rect.bottom + 6
                                : rect.top - 6 - 140;
                          })()
                        : 200,
                    left: ref.current
                        ? Math.min(ref.current.getBoundingClientRect().left, window.innerWidth - 310)
                        : 200,
                    minWidth:240, maxWidth:310,
                    background:"#fff",
                    border:`1.5px solid ${p.color}`, borderRadius:10, padding:"12px 14px",
                    boxShadow:"0 8px 32px rgba(0,0,0,.18)", zIndex:9999,
                }}>
                    <p style={{ margin:"0 0 6px", fontSize:11, fontWeight:800,
                        color:p.color, letterSpacing:".05em", textTransform:"uppercase" }}>
                        {msg.title}
                    </p>
                    <p style={{ margin:0, fontSize:12, color:"#1d2333", lineHeight:1.6 }}>
                        {msg.body}
                    </p>
                </div>
            )}
        </span>
    );
}

// ── Approve/Reject/Flag action buttons ───────────────────────────────────────
function ApproveActions({ sample, onAction, updating }) {
    const [showNoteFor, setShowNoteFor] = useState(null);
    const [note, setNote] = useState("");

    const canApprove = ["scored","flagged","can_be_validated"].includes(sample.status);
    if (!canApprove) return null;

    const doAction = (action) => {
        onAction(sample.id, action, note);
        setShowNoteFor(null);
        setNote("");
    };

    return (
        <div style={{ display:"flex", flexDirection:"column", gap:4 }}>
            <div style={{ display:"flex", gap:4, flexWrap:"wrap" }}>
                <button
                    onClick={() => doAction("approve")}
                    disabled={updating}
                    style={{
                        fontSize:10, padding:"3px 8px", borderRadius:5, fontWeight:700,
                        border:"0.5px solid #16a34a", color:"#16a34a",
                        background:"rgba(34,197,94,.08)", cursor:"pointer",
                    }}>✓ Approve</button>
                <button
                    onClick={() => setShowNoteFor(showNoteFor==="flag" ? null : "flag")}
                    disabled={updating}
                    style={{
                        fontSize:10, padding:"3px 8px", borderRadius:5, fontWeight:700,
                        border:"0.5px solid #ea580c", color:"#ea580c",
                        background:"rgba(249,115,22,.08)", cursor:"pointer",
                    }}>△ Flag</button>
                <button
                    onClick={() => setShowNoteFor(showNoteFor==="reject" ? null : "reject")}
                    disabled={updating}
                    style={{
                        fontSize:10, padding:"3px 8px", borderRadius:5, fontWeight:700,
                        border:"0.5px solid #dc2626", color:"#dc2626",
                        background:"rgba(239,68,68,.08)", cursor:"pointer",
                    }}>✕ Reject</button>
            </div>
            {showNoteFor && (
                <div style={{ display:"flex", gap:4 }}>
                    <input
                        style={{ fontSize:11, padding:"3px 7px", borderRadius:5, flex:1,
                            border:"1px solid #e8edf8", outline:"none" }}
                        placeholder={`Reason for ${showNoteFor}…`}
                        value={note}
                        onChange={e => setNote(e.target.value)}
                        onKeyDown={e => e.key==="Enter" && doAction(showNoteFor)}
                        autoFocus
                    />
                    <button onClick={() => doAction(showNoteFor)} style={{
                        fontSize:10, padding:"3px 8px", borderRadius:5, fontWeight:700,
                        border:"1px solid #1359db", color:"#1359db",
                        background:"rgba(19,89,219,.08)", cursor:"pointer",
                    }}>Send</button>
                </div>
            )}
        </div>
    );
}

// ── Organiser final validate button ──────────────────────────────────────────
function OrgActions({ sample, onStatusChange, updating }) {
    if (sample.status === "can_be_validated") {
        return (
            <button onClick={() => onStatusChange(sample.id, "validated")} disabled={updating}
                style={{
                    fontSize:10, padding:"4px 10px", borderRadius:5, fontWeight:800,
                    border:"1.5px solid #16a34a", color:"#fff",
                    background:"#16a34a", cursor:"pointer", whiteSpace:"nowrap",
                }}>
                ✓ Validate
            </button>
        );
    }
    if (sample.status === "validated") return null;
    return null;
}

// ── Dynamic cell renderer ────────────────────────────────────────────────────
function CellValue({ colKey, sample }) {
    // Map column keys to their actual data field names
    const DATA_KEY_MAP = {
        "content":  "content_snippet",
        "document": "document",
        "source":   "source",
        "context":  "context",
        "prompt":   "prompt",
    };
    const dataKey = DATA_KEY_MAP[colKey] || colKey;
    const val = sample[dataKey] !== undefined ? sample[dataKey] : sample[colKey];

    if (colKey === "score") {
        return (
            <ScoreBreakdownPopover score={sample.agreement} breakdown={sample.score_breakdown}>
                {null}
            </ScoreBreakdownPopover>
        );
    }
    if (colKey === "approvals") {
        return (
            <ApprovalProgress
                approvalCount={sample.approval_count}
                needed={sample.approvals_needed}
                approvals={sample.approvals}
            />
        );
    }
    if (colKey === "status") {
        return (
            <StatusPill
                status={sample.status}
                flags={sample.flags}
                score={sample.agreement}
                approvalCount={sample.approval_count}
            />
        );
    }
    if (colKey === "annotator") {
        return (
            <div style={{ display:"flex", alignItems:"center", gap:7 }}>
                <div style={{
                    width:26, height:26, borderRadius:"50%", flexShrink:0,
                    background:"var(--color-background-info,#e6f1fb)",
                    color:"var(--color-text-info,#185fa5)",
                    display:"flex", alignItems:"center", justifyContent:"center",
                    fontSize:10, fontWeight:700,
                }}>
                    {sample.annotator?.initials || "?"}
                </div>
                <span style={{ fontSize:12, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
                    {sample.annotator?.name || "Unknown"}
                </span>
            </div>
        );
    }
    if (colKey === "id") {
        return <span style={{ fontFamily:"monospace", fontSize:11,
            color:"var(--color-text-secondary)" }}>{sample.uid}</span>;
    }
    if (colKey === "actions") return null; // rendered separately

    // Generic text cell
    const display = val != null && val !== "" && val !== "—" ? String(val) : null;
    return display
        ? <span style={{ fontSize:12 }} title={display}>{display.slice(0,60)}{display.length>60?"…":""}</span>
        : <span style={{ color:"#9ca3af", fontSize:12 }}>—</span>;
}

// ── Main table ───────────────────────────────────────────────────────────────
export default function RawSamplesTable({ competitionId, isOrganizer, version }) {
    const [samples,      setSamples]      = useState([]);
    const [columns,      setColumns]      = useState([]);
    const [taskType,     setTaskType]     = useState("");
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
                if (d.columns) setColumns(d.columns);
                if (d.task_type) setTaskType(d.task_type);
            })
            .catch(console.error)
            .finally(() => setLoading(false));
    }, [competitionId, page, status, search, version]);

    useEffect(() => { load(); }, [load]);

    // Annotator approve/flag/reject
    const handleApprove = async (sampleId, action, note) => {
        setUpdating(sampleId);
        try {
            await fetch(`${API}/data-samples/${sampleId}/approve`, {
                method: "POST",
                headers: { "Content-Type":"application/json", ...authHeader() },
                body: JSON.stringify({ action, note }),
            });
            load();
        } catch (e) { console.error(e); }
        finally { setUpdating(null); }
    };

    // Organiser final status change
    const handleStatusChange = async (sampleId, newStatus) => {
        setUpdating(sampleId);
        try {
            const res = await fetch(`${API}/data-samples/${sampleId}/status`, {
                method: "PATCH",
                headers: { "Content-Type":"application/json", ...authHeader() },
                body: JSON.stringify({ status: newStatus }),
            });
            if (!res.ok) {
                const d = await res.json().catch(() => ({}));
                alert(d.detail || "Could not update status.");
                return;
            }
            load();
        } catch (e) { console.error(e); }
        finally { setUpdating(null); }
    };

    const triggerRevalidate = async () => {
        setRevalidating(true); setRevalMsg(null);
        try {
            const res = await fetch(`${API}/competitions/${competitionId}/revalidate`,
                { method:"POST", headers:authHeader() });
            const d = await res.json();
            setRevalMsg(`✓ ${d.message}`);
            setTimeout(() => { load(); setRevalMsg(null); }, 3500);
        } catch {
            setRevalMsg("⚠ Revalidation request failed");
        } finally { setRevalidating(false); }
    };

    // Visible columns minus "actions" (rendered inline)
    const visibleCols = columns.filter(c => c.key !== "actions");
    const hasActions  = columns.some(c => c.key === "actions");

    return (
        <div style={{
            background:"var(--color-background-primary,#fff)",
            border:"0.5px solid var(--color-border-tertiary)",
            borderRadius:12,
            display:"flex", flexDirection:"column",
        }}>
            {/* Toolbar */}
            <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between",
                flexWrap:"wrap", gap:10, padding:"14px 18px",
                borderBottom:"0.5px solid var(--color-border-tertiary)" }}>
                <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                    <span style={{ fontSize:11, fontWeight:700, letterSpacing:".08em",
                        textTransform:"uppercase", color:"var(--color-text-secondary)" }}>
                        {taskType.replace(/_/g," ")} Samples
                    </span>
                    <span style={{ fontSize:11, fontWeight:700, padding:"1px 8px",
                        background:"var(--color-background-secondary)",
                        border:"0.5px solid var(--color-border-tertiary)",
                        borderRadius:99, color:"var(--color-text-secondary)" }}>
                        {total.toLocaleString()}
                    </span>
                </div>

                <div style={{ display:"flex", alignItems:"center", gap:8, flexWrap:"wrap" }}>
                    <input
                        style={{ fontSize:13, padding:"5px 10px", borderRadius:7,
                            border:"0.5px solid var(--color-border-tertiary)",
                            background:"var(--color-background-secondary)",
                            color:"var(--color-text-primary)", width:170, outline:"none" }}
                        placeholder="Search…"
                        value={search}
                        onChange={e => { setSearch(e.target.value); setPage(1); }}
                    />
                    <select
                        style={{ fontSize:13, padding:"5px 10px", borderRadius:7,
                            border:"0.5px solid var(--color-border-tertiary)",
                            background:"var(--color-background-secondary)",
                            color:"var(--color-text-primary)", cursor:"pointer" }}
                        value={status}
                        onChange={e => { setStatus(e.target.value); setPage(1); }}
                    >
                        {["all","pending","scored","can_be_validated","validated","flagged","rejected"].map(s => (
                            <option key={s} value={s}>
                                {s==="all" ? "All statuses"
                                  : s==="can_be_validated" ? "Ready to validate"
                                  : s==="scored" ? "Scored (needs approval)"
                                  : s.charAt(0).toUpperCase()+s.slice(1)}
                            </option>
                        ))}
                    </select>

                    {isOrganizer && (
                        <button onClick={triggerRevalidate} disabled={revalidating} style={{
                            fontSize:12, padding:"5px 12px", borderRadius:7,
                            border:"0.5px solid var(--color-border-tertiary)",
                            background: revalidating ? "var(--color-background-secondary)"
                                                     : "var(--color-background-info,#e6f1fb)",
                            color: revalidating ? "var(--color-text-secondary)"
                                                : "var(--color-text-info,#185fa5)",
                            cursor: revalidating ? "not-allowed" : "pointer",
                            fontWeight:700, whiteSpace:"nowrap",
                        }}>
                            {revalidating ? "Running…" : "⟳ Re-score All"}
                        </button>
                    )}
                </div>
            </div>

            {/* Status guide */}
            <div style={{ display:"flex", gap:14, padding:"7px 18px",
                borderBottom:"0.5px solid var(--color-border-tertiary)",
                background:"var(--color-background-secondary)", flexWrap:"wrap" }}>
                {[
                    {s:"pending",         color:"#d97706", t:"Waiting to be scored"},
                    {s:"scored",          color:"#7c3aed", t:"Score ready — click ? then Approve"},
                    {s:"can_be_validated",color:"#1359db", t:`${REQUIRED} approvals done — organiser validates`},
                    {s:"validated",       color:"#16a34a", t:"In the dataset"},
                    {s:"flagged",         color:"#ea580c", t:"Needs review"},
                    {s:"rejected",        color:"#dc2626", t:"Failed"},
                ].map(({ s, color, t }) => (
                    <span key={s} style={{ fontSize:10, display:"flex", alignItems:"center", gap:4 }}>
                        <span style={{ width:7, height:7, borderRadius:"50%",
                            background:color, flexShrink:0 }} />
                        <b style={{ color }}>{s==="can_be_validated"?"Ready":s.charAt(0).toUpperCase()+s.slice(1)}</b>
                        {" — "}{t}
                    </span>
                ))}
            </div>

            {revalMsg && (
                <div style={{ padding:"8px 18px", fontSize:12,
                    background:"var(--color-background-success,#eaf3de)",
                    color:"var(--color-text-success,#3b6d11)",
                    borderBottom:"0.5px solid var(--color-border-tertiary)" }}>
                    {revalMsg}
                </div>
            )}

            {/* Table */}
            <div style={{ overflowX:"auto" }}>
                <table style={{ width:"100%", borderCollapse:"collapse", fontSize:13 }}>
                    <thead>
                        <tr style={{ borderBottom:"0.5px solid var(--color-border-tertiary)" }}>
                            {visibleCols.map(c => (
                                <th key={c.key} style={{ padding:"10px 14px", textAlign:"left",
                                    fontSize:10, fontWeight:700, letterSpacing:".07em",
                                    color:"var(--color-text-secondary)", textTransform:"uppercase",
                                    whiteSpace:"nowrap" }}>{c.label}</th>
                            ))}
                            {hasActions && (
                                <th style={{ padding:"10px 14px", textAlign:"left",
                                    fontSize:10, fontWeight:700, letterSpacing:".07em",
                                    color:"var(--color-text-secondary)", textTransform:"uppercase",
                                    whiteSpace:"nowrap", minWidth:180 }}>Actions</th>
                            )}
                        </tr>
                    </thead>
                    <tbody>
                        {loading ? (
                            <tr><td colSpan={visibleCols.length + (hasActions?1:0)}
                                style={{ padding:"32px 0", textAlign:"center",
                                    color:"var(--color-text-secondary)" }}>Loading…</td></tr>
                        ) : samples.length === 0 ? (
                            <tr><td colSpan={visibleCols.length + (hasActions?1:0)}
                                style={{ padding:"40px 0", textAlign:"center",
                                    color:"var(--color-text-secondary)" }}>
                                No samples found.
                                {status !== "all" && (
                                    <span>&nbsp;<button onClick={() => setStatus("all")} style={{
                                        fontSize:12, color:"var(--color-text-info,#185fa5)",
                                        background:"none", border:"none", cursor:"pointer",
                                        textDecoration:"underline" }}>Clear filter</button></span>
                                )}
                            </td></tr>
                        ) : samples.map((s, i) => (
                            <tr key={s.id} style={{
                                borderBottom:"0.5px solid var(--color-border-tertiary)",
                                background: i%2===0 ? "transparent"
                                    : "var(--color-background-secondary)",
                                opacity: updating === s.id ? 0.6 : 1,
                            }}>
                                {visibleCols.map(c => (
                                    <td key={c.key} style={{ padding:"10px 14px",
                                        maxWidth: c.key==="id" ? 90 : 180,
                                        overflow:"hidden", textOverflow:"ellipsis" }}>
                                        <CellValue colKey={c.key} sample={s} />
                                    </td>
                                ))}
                                {hasActions && (
                                    <td style={{ padding:"10px 14px" }}>
                                        <div style={{ display:"flex", flexDirection:"column", gap:5 }}>
                                            {/* Any annotator: approve/flag/reject scored samples */}
                                            <ApproveActions
                                                sample={s}
                                                onAction={handleApprove}
                                                updating={updating === s.id}
                                            />
                                            {/* Organiser only: final validate */}
                                            {isOrganizer && (
                                                <OrgActions
                                                    sample={s}
                                                    onStatusChange={handleStatusChange}
                                                    updating={updating === s.id}
                                                />
                                            )}
                                        </div>
                                    </td>
                                )}
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* Pagination */}
            <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between",
                padding:"12px 18px", borderTop:"0.5px solid var(--color-border-tertiary)" }}>
                <button disabled={page<=1} onClick={() => setPage(p=>p-1)} style={{
                    fontSize:13, padding:"5px 14px", borderRadius:7,
                    border:"0.5px solid var(--color-border-tertiary)",
                    background:"var(--color-background-secondary)",
                    color: page<=1 ? "var(--color-text-secondary)" : "var(--color-text-primary)",
                    cursor: page<=1 ? "not-allowed" : "pointer",
                }}>← Prev</button>
                <span style={{ fontSize:12, color:"var(--color-text-secondary)" }}>
                    Page {page} / {pageCount}
                </span>
                <button disabled={page>=pageCount} onClick={() => setPage(p=>p+1)} style={{
                    fontSize:13, padding:"5px 14px", borderRadius:7,
                    border:"0.5px solid var(--color-border-tertiary)",
                    background:"var(--color-background-secondary)",
                    color: page>=pageCount ? "var(--color-text-secondary)" : "var(--color-text-primary)",
                    cursor: page>=pageCount ? "not-allowed" : "pointer",
                }}>Next →</button>
            </div>
        </div>
    );
}