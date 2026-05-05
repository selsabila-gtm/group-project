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