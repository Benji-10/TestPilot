import { useState, useEffect } from 'react'
import useStore from '../../lib/store.js'
import { apiClient } from '../../lib/api.js'
import { gradeLabel, formatDate, groupBy } from '../../lib/utils.js'

export default function AnalyticsView() {
  const { analytics, setAnalytics, activeSessionId, sessions, setActiveView } = useStore()
  const [loading, setLoading] = useState(false)
  const [tab, setTab] = useState('global') // 'global' | 'session'

  const session = sessions.find(s => s.id === activeSessionId)

  useEffect(() => {
    loadAnalytics()
  }, [activeSessionId])

  async function loadAnalytics() {
    setLoading(true)
    try {
      const [global, sess] = await Promise.all([
        apiClient.getGlobalAnalytics(),
        activeSessionId ? apiClient.getSessionAnalytics(activeSessionId) : Promise.resolve(null)
      ])
      setAnalytics({ global, session: sess })
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  const data = tab === 'global' ? analytics?.global : analytics?.session

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {/* Header */}
      <div style={{
        padding: '14px 24px', borderBottom: '1px solid var(--border)',
        display: 'flex', alignItems: 'center', gap: 16, flexShrink: 0,
        background: 'var(--surface-1)'
      }}>
        <div style={{ flex: 1 }}>
          <h1 style={{ fontSize: 14, fontFamily: 'Instrument Serif, serif', color: 'var(--ink-1)', marginBottom: 2 }}>
            Analytics
          </h1>
          <p style={{ fontSize: 11, color: 'var(--ink-3)' }}>Performance overview</p>
        </div>
        <div style={{ display: 'flex', gap: 4 }}>
          {['global', 'session'].map(t => (
            <button
              key={t}
              className={`btn ${tab === t ? '' : 'btn-ghost'}`}
              onClick={() => setTab(t)}
              style={{ fontSize: 11, padding: '4px 10px' }}
              disabled={t === 'session' && !activeSessionId}
            >
              {t === 'global' ? 'Global' : session?.name || 'Session'}
            </button>
          ))}
        </div>
        <button className="btn btn-ghost" onClick={() => setActiveView('session')} style={{ color: 'var(--ink-3)' }}>
          ← Back
        </button>
      </div>

      <div className="scroll-y" style={{ flex: 1, padding: '20px 24px' }}>
        {loading ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {[200, 160, 240].map((h, i) => (
              <div key={i} className="skeleton" style={{ height: h }} />
            ))}
          </div>
        ) : !data ? (
          <EmptyAnalytics />
        ) : (
          <AnalyticsContent data={data} />
        )}
      </div>
    </div>
  )
}

function AnalyticsContent({ data }) {
  const topicData = data.by_topic || []
  const trend = data.trend || []
  const maxPct = Math.max(...topicData.map(t => t.avg_pct || 0), 100)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Summary cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 10 }}>
        <MetricCard label="Exams taken" value={data.total_exams ?? 0} />
        <MetricCard label="Avg grade" value={`${Math.round(data.avg_pct ?? 0)}%`} />
        <MetricCard label="Total marks" value={`${data.total_scored ?? 0}/${data.total_possible ?? 0}`} />
        <MetricCard label="Best score" value={`${Math.round(data.best_pct ?? 0)}%`} />
      </div>

      {/* Topic breakdown */}
      {topicData.length > 0 && (
        <div style={{
          background: 'var(--surface-1)', border: '1px solid var(--border)',
          borderRadius: 'var(--radius-lg)', padding: 16
        }}>
          <h3 style={{ fontSize: 12, fontWeight: 500, color: 'var(--ink-2)', marginBottom: 14, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            Accuracy by topic
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {[...topicData].sort((a, b) => (a.avg_pct || 0) - (b.avg_pct || 0)).map(topic => {
              const pct = Math.round(topic.avg_pct || 0)
              const grade = gradeLabel(pct)
              return (
                <div key={topic.topic} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ width: 120, fontSize: 12, color: 'var(--ink-2)', flexShrink: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {topic.topic}
                  </div>
                  <div style={{ flex: 1, height: 6, background: 'var(--surface-3)', borderRadius: 3, overflow: 'hidden' }}>
                    <div style={{
                      height: '100%',
                      width: `${pct}%`,
                      background: grade.color,
                      borderRadius: 3,
                      transition: 'width 0.6s ease'
                    }} />
                  </div>
                  <div style={{ width: 40, textAlign: 'right', fontSize: 12, color: grade.color, flexShrink: 0 }}>
                    {pct}%
                  </div>
                  <div style={{ width: 20, fontSize: 11, color: 'var(--ink-3)', textAlign: 'right', flexShrink: 0 }}>
                    ({topic.count})
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Trend chart */}
      {trend.length > 1 && (
        <div style={{
          background: 'var(--surface-1)', border: '1px solid var(--border)',
          borderRadius: 'var(--radius-lg)', padding: 16
        }}>
          <h3 style={{ fontSize: 12, fontWeight: 500, color: 'var(--ink-2)', marginBottom: 14, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            Score trend
          </h3>
          <SimpleTrendChart data={trend} />
        </div>
      )}

      {/* Difficulty analysis */}
      {data.by_difficulty && (
        <div style={{
          background: 'var(--surface-1)', border: '1px solid var(--border)',
          borderRadius: 'var(--radius-lg)', padding: 16,
          display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12
        }}>
          {['easy', 'medium', 'hard'].map(diff => {
            const d = data.by_difficulty[diff] || { avg_pct: 0, count: 0 }
            const grade = gradeLabel(d.avg_pct || 0)
            return (
              <div key={diff} style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 22, fontWeight: 300, color: grade.color, marginBottom: 2 }}>
                  {Math.round(d.avg_pct || 0)}%
                </div>
                <div style={{ fontSize: 11, color: 'var(--ink-3)', textTransform: 'capitalize', marginBottom: 2 }}>
                  {diff}
                </div>
                <div style={{ fontSize: 10, color: 'var(--ink-3)' }}>{d.count} questions</div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

function SimpleTrendChart({ data }) {
  const maxPct = 100
  const height = 120
  const points = data.map((d, i) => ({
    x: (i / Math.max(data.length - 1, 1)) * 100,
    y: 100 - (d.pct || 0),
    pct: d.pct || 0,
    label: formatDate(d.date)
  }))

  const pathD = points.map((p, i) =>
    `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`
  ).join(' ')

  return (
    <svg viewBox="0 0 100 100" preserveAspectRatio="none" style={{ width: '100%', height }}>
      {/* Grid lines */}
      {[25, 50, 75].map(y => (
        <line key={y} x1="0" y1={y} x2="100" y2={y} stroke="var(--surface-3)" strokeWidth="0.3"/>
      ))}
      {/* Area */}
      <path
        d={`${pathD} L ${points[points.length-1]?.x} 100 L 0 100 Z`}
        fill="var(--accent)"
        fillOpacity="0.1"
      />
      {/* Line */}
      <path d={pathD} fill="none" stroke="var(--accent)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
      {/* Dots */}
      {points.map((p, i) => (
        <circle key={i} cx={p.x} cy={p.y} r="1.5" fill="var(--accent)"/>
      ))}
    </svg>
  )
}

function MetricCard({ label, value }) {
  return (
    <div style={{
      background: 'var(--surface-2)', borderRadius: 'var(--radius)',
      padding: '12px 14px'
    }}>
      <div style={{ fontSize: 10, color: 'var(--ink-3)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>
        {label}
      </div>
      <div style={{ fontSize: 22, fontWeight: 300, color: 'var(--ink-1)' }}>{value}</div>
    </div>
  )
}

function EmptyAnalytics() {
  return (
    <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--ink-3)' }}>
      <div style={{ fontSize: 32, marginBottom: 12 }}>📊</div>
      <p style={{ fontSize: 13, marginBottom: 6 }}>No data yet</p>
      <p style={{ fontSize: 12 }}>Complete some exams to see your analytics</p>
    </div>
  )
}
