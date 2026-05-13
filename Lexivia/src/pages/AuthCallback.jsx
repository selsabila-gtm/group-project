// src/pages/AuthCallback.jsx

import { useEffect, useState } from "react"
import { supabase } from "../config/supabase.js"
import { syncProfile } from "../lib/syncProfile"

export default function AuthCallback() {
  const [status, setStatus] = useState("Verifying your account…")
  const [error, setError] = useState("")

  useEffect(() => {
    const handleCallback = async () => {
      try {
        const params = new URLSearchParams(window.location.search)

        const code = params.get("code")
        const urlError = params.get("error_description") || params.get("error")

        if (urlError) {
          throw new Error(urlError)
        }

        let session = null

        if (code) {
          const { data, error } = await supabase.auth.exchangeCodeForSession(code)
          if (error) throw error
          session = data.session
        } else {
          const { data, error } = await supabase.auth.getSession()
          if (error) throw error
          session = data.session
        }

        if (!session) {
          throw new Error("No session found. The link may have expired.")
        }

        const user = session.user
        const token = session.access_token

        localStorage.setItem("token", token)
        localStorage.setItem("user", JSON.stringify(user))

        const fullName =
          sessionStorage.getItem("pending_full_name") ||
          user.user_metadata?.full_name ||
          user.user_metadata?.name ||
          ""

        sessionStorage.removeItem("pending_full_name")

        setStatus("Syncing your profile…")

        await syncProfile(user.id, fullName, user.email, token)

        const providers = user.app_metadata?.providers || []
        const mainProvider = user.app_metadata?.provider

        const isOAuthUser =
          mainProvider === "google" ||
          mainProvider === "github" ||
          providers.includes("google") ||
          providers.includes("github")

        const passwordSet = user.user_metadata?.password_set === true

        setStatus("Redirecting…")

        if (isOAuthUser && !passwordSet) {
          window.location.href = "/set-password"
        } else {
          window.location.href = "/dashboard"
        }
      } catch (err) {
        console.error("AuthCallback error:", err)
        setError(err.message || "Verification failed. Please try signing up again.")
      }
    }

    handleCallback()
  }, [])

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        background: "#f6f7fb",
        fontFamily: "Inter, Arial, sans-serif",
      }}
    >
      {error ? (
        <div style={{ textAlign: "center", maxWidth: 400 }}>
          <p style={{ fontSize: "32px", marginBottom: 16 }}>⚠</p>
          <h2 style={{ fontSize: "20px", color: "#0d0e14", marginBottom: 8 }}>
            Verification failed
          </h2>
          <p style={{ fontSize: "14px", color: "#8892a4", marginBottom: 24 }}>
            {error}
          </p>
          <a
            href="/signup"
            style={{ color: "#1a2fff", fontSize: "14px", fontWeight: 600 }}
          >
            Back to Sign Up
          </a>
        </div>
      ) : (
        <div style={{ textAlign: "center" }}>
          <div
            style={{
              width: 40,
              height: 40,
              border: "3px solid #e8eaf2",
              borderTop: "3px solid #1a2fff",
              borderRadius: "50%",
              animation: "spin 0.8s linear infinite",
              margin: "0 auto 20px",
            }}
          />
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
          <p style={{ fontSize: "14px", color: "#8892a4", letterSpacing: "0.3px" }}>
            {status}
          </p>
        </div>
      )}
    </div>
  )
}