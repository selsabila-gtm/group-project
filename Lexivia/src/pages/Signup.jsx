import { useState } from "react"
import { signup } from "../services/api"
import Navbar from "../components/Navbar"
import { Link, useNavigate } from "react-router-dom"

export default function Signup() {
  const [form, setForm] = useState({ full_name: "", email: "", password: "", confirm: "" })
  const navigate = useNavigate()

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value })
  }
  const handleSignup = async (e) => {
  e.preventDefault();
  if (form.password !== form.confirm) {
  alert("Passwords do not match");
  return;
}  
if (!form.password || form.password.length < 6) {
  alert("Password must be at least 6 characters");
  return;
}
  try {
    const res = await fetch("http://127.0.0.1:8000/signup", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        full_name: form.full_name,
        email: form.email,
        password: form.password,
      }),
    });

    const data = await res.json();

    if (!res.ok) {
      alert(data.detail || "Signup failed");
      return;
    }

    alert("Signup successful! Please login.");
    navigate("/login");

  } catch (err) {
    console.error(err);
    alert("Error connecting to server");
  }
};



  const inputStyle = {
    width: '100%',
    padding: '10px 36px 10px 36px',
    borderRadius: '8px',
    border: '1px solid #d6dae8',
    fontSize: '14px',
    color: '#0d0e14',
    background: '#fff',
    outline: 'none',
    boxSizing: 'border-box',
  }

  const labelStyle = {
    fontSize: '11px',
    letterSpacing: '1px',
    color: '#8892a4',
    display: 'block',
    marginBottom: '6px',
  }

  return (
    <div style={{ minHeight: '100vh', background: '#f6f7fb', fontFamily: 'Inter, Arial, sans-serif', display: 'flex', flexDirection: 'column' }}>
      <Navbar />

      <div style={{
        flex: 1,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '60px 20px',
      }}>
        <div style={{
          background: '#f6f7fb',
          borderRadius: '16px',
          padding: '48px',
          width: '100%',
          maxWidth: '460px',
          border: '1px solid #e8eaf2',
        }}>
          {/* Header */}
          <div style={{ textAlign: 'center', marginBottom: '32px' }}>
            <p style={{
              fontSize: '10px',
              letterSpacing: '2px',
              color: '#1a2fff',
              background: '#eef0ff',
              display: 'inline-block',
              padding: '4px 12px',
              borderRadius: '4px',
              marginBottom: '12px',
            }}>REGISTRATION TERMINAL</p>
            <h1 style={{
              fontSize: '28px',
              fontWeight: 700,
              color: '#0d0e14',
              margin: '0 0 4px',
              letterSpacing: '-0.5px',
            }}>Create Account</h1>
            <p style={{ fontSize: '13px', color: '#8892a4', margin: 0 }}>
              Initialize your precision workspace environment.
            </p>
          </div>

          {/* Form */}
          <div style={{
            background: '#fff',
            borderRadius: '12px',
            padding: '28px',
            border: '1px solid #e8eaf2',
            marginBottom: '20px',
          }}>
            {/* Full Name */}
            <div style={{ marginBottom: '16px' }}>
              <label style={labelStyle}>FULL NAME</label>
              <div style={{ position: 'relative' }}>
                <span style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#b0b8cc', fontSize: '14px' }}>⚙</span>
                <input
                  name="full_name"
                  placeholder="YOUR NAME"
                  onChange={handleChange}
                  style={inputStyle}
                />
              </div>
            </div>

            {/* Email */}
            <div style={{ marginBottom: '16px' }}>
              <label style={labelStyle}>EMAIL ADDRESS</label>
              <div style={{ position: 'relative' }}>
                <span style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#b0b8cc', fontSize: '14px' }}>◈</span>
                <input
                  name="email"
                  type="email"
                  placeholder="researcher@lab.precision.ai"
                  onChange={handleChange}
                  style={inputStyle}
                />
              </div>
            </div>

            {/* Password + Confirm in grid */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '24px' }}>
              <div>
                <label style={labelStyle}>PASSWORD</label>
                <div style={{ position: 'relative' }}>
                  <span style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#b0b8cc', fontSize: '14px' }}>⬡</span>
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
                <div style={{ position: 'relative' }}>
                  <span style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#b0b8cc', fontSize: '14px' }}>⬡</span>
                  <input
                    name="confirm"
                    type="password"
                    placeholder="••••••••"
                    onChange={handleChange}
                    style={inputStyle}
                  />
                </div>
              </div>
            </div>

            <button
              onClick={handleSignup}
              style={{
                width: '100%',
                padding: '13px',
                background: '#1a2fff',
                color: '#fff',
                border: 'none',
                borderRadius: '8px',
                fontSize: '14px',
                fontWeight: 600,
                cursor: 'pointer',
                letterSpacing: '0.3px',
                marginBottom: '20px',
              }}
            >
              Join the Laboratory ↗
            </button>

            {/* Social auth */}
            <div style={{ textAlign: 'center', marginBottom: '16px' }}>
              <span style={{ fontSize: '11px', letterSpacing: '1px', color: '#8892a4' }}>SYSTEM AUTH</span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              {[
                { label: '⊞ Google', name: 'Google' },
                { label: '⊙ GitHub', name: 'GitHub' },
              ].map(btn => (
                <button key={btn.name} style={{
                  padding: '10px',
                  background: '#f6f7fb',
                  border: '1px solid #d6dae8',
                  borderRadius: '8px',
                  fontSize: '13px',
                  color: '#1d2333',
                  cursor: 'pointer',
                  fontWeight: 500,
                }}>{btn.label}</button>
              ))}
            </div>
          </div>

          <p style={{ textAlign: 'center', fontSize: '13px', color: '#8892a4' }}>
            Already part of the network?{' '}
            <Link to="/login" style={{ color: '#1a2fff', fontWeight: 500, textDecoration: 'none' }}>Login to Terminal</Link>
          </p>
        </div>
      </div>

      {/* Footer */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '16px 60px',
        borderTop: '1px solid #e8eaf2',
        background: '#fff',
      }}>
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