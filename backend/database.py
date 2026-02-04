import sqlite3
import json
from pathlib import Path
from contextlib import contextmanager

DATABASE_PATH = Path(__file__).parent / "peach_telemetry.db"


def get_connection():
    conn = sqlite3.connect(DATABASE_PATH)
    conn.row_factory = sqlite3.Row
    return conn


@contextmanager
def get_db():
    conn = get_connection()
    try:
        yield conn
        conn.commit()
    finally:
        conn.close()


def init_db():
    """Initialize the database with schema."""
    with get_db() as conn:
        cursor = conn.cursor()

        # Sessions table
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS sessions (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                filename TEXT,
                serial_number TEXT,
                start_time TEXT,
                boat_name TEXT,
                boat_seats INTEGER DEFAULT 8,
                created_at TEXT DEFAULT CURRENT_TIMESTAMP
            )
        """)

        # Athletes table
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS athletes (
                id TEXT PRIMARY KEY,
                session_id TEXT REFERENCES sessions(id) ON DELETE CASCADE,
                seat_position INTEGER NOT NULL,
                name TEXT NOT NULL,
                side TEXT,
                UNIQUE(session_id, seat_position)
            )
        """)

        # Pieces table
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS pieces (
                id TEXT PRIMARY KEY,
                session_id TEXT REFERENCES sessions(id) ON DELETE CASCADE,
                piece_number INTEGER NOT NULL,
                name TEXT,
                start_time_ms INTEGER,
                end_time_ms INTEGER,
                duration TEXT,
                distance_meters REAL,
                avg_rating REAL,
                pace TEXT,
                UNIQUE(session_id, piece_number)
            )
        """)

        # Stroke metrics table
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS stroke_metrics (
                id TEXT PRIMARY KEY,
                piece_id TEXT REFERENCES pieces(id) ON DELETE CASCADE,
                stroke_number INTEGER NOT NULL,
                time_ms INTEGER NOT NULL,
                rating REAL,
                avg_boat_speed REAL,
                distance_per_stroke REAL,
                average_power REAL,
                swivel_power TEXT,
                min_angle TEXT,
                max_angle TEXT,
                catch_slip TEXT,
                finish_slip TEXT,
                drive_time TEXT,
                recovery_time TEXT,
                work_pc_q1 TEXT,
                work_pc_q2 TEXT,
                work_pc_q3 TEXT,
                work_pc_q4 TEXT,
                UNIQUE(piece_id, stroke_number)
            )
        """)

        # Periodic data table
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS periodic_data (
                id TEXT PRIMARY KEY,
                piece_id TEXT REFERENCES pieces(id) ON DELETE CASCADE,
                data TEXT NOT NULL
            )
        """)

        # Create indexes for performance
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_athletes_session ON athletes(session_id)")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_pieces_session ON pieces(session_id)")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_strokes_piece ON stroke_metrics(piece_id)")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_periodic_piece ON periodic_data(piece_id)")


# Initialize database on import
init_db()
