import { useState } from 'react'
import useStore from '../../lib/store.js'
import { apiClient } from '../../lib/api.js'
import { percentage, gradeLabel } from '../../lib/utils.js'
import QuestionCard from './QuestionCard.jsx'
import toast from 'react-hot-toast'

export default function ReviewView() {
  const { activeAttempt, setActiveView, setActiveAttempt, addExam, examSettings } = useStore()
  const [generatingNext, setGeneratingNext] = useState(false)

  const attempt = activeAttempt
  const exam = attempt?.exam
  const feedback = attempt?.feedback_json || {}
  const questions = feedback.questions || exam?.questions_json || []
  const totalScore = attempt?.total_score ?? 0
  const maxScore = attempt?.max_score ?? exam?.total_marks ?? 0
  const pct = percentage(totalScore, maxScore)
  const grade = gradeLabel(pct)

  async function generateNextExam() {
    setGeneratingNext(true)
    try {
      const weakTopics = feedback.weak_topics || []
      const settings = { ...(examSettings[exam?.session_id] || {}), topicFocus: weakTopics.join(', ') }
      const nextExam = await apiClient.generateExam({
        sessionId: exam.session_id,
        fileIds: [],
        instructions: weakTopics.length ? `Focus on these weak areas: ${weakTopics.join(', ')}` : '',
        settings,
        fromAttemptId: attempt.id
      })
      addExam(exam.session_id, nextExam)
      const newAttempt = await apiClient.createAttempt(nextExam.id)
      setActiveAttempt({ ...newAttempt, exam: nextExam })
      setActiveView('exam')
      toast.success('New exam generated from weak topics!')
    } catch (e) {
      toast.error('Failed to generate next exam')
    } finally {
      setGeneratingNext(false)
    }
  }

  if (!attempt || !exam) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--ink-3)' }}>
        No attempt to review
      </div>
    )
  }

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <div style={{
        padding: '14px 24px', borderBottom: '1px solid var(--border)',
        display: 'flex', alignItems: 'center', gap: 16, flexShrink: 0,
        background: 'var(--surface-1)'
      }}>
        <div style={{ flex: 1 }}>
          <h1 style={{ fontSize: 14, fontFamily: 'Instrument Serif, serif', color: 'var(--ink-1)', marginBottom: 2 }}>
            Results — {exam.title}
          </h1>
          <p style={{ fontSize: 11, color: 'var(--ink-3)' }}>Review your performance and feedback below</p>
        </div>
        <button className="btn btn-ghost" onClick={() => setActiveView('session')} style={{ color: 'var(--ink-3)' }}>
          ← Back
        </button>
      </div>

      <div className="scroll-y" style={{ flex: 1, padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 20 }}>

        {/* Score card */}
        <div style={{
          background: 'var(--surface-1)', border: '1px solid var(--border)',
          borderRadius: 'var(--radius-lg)', padding: 20,
          display: 'flex', alignItems: 'center', gap: 24, flexWrap: 'wrap'
        }}>
          <div style={{
            width: 80, height: 80, borderRadius: '50%', flexShrink: 0,
            border: `3px solid ${grade.color}`,
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            background: `${grade.color}18`
          }}>
            <span style={{ fontSize: 26, fontWeight: 300, color: grade.color, fontFamily: 'Instrument Serif, serif', lineHeight: 1 }}>
              {grade.label}
            </span>
            <span style={{ fontSize: 11, color: 'var(--ink-3)', marginTop: 2 }}>{pct}%</span>
          </div>

          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 32, fontWeight: 300, color: 'var(--ink-1)', marginBottom: 4 }}>
              {totalScore} <span style={{ fontSize: 16, color: 'var(--ink-3)' }}>/ {maxScore} marks</span>
            </div>
            <div className="progress-bar" style={{ width: '100%', maxWidth: 240 }}>
              <div className="progress-bar-fill" style={{ width: `${pct}%`, background: grade.color }} />
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 12 }}>
            <StatRow label="Correct" value={`${questions.filter(q => q.isCorrect).length}/${questions.length}`} />
            {feedback.method_marks_total != null && (
              <StatRow label="Method marks" value={feedback.method_marks_total} />
            )}
            {attempt.time_taken_seconds && (
              <StatRow label="Time" value={`${Math.round(attempt.time_taken_seconds / 60)}m`} />
            )}
          </div>
        </div>

        {/* Topics */}
        {(feedback.weak_topics?.length > 0 || feedback.strong_topics?.length > 0) && (
          <div style={{
            background: 'var(--surface-1)', border: '1px solid var(--border)',
            borderRadius: 'var(--radius-lg)', padding: 16, display: 'flex', gap: 24, flexWrap: 'wrap'
          }}>
            <TopicList title="Needs work" topics={feedback.weak_topics || []} color="var(--danger)" />
            <div style={{ width: 1, background: 'var(--border)', flexShrink: 0 }} />
            <TopicList title="Strong areas" topics={feedback.strong_topics || []} color="var(--success)" />
          </div>
        )}

        {/* Examiner comment */}
        {feedback.overall_comment && (
          <div style={{
            background: 'var(--surface-2)', border: '1px solid var(--border)',
            borderRadius: 'var(--radius)', padding: '12px 16px',
            fontSize: 13, lineHeight: 1.7, color: 'var(--ink-2)', fontStyle: 'italic'
          }}>
            "{feedback.overall_comment}"
          </div>
        )}

        {/* Questions */}
        <div>
          <h2 style={{ fontSize: 11, fontWeight: 500, color: 'var(--ink-3)', marginBottom: 12, textTransform: 'uppercase', letterSpacing: '0.07em' }}>
            Question Review
          </h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {questions.map((q, i) => (
              <QuestionCard key={q.id || i} question={q} index={i} mode="review" />
            ))}
          </div>
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', gap: 10 }}>
          {feedback.weak_topics?.length > 0 && (
            <button
              className="btn btn-primary"
              onClick={generateNextExam}
              disabled={generatingNext}
              style={{ flex: 1, justifyContent: 'center' }}
            >
              {generatingNext ? 'Generating…' : '→ Practice weak topics'}
            </button>
          )}
          <button
            className="btn"
            onClick={() => setActiveView('analytics')}
            style={{ flex: 1, justifyContent: 'center' }}
          >
            View analytics
          </button>
        </div>

        <div style={{ height: 40 }} />
      </div>
    </div>
  )
}

function StatRow({ label, value }) {
  return (
    <div style={{ display: 'flex', gap: 8, alignItems: 'baseline' }}>
      <span style={{ color: 'var(--ink-3)' }}>{label}</span>
      <span style={{ color: 'var(--ink-1)', fontWeight: 500 }}>{value}</span>
    </div>
  )
}

function TopicList({ title, topics, color }) {
  return (
    <div style={{ flex: 1 }}>
      <div style={{ fontSize: 11, color, fontWeight: 500, marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
        {title}
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
        {topics.length > 0
          ? topics.map(t => <span key={t} className="tag" style={{ borderColor: `${color}40`, color }}>{t}</span>)
          : <span style={{ color: 'var(--ink-3)', fontSize: 12 }}>None identified</span>
        }
      </div>
    </div>
  )
}
