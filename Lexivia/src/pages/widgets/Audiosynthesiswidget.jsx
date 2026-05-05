/**
 * widgets/AudioSynthesisWidget.jsx
 *
 * task_type: AUDIO_SYNTHESIS
 *
 * Contributor reads a prompt aloud and submits a WAV recording.
 * Prompts are rotated via /competitions/:id/prompts/next.
 */
import { useCallback, useEffect } from "react";
import { useAudioRecorder, Waveform, CommitRow } from "./shared";

const API = "http://127.0.0.1:8000";
function authHeader() {
  const t = localStorage.getItem("token");
  return t ? { Authorization: `Bearer ${t}` } : {};
}

export default function AudioSynthesisWidget({ competition, config, onSubmit, submitting }) {
  const { recording, audioBlob, audioUrl, duration, amplitude, start, stop, reset, fmt } =
    useAudioRecorder();

  // Prompt state lifted locally so reset works cleanly
  const [prompt, setPrompt] = [
    competition._prompt || null,
    (p) => { competition._prompt = p; },
  ];

  const loadPrompt = useCallback((compId) => {
    fetch(`${API}/competitions/${compId}/prompts/next`, { headers: authHeader() })
      .then((r) => r.json())
      .then((p) => {
        // Hacky way to share prompt — in real app use prop/state at parent
        competition._prompt = p;
        // Force re-render via a dummy state trigger not available here —
        // parent DataCollection passes competition as mutable; widget re-mounts on next submit.
      })
      .catch(() => {
        competition._prompt = {
          id: "FALLBACK",
          content:
            "The geometric precision of the algorithm allows for instantaneous detection of phonetic anomalies in complex synthetic environments.",
        };
      });
  }, []);

  useEffect(() => {
    if (!competition._prompt) loadPrompt(competition.id);
  }, [competition.id, loadPrompt]);

  const currentPrompt = competition._prompt;

  const handleSubmit = () => {
    if (!audioBlob || !currentPrompt) return;
    onSubmit({
      audio_blob: audioBlob,
      audio_duration: duration,
      annotation: {
        transcript: currentPrompt.content,
        prompt_id: currentPrompt.id,
        duration,
        sample_rate: 48000,
      },
    });
    reset();
    competition._prompt = null;
    loadPrompt(competition.id);
  };

  return (
    <div className="dc-widget">
      {/* Prompt card */}
      {currentPrompt && (
        <div className="audio-prompt-card">
          <span className="audio-prompt-label">TARGET STIMULUS</span>
          <p className="audio-prompt-text">"{currentPrompt.content}"</p>
          <div className="audio-prompt-meta">
            <span>⏱ Read at natural pace</span>
            <span>Prompt ID: {String(currentPrompt.id).slice(0, 8).toUpperCase()}</span>
          </div>
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
            disabled={submitting}
          >
            {recording ? "■" : "●"}
          </button>
          {audioUrl && <audio src={audioUrl} controls className="audio-playback" />}
        </div>

        <div className="audio-timer">{fmt(duration)} / 06:40</div>
      </div>

      <CommitRow
        disabled={!audioBlob}
        submitting={submitting}
        label="▶ Commit Recording"
        onClick={handleSubmit}
      />
    </div>
  );
}