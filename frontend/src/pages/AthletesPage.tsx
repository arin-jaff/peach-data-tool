import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { getGlobalAthletes } from '../api';
import type { GlobalAthlete } from '../types';

export default function AthletesPage() {
  const [athletes, setAthletes] = useState<GlobalAthlete[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [squadFilter, setSquadFilter] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        const data = await getGlobalAthletes();
        setAthletes(data);
      } catch {
        setError('Failed to load athletes');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading) {
    return <div className="text-gray-500 py-8 text-sm">Loading athletes...</div>;
  }

  if (error) {
    return <div className="text-red-600 py-4 text-sm">{error}</div>;
  }

  if (athletes.length === 0) {
    return (
      <div className="py-8 text-sm text-gray-500">
        No athletes yet. <Link to="/upload" className="text-gray-700 underline">Upload a CSV</Link> to get started.
      </div>
    );
  }

  // Get unique squads
  const squads = [...new Set(athletes.map((a) => a.squad || '').filter(Boolean))].sort();

  // Filter athletes
  const filtered = squadFilter
    ? athletes.filter((a) => (a.squad || '').toLowerCase() === squadFilter.toLowerCase())
    : athletes;

  // Group by squad
  const grouped: Record<string, GlobalAthlete[]> = {};
  for (const athlete of filtered) {
    const key = athlete.squad ? athlete.squad.toUpperCase() : 'UNASSIGNED';
    if (!grouped[key]) grouped[key] = [];
    grouped[key].push(athlete);
  }

  const sortedGroups = Object.keys(grouped).sort((a, b) => {
    if (a === 'UNASSIGNED') return 1;
    if (b === 'UNASSIGNED') return -1;
    return a.localeCompare(b);
  });

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h1 className="text-lg font-semibold text-gray-800">Athletes</h1>
      </div>

      {squads.length > 1 && (
        <div className="flex items-center gap-1 mb-3">
          <button
            onClick={() => setSquadFilter(null)}
            className={`px-2.5 py-1 rounded text-xs ${
              squadFilter === null
                ? 'bg-gray-700 text-white'
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
          >
            All
          </button>
          {squads.map((s) => (
            <button
              key={s}
              onClick={() => setSquadFilter(s)}
              className={`px-2.5 py-1 rounded text-xs ${
                squadFilter?.toLowerCase() === s.toLowerCase()
                  ? 'bg-gray-700 text-white'
                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              }`}
            >
              {s.toUpperCase()}
            </button>
          ))}
        </div>
      )}

      {sortedGroups.map((group) => (
        <div key={group} className="mb-4">
          <h2 className="text-sm font-medium text-gray-500 mb-1">{group}</h2>
          <table className="w-full text-sm border border-gray-300">
            <thead>
              <tr className="bg-gray-100 border-b border-gray-300">
                <th className="text-left px-3 py-2 font-medium text-gray-600">Name</th>
                <th className="text-left px-3 py-2 font-medium text-gray-600">UNI</th>
                <th className="text-left px-3 py-2 font-medium text-gray-600">Squad</th>
                <th className="text-right px-3 py-2 font-medium text-gray-600">Sessions</th>
              </tr>
            </thead>
            <tbody>
              {grouped[group].map((athlete) => (
                <tr key={athlete.id} className="border-b border-gray-200 hover:bg-gray-50">
                  <td className="px-3 py-2">
                    <Link
                      to={`/athletes/${athlete.id}`}
                      className="text-gray-900 hover:underline"
                    >
                      {athlete.name}
                    </Link>
                  </td>
                  <td className="px-3 py-2 text-gray-500 font-mono text-xs">
                    {athlete.uni || '-'}
                  </td>
                  <td className="px-3 py-2 text-gray-500">
                    {athlete.squad ? athlete.squad.toUpperCase() : '-'}
                  </td>
                  <td className="px-3 py-2 text-right text-gray-500">
                    {athlete.session_count}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}
    </div>
  );
}
