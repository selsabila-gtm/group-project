import { useEffect, useRef, useState, useCallback } from "react";
import { useParams } from "react-router-dom";
import CompetitionSidebar from "../components/CompetitionSidebar";
import "./DataCollection.css";
import { useNavigate } from "react-router-dom";
const API = "http://127.0.0.1:8000";

function authHeader() {
    const token = localStorage.getItem("token");
    return token ? { Authorization: `Bearer ${token}` } : {};
}

// ─────────────────────────────────────────────────────────────
// Top competition bar  (title | LAB ACTIVE | Overview Rules Resources | icons)
// ─────────────────────────────────────────────────────────────
function CompetitionTopbar({ competition }) {
    return (
        <div className="comp-topbar">
            <div className="comp-topbar-left">
                <span className="comp-topbar-name">
                    {competition?.title || "…"}
                </span>
                <span className="comp-lab-badge">LAB ACTIVE</span>
                <nav className="comp-topbar-tabs">
                    {["Overview", "Rules", "Resources"].map((t, i) => (
                        <button
                            key={t}
                            type="button"
                            className={`comp-topbar-tab ${i === 0 ? "active" : ""}`}
                        >
                            {t}
                        </button>
                    ))}
                </nav>
            </div>
            <div className="comp-topbar-right">
                <button type="button" className="comp-icon-btn" title="Search">
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="11" cy="11" r="8"/>
                        <line x1="21" y1="21" x2="16.65" y2="16.65"/>
                    </svg>
                </button>
                <button type="button" className="comp-icon-btn" title="Notifications">
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
                        <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
                    </svg>
                </button>
                <div className="comp-avatar">U</div>
            </div>
        </div>
    );
}

// ─────────────────────────────────────────────────────────────
// Quality flag chip
// ─────────────────────────────────────────────────────────────
function QualityFlag({ type, detail }) {
    const isError = type === "low_domain_relevance";
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

// ─────────────────────────────────────────────────────────────
// Right panel – Team Progress
// ─────────────────────────────────────────────────────────────
function TeamProgress({ myStats, teamStats, quota }) {
    const pct = quota > 0
        ? Math.min(100, Math.round(((teamStats.total || 0) / quota) * 100))
        : 0;

    return (
        <div className="dc-right-panel">
            {/* Progress card */}
            <div className="dc-panel-card">
                <div className="dc-panel-header">
                    <span className="dc-panel-label">Team Progress</span>
                    <span className="dc-phase-badge">Phase 1</span>
                </div>

                <div className="dc-quota-row">
                    <span className="dc-quota-text">Global Quota</span>
                    <span className="dc-quota-nums">
                        {(teamStats.total || 0).toLocaleString()} /{" "}
                        {(quota || 5000).toLocaleString()}
                    </span>
                </div>
                <div className="dc-progress-bar">
                    <div className="dc-progress-fill" style={{ width: `${pct}%` }} />
                </div>

                <div className="dc-stat-row">
                    <div className="dc-stat-box">
                        <span className="dc-stat-num validated">{myStats.validated ?? 0}</span>
                        <span className="dc-stat-lbl">VALIDATED</span>
                    </div>
                    <div className="dc-stat-box">
                        <span className="dc-stat-num flagged">{myStats.flagged ?? 0}</span>
                        <span className="dc-stat-lbl">FLAGGED</span>
                    </div>
                </div>
            </div>

            {/* Team members */}
            {(teamStats.members || []).length > 0 && (
                <div className="dc-panel-card">
                    <p className="dc-panel-section-title">TEAM</p>
                    {teamStats.members.map((m) => (
                        <div key={m.id} className="dc-team-member">
                            <div className="dc-avatar">{m.initials}</div>
                            <div className="dc-member-info">
                                <span className="dc-member-name">{m.name}</span>
                                <span className="dc-member-role">{m.role}</span>
                            </div>
                            <div className="dc-member-count">
                                <span className="dc-member-total">{m.count}</span>
                                {m.today > 0 && (
                                    <span className="dc-member-today">+{m.today} today</span>
                                )}
                            </div>
                        </div>
                    ))}
                    <button type="button" className="dc-audit-link">View Audit Log</button>
                </div>
            )}

            {/* Researcher tip */}
            <div className="dc-panel-card researcher-tip">
                <span className="dc-tip-icon">◎</span>
                <div>
                    <p className="dc-tip-title">RESEARCHER TIP</p>
                    <p className="dc-tip-body">
                        Syntactic variety improves model generalization. Avoid repeating
                        the same sentence structures across multiple manual entries.
                    </p>
                </div>
            </div>
        </div>
    );
}

// ─────────────────────────────────────────────────────────────
// Widget: TEXT PROCESSING  (text classification / NER)
// ─────────────────────────────────────────────────────────────
function TextProcessingWidget({ competition, onSubmit, submitting }) {
    const labels = competition?.config?.labels || [
        "Finance", "NegativeSentiment", "Positive", "Neutral", "Mixed",
    ];
    const [text, setText]         = useState("");
    const [selected, setSelected] = useState([]);
    const [flags, setFlags]       = useState([]);

    const tokenCount = text.trim() ? text.trim().split(/\s+/).length : 0;

    useEffect(() => {
        const f = [];
        if (text.length > 20 && tokenCount < 5)
            f.push({
                type: "low_domain_relevance",
                detail: 'Text detected as "General Chat" (Confidence: 89%). Required domain: "Academic Research".',
            });
        if (text.length > 40 && tokenCount > 4)
            f.push({
                type: "lexical_overlap",
                detail: "74% similarity to existing entry #8821. Diversification recommended.",
            });
        setFlags(f);
    }, [text, tokenCount]);

    const toggleLabel = (l) =>
        setSelected((p) => p.includes(l) ? p.filter((x) => x !== l) : [...p, l]);

    const handleSubmit = () => {
        if (!text.trim() || !selected.length) return;
        onSubmit({ text_content: text, annotation: { labels: selected } });
        setText("");
        setSelected([]);
        setFlags([]);
    };

    return (
        <div className="dc-widget">
            {/* Header */}
            <div className="dc-widget-header">
                <div className="dc-doc-badge">
                    <span className="dc-doc-icon">▤</span>
                    <span>ACTIVE DOCUMENT</span>
                </div>
                <div className="dc-doc-meta">
                    <span className="dc-hash-dot" />
                    <span>Unique Hash</span>
                    <span className="dc-lang-tag">Lang: EN_US</span>
                </div>
            </div>

            {/* Text area */}
            <textarea
                className="dc-textarea"
                placeholder="Enter text task content here..."
                value={text}
                onChange={(e) => setText(e.target.value)}
                rows={8}
            />
            <div className="dc-textarea-footer">
                <span>Tokens: {tokenCount} / 50 min</span>
                <span>Characters: {text.length}</span>
            </div>

            {/* Label chips */}
            <div className="dc-label-row">
                {labels.map((l) => (
                    <button
                        key={l}
                        type="button"
                        className={`dc-label-tag ${selected.includes(l) ? "active" : ""}`}
                        onClick={() => toggleLabel(l)}
                    >
                        #{l}
                    </button>
                ))}
            </div>

            {/* QC flags */}
            {flags.length > 0 && (
                <div className="dc-qc-section">
                    <p className="dc-qc-title">QUALITY CONTROL DIAGNOSTICS</p>
                    <div className="dc-qc-flags">
                        {flags.map((f, i) => <QualityFlag key={i} {...f} />)}
                    </div>
                </div>
            )}

            <div className="dc-widget-actions">
                <button
                    type="button"
                    className="dc-commit-btn"
                    disabled={!text.trim() || !selected.length || submitting}
                    onClick={handleSubmit}
                >
                    {submitting ? "Submitting…" : "Commit Entry ▶"}
                </button>
            </div>
        </div>
    );
}

// ─────────────────────────────────────────────────────────────
// Widget: AUDIO SYNTHESIS (microphone recorder)
// ─────────────────────────────────────────────────────────────
function AudioWidget({ competition, onSubmit, submitting }) {
    const [prompt, setPrompt]       = useState(null);
    const [recording, setRecording] = useState(false);
    const [audioBlob, setAudioBlob] = useState(null);
    const [audioUrl, setAudioUrl]   = useState(null);
    const [duration, setDuration]   = useState(0);
    const [amplitude, setAmplitude] = useState(Array(24).fill(4));

    const mediaRef  = useRef(null);
    const chunksRef = useRef([]);
    const timerRef  = useRef(null);
    const animRef   = useRef(null);

    const loadPrompt = useCallback(() => {
        fetch(`${API}/competitions/${competition.id}/prompts/next`, { headers: authHeader() })
            .then((r) => r.json())
            .then(setPrompt)
            .catch(() => setPrompt({
                id: "SS-7719",
                content: "The geometric precision of the algorithm allows for instantaneous detection of phonetic anomalies in complex synthetic environments.",
            }));
    }, [competition.id]);

    useEffect(() => { loadPrompt(); }, [loadPrompt]);

    const startRecording = async () => {
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
            alert("Microphone access is required for audio collection.");
        }
    };

    const stopRecording = () => {
        mediaRef.current?.stop();
        clearInterval(timerRef.current);
        setRecording(false);
    };

    const handleReRecord = () => {
        setAudioBlob(null);
        setAudioUrl(null);
        setDuration(0);
        setAmplitude(Array(24).fill(4));
    };

    const handleSubmit = () => {
        if (!audioBlob || !prompt) return;
        onSubmit({
            audio_blob: audioBlob,
            audio_duration: duration,
            annotation: { transcript: prompt.content, prompt_id: prompt.id, duration, sample_rate: 48000 },
        });
        handleReRecord();
        loadPrompt();
    };

    const fmt = (s) =>
        `${Math.floor(s / 60).toString().padStart(2, "0")}:${(s % 60).toFixed(1).padStart(4, "0")}`;

    return (
        <div className="dc-widget">
            {prompt && (
                <div className="audio-prompt-card">
                    <span className="audio-prompt-label">TARGET STIMULUS</span>
                    <p className="audio-prompt-text">"{prompt.content}"</p>
                    <div className="audio-prompt-meta">
                        <span>⏱ Est. Duration: 6.4s</span>
                        <span>Prompt ID: {String(prompt.id).slice(0, 8).toUpperCase()}</span>
                    </div>
                </div>
            )}

            <div className="audio-recorder">
                <div className="audio-status-bar">
                    <div className="audio-input-dot">
                        <span className={`input-dot ${recording ? "live" : ""}`} />
                        <span>{recording ? "Recording…" : audioBlob ? "Recorded" : "Input Active"}</span>
                    </div>
                    <div className="audio-format-tags">
                        <span>PCM</span><span>48KHZ</span><span>24-BIT</span>
                    </div>
                </div>

                <div className="audio-waveform">
                    {amplitude.map((h, i) => (
                        <div
                            key={i}
                            className={`audio-bar ${recording ? "active" : ""} ${i === 11 || i === 12 ? "accent" : ""}`}
                            style={{ height: `${h}px` }}
                        />
                    ))}
                </div>

                <div className="audio-controls">
                    <button
                        type="button"
                        className="audio-ctrl-btn"
                        onClick={handleReRecord}
                        disabled={recording || !audioBlob}
                        title="Re-record"
                    >
                        ↺
                    </button>
                    <button
                        type="button"
                        className={`audio-record-btn ${recording ? "stop" : ""}`}
                        onClick={recording ? stopRecording : startRecording}
                        disabled={submitting}
                    >
                        {recording ? "■" : "●"}
                    </button>
                    {audioUrl && (
                        <audio src={audioUrl} controls className="audio-playback" />
                    )}
                </div>

                <div className="audio-timer">{fmt(duration)} / 06:40</div>
            </div>

            <div className="dc-widget-actions">
                <button
                    type="button"
                    className="dc-commit-btn"
                    disabled={!audioBlob || submitting}
                    onClick={handleSubmit}
                >
                    {submitting ? "Uploading…" : "▶ Commit Recording"}
                </button>
            </div>
        </div>
    );
}

// ─────────────────────────────────────────────────────────────
// Widget: TRANSLATION
// ─────────────────────────────────────────────────────────────
function TranslationWidget({ competition, onSubmit, submitting }) {
    const srcLang = competition?.config?.source_lang || "EN";
    const tgtLang = competition?.config?.target_lang || "AR";
    const [source, setSource] = useState("");
    const [target, setTarget] = useState("");
    const rtl = ["AR", "HE", "FA", "UR"].includes(tgtLang);

    const handleSubmit = () => {
        if (!source.trim() || !target.trim()) return;
        onSubmit({
            text_content: source,
            annotation: { source_lang: srcLang, target_lang: tgtLang, translation: target },
        });
        setSource(""); setTarget("");
    };

    return (
        <div className="dc-widget">
            <div className="dc-widget-header">
                <div className="dc-doc-badge">
                    <span className="dc-doc-icon">⇄</span>
                    <span>TRANSLATION PAIR</span>
                </div>
                <span className="dc-lang-tag">{srcLang} → {tgtLang}</span>
            </div>

            <div className="translation-grid">
                <div className="translation-pane">
                    <label className="dc-field-label">SOURCE — {srcLang}</label>
                    <textarea className="dc-textarea" placeholder="Enter source text…" value={source} onChange={(e) => setSource(e.target.value)} rows={7} />
                    <span className="pane-count">{source.length} chars</span>
                </div>
                <div className="translation-divider">⇄</div>
                <div className="translation-pane">
                    <label className="dc-field-label">TARGET — {tgtLang}</label>
                    <textarea className="dc-textarea" placeholder="Enter translation…" value={target} onChange={(e) => setTarget(e.target.value)} rows={7} dir={rtl ? "rtl" : "ltr"} />
                    <span className="pane-count">{target.length} chars</span>
                </div>
            </div>

            <div className="dc-widget-actions">
                <button type="button" className="dc-commit-btn" disabled={!source.trim() || !target.trim() || submitting} onClick={handleSubmit}>
                    {submitting ? "Submitting…" : "Commit Entry ▶"}
                </button>
            </div>
        </div>
    );
}

// ─────────────────────────────────────────────────────────────
// Widget: COGNITIVE LOGIC (Question Answering)
// ─────────────────────────────────────────────────────────────
function CognitiveWidget({ competition, onSubmit, submitting }) {
    const [context, setContext]   = useState("");
    const [question, setQuestion] = useState("");
    const [answer, setAnswer]     = useState("");

    const handleSubmit = () => {
        if (!context.trim() || !question.trim() || !answer.trim()) return;
        onSubmit({ text_content: context, annotation: { question, answer } });
        setContext(""); setQuestion(""); setAnswer("");
    };

    return (
        <div className="dc-widget">
            <div className="dc-widget-header">
                <div className="dc-doc-badge">
                    <span className="dc-doc-icon">◈</span>
                    <span>QA PAIR</span>
                </div>
                <span className="dc-lang-tag">Lang: EN_US</span>
            </div>

            <label className="dc-field-label">CONTEXT PASSAGE</label>
            <textarea className="dc-textarea" placeholder="Paste or write the context passage here…" value={context} onChange={(e) => setContext(e.target.value)} rows={5} />

            <div className="cognitive-row">
                <div className="cognitive-field">
                    <label className="dc-field-label">QUESTION</label>
                    <input type="text" className="dc-input" placeholder="Write your question…" value={question} onChange={(e) => setQuestion(e.target.value)} />
                </div>
                <div className="cognitive-field">
                    <label className="dc-field-label">ANSWER</label>
                    <input type="text" className="dc-input" placeholder="Write the answer…" value={answer} onChange={(e) => setAnswer(e.target.value)} />
                </div>
            </div>

            <div className="dc-widget-actions">
                <button type="button" className="dc-commit-btn" disabled={!context.trim() || !question.trim() || !answer.trim() || submitting} onClick={handleSubmit}>
                    {submitting ? "Submitting…" : "Commit Entry ▶"}
                </button>
            </div>
        </div>
    );
}

// ─────────────────────────────────────────────────────────────
// Bulk Import Panel
// ─────────────────────────────────────────────────────────────
function BulkImportPanel({ competitionId }) {
    const [files, setFiles]         = useState([]);
    const [progress, setProgress]   = useState(0);
    const [uploading, setUploading] = useState(false);

    const handleDrop = (e) => {
        e.preventDefault();
        setFiles(Array.from(e.dataTransfer.files));
    };

    const handleUpload = async () => {
        if (!files.length) return;
        setUploading(true);
        const fd = new FormData();
        files.forEach((f) => fd.append("files", f));
        try {
            for (let i = 0; i <= 100; i += 10) {
                await new Promise((r) => setTimeout(r, 120));
                setProgress(i);
            }
            await fetch(`${API}/competitions/${competitionId}/samples/bulk`, {
                method: "POST", body: fd, headers: authHeader(),
            });
            setFiles([]); setProgress(0);
        } catch (e) { console.error(e); }
        finally { setUploading(false); }
    };

    return (
        <div className="dc-widget">
            <div className="bulk-drop-zone" onDragOver={(e) => e.preventDefault()} onDrop={handleDrop}>
                <div className="bulk-icon">⊕</div>
                <p className="bulk-drop-title">Batch Import</p>
                <p className="bulk-drop-sub">Drop .wav, .mp3, .csv, or .jsonl files here</p>
                <p className="bulk-file-count">{files.length > 0 ? `${files.length} of 6 files` : "0 files"}</p>
                <label className="bulk-browse-btn">
                    Browse Files
                    <input type="file" multiple hidden accept=".wav,.mp3,.csv,.jsonl,.txt" onChange={(e) => setFiles(Array.from(e.target.files))} />
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
                    {uploading && (
                        <div className="bulk-progress">
                            <div className="bulk-progress-fill" style={{ width: `${progress}%` }} />
                        </div>
                    )}
                    <div className="dc-widget-actions" style={{ marginTop: 8 }}>
                        <button type="button" className="dc-commit-btn" onClick={handleUpload} disabled={uploading}>
                            {uploading ? `Uploading ${progress}%…` : `Upload ${files.length} File(s)`}
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}

// ─────────────────────────────────────────────────────────────
// Collection tabs (Manual / Bulk / Scraping)
// ─────────────────────────────────────────────────────────────
function CollectionTabs({ active, onChange }) {
    return (
        <div className="dc-tabs">
            {["Manual Entry", "Bulk Import", "Scraping Assistant"].map((t) => (
                <button
                    key={t}
                    type="button"
                    className={`dc-tab ${active === t ? "active" : ""}`}
                    onClick={() => onChange(t)}
                >
                    {t}
                </button>
            ))}
        </div>
    );
}

// ─────────────────────────────────────────────────────────────
// Toast
// ─────────────────────────────────────────────────────────────
function Toast({ message, onDone }) {
    useEffect(() => { const t = setTimeout(onDone, 2800); return () => clearTimeout(t); }, [onDone]);
    return <div className="dc-toast">{message}</div>;
}

// ─────────────────────────────────────────────────────────────
// Main DataCollection page
// ─────────────────────────────────────────────────────────────
function DataCollection() {
    // Works regardless of whether the route uses :id or :competitionId
    const params = useParams();
    const competitionId = params.id ?? params.competitionId;
    const navigate = useNavigate(); 
    const [competition,  setCompetition]  = useState(null);
    const [myStats,      setMyStats]      = useState({ validated: 0, flagged: 0 });
    const [teamStats,    setTeamStats]    = useState({ total: 0, members: [] });
    const [totalSamples, setTotalSamples] = useState(0);
    const [activeTab,    setActiveTab]    = useState("Manual Entry");
    const [submitting,   setSubmitting]   = useState(false);
    const [toast,        setToast]        = useState(null);

    // Load competition detail
    useEffect(() => {
        fetch(`${API}/competitions/${competitionId}`, { headers: authHeader() })
            .then((r) => r.json())
            .then(setCompetition)
            .catch(console.error);
    }, [competitionId]);

    // Poll stats every 15 s
    useEffect(() => {
        const load = () => {
            fetch(`${API}/competitions/${competitionId}/my-stats`, { headers: authHeader() })
                .then((r) => r.json()).then(setMyStats).catch(() => {});
            fetch(`${API}/competitions/${competitionId}/team-stats`, { headers: authHeader() })
                .then((r) => r.json()).then(setTeamStats).catch(() => {});
            fetch(`${API}/data-samples/count?competition_id=${competitionId}`, { headers: authHeader() })
                .then((r) => r.json()).then((d) => setTotalSamples(d.count ?? 0)).catch(() => {});
        };
        load();
        const iv = setInterval(load, 15000);
        return () => clearInterval(iv);
    }, [competitionId]);

    // Universal submit handler
    const handleSubmit = async ({ text_content, annotation, audio_blob, audio_duration }) => {
        setSubmitting(true);
        try {
            if (audio_blob) {
                const fd = new FormData();
                fd.append("audio", audio_blob, "recording.wav");
                fd.append("competition_id", competitionId);
                fd.append("annotation", JSON.stringify(annotation));
                fd.append("audio_duration", audio_duration);
                const res = await fetch(`${API}/data-samples/audio`, {
                    method: "POST", body: fd, headers: authHeader(),
                });
                if (!res.ok) throw new Error("Audio upload failed");
            } else {
                const res = await fetch(`${API}/data-samples`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json", ...authHeader() },
                    body: JSON.stringify({ competition_id: competitionId, text_content, annotation }),
                });
                if (!res.ok) throw new Error("Submit failed");
            }
            setTotalSamples((n) => n + 1);
            setTeamStats((s) => ({ ...s, total: (s.total || 0) + 1 }));
            setToast("✓ Sample committed successfully");
        } catch (err) {
            console.error(err);
            setToast("⚠ Submission failed — please retry");
        } finally {
            setSubmitting(false);
        }
    };

    // Widget router by task_type
    const renderWidget = () => {
        if (!competition) return <div className="dc-widget dc-placeholder">Loading…</div>;
        if (activeTab === "Bulk Import")
            return <BulkImportPanel competitionId={competitionId} />;
        if (activeTab === "Scraping Assistant")
            return <div className="dc-widget dc-placeholder">🔧 Scraping Assistant coming soon</div>;

        switch ((competition.task_type || "").toUpperCase()) {
            case "AUDIO SYNTHESIS":
                return <AudioWidget competition={competition} onSubmit={handleSubmit} submitting={submitting} />;
            case "TRANSLATION":
                return <TranslationWidget competition={competition} onSubmit={handleSubmit} submitting={submitting} />;
            case "COGNITIVE LOGIC":
                return <CognitiveWidget competition={competition} onSubmit={handleSubmit} submitting={submitting} />;
            default:
                return <TextProcessingWidget competition={competition} onSubmit={handleSubmit} submitting={submitting} />;
        }
    };

    const quota = competition?.prize_pool || 5000;

    return (
        <div className="dc-shell">
            {/* Left competition-level sidebar */}
            <CompetitionSidebar
                competitionId={competitionId}
                competitionTitle={competition?.title}
                taskType={competition?.task_type}
            />

            <div className="dc-main">
                {/* Top bar */}
                <CompetitionTopbar competition={competition} />

                <div className="dc-body">
                    {/* Page header */}
                    <div className="dc-header">
    <div>
        <h1 className="dc-title">Data Collection</h1>
        <p className="dc-subtitle">
            Assemble the primary linguistic corpus for the Sentiment Analysis
            challenge. Quality exceeds quantity—ensure diversity in syntactic
            structure and lexical richness.
        </p>
    </div>
    <div className="dc-header-right">
        <button
            className="dc-dataset-hub-btn"
            onClick={() => navigate(`/competitions/${competitionId}/dataset-hub`)}
        >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <ellipse cx="12" cy="5" rx="9" ry="3"/>
                <path d="M3 5v14a9 3 0 0 0 18 0V5"/>
                <path d="M3 12a9 3 0 0 0 18 0"/>
                <path d="M9 12l2 2 4-4"/>
            </svg>
            Dataset Hub
        </button>
        <div className="dc-total-badge">
            <span className="dc-total-num">{totalSamples.toLocaleString()}</span>
            <span className="dc-total-lbl">Total Samples</span>
        </div>
    </div>
</div>
                    {/* Two-column layout */}
                    <div className="dc-content">
                        <div className="dc-left">
                            <CollectionTabs active={activeTab} onChange={setActiveTab} />
                            {renderWidget()}
                        </div>

                        <TeamProgress
                            myStats={myStats}
                            teamStats={teamStats}
                            quota={quota}
                        />
                    </div>
                </div>
            </div>

            {toast && <Toast message={toast} onDone={() => setToast(null)} />}
        </div>
    );
}

export default DataCollection;