import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Sidebar from '../components/Sidebar';
import './TeamsPage.css';

const TEAMS = [
  {
    id: 1,
    name: 'Cyberdyne NLP',
    description: 'Specializing in neural hardware acceleration for transformer-based...',
    skillFocus: 'Transformer Optimization',
    competitions: 14,
    members: 11,
    status: 'ACTIVE',
    statusColor: 'active',
  },
  {
    id: 2,
    name: 'DeepMind Berlin',
    description: 'Exploring the boundaries of zero-shot cross-lingual transfer in LLMs.',
    skillFocus: 'Large Language Models',
    competitions: 22,
    members: 15,
    status: 'PREMIUM',
    statusColor: 'premium',
  },
  {
    id: 3,
    name: 'Sentient Semantic',
    description: 'Applied NLP for sentiment analysis in decentralized financial markets.',
    skillFocus: 'Sentiment Analysis',
    competitions: 8,
    members: 6,
    status: 'RISING',
    statusColor: 'rising',
  },
  {
    id: 4,
    name: 'Vector Visionaries',
    description: 'Embedding-based retrieval for extremely large-scale document...',
    skillFocus: 'Semantic Retrieval',
    competitions: 31,
    members: 25,
    status: 'ACTIVE',
    statusColor: 'active',
  },
  {
    id: 5,
    name: 'Syntax Sorcerers',
    description: 'Refining grammatical error correction and stylistic rewriting engines.',
    skillFocus: 'NLG Correction',
    competitions: 5,
    members: 7,
    status: 'ELITE',
    statusColor: 'elite',
  },
];

function MemberAvatars({ count }) {
  const visible = Math.min(count, 3);
  const extra = count - visible;
  const colors = ['#4a6cf7', '#6d4fc7', '#2bb5a0'];
  return (
    <div className="member-avatars">
      {Array.from({ length: visible }).map((_, i) => (
        <div key={i} className="avatar" style={{ background: colors[i], zIndex: visible - i }}>
          {String.fromCharCode(65 + i)}
        </div>
      ))}
      {extra > 0 && <div className="avatar avatar-extra">+{extra}</div>}
    </div>
  );
}

function TeamCard({ team, onClick }) {
  return (
    <div className="team-card" onClick={onClick}>
      <div className="team-card-header">
        <div className="team-logo">
          <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
            <path d="M14 4L21 8.5V17.5L14 22L7 17.5V8.5L14 4Z" fill="rgba(45,92,246,0.6)" />
            <path d="M14 8L19 11V17L14 20L9 17V11L14 8Z" fill="rgba(255,255,255,0.15)" />
            <text x="14" y="16" textAnchor="middle" fill="white" fontSize="7" fontWeight="700" fontFamily="sans-serif">TAM</text>
          </svg>
        </div>
        <span className={`status-badge status-${team.statusColor}`}>{team.status}</span>
      </div>

      <h3 className="team-name">{team.name}</h3>
      <p className="team-desc">{team.description}</p>

      <div className="team-meta">
        <div className="meta-box">
          <span className="meta-label">SKILL FOCUS</span>
          <span className="meta-value">{team.skillFocus}</span>
        </div>
        <div className="meta-box">
          <span className="meta-label">COMPETITIONS</span>
          <span className="meta-value">{team.competitions} Active</span>
        </div>
      </div>

      <div className="team-footer">
        <MemberAvatars count={team.members} />
        <button
          className="view-team-btn"
          onClick={(e) => {
            e.stopPropagation();
            onClick();
          }}
        >
          View Team
        </button>
      </div>
    </div>
  );
}

export default function TeamsPage() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');

  return (
    <div className="app-layout">
      <Sidebar />
      <div className="main-content">
        <header className="top-bar">
          <div className="top-bar-left">
            <h2 className="directory-label">Directory</h2>
          </div>
          <div className="top-bar-center">
            <div className="search-wrap">
              <svg width="15" height="15" viewBox="0 0 15 15" fill="none" className="search-icon">
                <circle cx="6.5" cy="6.5" r="5" stroke="#999" strokeWidth="1.4" />
                <path d="M10.5 10.5L13.5 13.5" stroke="#999" strokeWidth="1.4" strokeLinecap="round" />
              </svg>
              <input
                type="text"
                className="search-input"
                placeholder="Search teams, members, or skills..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          </div>
          <div className="top-bar-right">
            <button className="icon-btn">
              <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                <path d="M9 2a5.5 5.5 0 0 1 5.5 5.5c0 2.8-.8 4.5-1.5 5.5H4c-.7-1-1.5-2.7-1.5-5.5A5.5 5.5 0 0 1 9 2Z" stroke="#666" strokeWidth="1.4" />
                <path d="M7 13v.5a2 2 0 0 0 4 0V13" stroke="#666" strokeWidth="1.4" />
                <circle cx="13" cy="4" r="2.5" fill="#e55" />
              </svg>
            </button>
            <button className="icon-btn">
              <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                <path d="M4 5h10M4 9h8M4 13h5" stroke="#666" strokeWidth="1.4" strokeLinecap="round" />
              </svg>
            </button>
            <div className="user-chip">
              <div className="user-info">
                <span className="user-name">Dr. Aris Thorne</span>
                <span className="user-role">Principal Researcher</span>
              </div>
              <div className="user-avatar">AT</div>
            </div>
          </div>
        </header>

        <div className="page-body">
          <div className="page-title-row">
            <div>
              <h1 className="page-title">Teams</h1>
              <p className="page-subtitle">
                Connect with elite NLP research collectives and collaborate on high-density language modeling competitions.
              </p>
            </div>
            <button className="create-btn">
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <path d="M7 1v12M1 7h12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              </svg>
              Create Team
            </button>
          </div>

          <div className="tabs">
            <button
              className={`tab${activeTab === 'all' ? ' active' : ''}`}
              onClick={() => setActiveTab('all')}
            >
              All Teams
            </button>
            <button
              className={`tab${activeTab === 'mine' ? ' active' : ''}`}
              onClick={() => setActiveTab('mine')}
            >
              My Teams
            </button>
          </div>

          <div className="teams-grid">
            {TEAMS.map((team) => (
              <TeamCard
                key={team.id}
                team={team}
                onClick={() => navigate('/teams/neural-nexus')}
              />
            ))}
          </div>

          <div className="pagination">
            <span className="pagination-info">Showing 1–5 of 128 Teams</span>
            <div className="pagination-controls">
              <button className="page-btn" disabled>‹</button>
              {[1, 2, 3].map((n) => (
                <button key={n} className={`page-btn${n === 1 ? ' active' : ''}`}>{n}</button>
              ))}
              <span className="page-ellipsis">...</span>
              <button className="page-btn">12</button>
              <button className="page-btn">›</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
