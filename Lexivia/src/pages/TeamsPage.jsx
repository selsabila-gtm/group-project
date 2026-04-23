import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import Sidebar from '../components/Sidebar';
import { supabase } from '../config/supabase';
import './TeamsPage.css';
import CreateTeamModal from '../components/CreateTeamModal';

const CURRENT_USER_ID = 1;

// Derive a stable status badge from team data
function deriveStatus(team, isMyTeam) {
  if (isMyTeam) return { label: 'ACTIVE', color: 'active' };
  const age = Date.now() - new Date(team.created_at).getTime();
  const days = age / (1000 * 60 * 60 * 24);
  if (days < 30) return { label: 'RISING', color: 'rising' };
  const count = team._memberCount ?? 0;
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
  const memberCount = team._memberCount ?? 0;
  const { label, color } = deriveStatus(team, team._isMyTeam);

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
      // Step 1: resolve team IDs for "My Teams" tab
      let myTeamIds = null;
      if (activeTab === 'mine') {
        const membershipsResult = await supabase
          .from('team_members')
          .select('team_id')
          .eq('user_id', CURRENT_USER_ID);

        if (membershipsResult.error) throw membershipsResult.error;

        myTeamIds = (membershipsResult.data || []).map((m) => m.team_id);
        if (myTeamIds.length === 0) {
          setTeams([]);
          setTotal(0);
          setLoading(false);
          return;
        }
      }

      // Step 2: fetch teams (plain select, no embedded joins)
      let query = supabase
        .from('teams')
        .select('*', { count: 'exact' })
        .order('created_at', { ascending: false })
        .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);

      if (myTeamIds !== null) query = query.in('id', myTeamIds);
      if (searchQuery.trim()) query = query.ilike('name', `%${searchQuery.trim()}%`);

      const teamsResult = await query;
      if (teamsResult.error) throw teamsResult.error;

      const rows = teamsResult.data || [];
      const totalCount = teamsResult.count ?? 0;

      if (rows.length === 0) {
        setTeams([]);
        setTotal(totalCount);
        return;
      }

      // Step 3: fetch member counts in a separate plain query
      const ids = rows.map((t) => t.id);
      const membersResult = await supabase
        .from('team_members')
        .select('team_id')
        .in('team_id', ids);

      if (membersResult.error) {
        console.warn('Could not load member counts:', membersResult.error.message);
      }

      const countMap = {};
      (membersResult.data || []).forEach((r) => {
        countMap[r.team_id] = (countMap[r.team_id] || 0) + 1;
      });

      const tagged = rows.map((t) => ({
        ...t,
        _memberCount: countMap[t.id] ?? 0,
        _isMyTeam: myTeamIds !== null,
      }));

      setTeams(tagged);
      setTotal(totalCount);
    } catch (err) {
      console.error('Error fetching teams:', err);
      setError('Failed to load teams. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [activeTab, searchQuery, page]);


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
                placeholder="Search teams by name..."
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
  userId={CURRENT_USER_ID}
/>
    </div>
    
  );
  
}