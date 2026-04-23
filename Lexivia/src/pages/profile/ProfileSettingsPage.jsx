import React, { useEffect, useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  getFullProfile, updateUserInfo, upsertUserProfile,
  uploadAvatar, addExperience, updateExperience,
  deleteExperience, PREDEFINED_SKILLS,
} from '../../services/profileService'
import SkillsEditor from '../../components/profile/SkillsEditor'
import BioLinksEditor from '../../components/profile/BioLinksEditor'
import ExperienceEditor from '../../components/profile/ExperienceEditor'
import './ProfileSettingsPage.css'

export default function ProfileSettingsPage() {
  const navigate = useNavigate()

  // TODO: replace with real auth context
  // const { currentUser } = useAuth()
  // const userId = currentUser?.supabaseId
  //const userId = 'PLACEHOLDER_USER_ID'
const userId = 1
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [successMsg, setSuccessMsg] = useState('')
  const [errorMsg, setErrorMsg] = useState('')

  const [name, setName] = useState('')
  const [avatarUrl, setAvatarUrl] = useState('')
  const [avatarFile, setAvatarFile] = useState(null)
  const [avatarPreview, setAvatarPreview] = useState('')
  const [bio, setBio] = useState('')
  const [institution, setInstitution] = useState('')
  const [country, setCountry] = useState('')
  const [skills, setSkills] = useState([])
  const [linkedinUrl, setLinkedinUrl] = useState('')
  const [githubUrl, setGithubUrl] = useState('')
  const [websiteUrl, setWebsiteUrl] = useState('')
  const [experiences, setExperiences] = useState([])

  const fileInputRef = useRef(null)

  useEffect(() => {
    if (!userId || userId === 'PLACEHOLDER_USER_ID') return
    async function load() {
      setLoading(true)
      const { data } = await getFullProfile(userId)
      if (data) {
        const { user, profile, experiences: exps } = data
        setName(user.name || '')
        setAvatarUrl(user.avatar_url || '')
        setAvatarPreview(user.avatar_url || '')
        setBio(profile.bio || '')
        setInstitution(profile.institution || '')
        setCountry(profile.country || '')
        setSkills(profile.skills || [])
        setLinkedinUrl(profile.linkedin_url || '')
        setGithubUrl(profile.github_url || '')
        setWebsiteUrl(profile.website_url || '')
        setExperiences(exps || [])
      }
      setLoading(false)
    }
    load()
  }, [userId])

  function handleAvatarChange(e) {
    const file = e.target.files[0]
    if (!file) return
    setAvatarFile(file)
    setAvatarPreview(URL.createObjectURL(file))
  }

  async function handleSave() {
    setSaving(true)
    setSuccessMsg('')
    setErrorMsg('')
    try {
      let finalAvatarUrl = avatarUrl
      if (avatarFile) {
        const { url, error: uploadError } = await uploadAvatar(userId, avatarFile)
        if (uploadError) throw new Error('Avatar upload failed')
        finalAvatarUrl = url
      }
      const { error: userError } = await updateUserInfo(userId, { name, avatar_url: finalAvatarUrl })
      if (userError) throw new Error('Failed to save basic info')

      const { error: profileError } = await upsertUserProfile(userId, {
        bio, institution, country, skills,
        linkedin_url: linkedinUrl, github_url: githubUrl, website_url: websiteUrl,
      })
      if (profileError) throw new Error('Failed to save profile details')

      setSuccessMsg('Profile saved successfully!')
      setAvatarFile(null)
    } catch (err) {
      setErrorMsg(err.message || 'Something went wrong. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  async function handleAddExperience(expData) {
    const { data, error } = await addExperience(userId, expData)
    if (!error && data) setExperiences((prev) => [data, ...prev])
    return { error }
  }

  async function handleUpdateExperience(id, updates) {
    const { data, error } = await updateExperience(id, updates)
    if (!error && data) setExperiences((prev) => prev.map((e) => (e.id === id ? data : e)))
    return { error }
  }

  async function handleDeleteExperience(id) {
    const { error } = await deleteExperience(id)
    if (!error) setExperiences((prev) => prev.filter((e) => e.id !== id))
    return { error }
  }

  if (loading) {
    return (
      <div className="settings-page-loading">
        <div className="loading-spinner" />
        <p>Loading settings…</p>
      </div>
    )
  }

  return (
    <div className="settings-page">
      <div className="settings-page__header">
        <button className="btn btn--ghost" onClick={() => navigate('/profile')}>
          ← Back to Profile
        </button>
        <h1>Profile Settings</h1>
        <p>Manage your public profile and account information.</p>
      </div>

      <div className="settings-page__body">

        <section className="settings-section">
          <h2 className="settings-section__title">Basic Information</h2>
          <div className="settings-section__avatar-row">
            <div className="avatar-wrapper">
              {avatarPreview ? (
                <img src={avatarPreview} alt="Avatar" className="avatar avatar--lg" />
              ) : (
                <div className="avatar avatar--lg avatar--placeholder">
                  {name.charAt(0).toUpperCase() || '?'}
                </div>
              )}
              <button className="avatar-change-btn" onClick={() => fileInputRef.current?.click()} type="button">
                Change Photo
              </button>
              <input ref={fileInputRef} type="file" accept="image/*" onChange={handleAvatarChange} style={{ display: 'none' }} />
            </div>
            <div className="settings-section__fields">
              <label className="field-label">
                Full Name
                <input type="text" className="field-input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Dr. Jane Doe" />
              </label>
              <label className="field-label">
                Institution / Organization
                <input type="text" className="field-input" value={institution} onChange={(e) => setInstitution(e.target.value)} placeholder="Stanford University" />
              </label>
              <label className="field-label">
                Country
                <input type="text" className="field-input" value={country} onChange={(e) => setCountry(e.target.value)} placeholder="United States" />
              </label>
            </div>
          </div>
        </section>

        <section className="settings-section">
          <h2 className="settings-section__title">Bio & Links</h2>
          <BioLinksEditor
            bio={bio} onBioChange={setBio}
            linkedinUrl={linkedinUrl} onLinkedinChange={setLinkedinUrl}
            githubUrl={githubUrl} onGithubChange={setGithubUrl}
            websiteUrl={websiteUrl} onWebsiteChange={setWebsiteUrl}
          />
        </section>

        <section className="settings-section">
          <h2 className="settings-section__title">Technical Proficiency</h2>
          <p className="settings-section__desc">Pick from suggestions or type a custom skill.</p>
          <SkillsEditor skills={skills} onSkillsChange={setSkills} suggestions={PREDEFINED_SKILLS} />
        </section>

        <section className="settings-section">
          <h2 className="settings-section__title">Experience</h2>
          <ExperienceEditor
            experiences={experiences}
            onAdd={handleAddExperience}
            onUpdate={handleUpdateExperience}
            onDelete={handleDeleteExperience}
          />
        </section>

        <div className="settings-page__save-row">
          {successMsg && <p className="msg msg--success">{successMsg}</p>}
          {errorMsg && <p className="msg msg--error">{errorMsg}</p>}
          <button className="btn btn--primary" onClick={handleSave} disabled={saving}>
            {saving ? 'Saving…' : 'Save Changes'}
          </button>
        </div>

      </div>
    </div>
  )
}