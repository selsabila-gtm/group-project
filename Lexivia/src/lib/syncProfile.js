// src/lib/syncProfile.js

const API_URL = "http://127.0.0.1:8000"

export async function syncProfile(userId, fullName, email, token) {
    const res = await fetch(`${API_URL}/sync-user`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
            user_id: userId,
            full_name: fullName || "",
            email: email || "",
        }),
    })

    if (!res.ok) {
        const text = await res.text()
        throw new Error(`Profile sync failed: ${res.status} ${text}`)
    }

    return res.json()
}