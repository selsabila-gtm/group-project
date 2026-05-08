/**
 * widgets/SpeechEmotionWidget.jsx
 *
 * task_type: SPEECH_EMOTION
 *
 * Contributor reads a scripted utterance with a target emotion or records a
 * spontaneous sample, then annotates the emotion, intensity, arousal, and
 * valence dimensions.
 *
 * Prompt lifecycle is now managed by DataCollection: the current prompt is
 * passed as a prop and rotated automatically after each successful submit.
 * Emotion labels come from config.emotion_labels (organizer-configured).
 */
import { useState } from "react";
import { useAudioRecorder, Waveform, CommitRow } from "./shared";

const EMOTION_META = {
  neutral:   { icon: "😐", color: "#6b7280", bg: "#f3f4f6" },
  happy:     { icon: "😊", color: "#15803d", bg: "#dcfce7" },
  sad:       { icon: "😢", color: "#1d4ed8", bg: "#dbeafe" },
  angry:     { icon: "😠", color: "#b91c1c", bg: "#fee2e2" },
  surprised: { icon: "😲", color: "#9333ea", bg: "#f3e8ff" },
  fearful:   { icon: "😨", color: "#0369a1", bg: "#e0f2fe" },
  disgusted: { icon: "🤢", color: "#65a30d", bg: "#ecfccb" },
  contempt:  { icon: "😒", color: "#92400e", bg: "#fef3c7" },
};

export default function SpeechEmotionWidget({ competition, config, prompt, promptLoading, onSubmit, submitting }) {
  // Labels come from the organizer's config; fall back to defaults if not set
  const emotionLabels = config?.emotion_labels || Object.keys(EMOTION_META);

  const { recording, audioBlob, audioUrl, duration, amplitude, start, stop, reset, fmt } =
    useAudioRecorder();

  const [emotion,   setEmotion]   = useState("");
  const [intensity, setIntensity] = useState(60);
  const [arousal,   setArousal]   = useState(50);
  const [valence,   setValence]   = useState(50);

  const handleSubmit = () => {
    if (!audioBlob || !emotion) return;
    onSubmit({
      audio_blob: audioBlob,
      audio_duration: duration,
      annotation: {
        emotion,
        intensity: intensity / 100,
        arousal: arousal / 100,
        valence: valence / 100,
        prompt_id: prompt?.id ?? null,
        transcript: prompt?.content ?? null,
      },
    });
    reset();
    setEmotion(""); setIntensity(60); setArousal(50); setValence(50);
  };

  const targetEmotion = prompt?.target_emotion;

  return (
    <div className="dc-widget">
      <div className="dc-widget-header">
        <div className="dc-doc-badge">
          <span className="dc-doc-icon">◕</span>
          <span>SPEECH EMOTION</span>
        </div>
        <span className="dc-lang-tag">{fmt(duration)}</span>
      </div>

      {/* Utterance prompt from organizer */}
      {promptLoading ? (
        <div className="audio-prompt-card" style={{ marginBottom: 16, opacity: 0.6 }}>
          <span className="audio-prompt-label">Loading prompt…</span>
          <p className="audio-prompt-text" style={{ color: "#9ca3af" }}>
            ⟳ Fetching next utterance…
          </p>
        </div>
      ) : prompt ? (
        <div className="audio-prompt-card" style={{ marginBottom: 16 }}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
            <span className="audio-prompt-label">
              UTTERANCE PROMPT
              {targetEmotion && (
                <span style={{ marginLeft: 10, color: EMOTION_META[targetEmotion]?.color || "#555", fontWeight: 700 }}>
                  · Target: {targetEmotion.toUpperCase()}
                </span>
              )}
            </span>
            <span style={{ fontSize: 10, color: "#9ca3af", fontFamily: "monospace" }}>
              ID {String(prompt.id).slice(0, 8).toUpperCase()}
            </span>
          </div>
          <p className="audio-prompt-text">"{prompt.content}"</p>
          <div className="audio-prompt-meta">
            {prompt.difficulty && (
              <span style={{ fontSize: 10, background: "#eff6ff", color: "#1d4ed8",
                border: "1px solid #bfdbfe", borderRadius: 4, padding: "1px 6px", fontWeight: 600 }}>
                {prompt.difficulty}
              </span>
            )}
            <span style={{ fontSize: 11, color: "#9ca3af" }}>
              Read with the target emotion expressed naturally, at a conversational pace.
            </span>
          </div>
        </div>
      ) : (
        /* No prompts — contributor records spontaneous speech */
        <div className="audio-prompt-card" style={{ marginBottom: 16, borderStyle: "dashed" }}>
          <span className="audio-prompt-label">SPONTANEOUS RECORDING</span>
          <p className="audio-prompt-text" style={{ color: "#9ca3af" }}>
            No scripted prompts configured. Record a spontaneous utterance expressing any emotion.
          </p>
        </div>
      )}

      {/* Recorder */}
      <div className="audio-recorder">
        <div className="audio-status-bar">
          <div className="audio-input-dot">
            <span className={`input-dot ${recording ? "live" : ""}`} />
            <span>{recording ? "Recording…" : audioBlob ? "Recorded ✓" : "Ready"}</span>
          </div>
          <div className="audio-format-tags">
            <span>PCM</span><span>48KHZ</span>
          </div>
        </div>
        <Waveform amplitude={amplitude} recording={recording} />
        <div className="audio-controls">
          <button type="button" className="audio-ctrl-btn" onClick={reset} disabled={recording || !audioBlob}>↺</button>
          <button
            type="button"
            className={`audio-record-btn ${recording ? "stop" : ""}`}
            onClick={recording ? stop : start}
          >
            {recording ? "■" : "●"}
          </button>
          {audioUrl && <audio src={audioUrl} controls className="audio-playback" />}
        </div>
        <div className="audio-timer">{fmt(duration)}</div>
      </div>

      {/* Emotion selector — labels from organizer config */}
      <p className="dc-field-label" style={{ marginTop: 16 }}>EXPRESSED EMOTION</p>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        {emotionLabels.map((e) => {
          const m = EMOTION_META[e] || { icon: "◎", color: "#374151", bg: "#f9fafb" };
          return (
            <button
              key={e}
              type="button"
              onClick={() => setEmotion(e)}
              style={{
                display: "flex", alignItems: "center", gap: 6,
                padding: "8px 14px", borderRadius: 10, cursor: "pointer",
                fontFamily: "inherit", fontWeight: 700, fontSize: 12,
                background: emotion === e ? m.bg : "#f7f8fc",
                border: emotion === e ? `1.5px solid ${m.color}` : "1.5px solid #e8edf8",
                color: emotion === e ? m.color : "#6f778c",
                transition: "all 0.15s",
              }}
            >
              <span style={{ fontSize: 16 }}>{m.icon}</span>
              {e.toUpperCase()}
            </button>
          );
        })}
      </div>

      {/* Dimensional sliders */}
      {emotion && (
        <div style={{ marginTop: 16, display: "flex", flexDirection: "column", gap: 12 }}>
          {[
            { label: "INTENSITY", value: intensity, set: setIntensity, lo: "Mild",     hi: "Intense"  },
            { label: "AROUSAL",   value: arousal,   set: setArousal,   lo: "Calm",     hi: "Excited"  },
            { label: "VALENCE",   value: valence,   set: setValence,   lo: "Negative", hi: "Positive" },
          ].map(({ label, value, set, lo, hi }) => (
            <div key={label}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                <span className="dc-field-label">{label}: {value}%</span>
                <span style={{ fontSize: 10, color: "#9ca3af" }}>{lo} ← → {hi}</span>
              </div>
              <input
                type="range" min={0} max={100} value={value}
                onChange={(e) => set(Number(e.target.value))}
                style={{ width: "100%", accentColor: "#1359db" }}
              />
            </div>
          ))}
        </div>
      )}

      <CommitRow
        disabled={!audioBlob || !emotion}
        submitting={submitting}
        label="▶ Commit Emotion Sample"
        onClick={handleSubmit}
      />
    </div>
  );
}