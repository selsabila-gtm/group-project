import { BrowserRouter, Routes, Route, Navigate, Outlet } from "react-router-dom";

import Dashboard from "./pages/Dashboard";
import Competitions from "./pages/Competitions";
import CreateCompetition from "./pages/CreateCompetition";
import CompetitionDetails from "./pages/CompetitionDetails";
import TeamsPage from "./pages/teams/TeamsPage";
import TeamDetailPage from "./pages/teams/TeamDetailPage";

import Sidebar from "./components/Sidebar";
import Topbar from "./components/Topbar";
import SearchResults from "./pages/SearchResults";
import Landing from "./pages/Landing";
import Login from "./pages/Login";
import Signup from "./pages/Signup";
import "./index.css";

function SimplePage({ title, subtitle }) {
  return (
    <div style={{ display: "flex", minHeight: "100vh", background: "#f7f8fc" }}>
      <Sidebar />
      <div style={{ flex: 1 }}>
        <Topbar title={title} subtitle={subtitle} />
        <div style={{ padding: "24px 22px" }}>
          <div
            style={{
              background: "#eef3ff",
              borderRadius: "18px",
              padding: "24px",
              color: "#19233c",
              fontWeight: 700,
            }}
          >
            {title} page is working.
          </div>
        </div>
      </div>
    </div>
  );
}

// Inline ProtectedRoute — redirects to /login if no token
function ProtectedRoute() {
  return localStorage.getItem("token")
    ? <Outlet />
    : <Navigate to="/login" replace />;
}

function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Public */}
        <Route path="/" element={<Landing />} />
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<Signup />} />

        {/* All protected routes nested under one guard */}
        <Route element={<ProtectedRoute />}>
          <Route path="/dashboard" element={<Dashboard />} />

          <Route path="/competitions" element={<Competitions />} />
          <Route path="/competitions/:competitionId" element={<CompetitionDetails />} />
          <Route path="/create-competition" element={<CreateCompetition />} />

          {/* ✅ Teams routes — these were missing, causing the redirect to "/" */}
          <Route path="/teams" element={<TeamsPage />} />
          <Route path="/teams/:teamId" element={<TeamDetailPage />} />

          <Route path="/search" element={<SearchResults />} />

          <Route
            path="/profile"
            element={<SimplePage title="Profile" subtitle="Manage your researcher profile." />}
          />
          <Route
            path="/profile/settings"
            element={<SimplePage title="Settings" subtitle="Manage platform preferences." />}
          />
          <Route
            path="/settings"
            element={<SimplePage title="Settings" subtitle="Manage platform preferences." />}
          />
          <Route
            path="/notifications"
            element={<SimplePage title="Notifications" subtitle="View your latest platform updates." />}
          />
        </Route>

        {/* Fallback */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;