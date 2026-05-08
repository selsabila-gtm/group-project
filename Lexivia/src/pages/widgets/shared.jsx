/**
 * widgets/shared.jsx
 * Reusable primitives used by multiple annotation widgets.
 */
import { useRef, useState } from "react";

// ── Quality flag chip ─────────────────────────────────────────
export function QualityFlag({ type, detail }) {
  const isError = type === "low_domain_relevance" || type === "error";
  return (
    <div className={`qc-flag ${isError ? "error" : "warn"}`}>
      <span className="qc-icon">{isError ? "⊘" : "△"}</span>
      <div>
        <p className="qc-flag-title">
          {isError ? "Low Domain Relevance" : "Lexical Overlap Detected"}
        </p>
        <p className="qc-flag-detail">{detail}</p>
      </div>
    </div>
  );
}

// ── Widget header bar ─────────────────────────────────────────
export function WidgetHeader({ icon, label, meta }) {
  return (
    <div className="dc-widget-header">
      <div className="dc-doc-badge">
        <span className="dc-doc-icon">{icon}</span>
        <span>{label}</span>
      </div>
      {meta && <span className="dc-lang-tag">{meta}</span>}
    </div>
  );
}

// ── Commit button row ─────────────────────────────────────────
export function CommitRow({ disabled, submitting, label = "Commit Entry ▶", onClick }) {
  return (
    <div className="dc-widget-actions">
      <button
        type="button"
        className="dc-commit-btn"
        disabled={disabled || submitting}
        onClick={onClick}
      >
        {submitting ? "Submitting…" : label}
      </button>
    </div>
  );
}

// ── PromptCard ────────────────────────────────────────────────
/**
 * Shown at the top of every widget when the organizer has supplied source
 * texts / utterance prompts via the competition_prompts table.
 *
 * Props
 *   prompt        — { id, content, difficulty?, domain?, target_emotion? }
 *   loading       — true while DataCollection is fetching the next prompt
 *   onUse         — called with the prompt content when the contributor
 *                   clicks "Use this text" (text widgets pre-fill their textarea)
 *                   Pass null for audio widgets (they don't need pre-fill).
 *   label         — overrides the default "SOURCE TEXT" header badge text
 *   hint          — short instruction shown below the prompt content
 */
export function PromptCard({ prompt, loading, onUse = null, label = "SOURCE TEXT", hint }) {
  if (loading) {
    return (
      <div className="audio-prompt-card" style={{ opacity: 0.6 }}>
        <span className="audio-prompt-label">Loading prompt…</span>
        <p className="audio-prompt-text" style={{ color: "#9ca3af" }}>⟳ Fetching next item from the organizer's dataset…</p>
      </div>
    );
  }

  if (!prompt) return null;

  const meta = [
    prompt.difficulty && `Difficulty: ${prompt.difficulty}`,
    prompt.domain     && `Domain: ${prompt.domain}`,
    prompt.target_emotion && `Target emotion: ${prompt.target_emotion.toUpperCase()}`,
  ].filter(Boolean);

  return (
    <div className="audio-prompt-card" style={{ marginBottom: 16 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
        <span className="audio-prompt-label">{label}</span>
        <span style={{ fontSize: 10, color: "#9ca3af", fontFamily: "monospace" }}>
          ID {String(prompt.id).slice(0, 8).toUpperCase()}
        </span>
      </div>

      <p className="audio-prompt-text">"{prompt.content}"</p>

      <div className="audio-prompt-meta" style={{ marginTop: 8, alignItems: "center" }}>
        {meta.length > 0 && (
          <span style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {meta.map((m, i) => (
              <span key={i} style={{
                fontSize: 10, background: "#eff6ff", color: "#1d4ed8",
                border: "1px solid #bfdbfe", borderRadius: 4, padding: "1px 6px",
                fontWeight: 600,
              }}>{m}</span>
            ))}
          </span>
        )}
        {hint && <span style={{ fontSize: 11, color: "#9ca3af" }}>{hint}</span>}
        {onUse && (
          <button
            type="button"
            className="dc-label-tag active"
            style={{ marginLeft: "auto", fontSize: 11, padding: "4px 12px" }}
            onClick={() => onUse(prompt.content)}
          >
            ↓ Use this text
          </button>
        )}
      </div>
    </div>
  );
}

// ── useAudioRecorder hook (shared by audio widgets) ───────────
export function useAudioRecorder() {
  const [recording, setRecording] = useState(false);
  const [audioBlob, setAudioBlob] = useState(null);
  const [audioUrl,  setAudioUrl]  = useState(null);
  const [duration,  setDuration]  = useState(0);
  const [amplitude, setAmplitude] = useState(Array(24).fill(4));

  const mediaRef  = useRef(null);
  const chunksRef = useRef([]);
  const timerRef  = useRef(null);
  const animRef   = useRef(null);

  const start = async () => {
    try {
      const stream   = await navigator.mediaDevices.getUserMedia({ audio: true });
      const ctx      = new AudioContext();
      const src      = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 64;
      src.connect(analyser);

      const mr = new MediaRecorder(stream);
      mediaRef.current  = mr;
      chunksRef.current = [];
      mr.ondataavailable = (e) => chunksRef.current.push(e.data);
      mr.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: "audio/wav" });
        setAudioBlob(blob);
        setAudioUrl(URL.createObjectURL(blob));
        stream.getTracks().forEach((t) => t.stop());
        cancelAnimationFrame(animRef.current);
      };
      mr.start();
      setRecording(true);
      setDuration(0);
      timerRef.current = setInterval(
        () => setDuration((d) => +(d + 0.1).toFixed(1)), 100
      );
      const tick = () => {
        const data = new Uint8Array(analyser.frequencyBinCount);
        analyser.getByteFrequencyData(data);
        setAmplitude(
          Array.from(data.slice(0, 24)).map((v) => Math.max(4, (v / 255) * 68))
        );
        animRef.current = requestAnimationFrame(tick);
      };
      tick();
    } catch {
      alert("Microphone access is required.");
    }
  };

  const stop = () => {
    mediaRef.current?.stop();
    clearInterval(timerRef.current);
    setRecording(false);
  };

  const reset = () => {
    setAudioBlob(null);
    setAudioUrl(null);
    setDuration(0);
    setAmplitude(Array(24).fill(4));
  };

  const fmt = (s) =>
    `${Math.floor(s / 60).toString().padStart(2, "0")}:${(s % 60)
      .toFixed(1)
      .padStart(4, "0")}`;

  return { recording, audioBlob, audioUrl, duration, amplitude, start, stop, reset, fmt };
}

// ── Waveform display ──────────────────────────────────────────
export function Waveform({ amplitude, recording }) {
  return (
    <div className="audio-waveform">
      {amplitude.map((h, i) => (
        <div
          key={i}
          className={`audio-bar ${recording ? "active" : ""} ${
            i === 11 || i === 12 ? "accent" : ""
          }`}
          style={{ height: `${h}px` }}
        />
      ))}
    </div>
  );
}