/**
 * widgets/BulkImportPanel.jsx
 *
 * Drag-and-drop / browse bulk import for .csv, .jsonl, .wav files.
 * Used across all task types via the Bulk Import tab.
 */
import { useState } from "react";

const API = "http://127.0.0.1:8000";
function authHeader() {
  const t = localStorage.getItem("token");
  return t ? { Authorization: `Bearer ${t}` } : {};
}

const ACCEPT_BY_TASK = {
  AUDIO_SYNTHESIS:       ".wav,.mp3,.flac",
  AUDIO_TRANSCRIPTION:   ".wav,.mp3,.flac,.csv,.jsonl",
  SPEECH_EMOTION:        ".wav,.mp3,.csv,.jsonl",
  AUDIO_EVENT_DETECTION: ".wav,.mp3,.csv,.jsonl",
  default:               ".csv,.jsonl,.txt",
};

export default function BulkImportPanel({ competitionId, taskType }) {
  const [files,      setFiles]      = useState([]);
  const [progress,   setProgress]   = useState(0);
  const [uploading,  setUploading]  = useState(false);
  const [result,     setResult]     = useState(null);

  const acceptStr = ACCEPT_BY_TASK[taskType] || ACCEPT_BY_TASK.default;

  const handleDrop = (e) => {
    e.preventDefault();
    setFiles(Array.from(e.dataTransfer.files));
    setResult(null);
  };

  const handleFileChange = (e) => {
    setFiles(Array.from(e.target.files));
    setResult(null);
  };

  const handleUpload = async () => {
    if (!files.length) return;
    setUploading(true);
    setResult(null);

    const fd = new FormData();
    files.forEach((f) => fd.append("files", f));

    try {
      // Simulated progress feedback
      for (let i = 0; i <= 80; i += 20) {
        await new Promise((r) => setTimeout(r, 150));
        setProgress(i);
      }
      const res = await fetch(`${API}/competitions/${competitionId}/samples/bulk`, {
        method: "POST",
        body: fd,
        headers: authHeader(),
      });
      setProgress(100);
      const data = await res.json();
      setResult(data);
      setFiles([]);
    } catch (e) {
      setResult({ error: String(e) });
    } finally {
      setUploading(false);
      setTimeout(() => setProgress(0), 1200);
    }
  };

  return (
    <div className="dc-widget">
      <div className="dc-widget-header">
        <div className="dc-doc-badge">
          <span className="dc-doc-icon">⊕</span>
          <span>BULK IMPORT</span>
        </div>
        <span className="dc-lang-tag">accepts {acceptStr}</span>
      </div>

      <div
        className="bulk-drop-zone"
        onDragOver={(e) => e.preventDefault()}
        onDrop={handleDrop}
      >
        <div className="bulk-icon">⊕</div>
        <p className="bulk-drop-title">Batch Import</p>
        <p className="bulk-drop-sub">
          Drop {acceptStr} files here, or browse to select
        </p>
        <p className="bulk-file-count">
          {files.length > 0 ? `${files.length} file(s) selected` : "0 files selected"}
        </p>
        <label className="bulk-browse-btn">
          Browse Files
          <input
            type="file"
            multiple
            hidden
            accept={acceptStr}
            onChange={handleFileChange}
          />
        </label>
      </div>

      {files.length > 0 && (
        <div className="bulk-file-list">
          {files.map((f, i) => (
            <div key={i} className="bulk-file-row">
              <span>📄</span>
              <span className="bulk-file-name">{f.name}</span>
              <span className="bulk-file-size">{(f.size / 1024).toFixed(1)} KB</span>
            </div>
          ))}

          {uploading && progress > 0 && (
            <div className="bulk-progress">
              <div className="bulk-progress-fill" style={{ width: `${progress}%` }} />
            </div>
          )}

          <div className="dc-widget-actions" style={{ marginTop: 10 }}>
            <button
              type="button"
              className="dc-commit-btn"
              onClick={handleUpload}
              disabled={uploading}
            >
              {uploading ? `Uploading… ${progress}%` : `Upload ${files.length} File(s)`}
            </button>
          </div>
        </div>
      )}

      {result && !result.error && (
        <div style={{
          marginTop: 14, padding: "12px 16px", borderRadius: 10,
          background: "#dcfce7", border: "1px solid #86efac",
        }}>
          <p style={{ margin: 0, fontWeight: 700, color: "#15803d", fontSize: 13 }}>
            ✓ Import complete — {result.inserted} inserted, {result.rejected} rejected
          </p>
        </div>
      )}

      {result?.error && (
        <div style={{
          marginTop: 14, padding: "12px 16px", borderRadius: 10,
          background: "#fee2e2", border: "1px solid #fca5a5",
        }}>
          <p style={{ margin: 0, fontWeight: 700, color: "#b91c1c", fontSize: 13 }}>
            ⚠ Upload failed: {result.error}
          </p>
        </div>
      )}
    </div>
  );
}