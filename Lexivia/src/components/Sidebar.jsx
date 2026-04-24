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

        <div className="sidebar-link muted">
          <span className="sidebar-icon">◌</span>
          <span>Settings</span>
        </div>

        <div className="sidebar-user">
          <div className="sidebar-user-avatar">👤</div>
          <div>
            <strong>Researcher 0x4</strong>
            <p>Pro Tier</p>
          </div>
        </div>
      </div>
    </aside>
  );
}

export default Sidebar;