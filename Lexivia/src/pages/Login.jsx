import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { signIn, signInWithGoogle, signInWithGithub } from '../lib/auth.js'
import styles from './Auth.module.css'

export default function Login() {
  const navigate = useNavigate()
  const [form, setForm] = useState({ email: '', password: '' })
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleChange = (e) => {
    setForm((f) => ({ ...f, [e.target.name]: e.target.value }))
    setError('')
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      await signIn({ email: form.email, password: form.password })
      navigate('/dashboard')
    } catch (err) {
      setError(err.message || 'Authentication failed. Check your credentials.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className={styles.page}>
      {/* Left ambient panel */}
      <div className={styles.ambient}>
        <div className={styles.ambientGrid} />
        <div className={styles.ambientGlow} />
        <div className={styles.brandPanel}>
          <span className={styles.brandIcon}>⬡</span>
          <h2>Precision Architect</h2>
          <p>The elite proving ground for natural language processing research and model evaluation.</p>
          <div className={styles.statsRow}>
            <div><strong>12k+</strong><span>Researchers</span></div>
            <div><strong>450+</strong><span>Active Models</span></div>
            <div><strong>98%</strong><span>Uptime</span></div>
          </div>
        </div>
      </div>

      {/* Right form panel */}
      <div className={styles.formPanel}>
        <div className={styles.formCard}>
          {/* Protocol badge */}
          <div className={styles.cardHeader}>
            <div className={styles.protocol}>
              <span className={styles.protocolDot} />
              AUTHENTICATION PROTOCOL v4.0
            </div>
          </div>

          <div className={styles.cardBody}>
            <h1 className={styles.cardTitle}>Access Workspace</h1>
            <p className={styles.cardSub}>Please enter your research credentials</p>

            {error && <div className={styles.errorBanner}>{error}</div>}

            <form onSubmit={handleSubmit} className={styles.form}>
              <div className={styles.field}>
                <label className={styles.label}>EMAIL ADDRESS</label>
                <div className={styles.inputWrap}>
                  <span className={styles.inputIcon}>✉</span>
                  <input
                    name="email"
                    type="email"
                    placeholder="researcher@precision.arch"
                    value={form.email}
                    onChange={handleChange}
                    className={styles.input}
                    required
                    autoComplete="email"
                  />
                </div>
              </div>

              <div className={styles.field}>
                <div className={styles.labelRow}>
                  <label className={styles.label}>SECURITY CIPHER</label>
                  <button type="button" className={styles.resetLink} tabIndex={-1}>
                    Reset Cipher?
                  </button>
                </div>
                <div className={styles.inputWrap}>
                  <input
                    name="password"
                    type={showPassword ? 'text' : 'password'}
                    placeholder="············"
                    value={form.password}
                    onChange={handleChange}
                    className={styles.input}
                    required
                    autoComplete="current-password"
                  />
                  <button
                    type="button"
                    className={styles.togglePw}
                    onClick={() => setShowPassword((v) => !v)}
                    tabIndex={-1}
                    aria-label="Toggle password visibility"
                  >
                    {showPassword ? '○' : '●'}
                  </button>
                </div>
              </div>

              <button type="submit" className={styles.submitBtn} disabled={loading}>
                {loading ? (
                  <span className={styles.spinner} />
                ) : (
                  <>Initialize Login <span className={styles.arrow}>→</span></>
                )}
              </button>
            </form>

            <p className={styles.switchText}>
              New investigator?{' '}
              <Link to="/signup" className={styles.switchLink}>Sign Up</Link>
            </p>
          </div>

          {/* Footer meta */}
          <div className={styles.cardFooter}>
            <span>CHANNEL: 9903</span>
            <span>LATENCY: 12MS</span>
            <span>ENCRYPTION: AES-256</span>
          </div>
        </div>

        <p className={styles.legalNote}>
          © 2024 Precision Architect NLP. All rights reserved.
        </p>
      </div>
    </div>
  )
}