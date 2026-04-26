/**
 * ProfilePage.jsx  —  View-only public profile page
 *
 * Route:  /profile          → your own profile  (shows Edit Profile button)
 *         /profile/:userId  → any user's profile (no edit button)
 *
 * ─── AUTH TODO (2 changes when auth is ready) ───────────────────────────────
 *  1. Find "// 🔐 USER_ID" and replace the hardcoded value:
 *       const USER_ID = paramUserId || 1
 *     with your auth context, e.g.:
 *       const { currentUser } = useAuth()
 *       const USER_ID = paramUserId || currentUser?.id
 *
 *  2. Find "// 🔐 isOwnProfile" and replace:
 *       const isOwnProfile = !paramUserId
 *     with:
 *       const isOwnProfile = !paramUserId || String(paramUserId) === String(currentUser?.id)
 * ─────────────────────────────────────────────────────────────────────────────
 */

import React, { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../../config/supabase'
import Sidebar from '../../components/Sidebar'   // 🔧 adjust path if needed
import '../../styles/profilePage.css'                // single shared CSS file

// ─── Icons ────────────────────────────────────────────────────────────────────
const LinkedInIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
    <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
  </svg>
)
const GitHubIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
    <path d="M12 0C5.374 0 0 5.373 0 12c0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23A11.509 11.509 0 0112 5.803c1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576C20.566 21.797 24 17.3 24 12c0-6.627-5.373-12-12-12z"/>
  </svg>
)
const WebIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71"/>
    <path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71"/>
  </svg>
)
const LocationIcon = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z"/><circle cx="12" cy="10" r="3"/>
  </svg>
)
const BuildingIcon = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/>
  </svg>
)
const EditIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/>
    <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/>
  </svg>
)

// ─── Direct Supabase fetch (no service file) ───────────────────────────────────
async function fetchProfile(userId) {
  try {
    const { data: user, error: e1 } = await supabase
      .from('users')
      .select('id, name, email, avatar_url, role, created_at')
      .eq('id', userId).single()
    if (e1) throw e1

    const { data: profile, error: e2 } = await supabase
      .from('user_profiles')
      .select('bio, institution, country, skills, linkedin_url, github_url, website_url')
      .eq('user_id', userId).maybeSingle()
    if (e2) throw e2

    const { data: experiences, error: e3 } = await supabase
      .from('user_experiences')
      .select('id, title, organization, start_year, end_year, description')
      .eq('user_id', userId)
      .order('start_year', { ascending: false })
    if (e3) throw e3

    // TODO: query organizedCompetitions when competitions table has organizer_id
    // TODO: query participatedCompetitions when team_members table is ready

    return {
      data: {
        user,
        profile: profile ?? {},
        experiences: experiences ?? [],
        organizedCompetitions: [],
        participatedCompetitions: [],
      },
      error: null,
    }
  } catch (err) {
    console.error('[ProfilePage] fetchProfile:', err)
    return { data: null, error: err }
  }
}

// ─── Page Component ────────────────────────────────────────────────────────────
export default function ProfilePage() {
  const { userId: paramUserId } = useParams()
  const navigate = useNavigate()

  // 🔐 USER_ID — replace with auth context when ready (see file header)
  const USER_ID = paramUserId || 1

  // 🔐 isOwnProfile — replace with auth check when ready (see file header)
  const isOwnProfile = !paramUserId

  const [profileData, setProfileData] = useState(null)
  const [loading, setLoading]         = useState(true)
  const [error, setError]             = useState(null)

 useEffect(() => {
  async function loadProfile() {
    setLoading(true)
    setError(null)

    try {
      const { data, error: apiError } = await fetchProfile(USER_ID)

      if (apiError) {
        setError('Failed to load profile.')
        setProfileData(null)
      } else {
        setProfileData(data)
      }
    } catch (err) {
      console.error(err)
      setError('Something went wrong.')
      setProfileData(null)
    } finally {
      setLoading(false)
    }
  }

  loadProfile()
}, [USER_ID])

  if (loading) return (
    <div className="p-shell">
      <Sidebar />
      <div className="p-content p-center">
        <div className="p-spinner" />
        <p className="p-muted">Loading profile…</p>
      </div>
    </div>
  )

  if (error || !profileData) return (
    <div className="p-shell">
      <Sidebar />
      <div className="p-content p-center">
        <p className="p-muted">{error || 'Profile not found.'}</p>
        <button className="p-btn p-btn--primary" onClick={() => window.location.reload()}>Retry</button>
      </div>
    </div>
  )

  const { user, profile, experiences, organizedCompetitions, participatedCompetitions } = profileData

  const links = [
    { url: profile.linkedin_url, label: 'LinkedIn',         icon: <LinkedInIcon /> },
    { url: profile.github_url,   label: 'GitHub',           icon: <GitHubIcon /> },
    { url: profile.website_url,  label: 'Research Profile', icon: <WebIcon /> },
  ].filter(l => l.url)

  return (
    <div className="p-shell">
      <Sidebar />

      <div className="p-content">

        {/* ── Page header ── */}
        <div className="p-page-header">
          <h1 className="p-page-title">Profile Overview</h1>
          {isOwnProfile && (
            <button
              className="p-btn p-btn--secondary p-btn--with-icon"
              onClick={() => navigate('/profile/settings')}
            >
              <EditIcon /> Edit Profile
            </button>
          )}
        </div>

        <div className="p-overview">

          {/* ── Left: sidebar card ── */}
          <aside className="p-sidebar-card">
            {user.avatar_url ? (
              <img src={user.avatar_url} alt={user.name} className="p-avatar p-avatar--xl" />
            ) : (
              <div className="p-avatar p-avatar--xl p-avatar--ph">
                {user.name?.charAt(0).toUpperCase() || '?'}
              </div>
            )}

            <h2 className="p-sidebar-name">{user.name}</h2>
            {user.role && <p className="p-sidebar-role">{user.role}</p>}

            <div className="p-sidebar-meta">
              {profile.country && (
                <span className="p-meta-item"><LocationIcon />{profile.country}</span>
              )}
              {profile.institution && (
                <span className="p-meta-item"><BuildingIcon />{profile.institution}</span>
              )}
            </div>

            {links.length > 0 && (
              <div className="p-sidebar-links">
                {links.map(l => (
                  <a key={l.label} href={l.url} target="_blank" rel="noopener noreferrer" className="p-ext-link">
                    {l.icon}<span>{l.label}</span>
                  </a>
                ))}
              </div>
            )}
          </aside>

          {/* ── Right: main sections ── */}
          <main className="p-main">

            <section className="p-card">
              <h3 className="p-card-title">Biography</h3>
              <p className="p-bio">{profile.bio || 'No bio added yet.'}</p>
            </section>

            <section className="p-card">
              <h3 className="p-card-title">Technical Proficiency</h3>
              {profile.skills?.length > 0 ? (
                <div className="p-tags">
                  {profile.skills.map(s => <span key={s} className="p-tag">{s}</span>)}
                </div>
              ) : <p className="p-empty">No skills added yet.</p>}
            </section>

            <section className="p-card">
              <h3 className="p-card-title">Experience</h3>
              {experiences.length > 0 ? (
                <ul className="p-exp-list">
                  {experiences.map(exp => (
                    <li key={exp.id} className="p-exp-item">
                      <div className="p-exp-header">
                        <div>
                          <p className="p-exp-title">{exp.title}</p>
                          <p className="p-exp-org">{exp.organization}</p>
                        </div>
                        <span className="p-exp-years">
                          {exp.start_year} – {exp.end_year ?? 'Present'}
                        </span>
                      </div>
                      {exp.description && <p className="p-exp-desc">{exp.description}</p>}
                    </li>
                  ))}
                </ul>
              ) : <p className="p-empty">No experience added yet.</p>}
            </section>

            <section className="p-card">
              <h3 className="p-card-title">Organized Competitions</h3>
              {organizedCompetitions.length > 0 ? (
                <div className="p-comp-grid">
                  {organizedCompetitions.map(c => (
                    <div key={c.id} className="p-comp-card">
                      <p className="p-comp-name">{c.title}</p>
                      <p className="p-comp-badge">Lead Organizer</p>
                    </div>
                  ))}
                </div>
              ) : <p className="p-empty">No competitions organized yet.</p>}
            </section>

            <section className="p-card">
              <h3 className="p-card-title">Participated Competitions</h3>
              {participatedCompetitions.length > 0 ? (
                <div className="p-comp-grid">
                  {participatedCompetitions.map(c => (
                    <div key={c.id} className="p-comp-card">
                      <p className="p-comp-name">{c.title}</p>
                    </div>
                  ))}
                </div>
              ) : <p className="p-empty">No competitions participated in yet.</p>}
            </section>

          </main>
        </div>
      </div>
    </div>
  )
}
