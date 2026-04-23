import React from 'react'
import './BioLinksEditor.css'

export default function BioLinksEditor({
  bio, onBioChange,
  linkedinUrl, onLinkedinChange,
  githubUrl, onGithubChange,
  websiteUrl, onWebsiteChange,
}) {
  return (
    <div className="bio-links-editor">
      <label className="field-label">
        Biography
        <textarea
          className="field-input field-textarea"
          rows={4}
          maxLength={500}
          placeholder="Write a short bio about yourself…"
          value={bio}
          onChange={(e) => onBioChange(e.target.value)}
        />
        <span className="field-char-count">{bio.length}/500</span>
      </label>

      <div className="bio-links-editor__links">
        <label className="field-label">
          LinkedIn
          <input type="url" className="field-input" placeholder="https://linkedin.com/in/your-name" value={linkedinUrl} onChange={(e) => onLinkedinChange(e.target.value)} />
        </label>
        <label className="field-label">
          GitHub
          <input type="url" className="field-input" placeholder="https://github.com/your-username" value={githubUrl} onChange={(e) => onGithubChange(e.target.value)} />
        </label>
        <label className="field-label">
          Website / Research Profile
          <input type="url" className="field-input" placeholder="https://researchgate.net/profile/..." value={websiteUrl} onChange={(e) => onWebsiteChange(e.target.value)} />
        </label>
      </div>
    </div>
  )
}