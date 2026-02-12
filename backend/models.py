from pydantic import BaseModel
from typing import Optional, List


class Athlete(BaseModel):
    id: str
    session_id: str
    seat_position: int
    name: str
    side: Optional[str] = None
    global_athlete_id: Optional[str] = None
    uni: Optional[str] = None


class Piece(BaseModel):
    id: str
    session_id: str
    piece_number: int
    name: Optional[str] = None
    start_time_ms: Optional[int] = None
    end_time_ms: Optional[int] = None
    duration: Optional[str] = None
    distance_meters: Optional[float] = None
    avg_rating: Optional[float] = None
    pace: Optional[str] = None


class Session(BaseModel):
    id: str
    name: str
    filename: Optional[str] = None
    serial_number: Optional[str] = None
    start_time: Optional[str] = None
    boat_name: Optional[str] = None
    boat_seats: int = 8
    created_at: Optional[str] = None


class SessionWithDetails(Session):
    athletes: List[Athlete] = []
    pieces: List[Piece] = []


class StrokeMetric(BaseModel):
    id: str
    piece_id: str
    stroke_number: int
    time_ms: int
    rating: Optional[float] = None
    avg_boat_speed: Optional[float] = None
    distance_per_stroke: Optional[float] = None
    average_power: Optional[float] = None
    swivel_power: Optional[List[Optional[float]]] = None
    min_angle: Optional[List[Optional[float]]] = None
    max_angle: Optional[List[Optional[float]]] = None
    catch_slip: Optional[List[Optional[float]]] = None
    finish_slip: Optional[List[Optional[float]]] = None
    drive_time: Optional[List[Optional[float]]] = None
    recovery_time: Optional[List[Optional[float]]] = None
    work_pc_q1: Optional[List[Optional[float]]] = None
    work_pc_q2: Optional[List[Optional[float]]] = None
    work_pc_q3: Optional[List[Optional[float]]] = None
    work_pc_q4: Optional[List[Optional[float]]] = None


class PeriodicDataPoint(BaseModel):
    time_ms: int
    normalized_time: Optional[float] = None
    gate_angle: Optional[List[float]] = None
    gate_force_x: Optional[List[float]] = None
    gate_angle_vel: Optional[List[float]] = None
    speed: Optional[float] = None
    distance: Optional[float] = None
    accel: Optional[float] = None


class UploadResponse(BaseModel):
    session_id: str
    session_name: str
    pieces_created: int
    stroke_count: int
    athletes: List[Athlete]


class SessionUpdate(BaseModel):
    name: Optional[str] = None


class AthleteAverage(BaseModel):
    seat_position: int
    name: str
    avg_power: Optional[float] = None
    avg_stroke_length: Optional[float] = None
    avg_effective_length: Optional[float] = None
    avg_catch_slip: Optional[float] = None
    avg_finish_slip: Optional[float] = None
    avg_drive_time: Optional[float] = None
    avg_recovery_time: Optional[float] = None


class PieceAverages(BaseModel):
    piece_id: str
    piece_name: Optional[str] = None
    total_strokes: int
    avg_rating: Optional[float] = None
    avg_boat_speed: Optional[float] = None
    athletes: List[AthleteAverage]
    crew_avg_power: Optional[float] = None


# ============ Global Athletes Models ============

class GlobalAthlete(BaseModel):
    id: str
    uni: Optional[str] = None
    name: str
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    squad: Optional[str] = None
    weight: Optional[float] = None
    session_count: int = 0
    created_at: Optional[str] = None
    updated_at: Optional[str] = None


class GlobalAthleteUpdate(BaseModel):
    name: Optional[str] = None
    uni: Optional[str] = None
    squad: Optional[str] = None
    weight: Optional[float] = None


class AthleteSessionEntry(BaseModel):
    session_id: str
    session_name: str
    session_date: Optional[str] = None
    seat_position: int
    side: Optional[str] = None


class GlobalAthleteDetail(GlobalAthlete):
    sessions: List[AthleteSessionEntry] = []


class AthleteTrendPoint(BaseModel):
    session_id: str
    session_name: str
    session_date: Optional[str] = None
    piece_id: str
    piece_name: Optional[str] = None
    seat_position: int
    avg_power: Optional[float] = None
    avg_stroke_length: Optional[float] = None
    avg_effective_length: Optional[float] = None
    avg_catch_slip: Optional[float] = None
    avg_finish_slip: Optional[float] = None


class AthleteTrends(BaseModel):
    athlete: GlobalAthlete
    data_points: List[AthleteTrendPoint] = []
