export default function ExperienceSection({ experiences }) {
  if (!experiences || experiences.length === 0) {
    return (
      <div>
        <h3>Experience</h3>
        <p className="empty-text">No experience added yet.</p>
      </div>
    )
  }

  return (
    <div>
      <h3>Experience</h3>
      {experiences.map(exp => (
        <div key={exp.id} className="experience-entry">
          <div className="exp-header">
            <div>
              <p className="exp-title">{exp.title}</p>
              <p className="exp-org-name">{exp.organization}</p>
            </div>
            <span className="exp-date-range">
              {exp.start_year} – {exp.end_year ?? 'Present'}
            </span>
          </div>
          {exp.description && <p className="exp-description">{exp.description}</p>}
        </div>
      ))}
    </div>
  )
}