import { useState } from "react";
import { useNavigate } from "react-router-dom";
import "../../styles/settings.css";

function Settings() {
  const navigate = useNavigate();

  const [accountInfo, setAccountInfo] = useState({
    fullName: "Dr. Jane Doe",
    username: "janedoe",
    email: "jane.doe@stanford.edu",
  });

  const [passwords, setPasswords] = useState({
    current: "",
    newPassword: "",
    confirm: "",
  });

  const [saveStatus, setSaveStatus] = useState(null); // null | 'saving' | 'saved' | 'error'

  const handleAccountChange = (e) => {
    setAccountInfo({ ...accountInfo, [e.target.name]: e.target.value });
  };

  const handlePasswordChange = (e) => {
    setPasswords({ ...passwords, [e.target.name]: e.target.value });
  };

  const handleUpdatePassword = () => {
    if (!passwords.current || !passwords.newPassword || !passwords.confirm) {
      alert("Please fill in all password fields.");
      return;
    }
    if (passwords.newPassword !== passwords.confirm) {
      alert("New passwords do not match.");
      return;
    }
    setPasswords({ current: "", newPassword: "", confirm: "" });
    alert("Password updated successfully.");
  };

  const handleSaveChanges = () => {
    setSaveStatus("saving");
    setTimeout(() => {
      setSaveStatus("saved");
      setTimeout(() => setSaveStatus(null), 2000);
    }, 800);
  };

  const handleLogOut = () => {
    if (window.confirm("Are you sure you want to log out?")) {
      navigate("/login");
    }
  };

  return (
    <div className="settings-page">
      <div className="settings-header">
        <h1 className="settings-title">Settings</h1>
        <p className="settings-subtitle">Manage your account and preferences</p>
      </div>

      <div className="settings-content">

        {/* Account Information */}
        <section className="settings-card">
          <h2 className="settings-card-title">Account Information</h2>

          <div className="settings-field">
            <label className="settings-label">Full Name</label>
            <input
              className="settings-input"
              type="text"
              name="fullName"
              value={accountInfo.fullName}
              onChange={handleAccountChange}
            />
          </div>

          <div className="settings-field">
            <label className="settings-label">Username</label>
            <input
              className="settings-input"
              type="text"
              name="username"
              value={accountInfo.username}
              onChange={handleAccountChange}
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
            />
          </div>
        </section>

        {/* Change Password */}
        <section className="settings-card">
          <h2 className="settings-card-title">Change Password</h2>

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

          <button className="settings-btn-primary" onClick={handleUpdatePassword}>
            Update Password
          </button>
        </section>

        {/* Actions */}
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

      {/* Footer action bar */}
      <div className="settings-footer">
        <button className="settings-btn-cancel" onClick={() => navigate(-1)}>
          Cancel
        </button>
        <button
          className={`settings-btn-save ${saveStatus === "saving" ? "loading" : ""} ${saveStatus === "saved" ? "saved" : ""}`}
          onClick={handleSaveChanges}
          disabled={saveStatus === "saving"}
        >
          {saveStatus === "saving" ? "Saving…" : saveStatus === "saved" ? "Saved ✓" : "Save Changes"}
        </button>
      </div>
    </div>
  );
}

export default Settings;
