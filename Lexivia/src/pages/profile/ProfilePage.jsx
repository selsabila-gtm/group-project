/**
 * ProfilePage.jsx  —  View a user profile
 *
 * • Own profile  → /profile          (reads logged-in user from Supabase)
 * • Other user   → /profile/:userId  (public, no auth needed)
 */

import React, { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'

import Sidebar from '../../components/Sidebar'
import '../../styles/profilePage.css'

const API = 'http://localhost:8000'

// Initialise Supabase client  (replace with your actual project values)
import { supabase } from '../../config/supabase'
// ─── Icons ────────────────────────────────────────────────────────────────────
const LinkedInIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
    <path d="M4.98 3.5C4.98 4.88 3.86 6 2.5 6S0 4.88 0 3.5 1.12 1 2.5 1 4.98 2.12 4.98 3.5zM0 8h5v16H0V8zm7.5 0h4.8v2.2h.07c.67-1.2 2.3-2.4 4.73-2.4C22.2 7.8 24 10 24 14v10h-5v-9c0-2.2-.04-5-3.05-5-3.05 0-3.52 2.38-3.52 4.84V24h-5V8z"/>
  </svg>
)
const GitHubIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
    <path d="M12 .5C5.65.5.5 5.65.5 12c0 5.1 3.29 9.42 7.86 10.95.58.1.79-.25.79-.55v-2.02c-3.2.7-3.87-1.54-3.87-1.54-.52-1.32-1.27-1.67-1.27-1.67-1.04-.7.08-.69.08-.69 1.15.08 1.75 1.18 1.75 1.18 1.02 1.75 2.68 1.25 3.33.96.1-.74.4-1.25.72-1.54-2.55-.29-5.23-1.28-5.23-5.7 0-1.26.45-2.3 1.18-3.11-.12-.29-.51-1.45.11-3.02 0 0 .96-.31 3.14 1.18a10.9 10.9 0 012.86-.38c.97 0 1.95.13 2.86.38 2.18-1.49 3.14-1.18 3.14-1.18.62 1.57.23 2.73.11 3.02.73.81 1.18 1.85 1.18 3.11 0 4.43-2.68 5.4-5.24 5.69.41.35.77 1.04.77 2.1v3.11c0 .3.21.65.8.55C20.71 21.42 24 17.1 24 12 24 5.65 18.85.5 12 .5z"/>
  </svg>
)
const WebIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <circle cx="12" cy="12" r="10"/>
    <line x1="2" y1="12" x2="22" y2="12"/>
    <path d="M12 2a15 15 0 010 20"/>
    <path d="M12 2a15 15 0 000 20"/>
  </svg>
)
const BuildingIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <rect x="3" y="2" width="18" height="20" rx="2"/>
    <path d="M9 22V12h6v10"/>
  </svg>
)
const EditIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M12 20h9"/>
    <path d="M16.5 3.5a2.1 2.1 0 013 3L7 19l-4 1 1-4 12.5-12.5z"/>
  </svg>
)

// ─── Page Component ────────────────────────────────────────────────────────────
export default function ProfilePage() {
  const { userId: paramUserId } = useParams()
  const navigate = useNavigate()

  // Auth state
  const [authUser, setAuthUser]   = useState(null)   // Supabase auth user
  const [authReady, setAuthReady] = useState(false)  // true once auth is resolved

  // Profile data
  const [profileData, setProfileData]         = useState(null)
  const [organizedComps, setOrganizedComps]   = useState([])
  const [participatedComps, setParticipatedComps] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState(null)

  // ── 1. Resolve the logged-in user once ──────────────────────────────────────
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setAuthUser(session?.user ?? null)
      setAuthReady(true)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setAuthUser(session?.user ?? null)
    })
    return () => subscription.unsubscribe()
  }, [])

  // ── 2. Load profile once auth is resolved ───────────────────────────────────
  useEffect(() => {
    if (!authReady) return   // wait until we know who's logged in

    // Which user are we viewing?
    // - No URL param  → own profile  (requires login)
    // - URL param     → another user's public profile
    const viewingUserId = paramUserId ?? authUser?.id

    if (!viewingUserId) {
      // Not logged in and no userId in URL → redirect to login
      navigate('/login')
      return
    }

    async function loadProfile() {
      setLoading(true)
      setError(null)
      try {
        // For own profile we use /profile/me (sends auth token)
        // For other profiles we use /profile/:id (public, no token needed)
        const isOwnProfile = !paramUserId && authUser?.id === viewingUserId

        const headers = {}
        if (isOwnProfile) {
          const { data: { session } } = await supabase.auth.getSession()
          if (session?.access_token) {
            headers['Authorization'] = `Bearer ${session.access_token}`
          }
        }

        const profileEndpoint = isOwnProfile
          ? `${API}/profile/me`
          : `${API}/profile/${viewingUserId}`

        const res = await fetch(profileEndpoint, { headers })
        if (!res.ok) throw new Error(`Failed to load profile (${res.status})`)
        const data = await res.json()
        setProfileData(data)

        // Competitions (public endpoints, no auth needed)
        fetch(`${API}/competitions/organizer/${viewingUserId}`)
  .then(res => res.ok ? res.json() : [])
  .then(data => setOrganizedComps(data))
  .catch(() => setOrganizedComps([]))

fetch(`${API}/competitions/participant/${viewingUserId}`)
  .then(res => res.ok ? res.json() : [])
  .then(data => setParticipatedComps(data))
  .catch(() => setParticipatedComps([]))
      } catch (err) {
        setError('Failed to load profile.')
        console.error('[ProfilePage] load error:', err)
      } finally {
        setLoading(false)
      }
    }

    loadProfile()
  }, [authReady, authUser, paramUserId, navigate])

  if (!authReady || loading) return <div>Loading…</div>
  if (error || !profileData)  return <div>{error ?? 'Profile not found.'}</div>

  const isOwnProfile = !paramUserId   // viewing own profile when there's no URL param

  const {
    full_name,
    name,
    username,
    profile_picture,   // ← was avatar_url
    institution,
    bio,
    skills,
    experiences,
    linkedin_url,
    github_url,
    website_url,
  } = profileData

  const displayName = full_name || name

  const links = [
    { url: linkedin_url, label: 'LinkedIn', icon: <LinkedInIcon /> },
    { url: github_url,   label: 'GitHub',   icon: <GitHubIcon /> },
    { url: website_url,  label: 'Website',  icon: <WebIcon /> },
  ].filter(l => l.url)

  return (
    <div className="p-shell">
      <Sidebar />

      <div className="p-content">

        <div className="p-page-header">
          <h1 className="p-page-title">Profile Overview</h1>
          {isOwnProfile && (
            <button
              className="p-btn p-btn--secondary"
              onClick={() => navigate('/profile/update')}
            >
              <EditIcon /> Edit Profile
            </button>
          )}
        </div>

        <div className="p-overview">

          {/* ── LEFT SIDEBAR ── */}
          <aside className="p-sidebar-card">
            {profile_picture ? (
              <img src={profile_picture} alt={displayName} className="p-avatar p-avatar--xl" />
            ) : (
              <div className="p-avatar p-avatar--xl p-avatar--ph">
                {displayName?.charAt(0).toUpperCase() || '?'}
              </div>
            )}

            <h2 className="p-sidebar-name">{displayName || username}</h2>

            <div className="p-sidebar-meta">
              {institution && (
                <span className="p-meta-item">
                  <BuildingIcon /> {institution}
                </span>
              )}
            </div>

            <div className="p-sidebar-section">
              <h3 className="p-card-title">Biography</h3>
              <p className="p-bio">{bio || 'No bio added yet.'}</p>
            </div>

            {links.length > 0 && (
              <div className="p-sidebar-links">
                {links.map(l => (
                  <a key={l.label} href={l.url} className="p-ext-link">
                    {l.icon} {l.label}
                  </a>
                ))}
              </div>
            )}
          </aside>

          {/* ── RIGHT SIDE ── */}
          <main className="p-main">

            <section className="p-card">
              <h3 className="p-card-title">Technical Proficiency</h3>
              {skills?.length > 0 ? (
                <div className="p-tags">
                  {skills.map(s => <span key={s} className="p-tag">{s}</span>)}
                </div>
              ) : <p className="p-empty">No skills added yet.</p>}
            </section>

            <section className="p-card">
              <h3 className="p-card-title">Experience</h3>
              {experiences?.length > 0 ? (
                <ul className="p-exp-list">
                  {experiences.map(exp => (
                    <li key={exp.id} className="p-exp-item">
                      <div className="p-exp-header">
                        <div>
                          <p className="p-exp-title">{exp.title}</p>
                          {exp.organization && (
                            <p className="p-exp-org">{exp.organization}</p>
                          )}
                        </div>
                        <span className="p-exp-years">
                          {exp.start_year} – {exp.end_year ?? 'Present'}
                        </span>
                      </div>
                      {exp.description && (
                        <p className="p-exp-desc">{exp.description}</p>
                      )}
                    </li>
                  ))}
                </ul>
              ) : <p className="p-empty">No experience added yet.</p>}
            </section>

            <section className="p-card">
              <h3 className="p-card-title">Organized Competitions</h3>
              {organizedComps.length > 0 ? (
                <ul className="p-exp-list">
                  {organizedComps.map(comp => (
                    <li key={comp.id} className="p-exp-item">
                      <p className="p-exp-title">{comp.title}</p>
                      {comp.date && <p className="p-exp-org">{comp.date}</p>}
                    </li>
                  ))}
                </ul>
              ) : <p className="p-empty">No competitions organized yet.</p>}
            </section>

            <section className="p-card">
              <h3 className="p-card-title">Participated Competitions</h3>
              {participatedComps.length > 0 ? (
                <ul className="p-exp-list">
                  {participatedComps.map(comp => (
                    <li key={comp.id} className="p-exp-item">
                      <p className="p-exp-title">{comp.title}</p>
                      {comp.date && <p className="p-exp-org">{comp.date}</p>}
                    </li>
                  ))}
                </ul>
              ) : <p className="p-empty">No competitions participated in yet.</p>}
            </section>

          </main>
        </div>
      </div>
    </div>
  )
}