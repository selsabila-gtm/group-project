/**
 * AuthCallback.jsx
 *
 * Handles TWO cases after Supabase redirects back to /auth/callback:
 *
 *  1. Email confirmation  — user clicked the link in their inbox
 *     Supabase puts the session in the URL hash: #access_token=...&type=signup
 *
 *  2. OAuth (Google / GitHub) — user completed the OAuth flow
 *     Supabase puts the session in the URL hash: #access_token=...&type=recovery (or just sets it)
 *
 * In both cases we:
 *   a) Call supabase.auth.getSession() — Supabase reads the hash automatically
 *   b) Store the token in localStorage
 *   c) Sync the user profile to your backend via /sync-user
 *   d) Redirect to /dashboard
 *
 * ADD THIS ROUTE in your router:
 *   <Route path="/auth/callback" element={<AuthCallback />} />
 */

import { useEffect, useState } from "react"
import { supabase } from "../config/supabase.js"
import { syncProfile } from "./Signup"   // reuse the helper

export default function AuthCallback() {
  const [status, setStatus] = useState("Verifying your account…")
  const [error,  setError]  = useState("")

  useEffect(() => {
    const handleCallback = async () => {
      try {
        // getSession() automatically picks up the token from the URL hash
        const { data: { session }, error: sessionError } = await supabase.auth.getSession()

        if (sessionError) throw sessionError
        if (!session)     throw new Error("No session found. The link may have expired.")

        const { user, access_token } = session

        // Store credentials
        localStorage.setItem("token", access_token)
        localStorage.setItem("user",  JSON.stringify(user))

        // Derive full_name:
        //  - For email signup: we stored it in sessionStorage before the redirect
        //  - For OAuth: Supabase puts it in user_metadata
        const fullName =
          sessionStorage.getItem("pending_full_name") ||
          user.user_metadata?.full_name ||
          user.user_metadata?.name ||        // GitHub uses "name"
          ""

        sessionStorage.removeItem("pending_full_name")

        setStatus("Syncing your profile…")
        await syncProfile(user.id, fullName, user.email, access_token)

        setStatus("All done! Redirecting…")
        setTimeout(() => { window.location.href = "/dashboard" }, 800)

      } catch (err) {
        console.error("AuthCallback error:", err)
        setError(err.message || "Verification failed. Please try signing up again.")
      }
    }

    handleCallback()
  }, [])

  return (
    <div style={{
      minHeight: "100vh", display: "flex", flexDirection: "column",
      alignItems: "center", justifyContent: "center",
      background: "#f6f7fb", fontFamily: "Inter, Arial, sans-serif",
    }}>
      {error ? (
        <div style={{ textAlign: "center", maxWidth: 400 }}>
          <p style={{ fontSize: "32px", marginBottom: 16 }}>⚠</p>
          <h2 style={{ fontSize: "20px", color: "#0d0e14", marginBottom: 8 }}>Verification failed</h2>
          <p style={{ fontSize: "14px", color: "#8892a4", marginBottom: 24 }}>{error}</p>
          <a href="/signup" style={{ color: "#1a2fff", fontSize: "14px", fontWeight: 600 }}>
            Back to Sign Up
          </a>
        </div>
      ) : (
        <div style={{ textAlign: "center" }}>
          {/* Simple spinner */}
          <div style={{
            width: 40, height: 40, border: "3px solid #e8eaf2",
            borderTop: "3px solid #1a2fff", borderRadius: "50%",
            animation: "spin 0.8s linear infinite", margin: "0 auto 20px",
          }} />
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
          <p style={{ fontSize: "14px", color: "#8892a4", letterSpacing: "0.3px" }}>{status}</p>
        </div>
      )}
    </div>
  )
}


