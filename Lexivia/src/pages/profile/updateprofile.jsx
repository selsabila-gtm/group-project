/**
 * UpdateProfilePage.jsx  —  Edit your own profile
 *
 * Route:  /profile/update  (protected — redirects to /login if not authenticated)
 *
 * Auth:   Reads the logged-in user from Supabase and passes the JWT token
 *         in every API request so the backend can verify identity.
 */

import React, { useEffect, useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'

import Sidebar from '../../components/Sidebar'
import '../../styles/updateprofile.css'
import { supabase } from '../../config/supabase'
const API = 'http://localhost:8000'



// ─── Predefined skills ────────────────────────────────────────────────────────
const PREDEFINED_SKILLS = [
  'Natural Language Processing', 'Computer Vision', 'PyTorch', 'TensorFlow',
  'Transformer Architecture', 'Vector Databases', 'Python', 'CUDA', 'Rust',
  'Go', 'Docker', 'Kubernetes', 'FastAPI', 'React', 'Named Entity Recognition',
  'Automatic Speech Recognition', 'Text Classification', 'Data Annotation',
  'MLOps', 'Fine-tuning', 'Prompt Engineering',
]

// ─── Icons ────────────────────────────────────────────────────────────────────
const ArrowLeftIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <line x1="19" y1="12" x2="5" y2="12"/>
    <polyline points="12 19 5 12 12 5"/>
  </svg>
)
const CameraIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z"/>
    <circle cx="12" cy="13" r="4"/>
  </svg>
)

const EMPTY_EXP = { title: '', organization: '', start_year: '', end_year: '', description: '' }

export default function UpdateProfilePage() {
  const navigate = useNavigate()

  // ── Auth state ───────────────────────────────────────────────────────────────
  const [authToken, setAuthToken] = useState(null)   // JWT access token
  const [authReady, setAuthReady] = useState(false)  // true once session is resolved

  // ── UI state ─────────────────────────────────────────────────────────────────
  const [loading, setLoading]    = useState(true)
  const [saving, setSaving]      = useState(false)
  const [successMsg, setSuccess] = useState('')
  const [errorMsg, setErrorMsg]  = useState('')

  // ── Form state ───────────────────────────────────────────────────────────────
  const [name, setName]                     = useState('')
  const [profilePicture, setProfilePicture] = useState('')   // renamed from avatarUrl
  const [picturePreview, setPicturePreview] = useState('')   // renamed from avatarPreview
  const [bio, setBio]                       = useState('')
  const [institution, setInstitution]       = useState('')
  const [skills, setSkills]                 = useState([])
  const [linkedinUrl, setLinkedin]          = useState('')
  const [githubUrl, setGithub]              = useState('')
  const [websiteUrl, setWebsite]            = useState('')
  const [experiences, setExperiences]       = useState([])

  // ── Competitions (read-only) ─────────────────────────────────────────────────
  const [organizedComps, setOrganizedComps]       = useState([])
  const [participatedComps, setParticipatedComps] = useState([])

  // ── Experience form state ────────────────────────────────────────────────────
  const [showExpForm, setShowExpForm]   = useState(false)
  const [editingExpId, setEditingExpId] = useState(null)
  const [expForm, setExpForm]           = useState(EMPTY_EXP)
  const [expSaving, setExpSaving]       = useState(false)
  const [expError, setExpError]         = useState('')

  // ── Skills input state ───────────────────────────────────────────────────────
  const [skillInput, setSkillInput]       = useState('')
  const [skillDropdown, setSkillDropdown] = useState(false)
  const skillRef = useRef(null)
  const fileRef  = useRef(null)

  // ── Helper: get auth headers ─────────────────────────────────────────────────
  function authHeaders(extra = {}) {
    return {
      'Content-Type': 'application/json',
      ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
      ...extra,
    }
  }

  // ── 1. Resolve auth session ──────────────────────────────────────────────────
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) {
        // Not logged in — redirect to login
        navigate('/login')
        return
      }
      setAuthToken(session.access_token)
      setAuthReady(true)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setAuthToken(session?.access_token ?? null)
      if (!session) navigate('/login')
    })
    return () => subscription.unsubscribe()
  }, [navigate])

  // ── 2. Load profile data once auth is ready ──────────────────────────────────
  useEffect(() => {
    if (!authReady) return

    async function loadAll() {
      setLoading(true)
      try {
        // /profile/me uses the JWT to return the logged-in user's data
        const profileRes = await fetch(`${API}/profile/me`, {
          headers: authHeaders(),
        })
        if (!profileRes.ok) throw new Error(`Server error: ${profileRes.status}`)
        const data = await profileRes.json()

        setName(data.name || '')
        setProfilePicture(data.profile_picture || '')   // ← was data.avatar_url
        setPicturePreview(data.profile_picture || '')
        setBio(data.bio || '')
        setInstitution(data.institution || '')
        setSkills(data.skills || [])
        setLinkedin(data.linkedin_url || '')
        setGithub(data.github_url || '')
        setWebsite(data.website_url || '')
        setExperiences(data.experiences || [])

        // Competitions — public endpoints, no token needed
        const session = await supabase.auth.getSession()
        const userId  = session.data.session?.user?.id
        if (userId) {
          const [orgRes, partRes] = await Promise.all([
            fetch(`${API}/competitions/organizer/${userId}`),
            fetch(`${API}/competitions/participant/${userId}`),
          ])
          if (orgRes.ok)  setOrganizedComps(await orgRes.json())
          if (partRes.ok) setParticipatedComps(await partRes.json())
        }
      } catch (err) {
        console.error('[UpdateProfilePage] load:', err)
        setErrorMsg('Failed to load profile data.')
      } finally {
        setLoading(false)
      }
    }

    loadAll()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authReady])

  // ── Close skills dropdown on outside click ───────────────────────────────────
  useEffect(() => {
    function handleClick(e) {
      if (skillRef.current && !skillRef.current.contains(e.target)) {
        setSkillDropdown(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  // ── Skills helpers ───────────────────────────────────────────────────────────
  const suggestions = PREDEFINED_SKILLS.filter(
    s => s.toLowerCase().includes(skillInput.toLowerCase()) && !skills.includes(s)
  )

  function addSkill(s) {
    const trimmed = s.trim()
    if (trimmed && !skills.includes(trimmed)) setSkills(prev => [...prev, trimmed])
    setSkillInput('')
    setSkillDropdown(false)
  }

  function removeSkill(s) {
    setSkills(prev => prev.filter(x => x !== s))
  }

  // ── Profile picture preview ──────────────────────────────────────────────────
  function handlePictureFile(e) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = ev => {
      setPicturePreview(ev.target.result)
      setProfilePicture(ev.target.result)
    }
    reader.readAsDataURL(file)
  }

  // ── Save profile ─────────────────────────────────────────────────────────────
  async function handleSave() {
    setSaving(true)
    setSuccess('')
    setErrorMsg('')
    try {
      const res = await fetch(`${API}/profile/me`, {
        method: 'PUT',
        headers: authHeaders(),
        body: JSON.stringify({
          name,
          profile_picture: profilePicture,   // ← was avatar_url
          bio,
          institution,
          skills,
          linkedin_url: linkedinUrl,
          github_url:   githubUrl,
          website_url:  websiteUrl,
        }),
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.detail || 'Save failed')
      }
      setSuccess('Profile saved successfully!')
      setTimeout(() => setSuccess(''), 3000)
    } catch (err) {
      console.error('[UpdateProfilePage] save:', err)
      setErrorMsg(err.message || 'Failed to save profile.')
    } finally {
      setSaving(false)
    }
  }

  // ── Experience helpers ───────────────────────────────────────────────────────
  function startEditExp(exp) {
    setEditingExpId(exp.id)
    setExpForm({
      title:        exp.title || '',
      organization: exp.organization || '',
      start_year:   exp.start_year || '',
      end_year:     exp.end_year || '',
      description:  exp.description || '',
    })
    setShowExpForm(true)
    setExpError('')
  }

  function cancelExp() {
    setShowExpForm(false)
    setEditingExpId(null)
    setExpForm(EMPTY_EXP)
    setExpError('')
  }

  async function submitExp() {
    if (!expForm.title.trim()) { setExpError('Title is required.'); return }
    if (!expForm.start_year)   { setExpError('Start year is required.'); return }

    setExpSaving(true)
    setExpError('')

    const body = {
      title:        expForm.title.trim(),
      organization: expForm.organization.trim() || null,
      start_year:   parseInt(expForm.start_year),
      end_year:     expForm.end_year ? parseInt(expForm.end_year) : null,
      description:  expForm.description.trim() || null,
    }

    try {
      let res
      if (editingExpId) {
        res = await fetch(`${API}/profile/me/experience/${editingExpId}`, {
          method: 'PUT',
          headers: authHeaders(),
          body: JSON.stringify(body),
        })
      } else {
        res = await fetch(`${API}/profile/me/experience`, {
          method: 'POST',
          headers: authHeaders(),
          body: JSON.stringify(body),
        })
      }

      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.detail || 'Failed to save experience')
      }

      const saved = await res.json()
      if (editingExpId) {
        setExperiences(prev => prev.map(e => e.id === editingExpId ? saved : e))
      } else {
        setExperiences(prev => [saved, ...prev])
      }
      cancelExp()
    } catch (err) {
      setExpError(err.message || 'Something went wrong.')
    } finally {
      setExpSaving(false)
    }
  }

  async function removeExp(expId) {
    try {
      const res = await fetch(`${API}/profile/me/experience/${expId}`, {
        method: 'DELETE',
        headers: authHeaders(),
      })
      if (!res.ok) throw new Error('Delete failed')
      setExperiences(prev => prev.filter(e => e.id !== expId))
    } catch (err) {
      console.error('[UpdateProfilePage] delete exp:', err)
      setErrorMsg('Failed to delete experience.')
    }
  }

  // ── Render ───────────────────────────────────────────────────────────────────
  if (!authReady || loading) return (
    <div className="p-shell">
      <Sidebar />
      <div className="p-content p-center">
        <div className="p-spinner" />
        <p className="p-muted">Loading…</p>
      </div>
    </div>
  )

  return (
    <div className="p-shell">
      <Sidebar />

      <div className="p-content">

        {/* ── Page header ── */}
        <div className="p-page-header">
          <div>
            <h1 className="p-page-title">Update Profile</h1>
            <p className="p-page-subtitle">Update your public profile information.</p>
          </div>
          <button
            className="p-btn p-btn--ghost p-btn--with-icon"
            onClick={() => navigate('/profile')}
            type="button"
          >
            <ArrowLeftIcon /> Back to Profile
          </button>
        </div>

        {/* ── Basic Information ── */}
        <section className="ps-section">
          <h2 className="ps-section-title">Basic Information</h2>
          <div className="ps-basic-grid">

            {/* Profile picture */}
            <div className="ps-avatar-wrap">
              {picturePreview ? (
                <img src={picturePreview} alt="profile" className="p-avatar p-avatar--xl" />
              ) : (
                <div className="p-avatar p-avatar--xl p-avatar--ph">
                  {name?.charAt(0)?.toUpperCase() || '?'}
                </div>
              )}
              <button
                className="ps-avatar-btn"
                onClick={() => fileRef.current?.click()}
                type="button"
              >
                <CameraIcon /> Change Photo
              </button>
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                hidden
                onChange={handlePictureFile}
              />
            </div>

            {/* Fields */}
            <div className="ps-basic-fields">
              <label className="p-label">
                Institution / Organization
                <input
                  type="text"
                  className="p-input"
                  value={institution}
                  onChange={e => setInstitution(e.target.value)}
                  placeholder="Stanford University"
                />
              </label>
              <label className="p-label">
                Full Name
                <input
                  type="text"
                  className="p-input"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  placeholder="Dr. Jane Doe"
                />
              </label>
              <label className="p-label">
                Website
                <input
                  type="url"
                  className="p-input"
                  placeholder="https://yourwebsite.com"
                  value={websiteUrl}
                  onChange={e => setWebsite(e.target.value)}
                />
              </label>
            </div>
          </div>
        </section>

        {/* ── Bio & Social Links ── */}
        <section className="ps-section">
          <h2 className="ps-section-title">Bio &amp; Links</h2>
          <label className="p-label">
            Biography
            <textarea
              className="p-input p-textarea"
              rows={4}
              maxLength={500}
              placeholder="Write a short bio about yourself…"
              value={bio}
              onChange={e => setBio(e.target.value)}
            />
            <span className="p-char-count">{bio.length}/500</span>
          </label>
          <div className="ps-links-grid">
            <label className="p-label">
              LinkedIn
              <input
                type="url"
                className="p-input"
                placeholder="https://linkedin.com/in/..."
                value={linkedinUrl}
                onChange={e => setLinkedin(e.target.value)}
              />
            </label>
            <label className="p-label">
              GitHub
              <input
                type="url"
                className="p-input"
                placeholder="https://github.com/..."
                value={githubUrl}
                onChange={e => setGithub(e.target.value)}
              />
            </label>
          </div>
        </section>

        {/* ── Technical Proficiency ── */}
        <section className="ps-section">
          <h2 className="ps-section-title">Technical Proficiency</h2>
          <p className="ps-section-desc">Pick from suggestions or type a custom skill.</p>

          <div className="ps-skills-editor" ref={skillRef}>
            {skills.length > 0 && (
              <div className="p-tags p-tags--edit">
                {skills.map(s => (
                  <span key={s} className="p-tag p-tag--editable">
                    {s}
                    <button
                      className="p-tag-remove"
                      onClick={() => removeSkill(s)}
                      type="button"
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
            )}
            <div className="ps-skill-input-wrap">
              <input
                type="text"
                className="p-input"
                placeholder="Add a skill (e.g. PyTorch) or type custom…"
                value={skillInput}
                onChange={e => { setSkillInput(e.target.value); setSkillDropdown(true) }}
                onFocus={() => setSkillDropdown(true)}
                onKeyDown={e => {
                  if (e.key === 'Enter')  { e.preventDefault(); addSkill(skillInput) }
                  if (e.key === 'Escape') setSkillDropdown(false)
                }}
              />
              {skillDropdown && (suggestions.length > 0 || skillInput.trim()) && (
                <ul className="ps-skill-dropdown">
                  {skillInput.trim() && !PREDEFINED_SKILLS.includes(skillInput.trim()) && (
                    <li
                      className="ps-skill-opt ps-skill-opt--custom"
                      onClick={() => addSkill(skillInput)}
                    >
                      Add "{skillInput.trim()}"
                    </li>
                  )}
                  {suggestions.map(s => (
                    <li key={s} className="ps-skill-opt" onClick={() => addSkill(s)}>{s}</li>
                  ))}
                </ul>
              )}
            </div>
          </div>
          <p className="p-hint">Press Enter or select from suggestions.</p>
        </section>

        {/* ── Experience ── */}
        <section className="ps-section">
          <h2 className="ps-section-title">Experience</h2>

          {experiences.length > 0 && (
            <div className="ps-exp-list">
              {experiences.map(exp => (
                <div key={exp.id} className="ps-exp-item">
                  <div className="ps-exp-info">
                    <p className="p-exp-title">{exp.title}</p>
                    {exp.organization && (
                      <p className="p-exp-org">{exp.organization}</p>
                    )}
                    <p className="p-exp-years">
                      {exp.start_year} – {exp.end_year ?? 'Present'}
                    </p>
                    {exp.description && (
                      <p className="p-exp-desc">{exp.description}</p>
                    )}
                  </div>
                  <div className="ps-exp-actions">
                    <button
                      className="p-btn p-btn--ghost p-btn--sm"
                      onClick={() => startEditExp(exp)}
                      type="button"
                    >
                      Edit
                    </button>
                    <button
                      className="p-btn p-btn--danger p-btn--sm"
                      onClick={() => removeExp(exp.id)}
                      type="button"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {!showExpForm && (
            <button
              className="p-btn p-btn--secondary"
              onClick={() => setShowExpForm(true)}
              type="button"
            >
              + Add Experience
            </button>
          )}

          {showExpForm && (
            <div className="ps-exp-form">
              <h4 className="ps-exp-form-title">
                {editingExpId ? 'Edit Experience' : 'Add Experience'}
              </h4>
              {expError && <p className="p-msg p-msg--error">{expError}</p>}

              <label className="p-label">
                Job Title *
                <input
                  className="p-input"
                  type="text"
                  placeholder="Senior Researcher"
                  value={expForm.title}
                  onChange={e => setExpForm(f => ({ ...f, title: e.target.value }))}
                />
              </label>
              <label className="p-label">
                Organization
                <input
                  className="p-input"
                  type="text"
                  placeholder="Stanford University"
                  value={expForm.organization}
                  onChange={e => setExpForm(f => ({ ...f, organization: e.target.value }))}
                />
              </label>
              <div className="ps-exp-form-row">
                <label className="p-label">
                  Start Year *
                  <input
                    className="p-input"
                    type="number"
                    placeholder="2020"
                    min="1950"
                    max="2100"
                    value={expForm.start_year}
                    onChange={e => setExpForm(f => ({ ...f, start_year: e.target.value }))}
                  />
                </label>
                <label className="p-label">
                  End Year (blank = current)
                  <input
                    className="p-input"
                    type="number"
                    placeholder="2023"
                    min="1950"
                    max="2100"
                    value={expForm.end_year}
                    onChange={e => setExpForm(f => ({ ...f, end_year: e.target.value }))}
                  />
                </label>
              </div>
              <label className="p-label">
                Description
                <textarea
                  className="p-input p-textarea"
                  rows={3}
                  placeholder="What did you do in this role?"
                  value={expForm.description}
                  onChange={e => setExpForm(f => ({ ...f, description: e.target.value }))}
                />
              </label>
              <div className="ps-exp-form-actions">
                <button
                  className="p-btn p-btn--primary"
                  onClick={submitExp}
                  disabled={expSaving}
                  type="button"
                >
                  {expSaving ? 'Saving…' : editingExpId ? 'Update' : 'Add'}
                </button>
                <button
                  className="p-btn p-btn--ghost"
                  onClick={cancelExp}
                  type="button"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </section>

        {/* ── Competitions (read-only) ── */}
        <section className="ps-section">
          <h2 className="ps-section-title">Competitions</h2>

          {organizedComps.length > 0 && (
            <>
              <h3 className="ps-section-title" style={{ fontSize: '14px', marginBottom: '10px' }}>
                Organized
              </h3>
              <div className="ps-comp-list" style={{ marginBottom: '20px' }}>
                {organizedComps.map(comp => (
                  <div key={comp.id} className="ps-comp-item">
                    <span className="ps-comp-badge ps-comp-badge--organizer">Organizer</span>
                    <div>
                      <p className="ps-comp-name">{comp.title}</p>
                      {comp.date && <p className="ps-comp-sub">{comp.date}</p>}
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}

          {participatedComps.length > 0 && (
            <>
              <h3 className="ps-section-title" style={{ fontSize: '14px', marginBottom: '10px' }}>
                Participated
              </h3>
              <div className="ps-comp-list">
                {participatedComps.map(comp => (
                  <div key={comp.id} className="ps-comp-item">
                    <span className="ps-comp-badge ps-comp-badge--participant">Participant</span>
                    <div>
                      <p className="ps-comp-name">{comp.title}</p>
                      {comp.date && <p className="ps-comp-sub">{comp.date}</p>}
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}

          {organizedComps.length === 0 && participatedComps.length === 0 && (
            <p className="p-empty">No competitions yet.</p>
          )}

          <p className="ps-comp-readonly">
            Competitions are automatically added when you organize or participate in one.
          </p>
        </section>

        {/* ── Save row ── */}
        <div className="ps-save-row">
          {successMsg && <p className="p-msg p-msg--success">{successMsg}</p>}
          {errorMsg   && <p className="p-msg p-msg--error">{errorMsg}</p>}
          <button
            className="p-btn p-btn--primary"
            onClick={handleSave}
            disabled={saving}
            type="button"
          >
            {saving ? 'Saving…' : 'Save Changes'}
          </button>
        </div>

      </div>
    </div>
  )
}
