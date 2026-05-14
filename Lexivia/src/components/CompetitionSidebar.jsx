import { useEffect, useMemo, useState } from "react";
import { useNavigate, useLocation, useParams } from "react-router-dom";
import "./CompetitionSidebar.css";

const API = "http://127.0.0.1:8000";

function getToken() {
    return (
        localStorage.getItem("token") ||
        localStorage.getItem("access_token") ||
        localStorage.getItem("jwt")
    );
}

const NAV_ITEMS = [
    {
        key: "data-collection",
        label: "Data Collection",
        path: "data-collection",
        icon: (
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <ellipse cx="12" cy="5" rx="9" ry="3" />
                <path d="M3 5v14a9 3 0 0 0 18 0V5" />
                <path d="M3 12a9 3 0 0 0 18 0" />
            </svg>
        ),
    },
    {
        key: "dataset-hub",
        label: "Validation",
        path: "dataset-hub",
        icon: (
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 20h9" />
                <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
            </svg>
        ),
    },
    {
        key: "experiments",
        label: "Workspace",
        path: "experiments",
        icon: (
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 3H5a2 2 0 0 0-2 2v4m6-6h10a2 2 0 0 1 2 2v4M9 3v11l3 3 3-3V3" />
                <path d="M3 9h18" />
            </svg>
        ),
    },
    {
        key: "experiment-registry",
        label: "Experiments",
        path: "experiment-registry",
        icon: (
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
                <path d="M4 4.5A2.5 2.5 0 0 1 6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5z" />
            </svg>
        ),
    },
    {
        key: "leaderboard",
        label: "Leaderboard",
        path: "leaderboard",
        icon: (
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="20" x2="18" y2="10" />
                <line x1="12" y1="20" x2="12" y2="4" />
                <line x1="6" y1="20" x2="6" y2="14" />
            </svg>
        ),
    },
    {
        key: "documentation",
        label: "Documentation",
        path: "documentation",
        icon: (
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <polyline points="14 2 14 8 20 8" />
                <line x1="16" y1="13" x2="8" y2="13" />
                <line x1="16" y1="17" x2="8" y2="17" />
            </svg>
        ),
    },
];

function CompetitionSidebar({ competitionId: propCompetitionId, competitionTitle }) {
    const navigate = useNavigate();
    const location = useLocation();
    const { competitionId: paramCompetitionId, id: paramId } = useParams();

    const competitionId = propCompetitionId || paramCompetitionId || paramId;

    const [loadedTitle, setLoadedTitle] = useState("");

    useEffect(() => {
        let cancelled = false;

        async function loadCompetitionTitle() {
            if (!competitionId || competitionTitle) return;

            try {
                const token = getToken();

                const res = await fetch(`${API}/competitions/${competitionId}`, {
                    headers: token ? { Authorization: `Bearer ${token}` } : {},
                });

                if (!res.ok) return;

                const data = await res.json();

                if (!cancelled) {
                    setLoadedTitle(data?.title || "");
                }
            } catch (err) {
                console.warn("Could not load competition title:", err);
            }
        }

        loadCompetitionTitle();

        return () => {
            cancelled = true;
        };
    }, [competitionId, competitionTitle]);

    const titleToShow = competitionTitle || loadedTitle || "Competition";

    const activeKey = useMemo(() => {
        const parts = location.pathname.split("/").filter(Boolean);
        const last = parts[parts.length - 1];

        if (last === competitionId) return "overview";

        return last || "data-collection";
    }, [location.pathname, competitionId]);

    const goToCompetitionPage = (path) => {
        if (!competitionId) return;
        navigate(`/competitions/${competitionId}/${path}`);
    };

    return (
        <aside className="csidebar">
            <button
                type="button"
                className="csidebar-back"
                onClick={() => navigate("/competitions")}
            >
                ← BACK TO COMPETITIONS
            </button>

            <div className="csidebar-identity">
                <span className="csidebar-brand" title={titleToShow}>
                    {titleToShow}
                </span>
            </div>

            <nav className="csidebar-nav">
                {NAV_ITEMS.map((item) => (
                    <button
                        key={item.key}
                        type="button"
                        className={`csidebar-item ${activeKey === item.key ? "active" : ""}`}
                        onClick={() => goToCompetitionPage(item.path)}
                    >
                        <span className="csidebar-icon">{item.icon}</span>
                        <span>{item.label}</span>
                    </button>
                ))}
            </nav>

            <div className="csidebar-bottom">
                <button
                    type="button"
                    className="csidebar-util"
                    onClick={() => navigate("/profile/settings")}
                >
                    <span className="csidebar-icon">
                        <svg
                            width="14"
                            height="14"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                        >
                            <circle cx="12" cy="12" r="3" />
                            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
                        </svg>
                    </span>
                    Settings
                </button>

                <button
                    type="button"
                    className="csidebar-util"
                    onClick={() => goToCompetitionPage("support")}
                >
                    <span className="csidebar-icon">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <circle cx="12" cy="12" r="10" />
                            <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
                            <line x1="12" y1="17" x2="12.01" y2="17" />
                        </svg>
                    </span>
                    Support
                </button>
            </div>
        </aside>
    );
}

export default CompetitionSidebar;