import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import "../../styles/settings.css";
import Sidebar from "../../components/Sidebar.jsx";

const API = "http://127.0.0.1:8000";

// ── Auth helpers ──────────────────────────────────────────────────────────────
const getToken = () => localStorage.getItem("token");

const authHeaders = () => {
  const token = getToken();
  if (!token) return { "Content-Type": "application/json" };
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
  };
};

const syncUserInStorage = (updates) => {
  try {
    const raw = localStorage.getItem("user");
    if (!raw) return;
    const user = JSON.parse(raw);
    if (updates.full_name !== undefined) {
      user.full_name = updates.full_name;
      if (user.user_metadata) user.user_metadata.full_name = updates.full_name;
    }
    localStorage.setItem("user", JSON.stringify(user));
  } catch {
    // non-critical
  }
};

function Settings() {
  const navigate = useNavigate();

  const [fullName,      setFullName]      = useState("");
  const [email,         setEmail]         = useState("");
  const [originalEmail, setOriginalEmail] = useState("");

  const [passwords, setPasswords] = useState({
    current: "", newPassword: "", confirm: "",
  });

  const [loadingUser,  setLoadingUser]  = useState(true);
  const [saveStatus,   setSaveStatus]   = useState(null);
  const [emailStatus,  setEmailStatus]  = useState(null);
  const [pwStatus,     setPwStatus]     = useState(null);

  const [errorMsg,        setErrorMsg]        = useState("");
  const [emailErrorMsg,   setEmailErrorMsg]   = useState("");
  const [emailSuccessMsg, setEmailSuccessMsg] = useState("");
  const [pwErrorMsg,      setPwErrorMsg]      = useState("");

  useEffect(() => {
    const token = getToken();
    if (!token) { navigate("/login"); return; }

    let cancelled = false;

    fetch(`${API}/settings/me`, { headers: authHeaders() })
      .then((r) => {
        if (r.status === 401) { navigate("/login"); return null; }
        if (!r.ok) throw new Error("Failed to load settings");
        return r.json();
      })
      .then((data) => {
        if (!data || cancelled) return;
        setFullName(data.full_name || "");
        setEmail(data.email || "");
        setOriginalEmail(data.email || "");
      })
      .catch((e) => { if (!cancelled) setErrorMsg(e.message); })
      .finally(() => { if (!cancelled) setLoadingUser(false); });

    return () => { cancelled = true; };
  }, [navigate]);

  const handleSaveChanges = async () => {
    setErrorMsg("");
    setSaveStatus("saving");

    try {
      const res = await fetch(`${API}/settings/account`, {
        method:  "PATCH",
        headers: authHeaders(),
        body: JSON.stringify({ full_name: fullName || null }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Update failed");

      const updatedName = data.full_name ?? fullName;
      setFullName(updatedName);
      syncUserInStorage({ full_name: updatedName });

      setSaveStatus("saved");
      setTimeout(() => setSaveStatus(null), 2500);
    } catch (e) {
      setErrorMsg(e.message);
      setSaveStatus("error");
    }
  };

  const handleChangeEmail = async () => {
    setEmailErrorMsg("");
    setEmailSuccessMsg("");

    if (!email || !email.includes("@")) {
      setEmailErrorMsg("Please enter a valid email address.");
      return;
    }
    if (email === originalEmail) {
      setEmailErrorMsg("This is already your current email.");
      return;
    }

    setEmailStatus("saving");
    try {
      const res = await fetch(`${API}/settings/change-email`, {
        method:  "POST",
        headers: authHeaders(),
        body: JSON.stringify({ email }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Email change failed");

      setEmailSuccessMsg(data.message);
      setEmailStatus("sent");
    } catch (e) {
      setEmailErrorMsg(e.message);
      setEmailStatus("error");
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
        method: "POST", headers: authHeaders(),
      });
    } catch { /* best-effort */ }

    localStorage.removeItem("token");
    localStorage.removeItem("user");
    navigate("/login");
  };

  if (loadingUser) {
    return (
      <div className="settings-page" style={{ display: "flex", alignItems: "center", justifyContent: "center" }}>
        <p style={{ color: "#8892a4", fontSize: "14px" }}>Loading your settings…</p>
      </div>
    );
  }

  return (
    <div className="settings-page">
      <div className="settings-container">

        <div className="settings-header">
          {/* ── ONLY NEW THING: Back button ── */}
          <button className="settings-btn-back" onClick={() => navigate(-1)}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="15 18 9 12 15 6"/>
            </svg>
            Back
          </button>
          <h1 className="settings-title">Settings</h1>
          <p className="settings-subtitle">Manage your account and preferences</p>
        </div>

        <div className="settings-content">

          {/* ── Account Information ── */}
          <section className="settings-card">
            <h2 className="settings-card-title">Account Information</h2>

            <div className="settings-field">
              <label className="settings-label">Full Name</label>
              <input
                className="settings-input"
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Your full name"
              />
            </div>

            {errorMsg && (
              <div style={{ background: "#ffe5e5", color: "#d8000c", padding: "10px 14px", borderRadius: "8px", fontSize: "13px", marginBottom: "8px" }}>
                {errorMsg}
              </div>
            )}
            {saveStatus === "saved" && (
              <div style={{ background: "#e6f9f0", color: "#0a7c45", padding: "10px 14px", borderRadius: "8px", fontSize: "13px", marginBottom: "8px" }}>
                Name updated successfully ✓
              </div>
            )}
          </section>

          {/* ── Email ── */}
          <section className="settings-card">
            <h2 className="settings-card-title">Email Address</h2>
            <p style={{ fontSize: "13px", color: "#8892a4", marginTop: "-12px", marginBottom: "16px" }}>
              A confirmation link will be sent to the new address. Your email won't change until you click it.
            </p>

            <div className="settings-field" style={{ marginBottom: "12px" }}>
              <label className="settings-label">Email</label>
              <input
                className="settings-input"
                type="email"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  setEmailStatus(null);
                  setEmailSuccessMsg("");
                  setEmailErrorMsg("");
                }}
                placeholder="you@example.com"
              />
            </div>

            {emailErrorMsg && (
              <div style={{ background: "#ffe5e5", color: "#d8000c", padding: "10px 14px", borderRadius: "8px", fontSize: "13px", marginBottom: "12px" }}>
                {emailErrorMsg}
              </div>
            )}
            {emailSuccessMsg && (
              <div style={{ background: "#e6f9f0", color: "#0a7c45", padding: "10px 14px", borderRadius: "8px", fontSize: "13px", marginBottom: "12px" }}>
                {emailSuccessMsg}
              </div>
            )}

            <button
              className="settings-btn-primary"
              onClick={handleChangeEmail}
              disabled={emailStatus === "saving" || email === originalEmail}
              style={{ opacity: email === originalEmail ? 0.5 : 1 }}
            >
              {emailStatus === "saving"
                ? "Sending…"
                : emailStatus === "sent"
                ? "Verification sent ✓"
                : "Update Email"}
            </button>
          </section>

          {/* ── Change Password ── */}
          <section className="settings-card">
            <h2 className="settings-card-title">Change Password</h2>

            {pwErrorMsg && (
              <div style={{ background: "#ffe5e5", color: "#d8000c", padding: "10px 14px", borderRadius: "8px", fontSize: "13px", marginBottom: "16px" }}>
                {pwErrorMsg}
              </div>
            )}
            {pwStatus === "saved" && (
              <div style={{ background: "#e6f9f0", color: "#0a7c45", padding: "10px 14px", borderRadius: "8px", fontSize: "13px", marginBottom: "16px" }}>
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
                onChange={(e) => setPasswords(p => ({ ...p, current: e.target.value }))}
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
                onChange={(e) => setPasswords(p => ({ ...p, newPassword: e.target.value }))}
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
                onChange={(e) => setPasswords(p => ({ ...p, confirm: e.target.value }))}
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

        {/* ── Footer save bar (original, unchanged) ── */}
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
    </div>
  );
}

export default Settings;
