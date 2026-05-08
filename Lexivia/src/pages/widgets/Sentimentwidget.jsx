/**
 * widgets/SentimentWidget.jsx
 *
 * task_type: SENTIMENT_ANALYSIS
 *
 * Sentiment labels and aspect categories come from config (organizer-configured).
 * PromptCard surfaces organizer-supplied review/sentence examples so contributors
 * can annotate real data instead of typing their own.
 */
import { useState } from "react";
import { WidgetHeader, CommitRow, PromptCard } from "./shared";

const SENTIMENT_STYLES = {
  positive: { icon: "◑", color: "#16a34a", bg: "#dcfce7", border: "#86efac" },
  negative: { icon: "◐", color: "#dc2626", bg: "#fee2e2", border: "#fca5a5" },
  neutral:  { icon: "◎", color: "#6b7280", bg: "#f3f4f6", border: "#d1d5db" },
  mixed:    { icon: "◕", color: "#9333ea", bg: "#f3e8ff", border: "#d8b4fe" },
};

function SentimentButton({ label, selected, onClick }) {
  const s = SENTIMENT_STYLES[label] || SENTIMENT_STYLES.neutral;
  return (
    <button
      type="button"
      onClick={() => onClick(label)}
      style={{
        display: "flex", alignItems: "center", gap: 8,
        padding: "10px 18px", borderRadius: 10, cursor: "pointer", fontFamily: "inherit",
        fontWeight: 700, fontSize: 13, letterSpacing: "0.02em", transition: "all 0.15s",
        background: selected ? s.bg : "#f7f8fc",
        border: selected ? `1.5px solid ${s.border}` : "1.5px solid #e8edf8",
        color: selected ? s.color : "#6f778c",
      }}
    >
      <span style={{ fontSize: 16 }}>{s.icon}</span>
      {label.toUpperCase()}
    </button>
  );
}

function AspectRow({ aspect, value, onChange }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
      <span style={{ fontSize: 12, fontWeight: 700, color: "#6f778c", width: 90, flexShrink: 0 }}>
        {aspect.toUpperCase()}
      </span>
      <div style={{ display: "flex", gap: 6 }}>
        {["positive", "neutral", "negative", "n/a"].map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => onChange(s)}
            style={{
              fontSize: 10, fontWeight: 700, padding: "3px 10px", borderRadius: 6,
              cursor: "pointer", fontFamily: "inherit",
              background: value === s ? SENTIMENT_STYLES[s]?.bg || "#f3f4f6" : "#fff",
              border: value === s
                ? `1.5px solid ${SENTIMENT_STYLES[s]?.border || "#d1d5db"}`
                : "1.5px solid #e8edf8",
              color: value === s ? SENTIMENT_STYLES[s]?.color || "#374151" : "#9ca3af",
            }}
          >
            {s.toUpperCase()}
          </button>
        ))}
      </div>
    </div>
  );
}

export default function SentimentWidget({ competition, config, prompt, promptLoading, onSubmit, submitting }) {
  const sentimentLabels  = config?.sentiment_labels  || ["positive", "negative", "neutral", "mixed"];
  const aspectCategories = config?.aspect_categories || ["product", "service", "price", "delivery", "support"];

  const [text,       setText]       = useState("");
  const [sentiment,  setSentiment]  = useState("");
  const [confidence, setConfidence] = useState(80);
  const [aspects,    setAspects]    = useState({});
  const [showAspect, setShowAspect] = useState(false);

  const tokenCount = text.trim() ? text.trim().split(/\s+/).length : 0;

  const setAspect = (aspect, val) =>
    setAspects((prev) => ({ ...prev, [aspect]: val }));

  const handleSubmit = () => {
    if (!text.trim() || !sentiment) return;
    onSubmit({
      text_content: text,
      annotation: {
        sentiment,
        confidence: confidence / 100,
        label: sentiment,
        aspects: showAspect
          ? aspectCategories
              .filter((a) => aspects[a] && aspects[a] !== "n/a")
              .map((a) => ({ aspect: a, sentiment: aspects[a] }))
          : [],
      },
    });
    setText(""); setSentiment(""); setConfidence(80); setAspects({});
  };

  return (
    <div className="dc-widget">
      <WidgetHeader icon="◕" label="SENTIMENT ANALYSIS" meta={`Tokens: ${tokenCount}`} />

      {/* Organizer-supplied text example */}
      <PromptCard
        prompt={prompt}
        loading={promptLoading}
        label="TEXT SAMPLE"
        hint="Annotate the text below, or write your own."
        onUse={(content) => { setText(content); setSentiment(""); setAspects({}); }}
      />

      <textarea
        className="dc-textarea"
        placeholder="Enter or paste text to analyse sentiment…"
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={6}
      />
      <div className="dc-textarea-footer">
        <span>Tokens: {tokenCount}</span>
        <span>Characters: {text.length}</span>
      </div>

      {/* Sentiment selector */}
      <p className="dc-field-label" style={{ marginTop: 14 }}>OVERALL SENTIMENT</p>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        {sentimentLabels.map((l) => (
          <SentimentButton key={l} label={l} selected={sentiment === l} onClick={setSentiment} />
        ))}
      </div>

      {/* Confidence slider */}
      {sentiment && (
        <div style={{ marginTop: 14 }}>
          <p className="dc-field-label">CONFIDENCE: {confidence}%</p>
          <input
            type="range" min={50} max={100} value={confidence}
            onChange={(e) => setConfidence(Number(e.target.value))}
            style={{ width: "100%", accentColor: "#1359db" }}
          />
        </div>
      )}

      {/* Aspect-level toggle */}
      <div style={{ marginTop: 14, display: "flex", alignItems: "center", gap: 10 }}>
        <button
          type="button"
          className={`dc-label-tag ${showAspect ? "active" : ""}`}
          onClick={() => setShowAspect((v) => !v)}
        >
          {showAspect ? "▾" : "▸"} Aspect-Based Annotation
        </button>
        <span style={{ fontSize: 11, color: "#9ca3af" }}>optional</span>
      </div>

      {showAspect && (
        <div style={{ marginTop: 12, padding: "14px", background: "#f7f8fc", borderRadius: 10, border: "1px solid #e8edf8" }}>
          <p className="dc-field-label" style={{ marginBottom: 10 }}>ASPECT SENTIMENTS</p>
          {aspectCategories.map((a) => (
            <AspectRow key={a} aspect={a} value={aspects[a] || "n/a"} onChange={(v) => setAspect(a, v)} />
          ))}
        </div>
      )}

      <CommitRow
        disabled={!text.trim() || !sentiment}
        submitting={submitting}
        onClick={handleSubmit}
      />
    </div>
  );
}