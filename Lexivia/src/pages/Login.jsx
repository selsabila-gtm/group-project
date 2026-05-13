import { useState } from "react"
import { Link } from "react-router-dom"
import Navbar from "../components/Navbar"
import { signIn, signInWithGoogle, signInWithGithub } from "../lib/auth"
import { syncProfile } from "../lib/syncProfile"

export default function Login() {
  const [form, setForm] = useState({ email: "", password: "" })
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)
  const [oauthLoading, setOauthLoading] = useState("")

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value })
  }

  const handleLogin = async (e) => {
    e.preventDefault()
    setError("")

    if (!form.email.trim() || !form.password) {
      setError("Please fill all fields")
      return
    }

    setLoading(true)

    try {
      const { user, session } = await signIn({
        email: form.email,
        password: form.password,
      })

      localStorage.setItem("token", session.access_token)
      localStorage.setItem("user", JSON.stringify(user))

      await syncProfile(
        user.id,
        user.user_metadata?.full_name || user.user_metadata?.name || "",
        user.email,
        session.access_token
      )

      window.location.href = "/dashboard"
    } catch (err) {
      const msg = String(err.message || "").toLowerCase()

      if (
        msg.includes("confirm") ||
        msg.includes("verify") ||
        msg.includes("not confirmed")
      ) {
        setError("Please verify your email before logging in.")
      } else if (msg.includes("invalid")) {
        setError("Invalid email or password.")
      } else {
        setError(err.message || "Login failed")
      }
    } finally {
      setLoading(false)
    }
  }

  const handleGoogleLogin = async () => {
    setError("")
    setOauthLoading("google")

    try {
      await signInWithGoogle()
    } catch (err) {
      setError(err.message || "Google login failed")
      setOauthLoading("")
    }
  }

  const handleGithubLogin = async () => {
    setError("")
    setOauthLoading("github")

    try {
      await signInWithGithub()
    } catch (err) {
      setError(err.message || "GitHub login failed")
      setOauthLoading("")
    }
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#f6f7fb",
        fontFamily: "Inter, Arial, sans-serif",
        display: "flex",
        flexDirection: "column",
      }}
    >
      <Navbar />

      <div
        style={{
          flex: 1,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "60px 20px",
        }}
      >
        <div
          style={{
            background: "#fff",
            borderRadius: "16px",
            padding: "48px",
            width: "100%",
            maxWidth: "420px",
            boxShadow: "0 4px 40px rgba(0,0,0,0.06)",
            border: "1px solid #e8eaf2",
          }}
        >
          <div style={{ textAlign: "center", marginBottom: "36px" }}>
            <h1
              style={{
                fontSize: "26px",
                fontWeight: 700,
                color: "#0d0e14",
                margin: "0 0 4px",
              }}
            >
              Precision Architect
            </h1>
            <p style={{ fontSize: "11px", color: "#8892a4", margin: 0 }}>
              AUTHENTICATION PROTOCOL v4.0
            </p>
          </div>

          <form
            onSubmit={handleLogin}
            style={{
              background: "#f6f7fb",
              borderRadius: "12px",
              padding: "28px",
              border: "1px solid #e8eaf2",
            }}
          >
            <div style={{ marginBottom: "16px" }}>
              <label style={{ fontSize: "11px", color: "#8892a4" }}>
                EMAIL ADDRESS
              </label>
              <input
                name="email"
                type="email"
                value={form.email}
                onChange={handleChange}
                placeholder="researcher@precision.arch"
                style={{
                  width: "100%",
                  padding: "10px",
                  borderRadius: "8px",
                  border: "1px solid #d6dae8",
                  marginTop: "6px",
                  boxSizing: "border-box",
                }}
              />
            </div>

            <div style={{ marginBottom: "20px" }}>
              <label style={{ fontSize: "11px", color: "#8892a4" }}>
                PASSWORD
              </label>
              <input
                name="password"
                type="password"
                value={form.password}
                onChange={handleChange}
                placeholder="••••••••"
                style={{
                  width: "100%",
                  padding: "10px",
                  borderRadius: "8px",
                  border: "1px solid #d6dae8",
                  marginTop: "6px",
                  boxSizing: "border-box",
                }}
              />
            </div>

            {error && (
              <div
                style={{
                  background: "#ffe5e5",
                  color: "#d8000c",
                  padding: "10px",
                  borderRadius: "6px",
                  marginBottom: "12px",
                  fontSize: "13px",
                  textAlign: "center",
                }}
              >
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading || !!oauthLoading}
              style={{
                width: "100%",
                padding: "13px",
                background: loading ? "#8899ff" : "#1a2fff",
                color: "#fff",
                border: "none",
                borderRadius: "8px",
                fontWeight: 600,
                cursor: loading || oauthLoading ? "not-allowed" : "pointer",
              }}
            >
              {loading ? "Authenticating…" : "Initialize Login →"}
            </button>

            <div style={{ textAlign: "center", margin: "18px 0 14px" }}>
              <span
                style={{
                  fontSize: "11px",
                  letterSpacing: "1px",
                  color: "#8892a4",
                }}
              >
                OR CONTINUE WITH
              </span>
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: "12px",
              }}
            >
              <button
                type="button"
                onClick={handleGoogleLogin}
                disabled={loading || !!oauthLoading}
                style={{
                  padding: "10px",
                  background: "#fff",
                  border: "1px solid #d6dae8",
                  borderRadius: "8px",
                  fontSize: "13px",
                  color: "#1d2333",
                  cursor: loading || oauthLoading ? "not-allowed" : "pointer",
                  fontWeight: 500,
                }}
              >
                {oauthLoading === "google" ? "Opening…" : "⊞ Google"}
              </button>

              <button
                type="button"
                onClick={handleGithubLogin}
                disabled={loading || !!oauthLoading}
                style={{
                  padding: "10px",
                  background: "#fff",
                  border: "1px solid #d6dae8",
                  borderRadius: "8px",
                  fontSize: "13px",
                  color: "#1d2333",
                  cursor: loading || oauthLoading ? "not-allowed" : "pointer",
                  fontWeight: 500,
                }}
              >
                {oauthLoading === "github" ? "Opening…" : "⊙ GitHub"}
              </button>
            </div>

            <p
              style={{
                textAlign: "center",
                fontSize: "13px",
                marginTop: "16px",
              }}
            >
              New Investigator? <Link to="/signup">Sign Up</Link>
            </p>
          </form>
        </div>
      </div>
    </div>
  )
}