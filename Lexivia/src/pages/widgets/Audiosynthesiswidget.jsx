/**
 * widgets/AudioSynthesisWidget.jsx
 *
 * task_type: AUDIO_SYNTHESIS
 *
 * Contributor reads a prompt aloud and submits a WAV recording.
 * Prompts are now managed by DataCollection and rotated after each submit
 * via the shared /prompts/next endpoint. This widget is purely presentational:
 * it receives `prompt` as a prop and never fetches from the API itself.
 */
import { useAudioRecorder, Waveform, CommitRow } from "./shared";

export default function AudioSynthesisWidget({ competition, config, prompt, promptLoading, onSubmit, submitting }) {
  const { recording, audioBlob, audioUrl, duration, amplitude, start, stop, reset, fmt } =
    useAudioRecorder();

  const handleSubmit = () => {
    if (!audioBlob || !prompt) return;
    onSubmit({
      audio_blob: audioBlob,
      audio_duration: duration,
      annotation: {
        transcript: prompt.content,
        prompt_id: prompt.id,
        duration,
        sample_rate: 48000,
      },
    });
    reset();
  };

  return (
    <div className="dc-widget">
      {/* Prompt card */}
      {promptLoading ? (
        <div className="audio-prompt-card" style={{ opacity: 0.6 }}>
          <span className="audio-prompt-label">Loading prompt…</span>
          <p className="audio-prompt-text" style={{ color: "#9ca3af" }}>
            ⟳ Fetching next utterance from the organizer's dataset…
          </p>
        </div>
      ) : prompt ? (
        <div className="audio-prompt-card">
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
            <span className="audio-prompt-label">TARGET STIMULUS</span>
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
            {prompt.domain && (
              <span style={{ fontSize: 10, background: "#f0fdf4", color: "#166534",
                border: "1px solid #bbf7d0", borderRadius: 4, padding: "1px 6px", fontWeight: 600 }}>
                {prompt.domain}
              </span>
            )}
            <span>⏱ Read at natural pace</span>
          </div>
        </div>
      ) : (
        <div className="audio-prompt-card" style={{ borderStyle: "dashed" }}>
          <span className="audio-prompt-label">NO PROMPTS CONFIGURED</span>
          <p className="audio-prompt-text" style={{ color: "#9ca3af" }}>
            The organizer has not added any prompts yet. Contact the competition organizer.
          </p>
        </div>
      )}

      <div className="audio-recorder">
        <div className="audio-status-bar">
          <div className="audio-input-dot">
            <span className={`input-dot ${recording ? "live" : ""}`} />
            <span>{recording ? "Recording…" : audioBlob ? "Recorded ✓" : "Ready"}</span>
          </div>
          <div className="audio-format-tags">
            <span>PCM</span><span>48KHZ</span><span>24-BIT</span>
          </div>
        </div>

        <Waveform amplitude={amplitude} recording={recording} />

        <div className="audio-controls">
          <button
            type="button"
            className="audio-ctrl-btn"
            onClick={reset}
            disabled={recording || !audioBlob}
            title="Re-record"
          >↺</button>
          <button
            type="button"
            className={`audio-record-btn ${recording ? "stop" : ""}`}
            onClick={recording ? stop : start}
            disabled={submitting || !prompt}
          >
            {recording ? "■" : "●"}
          </button>
          {audioUrl && <audio src={audioUrl} controls className="audio-playback" />}
        </div>

        <div className="audio-timer">{fmt(duration)} / 06:40</div>
      </div>

      <CommitRow
        disabled={!audioBlob || !prompt}
        submitting={submitting}
        label="▶ Commit Recording"
        onClick={handleSubmit}
      />
    </div>
  );
}