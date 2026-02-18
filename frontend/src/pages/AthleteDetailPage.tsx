import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend
} from 'recharts';
import { getGlobalAthlete, getAthleteTrends, updateGlobalAthlete, getAthleteMeasurements, updateAthleteMeasurements } from '../api';
import type { GlobalAthleteDetail, AthleteTrends, AthleteMeasurements } from '../types';

const CLASS_YEARS = ['2025', '2026', '2027', '2028', '2029', '2030'];

export default function AthleteDetailPage() {
  const { athleteId } = useParams<{ athleteId: string }>();
  const [athlete, setAthlete] = useState<GlobalAthleteDetail | null>(null);
  const [trends, setTrends] = useState<AthleteTrends | null>(null);
  const [measurements, setMeasurements] = useState<AthleteMeasurements | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Edit state
  const [editing, setEditing] = useState(false);
  const [editFields, setEditFields] = useState<Record<string, string>>({});
  const [editMeasurements, setEditMeasurements] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!athleteId) return;
    (async () => {
      try {
        setLoading(true);
        const [detail, trendData, measData] = await Promise.all([
          getGlobalAthlete(athleteId),
          getAthleteTrends(athleteId),
          getAthleteMeasurements(athleteId),
        ]);
        setAthlete(detail);
        setTrends(trendData);
        setMeasurements(measData);
      } catch {
        setError('Failed to load athlete data');
      } finally {
        setLoading(false);
      }
    })();
  }, [athleteId]);

  const startEdit = () => {
    if (!athlete) return;
    setEditFields({
      name: athlete.name || '',
      first_name: athlete.first_name || '',
      last_name: athlete.last_name || '',
      uni: athlete.uni || '',
      squad: athlete.squad || '',
      weight: athlete.weight != null ? String(athlete.weight) : '',
      dob: athlete.dob || '',
      class_year: athlete.class_year || '',
      erg_2k_recent: athlete.erg_2k_recent || '',
      erg_2k_pb: athlete.erg_2k_pb || '',
      erg_40min_recent: athlete.erg_40min_recent || '',
      erg_40min_pb: athlete.erg_40min_pb || '',
      erg_6k_recent: athlete.erg_6k_recent || '',
      erg_6k_pb: athlete.erg_6k_pb || '',
    });
    setEditMeasurements({
      height: measurements?.height != null ? String(measurements.height) : '',
      wingspan: measurements?.wingspan != null ? String(measurements.wingspan) : '',
      trunk_length: measurements?.trunk_length != null ? String(measurements.trunk_length) : '',
      r_humerus: measurements?.r_humerus != null ? String(measurements.r_humerus) : '',
      l_humerus: measurements?.l_humerus != null ? String(measurements.l_humerus) : '',
      r_forearm: measurements?.r_forearm != null ? String(measurements.r_forearm) : '',
      l_forearm: measurements?.l_forearm != null ? String(measurements.l_forearm) : '',
      r_femur: measurements?.r_femur != null ? String(measurements.r_femur) : '',
      l_femur: measurements?.l_femur != null ? String(measurements.l_femur) : '',
      r_tibia: measurements?.r_tibia != null ? String(measurements.r_tibia) : '',
      l_tibia: measurements?.l_tibia != null ? String(measurements.l_tibia) : '',
    });
    setEditing(true);
  };

  const saveEdit = async () => {
    if (!athlete || !athleteId) return;
    try {
      // Save athlete fields
      const updates: Record<string, string | number> = {};
      const strFields = ['name', 'first_name', 'last_name', 'uni', 'squad', 'dob', 'class_year',
        'erg_2k_recent', 'erg_2k_pb', 'erg_40min_recent', 'erg_40min_pb', 'erg_6k_recent', 'erg_6k_pb'];
      for (const f of strFields) {
        const current = ((athlete as unknown) as Record<string, unknown>)[f] || '';
        if (editFields[f] !== current) {
          updates[f] = editFields[f];
        }
      }
      const w = editFields.weight.trim() ? parseFloat(editFields.weight.trim()) : undefined;
      if (w !== undefined && w !== athlete.weight) updates.weight = w;

      if (Object.keys(updates).length > 0) {
        await updateGlobalAthlete(athleteId, updates);
      }

      // Save measurements
      const measUpdates: Record<string, number | undefined> = {};
      for (const [key, val] of Object.entries(editMeasurements)) {
        const num = val.trim() ? parseFloat(val.trim()) : undefined;
        if (num !== undefined) {
          measUpdates[key] = num;
        }
      }
      if (Object.keys(measUpdates).length > 0) {
        const updatedMeas = await updateAthleteMeasurements(athleteId, measUpdates);
        setMeasurements(updatedMeas);
      }

      const detail = await getGlobalAthlete(athleteId);
      setAthlete(detail);
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

  function editRow(label: string, field: string, opts?: { type?: string; mono?: boolean; width?: string }) {
    return (
      <div className="flex items-center gap-2" key={field}>
        <label className="text-xs text-gray-500 w-28 shrink-0">{label}</label>
        <input
          value={editFields[field] || ''}
          onChange={(e) => setEditFields({ ...editFields, [field]: e.target.value })}
          className={`border border-gray-300 px-2 py-1 rounded text-sm ${opts?.mono ? 'font-mono' : ''} ${opts?.width || 'flex-1'}`}
          type={opts?.type || 'text'}
        />
      </div>
    );
  }

  function measRow(label: string, field: string) {
    return (
      <div className="flex items-center gap-2" key={field}>
        <label className="text-xs text-gray-500 w-28 shrink-0">{label}</label>
        <input
          value={editMeasurements[field] || ''}
          onChange={(e) => setEditMeasurements({ ...editMeasurements, [field]: e.target.value })}
          className="border border-gray-300 px-2 py-1 rounded text-sm w-24"
          type="number"
          step="0.1"
        />
      </div>
    );
  }

  function infoItem(label: string, value: string | number | null | undefined, suffix?: string) {
    if (value == null || value === '') return null;
    return <span className="text-gray-500">{label}: <strong className="text-gray-800">{value}{suffix || ''}</strong></span>;
  }

  return (
    <div>
      <Link to="/athletes" className="text-gray-500 hover:text-gray-700 text-xs mb-2 inline-block">
        &larr; Back to Athletes
      </Link>

      {/* Header */}
      <div className="border border-gray-300 rounded p-3 mb-4">
        {editing ? (
          <div className="space-y-4">
            {/* Personal Info */}
            <div>
              <h3 className="text-xs font-semibold text-gray-700 mb-2 uppercase tracking-wide">Personal Info</h3>
              <div className="grid grid-cols-2 gap-2">
                {editRow('Full Name', 'name')}
                {editRow('First Name', 'first_name')}
                {editRow('Last Name', 'last_name')}
                {editRow('UNI', 'uni', { mono: true, width: 'w-32' })}
                {editRow('Squad', 'squad', { width: 'w-24' })}
                {editRow('Weight (lbs)', 'weight', { type: 'number', width: 'w-24' })}
                {editRow('Date of Birth', 'dob', { type: 'date', width: 'w-40' })}
                <div className="flex items-center gap-2">
                  <label className="text-xs text-gray-500 w-28 shrink-0">Class Year</label>
                  <select
                    value={editFields.class_year || ''}
                    onChange={(e) => setEditFields({ ...editFields, class_year: e.target.value })}
                    className="border border-gray-300 px-2 py-1 rounded text-sm w-24"
                  >
                    <option value="">--</option>
                    {CLASS_YEARS.map((y) => <option key={y} value={y}>{y}</option>)}
                  </select>
                </div>
              </div>
            </div>

            {/* Erg Scores */}
            <div>
              <h3 className="text-xs font-semibold text-gray-700 mb-2 uppercase tracking-wide">Erg Scores</h3>
              <div className="grid grid-cols-2 gap-2">
                {editRow('2K Recent', 'erg_2k_recent', { width: 'w-28' })}
                {editRow('2K PB', 'erg_2k_pb', { width: 'w-28' })}
                {editRow("40' Recent", 'erg_40min_recent', { width: 'w-28' })}
                {editRow("40' PB", 'erg_40min_pb', { width: 'w-28' })}
                {editRow('6K Recent', 'erg_6k_recent', { width: 'w-28' })}
                {editRow('6K PB', 'erg_6k_pb', { width: 'w-28' })}
              </div>
            </div>

            {/* Measurements */}
            <div>
              <h3 className="text-xs font-semibold text-gray-700 mb-2 uppercase tracking-wide">Anthropometric Measurements</h3>
              <div className="grid grid-cols-2 gap-2">
                {measRow('Height', 'height')}
                {measRow('Wingspan', 'wingspan')}
                {measRow('Trunk Length', 'trunk_length')}
                {measRow('R Humerus', 'r_humerus')}
                {measRow('L Humerus', 'l_humerus')}
                {measRow('R Forearm', 'r_forearm')}
                {measRow('L Forearm', 'l_forearm')}
                {measRow('R Femur', 'r_femur')}
                {measRow('L Femur', 'l_femur')}
                {measRow('R Tibia', 'r_tibia')}
                {measRow('L Tibia', 'l_tibia')}
              </div>
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
          <div>
            <div className="flex items-start justify-between">
              <div>
                <h1 className="text-lg font-semibold text-gray-800">{athlete.name}</h1>
                <div className="text-sm text-gray-500 space-x-3 mt-1 flex flex-wrap gap-y-1">
                  {athlete.uni && <span className="font-mono">{athlete.uni}</span>}
                  {athlete.squad && <span>{athlete.squad.toUpperCase()}</span>}
                  {athlete.weight != null && <span>{athlete.weight} lbs</span>}
                  {athlete.class_year && <span>Class of {athlete.class_year}</span>}
                  {athlete.dob && <span>DOB: {athlete.dob}</span>}
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

            {/* Erg Scores display */}
            {(athlete.erg_2k_recent || athlete.erg_2k_pb || athlete.erg_40min_recent || athlete.erg_40min_pb || athlete.erg_6k_recent || athlete.erg_6k_pb) && (
              <div className="mt-3 pt-2 border-t border-gray-200">
                <h3 className="text-xs font-semibold text-gray-500 mb-1 uppercase tracking-wide">Erg Scores</h3>
                <div className="text-xs space-x-4 flex flex-wrap gap-y-1">
                  {infoItem('2K', athlete.erg_2k_recent)}
                  {infoItem('2K PB', athlete.erg_2k_pb)}
                  {infoItem("40'", athlete.erg_40min_recent)}
                  {infoItem("40' PB", athlete.erg_40min_pb)}
                  {infoItem('6K', athlete.erg_6k_recent)}
                  {infoItem('6K PB', athlete.erg_6k_pb)}
                </div>
              </div>
            )}

            {/* Measurements display */}
            {measurements && (
              <div className="mt-3 pt-2 border-t border-gray-200">
                <h3 className="text-xs font-semibold text-gray-500 mb-1 uppercase tracking-wide">Measurements</h3>
                <div className="text-xs space-x-4 flex flex-wrap gap-y-1">
                  {infoItem('Height', measurements.height)}
                  {infoItem('Wingspan', measurements.wingspan)}
                  {infoItem('Trunk', measurements.trunk_length)}
                  {infoItem('R Humerus', measurements.r_humerus)}
                  {infoItem('L Humerus', measurements.l_humerus)}
                  {infoItem('R Forearm', measurements.r_forearm)}
                  {infoItem('L Forearm', measurements.l_forearm)}
                  {infoItem('R Femur', measurements.r_femur)}
                  {infoItem('L Femur', measurements.l_femur)}
                  {infoItem('R Tibia', measurements.r_tibia)}
                  {infoItem('L Tibia', measurements.l_tibia)}
                </div>
              </div>
            )}
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
