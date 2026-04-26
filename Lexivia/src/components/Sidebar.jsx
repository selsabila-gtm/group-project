import { NavLink, useLocation } from "react-router-dom";
import "./Sidebar.css";

function Sidebar() {
  const location = useLocation();

  const competitionsActive =
    location.pathname === "/competitions" ||
    location.pathname === "/create-competition";

  return (
    <aside className="sidebar">
      <div>
        <div className="sidebar-brand">
          <div className="brand-square">⬢</div>
          <div className="brand-text">
            <h2>Lexivia AI</h2>
          </div>
        </div>

        <nav className="sidebar-nav">
          <NavLink
            to="/dashboard"
            className={({ isActive }) =>
              isActive ? "sidebar-link active" : "sidebar-link"
            }
          >
            <span className="sidebar-icon">⌘</span>
            <span>Dashboard</span>
          </NavLink>

          <NavLink
            to="/competitions"
            className={competitionsActive ? "sidebar-link active" : "sidebar-link"}
          >
            <span className="sidebar-icon">☆</span>
            <span>Competitions</span>
          </NavLink>

          <div className="sidebar-link muted">
            <span className="sidebar-icon">⌘</span>
            <span>Teams</span>
          </div>

          <div className="sidebar-link muted">
            <span className="sidebar-icon">▤</span>
            <span>Datasets</span>
          </div>
        </nav>
      </div>

      <div className="sidebar-bottom">
        <div className="sidebar-link muted">
          <span className="sidebar-icon">◌</span>
          <span>Resources</span>
        </div>

        <NavLink
          to="/profile/settings"
          className={({ isActive }) =>
            isActive ? "sidebar-link active" : "sidebar-link"
          }
        >
          <span className="sidebar-icon">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="3"/>
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
            </svg>
          </span>
          <span>Settings</span>
        </NavLink>

        <NavLink to="/profile" className="sidebar-user">
  <div className="sidebar-user-avatar">👤</div>
  <div>
    <strong>Researcher 0x4</strong>
    <p>Pro Tier</p>
  </div>
</NavLink>
      </div>
    </aside>
  );
}

export default Sidebar;
