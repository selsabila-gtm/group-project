// src/lib/auth.js
//
// All Supabase auth operations live here.
// Import these in Login.jsx, Signup.jsx, and anywhere else auth is needed.
// Never call supabase.auth directly from components — always go through here.

import { supabase } from '../config/supabase'

export async function signUp({ fullName, email, password }) {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { full_name: fullName },
    },
  })
  if (error) throw error
  // data = { user, session }
  // session is null if email confirmation is required
  return data
}

export async function signIn({ email, password }) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password })
  if (error) throw error
  return data  // { user, session }
}

export async function signOut() {
  const { error } = await supabase.auth.signOut()
  if (error) throw error
  localStorage.removeItem('token')
  localStorage.removeItem('user')
}

export async function getSession() {
  const { data } = await supabase.auth.getSession()
  return data.session  // null if not logged in
}

/**
 * Listen for auth state changes (token refresh, sign-in, sign-out).
 * Call this once at the app root (e.g. in App.jsx useEffect).
 *
 * Example:
 *   onAuthStateChange(({ session }) => {
 *     if (session) localStorage.setItem('token', session.access_token)
 *     else { localStorage.removeItem('token'); localStorage.removeItem('user') }
 *   })
 */
export function onAuthStateChange(callback) {
  const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
    callback({ session })
  })
  return subscription  // call subscription.unsubscribe() on cleanup
}

export async function signInWithGoogle() {
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: `${window.location.origin}/dashboard` },
  })
  if (error) throw error
  return data
}

export async function signInWithGithub() {
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'github',
    options: { redirectTo: `${window.location.origin}/dashboard` },
  })
  if (error) throw error
  return data
}