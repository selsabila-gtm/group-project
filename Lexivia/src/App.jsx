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

import ProfilePage from "./pages/profile/ProfilePage";
import UpdateProfilePage from "./pages/profile/updateprofile";
import SettingsPage from "./pages/profile/settings";
import OrganizerDashboard from "./pages/OrganizerDashboard";
import AuthCallback from "./pages/AuthCallback";
import Experiments from "./pages/Experiments";

import ExperimentRegistry from "./pages/ExperimentRegistry";
import Leaderboard from "./pages/leaderboard";

import "./index.css";

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

function isLoggedIn() {
  return !!localStorage.getItem("token");
}

function ProtectedRoute() {
  return isLoggedIn() ? <Outlet /> : <Navigate to="/login" replace />;
}

function PublicOnlyRoute() {
  return isLoggedIn() ? <Navigate to="/dashboard" replace /> : <Outlet />;
}

function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Public landing */}
        <Route path="/" element={<Landing />} />

        {/* Auth pages: blocked when already logged in */}
        <Route element={<PublicOnlyRoute />}>
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<Signup />} />
        </Route>

        <Route path="/auth/callback" element={<AuthCallback />} />

        {/* Protected pages */}
        <Route element={<ProtectedRoute />}>
          <Route path="/dashboard" element={<Dashboard />} />

          <Route path="/competitions" element={<Competitions />} />
          <Route path="/competitions/:competitionId" element={<CompetitionDetails />} />
          <Route path="/create-competition" element={<CreateCompetition />} />
          <Route path="/competitions/:competitionId/data-collection" element={<DataCollection />} />
          <Route path="/competitions/:competitionId/experiments" element={<Experiments />} />

<Route
  path="/competitions/:competitionId/leaderboard"
  element={<Leaderboard />}
/>

<Route path="/competitions/:id/dataset-hub" element={<DatasetHub />} />
<Route path="/competitions/:competitionId/experiment-registry" element={<ExperimentRegistry />} />

          <Route
            path="/competitions/:competitionId/organizer"
            element={<OrganizerDashboard />}
          />

          <Route
            path="/edit-competition/:competitionId"
            element={<CreateCompetition editMode={true} />}
          />

          <Route path="/teams" element={<TeamsPage />} />
          <Route path="/teams/:teamId" element={<TeamDetailPage />} />

          {/* ── Notifications (dedicated page) ── */}
          <Route path="/notifications" element={<NotificationsPage />} />

          {/* Profile */}
          <Route path="/profile/settings" element={<SettingsPage />} />
          <Route path="/profile/update" element={<UpdateProfilePage />} />
          <Route path="/profile/:userId" element={<ProfilePage />} />
          <Route path="/profile" element={<ProfilePage />} />

          <Route path="/search" element={<SearchResults />} />

        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
