import { useState } from 'react';
import { authFetch } from '../utils/authFetch';
import './CreateTeamModal.css';

export default function CreateTeamModal({ isOpen, onClose, onCreated }) {
  const [name, setName]               = useState('');
  const [description, setDescription] = useState('');
  const [loading, setLoading]         = useState(false);
  const [error, setError]             = useState(null);

  if (!isOpen) return null;

  async function handleCreate() {
    if (!name.trim()) {
      setError('Team name is required');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // POST to the FastAPI backend — it handles inserting into teams + team_members
      await authFetch('/teams', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name:        name.trim(),
          description: description.trim(),
        }),
      });

      // Reset + close
      setName('');
      setDescription('');
      onCreated(); // refresh teams list
      onClose();

    } catch (err) {
      setError(err.message || 'Failed to create team');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="modal-overlay">
      <div className="modal">
        <h2>Create Team</h2>

        {error && (
          <div style={{
            padding: '9px 12px', borderRadius: 7, fontSize: 12.5, marginBottom: 10,
            background: '#fff0f0', color: '#c33', border: '1px solid #fcc',
          }}>
            {error}
          </div>
        )}

        <label>TEAM NAME</label>
        <input
          type="text"
          placeholder="Enter team name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
        />

        <label>DESCRIPTION</label>
        <textarea
          placeholder="Describe your team..."
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />

        <div className="modal-actions">
          <button className="btn-cancel" onClick={onClose} disabled={loading}>
            Cancel
          </button>
          <button className="btn-create" onClick={handleCreate} disabled={loading}>
            {loading ? 'Creating…' : 'Create'}
          </button>
        </div>
      </div>
    </div>
  );
}