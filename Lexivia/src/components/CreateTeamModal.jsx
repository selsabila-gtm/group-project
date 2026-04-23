import { useState } from 'react';
import { supabase } from '../config/supabase';
import './CreateTeamModal.css';

export default function CreateTeamModal({ isOpen, onClose, onCreated, userId }) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  if (!isOpen) return null;

  async function handleCreate() {
    if (!name.trim()) {
      setError('Team name is required');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // 1. Create team
      const { data: team, error: teamErr } = await supabase
        .from('teams')
        .insert({
          name: name.trim(),
          description: description.trim(),
          created_at: new Date().toISOString(),
          created_by: userId,
        })
        .select()
        .single();

      if (teamErr) throw teamErr;

      // 2. Add creator as leader
      const { error: memberErr } = await supabase
        .from('team_members')
        .insert({
          team_id: team.id,
          user_id: userId,
          role: 'leader',
          joined_at: new Date().toISOString(),
        });

      if (memberErr) throw memberErr;

      // Reset + close
      setName('');
      setDescription('');
      onCreated(); // refresh teams
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

    <label>TEAM NAME</label>
    <input
      type="text"
      placeholder="Enter team name"
      value={name}
      onChange={(e) => setName(e.target.value)}
    />

    <label>DESCRIPTION</label>
    <textarea
      placeholder="Describe your team..."
      value={description}
      onChange={(e) => setDescription(e.target.value)}
    />

    <div className="modal-actions">
      <button className="btn-cancel" onClick={onClose}>
        Cancel
      </button>
      <button className="btn-create" onClick={handleCreate}>
        Create
      </button>
    </div>
  </div>
</div>
  );
}