import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { signUp, signInWithGoogle, signInWithGithub } from '../lib/auth.js'
import styles from './Auth.module.css'

export default function Signup() {
  const navigate = useNavigate()
  const [form, setForm] = useState({ fullName: '', email: '', password: '', confirm: '' })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)

  const handleChange = (e) => {
    setForm((f) => ({ ...f, [e.target.name]: e.target.value }))
    setError('')
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (form.password !== form.confirm) {
      setError('Passwords do not match.')
      return
    }
    if (form.password.length < 6) {
      setError('Password must be at least 6 characters.')
      return
    }
    setLoading(true)
    setError('')
    try {
      await signUp({ fullName: form.fullName, email: form.email, password: form.password })
      setSuccess(true)
    } catch (err) {
      setError(err.message || 'Registration failed. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className={`${styles.page} ${styles.signupPage}`}>
      {/* Left form panel for signup */}
      <div className={styles.formPanel}>
        <div className={`${styles.formCard} ${styles.signupCard}`}>
          <div className={styles.cardBody}>
            <p className={styles.protocolTag}>REGISTRATION TERMINAL</p>
            <h1 className={styles.cardTitle}>Create Account</h1>
            <p className={styles.cardSub}>Initialize your precision workspace environment.</p>

            {error && <div className={styles.errorBanner}>{error}</div>}

            {success ? (
              <div className={styles.successBanner}>
                <strong>✓ Account created!</strong><br />
                Check your email to confirm your address, then{' '}
                <Link to="/login" className={styles.switchLink}>log in</Link>.
              </div>
            ) : (
              <form onSubmit={handleSubmit} className={styles.form}>
                <div className={styles.field}>
                  <label className={styles.label}>FULL NAME</label>
                  <div className={styles.inputWrap}>
                    <span className={styles.inputIcon}>◈</span>
                    <input
                      name="fullName"
                      type="text"
                      placeholder="Nikola Tesla"
                      value={form.fullName}
                      onChange={handleChange}
                      className={styles.input}
                      required
                      autoComplete="name"
                    />
                  </div>
                </div>

                <div className={styles.field}>
                  <label className={styles.label}>EMAIL ADDRESS</label>
                  <div className={styles.inputWrap}>
                    <span className={styles.inputIcon}>✉</span>
                    <input
                      name="email"
                      type="email"
                      placeholder="researcher@lab.precision.ai"
                      value={form.email}
                      onChange={handleChange}
                      className={styles.input}
                      required
                      autoComplete="email"
                    />
                  </div>
                </div>

                <div className={styles.fieldRow}>
                  <div className={styles.field}>
                    <label className={styles.label}>PASSWORD</label>
                    <div className={styles.inputWrap}>
                      <span className={styles.inputIcon}>⬡</span>
                      <input
                        name="password"
                        type="password"
                        placeholder="··········"
                        value={form.password}
                        onChange={handleChange}
                        className={styles.input}
                        required
                        autoComplete="new-password"
                      />
                    </div>
                  </div>
                  <div className={styles.field}>
                    <label className={styles.label}>CONFIRM</label>
                    <div className={styles.inputWrap}>
                      <span className={styles.inputIcon}>⬡</span>
                      <input
                        name="confirm"
                        type="password"
                        placeholder="··········"
                        value={form.confirm}
                        onChange={handleChange}
                        className={styles.input}
                        required
                        autoComplete="new-password"
                      />
                    </div>
                  </div>
                </div>

                <button type="submit" className={styles.submitBtn} disabled={loading}>
                  {loading ? (
                    <span className={styles.spinner} />
                  ) : (
                    <>Join the Laboratory <span className={styles.userIcon}>◈</span></>
                  )}
                </button>
              </form>
            )}

            {!success && (
              <>
                <div className={styles.divider}>
                  <span>SYSTEM AUTH</span>
                </div>
                <div className={styles.oauthRow}>
                  <button
                    type="button"
                    className={styles.oauthBtn}
                    onClick={signInWithGoogle}
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                    </svg>
                    Google
                  </button>
                  <button
                    type="button"
                    className={styles.oauthBtn}
                    onClick={signInWithGithub}
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0 0 24 12c0-6.63-5.37-12-12-12z"/>
                    </svg>
                    GitHub
                  </button>
                </div>
              </>
            )}

            <p className={styles.switchText}>
              Already part of the network?{' '}
              <Link to="/login" className={styles.switchLink}>Login to Terminal</Link>
            </p>
          </div>
        </div>

        <p className={styles.legalNote}>
          © 2024 Precision Architect NLP. All rights reserved.
          {' · '}
          <a href="#">Privacy Policy</a>
          {' · '}
          <a href="#">Terms of Service</a>
          {' · '}
          <a href="#">Security</a>
        </p>
      </div>

      {/* Right ambient panel */}
      <div className={`${styles.ambient} ${styles.ambientRight}`}>
        <div className={styles.ambientGrid} />
        <div className={styles.ambientGlow} />
        <div className={styles.brandPanel}>
          <span className={styles.brandIcon}>⬡</span>
          <h2>Precision Architect</h2>
          <p>Join thousands of researchers pushing the boundaries of NLP evaluation on the world's most rigorous benchmarking platform.</p>
          <ul className={styles.benefitList}>
            <li>✓ Integrated JupyterLab environment</li>
            <li>✓ H100/A100 compute clusters</li>
            <li>✓ Real-time global leaderboards</li>
            <li>✓ Private & public competitions</li>
          </ul>
        </div>
      </div>
    </div>
  )
}