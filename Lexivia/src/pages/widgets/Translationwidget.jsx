/**
 * widgets/TranslationWidget.jsx
 *
 * task_type: TRANSLATION
 *
 * Side-by-side source / target text areas.
 * Language pair and optional glossary terms from config.
 */
import { useState } from "react";
import { WidgetHeader, CommitRow } from "./shared";

const RTL_LANGS = new Set(["AR", "HE", "FA", "UR", "DZA", "PS"]);

export default function TranslationWidget({ competition, config, onSubmit, submitting }) {
  const srcLang  = config?.source_lang || competition?.config?.source_lang || "EN";
  const tgtLang  = config?.target_lang || competition?.config?.target_lang || "AR";
  const glossary = config?.glossary     || [];

  const [source, setSource] = useState("");
  const [target, setTarget] = useState("");
  const [mode,   setMode]   = useState("standard"); // standard | back-translation

  const rtl    = RTL_LANGS.has(tgtLang.toUpperCase());
  const srcRtl = RTL_LANGS.has(srcLang.toUpperCase());

  const handleSubmit = () => {
    if (!source.trim() || !target.trim()) return;
    onSubmit({
      text_content: source,
      annotation: {
        source_lang: srcLang,
        target_lang: tgtLang,
        translation: target,
        mode,
      },
    });
    setSource(""); setTarget("");
  };

  return (
    <div className="dc-widget">
      <WidgetHeader
        icon="⇄"
        label="TRANSLATION PAIR"
        meta={`${srcLang} → ${tgtLang}`}
      />

      {/* Mode toggle */}
      <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
        {["standard", "back-translation"].map((m) => (
          <button
            key={m}
            type="button"
            className={`dc-label-tag ${mode === m ? "active" : ""}`}
            onClick={() => setMode(m)}
          >
            {m === "standard" ? "Standard" : "Back-Translation"}
          </button>
        ))}
      </div>

      <div className="translation-grid">
        <div className="translation-pane">
          <label className="dc-field-label">SOURCE — {srcLang}</label>
          <textarea
            className="dc-textarea"
            placeholder="Enter source text…"
            value={source}
            onChange={(e) => setSource(e.target.value)}
            rows={8}
            dir={srcRtl ? "rtl" : "ltr"}
          />
          <span className="pane-count">{source.length} chars · {source.trim() ? source.trim().split(/\s+/).length : 0} tokens</span>
        </div>

        <div className="translation-divider">⇄</div>

        <div className="translation-pane">
          <label className="dc-field-label">TARGET — {tgtLang}</label>
          <textarea
            className="dc-textarea"
            placeholder="Enter translation…"
            value={target}
            onChange={(e) => setTarget(e.target.value)}
            rows={8}
            dir={rtl ? "rtl" : "ltr"}
          />
          <span className="pane-count">{target.length} chars · {target.trim() ? target.trim().split(/\s+/).length : 0} tokens</span>
        </div>
      </div>

      {/* Glossary hint */}
      {glossary.length > 0 && (
        <div style={{ marginTop: 12, padding: "10px 14px", background: "#eff6ff", borderRadius: 8, border: "1px solid #bfdbfe" }}>
          <p className="dc-field-label" style={{ color: "#1e40af", marginBottom: 6 }}>GLOSSARY TERMS</p>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {glossary.map((g, i) => (
              <span key={i} style={{ fontSize: 11, background: "#dbeafe", color: "#1d4ed8", padding: "2px 8px", borderRadius: 4, fontWeight: 600 }}>
                {g.src} → {g.tgt}
              </span>
            ))}
          </div>
        </div>
      )}

      <CommitRow
        disabled={!source.trim() || !target.trim()}
        submitting={submitting}
        onClick={handleSubmit}
      />
    </div>
  );
}