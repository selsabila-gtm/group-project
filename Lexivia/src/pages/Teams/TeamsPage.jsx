import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import Sidebar from '../../components/Sidebar';
import Topbar from '../../components/Topbar';
import './TeamsPage.css';
import CreateTeamModal from '../../components/CreateTeamModal';

const API = 'http://127.0.0.1:8000';

function authHeaders() {
  const token = localStorage.getItem('token');
  return { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };
}

// ── Status badge derived from team metadata ────────────────────────────────────
function deriveStatus(team) {
  if (team.is_my_team) return { label: 'ACTIVE', color: 'active' };
  const age = Date.now() - new Date(team.created_at).getTime();
  const days = age / (1000 * 60 * 60 * 24);
  if (days < 30) return { label: 'RISING', color: 'rising' };
  const count = team.member_count ?? 0;
  if (count > 20) return { label: 'ELITE', color: 'elite' };
  if (count > 10) return { label: 'PREMIUM', color: 'premium' };
  return { label: 'ACTIVE', color: 'active' };
}

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
  const memberCount = team.member_count ?? 0;
  const { label, color } = deriveStatus(team);

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
        <span className={`status-badge status-${color}`}>{label}</span>
      </div>

      <h3 className="team-name">{team.name}</h3>
      <p className="team-desc">{team.description || 'No description provided.'}</p>

      <div className="team-meta">
        <div className="meta-box">
          <span className="meta-label">MEMBERS</span>
          <span className="meta-value">{memberCount} Total</span>
        </div>
        <div className="meta-box">
          <span className="meta-label">CREATED</span>
          <span className="meta-value">
            {new Date(team.created_at).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}
          </span>
        </div>
      </div>

      <div className="team-footer">
        <MemberAvatars count={memberCount} />
        <button
          className="view-team-btn"
          onClick={(e) => { e.stopPropagation(); onClick(); }}
        >
          View Team
        </button>
      </div>
    </div>
  );
}

function SkeletonCard() {
  return (
    <div className="team-card" style={{ pointerEvents: 'none' }}>
      {[120, 80, 60, 90].map((w, i) => (
        <div key={i} style={{
          height: i === 0 ? 44 : 14,
          width: i === 0 ? 44 : `${w}%`,
          background: '#eaeaea',
          borderRadius: 8,
          marginBottom: 12,
          animation: 'pulse 1.4s ease-in-out infinite',
        }} />
      ))}
      <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:.4}}`}</style>
    </div>
  );
}

export default function TeamsPage() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [teams, setTeams] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const PAGE_SIZE = 6;

  const fetchTeams = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams({
        page: String(page),
        limit: String(PAGE_SIZE),
        tab: activeTab,
      });
      if (searchQuery.trim()) params.append('search', searchQuery.trim());

      const res = await fetch(`${API}/teams?${params}`, { headers: authHeaders() });

      if (res.status === 401) {
        navigate('/login');
        return;
      }
      if (!res.ok) throw new Error('Failed to load teams');

      const data = await res.json();
      setTeams(data.teams ?? []);
      setTotal(data.total ?? 0);
    } catch (err) {
      console.error(err);
      setError('Failed to load teams. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [activeTab, searchQuery, page, navigate]);

  useEffect(() => {
    const debounce = setTimeout(fetchTeams, searchQuery ? 350 : 0);
    return () => clearTimeout(debounce);
  }, [fetchTeams]);

  // Reset to page 1 when tab or search changes
  useEffect(() => { setPage(1); }, [activeTab, searchQuery]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const visiblePages = () => {
    const pages = [];
    if (totalPages <= 5) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
    } else {
      pages.push(1);
      if (page > 3) pages.push('...');
      for (let i = Math.max(2, page - 1); i <= Math.min(totalPages - 1, page + 1); i++) pages.push(i);
      if (page < totalPages - 2) pages.push('...');
      pages.push(totalPages);
    }
    return pages;
  };

  return (
    <div className="app-layout">
      <Sidebar />
      <div className="main-content">
        <Topbar
          title="Teams"
          subtitle="Connect with elite NLP research collectives and collaborate on high-density language modeling competitions."
          showBrowseButton={false}
        />

        <div className="page-body">
          <div className="page-title-row">
            <div>
              <h1 className="page-title">Teams</h1>
              <p className="page-subtitle">
                Connect with elite NLP research collectives and collaborate on high-density language modeling competitions.
              </p>
            </div>
            <button className="create-btn" onClick={() => setShowCreateModal(true)}>
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <path d="M7 1v12M1 7h12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              </svg>
              Create Team
            </button>
          </div>

          <div className="tabs">
            {['all', 'mine'].map((t) => (
              <button
                key={t}
                className={`tab${activeTab === t ? ' active' : ''}`}
                onClick={() => setActiveTab(t)}
              >
                {t === 'all' ? 'All Teams' : 'My Teams'}
              </button>
            ))}
          </div>

          {error && (
            <div style={{ padding: '16px 20px', background: '#fff0f0', border: '1px solid #fcc', borderRadius: 10, marginBottom: 20, color: '#c33', fontSize: 13 }}>
              {error}
            </div>
          )}

          <div className="teams-grid">
            {loading
              ? Array.from({ length: PAGE_SIZE }).map((_, i) => <SkeletonCard key={i} />)
              : teams.length === 0
                ? (
                  <div style={{ gridColumn: '1/-1', textAlign: 'center', padding: '60px 0', color: '#aaa' }}>
                    <div style={{ fontSize: 40, marginBottom: 12 }}>🔍</div>
                    <div style={{ fontSize: 15, fontWeight: 600 }}>
                      {activeTab === 'mine' ? "You haven't joined any teams yet." : 'No teams found.'}
                    </div>
                  </div>
                )
                : teams.map((team) => (
                  <TeamCard
                    key={team.id}
                    team={team}
                    onClick={() => navigate(`/teams/${team.id}`)}
                  />
                ))
            }
          </div>

          {!loading && total > 0 && (
            <div className="pagination">
              <span className="pagination-info">
                Showing {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, total)} of {total} Teams
              </span>
              <div className="pagination-controls">
                <button className="page-btn" disabled={page === 1} onClick={() => setPage(p => p - 1)}>‹</button>
                {visiblePages().map((p, i) =>
                  p === '...'
                    ? <span key={`ellipsis-${i}`} className="page-ellipsis">...</span>
                    : (
                      <button
                        key={p}
                        className={`page-btn${p === page ? ' active' : ''}`}
                        onClick={() => setPage(p)}
                      >
                        {p}
                      </button>
                    )
                )}
                <button className="page-btn" disabled={page === totalPages} onClick={() => setPage(p => p + 1)}>›</button>
              </div>
            </div>
          )}
        </div>
      </div>

      <CreateTeamModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onCreated={fetchTeams}
      />
    </div>
  );
}