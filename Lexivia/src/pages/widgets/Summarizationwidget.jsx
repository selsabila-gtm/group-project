/**
 * widgets/SummarizationWidget.jsx
 *
 * task_type: SUMMARIZATION
 *
 * Ratios and word limits come from config (organizer-configured).
 * PromptCard pre-fills the source document field with an organizer-supplied
 * article/passage so contributors summarise real corpus documents.
 */
import { useState } from "react";
import { WidgetHeader, CommitRow, QualityFlag, PromptCard } from "./shared";

function countWords(t) {
  return t.trim() ? t.trim().split(/\s+/).length : 0;
}

export default function SummarizationWidget({ competition, config, prompt, promptLoading, onSubmit, submitting }) {
  const targetRatio = config?.target_ratio      || 0.1;
  const maxRatio    = config?.max_ratio         || 0.15;
  const minWords    = config?.min_summary_words || 20;

  const [source,  setSource]  = useState("");
  const [summary, setSummary] = useState("");

  const srcWords    = countWords(source);
  const sumWords    = countWords(summary);
  const targetWords = Math.max(minWords, Math.round(srcWords * targetRatio));
  const maxWords    = Math.round(srcWords * maxRatio);
  const ratioActual = srcWords > 0 ? Math.round((sumWords / srcWords) * 100) : 0;

  const flags = [];
  if (sumWords > 0 && srcWords > 0) {
    if (sumWords > maxWords && maxWords > minWords)
      flags.push({ type: "warn", detail: `Summary is ${sumWords} words — exceeds the ${maxRatio * 100}% target ratio.` });
    if (sumWords < minWords)
      flags.push({ type: "error", detail: `Summary is too short (${sumWords} words). Minimum: ${minWords} words.` });
  }

  const handleSubmit = () => {
    if (!source.trim() || !summary.trim()) return;
    onSubmit({
      text_content: source,
      annotation: {
        summary,
        source_word_count: srcWords,
        summary_word_count: sumWords,
        compression_ratio: srcWords > 0 ? sumWords / srcWords : null,
        prompt_id: prompt?.id ?? null,
      },
    });
    setSource(""); setSummary("");
  };

  return (
    <div className="dc-widget">
      <WidgetHeader
        icon="▤"
        label="SUMMARIZATION"
        meta={srcWords > 0 ? `${ratioActual}% of source` : "Enter document"}
      />

      {/* Organizer-supplied document */}
      <PromptCard
        prompt={prompt}
        loading={promptLoading}
        label="DOCUMENT TO SUMMARISE"
        hint="Write a summary for this document, or paste your own source text."
        onUse={(content) => { setSource(content); setSummary(""); }}
      />

      <label className="dc-field-label">SOURCE DOCUMENT</label>
      <textarea
        className="dc-textarea"
        placeholder="Paste or type the document to summarise…"
        value={source}
        onChange={(e) => setSource(e.target.value)}
        rows={7}
      />
      <div className="dc-textarea-footer">
        <span>Source: {srcWords} words</span>
        {srcWords > 0 && <span>Target summary: ~{targetWords} words</span>}
      </div>

      <label className="dc-field-label" style={{ marginTop: 14 }}>SUMMARY</label>
      <textarea
        className="dc-textarea"
        placeholder={`Write a concise summary (target ~${srcWords > 0 ? targetWords : minWords} words)…`}
        value={summary}
        onChange={(e) => setSummary(e.target.value)}
        rows={5}
      />
      <div className="dc-textarea-footer">
        <span>Summary: {sumWords} words</span>
        {srcWords > 0 && (
          <span style={{ color: sumWords > maxWords ? "#ef4444" : sumWords >= minWords ? "#16a34a" : "#f59e0b" }}>
            {ratioActual}% compression
          </span>
        )}
      </div>

      {/* Word count progress bar */}
      {srcWords > 0 && (
        <div style={{ margin: "10px 0 4px" }}>
          <div style={{ height: 6, background: "#e8edf8", borderRadius: 999, overflow: "hidden" }}>
            <div style={{
              height: "100%", borderRadius: 999, transition: "width 0.3s",
              width: `${Math.min(100, (sumWords / targetWords) * 100)}%`,
              background: sumWords > maxWords ? "#ef4444" : sumWords >= minWords ? "#16a34a" : "#f59e0b",
            }} />
          </div>
          <p style={{ fontSize: 10, color: "#9ca3af", marginTop: 3, marginBottom: 0 }}>
            {sumWords} / {targetWords} target words
          </p>
        </div>
      )}

      {flags.length > 0 && (
        <div className="dc-qc-section">
          <p className="dc-qc-title">QUALITY CONTROL</p>
          <div className="dc-qc-flags">
            {flags.map((f, i) => <QualityFlag key={i} {...f} />)}
          </div>
        </div>
      )}

      <CommitRow
        disabled={!source.trim() || !summary.trim() || sumWords < minWords}
        submitting={submitting}
        onClick={handleSubmit}
      />
    </div>
  );
}