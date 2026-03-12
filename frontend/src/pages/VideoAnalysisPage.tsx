import { useEffect, useState, useRef, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  getSession, getStrokes, getSessionVideos, uploadVideo, getVideoUrl,
  updateVideo, deleteVideo, getForceCurve,
} from '../api';
import { ATHLETE_COLORS } from '../store';
import type { Session, StrokeMetric, VideoSession, PeriodicDataPoint } from '../types';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine,
} from 'recharts';

type ChartMetric = 'power' | 'forceCurve' | 'boatSpeed' | 'gateAngle';

export default function VideoAnalysisPage() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const videoRef = useRef<HTMLVideoElement>(null);
  const animFrameRef = useRef<number>(0);
  const playToStrokeRef = useRef<number | null>(null);

  // Force curve cache: strokeNumber -> data
  const forceCurveCache = useRef<Map<string, PeriodicDataPoint[]>>(new Map());
  const prefetchingRef = useRef<Set<string>>(new Set());

  // Data state
  const [session, setSession] = useState<Session | null>(null);
  const [strokes, setStrokes] = useState<StrokeMetric[]>([]);
  const [videos, setVideos] = useState<VideoSession[]>([]);
  const [activeVideo, setActiveVideo] = useState<VideoSession | null>(null);
  const [selectedPieceId, setSelectedPieceId] = useState<string | null>(null);
  const [forceCurveData, setForceCurveData] = useState<PeriodicDataPoint[]>([]);

  // Playback state
  const [currentTimeMs, setCurrentTimeMs] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackRate, setPlaybackRate] = useState(1);

  // Sync state: effectiveOffset = baseOffsetMs + userAdjustMs
  // baseOffsetMs = first stroke's time_ms (auto-computed so video t=0 = first stroke)
  // userAdjustMs = manual fine-tuning by user (this is what gets saved to DB)
  const [baseOffsetMs, setBaseOffsetMs] = useState(0);
  const [userAdjustMs, setUserAdjustMs] = useState(0);
  const effectiveOffsetMs = baseOffsetMs + userAdjustMs;
  const [isDraggingOffset, setIsDraggingOffset] = useState(false);
  const [dragStartX, setDragStartX] = useState(0);
  const [dragStartOffset, setDragStartOffset] = useState(0);

  // UI state
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [chartMetric, setChartMetric] = useState<ChartMetric>('forceCurve');
  const [selectedAthletes, setSelectedAthletes] = useState<Set<number>>(new Set([1, 2, 3, 4, 5, 6, 7, 8]));
  const [saving, setSaving] = useState(false);

  // Load session data
  useEffect(() => {
    if (!sessionId) return;
    const load = async () => {
      try {
        setLoading(true);
        const [sessionData, videoData] = await Promise.all([
          getSession(sessionId),
          getSessionVideos(sessionId),
        ]);
        setSession(sessionData);
        setVideos(videoData);
        if (sessionData.pieces && sessionData.pieces.length > 0) {
          setSelectedPieceId(sessionData.pieces[0].id);
        }
        if (videoData.length > 0) {
          setActiveVideo(videoData[0]);
          setUserAdjustMs(videoData[0].offset_ms);
          if (videoData[0].piece_id) {
            setSelectedPieceId(videoData[0].piece_id);
          }
        }
      } catch {
        setError('Failed to load session');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [sessionId]);

  // Load strokes when piece changes, auto-compute base offset
  useEffect(() => {
    if (!selectedPieceId) return;
    const load = async () => {
      try {
        const strokeData = await getStrokes(selectedPieceId);
        setStrokes(strokeData);
        // Auto-align: video t=0 corresponds to the first stroke
        if (strokeData.length > 0) {
          setBaseOffsetMs(strokeData[0].time_ms);
        }
      } catch (err) {
        console.error('Failed to load strokes', err);
      }
    };
    load();
  }, [selectedPieceId]);

  // Get current stroke index based on video time + effective offset
  const getCurrentStrokeIndex = useCallback(() => {
    if (strokes.length === 0) return 0;
    const telemetryTimeMs = currentTimeMs + effectiveOffsetMs;
    // Find the stroke whose time_ms is closest to (but not after) the telemetry time
    let idx = 0;
    for (let i = 0; i < strokes.length; i++) {
      if (strokes[i].time_ms <= telemetryTimeMs) {
        idx = i;
      } else {
        break;
      }
    }
    return idx;
  }, [currentTimeMs, effectiveOffsetMs, strokes]);

  const currentStrokeIdx = getCurrentStrokeIndex();

  // Helper to fetch and cache a single force curve
  const fetchForceCurve = useCallback(async (pieceId: string, strokeNumber: number): Promise<PeriodicDataPoint[]> => {
    const cacheKey = `${pieceId}:${strokeNumber}`;
    const cached = forceCurveCache.current.get(cacheKey);
    if (cached) return cached;
    if (prefetchingRef.current.has(cacheKey)) return []; // already in flight
    prefetchingRef.current.add(cacheKey);
    try {
      const data = await getForceCurve(pieceId, strokeNumber);
      forceCurveCache.current.set(cacheKey, data.data);
      return data.data;
    } catch (err) {
      console.error('Failed to load force curve', err);
      return [];
    } finally {
      prefetchingRef.current.delete(cacheKey);
    }
  }, []);

  // Clear cache when piece changes
  useEffect(() => {
    forceCurveCache.current.clear();
    prefetchingRef.current.clear();
  }, [selectedPieceId]);

  // Load force curve for current stroke + prefetch nearby
  useEffect(() => {
    if (!selectedPieceId || strokes.length === 0) return;
    const stroke = strokes[currentStrokeIdx];
    if (!stroke) return;

    // Load current stroke from cache or fetch
    const cacheKey = `${selectedPieceId}:${stroke.stroke_number}`;
    const cached = forceCurveCache.current.get(cacheKey);
    if (cached) {
      setForceCurveData(cached);
    } else {
      fetchForceCurve(selectedPieceId, stroke.stroke_number).then(data => {
        // Only set if still the same stroke
        setForceCurveData(data);
      });
    }

    // Prefetch next 3 strokes
    for (let ahead = 1; ahead <= 3; ahead++) {
      const nextIdx = currentStrokeIdx + ahead;
      if (nextIdx < strokes.length) {
        fetchForceCurve(selectedPieceId, strokes[nextIdx].stroke_number);
      }
    }
  }, [selectedPieceId, currentStrokeIdx, strokes, fetchForceCurve]);

  // Video time tracking loop
  useEffect(() => {
    const tick = () => {
      if (videoRef.current) {
        const ms = videoRef.current.currentTime * 1000;
        setCurrentTimeMs(ms);

        // Check if we need to stop at next stroke
        if (playToStrokeRef.current !== null && strokes.length > 0) {
          const targetStroke = strokes[playToStrokeRef.current];
          if (targetStroke) {
            const targetVideoTime = (targetStroke.time_ms - effectiveOffsetMs) / 1000;
            if (videoRef.current.currentTime >= targetVideoTime) {
              videoRef.current.pause();
              videoRef.current.currentTime = targetVideoTime;
              setIsPlaying(false);
              playToStrokeRef.current = null;
            }
          }
        }
      }
      animFrameRef.current = requestAnimationFrame(tick);
    };
    animFrameRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(animFrameRef.current);
  }, [effectiveOffsetMs, strokes]);

  // Video upload handler
  const handleVideoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !sessionId) return;
    try {
      setUploading(true);
      const video = await uploadVideo(file, sessionId, selectedPieceId || undefined);
      setVideos([video, ...videos]);
      setActiveVideo(video);
      setUserAdjustMs(video.offset_ms);
    } catch (err) {
      alert('Failed to upload video');
      console.error(err);
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  // Playback controls
  const play = () => {
    if (videoRef.current) {
      videoRef.current.playbackRate = playbackRate;
      videoRef.current.play();
      setIsPlaying(true);
    }
  };

  const pause = () => {
    if (videoRef.current) {
      videoRef.current.pause();
      setIsPlaying(false);
      playToStrokeRef.current = null;
    }
  };

  const togglePlay = () => {
    if (isPlaying) pause(); else play();
  };

  const frameStep = (direction: 1 | -1) => {
    if (!videoRef.current) return;
    pause();
    // Assume ~30fps, step ~33ms
    const fps = 30;
    const step = 1 / fps;
    videoRef.current.currentTime = Math.max(0, videoRef.current.currentTime + step * direction);
  };

  const seekToStroke = (idx: number) => {
    if (!videoRef.current || strokes.length === 0) return;
    const stroke = strokes[idx];
    if (!stroke) return;
    const videoTimeSec = (stroke.time_ms - effectiveOffsetMs) / 1000;
    videoRef.current.currentTime = Math.max(0, videoTimeSec);
    setCurrentTimeMs(videoTimeSec * 1000);
  };

  const nextStroke = () => {
    if (strokes.length === 0 || !videoRef.current) return;
    const nextIdx = Math.min(currentStrokeIdx + 1, strokes.length - 1);
    if (nextIdx === currentStrokeIdx) return;
    // Play at full speed until the next stroke
    playToStrokeRef.current = nextIdx;
    videoRef.current.playbackRate = 1;
    videoRef.current.play();
    setIsPlaying(true);
  };

  const prevStroke = () => {
    if (strokes.length === 0) return;
    const prevIdx = Math.max(currentStrokeIdx - 1, 0);
    seekToStroke(prevIdx);
  };

  const rewind = () => {
    if (videoRef.current) {
      videoRef.current.currentTime = Math.max(0, videoRef.current.currentTime - 5);
    }
  };

  const fastForward = () => {
    if (videoRef.current) {
      videoRef.current.currentTime += 5;
    }
  };

  const changeSpeed = (rate: number) => {
    setPlaybackRate(rate);
    if (videoRef.current) {
      videoRef.current.playbackRate = rate;
    }
  };

  // Save sync offset (only the user adjustment; base offset is auto-computed)
  const saveSync = async () => {
    if (!activeVideo) return;
    try {
      setSaving(true);
      const updated = await updateVideo(activeVideo.id, {
        offset_ms: userAdjustMs,
        piece_id: selectedPieceId || undefined,
      });
      setActiveVideo(updated);
      setVideos(videos.map(v => v.id === updated.id ? updated : v));
    } catch {
      alert('Failed to save sync');
    } finally {
      setSaving(false);
    }
  };

  // Delete video
  const handleDeleteVideo = async (videoId: string) => {
    if (!confirm('Delete this video?')) return;
    try {
      await deleteVideo(videoId);
      const remaining = videos.filter(v => v.id !== videoId);
      setVideos(remaining);
      if (activeVideo?.id === videoId) {
        setActiveVideo(remaining[0] || null);
        setUserAdjustMs(remaining[0]?.offset_ms || 0);
      }
    } catch {
      alert('Failed to delete video');
    }
  };

  // Timeline drag for offset adjustment
  const handleTimelineDragStart = (e: React.MouseEvent) => {
    setIsDraggingOffset(true);
    setDragStartX(e.clientX);
    setDragStartOffset(userAdjustMs);
  };

  useEffect(() => {
    if (!isDraggingOffset) return;
    const handleMove = (e: MouseEvent) => {
      const dx = e.clientX - dragStartX;
      // 1 pixel = 50ms
      setUserAdjustMs(dragStartOffset + dx * 50);
    };
    const handleUp = () => setIsDraggingOffset(false);
    window.addEventListener('mousemove', handleMove);
    window.addEventListener('mouseup', handleUp);
    return () => {
      window.removeEventListener('mousemove', handleMove);
      window.removeEventListener('mouseup', handleUp);
    };
  }, [isDraggingOffset, dragStartX, dragStartOffset]);

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLSelectElement) return;
      switch (e.key) {
        case ' ':
          e.preventDefault();
          togglePlay();
          break;
        case 'ArrowRight':
          if (e.shiftKey) nextStroke();
          else frameStep(1);
          break;
        case 'ArrowLeft':
          if (e.shiftKey) prevStroke();
          else frameStep(-1);
          break;
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  });

  // Toggle athlete
  const toggleAthlete = (seat: number) => {
    setSelectedAthletes(prev => {
      const next = new Set(prev);
      if (next.has(seat)) next.delete(seat);
      else next.add(seat);
      return next;
    });
  };

  // Chart data
  const currentStroke = strokes[currentStrokeIdx];

  // Light moving-average smoother. Window of 3 keeps shape but tames spikes.
  const smoothData = (
    data: Record<string, number | null | undefined>[],
    xKey: string,
    window = 3,
  ) => {
    if (data.length < window) return data;
    const half = Math.floor(window / 2);
    const keys = Object.keys(data[0] || {}).filter(k => k !== xKey);
    return data.map((point, i) => {
      const smoothed: Record<string, number | null | undefined> = { [xKey]: point[xKey] };
      for (const key of keys) {
        let sum = 0;
        let count = 0;
        for (let j = Math.max(0, i - half); j <= Math.min(data.length - 1, i + half); j++) {
          const v = data[j][key];
          if (v != null) { sum += v; count++; }
        }
        smoothed[key] = count > 0 ? sum / count : null;
      }
      return smoothed;
    });
  };

  const getStrokeChartData = () => {
    if (chartMetric === 'forceCurve') {
      return forceCurveData
        .filter(p => p.normalized_time !== undefined)
        .map(p => {
          const d: Record<string, number | null | undefined> = { normalizedTime: p.normalized_time };
          (session?.athletes || []).forEach(a => {
            d[`seat${a.seat_position}`] = p.gate_force_x?.[a.seat_position - 1] ?? null;
          });
          return d;
        });
    }

    if (chartMetric === 'gateAngle') {
      return forceCurveData
        .filter(p => p.normalized_time !== undefined && p.gate_angle)
        .map(p => {
          const d: Record<string, number | null | undefined> = { normalizedTime: p.normalized_time };
          (session?.athletes || []).forEach(a => {
            d[`seat${a.seat_position}`] = p.gate_angle?.[a.seat_position - 1] ?? null;
          });
          return d;
        });
    }

    // Power or boatSpeed are stroke-over-time metrics
    return strokes.map((s, i) => {
      const d: Record<string, number | null> = { stroke: i + 1 };
      if (chartMetric === 'power') {
        (session?.athletes || []).forEach(a => {
          d[`seat${a.seat_position}`] = s.swivel_power?.[a.seat_position - 1] ?? null;
        });
      } else if (chartMetric === 'boatSpeed') {
        d.speed = s.avg_boat_speed ?? null;
        d.rating = s.rating ?? null;
      }
      return d;
    });
  };

  const isPerStrokeChart = chartMetric === 'power' || chartMetric === 'boatSpeed';
  const xDataKey = isPerStrokeChart ? 'stroke' : 'normalizedTime';
  const rawChartData = getStrokeChartData();
  // Light smoothing: window=3 for per-stroke curves (force/gateAngle have dense data)
  const chartData = smoothData(rawChartData, xDataKey, isPerStrokeChart ? 3 : 5);

  const getYLabel = () => {
    switch (chartMetric) {
      case 'power': return 'Power (W)';
      case 'forceCurve': return 'Force (kg)';
      case 'boatSpeed': return 'Speed (m/s)';
      case 'gateAngle': return 'Gate Angle (deg)';
    }
  };

  // Compute stroke phase label
  const getStrokePhaseLabel = () => {
    if (!currentStroke) return '';
    const telemetryTime = currentTimeMs + effectiveOffsetMs;
    const strokeTime = currentStroke.time_ms;
    const driveTime = currentStroke.drive_time?.[0]; // use seat 1 as reference
    if (driveTime != null) {
      const elapsed = (telemetryTime - strokeTime) / 1000;
      if (elapsed < driveTime) return 'DRIVE';
      return 'RECOVERY';
    }
    return '';
  };

  // Compute normalized position within stroke (0-1)
  const getStrokeProgress = () => {
    if (!currentStroke) return 0;
    const nextStrokeTime = currentStrokeIdx < strokes.length - 1
      ? strokes[currentStrokeIdx + 1].time_ms
      : currentStroke.time_ms + 2000;
    const telemetryTime = currentTimeMs + effectiveOffsetMs;
    const strokeDuration = nextStrokeTime - currentStroke.time_ms;
    if (strokeDuration <= 0) return 0;
    return Math.max(0, Math.min(1, (telemetryTime - currentStroke.time_ms) / strokeDuration));
  };

  // Map stroke progress (0→1) linearly across the force curve's normalized_time range.
  // This gives constant-speed movement of the scan bar across the graph.
  // Cached min/max so we don't recompute on every frame.
  const forceCurveTimeRange = useRef<{ min: number; max: number }>({ min: -50, max: 50 });
  if (forceCurveData.length > 0) {
    let minT = Infinity, maxT = -Infinity;
    for (const p of forceCurveData) {
      if (p.normalized_time !== undefined) {
        if (p.normalized_time < minT) minT = p.normalized_time;
        if (p.normalized_time > maxT) maxT = p.normalized_time;
      }
    }
    if (minT !== Infinity) {
      forceCurveTimeRange.current = { min: minT, max: maxT };
    }
  }

  const getNormalizedTimePosition = () => {
    const { min: minT, max: maxT } = forceCurveTimeRange.current;
    const progress = getStrokeProgress();
    return minT + progress * (maxT - minT);
  };

  if (loading) return <div className="text-gray-500 py-8 text-sm">Loading...</div>;
  if (error || !session) return <div className="text-red-600 py-4 text-sm">{error || 'Session not found'}</div>;

  const athletes = session.athletes || [];
  const strokeProgress = getStrokeProgress();
  const normalizedTimePos = getNormalizedTimePosition();

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between text-sm">
        <div className="flex items-center gap-2">
          <Link to="/" className="text-gray-500 hover:text-gray-700">&larr; Sessions</Link>
          <span className="text-gray-300">|</span>
          <Link to={`/dashboard/${session.id}`} className="text-gray-500 hover:text-gray-700">Dashboard</Link>
          <span className="text-gray-300">|</span>
          <span className="font-semibold text-gray-800">{session.name} - Video Analysis</span>
        </div>
        <div className="flex items-center gap-2">
          {session.pieces && session.pieces.length > 0 && (
            <select
              value={selectedPieceId || ''}
              onChange={(e) => setSelectedPieceId(e.target.value)}
              className="border border-gray-300 rounded px-2 py-1 text-xs"
            >
              {session.pieces.map(p => (
                <option key={p.id} value={p.id}>
                  Piece {p.piece_number}{p.name ? `: ${p.name}` : ''}
                </option>
              ))}
            </select>
          )}
        </div>
      </div>

      {/* Main layout: Video + Telemetry side by side */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-3">
        {/* Left: Video */}
        <div className="space-y-2">
          {activeVideo ? (
            <div className="border border-gray-300 rounded overflow-hidden bg-black">
              <video
                ref={videoRef}
                src={getVideoUrl(activeVideo.id)}
                className="w-full"
                onPlay={() => setIsPlaying(true)}
                onPause={() => setIsPlaying(false)}
                onEnded={() => setIsPlaying(false)}
              />
            </div>
          ) : (
            <div className="border border-gray-300 rounded bg-gray-100 flex items-center justify-center h-64">
              <span className="text-gray-400 text-sm">No video uploaded</span>
            </div>
          )}

          {/* Stroke phase indicator */}
          <div className="flex items-center gap-3 text-xs">
            <span className="font-medium text-gray-700">
              Stroke {currentStrokeIdx + 1}/{strokes.length}
            </span>
            {getStrokePhaseLabel() && (
              <span className={`px-2 py-0.5 rounded font-semibold tracking-wider text-xs ${
                getStrokePhaseLabel() === 'DRIVE'
                  ? 'bg-blue-100 text-blue-700'
                  : 'bg-amber-100 text-amber-700'
              }`}>
                {getStrokePhaseLabel()}
              </span>
            )}
            <span className="text-gray-400">
              {(currentTimeMs / 1000).toFixed(2)}s video | {((currentTimeMs + effectiveOffsetMs) / 1000).toFixed(2)}s telemetry
            </span>
          </div>

          {/* Stroke progress bar */}
          <div className="h-1.5 bg-gray-200 rounded-full overflow-hidden">
            <div
              className="h-full bg-blue-500 transition-all duration-75"
              style={{ width: `${strokeProgress * 100}%` }}
            />
          </div>

          {/* Playback controls */}
          <div className="flex items-center gap-1 text-xs flex-wrap">
            <button onClick={rewind} className="bg-gray-200 hover:bg-gray-300 px-2 py-1 rounded" title="Rewind 5s">
              -5s
            </button>
            <button onClick={prevStroke} className="bg-gray-200 hover:bg-gray-300 px-2 py-1 rounded" title="Previous stroke (Shift+Left)">
              |&lt;
            </button>
            <button onClick={() => frameStep(-1)} className="bg-gray-200 hover:bg-gray-300 px-2 py-1 rounded" title="Frame back (Left)">
              &lt;
            </button>
            <button
              onClick={togglePlay}
              className={`px-3 py-1 rounded font-medium ${isPlaying ? 'bg-red-100 text-red-700 hover:bg-red-200' : 'bg-blue-100 text-blue-700 hover:bg-blue-200'}`}
              title="Play/Pause (Space)"
            >
              {isPlaying ? 'Pause' : 'Play'}
            </button>
            <button onClick={() => frameStep(1)} className="bg-gray-200 hover:bg-gray-300 px-2 py-1 rounded" title="Frame forward (Right)">
              &gt;
            </button>
            <button onClick={nextStroke} className="bg-blue-100 text-blue-700 hover:bg-blue-200 px-2 py-1 rounded font-medium" title="Play to next stroke (Shift+Right)">
              Next Stroke &gt;|
            </button>
            <button onClick={fastForward} className="bg-gray-200 hover:bg-gray-300 px-2 py-1 rounded" title="Fast forward 5s">
              +5s
            </button>

            <span className="text-gray-300 mx-1">|</span>

            {/* Speed controls */}
            {[0.25, 0.5, 1, 1.5, 2].map(rate => (
              <button
                key={rate}
                onClick={() => changeSpeed(rate)}
                className={`px-1.5 py-0.5 rounded text-xs ${playbackRate === rate ? 'bg-gray-700 text-white' : 'bg-gray-200 text-gray-600 hover:bg-gray-300'}`}
              >
                {rate}x
              </button>
            ))}
          </div>

          {/* Video scrubber */}
          {activeVideo && videoRef.current && (
            <input
              type="range"
              min={0}
              max={videoRef.current.duration || 100}
              step={0.033}
              value={currentTimeMs / 1000}
              onChange={(e) => {
                if (videoRef.current) {
                  videoRef.current.currentTime = parseFloat(e.target.value);
                }
              }}
              className="w-full"
            />
          )}

          {/* Sync offset control */}
          <div className="border border-gray-300 rounded p-2 space-y-1.5">
            <div className="flex items-center justify-between text-xs">
              <span className="font-medium text-gray-600">Timeline Sync Offset</span>
              <div className="flex items-center gap-1">
                <button
                  onClick={saveSync}
                  disabled={saving}
                  className="bg-blue-100 text-blue-700 hover:bg-blue-200 px-2 py-0.5 rounded text-xs disabled:opacity-50"
                >
                  {saving ? 'Saving...' : 'Save'}
                </button>
              </div>
            </div>
            <div className="flex items-center gap-2 text-xs">
              <button onClick={() => setUserAdjustMs(o => o - 1000)} className="bg-gray-200 hover:bg-gray-300 px-1.5 py-0.5 rounded">-1s</button>
              <button onClick={() => setUserAdjustMs(o => o - 100)} className="bg-gray-200 hover:bg-gray-300 px-1.5 py-0.5 rounded">-100ms</button>
              <button onClick={() => setUserAdjustMs(o => o - 10)} className="bg-gray-200 hover:bg-gray-300 px-1.5 py-0.5 rounded">-10ms</button>

              {/* Draggable offset indicator */}
              <div
                className={`flex-1 bg-gray-100 rounded h-6 flex items-center justify-center cursor-ew-resize select-none border ${isDraggingOffset ? 'border-blue-400 bg-blue-50' : 'border-gray-300'}`}
                onMouseDown={handleTimelineDragStart}
                title="Drag to adjust offset"
              >
                <span className="text-xs font-mono text-gray-600">
                  {userAdjustMs >= 0 ? '+' : ''}{(userAdjustMs / 1000).toFixed(2)}s
                </span>
              </div>

              <button onClick={() => setUserAdjustMs(o => o + 10)} className="bg-gray-200 hover:bg-gray-300 px-1.5 py-0.5 rounded">+10ms</button>
              <button onClick={() => setUserAdjustMs(o => o + 100)} className="bg-gray-200 hover:bg-gray-300 px-1.5 py-0.5 rounded">+100ms</button>
              <button onClick={() => setUserAdjustMs(o => o + 1000)} className="bg-gray-200 hover:bg-gray-300 px-1.5 py-0.5 rounded">+1s</button>
            </div>

            {/* Visual timeline */}
            <div className="relative h-8 bg-gray-50 border border-gray-200 rounded overflow-hidden">
              {/* Video timeline */}
              <div className="absolute top-0 left-0 right-0 h-3 bg-blue-50">
                <div className="absolute top-0 left-0 text-[9px] text-blue-500 px-0.5">Video</div>
                {videoRef.current && (
                  <div
                    className="absolute top-0 h-full bg-blue-200"
                    style={{
                      left: '0%',
                      width: `${Math.min(100, (currentTimeMs / ((videoRef.current.duration || 1) * 1000)) * 100)}%`,
                    }}
                  />
                )}
              </div>
              {/* Telemetry timeline */}
              <div className="absolute bottom-0 left-0 right-0 h-3 bg-green-50">
                <div className="absolute top-0 left-0 text-[9px] text-green-600 px-0.5">Telemetry</div>
                {strokes.length > 0 && (
                  <>
                    {/* Stroke markers */}
                    {strokes.map((s, i) => {
                      const totalDuration = (strokes[strokes.length - 1].time_ms - strokes[0].time_ms) || 1;
                      const pos = ((s.time_ms - strokes[0].time_ms) / totalDuration) * 100;
                      return (
                        <div
                          key={i}
                          className="absolute top-0 h-full w-px bg-green-300"
                          style={{ left: `${pos}%` }}
                        />
                      );
                    })}
                    {/* Current position */}
                    <div
                      className="absolute top-0 h-full w-0.5 bg-green-600"
                      style={{
                        left: `${strokes.length > 1
                          ? Math.max(0, Math.min(100, ((currentTimeMs + effectiveOffsetMs - strokes[0].time_ms) / ((strokes[strokes.length - 1].time_ms - strokes[0].time_ms) || 1)) * 100))
                          : 0}%`,
                      }}
                    />
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Video management */}
          <div className="flex items-center gap-2 text-xs">
            <label className="bg-gray-200 hover:bg-gray-300 text-gray-700 px-2 py-1 rounded cursor-pointer">
              {uploading ? 'Uploading...' : 'Upload Video'}
              <input
                type="file"
                accept="video/*"
                className="hidden"
                onChange={handleVideoUpload}
                disabled={uploading}
              />
            </label>
            {videos.length > 1 && (
              <select
                value={activeVideo?.id || ''}
                onChange={(e) => {
                  const v = videos.find(v => v.id === e.target.value);
                  if (v) {
                    setActiveVideo(v);
                    setUserAdjustMs(v.offset_ms);
                  }
                }}
                className="border border-gray-300 rounded px-1 py-0.5 text-xs"
              >
                {videos.map(v => (
                  <option key={v.id} value={v.id}>{v.original_filename}</option>
                ))}
              </select>
            )}
            {activeVideo && (
              <button
                onClick={() => handleDeleteVideo(activeVideo.id)}
                className="text-gray-400 hover:text-red-500 text-xs"
              >
                Delete Video
              </button>
            )}
          </div>
        </div>

        {/* Right: Telemetry Graph */}
        <div className="space-y-2">
          {/* Chart metric selector */}
          <div className="flex items-center gap-1 text-xs">
            <span className="text-gray-500">Chart:</span>
            {([
              { id: 'power' as ChartMetric, label: 'Power' },
              { id: 'forceCurve' as ChartMetric, label: 'Force Curve' },
              { id: 'boatSpeed' as ChartMetric, label: 'Boat Speed' },
              { id: 'gateAngle' as ChartMetric, label: 'Gate Angle' },
            ]).map(opt => (
              <button
                key={opt.id}
                onClick={() => setChartMetric(opt.id)}
                className={`px-2 py-0.5 rounded ${chartMetric === opt.id ? 'bg-gray-700 text-white' : 'bg-gray-200 text-gray-600 hover:bg-gray-300'}`}
              >
                {opt.label}
              </button>
            ))}
          </div>

          {/* Athlete toggles */}
          <div className="flex flex-wrap items-center gap-1 text-xs">
            {athletes.map(a => {
              const on = selectedAthletes.has(a.seat_position);
              const color = ATHLETE_COLORS[a.seat_position];
              return (
                <button
                  key={a.id}
                  onClick={() => toggleAthlete(a.seat_position)}
                  className={`px-1.5 py-0.5 rounded border text-xs ${on ? 'border-transparent' : 'border-gray-300 opacity-40'}`}
                  style={{
                    backgroundColor: on ? `${color}18` : undefined,
                    color: on ? color : '#9ca3af',
                    borderColor: on ? `${color}40` : undefined,
                  }}
                >
                  <span className="inline-block w-1.5 h-1.5 rounded-full mr-0.5" style={{ backgroundColor: color }} />
                  {a.seat_position}
                </button>
              );
            })}
          </div>

          {/* Main chart */}
          <div className="border border-gray-300 rounded p-3">
            <div className="text-xs font-medium text-gray-600 mb-1">
              {chartMetric === 'forceCurve'
                ? `Force Curve (Stroke ${currentStrokeIdx + 1})`
                : chartMetric === 'gateAngle'
                ? `Gate Angle (Stroke ${currentStrokeIdx + 1})`
                : chartMetric === 'power'
                ? 'Power Over Strokes'
                : 'Boat Speed & Rating'}
            </div>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis
                  dataKey={xDataKey}
                  type="number"
                  domain={['dataMin', 'dataMax']}
                  tick={{ fontSize: 10 }}
                />
                <YAxis
                  tick={{ fontSize: 10 }}
                  label={{ value: getYLabel(), angle: -90, position: 'insideLeft', style: { fontSize: 10 } }}
                />
                <Tooltip contentStyle={{ fontSize: 11 }} />
                {/* Current stroke reference line for stroke-over-time charts */}
                {isPerStrokeChart && (
                  <ReferenceLine x={currentStrokeIdx + 1} stroke="#ef4444" strokeWidth={2} />
                )}
                {/* Normalized time position indicator - moves with video playback */}
                {!isPerStrokeChart && (
                  <ReferenceLine x={normalizedTimePos} stroke="#ef4444" strokeWidth={2} />
                )}
                {chartMetric === 'boatSpeed' ? (
                  <>
                    <Line type="monotone" dataKey="speed" name="Speed" stroke="#6b7280" dot={false} strokeWidth={1.5} />
                    <Line type="monotone" dataKey="rating" name="Rating" stroke="#9ca3af" dot={false} strokeWidth={1.5} strokeDasharray="4 2" />
                  </>
                ) : (
                  athletes.map(a =>
                    selectedAthletes.has(a.seat_position) ? (
                      <Line
                        key={a.seat_position}
                        type="monotone"
                        dataKey={`seat${a.seat_position}`}
                        name={a.name}
                        stroke={ATHLETE_COLORS[a.seat_position]}
                        dot={false}
                        strokeWidth={1.5}
                      />
                    ) : null
                  )
                )}
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* Current stroke details */}
          {currentStroke && (
            <div className="border border-gray-300 rounded p-2 text-xs">
              <div className="font-medium text-gray-600 mb-1">
                Stroke {currentStrokeIdx + 1} Details
              </div>
              <div className="grid grid-cols-3 gap-x-4 gap-y-1 text-gray-500">
                <span>Rating: <strong className="text-gray-800">{currentStroke.rating?.toFixed(1) ?? '-'}</strong></span>
                <span>Speed: <strong className="text-gray-800">{currentStroke.avg_boat_speed?.toFixed(2) ?? '-'} m/s</strong></span>
                <span>Avg Power: <strong className="text-gray-800">{currentStroke.average_power?.toFixed(0) ?? '-'} W</strong></span>
                <span>DPS: <strong className="text-gray-800">{currentStroke.distance_per_stroke?.toFixed(2) ?? '-'} m</strong></span>
              </div>
              {/* Per-athlete power for this stroke */}
              <div className="mt-1 flex flex-wrap gap-2">
                {athletes.map(a => {
                  const power = currentStroke.swivel_power?.[a.seat_position - 1];
                  if (!selectedAthletes.has(a.seat_position)) return null;
                  return (
                    <span key={a.id} style={{ color: ATHLETE_COLORS[a.seat_position] }}>
                      {a.seat_position}: {power?.toFixed(0) ?? '-'}W
                    </span>
                  );
                })}
              </div>
            </div>
          )}

          {/* Stroke navigation slider */}
          <div className="flex items-center gap-2 text-xs">
            <button
              onClick={prevStroke}
              disabled={currentStrokeIdx <= 0}
              className="bg-gray-200 hover:bg-gray-300 disabled:opacity-40 px-2 py-0.5 rounded"
            >
              &larr; Prev
            </button>
            <input
              type="range"
              min={0}
              max={Math.max(0, strokes.length - 1)}
              value={currentStrokeIdx}
              onChange={(e) => seekToStroke(parseInt(e.target.value))}
              className="flex-1"
            />
            <button
              onClick={() => seekToStroke(Math.min(currentStrokeIdx + 1, strokes.length - 1))}
              disabled={currentStrokeIdx >= strokes.length - 1}
              className="bg-gray-200 hover:bg-gray-300 disabled:opacity-40 px-2 py-0.5 rounded"
            >
              Next &rarr;
            </button>
          </div>
        </div>
      </div>

      {/* Keyboard shortcuts help */}
      <div className="text-xs text-gray-400 border-t border-gray-200 pt-2">
        <span className="font-medium">Shortcuts:</span>{' '}
        Space = Play/Pause | Left/Right = Frame step | Shift+Left/Right = Prev/Next stroke
      </div>
    </div>
  );
}
