import { useState } from "react"
import { Link } from "react-router-dom"
import Navbar from "../components/Navbar"
import { signInWithGoogle, signInWithGithub } from "../lib/auth"
import { supabase } from "../config/supabase.js"

// The URL Supabase will redirect to after the user clicks the confirmation link.
// Must be added to "Redirect URLs" in your Supabase dashboard → Authentication → URL Configuration.
const REDIRECT_URL = `${window.location.origin}/auth/callback`;

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

    if (!form.full_name)                { setError("Please enter your full name"); return }
    if (!form.email)                    { setError("Please enter your email"); return }
    if (form.password !== form.confirm) { setError("Passwords do not match"); return }
    if (form.password.length < 6)       { setError("Password must be at least 6 characters"); return }

    setLoading(true)
    try {
      // Sign up directly with Supabase, passing the redirect URL for email confirmation.
      const { data, error: signUpError } = await supabase.auth.signUp({
        email:    form.email,
        password: form.password,
        options: {
          data: { full_name: form.full_name },
          emailRedirectTo: REDIRECT_URL,
        },
      })

      if (signUpError) throw signUpError

      const { user, session } = data

      if (session) {
        // Email confirmation is disabled in Supabase — log straight in.
        localStorage.setItem("token", session.access_token)
        localStorage.setItem("user", JSON.stringify(user))

        // Sync profile to backend (non-blocking)
        fetch("http://127.0.0.1:8000/sync-user", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({
            user_id:   user.id,
            full_name: form.full_name,
            email:     user.email,
          }),
        }).catch(console.error)

        window.location.href = "/dashboard"
      } else {
        // Supabase requires email confirmation — session is null until confirmed.
        setSuccess("Account created! Please check your email and click the confirmation link to activate your account.")
      }
    } catch (err) {
      setError(err.message || "Signup failed")
    } finally {
      setLoading(false)
    }
  }

  const handleGoogleLogin = async () => {
    try { await signInWithGoogle() } catch (err) { setError(err.message) }
  }

  const handleGithubLogin = async () => {
    try { await signInWithGithub() } catch (err) { setError(err.message) }
  }

  const inputStyle = {
    width: '100%', padding: '10px 36px', borderRadius: '8px',
    border: '1px solid #d6dae8', fontSize: '14px', color: '#0d0e14',
    background: '#fff', outline: 'none', boxSizing: 'border-box',
  }
  const labelStyle = { fontSize: '11px', letterSpacing: '1px', color: '#8892a4', display: 'block', marginBottom: '6px' }

  return (
    <div style={{ minHeight: '100vh', background: '#f6f7fb', fontFamily: 'Inter, Arial, sans-serif', display: 'flex', flexDirection: 'column' }}>
      <Navbar />

      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '60px 20px' }}>
        <div style={{ background: '#f6f7fb', borderRadius: '16px', padding: '48px', width: '100%', maxWidth: '460px', border: '1px solid #e8eaf2' }}>

          <div style={{ textAlign: 'center', marginBottom: '32px' }}>
            <p style={{ fontSize: '10px', letterSpacing: '2px', color: '#1a2fff', background: '#eef0ff', display: 'inline-block', padding: '4px 12px', borderRadius: '4px', marginBottom: '12px' }}>
              REGISTRATION TERMINAL
            </p>
            <h1 style={{ fontSize: '28px', fontWeight: 700, color: '#0d0e14', margin: '0 0 4px', letterSpacing: '-0.5px' }}>Create Account</h1>
            <p style={{ fontSize: '13px', color: '#8892a4', margin: 0 }}>Initialize your precision workspace environment.</p>
          </div>

          <div style={{ background: '#fff', borderRadius: '12px', padding: '28px', border: '1px solid #e8eaf2', marginBottom: '20px' }}>

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

            <div style={{ marginBottom: '16px' }}>
              <label style={labelStyle}>FULL NAME</label>
              <div style={{ position: 'relative' }}>
                <span style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#b0b8cc' }}>⚙</span>
                <input name="full_name" placeholder="YOUR NAME" onChange={handleChange} style={inputStyle} />
              </div>
            </div>

            <div style={{ marginBottom: '16px' }}>
              <label style={labelStyle}>EMAIL ADDRESS</label>
              <div style={{ position: 'relative' }}>
                <span style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#b0b8cc' }}>◈</span>
                <input name="email" type="email" placeholder="researcher@lab.precision.ai" onChange={handleChange} style={inputStyle} />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '24px' }}>
              <div>
                <label style={labelStyle}>PASSWORD</label>
                <div style={{ position: 'relative' }}>
                  <span style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#b0b8cc' }}>⬡</span>
                  <input name="password" type="password" placeholder="••••••••" value={form.password} onChange={handleChange} style={inputStyle} />
                </div>
              </div>
              <div>
                <label style={labelStyle}>CONFIRM</label>
                <div style={{ position: 'relative' }}>
                  <span style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#b0b8cc' }}>⬡</span>
                  <input name="confirm" type="password" placeholder="••••••••" onChange={handleChange} style={inputStyle} />
                </div>
              </div>
            </div>

            <button onClick={handleSignup} disabled={loading || !!success} style={{
              width: '100%', padding: '13px',
              background: loading ? '#8899ff' : '#1a2fff',
              color: '#fff', border: 'none', borderRadius: '8px',
              fontSize: '14px', fontWeight: 600,
              cursor: (loading || success) ? 'not-allowed' : 'pointer',
              letterSpacing: '0.3px', marginBottom: '20px',
              opacity: success ? 0.6 : 1,
            }}>
              {loading ? 'Creating Account…' : 'Join the Laboratory ↗'}
            </button>

            <div style={{ textAlign: 'center', marginBottom: '16px' }}>
              <span style={{ fontSize: '11px', letterSpacing: '1px', color: '#8892a4' }}>SYSTEM AUTH</span>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <button onClick={handleGoogleLogin} style={{ padding: '10px', background: '#f6f7fb', border: '1px solid #d6dae8', borderRadius: '8px', fontSize: '13px', color: '#1d2333', cursor: 'pointer', fontWeight: 500 }}>
                ⊞ Google
              </button>
              <button onClick={handleGithubLogin} style={{ padding: '10px', background: '#f6f7fb', border: '1px solid #d6dae8', borderRadius: '8px', fontSize: '13px', color: '#1d2333', cursor: 'pointer', fontWeight: 500 }}>
                ⊙ GitHub
              </button>
            </div>
          </div>

          <p style={{ textAlign: 'center', fontSize: '13px', color: '#8892a4' }}>
            Already part of the network?{' '}
            <Link to="/login" style={{ color: '#1a2fff', fontWeight: 500, textDecoration: 'none' }}>Login to Terminal</Link>
          </p>
        </div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 60px', borderTop: '1px solid #e8eaf2', background: '#fff' }}>
        <span style={{ fontSize: '12px', color: '#8892a4' }}>© 2024 Precision Architect NLP. All rights reserved.</span>
        <div style={{ display: 'flex', gap: '20px' }}>
          {['Privacy Policy', 'Terms of Service', 'Security'].map(link => (
            <a key={link} href="#" style={{ fontSize: '12px', color: '#8892a4', textDecoration: 'none' }}>{link}</a>
          ))}
        </div>
      </div>
    </div>
  )
}
