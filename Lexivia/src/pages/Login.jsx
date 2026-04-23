import { useState } from "react"
import { login } from "../services/api"
import Navbar from "../components/Navbar"
import { Link, useNavigate } from "react-router-dom"

export default function Login() {
  const [form, setForm] = useState({ email: "", password: "" })
  const navigate = useNavigate()

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value })
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    const res = await login(form)
    if (res.access_token) {
      localStorage.setItem("token", res.access_token)
      navigate("/profile")
    } else {
      alert(res.detail || "Error")
    }
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
          background: '#fff',
          borderRadius: '16px',
          padding: '48px',
          width: '100%',
          maxWidth: '420px',
          boxShadow: '0 4px 40px rgba(0,0,0,0.06)',
          border: '1px solid #e8eaf2',
        }}>
          {/* Header */}
          <div style={{ textAlign: 'center', marginBottom: '36px' }}>
            <h1 style={{
              fontSize: '26px',
              fontWeight: 700,
              color: '#0d0e14',
              margin: '0 0 4px',
              letterSpacing: '-0.5px',
            }}>Precision Architect</h1>
            <p style={{ fontSize: '11px', letterSpacing: '1.5px', color: '#8892a4', margin: 0 }}>
              AUTHENTICATION PROTOCOL v4.0
            </p>
            <div style={{
              height: '2px',
              background: 'linear-gradient(90deg, #1a2fff 0%, #6b7fff 100%)',
              borderRadius: '2px',
              marginTop: '16px',
            }} />
          </div>

          {/* Form card */}
          <div style={{
            background: '#f6f7fb',
            borderRadius: '12px',
            padding: '28px',
            border: '1px solid #e8eaf2',
          }}>
            <h2 style={{ fontSize: '18px', fontWeight: 600, color: '#0d0e14', margin: '0 0 4px' }}>Access Workspace</h2>
            <p style={{ fontSize: '13px', color: '#8892a4', margin: '0 0 24px' }}>Please enter your research credentials</p>

            <div style={{ marginBottom: '16px' }}>
              <label style={{ fontSize: '11px', letterSpacing: '1px', color: '#8892a4', display: 'block', marginBottom: '6px' }}>
                EMAIL ADDRESS
              </label>
              <div style={{ position: 'relative' }}>
                <input
                  name="email"
                  type="email"
                  placeholder="researcher@precision.arch"
                  onChange={handleChange}
                  style={{
                    width: '100%',
                    padding: '10px 36px 10px 12px',
                    borderRadius: '8px',
                    border: '1px solid #d6dae8',
                    fontSize: '14px',
                    color: '#0d0e14',
                    background: '#fff',
                    outline: 'none',
                    boxSizing: 'border-box',
                  }}
                />
                <span style={{
                  position: 'absolute',
                  right: '12px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  color: '#b0b8cc',
                  fontSize: '14px',
                }}>◈</span>
              </div>
            </div>

            <div style={{ marginBottom: '24px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                <label style={{ fontSize: '11px', letterSpacing: '1px', color: '#8892a4' }}>SECURITY CIPHER</label>
                <a href="#" style={{ fontSize: '11px', color: '#1a2fff', textDecoration: 'none' }}>Reset Cipher?</a>
              </div>
              <div style={{ position: 'relative' }}>
                <input
                  name="password"
                  type="password"
                  placeholder="••••••••••••"
                  onChange={handleChange}
                  style={{
                    width: '100%',
                    padding: '10px 36px 10px 12px',
                    borderRadius: '8px',
                    border: '1px solid #d6dae8',
                    fontSize: '14px',
                    color: '#0d0e14',
                    background: '#fff',
                    outline: 'none',
                    boxSizing: 'border-box',
                  }}
                />
                <span style={{
                  position: 'absolute',
                  right: '12px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  color: '#b0b8cc',
                  fontSize: '14px',
                }}>◈</span>
              </div>
            </div>

            <button
              onClick={handleSubmit}
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
              }}
            >
              Initialize Login →
            </button>

            <p style={{ textAlign: 'center', fontSize: '13px', color: '#8892a4', marginTop: '16px' }}>
              New Investigator?{' '}
              <Link to="/signup" style={{ color: '#1a2fff', fontWeight: 500, textDecoration: 'none' }}>Sign Up</Link>
            </p>
          </div>

          {/* System stats */}
          <div style={{
            display: 'flex',
            justifyContent: 'center',
            gap: '20px',
            marginTop: '20px',
          }}>
            {['TRAFFIC: 9K/S', 'LATENCY: <2MS', 'ENCRYPTION: AES-256'].map((stat) => (
              <span key={stat} style={{ fontSize: '9px', color: '#c0c8d8', letterSpacing: '0.8px' }}>{stat}</span>
            ))}
          </div>
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