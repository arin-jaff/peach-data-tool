import { useMemo, useState } from 'react';
import { Routes, Route, Link } from 'react-router-dom';
import HomePage from './pages/HomePage';
import UploadPage from './pages/UploadPage';
import DashboardPage from './pages/DashboardPage';
import AthletesPage from './pages/AthletesPage';
import AthleteDetailPage from './pages/AthleteDetailPage';
import VideoAnalysisPage from './pages/VideoAnalysisPage';

type CrewRow = { pos: number; name: string; abbr: string; existing_weight?: string };
type Zone = 'T1' | 'T2' | 'T3' | 'T4' | 'T5' | 'T6';

function detectDelimiter(text: string): '\t' | ',' {
  const firstLine = (text || '').split(/\r?\n/)[0] || '';
  const tabCount = (firstLine.match(/\t/g) || []).length;
  const commaCount = (firstLine.match(/,/g) || []).length;
  return tabCount > commaCount ? '\t' : ',';
}

function escapeCsvField(value: unknown): string {
  const s = String(value ?? '');
  if (/[",\r\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function tsvToCsv(text: string): string {
  const lines = (text || '').replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');
  return lines
    .map((line) => {
      if (line === '') return '';
      return line.split('\t').map(escapeCsvField).join(',');
    })
    .join('\n');
}

function TelemProcessPage() {
  // Backend stays unchanged:
  const BACKEND_URL = 'https://timblo-telem-web-app.onrender.com';

  const [password, setPassword] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [status, setStatus] = useState('');

  const [season, setSeason] = useState('FY26');
  const [shell, setShell] = useState('');
  const [zone, setZone] = useState<Zone>('T2');
  const [piece, setPiece] = useState('');
  const [pieceNumber, setPieceNumber] = useState('');
  const [coxUni, setCoxUni] = useState('');
  const [rigInfo, setRigInfo] = useState('');
  const [wind, setWind] = useState('');
  const [stream, setStream] = useState('');
  const [temperature, setTemperature] = useState('');

  const [crew, setCrew] = useState<CrewRow[] | null>(null);
  const [weights, setWeights] = useState<Record<string, string>>({});

  const weightsComplete = useMemo(() => {
    for (let i = 1; i <= 8; i++) {
      const v = (weights[`pos_${i}`] ?? '').trim();
      if (!v) return false;
      const n = Number(v);
      if (!Number.isFinite(n) || n <= 0) return false;
    }
    return true;
  }, [weights]);

  function requireReady() {
    if (!password) throw new Error('Password required.');
    if (!file) throw new Error('Upload a CSV or paste data first.');
  }

  async function pasteFromClipboard() {
    try {
      setStatus('Reading clipboard…');
      const text = await navigator.clipboard.readText();
      const trimmed = (text || '').trim();
      if (!trimmed) throw new Error('Clipboard is empty. Copy telemetry data first.');

      const delim = detectDelimiter(trimmed);
      const csvText = delim === '\t' ? tsvToCsv(trimmed) : trimmed;

      const blob = new Blob([csvText], { type: 'text/csv' });
      const f = new File([blob], 'clipboard.csv', { type: 'text/csv' });

      setFile(f);
      setCrew(null);
      setWeights({});
      setStatus('Clipboard loaded as clipboard.csv. Click Preview Crew.');
    } catch (e: any) {
      setStatus(e?.message || String(e));
    }
  }

  async function previewCrew() {
    try {
      setStatus('Loading crew…');
      requireReady();

      const fd = new FormData();
      fd.append('file', file as File);

      const res = await fetch(`${BACKEND_URL}/preview-crew`, {
        method: 'POST',
        headers: { 'X-C150-Password': password },
        body: fd,
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data?.detail || 'Preview failed');

      const crewRows: CrewRow[] = (data?.crew || [])
        .slice()
        .sort((a: CrewRow, b: CrewRow) => a.pos - b.pos);

      setCrew(crewRows);

      const next: Record<string, string> = {};
      for (const r of crewRows) next[`pos_${r.pos}`] = (r.existing_weight || '').trim();
      setWeights(next);

      setStatus('Crew loaded. Enter/confirm weights for seats 1–8, then Process + Download.');
    } catch (e: any) {
      setStatus(e?.message || String(e));
    }
  }

  async function processAndDownload() {
    try {
      setStatus('Processing…');
      requireReady();
      if (!crew) throw new Error('Preview crew first.');
      if (!weightsComplete) throw new Error('Fill valid weights for seats 1–8 (kg).');

      const fd = new FormData();
      fd.append('file', file as File);
      fd.append('season', season);
      fd.append('shell', shell);
      fd.append('zone', zone);
      fd.append('piece', piece);
      fd.append('piece_number', pieceNumber);
      fd.append('cox_uni', coxUni);
      fd.append('rig_info', rigInfo);
      fd.append('wind', wind);
      fd.append('stream', stream);
      fd.append('temperature', temperature);
      fd.append('weights_json', JSON.stringify(weights));

      const res = await fetch(`${BACKEND_URL}/process`, {
        method: 'POST',
        headers: { 'X-C150-Password': password },
        body: fd,
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error((err as any)?.detail || 'Process failed');
      }

      const blob = await res.blob();
      const dispo = res.headers.get('Content-Disposition') || '';
      const match = dispo.match(/filename=\"(.+?)\"/);
      const filename = match ? match[1] : 'C150_processed.csv';

      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);

      setStatus(`Done. Downloaded: ${filename}`);
    } catch (e: any) {
      setStatus(e?.message || String(e));
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h1 className="text-lg font-semibold text-gray-800">Telemetry Processor</h1>
      </div>

      <div className="border border-gray-300 bg-white rounded p-4 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <label className="text-sm">
            <div className="text-gray-600 mb-1">Password</div>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full border border-gray-300 rounded px-2 py-1"
              placeholder="Team password"
            />
          </label>

          <label className="text-sm">
            <div className="text-gray-600 mb-1">Telemetry CSV</div>
            <input
              type="file"
              accept=".csv"
              onChange={(e) => {
                const f = e.target.files?.[0] || null;
                setFile(f);
                setCrew(null);
                setWeights({});
              }}
              className="w-full text-sm"
            />
          </label>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={pasteFromClipboard}
            className="bg-gray-200 text-gray-700 hover:bg-gray-300 px-3 py-1.5 rounded text-sm"
          >
            Paste Data
          </button>
          <button
            onClick={previewCrew}
            className="bg-gray-200 text-gray-700 hover:bg-gray-300 px-3 py-1.5 rounded text-sm"
          >
            Preview Crew
          </button>
          <button
            onClick={processAndDownload}
            className="bg-gray-700 text-white hover:bg-gray-800 px-3 py-1.5 rounded text-sm"
          >
            Process + Download
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <label className="text-sm">
            <div className="text-gray-600 mb-1">Season</div>
            <input
              value={season}
              onChange={(e) => setSeason(e.target.value)}
              className="w-full border border-gray-300 rounded px-2 py-1"
            />
          </label>

          <label className="text-sm">
            <div className="text-gray-600 mb-1">Shell (Boat Name)</div>
            <input
              value={shell}
              onChange={(e) => setShell(e.target.value.toUpperCase())}
              className="w-full border border-gray-300 rounded px-2 py-1"
              placeholder="ZIMMER"
            />
          </label>

          <label className="text-sm">
            <div className="text-gray-600 mb-1">Zone</div>
            <select
              value={zone}
              onChange={(e) => setZone(e.target.value as Zone)}
              className="w-full border border-gray-300 rounded px-2 py-1 bg-white"
            >
              <option value="T1">T1</option>
              <option value="T2">T2</option>
              <option value="T3">T3</option>
              <option value="T4">T4</option>
              <option value="T5">T5</option>
              <option value="T6">T6</option>
            </select>
          </label>

          <label className="text-sm">
            <div className="text-gray-600 mb-1">Piece</div>
            <input
              value={piece}
              onChange={(e) => setPiece(e.target.value)}
              className="w-full border border-gray-300 rounded px-2 py-1"
              placeholder="1250m"
            />
          </label>

          <label className="text-sm">
            <div className="text-gray-600 mb-1">Piece Number</div>
            <input
              value={pieceNumber}
              onChange={(e) => setPieceNumber(e.target.value.replace(/[^0-9]/g, ''))}
              className="w-full border border-gray-300 rounded px-2 py-1"
              placeholder="3"
              inputMode="numeric"
            />
          </label>

          <label className="text-sm">
            <div className="text-gray-600 mb-1">Cox UNI</div>
            <input
              value={coxUni}
              onChange={(e) => setCoxUni(e.target.value)}
              className="w-full border border-gray-300 rounded px-2 py-1"
              placeholder="at4117"
            />
          </label>

          <label className="text-sm md:col-span-3">
            <div className="text-gray-600 mb-1">Rig Info (comment)</div>
            <input
              value={rigInfo}
              onChange={(e) => setRigInfo(e.target.value)}
              className="w-full border border-gray-300 rounded px-2 py-1"
              placeholder="82.5/83.0, span 160, gates 0"
            />
          </label>

          <label className="text-sm">
            <div className="text-gray-600 mb-1">Wind (m/s)</div>
            <input
              value={wind}
              onChange={(e) => setWind(e.target.value.replace(/[^0-9-]/g, ''))}
              className="w-full border border-gray-300 rounded px-2 py-1"
              placeholder="0"
              inputMode="numeric"
            />
          </label>

          <label className="text-sm">
            <div className="text-gray-600 mb-1">Stream (m/s)</div>
            <input
              value={stream}
              onChange={(e) => setStream(e.target.value.replace(/[^0-9-]/g, ''))}
              className="w-full border border-gray-300 rounded px-2 py-1"
              placeholder="0"
              inputMode="numeric"
            />
          </label>

          <label className="text-sm">
            <div className="text-gray-600 mb-1">Temperature (°C)</div>
            <input
              value={temperature}
              onChange={(e) => setTemperature(e.target.value.replace(/[^0-9-]/g, ''))}
              className="w-full border border-gray-300 rounded px-2 py-1"
              placeholder="0"
              inputMode="numeric"
            />
          </label>
        </div>

        {status ? <div className="text-sm text-gray-600">{status}</div> : null}
      </div>

      <div className="mt-4 border border-gray-300 bg-white rounded p-4">
        <h2 className="text-sm font-semibold text-gray-800 mb-2">Weights (kg) — Seats 1–8</h2>
        {!crew ? (
          <div className="text-sm text-gray-500">Click “Preview Crew” to load seats 1–8.</div>
        ) : (
          <div className="space-y-2">
            <div className="grid grid-cols-12 gap-2 text-xs text-gray-500">
              <div className="col-span-1">Seat</div>
              <div className="col-span-5">Name</div>
              <div className="col-span-3">UNI</div>
              <div className="col-span-3">Weight (kg)</div>
            </div>

            {crew.map((r) => (
              <div key={r.pos} className="grid grid-cols-12 gap-2 items-center">
                <div className="col-span-1 text-sm text-gray-700">{r.pos}</div>
                <div className="col-span-5 text-sm text-gray-900">{r.name}</div>
                <div className="col-span-3 text-sm text-gray-600">{r.abbr}</div>
                <div className="col-span-3">
                  <input
                    value={weights[`pos_${r.pos}`] ?? ''}
                    onChange={(e) => setWeights((w) => ({ ...w, [`pos_${r.pos}`]: e.target.value }))}
                    className="w-full border border-gray-300 rounded px-2 py-1 text-sm"
                    placeholder="kg"
                    inputMode="decimal"
                  />
                </div>
              </div>
            ))}

            {!weightsComplete ? (
              <div className="text-xs text-amber-700">
                All seats 1–8 must have valid weights (&gt; 0 kg) before processing.
              </div>
            ) : (
              <div className="text-xs text-green-700">Weights complete.</div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function App() {
  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white border-b border-gray-300 px-4 py-2 flex items-center justify-between text-sm">
        <Link to="/" className="font-semibold text-gray-800">
          Peach Telemetry
        </Link>

        <div className="flex items-center gap-3">
          <Link to="/" className="text-gray-600 hover:text-gray-900">
            Sessions
          </Link>
          <Link to="/athletes" className="text-gray-600 hover:text-gray-900">
            Athletes
          </Link>

          {/* NEW: persistent telemetry tool button */}
          <Link
            to="/telem-process"
            className="bg-gray-200 text-gray-700 hover:bg-gray-300 px-3 py-1.5 rounded text-sm"
          >
            Telemetry Processor
          </Link>

          <Link
            to="/upload"
            className="bg-gray-200 text-gray-700 hover:bg-gray-300 px-3 py-1.5 rounded text-sm"
          >
            Upload CSV
          </Link>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-4 py-4">
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/upload" element={<UploadPage />} />
          <Route path="/dashboard/:sessionId" element={<DashboardPage />} />
          <Route path="/video/:sessionId" element={<VideoAnalysisPage />} />
          <Route path="/athletes" element={<AthletesPage />} />
          <Route path="/athletes/:athleteId" element={<AthleteDetailPage />} />

          {/* NEW: telemetry route */}
          <Route path="/telem-process" element={<TelemProcessPage />} />
        </Routes>
      </main>
    </div>
  );
}

export default App;