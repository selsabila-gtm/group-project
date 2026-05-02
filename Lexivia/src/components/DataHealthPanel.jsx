/**
 * DataHealthPanel.jsx
 *
 * Displays live validation stats: validated / flagged / rejected / pending.
 * Data comes from GET /competitions/{id}/data-health — never hardcoded.
 *
 * Props:
 *   health  — the response object from the /data-health endpoint
 *             { total, validated, flagged, rejected, pending,
 *               avg_text_length, label_distribution, alerts }
 */

import { useEffect, useState } from "react";
import "./DataHealthPanel.css";

// ─── Severity badge ────────────────────────────────────────────────────────────
function SeverityBadge({ alerts }) {
    if (!alerts || alerts.length === 0)
        return <span className="dhp-badge dhp-badge--healthy">● HEALTHY</span>;
    const isCrit = alerts.some(a => a.level === "critical");
    return isCrit
        ? <span className="dhp-badge dhp-badge--critical">▲ CRITICAL</span>
        : <span className="dhp-badge dhp-badge--warning">△ WARNING</span>;
}

// ─── Single status row ─────────────────────────────────────────────────────────
function StatusRow({ label, count, total, color, icon }) {
    const pct = total > 0 ? Math.round((count / total) * 100) : 0;
    return (
        <div className="dhp-status-row">
            <div className="dhp-status-meta">
                <span className="dhp-status-icon" style={{ color }}>{icon}</span>
                <span className="dhp-status-label">{label}</span>
                <span className="dhp-status-count" style={{ color }}>{count.toLocaleString()}</span>
            </div>
            <div className="dhp-bar-track">
                <div
                    className="dhp-bar-fill"
                    style={{ width: `${pct}%`, background: color }}
                />
            </div>
            <span className="dhp-bar-pct">{pct}%</span>
        </div>
    );
}

// ─── Alert row ─────────────────────────────────────────────────────────────────
function AlertRow({ alert }) {
    const isCrit = alert.level === "critical";
    return (
        <div className={`dhp-alert ${isCrit ? "dhp-alert--critical" : "dhp-alert--warning"}`}>
            <span className="dhp-alert-icon">{isCrit ? "⊘" : "△"}</span>
            <div className="dhp-alert-body">
                <p className="dhp-alert-type">{alert.type}</p>
                <p className="dhp-alert-detail">{alert.detail}</p>
            </div>
        </div>
    );
}

// ─── Main panel ────────────────────────────────────────────────────────────────
export default function DataHealthPanel({ health, loading }) {
    if (loading) {
        return (
            <div className="dhp-panel dhp-panel--loading">
                <div className="dhp-spinner" />
                <p className="dhp-loading-text">Analysing dataset health…</p>
            </div>
        );
    }

    if (!health) return null;

    const { total = 0, validated = 0, flagged = 0, rejected = 0, pending = 0, alerts = [] } = health;

    const statuses = [
        { label: "Validated", count: validated, color: "#22c55e", icon: "✓" },
        { label: "Pending",   count: pending,   color: "#f59e0b", icon: "◔" },
        { label: "Flagged",   count: flagged,   color: "#f97316", icon: "△" },
        { label: "Rejected",  count: rejected,  color: "#ef4444", icon: "⊘" },
    ];

    return (
        <div className="dhp-panel">
            {/* Header */}
            <div className="dhp-panel-header">
                <div className="dhp-panel-title-row">
                    <span className="dhp-panel-title">DATA HEALTH</span>
                    <SeverityBadge alerts={alerts} />
                </div>
                <span className="dhp-total-label">
                    {total.toLocaleString()} total samples
                </span>
            </div>

            {/* Status breakdown */}
            <div className="dhp-status-list">
                {statuses.map(s => (
                    <StatusRow key={s.label} total={total} {...s} />
                ))}
            </div>

            {/* Divider */}
            {alerts.length > 0 && <div className="dhp-divider" />}

            {/* Alerts */}
            {alerts.map((a, i) => <AlertRow key={i} alert={a} />)}

            {alerts.length === 0 && (
                <p className="dhp-no-alerts">No quality issues detected.</p>
            )}
        </div>
    );
}