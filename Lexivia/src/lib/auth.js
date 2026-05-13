// src/lib/auth.js
import { supabase } from "../config/supabase"

const REDIRECT_URL = `${window.location.origin}/auth/callback`

export async function signUp({ fullName, email, password }) {
  const { data, error } = await supabase.auth.signUp({
    email: email.trim(),
    password,
    options: {
      data: {
        full_name: fullName.trim(),
        password_set: true,
      },
      emailRedirectTo: REDIRECT_URL,
    },
  })

  if (error) throw error

  return {
    user: data.user,
    session: data.session,
  }
}

export async function signIn({ email, password }) {
  const { data, error } = await supabase.auth.signInWithPassword({
    email: email.trim(),
    password,
  })

  if (error) throw error

  if (!data.user || !data.session) {
    throw new Error("Please verify your email before logging in.")
  }

  return {
    user: data.user,
    session: data.session,
  }
}

export async function signOut() {
  const { error } = await supabase.auth.signOut()

  if (error) throw error

  localStorage.removeItem("token")
  localStorage.removeItem("user")
}

export async function getSession() {
  const { data, error } = await supabase.auth.getSession()

  if (error) throw error

  return data.session
}

export function onAuthStateChange(callback) {
  const {
    data: { subscription },
  } = supabase.auth.onAuthStateChange((_event, session) => {
    callback({ session })

    if (session) {
      localStorage.setItem("token", session.access_token)
      localStorage.setItem("user", JSON.stringify(session.user))
    } else {
      localStorage.removeItem("token")
      localStorage.removeItem("user")
    }
  })

  return subscription
}

export async function signInWithGoogle(redirectTo = REDIRECT_URL) {
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo },
  })

  if (error) throw error

  return data
}

export async function signInWithGithub(redirectTo = REDIRECT_URL) {
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "github",
    options: { redirectTo },
  })

  if (error) throw error

  return data
}

export async function setPasswordForCurrentUser(password) {
  const { data: userData, error: userError } = await supabase.auth.getUser()

  if (userError) throw userError
  if (!userData.user) throw new Error("No logged-in user found.")

  const currentMetadata = userData.user.user_metadata || {}

  const { data, error } = await supabase.auth.updateUser({
    password,
    data: {
      ...currentMetadata,
      password_set: true,
    },
  })

  if (error) throw error

  return data.user
}