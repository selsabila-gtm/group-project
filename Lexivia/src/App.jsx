import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import Dashboard from "./pages/Dashboard";
import Competitions from "./pages/Competitions";
import CreateCompetition from "./pages/CreateCompetition";
import CompetitionDetails from "./pages/CompetitionDetails";
import "./index.css";

function App() {
  return (
    <BrowserRouter>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/competitions" element={<Competitions />} />
          <Route path="/competitions/:competitionId" element={<CompetitionDetails />} />
          <Route path="/create-competition" element={<CreateCompetition />} />
        </Routes>
      </BrowserRouter>
      );
}

      export default App;