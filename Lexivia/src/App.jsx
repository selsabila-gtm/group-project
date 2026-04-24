import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";

import Dashboard from "./pages/Dashboard";
import Competitions from "./pages/Competitions";
import CreateCompetition from "./pages/CreateCompetition";
import CompetitionDetails from "./pages/CompetitionDetails";

import "./index.css";

function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Redirect root */}
        <Route path="/" element={<Navigate to="/dashboard" replace />} />

        {/* Main pages */}
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/competitions" element={<Competitions />} />
        <Route path="/create-competition" element={<CreateCompetition />} />

        {/* Competition details (VERY IMPORTANT) */}
        <Route
          path="/competitions/:competitionId"
          element={<CompetitionDetails />}
        />

        {/* Fallback */}
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;