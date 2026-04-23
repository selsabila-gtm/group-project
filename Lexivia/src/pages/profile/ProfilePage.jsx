import React, { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { getFullProfile } from '../../services/profileService'
import ProfileOverview from '../../components/profile/ProfileOverview'
import './ProfilePage.css'

export default function ProfilePage() {
  const { userId: paramUserId } = useParams()

  // TODO: replace this with your real auth context
  // const { currentUser } = useAuth()
  // const userId = paramUserId || currentUser?.supabaseId
  const userId = paramUserId || 'PLACEHOLDER_USER_ID'

  const [profileData, setProfileData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (!userId || userId === 'PLACEHOLDER_USER_ID') return
    async function loadProfile() {
      setLoading(true)
      const { data, error } = await getFullProfile(userId)
      if (error) setError('Failed to load profile. Please try again.')
      else setProfileData(data)
      setLoading(false)
    }
    loadProfile()
  }, [userId])

  if (loading) {
    return (
      <div className="profile-page-loading">
        <div className="loading-spinner" />
        <p>Loading profile…</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="profile-page-error">
        <p>{error}</p>
        <button onClick={() => window.location.reload()}>Retry</button>
      </div>
    )
  }

  if (!profileData) return null

  const isOwnProfile = !paramUserId

  return (
    <div className="profile-page">
      {isOwnProfile && (
        <div className="profile-page__actions">
          <Link to="/profile/settings" className="btn btn--secondary">
            Edit Profile
          </Link>
        </div>
      )}
      <ProfileOverview profileData={profileData} />
    </div>
  )
}