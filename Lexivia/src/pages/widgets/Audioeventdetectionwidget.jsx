/**
 * widgets/AudioEventDetectionWidget.jsx
 *
 * task_type: AUDIO_EVENT_DETECTION
 *
 * Contributor uploads or records audio, then marks events on a
 * simple timeline by clicking "Mark Start" / "Mark End" while
 * the audio plays, assigning an event type to each segment.
 * Event types from config.event_types.
 */
import { useRef, useState } from "react";
import { useAudioRecorder, Waveform, CommitRow } from "./shared";

const EVENT_COLORS = {
  speech:    "#3b82f6",
  music:     "#8b5cf6",
  noise:     "#f59e0b",
  silence:   "#9ca3af",
  applause:  "#10b981",
  laughter:  "#ec4899",
  alarm:     "#ef4444",
  animal:    "#f97316",
};

export default function AudioEventDetectionWidget({ competition, config, onSubmit, submitting }) {
  const eventTypes = config?.event_types || ["speech", "music", "noise", "silence", "applause", "laughter", "alarm"];

  const { recording, audioBlob, audioUrl, duration, amplitude, start, stop, reset, fmt } =
    useAudioRecorder();

  const [uploadedUrl, setUploadedUrl]   = useState(null);
  const [uploadedFile, setUploadedFile] = useState(null);
  const [inputMode, setInputMode]       = useState("record");
  const [events, setEvents]             = useState([]);
  const [activeType, setActiveType]     = useState(eventTypes[0]);
  const [markStart, setMarkStart]       = useState(null);
  const [currentTime, setCurrentTime]  = useState(0);

  const audioRef  = useRef(null);
  const fileRef   = useRef(null);

  const activeUrl  = inputMode === "upload" ? uploadedUrl  : audioUrl;
  const activeBlob = inputMode === "upload" ? uploadedFile : audioBlob;
  const totalDur   = inputMode === "upload"
    ? (audioRef.current?.duration || 0)
    : duration;

  const handleFileSelect = (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setUploadedFile(f);
    setUploadedUrl(URL.createObjectURL(f));
    setEvents([]);
  };

  const handleMarkStart = () => {
    const t = audioRef.current?.currentTime ?? 0;
    setMarkStart(t);
  };

  const handleMarkEnd = () => {
    if (markStart === null) return;
    const t = audioRef.current?.currentTime ?? 0;
    if (t <= markStart) return;
    setEvents((prev) => [
      ...prev,
      { id: Date.now(), start_time: +markStart.toFixed(2), end_time: +t.toFixed(2), label: activeType },
    ]);
    setMarkStart(null);
  };

  const removeEvent = (id) => setEvents((e) => e.filter((ev) => ev.id !== id));

  const totalAudioDuration = audioRef.current?.duration || totalDur || 1;

  const handleSubmit = () => {
    if (!activeBlob || !events.length) return;
    onSubmit({
      audio_blob: activeBlob,
      audio_duration: totalAudioDuration,
      annotation: {
        events: events.map(({ id, ...e }) => e),
        event_count: events.length,
      },
    });
    reset();
    setEvents([]);
    setUploadedFile(null);
    setUploadedUrl(null);
  };

  return (
    <div className="dc-widget">
      <div className="dc-widget-header">
        <div className="dc-doc-badge">
          <span className="dc-doc-icon">▣</span>
          <span>AUDIO EVENT DETECTION</span>
        </div>
        <span className="dc-lang-tag">{events.length} events tagged</span>
      </div>

      {/* Mode selector */}
      <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
        {["record", "upload"].map((m) => (
          <button
            key={m}
            type="button"
            className={`dc-label-tag ${inputMode === m ? "active" : ""}`}
            onClick={() => {
              setInputMode(m); reset();
              setUploadedFile(null); setUploadedUrl(null); setEvents([]);
            }}
          >
            {m === "record" ? "🎙 Record" : "📁 Upload"}
          </button>
        ))}
      </div>

      {/* Record or upload */}
      {inputMode === "record" && !audioBlob && (
        <div className="audio-recorder">
          <div className="audio-status-bar">
            <div className="audio-input-dot">
              <span className={`input-dot ${recording ? "live" : ""}`} />
              <span>{recording ? "Recording…" : "Ready"}</span>
            </div>
          </div>
          <Waveform amplitude={amplitude} recording={recording} />
          <div className="audio-controls">
            <button type="button" className={`audio-record-btn ${recording ? "stop" : ""}`}
              onClick={recording ? stop : start}>
              {recording ? "■" : "●"}
            </button>
          </div>
        </div>
      )}

      {inputMode === "upload" && !uploadedUrl && (
        <div className="bulk-drop-zone" onClick={() => fileRef.current?.click()} style={{ padding: 18, marginBottom: 12 }}>
          <div className="bulk-icon">▣</div>
          <p className="bulk-drop-title">Upload Audio for Event Detection</p>
          <p className="bulk-drop-sub">WAV, MP3, FLAC, MP4 — any duration</p>
          <input ref={fileRef} type="file" hidden accept="audio/*,video/mp4" onChange={handleFileSelect} />
        </div>
      )}

      {/* Playback + timeline controls */}
      {activeUrl && (
        <>
          <audio
            ref={audioRef}
            src={activeUrl}
            controls
            style={{ width: "100%", marginBottom: 12 }}
            onTimeUpdate={() => setCurrentTime(audioRef.current?.currentTime || 0)}
          />

          {/* Event type selector */}
          <p className="dc-field-label">EVENT TYPE</p>
          <div className="dc-label-row" style={{ marginBottom: 14 }}>
            {eventTypes.map((t) => (
              <button
                key={t}
                type="button"
                className="dc-label-tag"
                style={activeType === t ? {
                  background: `${EVENT_COLORS[t] || "#6b7280"}22`,
                  border: `1.5px solid ${EVENT_COLORS[t] || "#6b7280"}`,
                  color: EVENT_COLORS[t] || "#374151",
                } : {}}
                onClick={() => setActiveType(t)}
              >
                {t.toUpperCase()}
              </button>
            ))}
          </div>

          {/* Mark buttons */}
          <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 14 }}>
            <button
              type="button"
              className="dc-label-tag"
              onClick={handleMarkStart}
              style={markStart !== null ? { background: "#dcfce7", border: "1.5px solid #16a34a", color: "#15803d" } : {}}
            >
              {markStart !== null ? `▶ Started @ ${markStart.toFixed(1)}s` : "▶ Mark Start"}
            </button>
            <button
              type="button"
              className="dc-label-tag active"
              onClick={handleMarkEnd}
              disabled={markStart === null}
            >
              ■ Mark End
            </button>
            <span style={{ fontSize: 11, color: "#9ca3af" }}>
              Now: {currentTime.toFixed(1)}s
            </span>
          </div>

          {/* Visual timeline */}
          <div style={{
            position: "relative", height: 48, background: "#f7f8fc",
            borderRadius: 8, border: "1px solid #e8edf8", marginBottom: 14, overflow: "hidden",
          }}>
            {/* Playhead */}
            <div style={{
              position: "absolute", top: 0, bottom: 0, width: 2, background: "#1359db",
              left: `${(currentTime / Math.max(totalAudioDuration, 1)) * 100}%`,
              transition: "left 0.1s",
            }} />
            {/* Event spans */}
            {events.map((ev) => (
              <div
                key={ev.id}
                title={`${ev.label}: ${ev.start_time}s – ${ev.end_time}s`}
                style={{
                  position: "absolute", top: 8, bottom: 8, borderRadius: 4,
                  background: `${EVENT_COLORS[ev.label] || "#6b7280"}55`,
                  border: `1.5px solid ${EVENT_COLORS[ev.label] || "#6b7280"}`,
                  left: `${(ev.start_time / Math.max(totalAudioDuration, 1)) * 100}%`,
                  width: `${((ev.end_time - ev.start_time) / Math.max(totalAudioDuration, 1)) * 100}%`,
                  minWidth: 4,
                }}
              />
            ))}
          </div>

          {/* Event list */}
          {events.length > 0 && (
            <div>
              <p className="dc-field-label">TAGGED EVENTS</p>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {events.map((ev) => (
                  <div key={ev.id} style={{
                    display: "flex", alignItems: "center", gap: 10,
                    padding: "7px 12px", background: "#f7f8fc", borderRadius: 8,
                    border: "1px solid #e8edf8", fontSize: 12,
                  }}>
                    <span style={{
                      width: 10, height: 10, borderRadius: 3, flexShrink: 0,
                      background: EVENT_COLORS[ev.label] || "#9ca3af",
                    }} />
                    <span style={{ fontWeight: 700 }}>{ev.label.toUpperCase()}</span>
                    <span style={{ color: "#6f778c" }}>{ev.start_time}s → {ev.end_time}s</span>
                    <span style={{ color: "#9ca3af" }}>({(ev.end_time - ev.start_time).toFixed(1)}s)</span>
                    <button
                      type="button"
                      onClick={() => removeEvent(ev.id)}
                      style={{ marginLeft: "auto", border: "none", background: "transparent",
                        color: "#ef4444", cursor: "pointer", fontSize: 14, padding: "0 4px" }}
                    >×</button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      <CommitRow
        disabled={!activeBlob || !events.length}
        submitting={submitting}
        label="▶ Commit Event Annotations"
        onClick={handleSubmit}
      />
    </div>
  );
}