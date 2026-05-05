/**
 * widgets/QuestionAnsweringWidget.jsx
 *
 * task_type: QUESTION_ANSWERING
 *
 * Contributor provides a context passage, writes a question,
 * and provides the answer — either as an extracted span (extractive)
 * or free text (generative). Config can specify qa_type default.
 */
import { useState } from "react";
import { WidgetHeader, CommitRow } from "./shared";

export default function QuestionAnsweringWidget({ competition, config, onSubmit, submitting }) {
  const defaultQaType = config?.qa_type || "extractive";
  const [context,  setContext]  = useState("");
  const [question, setQuestion] = useState("");
  const [answer,   setAnswer]   = useState("");
  const [qaType,   setQaType]   = useState(defaultQaType);
  const [startIdx, setStartIdx] = useState("");

  // For extractive QA: auto-detect answer span in context
  const handleAnswerChange = (val) => {
    setAnswer(val);
    if (qaType === "extractive" && context && val) {
      const idx = context.toLowerCase().indexOf(val.toLowerCase());
      setStartIdx(idx >= 0 ? String(idx) : "");
    }
  };

  // Highlight answer span in context preview
  const renderContext = () => {
    if (!answer.trim() || qaType !== "extractive") return context;
    const idx = context.toLowerCase().indexOf(answer.toLowerCase());
    if (idx < 0) return context;
    return (
      <>
        {context.slice(0, idx)}
        <mark style={{ background: "#fef9c3", borderBottom: "2px solid #f59e0b", borderRadius: 2 }}>
          {context.slice(idx, idx + answer.length)}
        </mark>
        {context.slice(idx + answer.length)}
      </>
    );
  };

  const handleSubmit = () => {
    if (!context.trim() || !question.trim() || !answer.trim()) return;
    onSubmit({
      text_content: context,
      annotation: {
        question,
        answer,
        qa_type: qaType,
        start_index: qaType === "extractive" && startIdx !== "" ? Number(startIdx) : null,
      },
    });
    setContext(""); setQuestion(""); setAnswer(""); setStartIdx("");
  };

  return (
    <div className="dc-widget">
      <WidgetHeader icon="◈" label="QUESTION ANSWERING" meta={qaType === "extractive" ? "Extractive" : "Generative"} />

      {/* QA type toggle */}
      <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
        {["extractive", "generative"].map((t) => (
          <button
            key={t}
            type="button"
            className={`dc-label-tag ${qaType === t ? "active" : ""}`}
            onClick={() => { setQaType(t); setAnswer(""); setStartIdx(""); }}
          >
            {t === "extractive" ? "Extractive (span)" : "Generative (free)"}
          </button>
        ))}
      </div>

      {/* Context */}
      <label className="dc-field-label">CONTEXT PASSAGE</label>
      {qaType === "extractive" && answer.trim() ? (
        <div
          className="dc-textarea"
          style={{ minHeight: 100, lineHeight: 1.7, whiteSpace: "pre-wrap" }}
        >
          {renderContext()}
        </div>
      ) : (
        <textarea
          className="dc-textarea"
          placeholder="Paste or write the context passage here…"
          value={context}
          onChange={(e) => setContext(e.target.value)}
          rows={6}
        />
      )}
      <div className="dc-textarea-footer">
        <span>{context.trim().split(/\s+/).filter(Boolean).length} tokens</span>
        {qaType === "extractive" && startIdx !== "" && (
          <span>Answer @ char {startIdx}</span>
        )}
      </div>

      {/* Question + Answer row */}
      <div className="cognitive-row" style={{ marginTop: 14 }}>
        <div className="cognitive-field">
          <label className="dc-field-label">QUESTION</label>
          <input
            type="text"
            className="dc-input"
            placeholder="Write your question…"
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
          />
        </div>
        <div className="cognitive-field">
          <label className="dc-field-label">
            ANSWER {qaType === "extractive" ? "(span from context)" : "(free text)"}
          </label>
          <input
            type="text"
            className="dc-input"
            placeholder={qaType === "extractive" ? "Copy exact span from context…" : "Write the answer…"}
            value={answer}
            onChange={(e) => handleAnswerChange(e.target.value)}
          />
        </div>
      </div>

      {/* Extractive span warning */}
      {qaType === "extractive" && answer.trim() && startIdx === "" && (
        <p style={{ color: "#ef4444", fontSize: 11, marginTop: 6 }}>
          ⚠ Answer span not found in context — verify the exact wording.
        </p>
      )}

      <CommitRow
        disabled={!context.trim() || !question.trim() || !answer.trim()}
        submitting={submitting}
        onClick={handleSubmit}
      />
    </div>
  );
}