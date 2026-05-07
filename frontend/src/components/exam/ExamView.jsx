import { useState, useEffect, useCallback } from 'react'
import useStore from '../../lib/store.js'
import { apiClient } from '../../lib/api.js'
import { debounce, percentage, gradeLabel } from '../../lib/utils.js'
import QuestionCard from './QuestionCard.jsx'
import TimerDisplay from './TimerDisplay.jsx'
import OpenBookSidebar from './OpenBookSidebar.jsx'
import toast from 'react-hot-toast'

export default function ExamView() {
  const {
    activeAttempt, setActiveAttempt, updateAnswer,
    setActiveView, markingExam, setMarkingExam,
    files, addAttempt
  } = useStore()

  const [submitting, setSubmitting] = useState(false)
  const [confirmSubmit, setConfirmSubmit] = useState(false)
  const [timerExpired, setTimerExpired] = useState(false)

  const exam = activeAttempt?.exam
  const questions = exam?.questions_json || []
  const answers = activeAttempt?.answers || {}
  const settings = exam?.settings_json || {}
  const sessionFiles = files[exam?.session_id] || []

  const answeredCount = Object.keys(answers).filter(k => answers[k]?.trim()).length

  // Autosave
  const autosave = useCallback(
    debounce(async (attemptId, answerData) => {
      try {
        await apiClient.saveAttempt(attemptId, {
          answers_json: answerData,
          timer_state_json: null,
          status: 'in_progress'
        })
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
      // Submit the attempt
      const submitted = await apiClient.submitAttempt(activeAttempt.id, {
        answers_json: answers,
        auto_submitted: auto
      })

      // Trigger marking
      setMarkingExam(true)
      toast.loading('AI is marking your exam...', { id: 'marking' })

      const marked = await apiClient.markAttempt(activeAttempt.id)
      toast.success('Marking complete!', { id: 'marking' })

      // Update attempt with feedback
      setActiveAttempt({ ...activeAttempt, ...marked, exam })
      addAttempt(exam.id, marked)
      setActiveView('review')
    } catch (e) {
      toast.error(e.message || 'Failed to submit exam')
    } finally {
      setSubmitting(false)
      setMarkingExam(false)
    }
  }

  function handleTimerExpire() {
    setTimerExpired(true)
    if (settings.autoSubmit) {
      submitExam(true)
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
      {/* Main exam area */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {/* Header */}
        <div style={{
          padding: '14px 24px', borderBottom: '1px solid var(--border)',
          display: 'flex', alignItems: 'center', gap: 16, flexShrink: 0,
          background: 'var(--surface-1)'
        }}>
          <div style={{ flex: 1 }}>
            <h1 style={{ fontSize: 14, fontFamily: 'Instrument Serif, serif', color: 'var(--ink-1)', marginBottom: 2 }}>
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
          <div style={{ position: 'relative', width: 44, height: 44, flexShrink: 0 }}>
            <svg width="44" height="44" viewBox="0 0 44 44" style={{ transform: 'rotate(-90deg)' }}>
              <circle cx="22" cy="22" r="18" fill="none" stroke="var(--surface-3)" strokeWidth="3"/>
              <circle
                cx="22" cy="22" r="18" fill="none" stroke="var(--accent)"
                strokeWidth="3"
                strokeDasharray={`${2 * Math.PI * 18}`}
                strokeDashoffset={`${2 * Math.PI * 18 * (1 - answeredCount / Math.max(questions.length, 1))}`}
                strokeLinecap="round"
                style={{ transition: 'stroke-dashoffset 0.4s ease' }}
              />
            </svg>
            <div style={{
              position: 'absolute', inset: 0, display: 'flex',
              alignItems: 'center', justifyContent: 'center',
              fontSize: 10, color: 'var(--ink-2)'
            }}>
              {Math.round(answeredCount / Math.max(questions.length, 1) * 100)}%
            </div>
          </div>

          {/* Timer */}
          {settings.timerEnabled && (
            <div style={{ minWidth: 160 }}>
              <TimerDisplay
                durationMinutes={settings.timerDuration}
                onExpire={handleTimerExpire}
                autoSubmit={settings.autoSubmit}
              />
            </div>
          )}

          <button
            className="btn btn-ghost"
            onClick={() => {
              if (confirm('Exit exam? Progress will be saved.')) {
                setActiveView('session')
              }
            }}
            style={{ color: 'var(--ink-3)' }}
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

          {/* Submit area */}
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
                  Submit for marking? You cannot change answers after.
                </span>
                <button className="btn btn-danger" onClick={() => submitExam(false)}>
                  {submitting ? 'Submitting...' : 'Confirm submit'}
                </button>
                <button className="btn btn-ghost" onClick={() => setConfirmSubmit(false)}>
                  Cancel
                </button>
              </div>
            ) : (
              <button
                className="btn btn-primary"
                onClick={() => submitExam(false)}
                disabled={submitting || markingExam}
                style={{ width: '100%', justifyContent: 'center', padding: '10px' }}
              >
                {submitting ? 'Submitting...' : markingExam ? 'Marking...' : 'Submit Exam'}
              </button>
            )}
          </div>

          <div style={{ height: 40 }} />
        </div>
      </div>

      {/* Open book sidebar */}
      {settings.openBook && <OpenBookSidebar files={sessionFiles} />}
    </div>
  )
}
