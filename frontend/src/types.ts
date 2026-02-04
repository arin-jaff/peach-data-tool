export interface Athlete {
  id: string;
  session_id: string;
  seat_position: number;
  name: string;
  side?: string;
}

export interface Piece {
  id: string;
  session_id: string;
  piece_number: number;
  name?: string;
  start_time_ms?: number;
  end_time_ms?: number;
  duration?: string;
  distance_meters?: number;
  avg_rating?: number;
  pace?: string;
}

export interface Session {
  id: string;
  name: string;
  filename?: string;
  serial_number?: string;
  start_time?: string;
  boat_name?: string;
  boat_seats: number;
  created_at?: string;
  athletes?: Athlete[];
  pieces?: Piece[];
}

export interface StrokeMetric {
  id: string;
  piece_id: string;
  stroke_number: number;
  time_ms: number;
  rating?: number;
  avg_boat_speed?: number;
  distance_per_stroke?: number;
  average_power?: number;
  swivel_power?: (number | null)[];
  min_angle?: (number | null)[];
  max_angle?: (number | null)[];
  catch_slip?: (number | null)[];
  finish_slip?: (number | null)[];
  drive_time?: (number | null)[];
  recovery_time?: (number | null)[];
  work_pc_q1?: (number | null)[];
  work_pc_q2?: (number | null)[];
  work_pc_q3?: (number | null)[];
  work_pc_q4?: (number | null)[];
}

export interface PeriodicDataPoint {
  time_ms: number;
  normalized_time?: number;
  gate_angle?: (number | null)[];
  gate_force_x?: (number | null)[];
  gate_angle_vel?: (number | null)[];
  speed?: number;
  distance?: number;
  accel?: number;
}

export interface AthleteAverage {
  seat_position: number;
  name: string;
  avg_power?: number;
  avg_stroke_length?: number;
  avg_effective_length?: number;
  avg_catch_slip?: number;
  avg_finish_slip?: number;
  avg_drive_time?: number;
  avg_recovery_time?: number;
}

export interface PieceAverages {
  piece_id: string;
  piece_name?: string;
  total_strokes: number;
  avg_rating?: number;
  avg_boat_speed?: number;
  athletes: AthleteAverage[];
  crew_avg_power?: number;
}

export interface UploadResponse {
  session_id: string;
  session_name: string;
  pieces_created: number;
  stroke_count: number;
  athletes: Athlete[];
}
