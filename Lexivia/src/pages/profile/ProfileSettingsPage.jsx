/**
 * ProfileSettingsPage.jsx  —  Edit your profile (bio, avatar, skills, experience)
 *
 * Route:  /profile/settings
 *
 * ─── AUTH TODO (1 change when auth is ready) ────────────────────────────────
 *  Find "// 🔐 USER_ID" and replace:
 *    const USER_ID = 1
 *  with:
 *    const { currentUser } = useAuth()
 *    const USER_ID = currentUser?.id
 * ─────────────────────────────────────────────────────────────────────────────
 */

import React, { useEffect, useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../config/supabase'
import Sidebar from '../../components/Sidebar'   // 🔧 adjust path if needed
import '../../styles/profile.css'                // single shared CSS file

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

// ─── Direct Supabase queries ───────────────────────────────────────────────────
async function fetchProfile(userId) {
  try {
    const { data: user, error: e1 } = await supabase
      .from('users')
      .select('id, name, email, avatar_url, role')
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

    return { data: { user, profile: profile ?? {}, experiences: experiences ?? [] }, error: null }
  } catch (err) {
    return { data: null, error: err }
  }
}

async function saveUserInfo(userId, updates) {
  const { data, error } = await supabase
    .from('users').update(updates).eq('id', userId).select().single()
  return { data, error }
}

async function saveUserProfile(userId, profileData) {
  const { data, error } = await supabase
    .from('user_profiles')
    .upsert(
      { user_id: userId, ...profileData, updated_at: new Date().toISOString() },
      { onConflict: 'user_id' }
    )
    .select().single()
  return { data, error }
}

async function uploadAvatar(userId, file) {
  const ext  = file.name.split('.').pop()
  const path = `avatars/${userId}.${ext}`
  const { error } = await supabase.storage.from('avatars').upload(path, file, { upsert: true })
  if (error) return { url: null, error }
  const { data } = supabase.storage.from('avatars').getPublicUrl(path)
  return { url: data.publicUrl, error: null }
}

async function addExperience(userId, exp) {
  const { data, error } = await supabase
    .from('user_experiences').insert({ user_id: userId, ...exp }).select().single()
  return { data, error }
}

async function updateExperience(id, updates) {
  const { data, error } = await supabase
    .from('user_experiences').update(updates).eq('id', id).select().single()
  return { data, error }
}

async function deleteExperience(id) {
  const { error } = await supabase.from('user_experiences').delete().eq('id', id)
  return { error }
}

// ─── Page Component ────────────────────────────────────────────────────────────
const EMPTY_EXP = { title: '', organization: '', start_year: '', end_year: '', description: '' }

export default function ProfileSettingsPage() {
  const navigate = useNavigate()

  // 🔐 USER_ID — replace with auth context when ready (see file header)
  const USER_ID = 1

  const [loading, setLoading]   = useState(true)
  const [saving, setSaving]     = useState(false)
  const [successMsg, setSuccess] = useState('')
  const [errorMsg, setErrorMsg]  = useState('')

  // ── form state ──────────────────────────────────────────────────────────────
  const [name, setName]               = useState('')
  const [avatarUrl, setAvatarUrl]     = useState('')
  const [avatarFile, setAvatarFile]   = useState(null)
  const [avatarPreview, setAvatarPreview] = useState('')
  const [bio, setBio]                 = useState('')
  const [institution, setInstitution] = useState('')
  const [country, setCountry]         = useState('')
  const [skills, setSkills]           = useState([])
  const [linkedinUrl, setLinkedin]    = useState('')
  const [githubUrl, setGithub]        = useState('')
  const [websiteUrl, setWebsite]      = useState('')
  const [experiences, setExperiences] = useState([])

  // ── experience form state ────────────────────────────────────────────────────
  const [showExpForm, setShowExpForm]   = useState(false)
  const [editingExpId, setEditingExpId] = useState(null)
  const [expForm, setExpForm]           = useState(EMPTY_EXP)
  const [expSaving, setExpSaving]       = useState(false)
  const [expError, setExpError]         = useState('')

  // ── skills input state ───────────────────────────────────────────────────────
  const [skillInput, setSkillInput]       = useState('')
  const [skillDropdown, setSkillDropdown] = useState(false)
  const skillRef  = useRef(null)
  const fileRef   = useRef(null)

  // ── load data ────────────────────────────────────────────────────────────────
  useEffect(() => {
  async function loadProfile() {
    setLoading(true)

    const { data, error } = await fetchProfile(USER_ID)

    if (error) {
      console.error(error)
      setLoading(false)
      return
    }

    if (data) {
      const { user, profile, experiences: exps } = data

      setName(user.name || '')
      setAvatarUrl(user.avatar_url || '')
      setAvatarPreview(user.avatar_url || '')
      setBio(profile.bio || '')
      setInstitution(profile.institution || '')
      setCountry(profile.country || '')
      setSkills(profile.skills || [])
      setLinkedin(profile.linkedin_url || '')
      setGithub(profile.github_url || '')
      setWebsite(profile.website_url || '')
      setExperiences(exps || [])
    }

    setLoading(false)
  }

  loadProfile() // ✅ MUST be inside

}, [USER_ID])
  // ── close skill dropdown on outside click ────────────────────────────────────
  useEffect(() => {
    const fn = e => { if (skillRef.current && !skillRef.current.contains(e.target)) setSkillDropdown(false) }
    document.addEventListener('mousedown', fn)
    return () => document.removeEventListener('mousedown', fn)
  }, [])

  // ── handlers ─────────────────────────────────────────────────────────────────
  function handleAvatarChange(e) {
    const file = e.target.files[0]
    if (!file) return
    setAvatarFile(file)
    setAvatarPreview(URL.createObjectURL(file))
  }

  async function handleSave() {
    setSaving(true); setSuccess(''); setErrorMsg('')
    try {
      let finalAvatar = avatarUrl
      if (avatarFile) {
        const { url, error } = await uploadAvatar(USER_ID, avatarFile)
        if (error) throw new Error('Avatar upload failed')
        finalAvatar = url
      }
      const { error: e1 } = await saveUserInfo(USER_ID, { name, avatar_url: finalAvatar })
      if (e1) throw new Error('Failed to save basic info')

      const { error: e2 } = await saveUserProfile(USER_ID, {
        bio, institution, country, skills,
        linkedin_url: linkedinUrl, github_url: githubUrl, website_url: websiteUrl,
      })
      if (e2) throw new Error('Failed to save profile details')

      setAvatarFile(null)
      setAvatarUrl(finalAvatar)
      setSuccess('Profile saved successfully!')
    } catch (err) {
      setErrorMsg(err.message || 'Something went wrong.')
    } finally {
      setSaving(false)
    }
  }

  // ── skills ───────────────────────────────────────────────────────────────────
  const suggestions = PREDEFINED_SKILLS.filter(
    s => !skills.includes(s) && s.toLowerCase().includes(skillInput.toLowerCase())
  )
  function addSkill(s) {
    const t = s.trim()
    if (!t || skills.includes(t)) return
    setSkills([...skills, t]); setSkillInput(''); setSkillDropdown(false)
  }
  function removeSkill(s) { setSkills(skills.filter(x => x !== s)) }

  // ── experience ───────────────────────────────────────────────────────────────
  function startEditExp(exp) {
    setEditingExpId(exp.id)
    setExpForm({ title: exp.title||'', organization: exp.organization||'',
      start_year: exp.start_year||'', end_year: exp.end_year||'', description: exp.description||'' })
    setShowExpForm(true)
  }
  function cancelExp() { setShowExpForm(false); setEditingExpId(null); setExpForm(EMPTY_EXP); setExpError('') }

  async function submitExp() {
    if (!expForm.title.trim()) { setExpError('Title is required.'); return }
    if (!expForm.start_year)   { setExpError('Start year is required.'); return }
    setExpSaving(true); setExpError('')
    const payload = {
      title: expForm.title.trim(),
      organization: expForm.organization.trim(),
      start_year: parseInt(expForm.start_year),
      end_year: expForm.end_year ? parseInt(expForm.end_year) : null,
      description: expForm.description.trim(),
    }
    if (editingExpId) {
      const { data, error } = await updateExperience(editingExpId, payload)
      if (error) { setExpError('Failed to save.'); setExpSaving(false); return }
      setExperiences(prev => prev.map(e => e.id === editingExpId ? data : e))
    } else {
      const { data, error } = await addExperience(USER_ID, payload)
      if (error) { setExpError('Failed to save.'); setExpSaving(false); return }
      setExperiences(prev => [data, ...prev])
    }
    setExpSaving(false); cancelExp()
  }

  async function removeExp(id) {
    if (!window.confirm('Delete this experience?')) return
    const { error } = await deleteExperience(id)
    if (!error) setExperiences(prev => prev.filter(e => e.id !== id))
  }

  // ── render ───────────────────────────────────────────────────────────────────
  if (loading) return (
    <div className="p-shell">
      <Sidebar />
      <div className="p-content p-center">
        <div className="p-spinner" /><p className="p-muted">Loading settings…</p>
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
            <h1 className="p-page-title">Profile Settings</h1>
            <p className="p-page-subtitle">Manage your public profile and account information.</p>
          </div>
          <button className="p-btn p-btn--ghost p-btn--with-icon" onClick={() => navigate('/profile')}>
            <ArrowLeftIcon /> Back to Profile
          </button>
        </div>

        <div className="ps-body">

          {/* ── Basic Information ── */}
          <section className="ps-section">
            <h2 className="ps-section-title">Basic Information</h2>
            <div className="ps-avatar-row">
              <div className="ps-avatar-col">
                {avatarPreview ? (
                  <img src={avatarPreview} alt="Avatar" className="p-avatar p-avatar--lg" />
                ) : (
                  <div className="p-avatar p-avatar--lg p-avatar--ph">
                    {name.charAt(0).toUpperCase() || '?'}
                  </div>
                )}
                <button className="p-btn p-btn--ghost p-btn--sm p-btn--with-icon"
                  onClick={() => fileRef.current?.click()} type="button">
                  <CameraIcon /> Change Photo
                </button>
                <input ref={fileRef} type="file" accept="image/*"
                  onChange={handleAvatarChange} style={{ display: 'none' }} />
              </div>

              <div className="ps-fields">
                <label className="p-label">
                  Full Name
                  <input type="text" className="p-input" value={name}
                    onChange={e => setName(e.target.value)} placeholder="Dr. Jane Doe" />
                </label>
                <label className="p-label">
                  Institution / Organization
                  <input type="text" className="p-input" value={institution}
                    onChange={e => setInstitution(e.target.value)} placeholder="Stanford University" />
                </label>
                <label className="p-label">
                  Country
                  <input type="text" className="p-input" value={country}
                    onChange={e => setCountry(e.target.value)} placeholder="United States" />
                </label>
              </div>
            </div>
          </section>

          {/* ── Bio & Links ── */}
          <section className="ps-section">
            <h2 className="ps-section-title">Bio & Links</h2>
            <label className="p-label">
              Biography
              <textarea className="p-input p-textarea" rows={4} maxLength={500}
                placeholder="Write a short bio about yourself…"
                value={bio} onChange={e => setBio(e.target.value)} />
              <span className="p-char-count">{bio.length}/500</span>
            </label>
            <div className="ps-links-grid">
              <label className="p-label">
                LinkedIn
                <input type="url" className="p-input" placeholder="https://linkedin.com/in/..."
                  value={linkedinUrl} onChange={e => setLinkedin(e.target.value)} />
              </label>
              <label className="p-label">
                GitHub
                <input type="url" className="p-input" placeholder="https://github.com/..."
                  value={githubUrl} onChange={e => setGithub(e.target.value)} />
              </label>
              <label className="p-label">
                Website / Research Profile
                <input type="url" className="p-input" placeholder="https://researchgate.net/..."
                  value={websiteUrl} onChange={e => setWebsite(e.target.value)} />
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
                      <button className="p-tag-remove" onClick={() => removeSkill(s)} type="button">×</button>
                    </span>
                  ))}
                </div>
              )}
              <div className="ps-skill-input-wrap">
                <input type="text" className="p-input" placeholder="Add a skill (e.g. PyTorch) or type custom…"
                  value={skillInput}
                  onChange={e => { setSkillInput(e.target.value); setSkillDropdown(true) }}
                  onFocus={() => setSkillDropdown(true)}
                  onKeyDown={e => {
                    if (e.key === 'Enter') { e.preventDefault(); addSkill(skillInput) }
                    if (e.key === 'Escape') setSkillDropdown(false)
                  }}
                />
                {skillDropdown && (suggestions.length > 0 || skillInput.trim()) && (
                  <ul className="ps-skill-dropdown">
                    {skillInput.trim() && !PREDEFINED_SKILLS.includes(skillInput.trim()) && (
                      <li className="ps-skill-opt ps-skill-opt--custom" onClick={() => addSkill(skillInput)}>
                        Add "{skillInput.trim()}"
                      </li>
                    )}
                    {suggestions.map(s => (
                      <li key={s} className="ps-skill-opt" onClick={() => addSkill(s)}>{s}</li>
                    ))}
                  </ul>
                )}
              </div>
              <p className="p-hint">Press Enter or select from suggestions.</p>
            </div>
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
                      <p className="p-exp-org">{exp.organization}</p>
                      <p className="p-exp-years">{exp.start_year} – {exp.end_year ?? 'Present'}</p>
                    </div>
                    <div className="ps-exp-actions">
                      <button className="p-btn p-btn--ghost p-btn--sm"
                        onClick={() => startEditExp(exp)} type="button">Edit</button>
                      <button className="p-btn p-btn--danger p-btn--sm"
                        onClick={() => removeExp(exp.id)} type="button">Delete</button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {!showExpForm && (
              <button className="p-btn p-btn--secondary" onClick={() => setShowExpForm(true)} type="button">
                + Add Experience
              </button>
            )}

            {showExpForm && (
              <div className="ps-exp-form">
                <h4 className="ps-exp-form-title">{editingExpId ? 'Edit Experience' : 'Add Experience'}</h4>
                {expError && <p className="p-msg p-msg--error">{expError}</p>}

                <label className="p-label">
                  Job Title *
                  <input className="p-input" type="text" placeholder="Senior Researcher"
                    value={expForm.title}
                    onChange={e => setExpForm(f => ({ ...f, title: e.target.value }))} />
                </label>
                <label className="p-label">
                  Organization
                  <input className="p-input" type="text" placeholder="Stanford University"
                    value={expForm.organization}
                    onChange={e => setExpForm(f => ({ ...f, organization: e.target.value }))} />
                </label>
                <div className="ps-exp-form-row">
                  <label className="p-label">
                    Start Year *
                    <input className="p-input" type="number" placeholder="2020" min="1950" max="2100"
                      value={expForm.start_year}
                      onChange={e => setExpForm(f => ({ ...f, start_year: e.target.value }))} />
                  </label>
                  <label className="p-label">
                    End Year (blank = current)
                    <input className="p-input" type="number" placeholder="2023" min="1950" max="2100"
                      value={expForm.end_year}
                      onChange={e => setExpForm(f => ({ ...f, end_year: e.target.value }))} />
                  </label>
                </div>
                <label className="p-label">
                  Description
                  <textarea className="p-input p-textarea" rows={3} placeholder="What did you do in this role?"
                    value={expForm.description}
                    onChange={e => setExpForm(f => ({ ...f, description: e.target.value }))} />
                </label>
                <div className="ps-exp-form-actions">
                  <button className="p-btn p-btn--primary" onClick={submitExp} disabled={expSaving} type="button">
                    {expSaving ? 'Saving…' : editingExpId ? 'Update' : 'Add'}
                  </button>
                  <button className="p-btn p-btn--ghost" onClick={cancelExp} type="button">Cancel</button>
                </div>
              </div>
            )}
          </section>

          {/* ── Save row ── */}
          <div className="ps-save-row">
            {successMsg && <p className="p-msg p-msg--success">{successMsg}</p>}
            {errorMsg   && <p className="p-msg p-msg--error">{errorMsg}</p>}
            <button className="p-btn p-btn--primary" onClick={handleSave} disabled={saving}>
              {saving ? 'Saving…' : 'Save Changes'}
            </button>
          </div>

        </div>
      </div>
    </div>
  )
}
