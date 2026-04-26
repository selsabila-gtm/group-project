/**
 * authFetch.js  — src/utils/authFetch.js
 *
 * Drop-in replacement for fetch() for all authenticated API calls.
 *
 * Key improvement over the raw localStorage approach:
 *   Reads the token from the LIVE Supabase session, which the SDK
 *   auto-refreshes before it expires. This means your backend never
 *   sees a stale token and never returns 401 due to expiry.
 *
 * Usage:
 *   import { authFetch, api } from '../utils/authFetch';
 *
 *   const teams = await api.get('/teams');
 *   const result = await api.post('/teams', { name: 'My Team' });
 *   await api.delete(`/teams/${id}/members/${userId}`);
 */

import { supabase } from '../config/supabase';

const API_BASE = 'http://127.0.0.1:8000';

// ── Token helpers ─────────────────────────────────────────────────────────────

/** Returns the current valid access token from the live Supabase session. */
async function getLiveToken() {
  const { data } = await supabase.auth.getSession();
  return data?.session?.access_token ?? null;
}

export function getStoredUser() {
  try { return JSON.parse(localStorage.getItem('user') || '{}'); } catch { return {}; }
}

export function isLoggedIn() {
  // Quick synchronous check — use getLiveToken() for authoritative check
  return Boolean(localStorage.getItem('token'));
}

export async function logout() {
  try { await supabase.auth.signOut(); } catch { /* ignore */ }
  localStorage.removeItem('token');
  localStorage.removeItem('user');
  window.location.href = '/login';
}

// ── Core fetch wrapper ────────────────────────────────────────────────────────

/**
 * @param {string} path        API path (e.g. '/teams') or full URL
 * @param {RequestInit} opts   Standard fetch options
 * @returns {Promise<any>}     Parsed JSON, or null for empty responses
 * @throws on non-ok responses (err.status and err.data are set)
 */
export async function authFetch(path, opts = {}) {
  const url = path.startsWith('http') ? path : `${API_BASE}${path}`;

  // Always use the live token (SDK refreshes it automatically if near expiry)
  const token = await getLiveToken();

  if (!token) {
    // No session at all → log out cleanly
    await logout();
    return new Promise(() => {}); // never resolves; redirect in progress
  }

  // Keep localStorage in sync so components reading it directly stay current
  localStorage.setItem('token', token);

  const headers = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
    ...(opts.headers || {}),
  };

  const res = await fetch(url, { ...opts, headers });

  // Belt-and-suspenders: if backend still says 401, log out
  if (res.status === 401) {
    console.warn('[authFetch] Unexpected 401 — logging out');
    await logout();
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
  get:    (path)       => authFetch(path),
  post:   (path, body) => authFetch(path, { method: 'POST',   body: JSON.stringify(body) }),
  put:    (path, body) => authFetch(path, { method: 'PUT',    body: JSON.stringify(body) }),
  delete: (path)       => authFetch(path, { method: 'DELETE' }),
};