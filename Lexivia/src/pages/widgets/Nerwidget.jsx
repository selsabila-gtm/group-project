/**
 * widgets/NERWidget.jsx
 *
 * task_type: NER
 *
 * Contributor pastes text, then click-selects word spans and assigns
 * entity types (PER, ORG, LOC, etc.). Produces a list of
 * {start, end, text, label} entity spans as the annotation.
 *
 * Entity types fetched from config.entity_types; fallback to defaults.
 */
import { useRef, useState } from "react";
import { WidgetHeader, CommitRow } from "./shared";

const ENTITY_COLORS = {
  PER:    { bg: "#dbeafe", border: "#3b82f6", text: "#1e40af" },
  ORG:    { bg: "#d1fae5", border: "#10b981", text: "#065f46" },
  LOC:    { bg: "#fef3c7", border: "#f59e0b", text: "#92400e" },
  MISC:   { bg: "#ede9fe", border: "#8b5cf6", text: "#4c1d95" },
  DATE:   { bg: "#fce7f3", border: "#ec4899", text: "#9d174d" },
  MONEY:  { bg: "#cffafe", border: "#06b6d4", text: "#164e63" },
  PRODUCT:{ bg: "#ffedd5", border: "#f97316", text: "#7c2d12" },
};

function TagBadge({ label }) {
  const c = ENTITY_COLORS[label] || { bg: "#f3f4f6", border: "#9ca3af", text: "#374151" };
  return (
    <span style={{
      background: c.bg, border: `1px solid ${c.border}`, color: c.text,
      borderRadius: 4, padding: "1px 6px", fontSize: 10, fontWeight: 700,
      letterSpacing: "0.06em", marginLeft: 3,
    }}>{label}</span>
  );
}

export default function NERWidget({ competition, config, onSubmit, submitting }) {
  const entityTypes = config?.entity_types || ["PER", "ORG", "LOC", "MISC", "DATE", "MONEY", "PRODUCT"];

  const [text,        setText]        = useState("");
  const [entities,    setEntities]    = useState([]);
  const [activeType,  setActiveType]  = useState(entityTypes[0]);
  const [selError,    setSelError]    = useState("");
  const textRef = useRef(null);

  // Convert text to word tokens with offset tracking
  const tokenize = (t) => {
    const tokens = [];
    const re = /\S+/g;
    let m;
    while ((m = re.exec(t)) !== null)
      tokens.push({ word: m[0], start: m.index, end: m.index + m[0].length });
    return tokens;
  };

  const tokens = tokenize(text);

  const handleMouseUp = () => {
    const sel = window.getSelection();
    if (!sel || sel.isCollapsed || !textRef.current) return;

    const range = sel.getRangeAt(0);
    const container = textRef.current;
    if (!container.contains(range.commonAncestorContainer)) return;

    // Build offset from container start
    const preRange = range.cloneRange();
    preRange.selectNodeContents(container);
    preRange.setEnd(range.startContainer, range.startOffset);
    const startOffset = preRange.toString().length;
    const selectedText = range.toString().trim();
    if (!selectedText) return;

    const endOffset = startOffset + selectedText.length;

    // Find matching tokens within selection
    const covered = tokens.filter((t) => t.start >= startOffset && t.end <= endOffset + 1);
    if (!covered.length) { setSelError("Select complete words."); return; }

    const actualStart = covered[0].start;
    const actualEnd   = covered[covered.length - 1].end;
    const actualText  = text.slice(actualStart, actualEnd);

    // Check overlap
    const overlaps = entities.some(
      (e) => !(actualEnd <= e.start || actualStart >= e.end)
    );
    if (overlaps) { setSelError("Spans cannot overlap."); return; }

    setSelError("");
    setEntities((prev) => [
      ...prev,
      { start: actualStart, end: actualEnd, text: actualText, label: activeType },
    ]);
    sel.removeAllRanges();
  };

  const removeEntity = (idx) => setEntities((e) => e.filter((_, i) => i !== idx));

  // Render text with entity highlights
  const renderAnnotated = () => {
    if (!text) return null;
    const sorted = [...entities].sort((a, b) => a.start - b.start);
    const parts = [];
    let cursor = 0;
    for (const ent of sorted) {
      if (ent.start > cursor) parts.push({ type: "plain", text: text.slice(cursor, ent.start) });
      parts.push({ type: "entity", ...ent });
      cursor = ent.end;
    }
    if (cursor < text.length) parts.push({ type: "plain", text: text.slice(cursor) });

    return parts.map((p, i) => {
      if (p.type === "plain")
        return <span key={i}>{p.text}</span>;
      const c = ENTITY_COLORS[p.label] || { bg: "#f3f4f6", border: "#9ca3af", text: "#374151" };
      return (
        <mark key={i} style={{
          background: c.bg, borderBottom: `2px solid ${c.border}`, color: c.text,
          borderRadius: 3, padding: "1px 2px", cursor: "pointer",
        }} title={`${p.label} — click entity list to remove`}>
          {p.text}<TagBadge label={p.label} />
        </mark>
      );
    });
  };

  const handleSubmit = () => {
    if (!text.trim() || !entities.length) return;
    onSubmit({
      text_content: text,
      annotation: { entities, token_count: tokens.length },
    });
    setText(""); setEntities([]);
  };

  return (
    <div className="dc-widget">
      <WidgetHeader icon="▦" label="NAMED ENTITY RECOGNITION" meta={`${entities.length} spans tagged`} />

      {/* Entity type selector */}
      <p className="dc-field-label">ENTITY TYPE</p>
      <div className="dc-label-row" style={{ marginBottom: 14 }}>
        {entityTypes.map((t) => {
          const c = ENTITY_COLORS[t] || { bg: "#f3f4f6", border: "#9ca3af", text: "#374151" };
          return (
            <button
              key={t}
              type="button"
              className="dc-label-tag"
              style={activeType === t ? {
                background: c.bg, border: `1.5px solid ${c.border}`, color: c.text,
              } : {}}
              onClick={() => setActiveType(t)}
            >
              {t}
            </button>
          );
        })}
      </div>

      {/* Text input */}
      {!entities.length ? (
        <>
          <p className="dc-field-label">PASTE / WRITE TEXT</p>
          <textarea
            className="dc-textarea"
            placeholder="Paste your text here, then switch to Annotate mode…"
            value={text}
            onChange={(e) => { setText(e.target.value); setEntities([]); }}
            rows={7}
          />
        </>
      ) : (
        <>
          <p className="dc-field-label">SELECT SPANS  <span style={{ fontWeight: 400, color: "#6f778c" }}>— highlight words with your mouse</span></p>
          <div
            ref={textRef}
            className="dc-textarea ner-annotation-area"
            style={{ minHeight: 120, userSelect: "text", cursor: "text", lineHeight: 1.8 }}
            onMouseUp={handleMouseUp}
          >
            {renderAnnotated()}
          </div>
          <button
            type="button"
            style={{ fontSize: 11, color: "#6f778c", border: "none", background: "transparent", cursor: "pointer", marginTop: 4 }}
            onClick={() => { setText(""); setEntities([]); }}
          >
            ← Edit text
          </button>
        </>
      )}

      {text.trim() && !entities.length && (
        <button
          type="button"
          className="dc-label-tag active"
          style={{ marginTop: 8, fontSize: 12, padding: "6px 14px" }}
          onClick={() => setEntities([{ start: 0, end: 0, text: "", label: activeType }].slice(0,0))}
        >
          Start Annotating →
        </button>
      )}

      {selError && (
        <p style={{ color: "#ef4444", fontSize: 11, marginTop: 6 }}>⚠ {selError}</p>
      )}

      {/* Entity list */}
      {entities.length > 0 && (
        <div style={{ marginTop: 14 }}>
          <p className="dc-field-label">TAGGED ENTITIES ({entities.length})</p>
          <div className="dc-label-row" style={{ flexWrap: "wrap", gap: 6 }}>
            {entities.map((e, i) => (
              <div key={i} className="ner-entity-chip">
                <TagBadge label={e.label} />
                <span style={{ marginLeft: 6, fontSize: 12 }}>"{e.text}"</span>
                <button type="button" className="ner-remove-btn" onClick={() => removeEntity(i)}>×</button>
              </div>
            ))}
          </div>
        </div>
      )}

      <CommitRow
        disabled={!text.trim() || !entities.length}
        submitting={submitting}
        onClick={handleSubmit}
      />
    </div>
  );
}