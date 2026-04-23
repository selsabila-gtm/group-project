import { Link, useLocation } from "react-router-dom"

const NAV_LINKS = [
  { label: 'Competitions', href: '#competitions' },
  { label: 'Datasets', href: '#datasets' },
  { label: 'Leaderboards', href: '#leaderboards' },
  { label: 'Benchmarks', href: '#benchmarks' },
]

export default function Navbar() {
  const token = localStorage.getItem("token")
  const location = useLocation()

  return (
    <nav style={{
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      padding: '0 60px',
      height: '60px',
      background: '#fff',
      borderBottom: '1px solid #e8eaf2',
      position: 'sticky',
      top: 0,
      zIndex: 100,
    }}>
      {/* Logo */}
      <div>
        <Link to="/" style={{
          fontSize: '16px',
          fontWeight: 700,
          color: '#0d0e14',
          textDecoration: 'none',
          letterSpacing: '-0.3px',
        }}>
          Lexivia
        </Link>
      </div>

      {/* Nav links */}
      <div style={{ display: 'flex', gap: '32px', alignItems: 'center' }}>
        {NAV_LINKS.map((link) => {
          const isActive = link.href === '#competitions'
          return (
            <a
              key={link.label}
              href={link.href}
              style={{
                fontSize: '14px',
                color: isActive ? '#1a2fff' : '#6b7590',
                textDecoration: 'none',
                fontWeight: isActive ? 500 : 400,
                borderBottom: isActive ? '2px solid #1a2fff' : '2px solid transparent',
                paddingBottom: '2px',
              }}
            >
              {link.label}
            </a>
          )
        })}
      </div>

      {/* Auth */}
      <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
        {token ? (
          <Link to="/profile" style={{
            background: '#0d0e14',
            color: '#fff',
            padding: '8px 18px',
            borderRadius: '7px',
            textDecoration: 'none',
            fontSize: '14px',
            fontWeight: 500,
          }}>Profile</Link>
        ) : (
          <>
            <Link to="/login" style={{
              fontSize: '14px',
              color: '#1d2333',
              textDecoration: 'none',
              fontWeight: 400,
            }}>Log In</Link>
            <Link to="/signup" style={{
              background: '#0d0e14',
              color: '#fff',
              padding: '8px 18px',
              borderRadius: '7px',
              textDecoration: 'none',
              fontSize: '14px',
              fontWeight: 500,
            }}>Sign Up</Link>
          </>
        )}
      </div>
    </nav>
  )
}