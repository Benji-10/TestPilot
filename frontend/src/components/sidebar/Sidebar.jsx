import { useState, useRef, useEffect } from 'react'
import useStore from '../../lib/store.js'
import { apiClient } from '../../lib/api.js'
import { sessionColor, formatDate } from '../../lib/utils.js'
import toast from 'react-hot-toast'

export default function Sidebar() {
  const {
    sessions, activeSessionId, setActiveSession, addSession,
    updateSession, removeSession, sidebarOpen, toggleSidebar,
    setActiveView, user
  } = useStore()

  const [search, setSearch] = useState('')
  const [contextMenu, setContextMenu] = useState(null)
  const [renaming, setRenaming] = useState(null)
  const renameRef = useRef(null)

  useEffect(() => {
    if (renaming && renameRef.current) renameRef.current.focus()
  }, [renaming])

  useEffect(() => {
    function handler() { if (contextMenu) setContextMenu(null) }
    document.addEventListener('click', handler)
    return () => document.removeEventListener('click', handler)
  }, [contextMenu])

  async function createSession() {
    try {
      const session = await apiClient.createSession({ name: 'New Session' })
      addSession(session)
      setActiveView('session')
      setRenaming(session.id)
    } catch (e) {
      toast.error('Failed to create session')
    }
  }

  async function handleRename(id, name) {
    setRenaming(null)
    if (!name.trim()) return
    try {
      await apiClient.updateSession(id, { name: name.trim() })
      updateSession(id, { name: name.trim() })
    } catch (e) {
      toast.error('Failed to rename')
    }
  }

  async function handleDelete(id) {
    setContextMenu(null)
    if (!confirm('Delete this session and all its data?')) return
    try {
      await apiClient.deleteSession(id)
      removeSession(id)
    } catch (e) {
      toast.error('Failed to delete session')
    }
  }

  async function handleDuplicate(id) {
    setContextMenu(null)
    try {
      const dup = await apiClient.duplicateSession(id)
      addSession(dup)
      toast.success('Session duplicated')
    } catch (e) {
      toast.error('Failed to duplicate')
    }
  }

  function openContextMenu(e, sessionId) {
    e.preventDefault()
    e.stopPropagation()
    setContextMenu({ x: e.clientX, y: e.clientY, id: sessionId })
  }

  function handleSignOut() {
    window.netlifyIdentity?.logout()
  }

  const filtered = sessions.filter(s =>
    s.name.toLowerCase().includes(search.toLowerCase())
  )

  if (!sidebarOpen) {
    return (
      <div style={{ display: 'flex', alignItems: 'flex-start', padding: 8 }}>
        <button className="btn btn-ghost btn-icon" onClick={toggleSidebar} title="Open sidebar">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
            <rect y="2" width="16" height="1.5" rx="0.75"/>
            <rect y="7.25" width="16" height="1.5" rx="0.75"/>
            <rect y="12.5" width="16" height="1.5" rx="0.75"/>
          </svg>
        </button>
      </div>
    )
  }

  return (
    <>
      <div className="sidebar animate-slide-in">
        {/* Header */}
        <div style={{ padding: '12px 12px 8px', borderBottom: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 7, flex: 1 }}>
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                <rect width="20" height="20" rx="5" fill="var(--accent)" />
                <path d="M5 14L10 6l5 8H5z" fill="white" fillOpacity="0.9" />
              </svg>
              <span style={{ fontSize: 13, fontFamily: 'Instrument Serif, serif', color: 'var(--ink-1)' }}>
                TestPilot
              </span>
            </div>
            <button className="btn btn-ghost btn-icon" onClick={toggleSidebar} title="Collapse">
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <path d="M9 2L4 7l5 5" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round"/>
              </svg>
            </button>
          </div>

          <div style={{ position: 'relative' }}>
            <svg width="13" height="13" viewBox="0 0 13 13" fill="none" style={{
              position: 'absolute', left: 9, top: '50%', transform: 'translateY(-50%)',
              color: 'var(--ink-3)', pointerEvents: 'none'
            }}>
              <circle cx="5.5" cy="5.5" r="4" stroke="currentColor" strokeWidth="1.3"/>
              <path d="M9 9l2.5 2.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
            </svg>
            <input
              className="input"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search sessions..."
              style={{ paddingLeft: 28, fontSize: 12, padding: '6px 10px 6px 28px' }}
            />
          </div>
        </div>

        {/* Sessions list */}
        <div className="scroll-y" style={{ flex: 1, padding: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '4px 4px 6px', marginBottom: 2 }}>
            <span style={{ fontSize: 10, color: 'var(--ink-3)', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 500 }}>
              Sessions
            </span>
            <button className="btn btn-ghost btn-icon" onClick={createSession} title="New session" style={{ padding: 3 }}>
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <path d="M7 2v10M2 7h10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
              </svg>
            </button>
          </div>

          {filtered.length === 0 && (
            <div style={{ padding: '20px 8px', textAlign: 'center', color: 'var(--ink-3)', fontSize: 12 }}>
              {search ? 'No sessions found' : 'No sessions yet — click + to create one'}
            </div>
          )}

          {filtered.map(session => (
            <SessionTile
              key={session.id}
              session={session}
              active={session.id === activeSessionId}
              renaming={renaming === session.id}
              renameRef={renaming === session.id ? renameRef : null}
              onSelect={() => { setActiveSession(session.id); setActiveView('session') }}
              onContextMenu={(e) => openContextMenu(e, session.id)}
              onRename={(name) => handleRename(session.id, name)}
              onRenameStart={() => setRenaming(session.id)}
            />
          ))}
        </div>

        {/* Footer */}
        <div style={{ padding: '8px 12px', borderTop: '1px solid var(--border)' }}>
          <button
            className="btn btn-ghost"
            style={{ width: '100%', justifyContent: 'flex-start', padding: '6px 8px', marginBottom: 4 }}
            onClick={() => setActiveView('analytics')}
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <rect x="1" y="7" width="3" height="6" rx="1" fill="currentColor" opacity="0.7"/>
              <rect x="5.5" y="4" width="3" height="9" rx="1" fill="currentColor" opacity="0.85"/>
              <rect x="10" y="1" width="3" height="12" rx="1" fill="currentColor"/>
            </svg>
            Analytics
          </button>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 8px' }}>
            <div style={{
              width: 24, height: 24, borderRadius: '50%',
              background: 'var(--accent-dim)', display: 'flex', alignItems: 'center',
              justifyContent: 'center', fontSize: 10, color: '#c4bbff', fontWeight: 500, flexShrink: 0
            }}>
              {user?.email?.[0]?.toUpperCase() || '?'}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 11, color: 'var(--ink-2)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {user?.email}
              </div>
            </div>
            <button className="btn btn-ghost btn-icon" onClick={handleSignOut} title="Sign out" style={{ padding: 3 }}>
              <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
                <path d="M5 2H2a1 1 0 00-1 1v7a1 1 0 001 1h3M9 9.5l3-3m0 0l-3-3m3 3H5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
              </svg>
            </button>
          </div>
        </div>
      </div>

      {contextMenu && (
        <div
          className="context-menu"
          style={{ left: contextMenu.x, top: Math.min(contextMenu.y, window.innerHeight - 160) }}
          onClick={e => e.stopPropagation()}
        >
          <div className="context-menu-item" onClick={() => { setRenaming(contextMenu.id); setContextMenu(null) }}>
            <svg width="13" height="13" viewBox="0 0 13 13" fill="none"><path d="M9 2l2 2-6 6H3V8l6-6z" stroke="currentColor" strokeWidth="1.2" fill="none"/></svg>
            Rename
          </div>
          <div className="context-menu-item" onClick={() => handleDuplicate(contextMenu.id)}>
            <svg width="13" height="13" viewBox="0 0 13 13" fill="none"><rect x="4" y="4" width="8" height="8" rx="1.5" stroke="currentColor" strokeWidth="1.2"/><path d="M1 9V2a1 1 0 011-1h7" stroke="currentColor" strokeWidth="1.2"/></svg>
            Duplicate
          </div>
          <div style={{ height: 1, background: 'var(--border)', margin: '3px 0' }} />
          <div className="context-menu-item danger" onClick={() => handleDelete(contextMenu.id)}>
            <svg width="13" height="13" viewBox="0 0 13 13" fill="none"><path d="M2 3.5h9M5 3.5V2h3v1.5M5.5 6v4M7.5 6v4M3 3.5l.5 7a1 1 0 001 1h4a1 1 0 001-1l.5-7" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/></svg>
            Delete
          </div>
        </div>
      )}
    </>
  )
}

function SessionTile({ session, active, renaming, renameRef, onSelect, onContextMenu, onRename, onRenameStart }) {
  const [name, setName] = useState(session.name)
  const color = sessionColor(session.id)
  useEffect(() => setName(session.name), [session.name])

  return (
    <div
      className={`session-tile ${active ? 'active' : ''}`}
      onClick={onSelect}
      onContextMenu={onContextMenu}
      onDoubleClick={onRenameStart}
    >
      <div style={{ width: 8, height: 8, borderRadius: '50%', background: color, flexShrink: 0 }} />
      {renaming ? (
        <input
          ref={renameRef}
          value={name}
          onChange={e => setName(e.target.value)}
          onBlur={() => onRename(name)}
          onKeyDown={e => {
            if (e.key === 'Enter') onRename(name)
            if (e.key === 'Escape') { setName(session.name); onRename(session.name) }
          }}
          onClick={e => e.stopPropagation()}
          style={{ flex: 1, background: 'transparent', border: 'none', color: 'var(--ink-1)', fontFamily: 'inherit', fontSize: 13, outline: 'none', padding: 0 }}
        />
      ) : (
        <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: 13, color: active ? 'var(--ink-1)' : 'var(--ink-2)' }}>
          {session.name}
        </span>
      )}
    </div>
  )
}
