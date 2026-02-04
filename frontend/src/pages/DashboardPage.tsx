import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { getSession, getStrokes, getStrokeAverages, getForceCurve } from '../api';
import { useDashboardStore, ATHLETE_COLORS, CREW_COLOR } from '../store';
import type { PanelId } from '../store';
import type { Session, StrokeMetric, PieceAverages, PeriodicDataPoint } from '../types';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ReferenceLine,
} from 'recharts';

export default function DashboardPage() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const [session, setSession] = useState<Session | null>(null);
  const [selectedPieceId, setSelectedPieceId] = useState<string | null>(null);
  const [strokes, setStrokes] = useState<StrokeMetric[]>([]);
  const [averages, setAverages] = useState<PieceAverages | null>(null);
  const [forceCurveData, setForceCurveData] = useState<PeriodicDataPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showPanelConfig, setShowPanelConfig] = useState(false);

  const {
    selectedAthletes,
    currentStroke,
    totalStrokes,
    showCrewAverage,
    panels,
    toggleAthlete,
    selectAllAthletes,
    deselectAllAthletes,
    setCurrentStroke,
    setTotalStrokes,
    toggleCrewAverage,
    stepForward,
    stepBackward,
    togglePanel,
    movePanelUp,
    movePanelDown,
  } = useDashboardStore();

  useEffect(() => {
    if (!sessionId) return;
    const load = async () => {
      try {
        setLoading(true);
        const data = await getSession(sessionId);
        setSession(data);
        if (data.pieces && data.pieces.length > 0) {
          setSelectedPieceId(data.pieces[0].id);
        }
      } catch {
        setError('Failed to load session');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [sessionId]);

  useEffect(() => {
    if (!selectedPieceId) return;
    const load = async () => {
      try {
        const [strokeData, avgData] = await Promise.all([
          getStrokes(selectedPieceId),
          getStrokeAverages(selectedPieceId),
        ]);
        setStrokes(strokeData);
        setAverages(avgData);
        setTotalStrokes(strokeData.length);
        setCurrentStroke(1);
      } catch (err) {
        console.error('Failed to load strokes', err);
      }
    };
    load();
  }, [selectedPieceId, setTotalStrokes, setCurrentStroke]);

  useEffect(() => {
    if (!selectedPieceId || strokes.length === 0) return;
    const strokeNumber = strokes[currentStroke - 1]?.stroke_number;
    if (!strokeNumber) return;
    const load = async () => {
      try {
        const data = await getForceCurve(selectedPieceId, strokeNumber);
        setForceCurveData(data.data);
      } catch (err) {
        console.error('Failed to load force curve', err);
      }
    };
    load();
  }, [selectedPieceId, currentStroke, strokes]);

  if (loading) return <div className="text-gray-500 py-8 text-sm">Loading...</div>;
  if (error || !session) return <div className="text-red-600 py-4 text-sm">{error || 'Session not found'}</div>;

  const athletes = session.athletes || [];

  // -- Chart data --

  const powerChartData = strokes.map((s, i) => {
    const d: Record<string, number | null> = { stroke: i + 1 };
    athletes.forEach((a) => {
      d[`seat${a.seat_position}`] = s.swivel_power?.[a.seat_position - 1] ?? null;
    });
    const vals = s.swivel_power?.filter((v) => v != null) || [];
    d.crewAvg = vals.length > 0 ? vals.reduce((sum, v) => (sum || 0) + (v || 0), 0)! / vals.length : null;
    return d;
  });

  const effectiveLengthData = strokes.map((s, i) => {
    const d: Record<string, number | null> = { stroke: i + 1 };
    athletes.forEach((a) => {
      const idx = a.seat_position - 1;
      const minA = s.min_angle?.[idx];
      const maxA = s.max_angle?.[idx];
      if (minA != null && maxA != null) {
        const sl = maxA - minA;
        const cs = Math.abs(s.catch_slip?.[idx] ?? 0);
        const fs = Math.abs(s.finish_slip?.[idx] ?? 0);
        d[`eff${a.seat_position}`] = sl - cs - fs;
      } else {
        d[`eff${a.seat_position}`] = null;
      }
    });
    return d;
  });

  const angleChartData = strokes.map((s, i) => {
    const d: Record<string, number | null> = { stroke: i + 1 };
    athletes.forEach((a) => {
      const idx = a.seat_position - 1;
      d[`catch${a.seat_position}`] = s.min_angle?.[idx] ?? null;
      d[`finish${a.seat_position}`] = s.max_angle?.[idx] ?? null;
    });
    return d;
  });

  const speedChartData = strokes.map((s, i) => ({
    stroke: i + 1,
    speed: s.avg_boat_speed,
    rating: s.rating,
  }));

  const forceCurveChartData = forceCurveData
    .filter((p) => p.normalized_time !== undefined)
    .map((p) => {
      const d: Record<string, number | null | undefined> = { normalizedTime: p.normalized_time };
      athletes.forEach((a) => {
        d[`force${a.seat_position}`] = p.gate_force_x?.[a.seat_position - 1] ?? null;
      });
      return d;
    });

  // -- Panel rendering --

  const visiblePanels = panels.filter((p) => p.visible);
  const hiddenPanels = panels.filter((p) => !p.visible);

  function panelHeader(panelId: PanelId, label: string) {
    return (
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs font-medium text-gray-600">{label}</span>
        <span className="flex items-center gap-0.5">
          <button onClick={() => movePanelUp(panelId)} className="text-gray-400 hover:text-gray-600 px-1 text-xs" title="Move up">&uarr;</button>
          <button onClick={() => movePanelDown(panelId)} className="text-gray-400 hover:text-gray-600 px-1 text-xs" title="Move down">&darr;</button>
          <button onClick={() => togglePanel(panelId)} className="text-gray-400 hover:text-gray-600 px-1 text-xs" title="Hide">&times;</button>
        </span>
      </div>
    );
  }

  function renderLineChart(
    panelId: PanelId,
    title: string,
    data: Record<string, number | null>[],
    prefix: string,
    yLabel: string,
  ) {
    return (
      <div className="border border-gray-300 rounded p-3">
        {panelHeader(panelId, title)}
        <ResponsiveContainer width="100%" height={240}>
          <LineChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis dataKey="stroke" tick={{ fontSize: 10 }} />
            <YAxis tick={{ fontSize: 10 }} label={{ value: yLabel, angle: -90, position: 'insideLeft', style: { fontSize: 10 } }} />
            <Tooltip contentStyle={{ fontSize: 11 }} />
            <ReferenceLine x={currentStroke} stroke="#9ca3af" strokeDasharray="3 3" />
            {athletes.map((a) =>
              selectedAthletes.has(a.seat_position) ? (
                <Line key={a.seat_position} type="monotone" dataKey={`${prefix}${a.seat_position}`} name={a.name} stroke={ATHLETE_COLORS[a.seat_position]} dot={false} strokeWidth={1.5} />
              ) : null
            )}
            {showCrewAverage && prefix === 'seat' && (
              <Line type="monotone" dataKey="crewAvg" name="Crew Avg" stroke={CREW_COLOR} strokeDasharray="5 5" dot={false} strokeWidth={1.5} />
            )}
          </LineChart>
        </ResponsiveContainer>
      </div>
    );
  }

  function renderSummary() {
    if (!averages) return null;
    return (
      <div className="border border-gray-300 rounded p-3 text-sm col-span-2">
        {panelHeader('summary', 'Piece Summary')}
        <div className="flex gap-6 mb-3 text-xs text-gray-500">
          <span>Strokes: <strong className="text-gray-800">{averages.total_strokes}</strong></span>
          <span>Avg Rating: <strong className="text-gray-800">{averages.avg_rating?.toFixed(1) ?? '-'}</strong></span>
          <span>Avg Speed: <strong className="text-gray-800">{averages.avg_boat_speed?.toFixed(2) ?? '-'} m/s</strong></span>
          <span>Crew Avg Power: <strong className="text-gray-800">{averages.crew_avg_power?.toFixed(0) ?? '-'} W</strong></span>
        </div>
        <table className="w-full text-xs border border-gray-200">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200">
              <th className="text-left px-2 py-1">Seat</th>
              <th className="text-left px-2 py-1">Name</th>
              <th className="text-right px-2 py-1">Power (W)</th>
              <th className="text-right px-2 py-1">Stroke Len (°)</th>
              <th className="text-right px-2 py-1">Eff. Len (°)</th>
              <th className="text-right px-2 py-1">Catch Slip (°)</th>
              <th className="text-right px-2 py-1">Finish Slip (°)</th>
              <th className="text-right px-2 py-1">Drive (s)</th>
              <th className="text-right px-2 py-1">Recovery (s)</th>
            </tr>
          </thead>
          <tbody>
            {averages.athletes.map((a) => (
              <tr key={a.seat_position} className="border-b border-gray-100">
                <td className="px-2 py-1">
                  <span className="inline-block w-2.5 h-2.5 rounded-full mr-1" style={{ backgroundColor: ATHLETE_COLORS[a.seat_position] }} />
                  {a.seat_position}
                </td>
                <td className="px-2 py-1">{a.name}</td>
                <td className="text-right px-2 py-1">{a.avg_power?.toFixed(0) ?? '-'}</td>
                <td className="text-right px-2 py-1">{a.avg_stroke_length?.toFixed(1) ?? '-'}</td>
                <td className="text-right px-2 py-1">{a.avg_effective_length?.toFixed(1) ?? '-'}</td>
                <td className="text-right px-2 py-1">{a.avg_catch_slip?.toFixed(1) ?? '-'}</td>
                <td className="text-right px-2 py-1">{a.avg_finish_slip?.toFixed(1) ?? '-'}</td>
                <td className="text-right px-2 py-1">{a.avg_drive_time?.toFixed(3) ?? '-'}</td>
                <td className="text-right px-2 py-1">{a.avg_recovery_time?.toFixed(3) ?? '-'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  function renderAngleChart() {
    return (
      <div className="border border-gray-300 rounded p-3">
        {panelHeader('angles', 'Catch & Finish Angles')}
        <ResponsiveContainer width="100%" height={240}>
          <LineChart data={angleChartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis dataKey="stroke" tick={{ fontSize: 10 }} />
            <YAxis tick={{ fontSize: 10 }} label={{ value: 'Angle (°)', angle: -90, position: 'insideLeft', style: { fontSize: 10 } }} />
            <Tooltip contentStyle={{ fontSize: 11 }} />
            <ReferenceLine x={currentStroke} stroke="#9ca3af" strokeDasharray="3 3" />
            {athletes.map((a) =>
              selectedAthletes.has(a.seat_position) ? (
                <Line key={`c-${a.seat_position}`} type="monotone" dataKey={`catch${a.seat_position}`} name={`${a.name} Catch`} stroke={ATHLETE_COLORS[a.seat_position]} dot={false} strokeWidth={1.5} />
              ) : null
            )}
            {athletes.map((a) =>
              selectedAthletes.has(a.seat_position) ? (
                <Line key={`f-${a.seat_position}`} type="monotone" dataKey={`finish${a.seat_position}`} name={`${a.name} Finish`} stroke={ATHLETE_COLORS[a.seat_position]} dot={false} strokeWidth={1.5} strokeDasharray="3 3" />
              ) : null
            )}
          </LineChart>
        </ResponsiveContainer>
      </div>
    );
  }

  function renderSpeedChart() {
    return (
      <div className="border border-gray-300 rounded p-3">
        {panelHeader('speed', 'Boat Speed & Rating')}
        <ResponsiveContainer width="100%" height={240}>
          <LineChart data={speedChartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis dataKey="stroke" tick={{ fontSize: 10 }} />
            <YAxis yAxisId="speed" tick={{ fontSize: 10 }} label={{ value: 'Speed (m/s)', angle: -90, position: 'insideLeft', style: { fontSize: 10 } }} />
            <YAxis yAxisId="rating" orientation="right" tick={{ fontSize: 10 }} label={{ value: 'Rating (spm)', angle: 90, position: 'insideRight', style: { fontSize: 10 } }} />
            <Tooltip contentStyle={{ fontSize: 11 }} />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            <ReferenceLine x={currentStroke} stroke="#9ca3af" strokeDasharray="3 3" yAxisId="speed" />
            <Line yAxisId="speed" type="monotone" dataKey="speed" name="Speed" stroke="#6b7280" dot={false} strokeWidth={1.5} />
            <Line yAxisId="rating" type="monotone" dataKey="rating" name="Rating" stroke="#9ca3af" dot={false} strokeWidth={1.5} strokeDasharray="4 2" />
          </LineChart>
        </ResponsiveContainer>
      </div>
    );
  }

  function renderForceCurveChart() {
    return (
      <div className="border border-gray-300 rounded p-3">
        {panelHeader('forceCurve', `Force Curve (Stroke ${currentStroke})`)}
        <ResponsiveContainer width="100%" height={240}>
          <LineChart data={forceCurveChartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis dataKey="normalizedTime" tick={{ fontSize: 10 }} label={{ value: 'Normalized Time (%)', position: 'bottom', style: { fontSize: 10 } }} />
            <YAxis tick={{ fontSize: 10 }} label={{ value: 'Force (kg)', angle: -90, position: 'insideLeft', style: { fontSize: 10 } }} />
            <Tooltip contentStyle={{ fontSize: 11 }} />
            {athletes.map((a) =>
              selectedAthletes.has(a.seat_position) ? (
                <Line key={a.seat_position} type="monotone" dataKey={`force${a.seat_position}`} name={a.name} stroke={ATHLETE_COLORS[a.seat_position]} dot={false} strokeWidth={1.5} />
              ) : null
            )}
          </LineChart>
        </ResponsiveContainer>
      </div>
    );
  }

  function renderPanel(panelId: PanelId) {
    switch (panelId) {
      case 'summary': return renderSummary();
      case 'power': return renderLineChart('power', 'Power (W)', powerChartData, 'seat', 'Power (W)');
      case 'effectiveLength': return renderLineChart('effectiveLength', 'Effective Length (°)', effectiveLengthData, 'eff', 'Eff. Length (°)');
      case 'angles': return renderAngleChart();
      case 'speed': return renderSpeedChart();
      case 'forceCurve': return renderForceCurveChart();
      default: return null;
    }
  }

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between text-sm">
        <div className="flex items-center gap-2">
          <Link to="/" className="text-gray-500 hover:text-gray-700">&larr; Sessions</Link>
          <span className="text-gray-300">|</span>
          <span className="font-semibold text-gray-800">{session.name}</span>
        </div>
        {session.pieces && session.pieces.length > 1 && (
          <select
            value={selectedPieceId || ''}
            onChange={(e) => setSelectedPieceId(e.target.value)}
            className="border border-gray-300 rounded px-2 py-1 text-sm"
          >
            {session.pieces.map((piece) => (
              <option key={piece.id} value={piece.id}>
                Piece {piece.piece_number}{piece.name ? `: ${piece.name}` : ''}
              </option>
            ))}
          </select>
        )}
      </div>

      {/* Athlete toggles */}
      <div className="flex flex-wrap items-center gap-1.5 text-xs">
        {athletes.map((a) => {
          const on = selectedAthletes.has(a.seat_position);
          const color = ATHLETE_COLORS[a.seat_position];
          return (
            <button
              key={a.id}
              onClick={() => toggleAthlete(a.seat_position)}
              className={`px-2 py-1 rounded border text-xs ${on ? 'border-transparent' : 'border-gray-300 opacity-40'}`}
              style={{
                backgroundColor: on ? `${color}18` : undefined,
                color: on ? color : '#9ca3af',
                borderColor: on ? `${color}40` : undefined,
              }}
            >
              <span className="inline-block w-2 h-2 rounded-full mr-1" style={{ backgroundColor: color }} />
              {a.seat_position}. {a.name}
            </button>
          );
        })}
        <span className="text-gray-300 mx-1">|</span>
        <button onClick={selectAllAthletes} className="text-gray-500 hover:text-gray-700 text-xs">All</button>
        <button onClick={deselectAllAthletes} className="text-gray-500 hover:text-gray-700 text-xs">None</button>
        <button
          onClick={toggleCrewAverage}
          className={`text-xs px-1.5 py-0.5 rounded ${showCrewAverage ? 'bg-gray-200 text-gray-700' : 'text-gray-400'}`}
        >
          Crew Avg
        </button>
      </div>

      {/* Timeline */}
      <div className="flex items-center gap-2 text-xs">
        <button onClick={stepBackward} disabled={currentStroke <= 1} className="bg-gray-200 hover:bg-gray-300 disabled:opacity-40 px-2 py-0.5 rounded">&larr;</button>
        <input
          type="range"
          min={1}
          max={totalStrokes}
          value={currentStroke}
          onChange={(e) => setCurrentStroke(parseInt(e.target.value))}
          className="flex-1"
        />
        <button onClick={stepForward} disabled={currentStroke >= totalStrokes} className="bg-gray-200 hover:bg-gray-300 disabled:opacity-40 px-2 py-0.5 rounded">&rarr;</button>
        <span className="text-gray-500 w-24 text-right">Stroke {currentStroke}/{totalStrokes}</span>
      </div>

      {/* Panel config */}
      <div className="flex items-center gap-2 text-xs">
        <button
          onClick={() => setShowPanelConfig(!showPanelConfig)}
          className="bg-gray-200 hover:bg-gray-300 text-gray-600 px-2 py-0.5 rounded"
        >
          {showPanelConfig ? 'Hide' : 'Configure'} Panels
        </button>
        {hiddenPanels.length > 0 && (
          <span className="text-gray-400">{hiddenPanels.length} hidden</span>
        )}
      </div>

      {showPanelConfig && (
        <div className="border border-gray-300 rounded p-2 text-xs flex flex-wrap gap-3">
          {panels.map((p) => (
            <label key={p.id} className="flex items-center gap-1 text-gray-600 cursor-pointer select-none">
              <input type="checkbox" checked={p.visible} onChange={() => togglePanel(p.id)} className="rounded" />
              {p.label}
              <button onClick={() => movePanelUp(p.id)} className="text-gray-400 hover:text-gray-600">&uarr;</button>
              <button onClick={() => movePanelDown(p.id)} className="text-gray-400 hover:text-gray-600">&darr;</button>
            </label>
          ))}
        </div>
      )}

      {/* Panels */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        {visiblePanels.map((p) => (
          <div key={p.id} className={p.id === 'summary' ? 'col-span-1 lg:col-span-2' : ''}>
            {renderPanel(p.id)}
          </div>
        ))}
      </div>
    </div>
  );
}
