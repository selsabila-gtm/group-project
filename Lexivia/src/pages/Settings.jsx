import Sidebar from "../components/Sidebar";
import Topbar from "../components/Topbar";

function Settings() {
    return (
        <div style={{ display: "flex", minHeight: "100vh", background: "#f7f8fc" }}>
            <Sidebar />
            <div style={{ flex: 1 }}>
                <Topbar title="Settings" subtitle="Manage your account and platform preferences." />
                <div style={{ padding: 24 }}>
                    <div style={card}>Settings page coming next.</div>
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

export default Settings;