import { useState, useEffect, useCallback } from 'react';
import { Link, useParams } from 'react-router-dom';
import { supabase } from '../../config/supabase';
import './TeamDetailPage.css';

const CURRENT_USER_ID = 1;

const ROLE_STYLES = {
  leader:     { bg: '#fef0e6', fg: '#b85200' },
  admin:      { bg: '#e8edfb', fg: '#2547c0' },
  member:     { bg: '#f2f3f5', fg: '#555' },
};

const AVATAR_COLORS = ['#3b5bdb', '#7048e8', '#0c8599', '#2f9e44', '#e8590c', '#c2255c'];

function RoleBadge({ role }) {
  const s = ROLE_STYLES[role] || ROLE_STYLES.member;
  return (
    <span className="role-badge" style={{ background: s.bg, color: s.fg }}>
      {role.charAt(0).toUpperCase() + role.slice(1)}
    </span>
  );
}

function timeAgo(dateStr) {
  if (!dateStr) return 'Unknown';
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  const hrs = Math.floor(mins / 60);
  const days = Math.floor(hrs / 24);
  if (mins < 60) return `${mins}m ago`;
  if (hrs < 24) return `${hrs}h ago`;
  if (days === 1) return 'Yesterday';
  return `${days} days ago`;
}

function initials(username) {
  if (!username) return '??';
  return username.slice(0, 2).toUpperCase();
}

// ── Skeleton helpers ──────────────────────────────────────────
function SkeletonBlock({ w = '100%', h = 14, mb = 10, radius = 6 }) {
  return (
    <div style={{
      width: w, height: h, borderRadius: radius,
      background: '#eaeaea', marginBottom: mb,
      animation: 'pulse 1.4s ease-in-out infinite',
    }} />
  );
}

export default function TeamDetailPage() {
  const { teamId } = useParams();

  const [team, setTeam] = useState(null);
  const [members, setMembers] = useState([]);
  const [currentUserRole, setCurrentUserRole] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Invite panel state
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState('member');
  const [inviting, setInviting] = useState(false);
  const [inviteMsg, setInviteMsg] = useState(null); // { type: 'success'|'error', text }

  // Edit mode state (only for leaders)
  const [editMode, setEditMode] = useState(false);
  const [editName, setEditName] = useState('');
  const [editDesc, setEditDesc] = useState('');
  const [saving, setSaving] = useState(false);

  const [activeTab, setActiveTab] = useState('members');

  // ── Fetch team + members ──────────────────────────────────────
  const fetchTeamData = useCallback(async () => {
    if (!teamId) return;
    setLoading(true);
    setError(null);

    try {
      // Step 1: fetch team row (no joins)
      const teamResult = await supabase
        .from('teams')
        .select('*')
        .eq('id', Number(teamId))
        .single();

      if (teamResult.error) throw teamResult.error;
      const teamData = teamResult.data;
      setTeam(teamData);
      setEditName(teamData.name);
      setEditDesc(teamData.description || '');

      // Step 2: fetch team_members rows for this team
      const membersResult = await supabase
        .from('team_members')
        .select('user_id, role, joined_at')
        .eq('team_id', Number(teamId))
        .order('joined_at', { ascending: true });

      if (membersResult.error) throw membersResult.error;
      const memberRows = membersResult.data || [];

      if (memberRows.length === 0) {
        setMembers([]);
        setCurrentUserRole(null);
        setLoading(false);
        return;
      }

      // Step 3: fetch user details for those user IDs
      const userIds = memberRows.map((m) => m.user_id);
      const usersResult = await supabase
        .from('users')
        .select('id, username, email')
        .in('id', userIds);

      if (usersResult.error) throw usersResult.error;

      // Build a lookup map: userId -> user
      const userMap = {};
      (usersResult.data || []).forEach((u) => { userMap[u.id] = u; });

      const flatMembers = memberRows.map((m) => ({
        userId: m.user_id,
        username: userMap[m.user_id]?.username ?? 'Unknown',
        email: userMap[m.user_id]?.email ?? '',
        role: m.role,
        joinedAt: m.joined_at,
      }));

      setMembers(flatMembers);

      const mine = flatMembers.find((m) => m.userId === CURRENT_USER_ID);
      setCurrentUserRole(mine?.role ?? null);

    } catch (err) {
      console.error('Error loading team:', err);
      setError('Could not load team data.');
    } finally {
      setLoading(false);
    }
  }, [teamId]);


  useEffect(() => { fetchTeamData(); }, [fetchTeamData]);

  // ── Save edited team info ─────────────────────────────────────
  async function handleSaveEdit() {
    if (!editName.trim()) return;
    setSaving(true);
    const { error: saveErr } = await supabase
      .from('teams')
      .update({ name: editName.trim(), description: editDesc.trim() })
      .eq('id', Number(teamId));
    setSaving(false);
    if (!saveErr) {
      setTeam((prev) => ({ ...prev, name: editName.trim(), description: editDesc.trim() }));
      setEditMode(false);
    } else {
      alert('Failed to save changes: ' + saveErr.message);
    }
  }

  // ── Invite member ─────────────────────────────────────────────
  async function handleInvite() {
  if (!inviteEmail.trim()) return;
  setInviting(true);
  setInviteMsg(null);

  try {
    // 1. Look up the receiver by email
    const { data: userData, error: userErr } = await supabase
      .from('users')
      .select('id, username')
      .eq('email', inviteEmail.trim().toLowerCase())
      .maybeSingle();

    if (userErr) throw userErr;
    if (!userData) {
      setInviteMsg({ type: 'error', text: 'No user found with that email address.' });
      return;
    }

    // 2. Check if already a member
    const alreadyMember = members.some((m) => m.userId === userData.id);
    if (alreadyMember) {
      setInviteMsg({ type: 'error', text: `${userData.username} is already a member.` });
      return;
    }

    // 3. Check if a pending invite already exists
    const { data: existingInvite } = await supabase
      .from('invitations')
      .select('id')
      .eq('team_id', Number(teamId))
      .eq('receiver_id', userData.id)
      .eq('status', 'pending')
      .maybeSingle();

    if (existingInvite) {
      setInviteMsg({ type: 'error', text: `${userData.username} already has a pending invitation.` });
      return;
    }

    // 4. Insert the invitation row
    const { error: insertErr } = await supabase.from('invitations').insert({
      team_id:     Number(teamId),
      sender_id:   CURRENT_USER_ID,
      receiver_id: userData.id,
      role:        inviteRole,
      status:      'pending',
      created_at:  new Date().toISOString(),
      updated_at:  new Date().toISOString(),
    });

    if (insertErr) throw insertErr;

    setInviteMsg({ type: 'success', text: `Invitation sent to ${userData.username}!` });
    setInviteEmail('');
    setInviteRole('member');

  } catch (err) {
    setInviteMsg({ type: 'error', text: err.message || 'Failed to send invitation.' });
  } finally {
    setInviting(false);
  }
}

  const isLeader = currentUserRole === 'leader';

  // ── Loading skeleton ──────────────────────────────────────────
  if (loading) {
    return (
      <div className="detail-root">
        <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:.4}}`}</style>
        <header className="detail-topbar">
          <div className="detail-topbar-left">
            <Link to="/teams" className="back-link">
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <path d="M9 2L4 7l5 5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              Back to Teams
            </Link>
          </div>
        </header>
        <div className="detail-body">
          <SkeletonBlock w="180px" h={12} mb={16} />
          <SkeletonBlock w="320px" h={36} mb={12} radius={8} />
          <SkeletonBlock w="480px" h={14} mb={32} />
          <div className="stats-row">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="stat-card">
                <SkeletonBlock w="80px" h={10} mb={10} />
                <SkeletonBlock w="60px" h={28} mb={6} />
                <SkeletonBlock w="100px" h={10} mb={0} />
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // ── Error state ───────────────────────────────────────────────
  if (error || !team) {
    return (
      <div className="detail-root">
        <header className="detail-topbar">
          <div className="detail-topbar-left">
            <Link to="/teams" className="back-link">← Back to Teams</Link>
          </div>
        </header>
        <div className="detail-body" style={{ textAlign: 'center', paddingTop: 80 }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>⚠️</div>
          <div style={{ fontSize: 16, color: '#c33', fontWeight: 600 }}>{error || 'Team not found.'}</div>
          <Link to="/teams" style={{ display: 'inline-block', marginTop: 20, color: '#2d5cf6', fontWeight: 600 }}>
            ← Return to Teams
          </Link>
        </div>
      </div>
    );
  }

  const createdMonth = new Date(team.created_at).toLocaleString('en-US', { month: 'short', year: 'numeric' });

  return (
    <div className="detail-root">
      <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:.4}}`}</style>
      <header className="detail-topbar">
        <div className="detail-topbar-left">
          <Link to="/teams" className="back-link">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M9 2L4 7l5 5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            Back to Teams
          </Link>
        </div>
        <nav className="detail-topnav">
          <a href="#" className="topnav-link">DOCS</a>
          <a href="#" className="topnav-link">API</a>
          <a href="#" className="topnav-link">SUPPORT</a>
        </nav>
        <div className="detail-topbar-right">
          <div className="search-wrap-sm">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}>
              <circle cx="6" cy="6" r="4.5" stroke="#aaa" strokeWidth="1.3" />
              <path d="M9.5 9.5L12 12" stroke="#aaa" strokeWidth="1.3" strokeLinecap="round" />
            </svg>
            <input className="search-input-sm" placeholder="Search experiments..." />
          </div>
          <div className="user-avatar-sm">AT</div>
        </div>
      </header>

      <div className="detail-body">
        {/* ── Team header ── */}
        <div className="team-header-section">
          <div className="team-header-left">
            <div className="team-tags">
              <span className="tag-chip">ID-{String(team.id).padStart(4, '0')}</span>
              <span className="tag-sep">•</span>
              <span className="tag-date">Created {createdMonth}</span>
              {team.creator && (
                <>
                  <span className="tag-sep">•</span>
                  <span className="tag-date">by {team.creator.username}</span>
                </>
              )}
              {isLeader && (
                <>
                  <span className="tag-sep">•</span>
                  <span className="tag-chip" style={{ background: '#fff0e6', color: '#b85200' }}>LEADER</span>
                </>
              )}
            </div>

            {editMode ? (
              <>
                <input
                  className="field-input"
                  style={{ fontSize: 24, fontWeight: 800, marginBottom: 10, letterSpacing: '-0.03em' }}
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  placeholder="Team name"
                />
                <textarea
                  className="field-input"
                  style={{ resize: 'vertical', minHeight: 72, fontSize: 14, lineHeight: 1.6 }}
                  value={editDesc}
                  onChange={(e) => setEditDesc(e.target.value)}
                  placeholder="Team description"
                />
              </>
            ) : (
              <>
                <h1 className="detail-title">{team.name}</h1>
                <p className="detail-desc">{team.description || 'No description provided.'}</p>
              </>
            )}
          </div>

          <div className="team-header-actions">
            {isLeader && (
              editMode ? (
                <>
                  <button className="btn-outline" onClick={() => { setEditMode(false); setEditName(team.name); setEditDesc(team.description || ''); }}>
                    Cancel
                  </button>
                  <button className="btn-primary" onClick={handleSaveEdit} disabled={saving}>
                    {saving ? 'Saving…' : 'Save Changes'}
                  </button>
                </>
              ) : (
                <button className="btn-outline" onClick={() => setEditMode(true)}>Edit Team</button>
              )
            )}
            {!editMode && (
              <button className="btn-primary" onClick={() => document.getElementById('invite-email')?.focus()}>
                <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
                  <path d="M6.5 1v11M1 6.5h11" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                </svg>
                Invite Member
              </button>
            )}
          </div>
        </div>

        {/* ── Stats ── */}
        <div className="stats-row">
          <div className="stat-card">
            <span className="stat-label">TOTAL MEMBERS</span>
            <div className="stat-value-row">
              <span className="stat-value">{members.length}</span>
            </div>
          </div>
          <div className="stat-card">
            <span className="stat-label">LEADERS</span>
            <span className="stat-value">{members.filter((m) => m.role === 'leader').length}</span>
            <span className="stat-sub">Team leads</span>
          </div>
          <div className="stat-card">
            <span className="stat-label">ADMINS</span>
            <span className="stat-value">{members.filter((m) => m.role === 'admin').length}</span>
            <span className="stat-sub">Moderators</span>
          </div>
          <div className="stat-card">
            <span className="stat-label">YOUR ROLE</span>
            <span className="stat-value" style={{ fontSize: 20, letterSpacing: '-0.02em' }}>
              {currentUserRole
                ? currentUserRole.charAt(0).toUpperCase() + currentUserRole.slice(1)
                : '—'}
            </span>
            <span className="stat-sub">
              {currentUserRole ? 'Member of this team' : 'Not a member'}
            </span>
          </div>
        </div>

        {/* ── Main grid ── */}
        <div className="detail-grid">
          <div className="detail-col-main">
            <div className="detail-tabs">
              {['members', 'activity', 'settings'].map((t) => (
                <button
                  key={t}
                  className={`detail-tab${activeTab === t ? ' active' : ''}`}
                  onClick={() => setActiveTab(t)}
                >
                  {t.charAt(0).toUpperCase() + t.slice(1)}
                </button>
              ))}
            </div>

            {activeTab === 'members' && (
              <div className="members-table-wrap">
                {members.length === 0 ? (
                  <div className="empty-tab">No members in this team yet.</div>
                ) : (
                  <>
                    <table className="members-table">
                      <thead>
                        <tr>
                          <th>MEMBER NAME</th>
                          <th>ROLE</th>
                          <th>JOINED</th>
                          {isLeader && <th>ACTION</th>}
                        </tr>
                      </thead>
                      <tbody>
                        {members.map((m, idx) => (
                          <tr key={m.userId ?? idx}>
                            <td>
                              <div className="member-cell">
                                <div
                                  className="member-av"
                                  style={{ background: AVATAR_COLORS[idx % AVATAR_COLORS.length] }}
                                >
                                  {initials(m.username)}
                                </div>
                                <div>
                                  <div className="member-n">
                                    {m.username}
                                    {m.userId === CURRENT_USER_ID && (
                                      <span style={{ fontSize: 10, fontWeight: 700, background: '#eef2fe', color: '#2547c0', borderRadius: 4, padding: '1px 6px', marginLeft: 6 }}>
                                        YOU
                                      </span>
                                    )}
                                  </div>
                                  <div className="member-e">{m.email}</div>
                                </div>
                              </div>
                            </td>
                            <td><RoleBadge role={m.role} /></td>
                            <td>
                              <div className="activity-cell">
                                <div className="activity-time">{timeAgo(m.joinedAt)}</div>
                              </div>
                            </td>
                            {isLeader && (
                              <td>
                                {m.userId !== CURRENT_USER_ID && (
                                  <RemoveMemberBtn
                                    teamId={teamId}
                                    userId={m.userId}
                                    username={m.username}
                                    onRemoved={fetchTeamData}
                                  />
                                )}
                              </td>
                            )}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    <div style={{ padding: '12px 18px', borderTop: '1px solid #eaeaea', fontSize: 12, color: '#aaa' }}>
                      {members.length} member{members.length !== 1 ? 's' : ''} total
                    </div>
                  </>
                )}
              </div>
            )}

            {activeTab !== 'members' && (
              <div className="empty-tab">
                <p>No {activeTab} content to display yet.</p>
              </div>
            )}
          </div>

          {/* ── Right side ── */}
          <div className="detail-col-side">
            <div className="invite-panel">
              <h3 className="panel-title">
                {isLeader ? 'Invite New Member' : 'Request to Join'}
              </h3>
              <p className="panel-desc">
                {isLeader
                  ? 'Add a registered user to this team by their email address.'
                  : 'Only team leaders can invite members.'}
              </p>

              {isLeader && (
                <>
                  <div className="form-field">
                    <label className="field-label">EMAIL ADDRESS</label>
                    <input
                      id="invite-email"
                      type="email"
                      className="field-input"
                      placeholder="colleague@lab04.ai"
                      value={inviteEmail}
                      onChange={(e) => setInviteEmail(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleInvite()}
                    />
                  </div>
                  <div className="form-field">
                    <label className="field-label">TEAM ROLE</label>
                    <div className="select-wrap">
                      <select className="field-select" value={inviteRole} onChange={(e) => setInviteRole(e.target.value)}>
                        <option value="member">Member</option>
                        <option value="admin">Admin</option>
                        <option value="leader">Leader</option>
                      </select>
                      <svg width="12" height="12" viewBox="0 0 12 12" fill="none" className="select-arrow">
                        <path d="M3 4.5L6 7.5L9 4.5" stroke="#888" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </div>
                  </div>

                  {inviteMsg && (
                    <div style={{
                      padding: '9px 12px',
                      borderRadius: 7,
                      fontSize: 12.5,
                      marginBottom: 10,
                      background: inviteMsg.type === 'success' ? '#e6f9ef' : '#fff0f0',
                      color: inviteMsg.type === 'success' ? '#1a7a44' : '#c33',
                      border: `1px solid ${inviteMsg.type === 'success' ? '#b2e4c8' : '#fcc'}`,
                    }}>
                      {inviteMsg.text}
                    </div>
                  )}

                  <button className="send-invite-btn" onClick={handleInvite} disabled={inviting || !inviteEmail.trim()}>
                    {inviting ? 'Adding…' : 'Add Member'}
                  </button>
                </>
              )}
            </div>

            {/* Member summary panel */}
            <div className="activity-panel">
              <h4 className="activity-title">TEAM COMPOSITION</h4>
              <div className="activity-list">
                {[
                  { label: 'Leaders', role: 'leader', color: '#b85200' },
                  { label: 'Admins', role: 'admin', color: '#2d5cf6' },
                  { label: 'Members', role: 'member', color: '#2bb5a0' },
                ].map(({ label, role, color }) => {
                  const count = members.filter((m) => m.role === role).length;
                  return (
                    <div key={role} className="activity-item">
                      <div className="activity-dot" style={{ background: color }} />
                      <div style={{ flex: 1 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <div className="activity-text">{label}</div>
                          <span style={{ fontSize: 12, fontWeight: 700, color: '#333' }}>{count}</span>
                        </div>
                        <div style={{ marginTop: 4, height: 4, borderRadius: 4, background: '#f0f1f4', overflow: 'hidden' }}>
                          <div style={{
                            height: '100%',
                            borderRadius: 4,
                            background: color,
                            width: members.length ? `${(count / members.length) * 100}%` : '0%',
                            transition: 'width 0.4s ease',
                          }} />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Remove member button (leaders only) ───────────────────────
function RemoveMemberBtn({ teamId, userId, username, onRemoved }) {
  const [confirming, setConfirming] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleRemove() {
    setLoading(true);
    const { error } = await supabase
      .from('team_members')
      .delete()
      .eq('team_id', Number(teamId))
      .eq('user_id', userId);
    setLoading(false);
    if (!error) {
      onRemoved();
    } else {
      alert('Failed to remove member: ' + error.message);
    }
    setConfirming(false);
  }

  if (confirming) {
    return (
      <div style={{ display: 'flex', gap: 4 }}>
        <button
          onClick={handleRemove}
          disabled={loading}
          style={{
            padding: '4px 10px', fontSize: 11.5, fontWeight: 600,
            background: '#c33', color: '#fff', border: 'none',
            borderRadius: 6, cursor: 'pointer',
          }}
        >
          {loading ? '…' : 'Confirm'}
        </button>
        <button
          onClick={() => setConfirming(false)}
          style={{
            padding: '4px 10px', fontSize: 11.5, fontWeight: 600,
            background: '#f0f1f4', color: '#555', border: 'none',
            borderRadius: 6, cursor: 'pointer',
          }}
        >
          Cancel
        </button>
      </div>
    );
  }

  return (
    <button
      className="action-dots"
      title={`Remove ${username}`}
      onClick={() => setConfirming(true)}
      style={{ fontSize: 13, color: '#e55' }}
    >
      Remove
    </button>
  );
}