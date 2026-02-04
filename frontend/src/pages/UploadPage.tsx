import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDropzone } from 'react-dropzone';
import { uploadCsv } from '../api';
import type { UploadResponse } from '../types';

export default function UploadPage() {
  const navigate = useNavigate();
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState<UploadResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    if (acceptedFiles.length === 0) return;

    const file = acceptedFiles[0];
    if (!file.name.endsWith('.csv')) {
      setError('Please upload a CSV file');
      return;
    }

    setUploading(true);
    setError(null);

    try {
      const response = await uploadCsv(file);
      setResult(response);
    } catch {
      setError('Failed to upload file. Make sure it is a valid Peach CSV.');
    } finally {
      setUploading(false);
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'text/csv': ['.csv'] },
    multiple: false,
  });

  if (result) {
    return (
      <div className="max-w-lg">
        <div className="border border-gray-300 rounded p-4 mb-4 text-sm">
          <div className="font-medium text-gray-800 mb-2">Upload complete</div>
          <div className="text-gray-600 space-y-1">
            <div>Session: {result.session_name}</div>
            <div>Pieces: {result.pieces_created} | Strokes: {result.stroke_count}</div>
            <div>Athletes: {result.athletes.map((a) => `${a.seat_position}. ${a.name}`).join(', ')}</div>
          </div>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => navigate(`/dashboard/${result.session_id}`)}
            className="bg-gray-200 text-gray-700 hover:bg-gray-300 px-3 py-1.5 rounded text-sm"
          >
            View Dashboard
          </button>
          <button
            onClick={() => setResult(null)}
            className="bg-gray-200 text-gray-700 hover:bg-gray-300 px-3 py-1.5 rounded text-sm"
          >
            Upload Another
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-lg">
      <h1 className="text-lg font-semibold text-gray-800 mb-3">Upload CSV</h1>

      {error && (
        <div className="text-red-600 text-sm mb-3">{error}</div>
      )}

      <div
        {...getRootProps()}
        className={`border-2 border-dashed rounded p-8 text-center cursor-pointer text-sm
          ${isDragActive ? 'border-gray-500 bg-gray-100' : 'border-gray-300 hover:border-gray-400'}
          ${uploading ? 'opacity-50 cursor-not-allowed' : ''}`}
      >
        <input {...getInputProps()} disabled={uploading} />
        {uploading ? (
          <div className="text-gray-500">Uploading and parsing...</div>
        ) : isDragActive ? (
          <div className="text-gray-700">Drop the CSV file here...</div>
        ) : (
          <div className="text-gray-500">
            <div className="mb-1">Drag and drop a Peach CSV file here</div>
            <div className="text-xs text-gray-400">or click to select</div>
          </div>
        )}
      </div>
    </div>
  );
}
