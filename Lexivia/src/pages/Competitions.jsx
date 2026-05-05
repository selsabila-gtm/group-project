import { useEffect, useMemo, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import Sidebar from "../components/Sidebar";
import Topbar from "../components/Topbar";
import "./Competitions.css";

const PAGE_SIZE = 10;

function normalizeStatus(status) {
  return String(status || "").trim().toUpperCase();
}

function normalizeRole(role) {
  const clean = String(role || "none").trim().toLowerCase();
  if (clean === "organizer") return "organizer";
  if (clean === "participant") return "participant";
  return "none";
}

// user_role === "organizer"   -> /competitions/:id/organizer
// user_role === "participant" -> /competitions/:id/data-collection
// user_role === "none"        -> /competitions/:id
function getCardAction(item, navigate) {
  const status = normalizeStatus(item.status);
  const role = normalizeRole(item.user_role);

  if (status === "CLOSED" || status === "ENDED") {
    return {
      label: "See Details →",
      className: "go-btn go-btn--closed-view",
      onClick: () => navigate(`/competitions/${item.id}`),
    };
  }

  if (role === "organizer") {
    return {
      label: "View →",
      className: "go-btn go-btn--organizer",
      onClick: () => navigate(`/competitions/${item.id}/organizer`),
    };
  }

  if (role === "participant") {
    return {
      label: "Contribute →",
      className: "go-btn go-btn--participant",
      onClick: () => navigate(`/competitions/${item.id}/data-collection`),
    };
  }

  return {
    label: "Join →",
    className: "go-btn go-btn--join",
    onClick: () => navigate(`/competitions/${item.id}`),
  };
}

function RoleChip({ role }) {
  const normalizedRole = normalizeRole(role);

  if (normalizedRole === "none") return null;

  const styles = {
    organizer: { background: "#fff0e6", color: "#b85200" },
    participant: { background: "#e8f5e9", color: "#2e7d32" },
  };

  const labels = {
    organizer: "ORGANIZING",
    participant: "PARTICIPATING",
  };

  return (
    <span
      style={{
        fontSize: 10,
        fontWeight: 700,
        padding: "2px 8px",
        borderRadius: 20,
        letterSpacing: "0.04em",
        ...styles[normalizedRole],
      }}
    >
      {labels[normalizedRole]}
    </span>
  );
}

function StatusChip({ status }) {
  const normalizedStatus = normalizeStatus(status);
  const isOpen = normalizedStatus === "OPEN";

  return (
    <span className={isOpen ? "competition-status open" : "competition-status closed"}>
      {normalizedStatus || "UNKNOWN"}
    </span>
  );
}

function Competitions() {
  const navigate = useNavigate();
  const location = useLocation();

  const urlParams = new URLSearchParams(location.search);
  const urlSearch = urlParams.get("search") || "";

  const [sortOrder, setSortOrder] = useState(
    localStorage.getItem("competitions_sortOrder") || "newest"
  );

  const [competitions, setCompetitions] = useState([]);
  const [search, setSearch] = useState(urlSearch);
  const [searchInput, setSearchInput] = useState(urlSearch);

  const [category, setCategory] = useState(
    localStorage.getItem("competitions_category") || "ALL TASKS"
  );

  // Important fix:
  // Do NOT restore the tab from localStorage.
  // It can leave the page stuck on "participating" or "organizing" after old messy data.
  const [tab, setTab] = useState("all");

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
    "QUESTION ANSWERING",
    "SUMMARIZATION",
  ];

  const token = localStorage.getItem("token");

  const authHeaders = useMemo(() => {
    return token ? { Authorization: `Bearer ${token}` } : {};
  }, [token]);

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
      localStorage.setItem("competitions_sortOrder", "newest");
      localStorage.setItem("competitions_viewMode", "grid");
      localStorage.removeItem("competitions_tab");

      setSortOrder("newest");

      navigate(location.pathname, { replace: true, state: {} });
    }
  }, [location, navigate]);

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

  useEffect(() => {
    if (!token) return;

    const controller = new AbortController();

    const params = new URLSearchParams({
      limit: String(PAGE_SIZE),
      offset: String(offset),
      tab,
      sort: sortOrder,
    });

    if (search) params.append("search", search);
    if (category !== "ALL TASKS") params.append("category", category);

    setLoading(true);

    fetch(`http://127.0.0.1:8000/competitions?${params.toString()}`, {
      headers: authHeaders,
      signal: controller.signal,
    })
      .then((res) => {
        if (res.status === 401) {
          navigate("/login");
          return null;
        }
        if (!res.ok) throw new Error("Failed to fetch competitions");
        return res.json();
      })
      .then((data) => {
        if (!data) return;

        const safeData = Array.isArray(data) ? data : [];

        if (offset === 0) {
          setCompetitions(safeData);
          return;
        }

        setCompetitions((prev) => {
          const merged = [...prev, ...safeData];
          return merged.filter(
            (item, index, self) =>
              index === self.findIndex((x) => x.id === item.id)
          );
        });
      })
      .catch((err) => {
        if (err.name === "AbortError") return;
        console.error("Competitions fetch error:", err);
        if (offset === 0) setCompetitions([]);
      })
      .finally(() => setLoading(false));

    return () => controller.abort();
  }, [token, authHeaders, search, category, tab, offset, sortOrder, navigate]);

  useEffect(() => {
    if (!token) return;

    const controller = new AbortController();

    const params = new URLSearchParams({ tab });
    if (search) params.append("search", search);
    if (category !== "ALL TASKS") params.append("category", category);

    fetch(`http://127.0.0.1:8000/competitions/count?${params.toString()}`, {
      headers: authHeaders,
      signal: controller.signal,
    })
      .then((res) => {
        if (res.status === 401) {
          navigate("/login");
          return null;
        }
        if (!res.ok) throw new Error("Failed to fetch competition count");
        return res.json();
      })
      .then((data) => {
        if (data) setTotalCount(Number(data.count || 0));
      })
      .catch((err) => {
        if (err.name === "AbortError") return;
        console.error("Competition count fetch error:", err);
        setTotalCount(0);
      });

    return () => controller.abort();
  }, [token, authHeaders, search, category, tab, navigate]);

  const handleCategoryChange = (sel) => {
    setOffset(0);
    setCategory(sel);
    localStorage.setItem("competitions_category", sel);
  };

  const handleSortChange = (value) => {
    setOffset(0);
    setSortOrder(value);
    localStorage.setItem("competitions_sortOrder", value);
  };

  const handleTabChange = (sel) => {
    setOffset(0);
    setTab(sel);
    localStorage.removeItem("competitions_tab");
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
            <div className="sort-control">
              <span>Sort by</span>
              <select
                value={sortOrder}
                onChange={(e) => handleSortChange(e.target.value)}
              >
                <option value="newest">Newest first</option>
                <option value="oldest">Oldest first</option>
                <option value="unknown_dates">Unknown dates only</option>
              </select>
            </div>

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
              <button
                type="button"
                className={tab === "all" ? "active" : ""}
                onClick={() => handleTabChange("all")}
              >
                All
              </button>
              <button
                type="button"
                className={tab === "participating" ? "active" : ""}
                onClick={() => handleTabChange("participating")}
              >
                Participating
              </button>
              <button
                type="button"
                className={tab === "organizing" ? "active" : ""}
                onClick={() => handleTabChange("organizing")}
              >
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
                width: "320px",
                padding: "12px 14px",
                borderRadius: "10px",
                border: "1px solid #dde4f6",
                background: "#ffffff",
                fontSize: "14px",
                outline: "none",
              }}
            />
          </div>

          {loading && offset === 0 ? (
            <p>Loading competitions...</p>
          ) : (
            <div className={viewMode === "grid" ? "competition-grid" : "competition-list"}>
              {competitions.length === 0 ? (
                <p>No competitions found.</p>
              ) : (
                competitions.map((item) => {
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
                          <StatusChip status={item.status} />
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
                })
              )}
            </div>
          )}

          <div className="load-more-box">
            VIEWING {competitions.length} OF {totalCount} COMPETITIONS
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
