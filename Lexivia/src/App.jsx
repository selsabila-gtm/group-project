import { BrowserRouter, Routes, Route, Navigate, Outlet } from "react-router-dom";

import Dashboard from "./pages/Dashboard";
import Competitions from "./pages/Competitions";
import CreateCompetition from "./pages/CreateCompetition";
import CompetitionDetails from "./pages/CompetitionDetails";
import TeamsPage from "./pages/teams/TeamsPage";
import TeamDetailPage from "./pages/teams/TeamDetailPage";
import DataCollection from "./pages/DataCollection";
import DatasetHub from "./pages/Datasethub";
import Sidebar from "./components/Sidebar";
import Topbar from "./components/Topbar";
import SearchResults from "./pages/SearchResults";
import Landing from "./pages/Landing";
import Login from "./pages/Login";
import Signup from "./pages/Signup";
import NotificationsPage from "./pages/notifications/NotificationsPage";  // ← new

// ── Profile pages ──────────────────────────────────────────────────────────────
import ProfilePage from "./pages/profile/ProfilePage";
import UpdateProfilePage from "./pages/profile/updateprofile";
import SettingsPage from "./pages/profile/settings";
import "./index.css";
import OrganizerDashboard from "./pages/OrganizerDashboard";
import AuthCallback from "./pages/AuthCallback";

// ── Placeholder ───────────────────────────────────────────────────────────────
function SimplePage({ title, subtitle }) {
  return (
    <div style={{ display: "flex", minHeight: "100vh", background: "#f7f8fc" }}>
      <Sidebar />
      <div style={{ flex: 1 }}>
        <Topbar title={title} subtitle={subtitle} />
        <div style={{ padding: "24px 22px" }}>
          <div style={{
            background: "#eef3ff",
            borderRadius: "18px",
            padding: "24px",
            color: "#19233c",
            fontWeight: 700
          }}>
            {title} page is working.
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Auth guard ────────────────────────────────────────────────────────────────
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
        <Route path="/auth/callback" element={<AuthCallback />} />

        {/* Protected */}
        <Route element={<ProtectedRoute />}>

          <Route path="/dashboard" element={<Dashboard />} />

          {/* Competitions */}
          <Route path="/competitions" element={<Competitions />} />
          <Route path="/competitions/:competitionId" element={<CompetitionDetails />} />
          <Route path="/create-competition" element={<CreateCompetition />} />

          <Route path="/competitions/:competitionId/data-collection" element={<DataCollection />} />

          <Route
            path="/competitions/:competitionId/organizer"
            element={<OrganizerDashboard />}
          />
          <Route
            path="/edit-competition/:competitionId"
            element={<CreateCompetition editMode={true} />}
          />

          {/* Teams */}
          <Route path="/teams" element={<TeamsPage />} />
          <Route path="/teams/:teamId" element={<TeamDetailPage />} />

          {/* ── Notifications (dedicated page) ── */}
          <Route path="/notifications" element={<NotificationsPage />} />

          {/* Profile */}
          <Route path="/profile/settings" element={<SettingsPage />} />
          <Route path="/profile/update" element={<UpdateProfilePage />} />
          <Route path="/profile/:userId" element={<ProfilePage />} />
          <Route path="/profile" element={<ProfilePage />} />

          {/* Misc */}
          <Route path="/search" element={<SearchResults />} />

        </Route>

        {/* Fallback */}
        <Route path="*" element={<Navigate to="/" replace />} />
        <Route path="/competitions/:id/dataset-hub" element={<DatasetHub />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
