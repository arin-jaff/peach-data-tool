import { Routes, Route, Link } from 'react-router-dom';
import HomePage from './pages/HomePage';
import UploadPage from './pages/UploadPage';
import DashboardPage from './pages/DashboardPage';
import AthletesPage from './pages/AthletesPage';
import AthleteDetailPage from './pages/AthleteDetailPage';

function App() {
  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white border-b border-gray-300 px-4 py-2 flex items-center justify-between text-sm">
        <Link to="/" className="font-semibold text-gray-800">
          Peach Telemetry
        </Link>
        <div className="flex items-center gap-3">
          <Link to="/" className="text-gray-600 hover:text-gray-900">
            Sessions
          </Link>
          <Link to="/athletes" className="text-gray-600 hover:text-gray-900">
            Athletes
          </Link>
          <Link
            to="/upload"
            className="bg-gray-200 text-gray-700 hover:bg-gray-300 px-3 py-1.5 rounded text-sm"
          >
            Upload CSV
          </Link>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-4 py-4">
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/upload" element={<UploadPage />} />
          <Route path="/dashboard/:sessionId" element={<DashboardPage />} />
          <Route path="/athletes" element={<AthletesPage />} />
          <Route path="/athletes/:athleteId" element={<AthleteDetailPage />} />
        </Routes>
      </main>
    </div>
  );
}

export default App;
