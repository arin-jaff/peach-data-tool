import type { Session, StrokeMetric, PieceAverages, UploadResponse, PeriodicDataPoint } from './types';

const API_BASE = '/api';

async function fetchJson<T>(url: string, options?: RequestInit): Promise<T> {
  const response = await fetch(url, options);
  if (!response.ok) {
    throw new Error(`API error: ${response.status}`);
  }
  return response.json();
}

// Sessions
export async function getSessions(): Promise<Session[]> {
  return fetchJson<Session[]>(`${API_BASE}/sessions`);
}

export async function getSession(id: string): Promise<Session> {
  return fetchJson<Session>(`${API_BASE}/sessions/${id}`);
}

export async function renameSession(id: string, name: string): Promise<Session> {
  return fetchJson<Session>(`${API_BASE}/sessions/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name }),
  });
}

export async function deleteSession(id: string): Promise<void> {
  await fetch(`${API_BASE}/sessions/${id}`, { method: 'DELETE' });
}

// Upload
export async function uploadCsv(file: File, sessionName?: string): Promise<UploadResponse> {
  const formData = new FormData();
  formData.append('file', file);
  if (sessionName) {
    formData.append('session_name', sessionName);
  }

  const response = await fetch(`${API_BASE}/upload`, {
    method: 'POST',
    body: formData,
  });

  if (!response.ok) {
    throw new Error(`Upload failed: ${response.status}`);
  }

  return response.json();
}

// Strokes
export async function getStrokes(pieceId: string): Promise<StrokeMetric[]> {
  return fetchJson<StrokeMetric[]>(`${API_BASE}/pieces/${pieceId}/strokes`);
}

export async function getStrokeAverages(pieceId: string): Promise<PieceAverages> {
  return fetchJson<PieceAverages>(`${API_BASE}/pieces/${pieceId}/strokes/averages`);
}

// Periodic Data
export async function getPeriodicData(
  pieceId: string,
  strokeStart?: number,
  strokeEnd?: number,
  downsample = 1
): Promise<{ data: PeriodicDataPoint[]; total_points: number }> {
  const params = new URLSearchParams();
  if (strokeStart !== undefined) params.append('stroke_start', String(strokeStart));
  if (strokeEnd !== undefined) params.append('stroke_end', String(strokeEnd));
  if (downsample > 1) params.append('downsample', String(downsample));

  const url = `${API_BASE}/pieces/${pieceId}/periodic?${params}`;
  return fetchJson(url);
}

export async function getForceCurve(
  pieceId: string,
  strokeNumber: number
): Promise<{ data: PeriodicDataPoint[]; stroke_number: number }> {
  return fetchJson(`${API_BASE}/pieces/${pieceId}/stroke/${strokeNumber}/force-curve`);
}
