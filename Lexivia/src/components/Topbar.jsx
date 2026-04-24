import { useNavigate } from "react-router-dom";

function Topbar({
    title = "",
    subtitle = "",
    showBrowseButton = false,
}) {
    const navigate = useNavigate();

    return (
        <div
            style={{
                padding: "18px 22px 0",
            }}
        >
            <div
                style={{
                    height: "56px",
                    background: "#f3f5fd",
                    borderBottom: "1px solid #ececf3",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "0 22px",
                }}
            >
                <div
                    style={{
                        display: "flex",
                        gap: "22px",
                        fontSize: "11px",
                        letterSpacing: "0.08em",
                        color: "#6e768d",
                        fontWeight: 500,
                    }}
                >
                    <span style={{ color: "#1359db" }}>DOCS</span>
                    <span>API</span>
                    <span>SUPPORT</span>
                </div>

                <div
                    style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "14px",
                    }}
                >
                    <input
                        type="text"
                        placeholder="Search experiments..."
                        style={{
                            width: "270px",
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
                    <span style={{ fontSize: "16px", color: "#6f778d" }}>◔</span>
                    <span style={{ fontSize: "16px", color: "#6f778d" }}>☰</span>
                    <span style={{ fontSize: "16px", color: "#6f778d" }}>👤</span>
                </div>
            </div>

            <div
                style={{
                    padding: "24px 8px 0",
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
        </div>
    );
}

export default Topbar;