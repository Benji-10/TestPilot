import { useState, useCallback } from 'react'
import useStore from '../../lib/store.js'
import { apiClient } from '../../lib/api.js'
import { debounce } from '../../lib/utils.js'
import QuestionCard from './QuestionCard.jsx'
import TimerDisplay from './TimerDisplay.jsx'
import OpenBookSidebar from './OpenBookSidebar.jsx'
import toast from 'react-hot-toast'

export default function ExamView() {
  const {
    activeAttempt, setActiveAttempt, updateAnswer,
    setActiveView, setMarkingExam, markingExam,
    files, addAttempt
  } = useStore()

  const [submitting, setSubmitting] = useState(false)
  const [confirmSubmit, setConfirmSubmit] = useState(false)

  const exam = activeAttempt?.exam
  const questions = exam?.questions_json || []
  const answers = activeAttempt?.answers || {}
  const settings = exam?.settings_json || {}
  const sessionFiles = files[exam?.session_id] || []

  const answeredCount = Object.values(answers).filter(v => v?.trim()).length

  const autosave = useCallback(
    debounce(async (attemptId, answerData) => {
      try {
        await apiClient.saveAttempt(attemptId, { answers_json: answerData })
      } catch {}
    }, 2000),
    []
  )

  function handleAnswerChange(questionId, value) {
    updateAnswer(questionId, value)
    if (activeAttempt?.id) {
      autosave(activeAttempt.id, { ...answers, [questionId]: value })
    }
  }

  async function submitExam(auto = false) {
    if (!auto && !confirmSubmit) {
      setConfirmSubmit(true)
      return
    }
    setConfirmSubmit(false)
    setSubmitting(true)

    try {
      await apiClient.submitAttempt(activeAttempt.id, { answers_json: answers })

      setMarkingExam(true)
      const toastId = toast.loading('AI is marking your exam…')

      const marked = await apiClient.markAttempt(activeAttempt.id)
      toast.success('Marking complete!', { id: toastId })

      setActiveAttempt({ ...activeAttempt, ...marked, exam })
      addAttempt(exam.id, marked)
      setActiveView('review')
    } catch (e) {
      toast.error(e.message || 'Failed to submit')
    } finally {
      setSubmitting(false)
      setMarkingExam(false)
    }
  }

  if (!exam) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--ink-3)' }}>
        No exam loaded
      </div>
    )
  }

  return (
    <div style={{ height: '100%', display: 'flex', overflow: 'hidden' }}>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

        {/* Header */}
        <div style={{
          padding: '12px 24px', borderBottom: '1px solid var(--border)',
          display: 'flex', alignItems: 'center', gap: 16, flexShrink: 0,
          background: 'var(--surface-1)'
        }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <h1 style={{ fontSize: 14, fontFamily: 'Instrument Serif, serif', color: 'var(--ink-1)', marginBottom: 1 }}>
              {exam.title}
            </h1>
            <div style={{ display: 'flex', gap: 12, fontSize: 11, color: 'var(--ink-3)' }}>
              <span>{questions.length} questions</span>
              <span>{exam.total_marks} marks</span>
              <span style={{ color: answeredCount === questions.length ? 'var(--success)' : 'var(--ink-3)' }}>
                {answeredCount}/{questions.length} answered
              </span>
            </div>
          </div>

          {/* Progress ring */}
          <svg width="36" height="36" viewBox="0 0 36 36" style={{ transform: 'rotate(-90deg)', flexShrink: 0 }}>
            <circle cx="18" cy="18" r="14" fill="none" stroke="var(--surface-3)" strokeWidth="3"/>
            <circle cx="18" cy="18" r="14" fill="none" stroke="var(--accent)" strokeWidth="3"
              strokeDasharray={`${2 * Math.PI * 14}`}
              strokeDashoffset={`${2 * Math.PI * 14 * (1 - answeredCount / Math.max(questions.length, 1))}`}
              strokeLinecap="round" style={{ transition: 'stroke-dashoffset 0.4s ease' }}
            />
          </svg>

          {settings.timerEnabled && (
            <TimerDisplay
              durationMinutes={settings.timerDuration}
              onExpire={() => settings.autoSubmit && submitExam(true)}
              autoSubmit={settings.autoSubmit}
            />
          )}

          <button
            className="btn btn-ghost"
            style={{ color: 'var(--ink-3)', flexShrink: 0 }}
            onClick={() => {
              if (confirm('Exit? Your progress is saved.')) setActiveView('session')
            }}
          >
            ← Exit
          </button>
        </div>

        {/* Questions */}
        <div className="scroll-y" style={{ flex: 1, padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 16 }}>
          {questions.map((q, i) => (
            <QuestionCard
              key={q.id || i}
              question={q}
              index={i}
              answer={answers[q.id]}
              onChange={(val) => handleAnswerChange(q.id, val)}
              mode="exam"
            />
          ))}

          {/* Submit */}
          <div style={{
            background: 'var(--surface-1)', border: '1px solid var(--border)',
            borderRadius: 'var(--radius-lg)', padding: 16, marginTop: 8
          }}>
            {answeredCount < questions.length && (
              <div style={{
                background: 'var(--warning-dim)', border: '1px solid rgba(251,191,36,0.2)',
                borderRadius: 'var(--radius)', padding: '8px 12px', marginBottom: 12,
                fontSize: 12, color: 'var(--warning)'
              }}>
                ⚠ {questions.length - answeredCount} question{questions.length - answeredCount !== 1 ? 's' : ''} unanswered
              </div>
            )}

            {confirmSubmit ? (
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <span style={{ fontSize: 12, color: 'var(--ink-2)', flex: 1 }}>
                  Submit for AI marking? You can't change answers after.
                </span>
                <button className="btn btn-primary" onClick={() => submitExam(false)} disabled={submitting || markingExam}>
                  {submitting || markingExam ? 'Working…' : 'Confirm'}
                </button>
                <button className="btn btn-ghost" onClick={() => setConfirmSubmit(false)}>Cancel</button>
              </div>
            ) : (
              <button
                className="btn btn-primary"
                onClick={() => submitExam(false)}
                disabled={submitting || markingExam}
                style={{ width: '100%', justifyContent: 'center', padding: '10px' }}
              >
                {markingExam ? 'Marking…' : submitting ? 'Submitting…' : 'Submit Exam'}
              </button>
            )}
          </div>

          <div style={{ height: 40 }} />
        </div>
      </div>

      {settings.openBook && <OpenBookSidebar files={sessionFiles} exam={exam} />}
    </div>
  )
}
