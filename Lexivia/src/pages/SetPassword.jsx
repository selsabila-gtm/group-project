// src/pages/SetPassword.jsx

import { useState } from "react"
import { setPasswordForCurrentUser } from "../lib/auth"

export default function SetPassword() {
    const [form, setForm] = useState({
        password: "",
        confirm: "",
    })

    const [error, setError] = useState("")
    const [loading, setLoading] = useState(false)

    const handleChange = (e) => {
        setForm({ ...form, [e.target.name]: e.target.value })
    }

    const handleSubmit = async (e) => {
        e.preventDefault()
        setError("")

        if (!form.password || !form.confirm) {
            setError("Please fill all fields.")
            return
        }

        if (form.password.length < 6) {
            setError("Password must be at least 6 characters.")
            return
        }

        if (form.password !== form.confirm) {
            setError("Passwords do not match.")
            return
        }

        setLoading(true)

        try {
            const user = await setPasswordForCurrentUser(form.password)

            localStorage.setItem("user", JSON.stringify(user))

            window.location.href = "/dashboard"
        } catch (err) {
            console.error("Set password error:", err)
            setError(err.message || "Failed to set password.")
        } finally {
            setLoading(false)
        }
    }

    return (
        <div
            style={{
                minHeight: "100vh",
                background: "#f6f7fb",
                fontFamily: "Inter, Arial, sans-serif",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                padding: "40px 20px",
            }}
        >
            <div
                style={{
                    background: "#fff",
                    borderRadius: "16px",
                    padding: "36px",
                    width: "100%",
                    maxWidth: "420px",
                    border: "1px solid #e8eaf2",
                    boxShadow: "0 4px 40px rgba(0,0,0,0.06)",
                }}
            >
                <div style={{ textAlign: "center", marginBottom: "28px" }}>
                    <h1 style={{ fontSize: "24px", margin: "0 0 8px", color: "#0d0e14" }}>
                        Set Your Password
                    </h1>
                    <p style={{ fontSize: "13px", color: "#8892a4", margin: 0 }}>
                        This lets you log in later using either Google or email/password.
                    </p>
                </div>

                {error && (
                    <div
                        style={{
                            background: "#ffe5e5",
                            color: "#d8000c",
                            padding: "10px",
                            borderRadius: "6px",
                            marginBottom: "16px",
                            fontSize: "13px",
                            textAlign: "center",
                        }}
                    >
                        {error}
                    </div>
                )}

                <form onSubmit={handleSubmit}>
                    <div style={{ marginBottom: "16px" }}>
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

                    <div style={{ marginBottom: "20px" }}>
                        <label style={{ fontSize: "11px", color: "#8892a4" }}>
                            CONFIRM PASSWORD
                        </label>
                        <input
                            name="confirm"
                            type="password"
                            value={form.confirm}
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

                    <button
                        type="submit"
                        disabled={loading}
                        style={{
                            width: "100%",
                            padding: "13px",
                            background: loading ? "#8899ff" : "#1a2fff",
                            color: "#fff",
                            border: "none",
                            borderRadius: "8px",
                            fontWeight: 600,
                            cursor: loading ? "not-allowed" : "pointer",
                        }}
                    >
                        {loading ? "Saving…" : "Save Password →"}
                    </button>
                </form>
            </div>
        </div>
    )
}