import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";

import Dashboard from "./pages/Dashboard";
import Competitions from "./pages/Competitions";
import CreateCompetition from "./pages/CreateCompetition";
import CompetitionDetails from "./pages/CompetitionDetails";

import Sidebar from "./components/Sidebar";
import Topbar from "./components/Topbar";
import SearchResults from "./pages/SearchResults";

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
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Navigate to="/dashboard" replace />} />

        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/competitions" element={<Competitions />} />
        <Route path="/create-competition" element={<CreateCompetition />} />
        <Route path="/competitions/:competitionId" element={<CompetitionDetails />} />
        <Route path="/search" element={<SearchResults />} />

        <Route
          path="/profile"
          element={
            <SimplePage
              title="Profile"
              subtitle="Manage your researcher profile."
            />
          }
        />

        <Route
          path="/settings"
          element={
            <SimplePage
              title="Settings"
              subtitle="Manage platform preferences."
            />
          }
        />

        <Route
          path="/notifications"
          element={
            <SimplePage
              title="Notifications"
              subtitle="View your latest platform updates."
            />
          }
        />

        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;