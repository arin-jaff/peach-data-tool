# Peach Rowing Telemetry Analysis Tool

A web application for analyzing rowing telemetry data from Peach PowerLine systems.

## Features

- **CSV Upload**: Drag-and-drop upload for Peach CSV files
- **Athlete Visualization**: View individual and overlayed performance data for all 8 rowers
- **Interactive Charts**:
  - Power over strokes
  - Catch/finish angles
  - Boat speed and rating
  - Force curves per stroke
- **Timeline Slider**: Scroll through strokes to see force curve changes
- **Athlete Toggles**: Show/hide individual athletes on charts
- **Metrics Summary**: Per-athlete and crew averages

## Tech Stack

- **Backend**: Python FastAPI + SQLite
- **Frontend**: React + TypeScript + Recharts + Tailwind CSS

## Setup

### Backend

```bash
cd backend

# Create virtual environment
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Run the server
uvicorn main:app --reload --port 8000
```

### Frontend

```bash
cd frontend

# Install dependencies
npm install

# Run development server
npm run dev
```

The frontend will be available at http://localhost:5173

## Usage

1. Start the backend server (port 8000)
2. Start the frontend dev server (port 5173)
3. Open http://localhost:5173 in your browser
4. Click "Upload CSV" and upload a Peach CSV file from the `data/` folder
5. View the dashboard with athlete data and charts

## Sample Data

The `data/` folder contains sample Peach CSV files you can use to test:

- `FY26 Virginia2016NationalChampsTelem.csv/` - 4 pieces
- `FY26VirginiaZimmerTelem.csv/` - 3 pieces

## Data Guide

See `data/peach_rowing_telemetry_guide.md` for detailed documentation on the Peach CSV format and available metrics.

## API Endpoints

- `POST /api/upload` - Upload CSV file
- `GET /api/sessions` - List all sessions
- `GET /api/sessions/{id}` - Get session details
- `GET /api/pieces/{id}/strokes` - Get stroke metrics
- `GET /api/pieces/{id}/strokes/averages` - Get per-athlete averages
- `GET /api/pieces/{id}/periodic` - Get high-frequency data
- `GET /api/pieces/{id}/stroke/{n}/force-curve` - Get force curve for stroke

## Project Structure

```
peach-data-tool/
├── backend/
│   ├── main.py          # FastAPI app
│   ├── database.py      # SQLite setup
│   ├── models.py        # Pydantic schemas
│   ├── csv_parser.py    # Peach CSV parser
│   └── requirements.txt
├── frontend/
│   ├── src/
│   │   ├── App.tsx
│   │   ├── api.ts       # API client
│   │   ├── store.ts     # Zustand state
│   │   ├── types.ts     # TypeScript types
│   │   └── pages/
│   │       ├── HomePage.tsx
│   │       ├── UploadPage.tsx
│   │       └── DashboardPage.tsx
│   └── package.json
├── data/                # Sample data
└── README.md
```
