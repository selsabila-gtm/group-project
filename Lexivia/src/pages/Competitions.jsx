import { useEffect, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import Sidebar from "../components/Sidebar";
import Topbar from "../components/Topbar";
import "./Competitions.css";

const PAGE_SIZE = 4;

// ── Role-based button config ───────────────────────────────────────────────────
//
//  user_role === "organizer"   → "View →"       → /competitions/:id/organizer
//  user_role === "participant" → "Contribute →"  → /competitions/:id/data-collection
//  user_role === "none"        → "Join →"        → /competitions/:id  (detail / join page)
//
function getCardAction(item, navigate) {
  switch (item.user_role) {
    case "organizer":
      return {
        label: "View →",
        className: "go-btn go-btn--organizer",
        onClick: () => navigate(`/competitions/${item.id}/organizer`),
      };
    case "participant":
      return {
        label: "Contribute →",
        className: "go-btn go-btn--participant",
        onClick: () => navigate(`/competitions/${item.id}/data-collection`),
      };
    default:
      return {
        label: "Join →",
        className: "go-btn go-btn--join",
        onClick: () => navigate(`/competitions/${item.id}`),
      };
  }
}

function Competitions() {
  const navigate = useNavigate();
  const location = useLocation();

  const urlParams = new URLSearchParams(location.search);
  const urlSearch = urlParams.get("search") || "";

  const [competitions, setCompetitions] = useState([]);
  const [search, setSearch] = useState(urlSearch);
  const [searchInput, setSearchInput] = useState(urlSearch);
  const [category, setCategory] = useState(
    localStorage.getItem("competitions_category") || "ALL TASKS"
  );
  const [tab, setTab] = useState(
    localStorage.getItem("competitions_tab") || "all"
  );
  const [offset, setOffset] = useState(0);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [viewMode, setViewMode] = useState(
    localStorage.getItem("competitions_viewMode") || "grid"
  );

  const categoryOptions = [
    "ALL TASKS",
    "TEXT PROCESSING",
    "AUDIO SYNTHESIS",
    "TRANSLATION",
    "COGNITIVE LOGIC",
  ];

  const token = localStorage.getItem("token");
  const authHeaders = { Authorization: `Bearer ${token}` };

  // ── Redirect to login if no token ──────────────────────────────────────────
  useEffect(() => {
    if (!token) navigate("/login");
  }, [token, navigate]);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const q = params.get("search") || "";
    setSearch(q);
    setSearchInput(q);
    setOffset(0);
  }, [location.search]);

  useEffect(() => {
    if (location.state?.refreshAll) {
      setCategory("ALL TASKS");
      setTab("all");
      setSearch("");
      setSearchInput("");
      setViewMode("grid");
      setOffset(0);
      localStorage.setItem("competitions_category", "ALL TASKS");
      localStorage.setItem("competitions_tab", "all");
      localStorage.setItem("competitions_viewMode", "grid");
      navigate(location.pathname, { replace: true, state: {} });
    }
  }, [location, navigate]);

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      const cleanSearch = searchInput.trim();
      setOffset(0);
      setSearch(cleanSearch);
      navigate(
        cleanSearch
          ? `/competitions?search=${encodeURIComponent(cleanSearch)}`
          : "/competitions",
        { replace: true }
      );
    }, 350);
    return () => clearTimeout(timer);
  }, [searchInput, navigate]);

  // ── Fetch competitions list ────────────────────────────────────────────────
  useEffect(() => {
    const params = new URLSearchParams({
      limit: String(PAGE_SIZE),
      offset: String(offset),
      tab,
    });
    if (search) params.append("search", search);
    if (category !== "ALL TASKS") params.append("category", category);

    setLoading(true);
    fetch(`http://127.0.0.1:8000/competitions?${params}`, { headers: authHeaders })
      .then((res) => {
        if (res.status === 401) { navigate("/login"); return null; }
        return res.json();
      })
      .then((data) => {
        if (!data) return;
        const safeData = Array.isArray(data) ? data : [];
        if (offset === 0) {
          setCompetitions(safeData);
        } else {
          setCompetitions((prev) => {
            const merged = [...prev, ...safeData];
            return merged.filter(
              (item, index, self) => index === self.findIndex((x) => x.id === item.id)
            );
          });
        }
      })
      .catch((err) => {
        console.error("Competitions fetch error:", err);
        if (offset === 0) setCompetitions([]);
      })
      .finally(() => setLoading(false));
  }, [search, category, tab, offset]);

  // ── Fetch count ────────────────────────────────────────────────────────────
  useEffect(() => {
    const params = new URLSearchParams({ tab });
    if (search) params.append("search", search);
    if (category !== "ALL TASKS") params.append("category", category);

    fetch(`http://127.0.0.1:8000/competitions/count?${params}`, { headers: authHeaders })
      .then((res) => {
        if (res.status === 401) { navigate("/login"); return null; }
        return res.json();
      })
      .then((data) => { if (data) setTotalCount(data.count || 0); })
      .catch(() => setTotalCount(0));
  }, [search, category, tab]);

  // ── Handlers ───────────────────────────────────────────────────────────────

  const handleCategoryChange = (sel) => {
    setOffset(0);
    setCategory(sel);
    localStorage.setItem("competitions_category", sel);
  };

  const handleTabChange = (sel) => {
    setOffset(0);
    setTab(sel);
    localStorage.setItem("competitions_tab", sel);
  };

  const handleViewModeChange = (mode) => {
    setViewMode(mode);
    localStorage.setItem("competitions_viewMode", mode);
  };

  const handleLoadMore = () => {
    if (!loading && competitions.length < totalCount) {
      setOffset((prev) => prev + PAGE_SIZE);
    }
  };

  const canLoadMore = competitions.length < totalCount;

  // ── Role badge for the card ────────────────────────────────────────────────
  function RoleChip({ role }) {
    if (!role || role === "none") return null;
    const styles = {
      organizer:   { background: "#fff0e6", color: "#b85200" },
      participant: { background: "#e8f5e9", color: "#2e7d32" },
    };
    const labels = { organizer: "ORGANIZING", participant: "PARTICIPATING" };
    const s = styles[role];
    return (
      <span style={{
        fontSize: 10, fontWeight: 700, padding: "2px 8px",
        borderRadius: 20, letterSpacing: "0.04em", ...s,
      }}>
        {labels[role]}
      </span>
    );
  }

  return (
    <div className="competitions-shell">
      <Sidebar />

      <div className="competitions-main">
        <Topbar
          title="Active Competitions"
          subtitle="Push the boundaries of Natural Language Processing. Deploy your models, compete for global rankings, and optimize precision metrics across diverse data domains."
          showBrowseButton={false}
        />

        <div className="competitions-body">
          <div className="view-switch-row">
            <div />
            <div className="grid-list-switch">
              <button
                type="button"
                className={viewMode === "grid" ? "active" : ""}
                onClick={() => handleViewModeChange("grid")}
              >
                Grid View
              </button>
              <button
                type="button"
                className={viewMode === "list" ? "active" : ""}
                onClick={() => handleViewModeChange("list")}
              >
                List View
              </button>
            </div>
          </div>

          <div className="competitions-toolbar">
            <div className="task-filters">
              <span className="filter-title">FILTER BY TASK</span>
              {categoryOptions.map((option) => (
                <button
                  key={option}
                  type="button"
                  className={category === option ? "active" : ""}
                  onClick={() => handleCategoryChange(option)}
                >
                  {option}
                </button>
              ))}
            </div>

            <div className="view-tabs">
              <button type="button" className={tab === "all" ? "active" : ""} onClick={() => handleTabChange("all")}>
                All
              </button>
              <button type="button" className={tab === "participating" ? "active" : ""} onClick={() => handleTabChange("participating")}>
                Participating
              </button>
              <button type="button" className={tab === "organizing" ? "active" : ""} onClick={() => handleTabChange("organizing")}>
                Organizing
              </button>
            </div>
          </div>

          <div style={{ marginBottom: "18px" }}>
            <input
              type="text"
              placeholder="Search competitions..."
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              style={{
                width: "320px", padding: "12px 14px", borderRadius: "10px",
                border: "1px solid #dde4f6", background: "#ffffff",
                fontSize: "14px", outline: "none",
              }}
            />
          </div>

          {loading && offset === 0 ? (
            <p>Loading competitions...</p>
          ) : (
            <div className={viewMode === "grid" ? "competition-grid" : "competition-list"}>
              {competitions.map((item) => {
                const action = getCardAction(item, navigate);
                return (
                  <div
                    key={item.id}
                    className={item.muted ? "competition-card muted" : "competition-card"}
                  >
                    <div className="competition-top">
                      <span className="competition-category">{item.category}</span>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <RoleChip role={item.user_role} />
                        <span className={item.status === "OPEN" ? "competition-status open" : "competition-status closed"}>
                          {item.status}
                        </span>
                      </div>
                    </div>

                    <h3>{item.title}</h3>
                    <p>{item.description}</p>

                    <div className="competition-stats">
                      <div>
                        <span>{item.stat1_label}</span>
                        <strong>{item.stat1_value}</strong>
                      </div>
                      <div>
                        <span>{item.stat2_label}</span>
                        <strong>{item.stat2_value}</strong>
                      </div>
                    </div>

                    <div className="competition-footer">
                      <span>{item.footer}</span>
                      <button
                        type="button"
                        className={action.className}
                        onClick={action.onClick}
                      >
                        {action.label}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          <div className="load-more-box">
            <p>VIEWING {competitions.length} OF {totalCount} ACTIVE EVENTS</p>
            <button
              type="button"
              onClick={handleLoadMore}
              disabled={!canLoadMore || loading}
            >
              {canLoadMore ? "Load More Entries" : "No More Entries"}
            </button>
          </div>
        </div>

        <button
          type="button"
          className="floating-plus"
          onClick={() => navigate("/create-competition")}
        >
          +
        </button>
      </div>
    </div>
  );
}

export default Competitions;