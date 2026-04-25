import { useState } from "react"
import Navbar from "../components/Navbar"
import { Link, useNavigate } from "react-router-dom"

export default function Login() {
  const [form, setForm] = useState({ email: "", password: "" })
  const navigate = useNavigate()

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value })
  }

  const handleLogin = async (e) => {
    e.preventDefault()

    if (!form.email || !form.password) {
      alert("Please fill all fields")
      return
    }

    try {
      const res = await fetch("http://127.0.0.1:8000/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: form.email,
          password: form.password,
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        alert(data.detail || "Login failed")
        return
      }

      // ✅ Save token + user
      localStorage.setItem("token", data.access_token)
      localStorage.setItem("user", JSON.stringify(data.user))

      console.log("LOGIN SUCCESS")

      navigate("/dashboard")
    } catch (err) {
      console.error(err)
      alert("Error connecting to server")
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
            }}>Precision Architect</h1>
            <p style={{ fontSize: '11px', color: '#8892a4', margin: 0 }}>
              AUTHENTICATION PROTOCOL v4.0
            </p>
          </div>

          {/* ✅ FORM STARTS HERE */}
          <form
            onSubmit={handleLogin}
            style={{
              background: '#f6f7fb',
              borderRadius: '12px',
              padding: '28px',
              border: '1px solid #e8eaf2',
            }}
          >

            {/* Email */}
            <div style={{ marginBottom: '16px' }}>
              <label style={{ fontSize: '11px', color: '#8892a4' }}>
                EMAIL ADDRESS
              </label>
              <input
                name="email"
                type="email"
                value={form.email}
                onChange={handleChange}
                placeholder="researcher@precision.arch"
                style={{
                  width: '100%',
                  padding: '10px',
                  borderRadius: '8px',
                  border: '1px solid #d6dae8',
                  marginTop: '6px'
                }}
              />
            </div>

            {/* Password */}
            <div style={{ marginBottom: '20px' }}>
              <label style={{ fontSize: '11px', color: '#8892a4' }}>
                PASSWORD
              </label>
              <input
                name="password"
                type="password"
                value={form.password}
                onChange={handleChange}
                placeholder="••••••••"
                style={{
                  width: '100%',
                  padding: '10px',
                  borderRadius: '8px',
                  border: '1px solid #d6dae8',
                  marginTop: '6px'
                }}
              />
            </div>

            {/* Button */}
            <button
              type="submit"
              style={{
                width: '100%',
                padding: '13px',
                background: '#1a2fff',
                color: '#fff',
                border: 'none',
                borderRadius: '8px',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Initialize Login →
            </button>

            <p style={{ textAlign: 'center', fontSize: '13px', marginTop: '16px' }}>
              New Investigator?{" "}
              <Link to="/signup">Sign Up</Link>
            </p>

          </form>
          {/* ✅ FORM ENDS HERE */}

        </div>
      </div>
    </div>
  )
}