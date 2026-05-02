/**
 * authFetch.js  — src/utils/authFetch.js
 */

import { supabase } from '../config/supabase';

const API_BASE = 'http://127.0.0.1:8000';

// ── Token helpers ─────────────────────────────────────────────────────────────

/**
 * Returns the current valid access token.
 * First tries the live Supabase session (auto-refreshed by SDK).
 * Falls back to localStorage in case the session is still initializing
 * (this prevents the race condition that caused instant logouts on navigation).
 */
async function getLiveToken() {
  try {
    const { data } = await supabase.auth.getSession();
    if (data?.session?.access_token) {
      return data.session.access_token;
    }
  } catch {
    // getSession failed — fall through to localStorage fallback
  }
  // Fallback: session may still be initializing on first render
  return localStorage.getItem('token');
}

export function getStoredUser() {
  try { return JSON.parse(localStorage.getItem('user') || '{}'); } catch { return {}; }
}

export function isLoggedIn() {
  return Boolean(localStorage.getItem('token'));
}

export async function logout() {
  try { await supabase.auth.signOut(); } catch { /* ignore */ }
  localStorage.removeItem('token');
  localStorage.removeItem('user');
  window.location.href = '/login';
}

// ── Core fetch wrapper ────────────────────────────────────────────────────────

export async function authFetch(path, opts = {}) {
  const url = path.startsWith('http') ? path : `${API_BASE}${path}`;

  const token = await getLiveToken();

  if (!token) {
    // Truly no session anywhere — redirect without wiping storage aggressively
    window.location.href = '/login';
    return new Promise(() => {});
  }

  // Keep localStorage in sync
  localStorage.setItem('token', token);

  const headers = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
    ...(opts.headers || {}),
  };

  const res = await fetch(url, { ...opts, headers });

  // 401 from backend: token is genuinely invalid/expired — clean logout
  if (res.status === 401) {
    console.warn('[authFetch] 401 received — clearing session and redirecting');
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    window.location.href = '/login';
    return new Promise(() => {});
  }

  const contentType = res.headers.get('content-type') || '';
  if (!contentType.includes('application/json')) {
    if (!res.ok) throw new Error(`Request failed: ${res.status}`);
    return null;
  }

  const data = await res.json();

  if (!res.ok) {
    const err = new Error(data.detail || `Request failed: ${res.status}`);
    err.status = res.status;
    err.data   = data;
    throw err;
  }

  return data;
}

// ── Convenience shorthands ────────────────────────────────────────────────────

export const api = {
  get:    (path)        => authFetch(path),
  post:   (path, body)  => authFetch(path, { method: 'POST',   body: JSON.stringify(body) }),
  put:    (path, body)  => authFetch(path, { method: 'PUT',    body: JSON.stringify(body) }),
  patch:  (path, body)  => authFetch(path, { method: 'PATCH',  body: JSON.stringify(body) }),
  delete: (path)        => authFetch(path, { method: 'DELETE' }),
};