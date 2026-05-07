import { useState } from "react"
import { Link } from "react-router-dom"
import Navbar from "../components/Navbar"
import { signInWithGoogle, signInWithGithub } from "../lib/auth"
import { supabase } from "../config/supabase.js"

// Must be registered in Supabase Dashboard → Authentication → URL Configuration → Redirect URLs
const REDIRECT_URL = `${window.location.origin}/auth/callback`

export default function Signup() {
  const [form, setForm]       = useState({ full_name: "", email: "", password: "", confirm: "" })
  const [error, setError]     = useState("")
  const [success, setSuccess] = useState("")
  const [loading, setLoading] = useState(false)

  const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value })

  const handleSignup = async (e) => {
    e.preventDefault()
    setError("")
    setSuccess("")

    // ── Client-side validation ─────────────────────────────────────────────
    if (!form.full_name.trim())             { setError("Please enter your full name"); return }
    if (!form.email.trim())                 { setError("Please enter your email"); return }
    if (form.password !== form.confirm)     { setError("Passwords do not match"); return }
    if (form.password.length < 6)           { setError("Password must be at least 6 characters"); return }

    setLoading(true)
    try {
      const { data, error: signUpError } = await supabase.auth.signUp({
        email:    form.email.trim(),
        password: form.password,
        options: {
          data:            { full_name: form.full_name.trim() },
          emailRedirectTo: REDIRECT_URL,   // ← where Supabase sends the confirmation link
        },
      })

      if (signUpError) throw signUpError

      const { user, session } = data

      if (session) {
        // ── Email confirmation is OFF in Supabase → session returned immediately ──
        localStorage.setItem("token", session.access_token)
        localStorage.setItem("user",  JSON.stringify(user))

        // Sync profile to backend (fire-and-forget)
        syncProfile(user.id, form.full_name.trim(), user.email, session.access_token)

        window.location.href = "/dashboard"

      } else if (user) {
        // ── Email confirmation is ON → user exists but no session yet ────────
        // Store full_name so AuthCallback can use it after the redirect
        sessionStorage.setItem("pending_full_name", form.full_name.trim())
        setSuccess(
          "Account created! Check your email and click the confirmation link to activate your account."
        )

      } else {
        // Should not happen, but handle gracefully
        throw new Error("Signup returned no user. Please try again.")
      }

    } catch (err) {
      // Supabase error for already-registered email
      if (err.message?.toLowerCase().includes("already registered")) {
        setError("An account with this email already exists. Try logging in instead.")
      } else {
        setError(err.message || "Signup failed. Please try again.")
      }
    } finally {
      setLoading(false)
    }
  }

  // ── OAuth handlers ──────────────────────────────────────────────────────────
  // signInWithGoogle / signInWithGithub must pass redirectTo so Supabase
  // sends the user to /auth/callback after OAuth completes.
  // Your lib/auth.js should call:
  //   supabase.auth.signInWithOAuth({ provider: "google", options: { redirectTo: REDIRECT_URL } })
  const handleGoogleLogin = async () => {
    setError("")
    try {
      await signInWithGoogle(REDIRECT_URL)
    } catch (err) {
      setError(err.message || "Google sign-in failed")
    }
  }

  const handleGithubLogin = async () => {
    setError("")
    try {
      await signInWithGithub(REDIRECT_URL)
    } catch (err) {
      setError(err.message || "GitHub sign-in failed")
    }
  }

  // ── Styles ──────────────────────────────────────────────────────────────────
  const inputStyle = {
    width: "100%", padding: "10px 36px", borderRadius: "8px",
    border: "1px solid #d6dae8", fontSize: "14px", color: "#0d0e14",
    background: "#fff", outline: "none", boxSizing: "border-box",
  }
  const labelStyle = {
    fontSize: "11px", letterSpacing: "1px", color: "#8892a4",
    display: "block", marginBottom: "6px",
  }

  return (
    <div style={{ minHeight: "100vh", background: "#f6f7fb", fontFamily: "Inter, Arial, sans-serif", display: "flex", flexDirection: "column" }}>
      <Navbar />

      <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", padding: "60px 20px" }}>
        <div style={{ background: "#f6f7fb", borderRadius: "16px", padding: "48px", width: "100%", maxWidth: "460px", border: "1px solid #e8eaf2" }}>

          <div style={{ textAlign: "center", marginBottom: "32px" }}>
            <p style={{ fontSize: "10px", letterSpacing: "2px", color: "#1a2fff", background: "#eef0ff", display: "inline-block", padding: "4px 12px", borderRadius: "4px", marginBottom: "12px" }}>
              REGISTRATION TERMINAL
            </p>
            <h1 style={{ fontSize: "28px", fontWeight: 700, color: "#0d0e14", margin: "0 0 4px", letterSpacing: "-0.5px" }}>Create Account</h1>
            <p style={{ fontSize: "13px", color: "#8892a4", margin: 0 }}>Initialize your precision workspace environment.</p>
          </div>

          <div style={{ background: "#fff", borderRadius: "12px", padding: "28px", border: "1px solid #e8eaf2", marginBottom: "20px" }}>

            {error && (
              <div style={{ background: "#ffe5e5", color: "#d8000c", padding: "10px", borderRadius: "6px", marginBottom: "16px", fontSize: "13px", textAlign: "center" }}>
                {error}
              </div>
            )}

            {success && (
              <div style={{ background: "#e6f9f0", color: "#0a7c45", padding: "10px", borderRadius: "6px", marginBottom: "16px", fontSize: "13px", textAlign: "center" }}>
                {success}
              </div>
            )}

            {/* Full name — controlled input */}
            <div style={{ marginBottom: "16px" }}>
              <label style={labelStyle}>FULL NAME</label>
              <div style={{ position: "relative" }}>
                <span style={{ position: "absolute", left: "12px", top: "50%", transform: "translateY(-50%)", color: "#b0b8cc" }}>⚙</span>
                <input
                  name="full_name"
                  placeholder="Your Name"
                  value={form.full_name}
                  onChange={handleChange}
                  style={inputStyle}
                />
              </div>
            </div>

            {/* Email — controlled input */}
            <div style={{ marginBottom: "16px" }}>
              <label style={labelStyle}>EMAIL ADDRESS</label>
              <div style={{ position: "relative" }}>
                <span style={{ position: "absolute", left: "12px", top: "50%", transform: "translateY(-50%)", color: "#b0b8cc" }}>◈</span>
                <input
                  name="email"
                  type="email"
                  placeholder="researcher@lab.precision.ai"
                  value={form.email}
                  onChange={handleChange}
                  style={inputStyle}
                />
              </div>
            </div>

            {/* Password fields */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", marginBottom: "24px" }}>
              <div>
                <label style={labelStyle}>PASSWORD</label>
                <div style={{ position: "relative" }}>
                  <span style={{ position: "absolute", left: "12px", top: "50%", transform: "translateY(-50%)", color: "#b0b8cc" }}>⬡</span>
                  <input
                    name="password"
                    type="password"
                    placeholder="••••••••"
                    value={form.password}
                    onChange={handleChange}
                    style={inputStyle}
                  />
                </div>
              </div>
              <div>
                <label style={labelStyle}>CONFIRM</label>
                <div style={{ position: "relative" }}>
                  <span style={{ position: "absolute", left: "12px", top: "50%", transform: "translateY(-50%)", color: "#b0b8cc" }}>⬡</span>
                  <input
                    name="confirm"
                    type="password"
                    placeholder="••••••••"
                    value={form.confirm}
                    onChange={handleChange}
                    style={inputStyle}
                  />
                </div>
              </div>
            </div>

            <button
              onClick={handleSignup}
              disabled={loading || !!success}
              style={{
                width: "100%", padding: "13px",
                background: loading ? "#8899ff" : "#1a2fff",
                color: "#fff", border: "none", borderRadius: "8px",
                fontSize: "14px", fontWeight: 600,
                cursor: (loading || !!success) ? "not-allowed" : "pointer",
                letterSpacing: "0.3px", marginBottom: "20px",
                opacity: success ? 0.6 : 1,
                transition: "background 0.2s",
              }}
            >
              {loading ? "Creating Account…" : "Join the Laboratory ↗"}
            </button>

            <div style={{ textAlign: "center", marginBottom: "16px" }}>
              <span style={{ fontSize: "11px", letterSpacing: "1px", color: "#8892a4" }}>SYSTEM AUTH</span>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
              <button
                onClick={handleGoogleLogin}
                style={{ padding: "10px", background: "#f6f7fb", border: "1px solid #d6dae8", borderRadius: "8px", fontSize: "13px", color: "#1d2333", cursor: "pointer", fontWeight: 500 }}
              >
                ⊞ Google
              </button>
              <button
                onClick={handleGithubLogin}
                style={{ padding: "10px", background: "#f6f7fb", border: "1px solid #d6dae8", borderRadius: "8px", fontSize: "13px", color: "#1d2333", cursor: "pointer", fontWeight: 500 }}
              >
                ⊙ GitHub
              </button>
            </div>
          </div>

          <p style={{ textAlign: "center", fontSize: "13px", color: "#8892a4" }}>
            Already part of the network?{" "}
            <Link to="/login" style={{ color: "#1a2fff", fontWeight: 500, textDecoration: "none" }}>Login to Terminal</Link>
          </p>
        </div>
      </div>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "16px 60px", borderTop: "1px solid #e8eaf2", background: "#fff" }}>
        <span style={{ fontSize: "12px", color: "#8892a4" }}>© 2024 Precision Architect NLP. All rights reserved.</span>
        <div style={{ display: "flex", gap: "20px" }}>
          {["Privacy Policy", "Terms of Service", "Security"].map(link => (
            <a key={link} href="#" style={{ fontSize: "12px", color: "#8892a4", textDecoration: "none" }}>{link}</a>
          ))}
        </div>
      </div>
    </div>
  )
}

// ── Helper: sync profile to your backend ───────────────────────────────────────
// Exported so AuthCallback.jsx can reuse it
export async function syncProfile(userId, fullName, email, token) {
  try {
    await fetch("http://127.0.0.1:8000/sync-user", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ user_id: userId, full_name: fullName, email }),
    })
  } catch (err) {
    console.error("sync-user failed:", err)
  }
}