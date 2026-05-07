import netlifyIdentity from 'netlify-identity-widget'

export default function AuthScreen() {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      height: '100vh', flexDirection: 'column', gap: 32,
      background: 'var(--surface-0)'
    }}>
      <div style={{ textAlign: 'center', marginBottom: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, marginBottom: 16 }}>
          <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
            <rect width="28" height="28" rx="7" fill="var(--accent)" />
            <path d="M7 20L14 8l7 12H7z" fill="white" fillOpacity="0.9" />
            <circle cx="14" cy="14" r="3" fill="var(--accent)" />
          </svg>
          <span style={{ fontSize: 20, fontFamily: 'Instrument Serif, serif', color: 'var(--ink-1)' }}>
            TestPilot
          </span>
        </div>
        <p style={{ color: 'var(--ink-2)', fontSize: 13, maxWidth: 320, lineHeight: 1.7 }}>
          AI-powered exam practice. Upload your notes, generate tailored exams,
          get detailed step-by-step feedback on every answer.
        </p>
      </div>

      <div style={{
        display: 'flex', flexDirection: 'column', gap: 10, width: 280
      }}>
        <button
          className="btn btn-primary"
          style={{ justifyContent: 'center', padding: '10px 20px', fontSize: 13 }}
          onClick={() => netlifyIdentity.open('login')}
        >
          Sign in
        </button>
        <button
          className="btn"
          style={{ justifyContent: 'center', padding: '10px 20px', fontSize: 13 }}
          onClick={() => netlifyIdentity.open('signup')}
        >
          Create account
        </button>
      </div>

      <p style={{ color: 'var(--ink-3)', fontSize: 11 }}>
        Powered by Gemini · Built for serious revision
      </p>
    </div>
  )
}
