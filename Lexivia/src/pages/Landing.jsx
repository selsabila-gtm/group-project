import { Link } from 'react-router-dom'
import Navbar from '../components/Navbar.jsx'
import styles from './Landing.module.css'

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
    <div className={styles.page}>
      <Navbar />

      {/* ── HERO ─────────────────────────────────────────────────────── */}
      <section className={styles.hero}>
        <div className={styles.heroContent}>
          <span className={styles.badge} style={{ animationDelay: '0s' }}>NLP FRONTIER LAB</span>
          <h1 className={styles.heroHeadline}>
            <span className={`${styles.fadeUp} ${styles.d1}`}>The Elite</span>
            <span className={`${styles.fadeUp} ${styles.d2}`}>Proving</span>
            <span className={`${styles.fadeUp} ${styles.d3}`}>
              Ground for <em className={styles.accentWord}>NLP</em>
            </span>
            <span className={`${styles.fadeUp} ${styles.accentWord} ${styles.d4}`}>Research</span>
          </h1>
          <p className={`${styles.heroSub} ${styles.fadeUp} ${styles.d3}`}>
            Push the boundaries of Natural Language Processing. Deploy models,<br />
            compete for global rankings, and optimize precision metrics<br />
            across diverse data domains.
          </p>
          <div className={`${styles.heroCtas} ${styles.fadeUp} ${styles.d4}`}>
            <Link to="/signup" className={styles.ctaPrimary}>Explore Competitions →</Link>
            <a href="#datasets" className={styles.ctaSecondary}>View Datasets</a>
          </div>

          {/* Stats */}
          <div className={`${styles.stats} ${styles.fadeUp} ${styles.d5}`}>
            <div className={styles.stat}>
              <strong>12k+</strong>
              <span>RESEARCHERS</span>
            </div>
            <div className={styles.stat}>
              <strong>450+</strong>
              <span>ACTIVE MODELS</span>
            </div>
          </div>
        </div>

        {/* Hero visual */}
        <div className={`${styles.heroVisual} ${styles.fadeUp} ${styles.d2}`}>
          <div className={styles.neuralCard}>
            <div className={styles.neuralGlow} />
            <svg className={styles.neuralSvg} viewBox="0 0 260 260" fill="none" xmlns="http://www.w3.org/2000/svg">
              {/* Connections */}
              <line x1="130" y1="130" x2="60" y2="60" stroke="#1a2fff" strokeWidth="1" strokeOpacity="0.4"/>
              <line x1="130" y1="130" x2="200" y2="60" stroke="#1a2fff" strokeWidth="1" strokeOpacity="0.4"/>
              <line x1="130" y1="130" x2="50" y2="180" stroke="#1a2fff" strokeWidth="1" strokeOpacity="0.4"/>
              <line x1="130" y1="130" x2="210" y2="180" stroke="#1a2fff" strokeWidth="1" strokeOpacity="0.4"/>
              <line x1="130" y1="130" x2="130" y2="30" stroke="#1a2fff" strokeWidth="1" strokeOpacity="0.4"/>
              <line x1="130" y1="130" x2="130" y2="230" stroke="#1a2fff" strokeWidth="1" strokeOpacity="0.3"/>
              <line x1="60" y1="60" x2="130" y2="30" stroke="#1a2fff" strokeWidth="0.5" strokeOpacity="0.25"/>
              <line x1="200" y1="60" x2="130" y2="30" stroke="#1a2fff" strokeWidth="0.5" strokeOpacity="0.25"/>
              <line x1="60" y1="60" x2="50" y2="180" stroke="#1a2fff" strokeWidth="0.5" strokeOpacity="0.2"/>
              <line x1="200" y1="60" x2="210" y2="180" stroke="#1a2fff" strokeWidth="0.5" strokeOpacity="0.2"/>
              {/* Outer nodes */}
              <circle cx="60" cy="60" r="8" fill="#0d0e14" stroke="#1a2fff" strokeWidth="1.5" strokeOpacity="0.7"/>
              <circle cx="200" cy="60" r="8" fill="#0d0e14" stroke="#1a2fff" strokeWidth="1.5" strokeOpacity="0.7"/>
              <circle cx="50" cy="180" r="8" fill="#0d0e14" stroke="#1a2fff" strokeWidth="1.5" strokeOpacity="0.7"/>
              <circle cx="210" cy="180" r="8" fill="#0d0e14" stroke="#1a2fff" strokeWidth="1.5" strokeOpacity="0.7"/>
              <circle cx="130" cy="30" r="6" fill="#0d0e14" stroke="#1a2fff" strokeWidth="1.5" strokeOpacity="0.5"/>
              <circle cx="130" cy="230" r="6" fill="#0d0e14" stroke="#1a2fff" strokeWidth="1.5" strokeOpacity="0.5"/>
              {/* Inner ring */}
              <circle cx="130" cy="130" r="36" fill="none" stroke="#1a2fff" strokeWidth="0.75" strokeOpacity="0.3"/>
              {/* Center node */}
              <circle cx="130" cy="130" r="18" fill="#1a2fff" fillOpacity="0.15" stroke="#1a2fff" strokeWidth="1.5"/>
              <circle cx="130" cy="130" r="8" fill="#1a2fff"/>
              {/* Pulse ring */}
              <circle cx="130" cy="130" r="28" fill="none" stroke="#1a2fff" strokeWidth="1" strokeOpacity="0.2" className={styles.pulseRing}/>
            </svg>
          </div>
        </div>
      </section>

      {/* ── TICKER ───────────────────────────────────────────────────── */}
      <div className={styles.tickerWrapper}>
        <p className={styles.tickerLabel}>TRUSTED BY GLOBAL RESEARCH ORGANIZATIONS</p>
        <div className={styles.tickerTrack}>
          <div className={styles.tickerInner}>
            {[...LOGOS, ...LOGOS].map((l, i) => (
              <span key={i} className={styles.tickerItem}>{l}</span>
            ))}
          </div>
        </div>
      </div>

      {/* ── WHO'S ON ─────────────────────────────────────────────────── */}
      <section className={styles.section} id="competitions">
        <div className={styles.container}>
          <div className={styles.sectionHeader}>
            <h2 className={styles.sectionTitle}>Who's on Precision Architect?</h2>
            <p className={styles.sectionSub}>A multi-disciplinary ecosystem designed for high-stakes natural language evaluation.</p>
          </div>
          <div className={styles.whoGrid}>
            {WHO_CARDS.map((c) => (
              <div key={c.title} className={styles.whoCard}>
                <span className={styles.whoIcon} style={{ background: c.iconBg, color: c.iconColor }}>{c.icon}</span>
                <h3>{c.title}</h3>
                <p>{c.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── WORKFLOW ─────────────────────────────────────────────────── */}
      <section className={styles.workflowSection} id="datasets">
        <div className={styles.container}>
          <div className={styles.workflowLayout}>
            {/* Left */}
            <div className={styles.workflowLeft}>
              <h2 className={styles.sectionTitle}>The Workflow</h2>
              <p className={styles.sectionSub}>From data ingestion to model deployment, our platform provides a seamless scientific pipeline.</p>
              {/* Dashboard mockup */}
              <div className={styles.dashMock}>
                <div className={styles.dashBar} style={{ width: '80%' }} />
                <div className={styles.dashBar} style={{ width: '60%' }} />
                <div className={styles.dashBar} style={{ width: '90%' }} />
                <div className={styles.dashBar} style={{ width: '45%' }} />
                <div className={styles.dashLine} />
              </div>
            </div>
            {/* Steps */}
            <div className={styles.steps}>
              {STEPS.map((s, i) => (
                <div key={s.num} className={`${styles.step} ${i === 0 ? styles.stepActive : ''}`}>
                  <span className={styles.stepNum}>{s.num}</span>
                  <div>
                    <h4>{s.title}</h4>
                    <p>{s.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── PLATFORM FEATURES ────────────────────────────────────────── */}
      <section className={styles.section} id="benchmarks">
        <div className={styles.container}>
          <h2 className={`${styles.sectionTitle} ${styles.centered}`}>Platform Features</h2>
          <div className={styles.featuresLayout}>
            {/* JupyterLab card */}
            <div className={styles.jupyterCard}>
              <div className={styles.jupyterTerminal}>
                <div className={styles.terminalDots}>
                  <span /><span /><span />
                </div>
                <div className={styles.terminalLines}>
                  <span className={styles.tLine} style={{ width: '70%' }}/>
                  <span className={styles.tLine} style={{ width: '50%' }}/>
                  <span className={styles.tLine} style={{ width: '85%' }}/>
                  <span className={styles.tLine} style={{ width: '40%' }}/>
                </div>
              </div>
              <h3>Integrated JupyterLab</h3>
              <p>A fully-featured IDE living within your competition workspace. Zero-latency connection to high-performance compute clusters.</p>
              <div className={styles.tags}>
                <span>CUDA SUPPORT</span>
                <span>PRE-INSTALLED PYTORCH</span>
              </div>
            </div>

            {/* Feature cards */}
            <div className={styles.featureCards}>
              {FEATURES.map((f) => (
                <div key={f.title} className={styles.featureCard}>
                  <span className={styles.featureIcon}>{f.icon}</span>
                  <div>
                    <h4>{f.title}</h4>
                    <p>{f.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Global Leaderboard */}
          <div className={styles.leaderboard} id="leaderboards">
            <div className={styles.lbLeft}>
              <h3>Global Leaderboard</h3>
              <p>Real-time precision metrics tracking across all active participants. Get historical insights and model comparison statistics instantly.</p>
            </div>
            <div className={styles.lbTable}>
              <div className={styles.lbHeader}>
                <span>RANK</span>
                <span>RESEARCH GROUP</span>
                <span>SCORE</span>
              </div>
              {LB_ROWS.map((r) => (
                <div key={r.rank} className={styles.lbRow}>
                  <span className={styles.lbRank}>{r.rank}</span>
                  <span>{r.group}</span>
                  <span className={`${styles.lbScore} ${styles[r.badge]}`}>{r.score}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── CTA BAND ─────────────────────────────────────────────────── */}
      <section className={styles.ctaBand}>
        <div className={styles.ctaBandInner}>
          <h2>Ready to set the new standard?</h2>
          <p>Join the most prestigious NLP community and prove your model's precision on the world stage.</p>
          <Link to="/signup" className={styles.ctaPrimary}>Join the Laboratory</Link>
        </div>
      </section>

      {/* ── FOOTER ───────────────────────────────────────────────────── */}
      <footer className={styles.footer}>
        <div className={styles.footerInner}>
          <div className={styles.footerBrand}>
            <strong>Precision Architect</strong>
            <p>Leading the world in NLP benchmarks, model evaluation, and decentralized research collaboration.</p>
            <div className={styles.footerSocial}>
              <span>⬡</span>
              <span>◈</span>
            </div>
          </div>
          {Object.entries(FOOTER).map(([cat, links]) => (
            <div key={cat} className={styles.footerCol}>
              <strong>{cat.toUpperCase()}</strong>
              <ul>
                {links.map((l) => <li key={l}><a href="#">{l}</a></li>)}
              </ul>
            </div>
          ))}
        </div>
        <div className={styles.footerBottom}>
          <span>© 2024 Precision Architect NLP Labs. All rights reserved.</span>
        </div>
      </footer>
    </div>
  )
}