import Sidebar from "../components/Sidebar";
import Topbar from "../components/Topbar";

function Notifications() {
    return (
        <div style={{ display: "flex", minHeight: "100vh", background: "#f7f8fc" }}>
            <Sidebar />
            <div style={{ flex: 1 }}>
                <Topbar title="Notifications" subtitle="Your latest platform updates." />
                <div style={{ padding: 24 }}>
                    <div style={card}>No new notifications yet.</div>
                </div>
            </div>
        </div>
    );
}

const card = {
    background: "#eef3ff",
    borderRadius: 18,
    padding: 24,
    color: "#19233c",
    fontWeight: 700,
};

export default Notifications;