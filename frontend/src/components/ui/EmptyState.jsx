import useStore from '../../lib/store.js'
import { apiClient } from '../../lib/api.js'
import toast from 'react-hot-toast'

export default function EmptyState() {
  const { addSession, setActiveView } = useStore()

  async function createSession() {
    try {
      const session = await apiClient.createSession({ name: 'New Session' })
      addSession(session)
      setActiveView('session')
    } catch (e) {
      toast.error('Failed to create session')
    }
  }

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      justifyContent: 'center', height: '100%', gap: 20, padding: 40
    }}>
      <svg width="48" height="48" viewBox="0 0 48 48" fill="none" style={{ opacity: 0.3 }}>
        <rect width="48" height="48" rx="12" fill="var(--accent)" />
        <path d="M12 34L24 14l12 20H12z" fill="white" fillOpacity="0.9" />
        <circle cx="24" cy="24" r="5" fill="var(--accent)" />
      </svg>
      <div style={{ textAlign: 'center' }}>
        <h2 style={{ fontSize: 16, fontFamily: 'Instrument Serif, serif', color: 'var(--ink-1)', marginBottom: 8 }}>
          Welcome to TestPilot
        </h2>
        <p style={{ fontSize: 13, color: 'var(--ink-3)', maxWidth: 320, lineHeight: 1.7 }}>
          Create a session, upload your study materials, and generate AI-powered exams with instant feedback.
        </p>
      </div>
      <button className="btn btn-primary" onClick={createSession} style={{ padding: '9px 20px' }}>
        + New Session
      </button>
    </div>
  )
}
