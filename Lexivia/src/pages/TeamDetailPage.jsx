import { useState } from 'react';
import { Link } from 'react-router-dom';
import './TeamDetailPage.css';

const MEMBERS = [
  { id: 1, name: 'Dr. Elias Vance', email: 'elias.vance@lab04.ai', role: 'Lead Architect', roleColor: 'lead', annotations: 1240, lastActive: '2m ago', initials: 'EV', color: '#3b5bdb' },
  { id: 2, name: 'Sarah Jenkins', email: 's.jenkins@lab04.ai', role: 'Senior Researcher', roleColor: 'senior', annotations: 892, lastActive: '4h ago', initials: 'SJ', color: '#7048e8' },
  { id: 3, name: 'Michael Chen', email: 'm.chen@lab04.ai', role: 'Data Scientist', roleColor: 'data', annotations: 3120, lastActive: 'Yesterday', initials: 'MC', color: '#0c8599' },
  { id: 4, name: 'Amara Okafor', email: 'a.okafor@lab04.ai', role: 'Annotator', roleColor: 'annotator', annotations: 450, lastActive: '2 days ago', initials: 'AO', color: '#2f9e44' },
];

const COMPETITIONS = [
  { id: 1, icon: '🔍', rank: 2, name: 'Legal-Mind LLM Challenge', desc: 'Optimization of token attention mechanisms for long-form judicial...', timeLeft: '4 DAYS LEFT', timeColor: 'warning', members: ['EV', 'SJ', '+24'] },
  { id: 2, icon: '🏥', rank: 14, name: 'Clinical Sentiment Extraction', desc: 'Extracting latent emotional indicators from anonymized clinical nurse notes.', timeLeft: 'LIVE NOW', timeColor: 'live', members: ['MC', 'AO'] },
  { id: 3, icon: '🌐', rank: 1, name: 'Multilingual Dialect Mapping', desc: 'Cross-entropy analysis of regional linguistic shifts in modern European...', timeLeft: 'FINISHED', timeColor: 'done', members: ['EV'] },
];

const RECENT_ACTIVITY = [
  { id: 1, color: '#2d5cf6', text: 'Elias Vance submitted 40 validation samples', time: '12 minutes ago' },
  { id: 2, color: '#e55', text: 'Team Nexus achieved 98.2% on legal corpus', time: '2 hours ago' },
  { id: 3, color: '#bbb', text: 'Michael Chen joined the team', time: 'Yesterday' },
];

function RoleBadge({ role, color }) {
  const styles = {
    lead:      { bg: '#e8f0fe', fg: '#2547c0' },
    senior:    { bg: '#f0eafe', fg: '#6324c4' },
    data:      { bg: '#e8f9f6', fg: '#0f7062' },
    annotator: { bg: '#f2f3f5', fg: '#555' },
  };
  const s = styles[color] || styles.annotator;
  return <span className="role-badge" style={{ background: s.bg, color: s.fg }}>{role}</span>;
}

export default function TeamDetailPage() {
  const [activeTab, setActiveTab] = useState('members');
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState('Annotator');

  return (
    <div className="detail-root">
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
          <button className="icon-btn-sm">
            <svg width="17" height="17" viewBox="0 0 17 17" fill="none">
              <path d="M8.5 2a5 5 0 0 1 5 5c0 2.5-.7 4-1.4 5H4.9c-.7-1-1.4-2.5-1.4-5a5 5 0 0 1 5-5Z" stroke="#666" strokeWidth="1.3" />
              <path d="M6.5 12v.5a2 2 0 0 0 4 0V12" stroke="#666" strokeWidth="1.3" />
              <circle cx="12.5" cy="3.5" r="2" fill="#e55" />
            </svg>
          </button>
          <button className="icon-btn-sm">
            <svg width="17" height="17" viewBox="0 0 17 17" fill="none">
              <ellipse cx="8.5" cy="5" rx="4" ry="2" stroke="#666" strokeWidth="1.3" />
              <path d="M4.5 5v4c0 1.1 1.8 2 4 2s4-.9 4-2V5" stroke="#666" strokeWidth="1.3" />
              <path d="M4.5 9v4c0 1.1 1.8 2 4 2s4-.9 4-2V9" stroke="#666" strokeWidth="1.3" />
            </svg>
          </button>
          <div className="user-avatar-sm">AT</div>
        </div>
      </header>

      <div className="detail-body">
        <div className="team-header-section">
          <div className="team-header-left">
            <div className="team-tags">
              <span className="tag-chip">NLP-CORE-04</span>
              <span className="tag-sep">•</span>
              <span className="tag-date">Created Oct 2023</span>
            </div>
            <h1 className="detail-title">Team Neural Nexus</h1>
            <p className="detail-desc">
              Dedicated to fine-tuning large language models for specialized clinical and legal reasoning domains. Collaborative research unit for Laboratory 04.
            </p>
          </div>
          <div className="team-header-actions">
            <button className="btn-outline">Edit Team</button>
            <button className="btn-primary">
              <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
                <path d="M6.5 1v11M1 6.5h11" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
              </svg>
              Invite Member
            </button>
          </div>
        </div>

        <div className="stats-row">
          <div className="stat-card">
            <span className="stat-label">ACTIVE COMPETITIONS</span>
            <div className="stat-value-row">
              <span className="stat-value">12</span>
              <span className="stat-badge-green">+2 this month</span>
            </div>
          </div>
          <div className="stat-card">
            <span className="stat-label">MEAN CONFIDENCE</span>
            <span className="stat-value">94.8%</span>
            <span className="stat-sub">GPT-4 Benchmark</span>
          </div>
          <div className="stat-card">
            <span className="stat-label">ANNOTATIONS COMPLETED</span>
            <span className="stat-value">14.2k</span>
            <span className="stat-sub">Across 4 Datasets</span>
          </div>
          <div className="stat-card">
            <span className="stat-label">GLOBAL RANKING</span>
            <span className="stat-value">#04</span>
            <span className="stat-sub">Top 1% Tier</span>
          </div>
        </div>

        <div className="detail-grid">
          <div className="detail-col-main">
            <div className="detail-tabs">
              {['members', 'competitions', 'activity', 'settings'].map((t) => (
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
                <table className="members-table">
                  <thead>
                    <tr>
                      <th>MEMBER NAME</th>
                      <th>ROLE</th>
                      <th>ACTIVITY</th>
                      <th>ACTION</th>
                    </tr>
                  </thead>
                  <tbody>
                    {MEMBERS.map((m) => (
                      <tr key={m.id}>
                        <td>
                          <div className="member-cell">
                            <div className="member-av" style={{ background: m.color }}>{m.initials}</div>
                            <div>
                              <div className="member-n">{m.name}</div>
                              <div className="member-e">{m.email}</div>
                            </div>
                          </div>
                        </td>
                        <td><RoleBadge role={m.role} color={m.roleColor} /></td>
                        <td>
                          <div className="activity-cell">
                            <div className="activity-count">{m.annotations.toLocaleString()} Annotations</div>
                            <div className="activity-time">Last active: {m.lastActive}</div>
                          </div>
                        </td>
                        <td><button className="action-dots">⋯</button></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <button className="view-all-btn">View All | 8 Members</button>
              </div>
            )}

            {activeTab !== 'members' && (
              <div className="empty-tab">
                <p>No {activeTab} content to display.</p>
              </div>
            )}
          </div>

          <div className="detail-col-side">
            <div className="invite-panel">
              <h3 className="panel-title">Invite New Member</h3>
              <p className="panel-desc">Send an invitation to join the Neural Nexus research team.</p>
              <div className="form-field">
                <label className="field-label">EMAIL ADDRESS</label>
                <input
                  type="email"
                  className="field-input"
                  placeholder="colleague@lab04.ai"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                />
              </div>
              <div className="form-field">
                <label className="field-label">TEAM ROLE</label>
                <div className="select-wrap">
                  <select className="field-select" value={inviteRole} onChange={(e) => setInviteRole(e.target.value)}>
                    <option>Annotator</option>
                    <option>Researcher</option>
                    <option>Data Scientist</option>
                    <option>Lead Architect</option>
                  </select>
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="none" className="select-arrow">
                    <path d="M3 4.5L6 7.5L9 4.5" stroke="#888" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </div>
              </div>
              <button className="send-invite-btn">Send Invitation</button>
            </div>

            <div className="activity-panel">
              <h4 className="activity-title">RECENT ACTIVITY</h4>
              <div className="activity-list">
                {RECENT_ACTIVITY.map((a) => (
                  <div key={a.id} className="activity-item">
                    <div className="activity-dot" style={{ background: a.color }} />
                    <div>
                      <div className="activity-text">{a.text}</div>
                      <div className="activity-ts">{a.time}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="competitions-section">
          <div className="section-header">
            <div>
              <h2 className="section-title">Active Competitions</h2>
              <p className="section-sub">Real-time performance across live NLP challenges</p>
            </div>
            <button className="view-all-link">View All →</button>
          </div>
          <div className="comp-grid">
            {COMPETITIONS.map((c) => (
              <div key={c.id} className="comp-card">
                <div className="comp-top">
                  <div className="comp-icon">{c.icon}</div>
                  <div className="comp-rank-box">
                    <span className="comp-rank-label">RANK</span>
                    <span className="comp-rank">#{String(c.rank).padStart(2, '0')}</span>
                  </div>
                </div>
                <div className="comp-name">{c.name}</div>
                <div className="comp-desc">{c.desc}</div>
                <div className="comp-footer">
                  <div className="comp-members">
                    {c.members.map((m, i) => (
                      <div key={i} className="comp-av">{m}</div>
                    ))}
                  </div>
                  <span className={`comp-time comp-time-${c.timeColor}`}>{c.timeLeft}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}