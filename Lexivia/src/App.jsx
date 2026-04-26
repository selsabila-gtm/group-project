import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";

import Dashboard from "./pages/Dashboard";
import Competitions from "./pages/Competitions";
import CreateCompetition from "./pages/CreateCompetition";
import CompetitionDetails from "./pages/CompetitionDetails";

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

function App() {

  const isAuthenticated = () => {
    return !!localStorage.getItem("token");
  };

  return (
    <BrowserRouter>
      <Routes>
        {/* Landing */}
        <Route path="/" element={<Landing />} />

        {/* Auth */}
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<Signup />} />

        {/* Protected */}
        <Route
          path="/dashboard"
          element={
            isAuthenticated() ? <Dashboard /> : <Navigate to="/login" replace />
          }
        />

        <Route
          path="/competitions"
          element={
            isAuthenticated() ? <Competitions /> : <Navigate to="/login" replace />
          }
        />

        <Route
          path="/create-competition"
          element={
            isAuthenticated() ? <CreateCompetition /> : <Navigate to="/login" replace />
          }
        />

        <Route
          path="/competitions/:competitionId"
          element={
            isAuthenticated() ? <CompetitionDetails /> : <Navigate to="/login" replace />
          }
        />

        <Route
          path="/search"
          element={
            isAuthenticated() ? <SearchResults /> : <Navigate to="/login" replace />
          }
        />

        <Route
          path="/profile"
          element={
            isAuthenticated() ? (
              <SimplePage
                title="Profile"
                subtitle="Manage your researcher profile."
              />
            ) : (
              <Navigate to="/login" replace />
            )
          }
        />

        <Route
          path="/settings"
          element={
            isAuthenticated() ? (
              <SimplePage
                title="Settings"
                subtitle="Manage platform preferences."
              />
            ) : (
              <Navigate to="/login" replace />
            )
          }
        />

        <Route
          path="/notifications"
          element={
            isAuthenticated() ? (
              <SimplePage
                title="Notifications"
                subtitle="View your latest platform updates."
              />
            ) : (
              <Navigate to="/login" replace />
            )
          }
        />

        {/* Fallback */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
export default App;