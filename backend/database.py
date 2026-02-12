import sqlite3
import uuid
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

        # Global athletes table
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS global_athletes (
                id TEXT PRIMARY KEY,
                uni TEXT,
                name TEXT NOT NULL,
                first_name TEXT,
                last_name TEXT,
                squad TEXT,
                weight REAL,
                peach_id TEXT,
                created_at TEXT DEFAULT CURRENT_TIMESTAMP,
                updated_at TEXT DEFAULT CURRENT_TIMESTAMP
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

        # Migrate athletes table: add global_athlete_id and uni columns if missing
        cursor.execute("PRAGMA table_info(athletes)")
        columns = [row[1] for row in cursor.fetchall()]
        if 'global_athlete_id' not in columns:
            cursor.execute("ALTER TABLE athletes ADD COLUMN global_athlete_id TEXT")
        if 'uni' not in columns:
            cursor.execute("ALTER TABLE athletes ADD COLUMN uni TEXT")

        # Create indexes
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_athletes_session ON athletes(session_id)")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_pieces_session ON pieces(session_id)")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_strokes_piece ON stroke_metrics(piece_id)")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_periodic_piece ON periodic_data(piece_id)")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_athletes_global ON athletes(global_athlete_id)")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_global_athletes_uni ON global_athletes(uni)")

        # Backfill: create global athletes for existing session-athletes that lack a link
        _backfill_global_athletes(cursor)


def _backfill_global_athletes(cursor):
    """Create global athlete records for session-athletes missing global_athlete_id."""
    cursor.execute("SELECT * FROM athletes WHERE global_athlete_id IS NULL")
    orphans = cursor.fetchall()
    if not orphans:
        return

    name_map = {}  # normalized_name -> global_athlete_id
    for orphan in orphans:
        norm = ' '.join(orphan['name'].lower().split())
        if norm not in name_map:
            gid = str(uuid.uuid4())
            cursor.execute(
                "INSERT INTO global_athletes (id, name) VALUES (?, ?)",
                (gid, orphan['name'])
            )
            name_map[norm] = gid
        cursor.execute(
            "UPDATE athletes SET global_athlete_id = ? WHERE id = ?",
            (name_map[norm], orphan['id'])
        )


# Initialize database on import
init_db()
