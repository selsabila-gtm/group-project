import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import Landing from "./pages/Landing";
import Login from "./pages/Login";
import Signup from "./pages/Signup";
import Dashboard from "./pages/Dashboard";
import Competitions from "./pages/Competitions";
import TeamsPage from "./pages/TeamsPage";
import TeamDetailPage from "./pages/TeamDetailPage";
import "./App.css";
import "./index.css";

export default function App() {
  return (
      <Routes>
        {/* Public routes */}
        <Route path="/" element={<Landing />} />
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<Signup />} />

        {/* Protected routes - you'll want to add authentication guard later */}
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/competitions" element={<Competitions />} />
        <Route path="/teams" element={<TeamsPage />} />
        <Route path="/teams/:teamId" element={<TeamDetailPage />} />
        <Route path="/datasets" element={<PlaceholderPage title="Datasets" />} />
        <Route path="/resources" element={<PlaceholderPage title="Resources" />} />
        <Route path="/settings" element={<PlaceholderPage title="Settings" />} />

        {/* Catch all - redirect to home or 404 */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
  );
}

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