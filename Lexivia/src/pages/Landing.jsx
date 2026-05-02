import { Link } from 'react-router-dom'
import Navbar from '../components/Navbar'

const WHO_CARDS = [
  {
    icon: '🏁',
    iconBg: '#eef0ff',
    iconColor: '#4458f5',
    title: 'Competition Organizers',
    desc: 'Create NLP competitions, define tasks, upload hidden test data, choose evaluation metrics, and monitor teams.',
  },
  {
    icon: '👥',
    iconBg: '#fff4ec',
    iconColor: '#e8621a',
    title: 'Student & Research Teams',
    desc: 'Create teams, join competitions, collect datasets, annotate data, train models, and submit final solutions.',
  },
  {
    icon: '🧠',
    iconBg: '#edf8f3',
    iconColor: '#1a8f57',
    title: 'NLP Builders',
    desc: 'Work on text and speech tasks such as classification, sentiment analysis, translation, QA, and speech processing.',
  },
]

const STEPS = [
  {
    num: '01',
    title: 'Create or Join a Competition',
    desc: 'Organizers publish NLP challenges. Teams browse competitions, read requirements, and join the ones they want to solve.',
  },
  {
    num: '02',
    title: 'Build and Annotate Datasets',
    desc: 'Teams collect text or voice data directly in the platform, then annotate it using task-specific labels and validation rules.',
  },
  {
    num: '03',
    title: 'Train Models in the Workspace',
    desc: 'Participants use integrated notebooks or JupyterLab environments to preprocess data, train models, and track experiments.',
  },
  {
    num: '04',
    title: 'Submit, Evaluate, and Rank',
    desc: 'Models are submitted to the platform, tested on organizer data or combined datasets, then ranked on a leaderboard.',
  },
]

const FEATURES = [
  {
    icon: '✍️',
    title: 'Built-in Annotation System',
    desc: 'Supports text and speech annotation with controlled labels, quality checks, and dataset validation.',
  },
  {
    icon: '📊',
    title: 'Automatic Evaluation',
    desc: 'Submissions are scored using task metrics like accuracy, F1-score, precision, recall, BLEU, WER, or custom metrics.',
  },
  {
    icon: '⚖️',
    title: 'Fair Resource Allocation',
    desc: 'Docker and Kubernetes can isolate experiments and distribute compute resources fairly between teams.',
  },
]

const LB_ROWS = [
  { rank: '#1', group: 'Team Atlas NLP', score: '0.94', badge: 'gold' },
  { rank: '#2', group: 'Syntax Squad', score: '0.91', badge: 'silver' },
  { rank: '#3', group: 'VoiceMind Lab', score: '0.88', badge: 'bronze' },
]

const FOOTER = {
  Platform: ['Competitions', 'Teams', 'Datasets', 'Leaderboards'],
  Workflow: ['Annotation', 'Training', 'Submissions', 'Evaluation'],
  Project: ['About Lexivia', 'Documentation', 'Contact'],
}

export default function Landing() {
  return (
    <div style={{ minHeight: '100vh', background: '#f6f7fb', fontFamily: 'Inter, Arial, sans-serif' }}>
      <Navbar />

      {/* HERO */}
      <section style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '80px 60px 60px',
        maxWidth: '1200px',
        margin: '0 auto',
        gap: '40px',
      }}>
        <div style={{ flex: 1, maxWidth: '600px' }}>
          <span style={{
            display: 'inline-block',
            fontSize: '11px',
            fontWeight: 700,
            letterSpacing: '1.5px',
            color: '#1a2fff',
            background: '#eef0ff',
            padding: '6px 12px',
            borderRadius: '6px',
            marginBottom: '24px',
          }}>
            NLP COMPETITION PLATFORM
          </span>

          <h1 style={{
            fontSize: '52px',
            fontWeight: 800,
            lineHeight: 1.1,
            letterSpacing: '-1.5px',
            margin: '0 0 24px',
            color: '#0d0e14',
          }}>
            Build, Annotate,<br />
            Train & Compete<br />
            in <span style={{ color: '#1a2fff' }}>NLP Challenges</span>
          </h1>

          <p style={{ fontSize: '16px', color: '#555e7a', lineHeight: 1.7, marginBottom: '32px' }}>
            Lexivia is a platform for hosting NLP competitions where organizers create challenges,
            teams collect and annotate datasets, train models, submit solutions, and compete on
            transparent leaderboards.
          </p>

          <div style={{ display: 'flex', gap: '12px', marginBottom: '48px', flexWrap: 'wrap' }}>
            <Link to={localStorage.getItem("token") ? "/dashboard" : "/signup"} style={{
              background: '#1a2fff',
              color: '#fff',
              padding: '12px 24px',
              borderRadius: '8px',
              textDecoration: 'none',
              fontSize: '14px',
              fontWeight: 600,
            }}>
              Get Started →
            </Link>

            <a href="#workflow" style={{
              background: '#fff',
              color: '#1d2333',
              padding: '12px 24px',
              borderRadius: '8px',
              textDecoration: 'none',
              fontSize: '14px',
              fontWeight: 600,
              border: '1px solid #e3e6ef',
            }}>
              See Workflow
            </a>
          </div>

          <div style={{ display: 'flex', gap: '40px', flexWrap: 'wrap' }}>
            <div>
              <strong style={{ fontSize: '24px', fontWeight: 800, color: '#0d0e14', display: 'block' }}>Teams</strong>
              <span style={{ fontSize: '11px', letterSpacing: '1px', color: '#8892a4' }}>COLLABORATE</span>
            </div>
            <div>
              <strong style={{ fontSize: '24px', fontWeight: 800, color: '#0d0e14', display: 'block' }}>Datasets</strong>
              <span style={{ fontSize: '11px', letterSpacing: '1px', color: '#8892a4' }}>ANNOTATE</span>
            </div>
            <div>
              <strong style={{ fontSize: '24px', fontWeight: 800, color: '#0d0e14', display: 'block' }}>Models</strong>
              <span style={{ fontSize: '11px', letterSpacing: '1px', color: '#8892a4' }}>SUBMIT</span>
            </div>
          </div>
        </div>

        {/* Hero visual */}
        <div style={{
          flex: '0 0 auto',
          width: '340px',
          background: '#0d0e14',
          borderRadius: '24px',
          padding: '24px',
          color: '#fff',
          boxShadow: '0 30px 80px rgba(26,47,255,0.22)',
        }}>
          <div style={{ display: 'flex', gap: '7px', marginBottom: '24px' }}>
            <span style={{ width: 11, height: 11, borderRadius: '50%', background: '#ff5f57' }} />
            <span style={{ width: 11, height: 11, borderRadius: '50%', background: '#febc2e' }} />
            <span style={{ width: 11, height: 11, borderRadius: '50%', background: '#28c840' }} />
          </div>

          <div style={{ marginBottom: '22px' }}>
            <p style={{ fontSize: '12px', color: '#8892a4', margin: '0 0 8px' }}>CURRENT COMPETITION</p>
            <h3 style={{ fontSize: '20px', margin: 0 }}>Arabic Sentiment Classification</h3>
          </div>

          <div style={{ display: 'grid', gap: '12px' }}>
            {[
              ['Dataset status', '78% annotated'],
              ['Active teams', '12 teams'],
              ['Metric', 'Macro F1-score'],
              ['Submission mode', 'Docker model'],
            ].map(([label, value]) => (
              <div key={label} style={{
                background: 'rgba(255,255,255,0.06)',
                border: '1px solid rgba(255,255,255,0.08)',
                borderRadius: '12px',
                padding: '12px 14px',
                display: 'flex',
                justifyContent: 'space-between',
                gap: '12px',
              }}>
                <span style={{ fontSize: '12px', color: '#aab2c8' }}>{label}</span>
                <strong style={{ fontSize: '12px', color: '#fff' }}>{value}</strong>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* WHO USES IT */}
      <section style={{ padding: '80px 60px', maxWidth: '1200px', margin: '0 auto' }} id="competitions">
        <h2 style={{ fontSize: '30px', fontWeight: 800, color: '#0d0e14', marginBottom: '8px' }}>
          One platform for the full NLP competition lifecycle
        </h2>
        <p style={{ fontSize: '15px', color: '#555e7a', marginBottom: '48px' }}>
          Lexivia connects organizers, teams, annotators, and machine learning engineers in one workspace.
        </p>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '20px' }}>
          {WHO_CARDS.map((c) => (
            <div key={c.title} style={{
              background: '#fff',
              borderRadius: '16px',
              padding: '28px',
              border: '1px solid #e8eaf2',
              boxShadow: '0 12px 30px rgba(15,23,42,0.04)',
            }}>
              <span style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: '44px',
                height: '44px',
                borderRadius: '12px',
                background: c.iconBg,
                color: c.iconColor,
                fontSize: '20px',
                marginBottom: '16px',
              }}>
                {c.icon}
              </span>
              <h3 style={{ fontSize: '17px', fontWeight: 700, color: '#0d0e14', margin: '0 0 8px' }}>
                {c.title}
              </h3>
              <p style={{ fontSize: '14px', color: '#6b7590', lineHeight: 1.6, margin: 0 }}>
                {c.desc}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* WORKFLOW */}
      <section style={{ background: '#fff', padding: '80px 60px' }} id="workflow">
        <div style={{
          maxWidth: '1200px',
          margin: '0 auto',
          display: 'grid',
          gridTemplateColumns: '1fr 1.1fr',
          gap: '60px',
          alignItems: 'start',
        }}>
          <div>
            <span style={{
              display: 'inline-block',
              fontSize: '11px',
              fontWeight: 700,
              letterSpacing: '1.4px',
              color: '#1a2fff',
              background: '#eef0ff',
              padding: '6px 12px',
              borderRadius: '6px',
              marginBottom: '18px',
            }}>
              HOW IT WORKS
            </span>

            <h2 style={{ fontSize: '32px', fontWeight: 800, color: '#0d0e14', margin: '0 0 12px' }}>
              From competition setup to final ranking
            </h2>

            <p style={{ fontSize: '15px', color: '#6b7590', lineHeight: 1.7, marginBottom: '32px' }}>
              The platform guides teams through the complete process: competition discovery,
              dataset construction, annotation, model development, submission, automatic evaluation,
              and leaderboard ranking.
            </p>

            <div style={{
              background: '#f6f7fb',
              border: '1px solid #e8eaf2',
              borderRadius: '16px',
              padding: '24px',
            }}>
              <h3 style={{ margin: '0 0 16px', fontSize: '16px', color: '#0d0e14' }}>
                Example NLP Tasks
              </h3>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
                {[
                  'Text Classification',
                  'Sentiment Analysis',
                  'Named Entity Recognition',
                  'Question Answering',
                  'Translation',
                  'Speech Recognition',
                  'Summarization',
                ].map((task) => (
                  <span key={task} style={{
                    background: '#fff',
                    border: '1px solid #e3e6ef',
                    padding: '8px 12px',
                    borderRadius: '999px',
                    fontSize: '12px',
                    color: '#555e7a',
                    fontWeight: 600,
                  }}>
                    {task}
                  </span>
                ))}
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {STEPS.map((s, i) => (
              <div key={s.num} style={{
                display: 'flex',
                gap: '20px',
                padding: '22px',
                borderLeft: i === 0 ? '4px solid #1a2fff' : '4px solid #e8eaf2',
                marginBottom: '8px',
                background: i === 0 ? '#f6f7ff' : '#fff',
                borderRadius: '0 12px 12px 0',
              }}>
                <span style={{
                  fontSize: '26px',
                  fontWeight: 800,
                  color: i === 0 ? '#1a2fff' : '#c8cfe0',
                  minWidth: '44px',
                }}>
                  {s.num}
                </span>
                <div>
                  <h4 style={{ fontSize: '16px', fontWeight: 700, color: '#0d0e14', margin: '0 0 6px' }}>
                    {s.title}
                  </h4>
                  <p style={{ fontSize: '13px', color: '#6b7590', lineHeight: 1.6, margin: 0 }}>
                    {s.desc}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FEATURES */}
      <section style={{ padding: '80px 60px', maxWidth: '1200px', margin: '0 auto' }} id="features">
        <h2 style={{ fontSize: '30px', fontWeight: 800, color: '#0d0e14', marginBottom: '12px', textAlign: 'center' }}>
          Platform modules
        </h2>
        <p style={{ fontSize: '15px', color: '#6b7590', marginBottom: '44px', textAlign: 'center' }}>
          Everything needed to manage an NLP competition from start to finish.
        </p>

        <div style={{ display: 'grid', gridTemplateColumns: '1.3fr 1fr', gap: '20px', marginBottom: '20px' }}>
          <div style={{
            background: '#0d0e14',
            borderRadius: '18px',
            padding: '32px',
            color: '#fff',
          }}>
            <div style={{ marginBottom: '24px' }}>
              <div style={{ display: 'flex', gap: '6px', marginBottom: '14px' }}>
                <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#ff5f57' }} />
                <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#febc2e' }} />
                <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#28c840' }} />
              </div>

              {[
                'load_dataset("team_annotations.csv")',
                'train_model(task="sentiment-analysis")',
                'submit_model(metric="macro_f1")',
              ].map((line) => (
                <div key={line} style={{
                  background: 'rgba(255,255,255,0.06)',
                  border: '1px solid rgba(255,255,255,0.08)',
                  borderRadius: '8px',
                  padding: '10px 12px',
                  marginBottom: '8px',
                  fontSize: '12px',
                  color: '#aab2c8',
                  fontFamily: 'monospace',
                }}>
                  <span style={{ color: '#1a2fff' }}>› </span>{line}
                </div>
              ))}
            </div>

            <h3 style={{ fontSize: '20px', fontWeight: 700, margin: '0 0 10px', color: '#fff' }}>
              Modeling Workspace
            </h3>
            <p style={{ fontSize: '13px', color: '#aab2c8', lineHeight: 1.7, marginBottom: '20px' }}>
              Teams can train and test their NLP models using notebooks, tracked experiments,
              Dockerized submissions, and controlled compute resources.
            </p>

            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              {['JUPYTERLAB', 'DOCKER', 'KUBERNETES', 'MLFLOW/DVC READY'].map(tag => (
                <span key={tag} style={{
                  fontSize: '10px',
                  letterSpacing: '0.8px',
                  color: '#c7cce0',
                  border: '1px solid rgba(255,255,255,0.12)',
                  padding: '5px 10px',
                  borderRadius: '5px',
                }}>
                  {tag}
                </span>
              ))}
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {FEATURES.map((f) => (
              <div key={f.title} style={{
                background: '#fff',
                border: '1px solid #e8eaf2',
                borderRadius: '16px',
                padding: '22px',
                display: 'flex',
                gap: '14px',
                alignItems: 'flex-start',
              }}>
                <span style={{
                  fontSize: '22px',
                  display: 'block',
                  minWidth: '30px',
                }}>
                  {f.icon}
                </span>
                <div>
                  <h4 style={{ fontSize: '15px', fontWeight: 700, color: '#0d0e14', margin: '0 0 6px' }}>
                    {f.title}
                  </h4>
                  <p style={{ fontSize: '13px', color: '#6b7590', lineHeight: 1.5, margin: 0 }}>
                    {f.desc}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Leaderboard */}
        <div style={{
          background: '#fff',
          borderRadius: '18px',
          padding: '32px',
          border: '1px solid #e8eaf2',
          display: 'grid',
          gridTemplateColumns: '1fr 1.5fr',
          gap: '40px',
          alignItems: 'center',
        }} id="leaderboards">
          <div>
            <h3 style={{ fontSize: '22px', fontWeight: 800, color: '#0d0e14', margin: '0 0 8px' }}>
              Competition Leaderboard
            </h3>
            <p style={{ fontSize: '13px', color: '#6b7590', lineHeight: 1.7, margin: 0 }}>
              Every submitted model is evaluated automatically. Teams are ranked using the metric chosen by the organizer.
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
              <span>TEAM</span>
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
                <span style={{ fontWeight: 800, color: '#0d0e14' }}>{r.rank}</span>
                <span style={{ color: '#1d2333', fontWeight: 600 }}>{r.group}</span>
                <span style={{
                  background:
                    r.badge === 'gold' ? '#e74c3c' :
                      r.badge === 'silver' ? '#95a5a6' :
                        '#d97706',
                  color: '#fff',
                  fontSize: '12px',
                  fontWeight: 700,
                  padding: '4px 8px',
                  borderRadius: '6px',
                  textAlign: 'center',
                }}>
                  {r.score}
                </span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section style={{
        background: '#eef0ff',
        padding: '80px 60px',
        textAlign: 'center',
      }}>
        <h2 style={{ fontSize: '36px', fontWeight: 800, color: '#0d0e14', marginBottom: '16px' }}>
          Ready to launch your NLP competition?
        </h2>
        <p style={{ fontSize: '16px', color: '#555e7a', marginBottom: '36px', lineHeight: 1.7 }}>
          Create challenges, manage teams, collect annotated datasets, train models,
          and evaluate submissions in one complete platform.
        </p>

        <Link to={localStorage.getItem("token") ? "/dashboard" : "/signup"} style={{
          display: 'inline-block',
          background: '#1a2fff',
          color: '#fff',
          padding: '14px 32px',
          borderRadius: '8px',
          textDecoration: 'none',
          fontSize: '15px',
          fontWeight: 700,
        }}>
          Start with Lexivia
        </Link>
      </section>

      {/* FOOTER */}
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
            <strong style={{ fontSize: '18px', color: '#0d0e14', display: 'block', marginBottom: '12px' }}>
              LEXIVIA
            </strong>
            <p style={{ fontSize: '13px', color: '#6b7590', lineHeight: 1.7, marginBottom: '16px' }}>
              A full-stack platform for NLP competitions, dataset annotation, model training,
              submission evaluation, and leaderboard ranking.
            </p>
          </div>

          {Object.entries(FOOTER).map(([cat, links]) => (
            <div key={cat}>
              <strong style={{ fontSize: '11px', letterSpacing: '1.2px', color: '#0d0e14', display: 'block', marginBottom: '16px' }}>
                {cat.toUpperCase()}
              </strong>
              <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {links.map((l) => (
                  <li key={l}>
                    <a href="#" style={{ fontSize: '13px', color: '#6b7590', textDecoration: 'none' }}>
                      {l}
                    </a>
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
          © 2026 Lexivia. NLP Competition Platform.
        </div>
      </footer>
    </div>
  )
}