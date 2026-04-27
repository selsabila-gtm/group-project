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
  <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
    <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286z"/>
  </svg>
)
const GitHubIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
    <path d="M12 0C5.374 0 0 5.373 0 12c0 5.302 3.438 9.8 8.207 11.387"/>
  </svg>
)
const WebIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M10 13a5 5 0 007.54.54l3-3"/>
  </svg>
)
const BuildingIcon = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M3 9l9-7 9 7v11"/>
  </svg>
)
const EditIcon = () => (
  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M11 4H4"/>
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