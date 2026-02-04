# Peach Rowing Telemetry CSV Data Extraction Guide

## Overview

These CSV files are exported from the **Peach PowerLine** (or similar Peach) rowing telemetry system. The format is section-based with multiple data types embedded in a single file. Each section is delimited by `#ERROR!` markers followed by a section name.

---

## File Structure Summary

| Line Range | Section | Description |
|------------|---------|-------------|
| 1-3 | File Info | Session metadata, filename, timestamp |
| 4-6 | GPS Info | Starting GPS coordinates, UTC time |
| 7-18 | Crew Info | Rower names and positions (1-8 + Cox + Coach) |
| 19-29 | Rig Info | Port/Starboard configuration per seat |
| 30-32 | Venue Info | Venue name, altitude, coordinates |
| 33-35 | Misc Info | Session comments, session name |
| 36-38 | Boat Info | Boat name, seats, coxed status, rig type |
| 39-50 | Parameter Info | Calibration parameters (oar length, drive thresholds) |
| 51-75 | Sensor Info | Channel mappings, serial numbers, stroke counts |
| 76-78 | Piece Info | Piece start/end times, duration, distance, rating, pace |
| 79-~235 | Aperiodic 0x8013 | Low-frequency GPS data (1 Hz) |
| ~237-~330 | Aperiodic 0x800A | **Stroke-level metrics** (per-stroke summary) |
| ~332-335 | Aperiodic 0x8001 | Additional aperiodic data |
| ~336-EOF | Periodic | **High-frequency sensor data** (50 Hz) |

---

## Key Data Sections

### 1. Periodic Data (High-Frequency, ~50 Hz)

**Location:** Search for `#ERROR!,Periodic` — data starts 2 rows below.

**Header Structure (Row 337-338 in example):**
```
Row 1: Time, GateAngle (×8), GateForceX (×8), GateAngleVel (×8), Speed, Distance, Accel, Roll Angle, Pitch Angle, Yaw Angle, Normalized Time
Row 2: (empty), 1,2,3,4,5,6,7,8, 1,2,3,4,5,6,7,8, 1,2,3,4,5,6,7,8, Boat,Boat,Boat,Boat,Boat,Boat,Boat
```

**Column Mapping (0-indexed):**

| Index | Column Name | Unit | Description |
|-------|-------------|------|-------------|
| 0 | Time | ms | Peach internal timestamp (milliseconds) |
| 1-8 | GateAngle[1-8] | degrees | Oar angle at gate (seats 1-8) |
| 9-16 | GateForceX[1-8] | kg | Force on oarlock/gate (seats 1-8) |
| 17-24 | GateAngleVel[1-8] | deg/s | Angular velocity of oar (seats 1-8) |
| 25 | Speed | m/s | Boat speed |
| 26 | Distance | m | Cumulative distance |
| 27 | Accel | m/s² | Boat acceleration |
| 28 | Roll Angle | degrees | Boat roll |
| 29 | Pitch Angle | degrees | Boat pitch |
| 30 | Yaw Angle | degrees | Boat yaw/heading |
| 31 | Normalized Time | % | Position within stroke (0-100) |

**Sample Rate:** 20ms intervals (50 Hz)

---

### 2. Stroke-Level Metrics (Aperiodic 0x800A)

**Location:** Search for `#ERROR!,Aperiodic,0x800A` — data starts 2 rows below.

**This section contains per-stroke summary statistics — the most valuable data for performance analysis.**

**Column Mapping (0-indexed):**

| Index | Column Name | Unit | Description |
|-------|-------------|------|-------------|
| 0 | Time | ms | Stroke timestamp |
| 1-8 | SwivelPower[1-8] | W | Power output per rower |
| 9-16 | MinAngle[1-8] | deg | Catch angle (oar angle at catch) |
| 17-24 | CatchSlip[1-8] | deg | Slip at the catch |
| 25-32 | MaxAngle[1-8] | deg | Finish angle (oar angle at finish) |
| 33-40 | FinishSlip[1-8] | deg | Slip at the finish |
| 41-48 | DriveStartT[1-8] | ms | Drive start time offset |
| 49-56 | RowerSwivelPower[1-8] | W | Alternative power calculation |
| 57-64 | DriveTime[1-8] | s | Duration of drive phase |
| 65-72 | RecoveryTime[1-8] | s | Duration of recovery phase |
| 73-80 | AngleMaxF[1-8] | deg | Angle at maximum force |
| 81-88 | Angle0.7F[1-8] | deg | Angle at 70% of max force |
| 89-96 | WorkPCQ1[1-8] | % | Work percentage in quarter 1 |
| 97-104 | WorkPCQ2[1-8] | % | Work percentage in quarter 2 |
| 105-112 | WorkPCQ3[1-8] | % | Work percentage in quarter 3 |
| 113-120 | WorkPCQ4[1-8] | % | Work percentage in quarter 4 |
| 121-128 | MaxForcePC[1-8] | % | Percentage of maximum force |
| 129 | Rating | spm | Strokes per minute |
| 130 | AvgBoatSpeed | m/s | Average boat speed |
| 131 | StrokeNumber | int | Sequential stroke count |
| 132 | Dist/Stroke | m | Distance per stroke |
| 133 | Average Power | W | Crew average power |

**Derived Metrics:**
- **Stroke Length** = MaxAngle - MinAngle (effective arc)
- **Drive:Recovery Ratio** = DriveTime / RecoveryTime
- **Timing Sync** = std deviation of DriveStartT across crew

---

### 3. Piece Summary

**Location:** Search for `#ERROR!,Piece` — data on row below header.

**Columns:** Start, End, #, Duration, Distance, Rating, Pace, comment, Wind, Stream, Validated

**Example:**
```
3909480,4061480,2016 v GW 1V,02:32.0,843,35.5,1:30.1,,,,
```
- Start time: 3909480 ms
- End time: 4061480 ms  
- Piece name: "2016 v GW 1V"
- Duration: 2:32.0
- Distance: 843 m
- Rating: 35.5 spm
- Pace: 1:30.1 (per 500m)

---

### 4. Crew Information

**Location:** Search for `#ERROR!,Crew Info`

**Columns:** Position, Name, Abbr, ID, First Name, Last Name, Abbreviation, Squad, Email, Birthdate, Height, Weight

**Seat Numbers:**
- 1-8: Rowers (1 = bow, 8 = stroke)
- Cox: Coxswain
- Coach: Coach (if present)

---

### 5. Rig Configuration

**Location:** Search for `#ERROR!,Rig Info`

Maps seat position to side:
- `Stbd` = Starboard (right side when facing bow)
- `Port` = Port (left side when facing bow)

---

### 6. Sensor Calibration Info

**Location:** Search for `#ERROR!,Sensor Info`

Contains sensor serial numbers and calibration data. Important channels:
- `GateForceX[n]`: Force sensor at seat n
- `GateAngle[n]`: Angle sensor at seat n
- `Speed`: Impeller speed sensor
- `Accel`: Accelerometer

---

## Python Extraction Code

```python
import pandas as pd
import numpy as np
from typing import Dict, List, Tuple
import re

def find_section_start(lines: List[str], section_name: str) -> int:
    """Find the line number where a section starts."""
    for i, line in enumerate(lines):
        if f'#ERROR!,{section_name}' in line:
            return i
    return -1

def parse_peach_csv(filepath: str) -> Dict:
    """Parse a Peach rowing telemetry CSV file."""
    
    with open(filepath, 'r') as f:
        lines = f.readlines()
    
    result = {}
    
    # 1. Parse File Info
    file_info_start = find_section_start(lines, 'File Info')
    if file_info_start >= 0:
        header = lines[file_info_start + 1].strip().split(',')
        values = lines[file_info_start + 2].strip().split(',')
        result['file_info'] = dict(zip(header[:len(values)], values))
    
    # 2. Parse Crew Info
    crew_start = find_section_start(lines, 'Crew Info')
    if crew_start >= 0:
        crew_data = []
        header = lines[crew_start + 1].strip().split(',')
        i = crew_start + 2
        while i < len(lines) and not lines[i].startswith('#ERROR!'):
            row = lines[i].strip().split(',')
            if row[0]:  # Has position
                crew_data.append(dict(zip(header[:len(row)], row)))
            i += 1
        result['crew'] = crew_data
    
    # 3. Parse Piece Info
    piece_start = find_section_start(lines, 'Piece')
    if piece_start >= 0:
        header = lines[piece_start + 1].strip().split(',')
        values = lines[piece_start + 2].strip().split(',')
        result['piece'] = dict(zip(header[:len(values)], values))
    
    # 4. Parse Stroke Metrics (Aperiodic 0x800A)
    stroke_start = find_section_start(lines, 'Aperiodic,0x800A')
    if stroke_start >= 0:
        # Build column names from header rows
        header1 = lines[stroke_start + 1].strip().split(',')
        header2 = lines[stroke_start + 2].strip().split(',')
        
        columns = []
        for h1, h2 in zip(header1, header2):
            if h2 and h2 not in ['Boat', '']:
                columns.append(f"{h1}_{h2}")
            else:
                columns.append(h1)
        
        # Find data rows
        data_rows = []
        i = stroke_start + 3
        while i < len(lines) and not lines[i].startswith('#ERROR!'):
            row = lines[i].strip().split(',')
            if row[0] and row[0].isdigit():
                data_rows.append(row)
            i += 1
        
        result['stroke_metrics'] = pd.DataFrame(data_rows, columns=columns[:len(data_rows[0])])
    
    # 5. Parse Periodic Data (High-frequency)
    periodic_start = find_section_start(lines, 'Periodic')
    if periodic_start >= 0:
        header1 = lines[periodic_start + 1].strip().split(',')
        header2 = lines[periodic_start + 2].strip().split(',')
        
        columns = []
        for h1, h2 in zip(header1, header2):
            if h2 and h2 not in ['Boat', '']:
                columns.append(f"{h1}_{h2}")
            else:
                columns.append(h1)
        
        data_rows = []
        i = periodic_start + 3
        while i < len(lines):
            row = lines[i].strip().split(',')
            if row[0] and row[0].replace('-', '').replace('.', '').isdigit():
                data_rows.append(row[:len(columns)])
            i += 1
        
        result['periodic'] = pd.DataFrame(data_rows, columns=columns)
        # Convert numeric columns
        for col in result['periodic'].columns:
            result['periodic'][col] = pd.to_numeric(result['periodic'][col], errors='coerce')
    
    return result


def extract_stroke_summary(data: Dict, seat: int = None) -> pd.DataFrame:
    """Extract key stroke metrics."""
    df = data['stroke_metrics'].copy()
    
    # Convert to numeric
    numeric_cols = df.columns[1:]  # Skip Time
    for col in numeric_cols:
        df[col] = pd.to_numeric(df[col], errors='coerce')
    
    if seat:
        # Filter to specific seat
        cols = ['Time'] + [c for c in df.columns if f'_{seat}' in c]
        cols += ['Rating', 'AvgBoatSpeed', 'StrokeNumber', 'Dist/Stroke', 'Average Power']
        return df[[c for c in cols if c in df.columns]]
    
    return df


def extract_force_curve(data: Dict, stroke_time: int, seat: int) -> pd.DataFrame:
    """Extract force curve for a specific stroke."""
    periodic = data['periodic']
    
    # Find stroke boundaries (using normalized time)
    mask = (periodic['Time'] >= stroke_time - 2000) & (periodic['Time'] <= stroke_time + 2000)
    stroke_data = periodic[mask].copy()
    
    return stroke_data[['Time', f'GateAngle_{seat}', f'GateForceX_{seat}', 
                        f'GateAngleVel_{seat}', 'Speed', 'Normalized Time']]


def calculate_stroke_length(data: Dict) -> pd.DataFrame:
    """Calculate stroke length (arc) for each rower."""
    df = data['stroke_metrics'].copy()
    
    for seat in range(1, 9):
        min_col = f'MinAngle_{seat}'
        max_col = f'MaxAngle_{seat}'
        if min_col in df.columns and max_col in df.columns:
            df[f'StrokeLength_{seat}'] = (
                pd.to_numeric(df[max_col], errors='coerce') - 
                pd.to_numeric(df[min_col], errors='coerce')
            )
    
    return df


# Usage example:
# data = parse_peach_csv('Piece_1-Table_1.csv')
# strokes = extract_stroke_summary(data)
# force = extract_force_curve(data, stroke_time=3910400, seat=1)
```

---

## Key Metrics Explained

### Force Metrics
- **GateForceX**: Horizontal force at the oarlock (kg). Peak values indicate maximum power application.
- **MaxForcePC**: Where in the drive the maximum force occurs (as % of drive).

### Angle Metrics  
- **MinAngle (Catch)**: Oar angle at the catch. More negative = longer reach.
- **MaxAngle (Finish)**: Oar angle at the finish. More positive = longer push.
- **Stroke Length**: MaxAngle - MinAngle = total arc (typically 80-95° for sweep).

### Timing Metrics
- **CatchSlip**: Degrees of slip before the blade engages water. Lower is better.
- **FinishSlip**: Degrees of slip at the release. Lower is better.
- **DriveStartT**: Offset from stroke start. Used to measure crew synchronization.

### Power Metrics
- **SwivelPower**: Power calculated at the oarlock (Watts).
- **WorkPCQ1-Q4**: Distribution of work across four quarters of the drive. Ideally ~25% each.

### Boat Metrics
- **Speed**: Instantaneous boat velocity (m/s).
- **Rating**: Strokes per minute.
- **Dist/Stroke**: Efficiency metric (meters per stroke).

---

## Common Analysis Tasks

### 1. Crew Synchronization
```python
def analyze_sync(data: Dict) -> pd.DataFrame:
    df = data['stroke_metrics']
    sync_cols = [f'DriveStartT_{i}' for i in range(1, 9)]
    sync_data = df[sync_cols].apply(pd.to_numeric, errors='coerce')
    return pd.DataFrame({
        'stroke': df['StrokeNumber'],
        'sync_std': sync_data.std(axis=1),
        'sync_range': sync_data.max(axis=1) - sync_data.min(axis=1)
    })
```

### 2. Force Curve Analysis
```python
def get_force_profile(data: Dict, seat: int) -> pd.DataFrame:
    periodic = data['periodic']
    return periodic[[
        'Time', 
        'Normalized Time',
        f'GateAngle_{seat}', 
        f'GateForceX_{seat}'
    ]].copy()
```

### 3. Split Comparison
```python
def compare_power_by_500m(data: Dict) -> pd.DataFrame:
    strokes = data['stroke_metrics'].copy()
    strokes['Distance'] = pd.to_numeric(strokes['Dist/Stroke'], errors='coerce').cumsum()
    strokes['Split_500m'] = (strokes['Distance'] // 500).astype(int)
    
    power_cols = [f'SwivelPower_{i}' for i in range(1, 9)]
    for col in power_cols:
        strokes[col] = pd.to_numeric(strokes[col], errors='coerce')
    
    return strokes.groupby('Split_500m')[power_cols + ['Rating', 'AvgBoatSpeed']].mean()
```

---

## File Naming Convention

Files appear to follow: `Piece_N-Table_1.csv` where N is the piece number within a session.

---

## Notes

1. **Timestamp units**: All timestamps are in milliseconds from session start.
2. **Seat numbering**: 1 = bow, 8 = stroke (standard convention).
3. **Angle sign convention**: Negative = toward catch, Positive = toward finish.
4. **Empty cells**: Common in header rows; filter when parsing.
5. **#ERROR! markers**: These are section delimiters, not actual errors.
6. **Trailing commas**: Rows have many trailing empty columns; truncate when parsing.

---

## Quick Reference: Column Indices

### Periodic Data
| Purpose | Columns |
|---------|---------|
| Oar angles | 1-8 |
| Gate forces | 9-16 |
| Angular velocities | 17-24 |
| Boat speed | 25 |
| Distance | 26 |
| Acceleration | 27 |

### Stroke Metrics (0x800A)
| Purpose | Columns |
|---------|---------|
| Power | 1-8 |
| Catch angle | 9-16 |
| Catch slip | 17-24 |
| Finish angle | 25-32 |
| Finish slip | 33-40 |
| Drive time | 57-64 |
| Recovery time | 65-72 |
| Rating | 129 |
| Boat speed | 130 |
| Stroke # | 131 |
| Dist/stroke | 132 |
