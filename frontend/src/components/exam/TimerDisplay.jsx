import { useTimer } from '../../hooks/useTimer.js'
import { formatTime } from '../../lib/utils.js'

export default function TimerDisplay({ durationMinutes, onExpire, autoSubmit, onTimerState }) {
  const durationSeconds = durationMinutes * 60
  const { timeLeft, paused, expired, pct, pause, resume } = useTimer({
    durationSeconds,
    onExpire,
    autoSubmit,
  })

  const isWarning = pct < 25
  const isDanger = pct < 10

  // Expose timer state
  const stateStr = JSON.stringify({ timeLeft, paused })
  if (onTimerState) onTimerState({ timeLeft, paused, expired })

  const timerClass = isDanger ? 'danger' : isWarning ? 'warning' : ''

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 12,
      background: 'var(--surface-2)', border: '1px solid var(--border)',
      borderRadius: 'var(--radius)', padding: '8px 14px'
    }}>
      {/* Ring */}
      <div style={{ position: 'relative', width: 36, height: 36, flexShrink: 0 }}>
        <svg width="36" height="36" viewBox="0 0 36 36" style={{ transform: 'rotate(-90deg)' }}>
          <circle cx="18" cy="18" r="14" fill="none" stroke="var(--surface-4)" strokeWidth="3"/>
          <circle
            cx="18" cy="18" r="14" fill="none"
            stroke={isDanger ? 'var(--danger)' : isWarning ? 'var(--warning)' : 'var(--accent)'}
            strokeWidth="3"
            strokeDasharray={`${2 * Math.PI * 14}`}
            strokeDashoffset={`${2 * Math.PI * 14 * (1 - pct / 100)}`}
            strokeLinecap="round"
            style={{ transition: 'stroke-dashoffset 1s linear, stroke 0.5s ease' }}
          />
        </svg>
        <div style={{
          position: 'absolute', inset: 0, display: 'flex',
          alignItems: 'center', justifyContent: 'center',
          fontSize: 9, color: isDanger ? 'var(--danger)' : 'var(--ink-2)'
        }}>
          {expired ? '!' : paused ? '⏸' : ''}
        </div>
      </div>

      <div style={{ flex: 1 }}>
        <div className={`timer-display ${timerClass}`}>
          {expired ? 'Time\'s up' : formatTime(timeLeft)}
        </div>
        <div style={{ fontSize: 10, color: 'var(--ink-3)' }}>
          {paused ? 'Paused' : expired ? (autoSubmit ? 'Submitted' : 'Expired') : 'Remaining'}
        </div>
      </div>

      {!expired && (
        <button
          className="btn btn-ghost btn-icon"
          onClick={paused ? resume : pause}
          title={paused ? 'Resume' : 'Pause'}
        >
          {paused ? (
            <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor">
              <path d="M3 2.5l9 4.5-9 4.5V2.5z"/>
            </svg>
          ) : (
            <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor">
              <rect x="2.5" y="2" width="3" height="10" rx="1"/>
              <rect x="8.5" y="2" width="3" height="10" rx="1"/>
            </svg>
          )}
        </button>
      )}
    </div>
  )
}
