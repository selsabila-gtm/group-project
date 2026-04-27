import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import "../../styles/settings.css";
import Sidebar from "../../components/Sidebar.jsx";
const API = "http://127.0.0.1:8000";

// ── Auth helpers outside the component to avoid stale closures ────────────────
const getToken = () => localStorage.getItem("token");

const authHeaders = () => {
  const token = getToken();
  if (!token) return { "Content-Type": "application/json" };
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
  };
};

function Settings() {
  const navigate = useNavigate();

  // ── State ──────────────────────────────────────────────────────────────────
  const [accountInfo, setAccountInfo] = useState({
    full_name: "",
    username:  "",
    email:     "",
  });

  const [passwords, setPasswords] = useState({
    current:     "",
    newPassword: "",
    confirm:     "",
  });

  const [loadingUser, setLoadingUser] = useState(true);
  const [saveStatus,  setSaveStatus]  = useState(null); // null|'saving'|'saved'|'error'
  const [pwStatus,    setPwStatus]    = useState(null); // null|'saving'|'saved'|'error'
  const [errorMsg,    setErrorMsg]    = useState("");
  const [pwErrorMsg,  setPwErrorMsg]  = useState("");

  // ── Load current user settings on mount ───────────────────────────────────
  useEffect(() => {
    const token = getToken();
    if (!token) {
      navigate("/login");
      return;
    }

    let cancelled = false;

    fetch(`${API}/settings/me`, { headers: authHeaders() })
      .then((r) => {
        if (r.status === 401) { navigate("/login"); return null; }
        if (!r.ok) throw new Error("Failed to load settings");
        return r.json();
      })
      .then((data) => {
        if (!data || cancelled) return;
        setAccountInfo({
          full_name: data.full_name || "",
          username:  data.username  || "",
          email:     data.email     || "",
        });
      })
      .catch((e) => { if (!cancelled) setErrorMsg(e.message); })
      .finally(() => { if (!cancelled) setLoadingUser(false); });

    return () => { cancelled = true; };
  }, [navigate]);

  // ── Handlers ───────────────────────────────────────────────────────────────
  const handleAccountChange = (e) =>
    setAccountInfo((prev) => ({ ...prev, [e.target.name]: e.target.value }));

  const handlePasswordChange = (e) =>
    setPasswords((prev) => ({ ...prev, [e.target.name]: e.target.value }));

  const handleSaveChanges = async () => {
    setErrorMsg("");
    setSaveStatus("saving");

    try {
      const res = await fetch(`${API}/settings/account`, {
        method:  "PATCH",
        headers: authHeaders(),
        body: JSON.stringify({
          full_name: accountInfo.full_name || null,
          email:     accountInfo.email     || null,
          // username is intentionally omitted — backend ignores it
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Update failed");

      if (data.warning) {
        setErrorMsg(data.warning);
        setSaveStatus("error");
        return;
      }

      // ✅ Re-sync state from what the server actually saved
      setAccountInfo((prev) => ({
        ...prev,
        full_name: data.full_name ?? prev.full_name,
        email:     data.email     ?? prev.email,
      }));

      setSaveStatus("saved");
      setTimeout(() => setSaveStatus(null), 2500);
    } catch (e) {
      setErrorMsg(e.message);
      setSaveStatus("error");
    }
  };

  const handleUpdatePassword = async () => {
    setPwErrorMsg("");

    if (!passwords.current || !passwords.newPassword || !passwords.confirm) {
      setPwErrorMsg("Please fill in all password fields.");
      return;
    }
    if (passwords.newPassword !== passwords.confirm) {
      setPwErrorMsg("New passwords do not match.");
      return;
    }
    if (passwords.newPassword.length < 6) {
      setPwErrorMsg("New password must be at least 6 characters.");
      return;
    }

    setPwStatus("saving");
    try {
      const res = await fetch(`${API}/settings/change-password`, {
        method:  "POST",
        headers: authHeaders(),
        body: JSON.stringify({
          current_password: passwords.current,
          new_password:     passwords.newPassword,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Password update failed");

      setPasswords({ current: "", newPassword: "", confirm: "" });
      setPwStatus("saved");
      setTimeout(() => setPwStatus(null), 2500);
    } catch (e) {
      setPwErrorMsg(e.message);
      setPwStatus("error");
    }
  };

  const handleLogOut = async () => {
    if (!window.confirm("Are you sure you want to log out?")) return;

    try {
      await fetch(`${API}/settings/logout`, {
        method:  "POST",
        headers: authHeaders(),
      });
    } catch {
      // best-effort — always clear locally
    }

    localStorage.removeItem("token");
    localStorage.removeItem("user");
    navigate("/login");
  };

  // ── Render ─────────────────────────────────────────────────────────────────
  if (loadingUser) {
    return (
      <div className="settings-page" style={{ display: "flex", alignItems: "center", justifyContent: "center" }}>
        <p style={{ color: "#8892a4", fontSize: "14px" }}>Loading your settings…</p>
      </div>
    );
  }

  return (
    <div className="settings-page">
      <div className="settings-header">
        <h1 className="settings-title">Settings</h1>
        <p className="settings-subtitle">Manage your account and preferences</p>
      </div>

      <div className="settings-content">

        {/* ── Account Information ── */}
        <section className="settings-card">
          <h2 className="settings-card-title">Account Information</h2>

          {errorMsg && (
            <div style={{
              background: "#ffe5e5", color: "#d8000c", padding: "10px 14px",
              borderRadius: "8px", fontSize: "13px", marginBottom: "16px",
            }}>
              {errorMsg}
            </div>
          )}

          {saveStatus === "saved" && (
            <div style={{
              background: "#e6f9f0", color: "#0a7c45", padding: "10px 14px",
              borderRadius: "8px", fontSize: "13px", marginBottom: "16px",
            }}>
              Account updated successfully ✓
            </div>
          )}

          <div className="settings-field">
            <label className="settings-label">Full Name</label>
            <input
              className="settings-input"
              type="text"
              name="full_name"
              value={accountInfo.full_name}
              onChange={handleAccountChange}
              placeholder="Your full name"
            />
          </div>

          <div className="settings-field">
            <label className="settings-label">Email</label>
            <input
              className="settings-input"
              type="email"
              name="email"
              value={accountInfo.email}
              onChange={handleAccountChange}
              placeholder="you@example.com"
            />
            <p style={{ fontSize: "11px", color: "#8892a4", marginTop: "4px" }}>
              Changing your email will send a verification link to the new address.
            </p>
          </div>
        </section>

        {/* ── Change Password ── */}
        <section className="settings-card">
          <h2 className="settings-card-title">Change Password</h2>

          {pwErrorMsg && (
            <div style={{
              background: "#ffe5e5", color: "#d8000c", padding: "10px 14px",
              borderRadius: "8px", fontSize: "13px", marginBottom: "16px",
            }}>
              {pwErrorMsg}
            </div>
          )}

          {pwStatus === "saved" && (
            <div style={{
              background: "#e6f9f0", color: "#0a7c45", padding: "10px 14px",
              borderRadius: "8px", fontSize: "13px", marginBottom: "16px",
            }}>
              Password updated successfully ✓
            </div>
          )}

          <div className="settings-field">
            <label className="settings-label">Current Password</label>
            <input
              className="settings-input"
              type="password"
              name="current"
              placeholder="Enter current password"
              value={passwords.current}
              onChange={handlePasswordChange}
            />
          </div>

          <div className="settings-field">
            <label className="settings-label">New Password</label>
            <input
              className="settings-input"
              type="password"
              name="newPassword"
              placeholder="Enter new password"
              value={passwords.newPassword}
              onChange={handlePasswordChange}
            />
          </div>

          <div className="settings-field">
            <label className="settings-label">Confirm New Password</label>
            <input
              className="settings-input"
              type="password"
              name="confirm"
              placeholder="Confirm new password"
              value={passwords.confirm}
              onChange={handlePasswordChange}
            />
          </div>

          <button
            className="settings-btn-primary"
            onClick={handleUpdatePassword}
            disabled={pwStatus === "saving"}
          >
            {pwStatus === "saving" ? "Updating…" : "Update Password"}
          </button>
        </section>

        {/* ── Actions ── */}
        <section className="settings-card">
          <h2 className="settings-card-title">Actions</h2>
          <button className="settings-btn-danger" onClick={handleLogOut}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
              <polyline points="16 17 21 12 16 7"/>
              <line x1="21" y1="12" x2="9" y2="12"/>
            </svg>
            Log Out
          </button>
        </section>

      </div>

      {/* ── Footer save bar ── */}
      <div className="settings-footer">
        <button className="settings-btn-cancel" onClick={() => navigate(-1)}>
          Cancel
        </button>
        <button
          className={`settings-btn-save ${saveStatus === "saving" ? "loading" : ""} ${saveStatus === "saved" ? "saved" : ""}`}
          onClick={handleSaveChanges}
          disabled={saveStatus === "saving"}
        >
          {saveStatus === "saving"
            ? "Saving…"
            : saveStatus === "saved"
            ? "Saved ✓"
            : "Save Changes"}
        </button>
      </div>
    </div>
  );
}

export default Settings;
