import { useState } from "react";
import { useNavigate } from "react-router-dom";

function Topbar({ title = "", subtitle = "", showBrowseButton = false }) {
    const navigate = useNavigate();
    const [search, setSearch] = useState("");

    function handleSearch(e) {
        e.preventDefault();

        const q = search.trim();
        if (!q) return;

        navigate(`/search?q=${encodeURIComponent(q)}`);
    }

    return (
        <>
            <div
                style={{
                    position: "sticky",
                    top: 0,
                    zIndex: 1000,
                    background: "#ffffff",
                    padding: "18px 22px 0",
                    boxShadow: "0 2px 8px rgba(0,0,0,0.04)",
                }}
            >
                <div
                    style={{
                        height: "56px",
                        background: "#ffffff",
                        borderBottom: "1px solid #ececf3",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "flex-end",
                        padding: "0 22px",
                        gap: "16px",
                    }}
                >
                    <form onSubmit={handleSearch}>
                        <input
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            placeholder="Search competitions, datasets, teams..."
                            style={{
                                width: "360px",
                                height: "38px",
                                border: "1px solid #e6e9f2",
                                background: "#f7f8fc",
                                borderRadius: "12px",
                                padding: "0 16px",
                                fontSize: "13px",
                                outline: "none",
                                color: "#475069",
                            }}
                        />
                    </form>

                    <button onClick={() => navigate("/notifications")} style={iconBtn}>
                        🔔
                    </button>

                    <button onClick={() => navigate("/settings")} style={iconBtn}>
                        ☰
                    </button>

                    <button onClick={() => navigate("/profile")} style={iconBtn}>
                        👤
                    </button>
                </div>
            </div>

            {(title || subtitle || showBrowseButton) && (
                <div
                    style={{
                        padding: "24px 30px 0",
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "flex-start",
                        gap: "18px",
                    }}
                >
                    <div>
                        <h1
                            style={{
                                margin: 0,
                                fontSize: "34px",
                                lineHeight: 1.08,
                                color: "#19233c",
                                fontWeight: 800,
                            }}
                        >
                            {title}
                        </h1>

                        <p
                            style={{
                                margin: "8px 0 0",
                                maxWidth: "620px",
                                color: "#677086",
                                fontSize: "14px",
                                lineHeight: 1.35,
                            }}
                        >
                            {subtitle}
                        </p>
                    </div>

                    {showBrowseButton && (
                        <button
                            type="button"
                            onClick={() => navigate("/competitions")}
                            style={{
                                height: "50px",
                                minWidth: "190px",
                                padding: "0 24px",
                                border: "none",
                                borderRadius: "14px",
                                background: "#0d57d8",
                                color: "#ffffff",
                                fontSize: "15px",
                                fontWeight: 700,
                                boxShadow: "0 10px 18px rgba(13,87,216,0.18)",
                                cursor: "pointer",
                            }}
                        >
                            Browse Competitions
                        </button>
                    )}
                </div>
            )}
        </>
    );
}

const iconBtn = {
    width: "34px",
    height: "34px",
    border: "none",
    background: "transparent",
    cursor: "pointer",
    fontSize: "18px",
    color: "#6f778d",
};

export default Topbar;