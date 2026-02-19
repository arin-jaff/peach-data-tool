import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { getSessions, deleteSession, renameSession, updateSession } from '../api';
import type { Session } from '../types';

export default function HomePage() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [filterType, setFilterType] = useState<string>('all');

  const WORKOUT_TYPES = ['T2', 'T3', 'T4', 'T5', 'T6', 'Race'];

  const loadSessions = async () => {
    try {
      setLoading(true);
      const data = await getSessions();
      setSessions(data);
    } catch {
      setError('Failed to load sessions');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSessions();
  }, []);

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this session?')) return;
    try {
      await deleteSession(id);
      setSessions(sessions.filter((s) => s.id !== id));
    } catch {
      alert('Failed to delete session');
    }
  };

  const startRename = (session: Session) => {
    setEditingId(session.id);
    setEditName(session.name);
  };

  const saveRename = async (id: string) => {
    if (!editName.trim()) return;
    try {
      const updated = await renameSession(id, editName.trim());
      setSessions(sessions.map((s) => (s.id === id ? { ...s, name: updated.name } : s)));
      setEditingId(null);
    } catch {
      alert('Failed to rename session');
    }
  };

  const cancelRename = () => {
    setEditingId(null);
  };

  const handleWorkoutTypeChange = async (id: string, workoutType: string) => {
    try {
      const updated = await updateSession(id, { workout_type: workoutType });
      setSessions(sessions.map((s) => (s.id === id ? { ...s, workout_type: updated.workout_type } : s)));
    } catch {
      alert('Failed to update workout type');
    }
  };

  const filteredSessions =
    filterType === 'all'
      ? sessions
      : filterType === 'none'
        ? sessions.filter((s) => !s.workout_type)
        : sessions.filter((s) => s.workout_type === filterType);

  if (loading) {
    return <div className="text-gray-500 py-8 text-sm">Loading sessions...</div>;
  }

  if (error) {
    return <div className="text-red-600 py-4 text-sm">{error}</div>;
  }

  if (sessions.length === 0) {
    return (
      <div className="py-8 text-sm text-gray-500">
        No sessions yet.{' '}
        <Link to="/upload" className="text-gray-700 underline">
          Upload a CSV
        </Link>{' '}
        to get started.
      </div>
    );
  }

  return (
    <div>
      {/* Header (title only — actions live in the persistent top bar) */}
      <div className="flex items-center justify-between mb-3">
        <h1 className="text-lg font-semibold text-gray-800">Sessions</h1>
      </div>

      {/* Filter Buttons */}
      <div className="flex items-center gap-1.5 mb-3 text-xs">
        <span className="text-gray-500">Filter:</span>
        {['all', ...WORKOUT_TYPES, 'none'].map((t) => (
          <button
            key={t}
            onClick={() => setFilterType(t)}
            className={`px-2 py-0.5 rounded ${
              filterType === t ? 'bg-gray-700 text-white' : 'bg-gray-200 text-gray-600 hover:bg-gray-300'
            }`}
          >
            {t === 'all' ? 'All' : t === 'none' ? 'Unset' : t}
          </button>
        ))}
      </div>

      {/* Sessions Table */}
      <table className="w-full text-sm border border-gray-300">
        <thead>
          <tr className="bg-gray-100 border-b border-gray-300">
            <th className="text-left px-3 py-2 font-medium text-gray-600">Name</th>
            <th className="text-left px-3 py-2 font-medium text-gray-600">Date</th>
            <th className="text-left px-3 py-2 font-medium text-gray-600">Type</th>
            <th className="text-left px-3 py-2 font-medium text-gray-600">Seats</th>
            <th className="text-right px-3 py-2 font-medium text-gray-600">Actions</th>
          </tr>
        </thead>
        <tbody>
          {filteredSessions.map((session) => (
            <tr key={session.id} className="border-b border-gray-200 hover:bg-gray-50">
              <td className="px-3 py-2">
                {editingId === session.id ? (
                  <span className="flex items-center gap-1">
                    <input
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') saveRename(session.id);
                        if (e.key === 'Escape') cancelRename();
                      }}
                      className="border border-gray-300 px-1.5 py-0.5 rounded text-sm w-64"
                      autoFocus
                    />
                    <button
                      onClick={() => saveRename(session.id)}
                      className="bg-gray-200 hover:bg-gray-300 text-gray-700 px-2 py-0.5 rounded text-xs"
                    >
                      Save
                    </button>
                    <button onClick={cancelRename} className="text-gray-500 hover:text-gray-700 px-1 text-xs">
                      Cancel
                    </button>
                  </span>
                ) : (
                  <span
                    className="cursor-pointer hover:underline text-gray-900"
                    onDoubleClick={() => startRename(session)}
                    title="Double-click to rename"
                  >
                    {session.name}
                  </span>
                )}
              </td>

              <td className="px-3 py-2 text-gray-500">{session.start_time || '-'}</td>

              <td className="px-3 py-2">
                <select
                  value={session.workout_type || ''}
                  onChange={(e) => handleWorkoutTypeChange(session.id, e.target.value)}
                  className="text-xs border border-gray-300 rounded px-1 py-0.5 bg-white"
                >
                  <option value="">--</option>
                  {WORKOUT_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </td>

              <td className="px-3 py-2 text-gray-500">{session.boat_seats}</td>

              <td className="px-3 py-2 text-right">
                <span className="flex items-center justify-end gap-1">
                  <Link
                    to={`/dashboard/${session.id}`}
                    className="bg-gray-200 hover:bg-gray-300 text-gray-700 px-2.5 py-1 rounded text-xs"
                  >
                    View
                  </Link>
                  <button
                    onClick={() => startRename(session)}
                    className="bg-gray-200 hover:bg-gray-300 text-gray-700 px-2.5 py-1 rounded text-xs"
                  >
                    Rename
                  </button>
                  <button
                    onClick={() => handleDelete(session.id)}
                    className="bg-gray-200 hover:bg-gray-300 text-gray-700 px-2.5 py-1 rounded text-xs"
                  >
                    Delete
                  </button>
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}