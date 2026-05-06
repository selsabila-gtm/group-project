/**
 * DataCollection.jsx  —  orchestrator only
 *
 * Responsibilities:
 *   1. Fetch competition metadata + dataset config (dynamic labels from organizer)
 *   2. Poll stats (my-stats, team-stats, sample count)
 *   3. Route to the correct annotation widget based on task_type
 *   4. Handle the universal submit (text vs audio)
 *   5. Render the shared layout (sidebar, topbar, stats panel, tabs)
 *
 * Widget mapping (task_type → widget):
 *   TEXT_CLASSIFICATION   → TextClassificationWidget
 *   NER                   → NERWidget
 *   SENTIMENT_ANALYSIS    → SentimentWidget
 *   TRANSLATION           → TranslationWidget
 *   QUESTION_ANSWERING    → QuestionAnsweringWidget
 *   SUMMARIZATION         → SummarizationWidget
 *   AUDIO_SYNTHESIS       → AudioSynthesisWidget
 *   AUDIO_TRANSCRIPTION   → AudioTranscriptionWidget
 *   SPEECH_EMOTION        → SpeechEmotionWidget
 *   AUDIO_EVENT_DETECTION → AudioEventDetectionWidget
 */

import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import CompetitionSidebar from "../components/CompetitionSidebar";
import "./DataCollection.css";

import TextClassificationWidget  from "./widgets/TextClassificationWidget";
import NERWidget                  from "./widgets/NERWidget";
import SentimentWidget            from "./widgets/SentimentWidget";
import TranslationWidget          from "./widgets/TranslationWidget";
import QuestionAnsweringWidget    from "./widgets/QuestionAnsweringWidget";
import SummarizationWidget        from "./widgets/SummarizationWidget";
import AudioSynthesisWidget       from "./widgets/AudioSynthesisWidget";
import AudioTranscriptionWidget   from "./widgets/AudioTranscriptionWidget";
import SpeechEmotionWidget        from "./widgets/SpeechEmotionWidget";
import AudioEventDetectionWidget  from "./widgets/AudioEventDetectionWidget";
import BulkImportPanel            from "./widgets/BulkImportPanel";

const API = "http://127.0.0.1:8000";
function authHeader() {
  const t = localStorage.getItem("token");
  return t ? { Authorization: `Bearer ${t}` } : {};
}

// Widget registry — task_type values must exactly match what's stored in DB
const WIDGET_MAP = {
  TEXT_CLASSIFICATION:   TextClassificationWidget,
  NER:                   NERWidget,
  SENTIMENT_ANALYSIS:    SentimentWidget,
  TRANSLATION:           TranslationWidget,
  QUESTION_ANSWERING:    QuestionAnsweringWidget,
  SUMMARIZATION:         SummarizationWidget,
  AUDIO_SYNTHESIS:       AudioSynthesisWidget,
  AUDIO_TRANSCRIPTION:   AudioTranscriptionWidget,
  SPEECH_EMOTION:        SpeechEmotionWidget,
  AUDIO_EVENT_DETECTION: AudioEventDetectionWidget,
};

const TASK_LABELS = {
  TEXT_CLASSIFICATION:   "Text Classification",
  NER:                   "Named Entity Recognition",
  SENTIMENT_ANALYSIS:    "Sentiment Analysis",
  TRANSLATION:           "Translation",
  QUESTION_ANSWERING:    "Question Answering",
  SUMMARIZATION:         "Summarization",
  AUDIO_SYNTHESIS:       "Audio Synthesis",
  AUDIO_TRANSCRIPTION:   "Audio Transcription",
  SPEECH_EMOTION:        "Speech Emotion",
  AUDIO_EVENT_DETECTION: "Audio Event Detection",
};

// ── CompetitionTopbar ─────────────────────────────────────────
function CompetitionTopbar({ competition }) {
  return (
    <div className="comp-topbar">
      <div className="comp-topbar-left">
        <span className="comp-topbar-name">{competition?.title || "…"}</span>
        <span className="comp-lab-badge">LAB ACTIVE</span>
        <nav className="comp-topbar-tabs">
          {["Overview", "Rules", "Resources"].map((t, i) => (
            <button key={t} type="button" className={`comp-topbar-tab ${i === 0 ? "active" : ""}`}>{t}</button>
          ))}
        </nav>
      </div>
      <div className="comp-topbar-right">
        <button type="button" className="comp-icon-btn" title="Search">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
          </svg>
        </button>
        <div className="comp-avatar">U</div>
      </div>
    </div>
  );
}

// ── TeamProgress panel ────────────────────────────────────────
function TeamProgress({ myStats, teamStats, quota }) {
  const pct = quota > 0 ? Math.min(100, Math.round(((teamStats.total || 0) / quota) * 100)) : 0;
  return (
    <div className="dc-right-panel">
      <div className="dc-panel-card">
        <div className="dc-panel-header">
          <span className="dc-panel-label">Team Progress</span>
          <span className="dc-phase-badge">Phase 1</span>
        </div>
        <div className="dc-quota-row">
          <span className="dc-quota-text">Global Quota</span>
          <span className="dc-quota-nums">
            {(teamStats.total || 0).toLocaleString()} / {(quota || 5000).toLocaleString()}
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
                {m.today > 0 && <span className="dc-member-today">+{m.today} today</span>}
              </div>
            </div>
          ))}
          <button type="button" className="dc-audit-link">View Audit Log</button>
        </div>
      )}

      <div className="dc-panel-card researcher-tip">
        <span className="dc-tip-icon">◎</span>
        <div>
          <p className="dc-tip-title">RESEARCHER TIP</p>
          <p className="dc-tip-body">
            Syntactic variety improves model generalisation. Avoid repeating
            the same sentence structures across multiple entries.
          </p>
        </div>
      </div>
    </div>
  );
}

// ── Toast ─────────────────────────────────────────────────────
function Toast({ message, onDone }) {
  useEffect(() => { const t = setTimeout(onDone, 2800); return () => clearTimeout(t); }, [onDone]);
  return <div className="dc-toast">{message}</div>;
}

// ── Collection tabs ───────────────────────────────────────────
const TABS = ["Manual Entry", "Bulk Import", "Scraping Assistant"];
function CollectionTabs({ active, onChange }) {
  return (
    <div className="dc-tabs">
      {TABS.map((t) => (
        <button key={t} type="button" className={`dc-tab ${active === t ? "active" : ""}`} onClick={() => onChange(t)}>
          {t}
        </button>
      ))}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Main component
// ─────────────────────────────────────────────────────────────
function DataCollection() {
  const params = useParams();
  const competitionId = params.id ?? params.competitionId;
  const navigate = useNavigate();

  const [competition,   setCompetition]   = useState(null);
  const [datasetConfig, setDatasetConfig] = useState(null);
  const [myStats,       setMyStats]       = useState({ validated: 0, flagged: 0 });
  const [teamStats,     setTeamStats]     = useState({ total: 0, members: [] });
  const [totalSamples,  setTotalSamples]  = useState(0);
  const [activeTab,     setActiveTab]     = useState("Manual Entry");
  const [submitting,    setSubmitting]    = useState(false);
  const [toast,         setToast]         = useState(null);

  // Load competition + dataset config (which merges organizer overrides)
  useEffect(() => {
    const h = authHeader();
    fetch(`${API}/competitions/${competitionId}`, { headers: h })
      .then((r) => r.json())
      .then((comp) => {
        setCompetition(comp);
        return fetch(`${API}/competitions/${competitionId}/dataset-config`, { headers: h });
      })
      .then((r) => r.ok ? r.json() : null)
      .then((cfg) => { if (cfg) setDatasetConfig(cfg); })
      .catch(console.error);
  }, [competitionId]);

  // Poll stats every 15 s
  useEffect(() => {
    const load = () => {
      const h = authHeader();
      fetch(`${API}/competitions/${competitionId}/my-stats`, { headers: h })
        .then((r) => r.json()).then(setMyStats).catch(() => {});
      fetch(`${API}/competitions/${competitionId}/team-stats`, { headers: h })
        .then((r) => r.json()).then(setTeamStats).catch(() => {});
      fetch(`${API}/data-samples/count?competition_id=${competitionId}`, { headers: h })
        .then((r) => r.json()).then((d) => setTotalSamples(d.count ?? 0)).catch(() => {});
    };
    load();
    const iv = setInterval(load, 15_000);
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
        fd.append("audio_duration", audio_duration ?? 0);
        const res = await fetch(`${API}/data-samples/audio`, {
          method: "POST", body: fd, headers: authHeader(),
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err.detail?.message || "Audio upload failed");
        }
      } else {
        const res = await fetch(`${API}/data-samples`, {
          method: "POST",
          headers: { "Content-Type": "application/json", ...authHeader() },
          body: JSON.stringify({ competition_id: competitionId, text_content, annotation }),
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          if (err.detail?.status === "rejected")
            throw new Error(`Rejected: ${(err.detail.reasons || []).join(", ")}`);
          throw new Error("Submit failed");
        }
      }
      setTotalSamples((n) => n + 1);
      setTeamStats((s) => ({ ...s, total: (s.total || 0) + 1 }));
      setToast("✓ Sample committed successfully");
    } catch (err) {
      setToast(`⚠ ${err.message || "Submission failed — please retry"}`);
    } finally {
      setSubmitting(false);
    }
  };

  // Widget router — task_type is used directly, no aliases needed
  const renderWidget = () => {
    if (!competition) return <div className="dc-widget dc-placeholder">Loading…</div>;

    if (activeTab === "Bulk Import")
      return <BulkImportPanel competitionId={competitionId} taskType={competition.task_type} />;

    if (activeTab === "Scraping Assistant")
      return <div className="dc-widget dc-placeholder">🔧 Scraping Assistant coming soon</div>;

    const Widget = WIDGET_MAP[competition.task_type] || TextClassificationWidget;

    return (
      <Widget
        competition={competition}
        config={datasetConfig}   // ← merged config: base defaults + organizer overrides
        onSubmit={handleSubmit}
        submitting={submitting}
      />
    );
  };

  const taskLabel = TASK_LABELS[competition?.task_type] || competition?.task_type || "Data Collection";
  const quota = competition?.prize_pool || 5000;

  return (
    <div className="dc-shell">
      <CompetitionSidebar
        competitionId={competitionId}
        competitionTitle={competition?.title}
        taskType={competition?.task_type}
      />

      <div className="dc-main">
        <CompetitionTopbar competition={competition} />

        <div className="dc-body">
          <div className="dc-header">
            <div>
              <h1 className="dc-title">{taskLabel}</h1>
              <p className="dc-subtitle">
                {datasetConfig?.description ||
                  "Contribute high-quality annotated samples to this competition. Quality and diversity both matter."}
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

          <div className="dc-content">
            <div className="dc-left">
              <CollectionTabs active={activeTab} onChange={setActiveTab} />
              {renderWidget()}
            </div>
            <TeamProgress myStats={myStats} teamStats={teamStats} quota={quota} />
          </div>
        </div>
      </div>

      {toast && <Toast message={toast} onDone={() => setToast(null)} />}
    </div>
  );
}

export default DataCollection;