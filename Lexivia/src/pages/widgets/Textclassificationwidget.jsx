/**
 * widgets/TextClassificationWidget.jsx
 *
 * task_type: TEXT_CLASSIFICATION
 *
 * Labels come from config.labels (organizer-configured via /dataset-config).
 * If the organizer has seeded source texts via /prompts/batch, a PromptCard
 * appears at the top and the contributor can pre-fill the textarea with one click.
 */
import { useEffect, useState } from "react";
import { QualityFlag, WidgetHeader, CommitRow, PromptCard } from "./shared";

export default function TextClassificationWidget({ competition, config, prompt, promptLoading, onSubmit, submitting }) {
  // Labels are always from the organizer's config; fall back to defaults only
  // when the competition hasn't loaded yet.
  const labels = config?.labels || [
    "Finance", "Technology", "Healthcare", "Politics",
    "Sports", "Entertainment", "Science", "Other",
  ];

  const [text,     setText]     = useState("");
  const [selected, setSelected] = useState([]);
  const [flags,    setFlags]    = useState([]);

  const tokenCount = text.trim() ? text.trim().split(/\s+/).length : 0;

  // Lightweight client-side QC hints
  useEffect(() => {
    const f = [];
    if (text.length > 20 && tokenCount < 5)
      f.push({
        type: "low_domain_relevance",
        detail: "Text appears too short — minimum 5 tokens required for reliable classification.",
      });
    if (text.length > 40 && tokenCount > 4)
      f.push({
        type: "lexical_overlap",
        detail: "High lexical similarity to existing corpus entries. Diversification recommended.",
      });
    setFlags(f);
  }, [text, tokenCount]);

  const toggle = (l) =>
    setSelected((p) => p.includes(l) ? p.filter((x) => x !== l) : [...p, l]);

  const handleSubmit = () => {
    if (!text.trim() || !selected.length) return;
    onSubmit({ text_content: text, annotation: { labels: selected, label: selected[0] } });
    setText(""); setSelected([]); setFlags([]);
  };

  return (
    <div className="dc-widget">
      <WidgetHeader icon="▤" label="TEXT CLASSIFICATION" meta="Multi-label" />

      {/* Organizer-supplied source text (if any) */}
      <PromptCard
        prompt={prompt}
        loading={promptLoading}
        label="SOURCE TEXT"
        hint="Classify the text below, or write your own."
        onUse={(content) => { setText(content); setSelected([]); setFlags([]); }}
      />

      <textarea
        className="dc-textarea"
        placeholder="Enter or paste text to classify…"
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={8}
      />
      <div className="dc-textarea-footer">
        <span>Tokens: {tokenCount}</span>
        <span>Characters: {text.length}</span>
      </div>

      <p className="dc-field-label" style={{ marginTop: 14 }}>SELECT LABELS</p>
      <div className="dc-label-row">
        {labels.map((l) => (
          <button
            key={l}
            type="button"
            className={`dc-label-tag ${selected.includes(l) ? "active" : ""}`}
            onClick={() => toggle(l)}
          >
            #{l}
          </button>
        ))}
      </div>
      {selected.length > 0 && (
        <p style={{ fontSize: 11, color: "#6f778c", marginTop: 6 }}>
          Selected: {selected.join(", ")}
        </p>
      )}

      {flags.length > 0 && (
        <div className="dc-qc-section">
          <p className="dc-qc-title">QUALITY CONTROL DIAGNOSTICS</p>
          <div className="dc-qc-flags">
            {flags.map((f, i) => <QualityFlag key={i} {...f} />)}
          </div>
        </div>
      )}

      <CommitRow
        disabled={!text.trim() || !selected.length}
        submitting={submitting}
        onClick={handleSubmit}
      />
    </div>
  );
}