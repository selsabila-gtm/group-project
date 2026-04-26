import React, { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import Sidebar from '../../components/Sidebar'
import '../../styles/profilePage.css'

const API = 'http://localhost:8000'

// ─── Hardcoded for testing ─────────────────────────────────────────────────────
const TEST_USER_ID = 1

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
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M11 4H4"/>
  </svg>
)

// ─── Page Component ────────────────────────────────────────────────────────────
export default function ProfilePage() {
  const { userId: paramUserId } = useParams()
  const navigate = useNavigate()

  const USER_ID = paramUserId ? parseInt(paramUserId) : TEST_USER_ID
  const isOwnProfile = !paramUserId

  const [profileData, setProfileData] = useState(null)
  const [organizedComps, setOrganizedComps] = useState([])
  const [participatedComps, setParticipatedComps] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    async function loadProfile() {
      setLoading(true)
      setError(null)
      try {
        const res = await fetch(`${API}/profile/${USER_ID}`)
        if (!res.ok) throw new Error()
        const data = await res.json()
        setProfileData(data)

        // Organized competitions
        const orgRes = await fetch(`${API}/competitions/organizer/${USER_ID}`)
        if (orgRes.ok) setOrganizedComps((await orgRes.json()) || [])

        // Participated competitions
        const partRes = await fetch(`${API}/competitions/participant/${USER_ID}`)
        if (partRes.ok) setParticipatedComps((await partRes.json()) || [])
      } catch {
        setError('Failed to load profile.')
      } finally {
        setLoading(false)
      }
    }
    loadProfile()
  }, [USER_ID])

  if (loading) return <div>Loading...</div>
  if (error || !profileData) return <div>{error}</div>

  const {
    name,
    username,
    avatar_url,
    institution,
    bio,
    skills,
    experiences,
    linkedin_url,
    github_url,
    website_url
  } = profileData

  const links = [
    { url: linkedin_url, label: 'LinkedIn', icon: <LinkedInIcon /> },
    { url: github_url, label: 'GitHub', icon: <GitHubIcon /> },
    { url: website_url, label: 'Website', icon: <WebIcon /> }
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

          {/* ── LEFT SIDEBAR (FIXED) ── */}
          <aside className="p-sidebar-card">
            {avatar_url ? (
              <img src={avatar_url} alt={name} className="p-avatar p-avatar--xl" />
            ) : (
              <div className="p-avatar p-avatar--xl p-avatar--ph">
                {name?.charAt(0).toUpperCase() || '?'}
              </div>
            )}

            <h2 className="p-sidebar-name">{name || username}</h2>

            <div className="p-sidebar-meta">
              {institution && (
                <span className="p-meta-item">
                  <BuildingIcon /> {institution}
                </span>
              )}
            </div>

            {/* ✅ Biography moved here */}
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