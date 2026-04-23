import React, { useState, useRef, useEffect } from 'react'
import './SkillsEditor.css'

export default function SkillsEditor({ skills = [], onSkillsChange, suggestions = [] }) {
  const [inputValue, setInputValue] = useState('')
  const [showDropdown, setShowDropdown] = useState(false)
  const wrapperRef = useRef(null)

  useEffect(() => {
    function handleClickOutside(e) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) {
        setShowDropdown(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const filteredSuggestions = suggestions.filter(
    (s) => !skills.includes(s) && s.toLowerCase().includes(inputValue.toLowerCase())
  )

  function addSkill(skill) {
    const trimmed = skill.trim()
    if (!trimmed || skills.includes(trimmed)) return
    onSkillsChange([...skills, trimmed])
    setInputValue('')
    setShowDropdown(false)
  }

  function removeSkill(skill) {
    onSkillsChange(skills.filter((s) => s !== skill))
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter') { e.preventDefault(); addSkill(inputValue) }
    else if (e.key === 'Escape') setShowDropdown(false)
  }

  return (
    <div className="skills-editor" ref={wrapperRef}>
      <div className="skills-editor__tags">
        {skills.map((skill) => (
          <span key={skill} className="skill-tag skill-tag--editable">
            {skill}
            <button className="skill-tag__remove" onClick={() => removeSkill(skill)} type="button">×</button>
          </span>
        ))}
      </div>

      <div className="skills-editor__input-wrapper">
        <input
          type="text"
          className="field-input"
          placeholder="Add a skill (e.g. PyTorch) or type custom…"
          value={inputValue}
          onChange={(e) => { setInputValue(e.target.value); setShowDropdown(true) }}
          onFocus={() => setShowDropdown(true)}
          onKeyDown={handleKeyDown}
        />
        {showDropdown && (filteredSuggestions.length > 0 || inputValue.trim()) && (
          <ul className="skills-editor__dropdown">
            {inputValue.trim() && !suggestions.includes(inputValue.trim()) && (
              <li className="skills-editor__dropdown-item skills-editor__dropdown-item--custom" onClick={() => addSkill(inputValue)}>
                Add "{inputValue.trim()}"
              </li>
            )}
            {filteredSuggestions.map((s) => (
              <li key={s} className="skills-editor__dropdown-item" onClick={() => addSkill(s)}>{s}</li>
            ))}
          </ul>
        )}
      </div>
      <p className="skills-editor__hint">Press Enter or select from suggestions.</p>
    </div>
  )
}