import { useEffect, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import Sidebar from "../components/Sidebar";
import Topbar from "../components/Topbar";
import "./Competitions.css";

const PAGE_SIZE = 4;

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
            localStorage.setItem("competitions_search", "");

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
        const params = new URLSearchParams({
            limit: String(PAGE_SIZE),
            offset: String(offset),
            tab,
        });

        if (search) params.append("search", search);
        if (category !== "ALL TASKS") params.append("category", category);

        setLoading(true);

        const token = localStorage.getItem("token");

        fetch(`http://127.0.0.1:8000/competitions?${params.toString()}`, {
            headers: {
                Authorization: `Bearer ${token}`,
            },
        })
            .then((res) => res.json())
            .then((data) => {
                const safeData = Array.isArray(data) ? data : [];

                if (offset === 0) {
                    setCompetitions(safeData);
                } else {
                    setCompetitions((prev) => {
                        const merged = [...prev, ...safeData];
                        return merged.filter(
                            (item, index, self) =>
                                index === self.findIndex((x) => x.id === item.id)
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

    useEffect(() => {
        const params = new URLSearchParams({ tab });

        if (search) params.append("search", search);
        if (category !== "ALL TASKS") params.append("category", category);

        const token = localStorage.getItem("token");

        fetch(`http://127.0.0.1:8000/competitions/count?${params.toString()}`, {
            headers: {
                Authorization: `Bearer ${token}`,
            },
        })
            .then((res) => res.json())
            .then((data) => setTotalCount(data.count || 0))
            .catch((err) => {
                console.error("Competitions count fetch error:", err);
                setTotalCount(0);
            });
    }, [search, category, tab]);

    const handleCategoryChange = (selectedCategory) => {
        setOffset(0);
        setCategory(selectedCategory);
        localStorage.setItem("competitions_category", selectedCategory);
    };

    const handleTabChange = (selectedTab) => {
        setOffset(0);
        setTab(selectedTab);
        localStorage.setItem("competitions_tab", selectedTab);
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
                        <div></div>

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
                        <div
                            className={
                                viewMode === "grid"
                                    ? "competition-grid"
                                    : "competition-list"
                            }
                        >
                            {competitions.map((item) => (
                                <div
                                    key={item.id}
                                    className={
                                        item.muted
                                            ? "competition-card muted"
                                            : "competition-card"
                                    }
                                >
                                    <div className="competition-top">
                                        <span className="competition-category">
                                            {item.category}
                                        </span>

                                        <span
                                            className={
                                                item.status === "OPEN"
                                                    ? "competition-status open"
                                                    : "competition-status closed"
                                            }
                                        >
                                            {item.status}
                                        </span>
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
                                            className="go-btn"
                                            onClick={() => navigate(`/competitions/${item.id}`)}
                                        >
                                            →
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}

                    <div className="load-more-box">
                        <p>
                            VIEWING {competitions.length} OF {totalCount} ACTIVE EVENTS
                        </p>

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