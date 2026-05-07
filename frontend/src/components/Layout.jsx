import { useEffect } from 'react'
import useStore from '../lib/store.js'
import { apiClient } from '../lib/api.js'
import Sidebar from './sidebar/Sidebar.jsx'
import SessionView from './session/SessionView.jsx'
import ExamView from './exam/ExamView.jsx'
import ReviewView from './exam/ReviewView.jsx'
import AnalyticsView from './analytics/AnalyticsView.jsx'
import EmptyState from './ui/EmptyState.jsx'

export default function Layout() {
  const {
    sessions, setSessions, activeSessionId, setActiveSession,
    activeView, sidebarOpen
  } = useStore()

  useEffect(() => {
    loadSessions()
  }, [])

  async function loadSessions() {
    try {
      const data = await apiClient.getSessions()
      setSessions(data)
      if (data.length && !activeSessionId) {
        setActiveSession(data[0].id)
      }
    } catch (e) {
      console.error('Failed to load sessions:', e)
    }
  }

  const activeSession = sessions.find(s => s.id === activeSessionId)

  function renderMain() {
    if (activeView === 'exam') return <ExamView />
    if (activeView === 'review') return <ReviewView />
    if (activeView === 'analytics') return <AnalyticsView />
    if (!activeSession) return <EmptyState />
    return <SessionView session={activeSession} />
  }

  return (
    <div className="app-layout">
      <Sidebar />
      <main className="main-panel">
        {renderMain()}
      </main>
    </div>
  )
}
