import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend
} from 'recharts';
import { getGlobalAthlete, getAthleteTrends, updateGlobalAthlete } from '../api';
import type { GlobalAthleteDetail, AthleteTrends } from '../types';

export default function AthleteDetailPage() {
  const { athleteId } = useParams<{ athleteId: string }>();
  const [athlete, setAthlete] = useState<GlobalAthleteDetail | null>(null);
  const [trends, setTrends] = useState<AthleteTrends | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Edit state
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState('');
  const [editUni, setEditUni] = useState('');
  const [editSquad, setEditSquad] = useState('');
  const [editWeight, setEditWeight] = useState('');

  useEffect(() => {
    if (!athleteId) return;
    (async () => {
      try {
        setLoading(true);
        const [detail, trendData] = await Promise.all([
          getGlobalAthlete(athleteId),
          getAthleteTrends(athleteId),
        ]);
        setAthlete(detail);
        setTrends(trendData);
      } catch {
        setError('Failed to load athlete data');
      } finally {
        setLoading(false);
      }
    })();
  }, [athleteId]);

  const startEdit = () => {
    if (!athlete) return;
    setEditName(athlete.name);
    setEditUni(athlete.uni || '');
    setEditSquad(athlete.squad || '');
    setEditWeight(athlete.weight != null ? String(athlete.weight) : '');
    setEditing(true);
  };

  const saveEdit = async () => {
    if (!athlete || !athleteId) return;
    try {
      const updates: Record<string, string | number> = {};
      if (editName.trim() && editName.trim() !== athlete.name) updates.name = editName.trim();
      if (editUni.trim() !== (athlete.uni || '')) updates.uni = editUni.trim();
      if (editSquad.trim() !== (athlete.squad || '')) updates.squad = editSquad.trim();
      const w = editWeight.trim() ? parseFloat(editWeight.trim()) : undefined;
      if (w !== undefined && w !== athlete.weight) updates.weight = w;

      if (Object.keys(updates).length > 0) {
        await updateGlobalAthlete(athleteId, updates);
        const detail = await getGlobalAthlete(athleteId);
        setAthlete(detail);
      }
      setEditing(false);
    } catch {
      alert('Failed to update athlete');
    }
  };

  if (loading) {
    return <div className="text-gray-500 py-8 text-sm">Loading athlete...</div>;
  }

  if (error || !athlete) {
    return <div className="text-red-600 py-4 text-sm">{error || 'Athlete not found'}</div>;
  }

  const chartData = (trends?.data_points || []).map((dp, i) => ({
    label: dp.piece_name || dp.session_name || `Piece ${i + 1}`,
    power: dp.avg_power,
    effectiveLength: dp.avg_effective_length,
    strokeLength: dp.avg_stroke_length,
    catchSlip: dp.avg_catch_slip,
    finishSlip: dp.avg_finish_slip,
  }));

  return (
    <div>
      <Link to="/athletes" className="text-gray-500 hover:text-gray-700 text-xs mb-2 inline-block">
        &larr; Back to Athletes
      </Link>

      {/* Header */}
      <div className="border border-gray-300 rounded p-3 mb-4">
        {editing ? (
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <label className="text-xs text-gray-500 w-14">Name</label>
              <input
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                className="border border-gray-300 px-2 py-1 rounded text-sm flex-1"
              />
            </div>
            <div className="flex items-center gap-2">
              <label className="text-xs text-gray-500 w-14">UNI</label>
              <input
                value={editUni}
                onChange={(e) => setEditUni(e.target.value)}
                className="border border-gray-300 px-2 py-1 rounded text-sm font-mono w-32"
              />
            </div>
            <div className="flex items-center gap-2">
              <label className="text-xs text-gray-500 w-14">Squad</label>
              <input
                value={editSquad}
                onChange={(e) => setEditSquad(e.target.value)}
                className="border border-gray-300 px-2 py-1 rounded text-sm w-20"
              />
            </div>
            <div className="flex items-center gap-2">
              <label className="text-xs text-gray-500 w-14">Weight</label>
              <input
                value={editWeight}
                onChange={(e) => setEditWeight(e.target.value)}
                className="border border-gray-300 px-2 py-1 rounded text-sm w-20"
                type="number"
              />
            </div>
            <div className="flex gap-1 pt-1">
              <button
                onClick={saveEdit}
                className="bg-gray-200 hover:bg-gray-300 text-gray-700 px-3 py-1 rounded text-xs"
              >
                Save
              </button>
              <button
                onClick={() => setEditing(false)}
                className="text-gray-500 hover:text-gray-700 px-2 py-1 text-xs"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-lg font-semibold text-gray-800">{athlete.name}</h1>
              <div className="text-sm text-gray-500 space-x-3 mt-1">
                {athlete.uni && <span className="font-mono">{athlete.uni}</span>}
                {athlete.squad && <span>{athlete.squad.toUpperCase()}</span>}
                {athlete.weight != null && <span>{athlete.weight} lbs</span>}
                <span>{athlete.session_count} session{athlete.session_count !== 1 ? 's' : ''}</span>
              </div>
            </div>
            <button
              onClick={startEdit}
              className="bg-gray-200 hover:bg-gray-300 text-gray-700 px-2.5 py-1 rounded text-xs"
            >
              Edit
            </button>
          </div>
        )}
      </div>

      {/* Session History */}
      {athlete.sessions.length > 0 && (
        <div className="mb-4">
          <h2 className="text-sm font-medium text-gray-600 mb-1">Session History</h2>
          <table className="w-full text-sm border border-gray-300">
            <thead>
              <tr className="bg-gray-100 border-b border-gray-300">
                <th className="text-left px-3 py-2 font-medium text-gray-600">Session</th>
                <th className="text-left px-3 py-2 font-medium text-gray-600">Date</th>
                <th className="text-left px-3 py-2 font-medium text-gray-600">Seat</th>
                <th className="text-left px-3 py-2 font-medium text-gray-600">Side</th>
              </tr>
            </thead>
            <tbody>
              {athlete.sessions.map((s, i) => (
                <tr key={i} className="border-b border-gray-200 hover:bg-gray-50">
                  <td className="px-3 py-2">
                    <Link
                      to={`/dashboard/${s.session_id}`}
                      className="text-gray-900 hover:underline"
                    >
                      {s.session_name}
                    </Link>
                  </td>
                  <td className="px-3 py-2 text-gray-500">{s.session_date || '-'}</td>
                  <td className="px-3 py-2 text-gray-500">{s.seat_position}</td>
                  <td className="px-3 py-2 text-gray-500">{s.side || '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Trend Charts */}
      {chartData.length > 0 && (
        <div className="space-y-4">
          <h2 className="text-sm font-medium text-gray-600">Performance Trends</h2>

          {/* Power */}
          <div className="border border-gray-300 rounded p-3">
            <h3 className="text-xs font-medium text-gray-500 mb-2">Power (W)</h3>
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis dataKey="label" tick={{ fontSize: 10 }} angle={-30} textAnchor="end" height={50} />
                <YAxis tick={{ fontSize: 10 }} />
                <Tooltip contentStyle={{ fontSize: 12 }} />
                <Line type="monotone" dataKey="power" stroke="#6B7280" strokeWidth={2} dot={{ r: 3 }} name="Avg Power" />
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* Effective Length & Stroke Length */}
          <div className="border border-gray-300 rounded p-3">
            <h3 className="text-xs font-medium text-gray-500 mb-2">Length (deg)</h3>
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis dataKey="label" tick={{ fontSize: 10 }} angle={-30} textAnchor="end" height={50} />
                <YAxis tick={{ fontSize: 10 }} />
                <Tooltip contentStyle={{ fontSize: 12 }} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Line type="monotone" dataKey="strokeLength" stroke="#9CA3AF" strokeWidth={1.5} dot={{ r: 2 }} name="Stroke Length" />
                <Line type="monotone" dataKey="effectiveLength" stroke="#6B7280" strokeWidth={2} dot={{ r: 3 }} name="Effective Length" />
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* Catch & Finish Slip */}
          <div className="border border-gray-300 rounded p-3">
            <h3 className="text-xs font-medium text-gray-500 mb-2">Slip (deg)</h3>
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis dataKey="label" tick={{ fontSize: 10 }} angle={-30} textAnchor="end" height={50} />
                <YAxis tick={{ fontSize: 10 }} />
                <Tooltip contentStyle={{ fontSize: 12 }} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Line type="monotone" dataKey="catchSlip" stroke="#EF4444" strokeWidth={1.5} dot={{ r: 2 }} name="Catch Slip" />
                <Line type="monotone" dataKey="finishSlip" stroke="#3B82F6" strokeWidth={1.5} dot={{ r: 2 }} name="Finish Slip" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {chartData.length === 0 && !loading && (
        <div className="text-gray-500 text-sm py-4">No performance data available yet.</div>
      )}
    </div>
  );
}
