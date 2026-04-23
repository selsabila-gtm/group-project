import React from 'react'


const LinkedInIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
    <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
  </svg>
)

const GitHubIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
    <path d="M12 0C5.374 0 0 5.373 0 12c0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23A11.509 11.509 0 0112 5.803c1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576C20.566 21.797 24 17.3 24 12c0-6.627-5.373-12-12-12z"/>
  </svg>
)

const LinkIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71"/>
    <path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71"/>
  </svg>
)

const LocationIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z"/>
    <circle cx="12" cy="10" r="3"/>
  </svg>
)

const BuildingIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/>
    <polyline points="9 22 9 12 15 12 15 22"/>
  </svg>
)

function formatYearRange(start, end) {
  if (!start) return ''
  return `${start} – ${end ?? 'Present'}`
}

export default function ProfileOverview({ profileData }) {
  const { user, profile, experiences, organizedCompetitions, participatedCompetitions } = profileData

  const links = [
    { url: profile.linkedin_url, label: 'LinkedIn', icon: <LinkedInIcon /> },
    { url: profile.github_url, label: 'GitHub', icon: <GitHubIcon /> },
    { url: profile.website_url, label: 'Research Profile', icon: <LinkIcon /> },
  ].filter((l) => l.url)

  return (
    <div className="profile-overview">

      <aside className="profile-overview__sidebar">
        <div className="profile-sidebar-card">
          {user.avatar_url ? (
            <img src={user.avatar_url} alt={user.name} className="avatar avatar--xl" />
          ) : (
            <div className="avatar avatar--xl avatar--placeholder">
              {user.name?.charAt(0).toUpperCase() || '?'}
            </div>
          )}
          <h2 className="profile-sidebar-card__name">{user.name}</h2>
          <p className="profile-sidebar-card__role">{user.role}</p>
          <div className="profile-sidebar-card__meta">
            {profile.country && (
              <span className="meta-item"><LocationIcon /> {profile.country}</span>
            )}
            {profile.institution && (
              <span className="meta-item"><BuildingIcon /> {profile.institution}</span>
            )}
          </div>
          {links.length > 0 && (
            <div className="profile-sidebar-card__links">
              {links.map((link) => (
                <a key={link.label} href={link.url} target="_blank" rel="noopener noreferrer" className="profile-link">
                  {link.icon}
                  <span>{link.label}</span>
                </a>
              ))}
            </div>
          )}
        </div>
      </aside>

      <main className="profile-overview__main">

        <section className="profile-section">
          <h3 className="profile-section__title">Biography</h3>
          <p className="profile-section__bio">{profile.bio || 'No bio added yet.'}</p>
        </section>

        <section className="profile-section">
          <h3 className="profile-section__title">Technical Proficiency</h3>
          {profile.skills?.length > 0 ? (
            <div className="skill-tags">
              {profile.skills.map((skill) => (
                <span key={skill} className="skill-tag">{skill}</span>
              ))}
            </div>
          ) : (
            <p className="profile-section__empty">No skills added yet.</p>
          )}
        </section>

        <section className="profile-section">
          <h3 className="profile-section__title">Experience</h3>
          {experiences.length > 0 ? (
            <ul className="experience-list">
              {experiences.map((exp) => (
                <li key={exp.id} className="experience-item">
                  <div className="experience-item__header">
                    <div>
                      <p className="experience-item__title">{exp.title}</p>
                      <p className="experience-item__org">{exp.organization}</p>
                    </div>
                    <span className="experience-item__years">{formatYearRange(exp.start_year, exp.end_year)}</span>
                  </div>
                  {exp.description && <p className="experience-item__desc">{exp.description}</p>}
                </li>
              ))}
            </ul>
          ) : (
            <p className="profile-section__empty">No experience added yet.</p>
          )}
        </section>

        <section className="profile-section">
          <h3 className="profile-section__title">Organized Competitions</h3>
          {organizedCompetitions.length > 0 ? (
            <div className="competition-grid">
              {organizedCompetitions.map((comp) => (
                <div key={comp.id} className="competition-card">
                  <p className="competition-card__title">{comp.title}</p>
                  <p className="competition-card__role">Role: Lead Organizer</p>
                </div>
              ))}
            </div>
          ) : (
            <p className="profile-section__empty">No competitions organized yet.</p>
          )}
        </section>

        <section className="profile-section">
          <h3 className="profile-section__title">Participated Competitions</h3>
          {participatedCompetitions.length > 0 ? (
            <div className="competition-grid">
              {participatedCompetitions.map((comp) => (
                <div key={comp.id} className="competition-card">
                  <p className="competition-card__title">{comp.title}</p>
                </div>
              ))}
            </div>
          ) : (
            <p className="profile-section__empty">No competitions participated in yet.</p>
          )}
        </section>

      </main>
    </div>
  )
}