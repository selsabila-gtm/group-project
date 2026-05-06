// components/DatasetSection.jsx
import { useState, useEffect, useRef } from "react";
import axios from "axios";
import "../Styles/DatasetSection.css";
import { supabase } from "../config/supabase"; // adjust path if needed

/** Always returns a fresh, valid access token from Supabase session */
async function getFreshToken() {
  const { data, error } = await supabase.auth.getSession();
  if (error || !data?.session?.access_token) return null;
  return data.session.access_token;
}

const API = import.meta.env.VITE_API_URL || "http://localhost:8000";

function formatBytes(bytes) {
  if (!bytes) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  let i = 0, v = bytes;
  while (v >= 1024 && i < units.length - 1) { v /= 1024; i++; }
  return `${v.toFixed(1)} ${units[i]}`;
}

const TYPE_LABELS = {
  hidden_test: {
    label: "Hidden Test",
    activeStyle: { background: "#ef4444", color: "#fff", borderColor: "transparent" },
    dotColor: "#ef4444",
    hint: "Only used for final scoring — never shown to participants.",
  },
  public_train: {
    label: "Public Train",
    activeStyle: { background: "#10b981", color: "#fff", borderColor: "transparent" },
    dotColor: "#10b981",
    hint: "Participants can download this to train their models.",
  },
 
};


/* ─── UploadedFileRow ─── */
function UploadedFileRow({ file, onDelete, token, competitionId }) {
  const [deleting, setDeleting] = useState(false);

  const handleDelete = async () => {
    if (!window.confirm(`Delete "${file.original_filename}"?`)) return;
    setDeleting(true);
    try {
      await axios.delete(
        `${API}/competitions/${competitionId}/datasets/${file.id}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      onDelete(file.id);
    } catch (e) {
      alert("Delete failed: " + (e.response?.data?.detail || e.message));
    } finally {
      setDeleting(false);
    }
  };

  const badge = TYPE_LABELS[file.dataset_type] || {
    label: file.dataset_type,
    activeStyle: { background: "#f3f4f6", color: "#4b5563", borderColor: "#e5e7eb" },
  };

  return (
    <div className="ds-file-row">
      <div className="ds-flex ds-items-center ds-gap-3 ds-min-w-0">
        <div className="ds-file-icon ds-flex-shrink-0">
          <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
              d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
        </div>
        <div className="ds-min-w-0">
          <p className="ds-file-name">{file.original_filename}</p>
          <p className="ds-file-meta">{formatBytes(file.file_size_bytes)} · {file.uploaded_at?.slice(0, 10)}</p>
        </div>
      </div>
      <div className="ds-flex ds-items-center ds-gap-3 ds-flex-shrink-0 ds-ml-4">
        <span className="ds-file-badge" style={badge.activeStyle}>{badge.label}</span>
        <button type="button" onClick={handleDelete} disabled={deleting} className="ds-del-btn" title="Delete">
          {deleting ? (
            <svg width="16" height="16" className="ds-spin" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          ) : (
            <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          )}
        </button>
      </div>
    </div>
  );
}

/* ─── Main Component ─── */
export default function DatasetSection({ competitionId }) {
  const [token, setToken] = useState(null);

  // Fetch fresh token from Supabase on mount
  useEffect(() => {
    getFreshToken().then(t => setToken(t));
  }, []);

  const [config, setConfig]                 = useState(null);
  const [loadingConfig, setLoadingConfig]   = useState(true);
  const [configError, setConfigError]       = useState(null);
  const [uploads, setUploads]               = useState([]);
  const [loadingUploads, setLoadingUploads] = useState(true);
  const [selectedType, setSelectedType]     = useState("hidden_test");
  const [description, setDescription]       = useState("");
  const [file, setFile]                     = useState(null);
  const [uploading, setUploading]           = useState(false);
  const [uploadError, setUploadError]       = useState(null);
  const [uploadSuccess, setUploadSuccess]   = useState(null);
  const [dragOver, setDragOver]             = useState(false);
  const fileRef = useRef();

  /* ── fetch dataset config ── */
  useEffect(() => {
    if (!competitionId) {
      setConfigError("No competition ID received. The draft may not have saved yet.");
      setLoadingConfig(false);
      return;
    }

    if (!token) {
      // token not loaded yet — wait for it
      return;
    }

    const url = `${API}/competitions/${competitionId}/dataset-config`;

    axios.get(url, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => {
        setConfig(r.data);
        setConfigError(null);
      })
      .catch(e => {
        setConfigError(
          e.response?.data?.detail ||
          `Request failed — status ${e.response?.status ?? "network error"}: ${e.message}`
        );
      })
      .finally(() => setLoadingConfig(false));

  }, [competitionId, token]);

  /* ── fetch uploaded datasets ── */
  useEffect(() => {
    if (!competitionId || !token) {
      setLoadingUploads(false);
      return;
    }

    const url = `${API}/competitions/${competitionId}/datasets`;

    axios.get(url, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => {
        setUploads(r.data);
      })
      .catch(e => {
        console.error("Uploads fetch failed:", e.response?.status, e.message);
        setUploads([]);
      })
      .finally(() => setLoadingUploads(false));

  }, [competitionId, token]);

  const handleDrop = e => {
    e.preventDefault();
    setDragOver(false);
    const f = e.dataTransfer.files?.[0];
    if (f) { setFile(f); setUploadError(null); setUploadSuccess(null); }
  };

  const handleUpload = async () => {
    if (!file) return;
    setUploading(true); setUploadError(null); setUploadSuccess(null);
    try {
      const form = new FormData();
      form.append("file", file);
      form.append("dataset_type", selectedType);
      form.append("description", description);
      const res = await axios.post(
        `${API}/competitions/${competitionId}/datasets`, form,
        { headers: { Authorization: `Bearer ${token}`, "Content-Type": "multipart/form-data" } }
      );
      setUploads(prev => [res.data, ...prev]);
      setUploadSuccess(`"${file.name}" uploaded successfully.`);
      setFile(null);
      setDescription("");
      if (fileRef.current) fileRef.current.value = "";
    } catch (e) {
      setUploadError(e.response?.data?.detail || "Upload failed.");
    } finally {
      setUploading(false);
    }
  };

  /* ── Loading state ── */
  if (loadingConfig) return (
    <div className="ds-root ds-loading">
      <svg width="18" height="18" className="ds-spin" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
          d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
      </svg>
      Loading dataset configuration…
    </div>
  );

  /* ── Error state — now shows the REAL error message ── */
  if (configError) return (
    <div className="ds-root">
      <div className="ds-alert error" style={{ flexDirection: "column", gap: 12 }}>
        <div style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
          <svg width="15" height="15" fill="none" viewBox="0 0 24 24" stroke="currentColor" style={{ flexShrink: 0, marginTop: 1 }}>
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span>{configError}</span>
        </div>
        {/* 🔍 DEBUG info box */}
        <pre style={{
          background: "#1e1e2e", color: "#cdd6f4", borderRadius: 6,
          padding: "10px 12px", fontSize: 11, overflowX: "auto", margin: 0
        }}>
{`competitionId : ${competitionId ?? "undefined / null"}
token exists  : ${!!token}
API           : ${API}`}
        </pre>
        <p style={{ fontSize: 12, color: "#9ca3af", margin: 0 }}>
          Check the browser console (F12) for full error details and share them so we can fix this.
        </p>
      </div>
    </div>
  );

  /* ── Main UI ── */
  return (
    <div className="ds-root ds-card ds-space-y-6" style={{ paddingBottom: 0 }}>

      {/* ── Upload panel ── */}
      <div className="ds-upload-panel">
        <p className="ds-upload-panel-title">Upload Dataset File</p>
        <p className="ds-upload-panel-sub">{config?.hidden_dataset_instructions}</p>

        {/* Type selector */}
        <div style={{ marginBottom: 16 }}>
          <label className="ds-field-label">Dataset Type</label>
          <div className="ds-type-selector">
            {Object.entries(TYPE_LABELS).map(([val, meta]) => (
              <button key={val} type="button" onClick={() => setSelectedType(val)}
                className="ds-type-btn"
                style={selectedType === val
                  ? meta.activeStyle
                  : { background: "#fff", color: "#6b7280", borderColor: "#e5e7eb" }
                }>
                <span className="ds-type-dot" style={{ background: meta.dotColor }} />
                {meta.label}
              </button>
            ))}
          </div>
          <p className="ds-type-hint">{TYPE_LABELS[selectedType].hint}</p>
        </div>

        {/* Description */}
        <div style={{ marginBottom: 16 }}>
          <label className="ds-field-label">Description (optional)</label>
          <input type="text" value={description} onChange={e => setDescription(e.target.value)}
            placeholder="e.g. 'Test set v1 — 500 samples, balanced classes'"
            className="ds-input" />
        </div>

        {/* Drop zone */}
        <div
          onDragOver={e => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          onClick={() => fileRef.current?.click()}
          className={`ds-dropzone ${dragOver ? "drag" : ""} ${file ? "has-file" : ""}`}
          style={{ marginBottom: 14 }}>
          <input ref={fileRef} type="file" style={{ display: "none" }}
            onChange={e => {
              const f = e.target.files?.[0];
              if (f) { setFile(f); setUploadError(null); setUploadSuccess(null); }
            }}
            accept={(config?.allowed_extensions ?? []).join(",")} />
          {file ? (
            <div>
              <div className="ds-dropzone-icon">
                <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="#4f46e5">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                    d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <p className="ds-dropzone-filename">{file.name}</p>
              <p className="ds-dropzone-filemeta">{formatBytes(file.size)} · click to change</p>
            </div>
          ) : (
            <div>
              <div className="ds-dropzone-icon">
                <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="#6366f1">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                    d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                </svg>
              </div>
              <p className="ds-dropzone-main"><span>Click to upload</span> or drag & drop</p>
              <p className="ds-dropzone-sub">{(config?.allowed_extensions ?? []).join(", ")}</p>
            </div>
          )}
        </div>

        {/* Upload button */}
        <button type="button" onClick={handleUpload} disabled={!file || uploading} className="ds-upload-btn">
          {uploading ? (
            <>
              <svg width="16" height="16" className="ds-spin" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              Uploading…
            </>
          ) : (
            <>
              <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
              </svg>
              Upload {TYPE_LABELS[selectedType].label} Dataset
            </>
          )}
        </button>

        {uploadError && (
          <div className="ds-alert error">
            <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" style={{ flexShrink: 0, marginTop: 1 }}>
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
            {uploadError}
          </div>
        )}
        {uploadSuccess && (
          <div className="ds-alert success">
            <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" style={{ flexShrink: 0, marginTop: 1 }}>
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            {uploadSuccess}
          </div>
        )}
      </div>

      {/* ── Uploaded files ── */}
      <div className="ds-files-section">
        <p className="ds-section-label">
          Uploaded Datasets
          {uploads.length > 0 && (
            <span style={{ marginLeft: 8, fontWeight: 400, textTransform: "none", letterSpacing: 0, color: "#c4c9d4" }}>
              ({uploads.length} file{uploads.length !== 1 ? "s" : ""})
            </span>
          )}
        </p>

        {loadingUploads ? (
          <p style={{ fontSize: 13, color: "#9ca3af", textAlign: "center", padding: "24px 0" }}>Loading…</p>
        ) : uploads.length === 0 ? (
          <div className="ds-empty">
            <p className="ds-empty-title">No datasets uploaded yet.</p>
            <p className="ds-empty-sub">Upload the hidden test set above to enable scoring.</p>
          </div>
        ) : (
          <div className="ds-space-y-2">
            {uploads.map(f => (
              <UploadedFileRow key={f.id} file={f} token={token} competitionId={competitionId}
                onDelete={id => setUploads(prev => prev.filter(u => u.id !== id))} />
            ))}
          </div>
        )}
      </div>

    </div>
  );
}
