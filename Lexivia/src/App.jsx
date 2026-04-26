import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";

import Landing from "./pages/Landing";
import Login from "./pages/Login";
import Signup from "./pages/Signup";
import Dashboard from "./pages/Dashboard";
import Competitions from "./pages/Competitions";
import TeamsPage from "./pages/Teams/TeamsPage";
import TeamDetailPage from "./pages/Teams/TeamDetailPage";

// Profile pages
import ProfilePage from "./pages/profile/ProfilePage";
import UpdateProfilePage from "./pages/profile/updateprofile";

import "./App.css";
import "./index.css";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>

        {/* ✅ Redirect ROOT → /profile */}
        <Route path="/" element={<Navigate to="/profile" replace />} />

        {/* Public routes (still accessible if needed) */}
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<Signup />} />

        {/* Main app routes */}
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/competitions" element={<Competitions />} />
        <Route path="/teams" element={<TeamsPage />} />
        <Route path="/teams/:teamId" element={<TeamDetailPage />} />

        {/* ✅ Profile routes — specific routes MUST come before /:userId */}
        <Route path="/profile" element={<ProfilePage />} />
        <Route path="/profile/update" element={<UpdateProfilePage />} />
        <Route path="/profile/:userId" element={<ProfilePage />} />

        {/* Optional placeholders */}
        <Route path="/datasets" element={<PlaceholderPage title="Datasets" />} />
        <Route path="/resources" element={<PlaceholderPage title="Resources" />} />
        <Route path="/settings" element={<PlaceholderPage title="Settings" />} />

        {/* Catch-all → redirect to profile */}
        <Route path="*" element={<Navigate to="/profile" replace />} />

      </Routes>
    </BrowserRouter>
  );
}

// Placeholder Component
function PlaceholderPage({ title }) {
  return (
    <div style={{ display: "flex", minHeight: "100vh", background: "#f4f5f7" }}>
      <div style={{ width: 220, background: "#1a1c20" }} />
      <div
        style={{
          flex: 1,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <div style={{ textAlign: "center" }}>
          <h2>{title}</h2>
          <p>This page is not yet implemented.</p>
        </div>
      </div>
    </div>
  );
}
