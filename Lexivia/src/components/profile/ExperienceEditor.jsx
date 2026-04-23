import React, { useState } from 'react'

const EMPTY_FORM = { title: '', organization: '', start_year: '', end_year: '', description: '' }

export default function ExperienceEditor({ experiences, onAdd, onUpdate, onDelete }) {
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  function handleChange(field, value) {
    setForm((prev) => ({ ...prev, [field]: value }))
  }

  function startEdit(exp) {
    setEditingId(exp.id)
    setForm({
      title: exp.title || '',
      organization: exp.organization || '',
      start_year: exp.start_year || '',
      end_year: exp.end_year || '',
      description: exp.description || '',
    })
    setShowForm(true)
  }

  function cancelForm() {
    setShowForm(false)
    setEditingId(null)
    setForm(EMPTY_FORM)
    setError('')
  }

  async function handleSubmit() {
    if (!form.title.trim()) { setError('Title is required.'); return }
    if (!form.start_year) { setError('Start year is required.'); return }
    setSaving(true)
    setError('')
    const payload = {
      title: form.title.trim(),
      organization: form.organization.trim(),
      start_year: parseInt(form.start_year),
      end_year: form.end_year ? parseInt(form.end_year) : null,
      description: form.description.trim(),
    }
    const result = editingId
      ? await onUpdate(editingId, payload)
      : await onAdd(payload)
    setSaving(false)
    if (result.error) { setError('Failed to save. Please try again.'); return }
    cancelForm()
  }

  async function handleDelete(id) {
    if (!window.confirm('Delete this experience?')) return
    await onDelete(id)
  }

  return (
    <div className="experience-editor">
      {experiences.map((exp) => (
        <div key={exp.id} className="experience-editor__item">
          <div className="experience-editor__item-info">
            <p className="experience-item__title">{exp.title}</p>
            <p className="experience-item__org">{exp.organization}</p>
            <p className="experience-item__years">
              {exp.start_year} – {exp.end_year ?? 'Present'}
            </p>
          </div>
          <div className="experience-editor__item-actions">
            <button className="btn btn--ghost btn--sm" onClick={() => startEdit(exp)} type="button">Edit</button>
            <button className="btn btn--danger btn--sm" onClick={() => handleDelete(exp.id)} type="button">Delete</button>
          </div>
        </div>
      ))}

      {!showForm && (
        <button className="btn btn--secondary" onClick={() => setShowForm(true)} type="button">
          + Add Experience
        </button>
      )}

      {showForm && (
        <div className="experience-editor__form">
          <h4>{editingId ? 'Edit Experience' : 'Add Experience'}</h4>
          {error && <p className="msg msg--error">{error}</p>}
          <label className="field-label">
            Job Title *
            <input className="field-input" type="text" placeholder="Senior Researcher" value={form.title} onChange={(e) => handleChange('title', e.target.value)} />
          </label>
          <label className="field-label">
            Organization
            <input className="field-input" type="text" placeholder="Stanford University" value={form.organization} onChange={(e) => handleChange('organization', e.target.value)} />
          </label>
          <div className="experience-editor__form-row">
            <label className="field-label">
              Start Year *
              <input className="field-input" type="number" placeholder="2020" min="1950" max="2100" value={form.start_year} onChange={(e) => handleChange('start_year', e.target.value)} />
            </label>
            <label className="field-label">
              End Year (leave blank if current)
              <input className="field-input" type="number" placeholder="2023" min="1950" max="2100" value={form.end_year} onChange={(e) => handleChange('end_year', e.target.value)} />
            </label>
          </div>
          <label className="field-label">
            Description
            <textarea className="field-input field-textarea" rows={3} placeholder="What did you do in this role?" value={form.description} onChange={(e) => handleChange('description', e.target.value)} />
          </label>
          <div className="experience-editor__form-actions">
            <button className="btn btn--primary" onClick={handleSubmit} disabled={saving} type="button">
              {saving ? 'Saving…' : editingId ? 'Update' : 'Add'}
            </button>
            <button className="btn btn--ghost" onClick={cancelForm} type="button">Cancel</button>
          </div>
        </div>
      )}
    </div>
  )
}