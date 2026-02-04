"""
Peach Rowing Telemetry CSV Parser

Parses CSV files exported from Peach PowerLine rowing telemetry system.
The format is section-based with #ERROR! markers as delimiters.
"""

import json
from typing import Dict, List, Optional, Any
from dataclasses import dataclass


@dataclass
class ParsedData:
    """Container for all parsed data from a Peach CSV file."""
    file_info: Dict[str, str]
    crew: List[Dict[str, str]]
    rig_info: List[Dict[str, str]]
    piece_info: Dict[str, str]
    stroke_metrics: List[Dict[str, Any]]
    periodic_data: List[Dict[str, Any]]


def find_section_start(lines: List[str], section_name: str) -> int:
    """Find the line number where a section starts."""
    for i, line in enumerate(lines):
        if f'#ERROR!,{section_name}' in line:
            return i
    return -1


def parse_to_float(value: str) -> Optional[float]:
    """Safely parse a string to float."""
    if not value or value.strip() == '':
        return None
    try:
        return float(value)
    except ValueError:
        return None


def parse_to_int(value: str) -> Optional[int]:
    """Safely parse a string to int."""
    if not value or value.strip() == '':
        return None
    try:
        return int(float(value))
    except ValueError:
        return None


def parse_peach_csv(content: str) -> ParsedData:
    """
    Parse a Peach rowing telemetry CSV file.

    Args:
        content: The CSV file content as a string

    Returns:
        ParsedData containing all parsed sections
    """
    lines = content.split('\n')

    # Parse File Info
    file_info = {}
    file_info_start = find_section_start(lines, 'File Info')
    if file_info_start >= 0 and file_info_start + 2 < len(lines):
        header = lines[file_info_start + 1].strip().split(',')
        values = lines[file_info_start + 2].strip().split(',')
        file_info = dict(zip(header[:len(values)], values))

    # Parse Crew Info
    crew = []
    crew_start = find_section_start(lines, 'Crew Info')
    if crew_start >= 0:
        header = lines[crew_start + 1].strip().split(',')
        i = crew_start + 2
        while i < len(lines) and not lines[i].startswith('#ERROR!'):
            row = lines[i].strip().split(',')
            if row[0] and row[0] not in ['', ' ']:
                crew_data = dict(zip(header[:len(row)], row))
                if crew_data.get('Position') and crew_data.get('Name'):
                    crew.append(crew_data)
            i += 1

    # Parse Rig Info
    rig_info = []
    rig_start = find_section_start(lines, 'Rig Info')
    if rig_start >= 0:
        i = rig_start + 3  # Skip header rows
        while i < len(lines) and not lines[i].startswith('#ERROR!'):
            row = lines[i].strip().split(',')
            if row[0] and row[0].isdigit():
                rig_info.append({'position': row[0], 'side': row[1] if len(row) > 1 else None})
            i += 1

    # Parse Piece Info
    piece_info = {}
    piece_start = find_section_start(lines, 'Piece')
    if piece_start >= 0 and piece_start + 2 < len(lines):
        header = lines[piece_start + 1].strip().split(',')
        values = lines[piece_start + 2].strip().split(',')
        piece_info = dict(zip(header[:len(values)], values))

    # Parse Stroke Metrics (Aperiodic 0x800A)
    stroke_metrics = []
    stroke_start = find_section_start(lines, 'Aperiodic,0x800A')
    if stroke_start >= 0:
        # Build column names from header rows
        header1 = lines[stroke_start + 1].strip().split(',')
        header2 = lines[stroke_start + 2].strip().split(',')

        columns = []
        for idx, (h1, h2) in enumerate(zip(header1, header2)):
            if h2 and h2 not in ['Boat', '']:
                columns.append(f"{h1}_{h2}")
            else:
                columns.append(h1)

        # Parse data rows
        i = stroke_start + 3
        while i < len(lines) and not lines[i].startswith('#ERROR!'):
            row = lines[i].strip().split(',')
            if row[0] and row[0].replace('.', '').replace('-', '').isdigit():
                stroke_data = {}
                for col_idx, col_name in enumerate(columns[:len(row)]):
                    if col_idx < len(row):
                        stroke_data[col_name] = row[col_idx]
                stroke_metrics.append(stroke_data)
            i += 1

    # Parse Periodic Data (High-frequency, 50Hz)
    periodic_data = []
    periodic_start = find_section_start(lines, 'Periodic')
    if periodic_start >= 0:
        header1 = lines[periodic_start + 1].strip().split(',')
        header2 = lines[periodic_start + 2].strip().split(',')

        columns = []
        for idx, (h1, h2) in enumerate(zip(header1, header2)):
            if h2 and h2 not in ['Boat', '']:
                columns.append(f"{h1}_{h2}")
            else:
                columns.append(h1)

        # Parse data rows
        i = periodic_start + 3
        while i < len(lines):
            row = lines[i].strip().split(',')
            if row[0] and row[0].replace('.', '').replace('-', '').isdigit():
                periodic_point = {}
                for col_idx, col_name in enumerate(columns[:len(row)]):
                    if col_idx < len(row):
                        periodic_point[col_name] = row[col_idx]
                periodic_data.append(periodic_point)
            i += 1

    return ParsedData(
        file_info=file_info,
        crew=crew,
        rig_info=rig_info,
        piece_info=piece_info,
        stroke_metrics=stroke_metrics,
        periodic_data=periodic_data
    )


def _find_seat_value(stroke: Dict[str, str], prefixes: List[str], seat: int) -> Optional[float]:
    """Try multiple column name variants to find a per-seat value."""
    for prefix in prefixes:
        key = f"{prefix}_{seat}"
        val = stroke.get(key, '')
        if val and val.strip():
            return parse_to_float(val)
    return None


def extract_stroke_arrays(stroke: Dict[str, str]) -> Dict[str, Any]:
    """
    Extract per-seat arrays from a stroke metric row.

    Handles variant column names (e.g. "DriveTime" vs "Drive Time").
    """
    result = {
        'time_ms': parse_to_int(stroke.get('Time', '')),
        'stroke_number': parse_to_int(stroke.get('StrokeNumber', '')),
        'rating': parse_to_float(stroke.get('Rating', '')),
        'avg_boat_speed': parse_to_float(stroke.get('AvgBoatSpeed', '')),
        'distance_per_stroke': parse_to_float(stroke.get('Dist/Stroke', '')),
        'average_power': parse_to_float(stroke.get('Average Power', '')),
    }

    # Per-seat metrics: (output_key, [possible_csv_prefixes])
    metrics = [
        ('swivel_power', ['SwivelPower', 'Swivel Power']),
        ('min_angle', ['MinAngle', 'Min Angle']),
        ('max_angle', ['MaxAngle', 'Max Angle']),
        ('catch_slip', ['CatchSlip', 'Catch Slip']),
        ('finish_slip', ['FinishSlip', 'Finish Slip']),
        ('drive_time', ['DriveTime', 'Drive Time']),
        ('recovery_time', ['RecoveryTime', 'Recovery Time']),
        ('work_pc_q1', ['WorkPCQ1', 'Work PCQ1', 'Work PC Q1']),
        ('work_pc_q2', ['WorkPCQ2', 'Work PCQ2', 'Work PC Q2']),
        ('work_pc_q3', ['WorkPCQ3', 'Work PCQ3', 'Work PC Q3']),
        ('work_pc_q4', ['WorkPCQ4', 'Work PCQ4', 'Work PC Q4']),
    ]

    for result_key, csv_prefixes in metrics:
        values = []
        for seat in range(1, 9):
            val = _find_seat_value(stroke, csv_prefixes, seat)
            values.append(val)
        result[result_key] = values

    return result


def extract_periodic_arrays(point: Dict[str, str]) -> Dict[str, Any]:
    """
    Extract per-seat arrays from a periodic data point.
    """
    result = {
        'time_ms': parse_to_int(point.get('Time', '')),
        'normalized_time': parse_to_float(point.get('Normalized Time', '')),
        'speed': parse_to_float(point.get('Speed', '')),
        'distance': parse_to_float(point.get('Distance', '')),
        'accel': parse_to_float(point.get('Accel', '')),
    }

    # Per-seat metrics
    metrics = [
        ('gate_angle', 'GateAngle'),
        ('gate_force_x', 'GateForceX'),
        ('gate_angle_vel', 'GateAngleVel'),
    ]

    for result_key, csv_prefix in metrics:
        values = []
        for seat in range(1, 9):
            key = f"{csv_prefix}_{seat}"
            val = parse_to_float(point.get(key, ''))
            values.append(val)
        result[result_key] = values

    return result


def get_athlete_side(crew: List[Dict], rig_info: List[Dict], position: str) -> Optional[str]:
    """Get the rowing side (Port/Stbd) for an athlete."""
    for rig in rig_info:
        if rig.get('position') == position:
            return rig.get('side')
    return None
