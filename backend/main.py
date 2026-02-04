"""
Peach Rowing Telemetry API

FastAPI application for uploading, storing, and retrieving rowing telemetry data.
"""

import uuid
import json
from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from typing import List, Optional

from database import get_db, init_db
from models import (
    Session, SessionWithDetails, SessionUpdate, Athlete, Piece, StrokeMetric,
    UploadResponse, PieceAverages, AthleteAverage, PeriodicDataPoint
)
from csv_parser import (
    parse_peach_csv, extract_stroke_arrays, extract_periodic_arrays,
    get_athlete_side
)

app = FastAPI(
    title="Peach Rowing Telemetry API",
    description="API for rowing telemetry analysis",
    version="1.0.0"
)

# Enable CORS for frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
async def startup():
    init_db()


# ============ Upload Endpoints ============

@app.post("/api/upload", response_model=UploadResponse)
async def upload_csv(file: UploadFile = File(...), session_name: Optional[str] = None):
    """Upload and parse a Peach CSV file."""
    if not file.filename.endswith('.csv'):
        raise HTTPException(status_code=400, detail="File must be a CSV")

    content = await file.read()
    content_str = content.decode('utf-8')

    # Parse the CSV
    parsed = parse_peach_csv(content_str)

    # Generate IDs
    session_id = str(uuid.uuid4())
    piece_id = str(uuid.uuid4())

    # Extract session info
    name = session_name or parsed.file_info.get('Session', 'Unknown Session')
    filename = parsed.file_info.get('Filename', file.filename)
    serial_number = parsed.file_info.get('Serial #', '')
    start_time = parsed.file_info.get('Start Time', '')

    with get_db() as conn:
        cursor = conn.cursor()

        # Insert session
        cursor.execute("""
            INSERT INTO sessions (id, name, filename, serial_number, start_time)
            VALUES (?, ?, ?, ?, ?)
        """, (session_id, name, filename, serial_number, start_time))

        # Insert athletes
        athletes = []
        for crew_member in parsed.crew:
            position = crew_member.get('Position', '')
            if position.isdigit():
                athlete_id = str(uuid.uuid4())
                athlete_name = crew_member.get('Name', 'Unknown')
                side = get_athlete_side(parsed.crew, parsed.rig_info, position)

                cursor.execute("""
                    INSERT INTO athletes (id, session_id, seat_position, name, side)
                    VALUES (?, ?, ?, ?, ?)
                """, (athlete_id, session_id, int(position), athlete_name, side))

                athletes.append(Athlete(
                    id=athlete_id,
                    session_id=session_id,
                    seat_position=int(position),
                    name=athlete_name,
                    side=side
                ))

        # Insert piece
        piece_info = parsed.piece_info
        cursor.execute("""
            INSERT INTO pieces (id, session_id, piece_number, name, start_time_ms, end_time_ms, duration, distance_meters, avg_rating, pace)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            piece_id,
            session_id,
            1,
            piece_info.get('#', ''),
            int(piece_info.get('Start', 0)) if piece_info.get('Start') else None,
            int(piece_info.get('End', 0)) if piece_info.get('End') else None,
            piece_info.get('Duration', ''),
            float(piece_info.get('Distance', 0)) if piece_info.get('Distance') else None,
            float(piece_info.get('Rating', 0)) if piece_info.get('Rating') else None,
            piece_info.get('Pace', '')
        ))

        # Insert stroke metrics
        stroke_count = 0
        for stroke in parsed.stroke_metrics:
            stroke_data = extract_stroke_arrays(stroke)
            if stroke_data['stroke_number'] is not None:
                stroke_id = str(uuid.uuid4())
                cursor.execute("""
                    INSERT INTO stroke_metrics (
                        id, piece_id, stroke_number, time_ms, rating, avg_boat_speed,
                        distance_per_stroke, average_power, swivel_power, min_angle,
                        max_angle, catch_slip, finish_slip, drive_time, recovery_time,
                        work_pc_q1, work_pc_q2, work_pc_q3, work_pc_q4
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """, (
                    stroke_id, piece_id, stroke_data['stroke_number'], stroke_data['time_ms'],
                    stroke_data['rating'], stroke_data['avg_boat_speed'],
                    stroke_data['distance_per_stroke'], stroke_data['average_power'],
                    json.dumps(stroke_data['swivel_power']),
                    json.dumps(stroke_data['min_angle']),
                    json.dumps(stroke_data['max_angle']),
                    json.dumps(stroke_data['catch_slip']),
                    json.dumps(stroke_data['finish_slip']),
                    json.dumps(stroke_data['drive_time']),
                    json.dumps(stroke_data['recovery_time']),
                    json.dumps(stroke_data['work_pc_q1']),
                    json.dumps(stroke_data['work_pc_q2']),
                    json.dumps(stroke_data['work_pc_q3']),
                    json.dumps(stroke_data['work_pc_q4']),
                ))
                stroke_count += 1

        # Insert periodic data as JSON blob
        periodic_processed = [extract_periodic_arrays(p) for p in parsed.periodic_data]
        periodic_id = str(uuid.uuid4())
        cursor.execute("""
            INSERT INTO periodic_data (id, piece_id, data)
            VALUES (?, ?, ?)
        """, (periodic_id, piece_id, json.dumps(periodic_processed)))

    return UploadResponse(
        session_id=session_id,
        session_name=name,
        pieces_created=1,
        stroke_count=stroke_count,
        athletes=athletes
    )


# ============ Session Endpoints ============

@app.get("/api/sessions", response_model=List[Session])
async def list_sessions():
    """List all sessions."""
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM sessions ORDER BY created_at DESC")
        rows = cursor.fetchall()
        return [Session(**dict(row)) for row in rows]


@app.get("/api/sessions/{session_id}", response_model=SessionWithDetails)
async def get_session(session_id: str):
    """Get session with athletes and pieces."""
    with get_db() as conn:
        cursor = conn.cursor()

        # Get session
        cursor.execute("SELECT * FROM sessions WHERE id = ?", (session_id,))
        session_row = cursor.fetchone()
        if not session_row:
            raise HTTPException(status_code=404, detail="Session not found")

        # Get athletes
        cursor.execute("SELECT * FROM athletes WHERE session_id = ? ORDER BY seat_position", (session_id,))
        athletes = [Athlete(**dict(row)) for row in cursor.fetchall()]

        # Get pieces
        cursor.execute("SELECT * FROM pieces WHERE session_id = ? ORDER BY piece_number", (session_id,))
        pieces = [Piece(**dict(row)) for row in cursor.fetchall()]

        return SessionWithDetails(**dict(session_row), athletes=athletes, pieces=pieces)


@app.patch("/api/sessions/{session_id}", response_model=Session)
async def update_session(session_id: str, update: SessionUpdate):
    """Update session fields (e.g. rename)."""
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM sessions WHERE id = ?", (session_id,))
        row = cursor.fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="Session not found")

        if update.name is not None:
            cursor.execute("UPDATE sessions SET name = ? WHERE id = ?", (update.name, session_id))

        cursor.execute("SELECT * FROM sessions WHERE id = ?", (session_id,))
        return Session(**dict(cursor.fetchone()))


@app.delete("/api/sessions/{session_id}")
async def delete_session(session_id: str):
    """Delete a session and all related data."""
    with get_db() as conn:
        cursor = conn.cursor()

        # Get pieces to delete their related data
        cursor.execute("SELECT id FROM pieces WHERE session_id = ?", (session_id,))
        piece_ids = [row['id'] for row in cursor.fetchall()]

        for piece_id in piece_ids:
            cursor.execute("DELETE FROM stroke_metrics WHERE piece_id = ?", (piece_id,))
            cursor.execute("DELETE FROM periodic_data WHERE piece_id = ?", (piece_id,))

        cursor.execute("DELETE FROM pieces WHERE session_id = ?", (session_id,))
        cursor.execute("DELETE FROM athletes WHERE session_id = ?", (session_id,))
        cursor.execute("DELETE FROM sessions WHERE id = ?", (session_id,))

    return {"status": "deleted"}


# ============ Piece Endpoints ============

@app.get("/api/pieces/{piece_id}")
async def get_piece(piece_id: str):
    """Get piece details."""
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM pieces WHERE id = ?", (piece_id,))
        row = cursor.fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="Piece not found")
        return Piece(**dict(row))


# ============ Stroke Endpoints ============

@app.get("/api/pieces/{piece_id}/strokes", response_model=List[StrokeMetric])
async def get_strokes(piece_id: str):
    """Get all stroke metrics for a piece."""
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("""
            SELECT * FROM stroke_metrics WHERE piece_id = ?
            ORDER BY stroke_number
        """, (piece_id,))
        rows = cursor.fetchall()

        strokes = []
        for row in rows:
            row_dict = dict(row)
            # Parse JSON arrays
            for key in ['swivel_power', 'min_angle', 'max_angle', 'catch_slip',
                       'finish_slip', 'drive_time', 'recovery_time',
                       'work_pc_q1', 'work_pc_q2', 'work_pc_q3', 'work_pc_q4']:
                if row_dict.get(key):
                    row_dict[key] = json.loads(row_dict[key])
            strokes.append(StrokeMetric(**row_dict))

        return strokes


@app.get("/api/pieces/{piece_id}/strokes/averages", response_model=PieceAverages)
async def get_stroke_averages(piece_id: str):
    """Get average metrics per athlete for a piece."""
    with get_db() as conn:
        cursor = conn.cursor()

        # Get piece info
        cursor.execute("SELECT * FROM pieces WHERE id = ?", (piece_id,))
        piece_row = cursor.fetchone()
        if not piece_row:
            raise HTTPException(status_code=404, detail="Piece not found")

        # Get session athletes
        cursor.execute("""
            SELECT a.* FROM athletes a
            JOIN pieces p ON a.session_id = p.session_id
            WHERE p.id = ?
            ORDER BY a.seat_position
        """, (piece_id,))
        athletes_rows = cursor.fetchall()

        # Get all strokes
        cursor.execute("SELECT * FROM stroke_metrics WHERE piece_id = ?", (piece_id,))
        stroke_rows = cursor.fetchall()

        if not stroke_rows:
            raise HTTPException(status_code=404, detail="No stroke data found")

        # Calculate averages per athlete
        athlete_averages = []
        total_power_sum = 0
        total_power_count = 0

        for athlete in athletes_rows:
            seat_idx = athlete['seat_position'] - 1  # 0-indexed
            powers = []
            stroke_lengths = []
            effective_lengths = []
            catch_slips = []
            finish_slips = []
            drive_times = []
            recovery_times = []

            for stroke in stroke_rows:
                swivel_power = json.loads(stroke['swivel_power']) if stroke['swivel_power'] else []
                min_angle = json.loads(stroke['min_angle']) if stroke['min_angle'] else []
                max_angle = json.loads(stroke['max_angle']) if stroke['max_angle'] else []
                catch_slip = json.loads(stroke['catch_slip']) if stroke['catch_slip'] else []
                finish_slip = json.loads(stroke['finish_slip']) if stroke['finish_slip'] else []
                drive_time = json.loads(stroke['drive_time']) if stroke['drive_time'] else []
                recovery_time = json.loads(stroke['recovery_time']) if stroke['recovery_time'] else []

                if seat_idx < len(swivel_power) and swivel_power[seat_idx] is not None:
                    powers.append(swivel_power[seat_idx])
                if seat_idx < len(min_angle) and seat_idx < len(max_angle):
                    if min_angle[seat_idx] is not None and max_angle[seat_idx] is not None:
                        sl = max_angle[seat_idx] - min_angle[seat_idx]
                        stroke_lengths.append(sl)
                        cs = abs(catch_slip[seat_idx]) if seat_idx < len(catch_slip) and catch_slip[seat_idx] is not None else 0
                        fs = abs(finish_slip[seat_idx]) if seat_idx < len(finish_slip) and finish_slip[seat_idx] is not None else 0
                        effective_lengths.append(sl - cs - fs)
                if seat_idx < len(catch_slip) and catch_slip[seat_idx] is not None:
                    catch_slips.append(abs(catch_slip[seat_idx]))
                if seat_idx < len(finish_slip) and finish_slip[seat_idx] is not None:
                    finish_slips.append(abs(finish_slip[seat_idx]))
                if seat_idx < len(drive_time) and drive_time[seat_idx] is not None:
                    drive_times.append(drive_time[seat_idx])
                if seat_idx < len(recovery_time) and recovery_time[seat_idx] is not None:
                    recovery_times.append(recovery_time[seat_idx])

            avg_power = sum(powers) / len(powers) if powers else None
            if avg_power:
                total_power_sum += avg_power
                total_power_count += 1

            athlete_averages.append(AthleteAverage(
                seat_position=athlete['seat_position'],
                name=athlete['name'],
                avg_power=round(avg_power, 2) if avg_power else None,
                avg_stroke_length=round(sum(stroke_lengths) / len(stroke_lengths), 2) if stroke_lengths else None,
                avg_effective_length=round(sum(effective_lengths) / len(effective_lengths), 2) if effective_lengths else None,
                avg_catch_slip=round(sum(catch_slips) / len(catch_slips), 2) if catch_slips else None,
                avg_finish_slip=round(sum(finish_slips) / len(finish_slips), 2) if finish_slips else None,
                avg_drive_time=round(sum(drive_times) / len(drive_times), 4) if drive_times else None,
                avg_recovery_time=round(sum(recovery_times) / len(recovery_times), 4) if recovery_times else None,
            ))

        # Calculate overall averages
        ratings = [s['rating'] for s in stroke_rows if s['rating']]
        speeds = [s['avg_boat_speed'] for s in stroke_rows if s['avg_boat_speed']]

        return PieceAverages(
            piece_id=piece_id,
            piece_name=piece_row['name'],
            total_strokes=len(stroke_rows),
            avg_rating=round(sum(ratings) / len(ratings), 2) if ratings else None,
            avg_boat_speed=round(sum(speeds) / len(speeds), 4) if speeds else None,
            athletes=athlete_averages,
            crew_avg_power=round(total_power_sum / total_power_count, 2) if total_power_count > 0 else None
        )


# ============ Periodic Data Endpoints ============

@app.get("/api/pieces/{piece_id}/periodic")
async def get_periodic_data(
    piece_id: str,
    stroke_start: Optional[int] = None,
    stroke_end: Optional[int] = None,
    downsample: int = 1
):
    """
    Get periodic (high-frequency) data for a piece.

    Args:
        piece_id: The piece ID
        stroke_start: Optional start stroke time in ms
        stroke_end: Optional end stroke time in ms
        downsample: Return every Nth data point (default 1 = all data)
    """
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT data FROM periodic_data WHERE piece_id = ?", (piece_id,))
        row = cursor.fetchone()

        if not row:
            raise HTTPException(status_code=404, detail="Periodic data not found")

        data = json.loads(row['data'])

        # Filter by time range if specified
        if stroke_start is not None or stroke_end is not None:
            filtered = []
            for point in data:
                time_ms = point.get('time_ms')
                if time_ms is None:
                    continue
                if stroke_start is not None and time_ms < stroke_start:
                    continue
                if stroke_end is not None and time_ms > stroke_end:
                    continue
                filtered.append(point)
            data = filtered

        # Downsample if requested
        if downsample > 1:
            data = data[::downsample]

        return {
            "piece_id": piece_id,
            "total_points": len(data),
            "data": data
        }


@app.get("/api/pieces/{piece_id}/stroke/{stroke_number}/force-curve")
async def get_force_curve(piece_id: str, stroke_number: int):
    """
    Get force curve data for a specific stroke.
    Returns periodic data points for one complete stroke cycle.
    """
    with get_db() as conn:
        cursor = conn.cursor()

        # Get stroke timing
        cursor.execute("""
            SELECT time_ms FROM stroke_metrics
            WHERE piece_id = ? AND stroke_number = ?
        """, (piece_id, stroke_number))
        stroke_row = cursor.fetchone()

        if not stroke_row:
            raise HTTPException(status_code=404, detail="Stroke not found")

        stroke_time = stroke_row['time_ms']

        # Get periodic data
        cursor.execute("SELECT data FROM periodic_data WHERE piece_id = ?", (piece_id,))
        periodic_row = cursor.fetchone()

        if not periodic_row:
            raise HTTPException(status_code=404, detail="Periodic data not found")

        data = json.loads(periodic_row['data'])

        # Find data points for this stroke (within ~2 seconds of stroke time)
        stroke_data = []
        for point in data:
            time_ms = point.get('time_ms')
            if time_ms is None:
                continue
            # Stroke cycle is roughly 1.5-2 seconds, look for nearby data
            if abs(time_ms - stroke_time) < 2000:
                stroke_data.append(point)

        # Sort by normalized time to get proper force curve
        stroke_data.sort(key=lambda x: x.get('normalized_time') or 0)

        return {
            "stroke_number": stroke_number,
            "stroke_time_ms": stroke_time,
            "data_points": len(stroke_data),
            "data": stroke_data
        }


# ============ Health Check ============

@app.get("/api/health")
async def health_check():
    """Health check endpoint."""
    return {"status": "healthy", "version": "1.0.0"}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
