import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";

import Dashboard from "./pages/Dashboard";
import Competitions from "./pages/Competitions";
import TeamsPage from "./pages/TeamsPage";
import TeamDetailPage from "./pages/TeamDetailPage";

import "./App.css";

function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Default redirect */}
        <Route path="/" element={<Navigate to="/dashboard" replace />} />

        {/* Main pages */}
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/competitions" element={<Competitions />} />

        {/* Teams */}
        <Route path="/teams" element={<TeamsPage />} />
        <Route path="/teams/:teamId" element={<TeamDetailPage />} />

        {/* Other pages */}
        <Route path="/datasets" element={<PlaceholderPage title="Datasets" />} />
        <Route path="/resources" element={<PlaceholderPage title="Resources" />} />
        <Route path="/settings" element={<PlaceholderPage title="Settings" />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;

function PlaceholderPage({ title }) {
  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: '#f4f5f7' }}>
      <div style={{ width: 220, background: '#1a1c20' }} />
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ textAlign: 'center' }}>
          <h2>{title}</h2>
          <p>This page is not yet implemented.</p>
        </div>
      </div>
    </div>
  );
}