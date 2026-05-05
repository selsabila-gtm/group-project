/**
 * widgets/AudioTranscriptionWidget.jsx
 *
 * task_type: AUDIO_TRANSCRIPTION
 *
 * Contributor either uploads a pre-existing audio file OR records live,
 * then types the verbatim transcript. Supports optional speaker diarization
 * and timestamp markers.
 */
import { useRef, useState } from "react";
import { useAudioRecorder, Waveform, CommitRow } from "./shared";

export default function AudioTranscriptionWidget({ competition, config, onSubmit, submitting }) {
  const speakers       = config?.speakers       || 1;
  const withTimestamps = config?.with_timestamps || false;

  const { recording, audioBlob, audioUrl, duration, amplitude, start, stop, reset, fmt } =
    useAudioRecorder();

  const [uploadedFile,  setUploadedFile]  = useState(null);
  const [uploadedUrl,   setUploadedUrl]   = useState(null);
  const [transcript,    setTranscript]    = useState("");
  const [inputMode,     setInputMode]     = useState("record"); // record | upload
  const [speakerLabels, setSpeakerLabels] = useState({}); // lineIndex → speaker ID
  const fileRef = useRef(null);

  const activeAudioUrl = inputMode === "upload" ? uploadedUrl : audioUrl;
  const activeBlob     = inputMode === "upload" ? uploadedFile : audioBlob;

  const handleFileSelect = (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setUploadedFile(f);
    setUploadedUrl(URL.createObjectURL(f));
  };

  const handleSubmit = () => {
    if (!activeBlob || !transcript.trim()) return;
    onSubmit({
      audio_blob: activeBlob instanceof File ? activeBlob : activeBlob,
      audio_duration: duration,
      annotation: {
        transcript,
        speaker_count: speakers,
        speaker_labels: speakers > 1 ? speakerLabels : undefined,
        with_timestamps: withTimestamps,
      },
    });
    reset();
    setTranscript("");
    setUploadedFile(null);
    setUploadedUrl(null);
  };

  const wordCount = transcript.trim() ? transcript.trim().split(/\s+/).length : 0;

  return (
    <div className="dc-widget">
      {/* Widget title */}
      <div className="dc-widget-header">
        <div className="dc-doc-badge">
          <span className="dc-doc-icon">◉</span>
          <span>AUDIO TRANSCRIPTION</span>
        </div>
        <div style={{ display: "flex", gap: 6 }}>
          {speakers > 1 && (
            <span className="dc-lang-tag">{speakers} speakers</span>
          )}
          <span className="dc-lang-tag">{fmt(duration)}</span>
        </div>
      </div>

      {/* Mode tabs */}
      <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
        {["record", "upload"].map((m) => (
          <button
            key={m}
            type="button"
            className={`dc-label-tag ${inputMode === m ? "active" : ""}`}
            onClick={() => { setInputMode(m); reset(); setUploadedFile(null); setUploadedUrl(null); }}
          >
            {m === "record" ? "🎙 Record Live" : "📁 Upload File"}
          </button>
        ))}
      </div>

      {/* Audio input area */}
      {inputMode === "record" ? (
        <div className="audio-recorder">
          <div className="audio-status-bar">
            <div className="audio-input-dot">
              <span className={`input-dot ${recording ? "live" : ""}`} />
              <span>{recording ? "Recording…" : audioBlob ? "Recorded ✓" : "Ready to record"}</span>
            </div>
            <div className="audio-format-tags">
              <span>PCM</span><span>48KHZ</span>
            </div>
          </div>
          <Waveform amplitude={amplitude} recording={recording} />
          <div className="audio-controls">
            <button type="button" className="audio-ctrl-btn" onClick={reset} disabled={recording || !audioBlob} title="Re-record">↺</button>
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
      ) : (
        <div>
          <div
            className="bulk-drop-zone"
            style={{ padding: "18px", marginBottom: 12 }}
            onClick={() => fileRef.current?.click()}
          >
            <div className="bulk-icon">◉</div>
            <p className="bulk-drop-title">
              {uploadedFile ? uploadedFile.name : "Upload Audio File"}
            </p>
            <p className="bulk-drop-sub">WAV, MP3, M4A, FLAC — up to 2 GB</p>
            <input
              ref={fileRef}
              type="file"
              hidden
              accept="audio/*"
              onChange={handleFileSelect}
            />
          </div>
          {uploadedUrl && <audio src={uploadedUrl} controls style={{ width: "100%" }} />}
        </div>
      )}

      {/* Transcript */}
      {(activeBlob || inputMode === "upload") && (
        <>
          <label className="dc-field-label" style={{ marginTop: 14 }}>
            VERBATIM TRANSCRIPT
          </label>
          {withTimestamps ? (
            <div style={{ fontFamily: "monospace", fontSize: 12 }}>
              <p style={{ color: "#9ca3af", marginBottom: 6, fontSize: 11 }}>
                Format: [MM:SS] Spoken text here
              </p>
              <textarea
                className="dc-textarea"
                placeholder={"[00:00] Hello, welcome to...\n[00:05] Today we will discuss..."}
                value={transcript}
                onChange={(e) => setTranscript(e.target.value)}
                rows={8}
                style={{ fontFamily: "monospace", fontSize: 13 }}
              />
            </div>
          ) : (
            <textarea
              className="dc-textarea"
              placeholder="Type the verbatim transcript of the audio…"
              value={transcript}
              onChange={(e) => setTranscript(e.target.value)}
              rows={7}
            />
          )}
          <div className="dc-textarea-footer">
            <span>{wordCount} words transcribed</span>
            {duration > 0 && wordCount > 0 && (
              <span>{Math.round(wordCount / (duration / 60))} words/min</span>
            )}
          </div>
        </>
      )}

      <CommitRow
        disabled={!activeBlob || !transcript.trim()}
        submitting={submitting}
        label="▶ Commit Transcript"
        onClick={handleSubmit}
      />
    </div>
  );
}