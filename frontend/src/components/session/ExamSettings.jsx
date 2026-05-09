import { useState } from 'react'

export default function ExamSettings({ settings, onChange }) {
  const [open, setOpen] = useState(true)

  function set(key, value) {
    onChange({ [key]: value })
  }

  return (
    <section>
      <button
        onClick={() => setOpen(!open)}
        style={{
          display: 'flex', alignItems: 'center', gap: 8,
          background: 'none', border: 'none', cursor: 'pointer',
          color: 'var(--ink-1)', width: '100%', textAlign: 'left',
          marginBottom: open ? 12 : 0, padding: 0
        }}
      >
        <h2 style={{ fontSize: 12, fontWeight: 500, flex: 1 }}>Exam Settings</h2>
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none"
          style={{ transform: open ? 'rotate(0deg)' : 'rotate(-90deg)', transition: 'transform 0.15s', color: 'var(--ink-3)' }}>
          <path d="M3 5l4 4 4-4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
        </svg>
      </button>

      {open && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

          {/* Number of questions — plain number input */}
          <Setting label="Number of questions">
            <input
              type="number"
              className="input"
              value={settings.numQuestions}
              min={1} max={30}
              onChange={e => set('numQuestions', Math.max(1, Math.min(30, +e.target.value || 1)))}
              style={{ width: 80, fontSize: 13, padding: '5px 8px' }}
            />
          </Setting>

          {/* Exam length */}
          <Setting label="Exam length">
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <select
                className="input"
                value={settings.examLength?.type}
                onChange={e => set('examLength', { ...settings.examLength, type: e.target.value })}
                style={{ width: 100, fontSize: 12, padding: '5px 8px' }}
              >
                <option value="marks">Marks</option>
                <option value="time">Time (min)</option>
              </select>
              <input
                type="number"
                className="input"
                value={settings.examLength?.value}
                min={1}
                onChange={e => set('examLength', { ...settings.examLength, value: +e.target.value })}
                style={{ width: 70, fontSize: 12, padding: '5px 8px' }}
              />
            </div>
          </Setting>

          {/* Difficulty */}
          <Setting label="Difficulty">
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {['easy', 'medium', 'hard', 'mixed'].map(d => (
                <button key={d} onClick={() => set('difficulty', d)} style={{
                  padding: '4px 12px', borderRadius: 100, border: '1px solid',
                  fontSize: 11, cursor: 'pointer', fontFamily: 'inherit',
                  background: settings.difficulty === d ? 'var(--accent)' : 'transparent',
                  borderColor: settings.difficulty === d ? 'var(--accent)' : 'var(--border)',
                  color: settings.difficulty === d ? 'white' : 'var(--ink-2)',
                  transition: 'all 0.1s ease'
                }}>{d}</button>
              ))}
            </div>
          </Setting>

          {/* Topic focus */}
          <Setting label="Topic focus" hint="Leave blank for all topics">
            <input
              className="input"
              value={settings.topicFocus}
              onChange={e => set('topicFocus', e.target.value)}
              placeholder="e.g. supremum, bounded functions…"
              style={{ fontSize: 12, padding: '6px 10px' }}
            />
          </Setting>

          {/* Marking strictness */}
          <Setting label="Marking strictness">
            <div style={{ display: 'flex', gap: 6 }}>
              {['lenient', 'standard', 'strict'].map(s => (
                <button key={s} onClick={() => set('markingStrictness', s)} style={{
                  padding: '4px 12px', borderRadius: 100, border: '1px solid',
                  fontSize: 11, cursor: 'pointer', fontFamily: 'inherit',
                  background: settings.markingStrictness === s ? 'var(--surface-3)' : 'transparent',
                  borderColor: settings.markingStrictness === s ? 'var(--border-active)' : 'var(--border)',
                  color: settings.markingStrictness === s ? 'var(--ink-1)' : 'var(--ink-3)',
                  transition: 'all 0.1s ease'
                }}>{s}</button>
              ))}
            </div>
          </Setting>

          {/* Toggles */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <ToggleRow label="Allow alternative solutions" hint="Accept equivalent valid methods" checked={settings.allowAlternatives} onChange={v => set('allowAlternatives', v)} />
            <ToggleRow label="Open book" hint="Show key formulas/theorems from your notes" checked={settings.openBook} onChange={v => set('openBook', v)} />
            <ToggleRow label="Enable timer" checked={settings.timerEnabled} onChange={v => set('timerEnabled', v)} />
          </div>

          {settings.timerEnabled && (
            <div style={{ background: 'var(--surface-2)', borderRadius: 'var(--radius)', padding: 12, display: 'flex', flexDirection: 'column', gap: 10 }}>
              <Setting label="Duration (minutes)">
                <input
                  type="number"
                  className="input"
                  value={settings.timerDuration}
                  min={5} max={300}
                  onChange={e => set('timerDuration', +e.target.value)}
                  style={{ width: 80, fontSize: 12, padding: '5px 8px' }}
                />
              </Setting>
              <ToggleRow label="Auto-submit on expiry" checked={settings.autoSubmit} onChange={v => set('autoSubmit', v)} />
            </div>
          )}
        </div>
      )}
    </section>
  )
}

function Setting({ label, hint, children }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <div>
        <label style={{ fontSize: 12, color: 'var(--ink-2)', display: 'block' }}>{label}</label>
        {hint && <span style={{ fontSize: 10, color: 'var(--ink-3)' }}>{hint}</span>}
      </div>
      {children}
    </div>
  )
}

function ToggleRow({ label, hint, checked, onChange }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
      <div>
        <span style={{ fontSize: 12, color: 'var(--ink-2)' }}>{label}</span>
        {hint && <span style={{ fontSize: 10, color: 'var(--ink-3)', display: 'block' }}>{hint}</span>}
      </div>
      <label className="toggle" style={{ flexShrink: 0 }}>
        <input type="checkbox" checked={checked} onChange={e => onChange(e.target.checked)} />
        <div className="toggle-track" />
        <div className="toggle-thumb" />
      </label>
    </div>
  )
}
