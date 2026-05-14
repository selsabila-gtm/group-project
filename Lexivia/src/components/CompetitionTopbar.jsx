import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import NotificationPopup from "./NotificationPopup";
import "./CompetitionTopbar.css";

function getUserInitial() {
  try {
    const user = JSON.parse(localStorage.getItem("user") || "{}");
    const name = user.username || user.name || user.email || "U";
    return String(name).trim().slice(0, 1).toUpperCase();
  } catch {
    return "U";
  }
}

function CompetitionTopbar({
  competitionId,
  competitionTitle = "Competition",
  status = "LAB ACTIVE",
  showDatasetHub = true,
}) {
  const navigate = useNavigate();
  const location = useLocation();

  const [search, setSearch] = useState("");

  const basePath = `/competitions/${competitionId}`;

  const activeTab = useMemo(() => {
    const params = new URLSearchParams(location.search);
    const tab = params.get("tab");

    if (location.pathname === basePath && tab === "resources") {
      return "resources";
    }

    if (location.pathname === basePath) {
      return "overview";
    }

    return "";
  }, [location.pathname, location.search, basePath]);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    setSearch(params.get("q") || "");
  }, [location.search]);

  function handleSearchSubmit(e) {
    e.preventDefault();

    const q = search.trim();
    if (!q) return;

    navigate(`/search?q=${encodeURIComponent(q)}`);
  }

  return (
    <header className="competition-topbar">
      <div className="competition-topbar-left">
        <button
          type="button"
          className="competition-title-btn"
          onClick={() => navigate(basePath)}
          title="Go to competition overview"
        >
          {competitionTitle}
        </button>

        {status && <span className="competition-status-pill">{status}</span>}

        <nav className="competition-tabs">
          <button
            type="button"
            className={`competition-tab ${activeTab === "overview" ? "active" : ""
              }`}
            onClick={() => navigate(basePath)}
          >
            Overview
          </button>

          <button
            type="button"
            className={`competition-tab ${activeTab === "resources" ? "active" : ""
              }`}
            onClick={() => navigate(`${basePath}?tab=resources`)}
          >
            Resources
          </button>
        </nav>
      </div>

      <div className="competition-topbar-right">
        <form className="competition-search" onSubmit={handleSearchSubmit}>
          <button
            type="submit"
            className="competition-search-icon"
            title="Search"
          >
            <svg
              width="17"
              height="17"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <circle cx="11" cy="11" r="8" />
              <path d="M21 21l-4.35-4.35" />
            </svg>
          </button>

          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search competitions, datasets, teams..."
          />
        </form>

        {showDatasetHub && (
          <button
            type="button"
            className="dataset-hub-btn"
            onClick={() => navigate(`${basePath}/dataset-hub`)}
          >
            <svg
              width="15"
              height="15"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <ellipse cx="12" cy="5" rx="9" ry="3" />
              <path d="M3 5v14c0 1.66 4.03 3 9 3s9-1.34 9-3V5" />
              <path d="M3 12c0 1.66 4.03 3 9 3s9-1.34 9-3" />
            </svg>
            Dataset Hub
          </button>
        )}

        <NotificationPopup />

        <button
          type="button"
          className="competition-profile-btn"
          onClick={() => navigate("/profile")}
          title="Profile"
        >
          {getUserInitial()}
        </button>
      </div>
    </header>
  );
}

export default CompetitionTopbar;