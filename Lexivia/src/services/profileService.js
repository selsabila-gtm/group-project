import { supabase } from '../config/supabase'

export async function getFullProfile(userId) {
  try {
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('id, name, email, avatar_url, role, created_at')
      .eq('id', userId)
      .single()

    if (userError) throw userError

    const { data: profile, error: profileError } = await supabase
      .from('user_profiles')
      .select('bio, institution, country, skills, linkedin_url, github_url, website_url')
      .eq('user_id', userId)
      .maybeSingle()

    if (profileError) throw profileError

    const { data: experiences, error: expError } = await supabase
      .from('user_experiences')
      .select('id, title, organization, start_year, end_year, description')
      .eq('user_id', userId)
      .order('start_year', { ascending: false })

    if (expError) throw expError

    // ⚠️ competitions table has no organizer_id yet — skipped until team adds it
    // ⚠️ team_members/teams link not ready yet — skipped until team adds it

    return {
      data: {
        user,
        profile: profile ?? {},
        experiences: experiences ?? [],
        organizedCompetitions: [],
        participatedCompetitions: [],
      },
      error: null,
    }
  } catch (error) {
    console.error('[profileService.getFullProfile]', error)
    return { data: null, error }
  }
}

export async function updateUserInfo(userId, updates) {
  const { data, error } = await supabase
    .from('users')
    .update(updates)
    .eq('id', userId)
    .select()
    .single()

  if (error) console.error('[profileService.updateUserInfo]', error)
  return { data, error }
}

export async function upsertUserProfile(userId, profileData) {
  const { data, error } = await supabase
    .from('user_profiles')
    .upsert(
      { user_id: userId, ...profileData, updated_at: new Date().toISOString() },
      { onConflict: 'user_id' }
    )
    .select()
    .single()

  if (error) console.error('[profileService.upsertUserProfile]', error)
  return { data, error }
}

export async function uploadAvatar(userId, file) {
  const fileExt = file.name.split('.').pop()
  const filePath = `avatars/${userId}.${fileExt}`

  const { error: uploadError } = await supabase.storage
    .from('avatars')
    .upload(filePath, file, { upsert: true })

  if (uploadError) {
    console.error('[profileService.uploadAvatar]', uploadError)
    return { url: null, error: uploadError }
  }

  const { data } = supabase.storage.from('avatars').getPublicUrl(filePath)
  return { url: data.publicUrl, error: null }
}

export async function addExperience(userId, experience) {
  const { data, error } = await supabase
    .from('user_experiences')
    .insert({ user_id: userId, ...experience })
    .select()
    .single()

  if (error) console.error('[profileService.addExperience]', error)
  return { data, error }
}

export async function updateExperience(experienceId, updates) {
  const { data, error } = await supabase
    .from('user_experiences')
    .update(updates)
    .eq('id', experienceId)
    .select()
    .single()

  if (error) console.error('[profileService.updateExperience]', error)
  return { data, error }
}

export async function deleteExperience(experienceId) {
  const { error } = await supabase
    .from('user_experiences')
    .delete()
    .eq('id', experienceId)

  if (error) console.error('[profileService.deleteExperience]', error)
  return { error }
}

export const PREDEFINED_SKILLS = [
  'Natural Language Processing', 'Computer Vision', 'PyTorch', 'TensorFlow',
  'Transformer Architecture', 'Vector Databases', 'Python', 'CUDA', 'Rust',
  'Go', 'Docker', 'Kubernetes', 'FastAPI', 'React', 'Named Entity Recognition',
  'Automatic Speech Recognition', 'Text Classification', 'Data Annotation',
  'MLOps', 'Fine-tuning', 'Prompt Engineering',
]