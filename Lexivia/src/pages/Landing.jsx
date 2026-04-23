import { Link } from 'react-router-dom'
import Navbar from '../components/Navbar'

// ── Trusted-by ticker logos ────────────────────────────────────────────────
const LOGOS = ['NEURAL_CORE', 'LEXICON.AI', 'SYNTAX LABS', 'OPUS RESEARCH', 'VECTOR NLP']

// ── "Who's on" cards ───────────────────────────────────────────────────────
const WHO_CARDS = [
  {
    icon: '⚙',
    iconBg: '#eef0ff',
    iconColor: '#4458f5',
    title: 'AI Builders',
    desc: 'Engineers looking to stress-test production models against rigorous benchmarks and edge cases.',
  },
  {
    icon: '⚗',
    iconBg: '#fff4ec',
    iconColor: '#e8621a',
    title: 'Research Organizations',
    desc: 'Laboratories hosting private tournaments to crowdsource novel solutions for proprietary datasets.',
  },
  {
    icon: '◈',
    iconBg: '#edf8f3',
    iconColor: '#1a8f57',
    title: 'Data Scientists',
    desc: 'Specialists competing for global rankings and recognition in specialized NLP domains like low-resource translation.',
  },
]

// ── Workflow steps ─────────────────────────────────────────────────────────
const STEPS = [
  {
    num: '01',
    title: 'Join Tournament',
    desc: 'Select from open-source challenges or private industrial benchmarks focused on NER, QA, or summarization.',
  },
  {
    num: '02',
    title: 'Annotate Data',
    desc: 'Use our integrated precision tools to refine datasets or provide human-in-the-loop feedback on model outputs.',
  },
  {
    num: '03',
    title: 'Train & Experiment',
    desc: 'Spin up H100/A100 clusters directly from our environment with pre-configured NLP library stacks.',
  },
  {
    num: '04',
    title: 'Submit & Rank',
    desc: 'Validate models against hidden test sets and watch your position move on the global leaderboard in real-time.',
  },
]

// ── Platform features ──────────────────────────────────────────────────────
const FEATURES = [
  {
    icon: '✦',
    title: 'High-Precision Annotation',
    desc: 'Tools optimized for semantic role labeling and dependency parsing at scale.',
  },
  {
    icon: '⬡',
    title: 'Fair Resource Scaling',
    desc: 'H100/A100 clusters distributed dynamically to ensure competition fairness.',
  },
]

// ── Leaderboard mock rows ──────────────────────────────────────────────────
const LB_ROWS = [
  { rank: '#1', group: 'DeepSynthetics Lab', score: '0.9842', badge: 'gold' },
  { rank: '#2', group: 'Oxford Semantic Group', score: '0.9711', badge: 'silver' },
]

// ── Footer links ───────────────────────────────────────────────────────────
const FOOTER = {
  Resources: ['Documentation', 'API Reference', 'Community Forum'],
  Platform: ['Leaderboards', 'Active Datasets', 'Compute Credits'],
  Legal: ['Privacy Policy', 'Terms of Service', 'Contact Support'],
}

export default function Landing() {
  return (
    <div style={{ minHeight: '100vh', background: '#f6f7fb', fontFamily: 'Inter, Arial, sans-serif' }}>
      <Navbar />

      {/* ── HERO ─────────────────────────────────────────────────────── */}
      <section style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '80px 60px 60px',
        maxWidth: '1200px',
        margin: '0 auto',
        gap: '40px',
      }}>
        <div style={{ flex: 1, maxWidth: '560px' }}>
          <span style={{
            display: 'inline-block',
            fontSize: '11px',
            fontWeight: 600,
            letterSpacing: '1.5px',
            color: '#1a2fff',
            background: '#eef0ff',
            padding: '4px 10px',
            borderRadius: '4px',
            marginBottom: '24px',
          }}>NLP FRONTIER LAB</span>

          <h1 style={{
            fontSize: '52px',
            fontWeight: 700,
            lineHeight: 1.1,
            letterSpacing: '-1.5px',
            margin: '0 0 24px',
            color: '#0d0e14',
          }}>
            The Elite<br />
            Proving<br />
            Ground for <span style={{ color: '#1a2fff' }}>NLP</span><br />
            <span style={{ color: '#1a2fff' }}>Research</span>
          </h1>

          <p style={{ fontSize: '15px', color: '#555e7a', lineHeight: 1.6, marginBottom: '32px' }}>
            Push the boundaries of Natural Language Processing. Deploy models,<br />
            compete for global rankings, and optimize precision metrics<br />
            across diverse data domains.
          </p>

          <div style={{ display: 'flex', gap: '12px', marginBottom: '48px' }}>
            <Link to="/signup" style={{
              background: '#1a2fff',
              color: '#fff',
              padding: '11px 22px',
              borderRadius: '7px',
              textDecoration: 'none',
              fontSize: '14px',
              fontWeight: 500,
            }}>Explore Competitions →</Link>
            <a href="#datasets" style={{
              background: '#fff',
              color: '#1d2333',
              padding: '11px 22px',
              borderRadius: '7px',
              textDecoration: 'none',
              fontSize: '14px',
              fontWeight: 500,
              border: '1px solid #e3e6ef',
            }}>View Datasets</a>
          </div>

          <div style={{ display: 'flex', gap: '40px' }}>
            <div>
              <strong style={{ fontSize: '22px', fontWeight: 700, color: '#0d0e14', display: 'block' }}>12k+</strong>
              <span style={{ fontSize: '11px', letterSpacing: '1px', color: '#8892a4' }}>RESEARCHERS</span>
            </div>
            <div>
              <strong style={{ fontSize: '22px', fontWeight: 700, color: '#0d0e14', display: 'block' }}>450+</strong>
              <span style={{ fontSize: '11px', letterSpacing: '1px', color: '#8892a4' }}>ACTIVE MODELS</span>
            </div>
          </div>
        </div>

        {/* Hero visual */}
        <div style={{
          flex: '0 0 auto',
          width: '280px',
          height: '280px',
          background: '#0d0e14',
          borderRadius: '20px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          position: 'relative',
          overflow: 'hidden',
          boxShadow: '0 30px 80px rgba(26,47,255,0.2)',
        }}>
          <div style={{
            position: 'absolute', inset: 0,
            background: 'radial-gradient(circle at 50% 50%, rgba(26,47,255,0.25) 0%, transparent 70%)',
          }} />
          <svg viewBox="0 0 260 260" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ width: '220px', height: '220px', position: 'relative', zIndex: 1 }}>
            <line x1="130" y1="130" x2="60" y2="60" stroke="#1a2fff" strokeWidth="1" strokeOpacity="0.5"/>
            <line x1="130" y1="130" x2="200" y2="60" stroke="#1a2fff" strokeWidth="1" strokeOpacity="0.5"/>
            <line x1="130" y1="130" x2="50" y2="180" stroke="#1a2fff" strokeWidth="1" strokeOpacity="0.5"/>
            <line x1="130" y1="130" x2="210" y2="180" stroke="#1a2fff" strokeWidth="1" strokeOpacity="0.5"/>
            <line x1="130" y1="130" x2="130" y2="30" stroke="#1a2fff" strokeWidth="1" strokeOpacity="0.4"/>
            <line x1="130" y1="130" x2="130" y2="230" stroke="#1a2fff" strokeWidth="1" strokeOpacity="0.3"/>
            <line x1="60" y1="60" x2="130" y2="30" stroke="#1a2fff" strokeWidth="0.5" strokeOpacity="0.3"/>
            <line x1="200" y1="60" x2="130" y2="30" stroke="#1a2fff" strokeWidth="0.5" strokeOpacity="0.3"/>
            <circle cx="60" cy="60" r="8" fill="#0d0e14" stroke="#1a2fff" strokeWidth="1.5" strokeOpacity="0.8"/>
            <circle cx="200" cy="60" r="8" fill="#0d0e14" stroke="#1a2fff" strokeWidth="1.5" strokeOpacity="0.8"/>
            <circle cx="50" cy="180" r="8" fill="#0d0e14" stroke="#1a2fff" strokeWidth="1.5" strokeOpacity="0.8"/>
            <circle cx="210" cy="180" r="8" fill="#0d0e14" stroke="#1a2fff" strokeWidth="1.5" strokeOpacity="0.8"/>
            <circle cx="130" cy="30" r="6" fill="#0d0e14" stroke="#1a2fff" strokeWidth="1.5" strokeOpacity="0.6"/>
            <circle cx="130" cy="230" r="6" fill="#0d0e14" stroke="#1a2fff" strokeWidth="1.5" strokeOpacity="0.5"/>
            <circle cx="130" cy="130" r="36" fill="none" stroke="#1a2fff" strokeWidth="0.75" strokeOpacity="0.35"/>
            <circle cx="130" cy="130" r="18" fill="#1a2fff" fillOpacity="0.18" stroke="#1a2fff" strokeWidth="1.5"/>
            <circle cx="130" cy="130" r="8" fill="#1a2fff"/>
          </svg>
        </div>
      </section>

      {/* ── TICKER ───────────────────────────────────────────────────── */}
      <div style={{
        borderTop: '1px solid #e8eaf2',
        borderBottom: '1px solid #e8eaf2',
        padding: '28px 60px',
        textAlign: 'center',
        background: '#fff',
      }}>
        <p style={{ fontSize: '11px', letterSpacing: '1.5px', color: '#8892a4', marginBottom: '16px' }}>
          TRUSTED BY GLOBAL RESEARCH ORGANIZATIONS
        </p>
        <div style={{ display: 'flex', justifyContent: 'center', gap: '48px', flexWrap: 'wrap' }}>
          {LOGOS.map((l, i) => (
            <span key={i} style={{
              fontSize: '12px',
              letterSpacing: '1.2px',
              color: '#b0b8cc',
              fontWeight: 500,
              border: '1px solid #e3e6ef',
              padding: '6px 16px',
              borderRadius: '4px',
            }}>{l}</span>
          ))}
        </div>
      </div>

      {/* ── WHO'S ON ─────────────────────────────────────────────────── */}
      <section style={{ padding: '80px 60px', maxWidth: '1200px', margin: '0 auto' }} id="competitions">
        <h2 style={{ fontSize: '28px', fontWeight: 700, color: '#0d0e14', marginBottom: '8px' }}>
          Who's on Precision Architect?
        </h2>
        <p style={{ fontSize: '15px', color: '#555e7a', marginBottom: '48px' }}>
          A multi-disciplinary ecosystem designed for high-stakes natural language evaluation.
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '20px' }}>
          {WHO_CARDS.map((c) => (
            <div key={c.title} style={{
              background: '#fff',
              borderRadius: '12px',
              padding: '28px',
              border: '1px solid #e8eaf2',
            }}>
              <span style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: '40px',
                height: '40px',
                borderRadius: '10px',
                background: c.iconBg,
                color: c.iconColor,
                fontSize: '18px',
                marginBottom: '16px',
              }}>{c.icon}</span>
              <h3 style={{ fontSize: '16px', fontWeight: 600, color: '#0d0e14', margin: '0 0 8px' }}>{c.title}</h3>
              <p style={{ fontSize: '14px', color: '#6b7590', lineHeight: 1.6 }}>{c.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── WORKFLOW ─────────────────────────────────────────────────── */}
      <section style={{
        background: '#fff',
        padding: '80px 60px',
      }} id="datasets">
        <div style={{ maxWidth: '1200px', margin: '0 auto', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '60px', alignItems: 'start' }}>
          {/* Left */}
          <div>
            <h2 style={{ fontSize: '28px', fontWeight: 700, color: '#0d0e14', margin: '0 0 8px' }}>The Workflow</h2>
            <p style={{ fontSize: '14px', color: '#6b7590', lineHeight: 1.6, marginBottom: '32px' }}>
              From data ingestion to model deployment, our platform provides a seamless scientific pipeline.
            </p>
            {/* Dashboard mockup */}
            <div style={{
              background: '#0d0e14',
              borderRadius: '12px',
              padding: '20px',
              height: '180px',
              display: 'flex',
              flexDirection: 'column',
              gap: '10px',
              justifyContent: 'center',
            }}>
              {[80, 60, 90, 45].map((w, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <div style={{
                    height: '10px',
                    width: `${w}%`,
                    background: i === 2 ? '#1a2fff' : 'rgba(26,47,255,0.3)',
                    borderRadius: '3px',
                  }} />
                </div>
              ))}
              <div style={{ height: '1px', background: 'rgba(26,47,255,0.2)', marginTop: '6px' }} />
            </div>
          </div>

          {/* Steps */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0' }}>
            {STEPS.map((s, i) => (
              <div key={s.num} style={{
                display: 'flex',
                gap: '20px',
                padding: '20px',
                borderLeft: i === 0 ? '3px solid #1a2fff' : '3px solid #e8eaf2',
                marginBottom: '4px',
                background: i === 0 ? '#f6f7ff' : 'transparent',
                borderRadius: '0 8px 8px 0',
              }}>
                <span style={{
                  fontSize: '24px',
                  fontWeight: 700,
                  color: i === 0 ? '#1a2fff' : '#c8cfe0',
                  minWidth: '40px',
                }}>{s.num}</span>
                <div>
                  <h4 style={{ fontSize: '15px', fontWeight: 600, color: '#0d0e14', margin: '0 0 4px' }}>{s.title}</h4>
                  <p style={{ fontSize: '13px', color: '#6b7590', lineHeight: 1.6, margin: 0 }}>{s.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── PLATFORM FEATURES ────────────────────────────────────────── */}
      <section style={{ padding: '80px 60px', maxWidth: '1200px', margin: '0 auto' }} id="benchmarks">
        <h2 style={{ fontSize: '28px', fontWeight: 700, color: '#0d0e14', marginBottom: '40px', textAlign: 'center' }}>
          Platform Features
        </h2>
        <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr', gap: '20px', marginBottom: '20px' }}>
          {/* JupyterLab card */}
          <div style={{
            background: '#0d0e14',
            borderRadius: '16px',
            padding: '32px',
            color: '#fff',
          }}>
            {/* Terminal mockup */}
            <div style={{ marginBottom: '24px' }}>
              <div style={{ display: 'flex', gap: '6px', marginBottom: '12px' }}>
                <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#ff5f57' }} />
                <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#febc2e' }} />
                <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#28c840' }} />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {[70, 50, 85, 40].map((w, i) => (
                  <div key={i} style={{
                    height: '8px',
                    width: `${w}%`,
                    background: 'rgba(26,47,255,0.4)',
                    borderRadius: '3px',
                  }} />
                ))}
              </div>
            </div>
            <h3 style={{ fontSize: '18px', fontWeight: 600, margin: '0 0 10px', color: '#fff' }}>Integrated JupyterLab</h3>
            <p style={{ fontSize: '13px', color: '#8892a4', lineHeight: 1.6, marginBottom: '20px' }}>
              A fully-featured IDE living within your competition workspace. Zero-latency connection to high-performance compute clusters.
            </p>
            <div style={{ display: 'flex', gap: '8px' }}>
              {['CUDA SUPPORT', 'PRE-INSTALLED PYTORCH'].map(tag => (
                <span key={tag} style={{
                  fontSize: '10px',
                  letterSpacing: '0.8px',
                  color: '#8892a4',
                  border: '1px solid rgba(255,255,255,0.1)',
                  padding: '4px 10px',
                  borderRadius: '4px',
                }}>{tag}</span>
              ))}
            </div>
          </div>

          {/* Feature cards */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            {FEATURES.map((f) => (
              <div key={f.title} style={{
                background: '#f0f2ff',
                borderRadius: '16px',
                padding: '24px',
                display: 'flex',
                gap: '16px',
                alignItems: 'flex-start',
              }}>
                <span style={{
                  fontSize: '22px',
                  color: '#1a2fff',
                  display: 'block',
                  minWidth: '28px',
                }}>{f.icon}</span>
                <div>
                  <h4 style={{ fontSize: '15px', fontWeight: 600, color: '#0d0e14', margin: '0 0 6px' }}>{f.title}</h4>
                  <p style={{ fontSize: '13px', color: '#6b7590', lineHeight: 1.5, margin: 0 }}>{f.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Global Leaderboard */}
        <div style={{
          background: '#fff',
          borderRadius: '16px',
          padding: '32px',
          border: '1px solid #e8eaf2',
          display: 'grid',
          gridTemplateColumns: '1fr 1.5fr',
          gap: '40px',
          alignItems: 'center',
        }} id="leaderboards">
          <div>
            <h3 style={{ fontSize: '20px', fontWeight: 700, color: '#0d0e14', margin: '0 0 8px' }}>Global Leaderboard</h3>
            <p style={{ fontSize: '13px', color: '#6b7590', lineHeight: 1.6, margin: 0 }}>
              Real-time precision metrics tracking across all active participants. Get historical insights and model comparison statistics instantly.
            </p>
          </div>
          <div>
            <div style={{
              display: 'grid',
              gridTemplateColumns: '60px 1fr 80px',
              padding: '10px 16px',
              fontSize: '11px',
              letterSpacing: '1px',
              color: '#8892a4',
              borderBottom: '1px solid #e8eaf2',
            }}>
              <span>RANK</span>
              <span>RESEARCH GROUP</span>
              <span style={{ textAlign: 'right' }}>SCORE</span>
            </div>
            {LB_ROWS.map((r) => (
              <div key={r.rank} style={{
                display: 'grid',
                gridTemplateColumns: '60px 1fr 80px',
                padding: '14px 16px',
                fontSize: '14px',
                alignItems: 'center',
                borderBottom: '1px solid #f0f2f8',
              }}>
                <span style={{ fontWeight: 700, color: '#0d0e14' }}>{r.rank}</span>
                <span style={{ color: '#1d2333' }}>{r.group}</span>
                <span style={{
                  background: r.badge === 'gold' ? '#c0392b' : '#c0392b',
                  color: '#fff',
                  fontSize: '12px',
                  fontWeight: 600,
                  padding: '2px 8px',
                  borderRadius: '4px',
                  textAlign: 'center',
                  background: r.badge === 'gold' ? '#e74c3c' : '#95a5a6',
                }}>{r.score}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA BAND ─────────────────────────────────────────────────── */}
      <section style={{
        background: '#eef0ff',
        padding: '80px 60px',
        textAlign: 'center',
      }}>
        <h2 style={{ fontSize: '36px', fontWeight: 700, color: '#0d0e14', marginBottom: '16px' }}>
          Ready to set the new standard?
        </h2>
        <p style={{ fontSize: '16px', color: '#555e7a', marginBottom: '36px' }}>
          Join the most prestigious NLP community and prove your model's<br />precision on the world stage.
        </p>
        <Link to="/signup" style={{
          display: 'inline-block',
          background: '#1a2fff',
          color: '#fff',
          padding: '14px 32px',
          borderRadius: '8px',
          textDecoration: 'none',
          fontSize: '15px',
          fontWeight: 600,
        }}>Join the Laboratory</Link>
      </section>

      {/* ── FOOTER ───────────────────────────────────────────────────── */}
      <footer style={{
        background: '#fff',
        borderTop: '1px solid #e8eaf2',
        padding: '60px 60px 30px',
      }}>
        <div style={{
          maxWidth: '1200px',
          margin: '0 auto',
          display: 'grid',
          gridTemplateColumns: '1.5fr 1fr 1fr 1fr',
          gap: '40px',
          marginBottom: '40px',
        }}>
          <div>
            <strong style={{ fontSize: '16px', color: '#0d0e14', display: 'block', marginBottom: '12px' }}>LEXIVIA</strong>
            <p style={{ fontSize: '13px', color: '#6b7590', lineHeight: 1.7, marginBottom: '16px' }}>
              Leading the world in NLP benchmarks, model evaluation, and decentralized research collaboration.
            </p>
            <div style={{ display: 'flex', gap: '10px' }}>
              <span style={{ fontSize: '18px', color: '#8892a4', cursor: 'pointer' }}>⬡</span>
              <span style={{ fontSize: '18px', color: '#8892a4', cursor: 'pointer' }}>◈</span>
            </div>
          </div>
          {Object.entries(FOOTER).map(([cat, links]) => (
            <div key={cat}>
              <strong style={{ fontSize: '11px', letterSpacing: '1.2px', color: '#0d0e14', display: 'block', marginBottom: '16px' }}>
                {cat.toUpperCase()}
              </strong>
              <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {links.map((l) => (
                  <li key={l}>
                    <a href="#" style={{ fontSize: '13px', color: '#6b7590', textDecoration: 'none' }}>{l}</a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <div style={{
          borderTop: '1px solid #e8eaf2',
          paddingTop: '24px',
          textAlign: 'center',
          fontSize: '12px',
          color: '#8892a4',
        }}>
          © 2024 Precision Architect NLP Labs. All rights reserved.
        </div>
      </footer>
    </div>
  )
}