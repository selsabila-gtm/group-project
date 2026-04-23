import { useEffect, useState } from "react";
import Sidebar from "../components/Sidebar";
import Topbar from "../components/Topbar";
import "./Competitions.css";

const PAGE_SIZE = 4;

function Competitions() {
    const [competitions, setCompetitions] = useState([]);
    const [search, setSearch] = useState("");
    const [searchInput, setSearchInput] = useState("");
    const [category, setCategory] = useState("ALL TASKS");
    const [tab, setTab] = useState("all");
    const [offset, setOffset] = useState(0);
    const [totalCount, setTotalCount] = useState(0);
    const [loading, setLoading] = useState(false);

    const categoryOptions = [
        "ALL TASKS",
        "TEXT PROCESSING",
        "AUDIO SYNTHESIS",
        "TRANSLATION",
        "COGNITIVE LOGIC",
    ];

    useEffect(() => {
        const timer = setTimeout(() => {
            setSearch(searchInput);
            setOffset(0);
        }, 350);

        return () => clearTimeout(timer);
    }, [searchInput]);

    useEffect(() => {
        const params = new URLSearchParams({
            limit: String(PAGE_SIZE),
            offset: String(offset),
            tab,
        });

        if (search.trim()) params.append("search", search.trim());
        if (category !== "ALL TASKS") params.append("category", category);

        setLoading(true);

        fetch(`http://127.0.0.1:8000/competitions?${params.toString()}`)
            .then((res) => res.json())
            .then((data) => {
                if (offset === 0) {
                    setCompetitions(data);
                } else {
                    setCompetitions((prev) => [...prev, ...data]);
                }
            })
            .catch((err) => console.error("Competitions fetch error:", err))
            .finally(() => setLoading(false));
    }, [search, category, tab, offset]);

    useEffect(() => {
        const params = new URLSearchParams({
            tab,
        });

        if (search.trim()) params.append("search", search.trim());
        if (category !== "ALL TASKS") params.append("category", category);

        fetch(`http://127.0.0.1:8000/competitions/count?${params.toString()}`)
            .then((res) => res.json())
            .then((data) => setTotalCount(data.count || 0))
            .catch((err) => console.error("Competitions count fetch error:", err));
    }, [search, category, tab]);

    const handleCategoryChange = (selectedCategory) => {
        setCategory(selectedCategory);
        setOffset(0);
    };

    const handleTabChange = (selectedTab) => {
        setTab(selectedTab);
        setOffset(0);
    };

    const handleLoadMore = () => {
        setOffset((prev) => prev + PAGE_SIZE);
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
                            <button type="button" className="active">
                                Grid View
                            </button>
                            <button type="button" disabled>
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
                        <div className="competition-grid">
                            {competitions.map((item) => (
                                <div
                                    key={item.id}
                                    className={item.muted ? "competition-card muted" : "competition-card"}
                                >
                                    <div className="competition-top">
                                        <span className="competition-category">{item.category}</span>
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
                                            onClick={() => alert(`Competition: ${item.title}`)}
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
                    onClick={() => alert("Create competition action")}
                >
                    +
                </button>
            </div>
        </div>
    );
}

export default Competitions;