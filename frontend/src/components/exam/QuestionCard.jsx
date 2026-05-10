import { useState } from 'react'
import { renderLatex } from '../../lib/latex.js'
import { apiClient } from '../../lib/api.js'
import MathEditor from '../editor/MathEditor.jsx'

// Every piece of AI-generated text goes through this
const L = ({ children, style }) => (
  <div
    dangerouslySetInnerHTML={{ __html: renderLatex(String(children || '')) }}
    style={{ lineHeight: 1.9, ...style }}
  />
)

// Inline version
const Li = ({ children }) => (
  <span dangerouslySetInnerHTML={{ __html: renderLatex(String(children || '')) }} />
)

function Label({ children }) {
  return (
    <div style={{ fontSize: 10, color: 'var(--ink-3)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
      {children}
    </div>
  )
}

export default function QuestionCard({ question, index, answer, onChange, mode = 'exam' }) {
  const [showScheme, setShowScheme] = useState(false)
  const [showAppeal, setShowAppeal] = useState(false)
  const [appealText, setAppealText] = useState('')
  const [appealing, setAppealing] = useState(false)
  const [appealResult, setAppealResult] = useState(question.appealResult || null)
  const [localScoredMarks, setLocalScoredMarks] = useState(question.scoredMarks ?? 0)

  const scored = localScoredMarks
  const total = question.marks ?? 0

  const status = mode === 'review'
    ? (scored >= total && total > 0 ? 'correct' : scored > 0 ? 'partial' : 'incorrect')
    : answer?.trim() ? 'answered' : ''

  const borderColor = {
    correct: 'rgba(74,222,128,0.35)',
    partial: 'rgba(251,191,36,0.35)',
    incorrect: 'rgba(255,95,95,0.35)',
    answered: 'rgba(124,106,255,0.35)',
  }[status] || 'var(--border)'

  const statusIcon = { correct: '✓', incorrect: '✗', partial: '~' }[status] || String(index + 1)
  const statusBg = {
    correct: 'var(--success-dim)', incorrect: 'var(--danger-dim)',
    partial: 'var(--warning-dim)', answered: 'var(--accent-dim)',
  }[status] || 'var(--surface-3)'
  const statusColor = {
    correct: 'var(--success)', incorrect: 'var(--danger)',
    partial: 'var(--warning)', answered: '#c4bbff',
  }[status] || 'var(--ink-3)'

  async function submitAppeal() {
    if (!appealText.trim() || !question.attemptId || !question.id) return
    setAppealing(true)
    try {
      const result = await apiClient.appealMark(question.attemptId, question.id, appealText)
      const newMarks = Math.min(result.new_scored_marks ?? scored, total)
      setLocalScoredMarks(newMarks)
      setAppealResult({
        upheld: result.appeal_upheld,
        response: result.examiner_response,
        previousMarks: scored,
        newMarks,
      })
      setShowAppeal(false)
      setAppealText('')
    } catch (e) {
      alert('Appeal failed: ' + e.message)
    } finally {
      setAppealing(false)
    }
  }

  return (
    <div style={{
      background: 'var(--surface-1)',
      border: `1px solid ${borderColor}`,
      borderRadius: 'var(--radius-lg)',
      transition: 'border-color 0.15s',
    }}>
      {/* Question header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, padding: '14px 16px 10px' }}>
        <div style={{
          width: 26, height: 26, borderRadius: '50%', flexShrink: 0, marginTop: 2,
          background: statusBg, color: statusColor,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 11, fontWeight: 600,
        }}>
          {statusIcon}
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8, flexWrap: 'wrap' }}>
            {question.difficulty && (
              <span className={`tag ${question.difficulty === 'hard' ? 'tag-danger' : question.difficulty === 'easy' ? 'tag-success' : ''}`}>
                {question.difficulty}
              </span>
            )}
            {question.topics?.map(t => <span key={t} className="tag tag-accent">{t}</span>)}
            <span style={{ marginLeft: 'auto', fontSize: 11, color: mode === 'review' ? statusColor : 'var(--ink-3)', flexShrink: 0 }}>
              {mode === 'review' ? `${scored}/${total} marks` : `${total} ${total === 1 ? 'mark' : 'marks'}`}
            </span>
          </div>
          <L>{question.question}</L>
        </div>
      </div>

      {/* Exam: answer input */}
      {mode === 'exam' && (
        <div style={{ padding: '0 16px 16px' }}>
          <Label>Your answer</Label>
          <MathEditor
            value={answer || ''}
            onChange={onChange}
            placeholder="Write your answer here. Type keywords then Space to expand: frac, sqrt, sup, lim, leq, in, implies…"
          />
        </div>
      )}

      {/* Review: full feedback */}
      {mode === 'review' && (
        <div style={{ borderTop: '1px solid var(--border)', padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 14 }}>

          {/* Student answer */}
          <div>
            <Label>Your answer</Label>
            <div style={{ background: 'var(--surface-2)', borderRadius: 'var(--radius)', padding: '10px 14px', minHeight: 36 }}>
              {question.studentAnswer?.trim()
                ? <L>{question.studentAnswer}</L>
                : <span style={{ color: 'var(--ink-3)', fontStyle: 'italic', fontSize: 12 }}>No answer submitted</span>
              }
            </div>
          </div>

          {/* Overall verdict */}
          {question.feedback?.overall && (
            <div style={{
              background: status === 'correct' ? 'var(--success-dim)' : status === 'partial' ? 'var(--warning-dim)' : 'var(--danger-dim)',
              border: `1px solid ${status === 'correct' ? 'rgba(74,222,128,0.2)' : status === 'partial' ? 'rgba(251,191,36,0.2)' : 'rgba(255,95,95,0.2)'}`,
              borderRadius: 'var(--radius)', padding: '9px 12px',
              color: status === 'correct' ? 'var(--success)' : status === 'partial' ? 'var(--warning)' : 'var(--danger)',
            }}>
              <L style={{ fontSize: 12 }}>{question.feedback.overall}</L>
            </div>
          )}

          {/* Step by step */}
          {question.feedback?.steps?.length > 0 && (
            <div>
              <Label>Step by step</Label>
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                {question.feedback.steps.map((step, i) => (
                  <div key={i} style={{
                    display: 'flex', gap: 10, padding: '10px 0',
                    borderBottom: i < question.feedback.steps.length - 1 ? '1px solid var(--border)' : 'none',
                  }}>
                    <div style={{
                      width: 20, height: 20, borderRadius: '50%', flexShrink: 0, marginTop: 3,
                      background: step.awarded ? 'var(--success-dim)' : 'var(--danger-dim)',
                      color: step.awarded ? 'var(--success)' : 'var(--danger)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10,
                    }}>
                      {step.awarded ? '✓' : '✗'}
                    </div>
                    <div style={{ flex: 1 }}>
                      {/* Description — always LaTeX-rendered */}
                      <div style={{ fontWeight: 500, marginBottom: 3 }}>
                        <Li>{step.description}</Li>
                        {step.marks > 0 && (
                          <span style={{ color: 'var(--ink-3)', fontWeight: 400, fontSize: 11, marginLeft: 6 }}>
                            ({step.marks} {step.marks === 1 ? 'mark' : 'marks'})
                          </span>
                        )}
                      </div>
                      {/* Comment */}
                      {step.comment && (
                        <div style={{ marginBottom: step.correct_working ? 6 : 0 }}>
                          <L style={{ fontSize: 12, color: 'var(--ink-2)' }}>{step.comment}</L>
                        </div>
                      )}
                      {/* Correct working */}
                      {step.correct_working && (
                        <div style={{
                          background: 'var(--surface-2)', border: '1px solid var(--border)',
                          borderRadius: 6, padding: '6px 10px', marginTop: 4,
                        }}>
                          <div style={{ fontSize: 9, color: 'var(--ink-3)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 3 }}>Correct working</div>
                          <L style={{ fontSize: 13 }}>{step.correct_working}</L>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Correct answer */}
          {question.correctAnswer && (
            <div>
              <Label>{scored >= total ? 'Model answer' : 'Correct answer'}</Label>
              <div style={{
                background: 'var(--surface-2)', border: '1px solid rgba(74,222,128,0.15)',
                borderRadius: 'var(--radius)', padding: '12px 14px',
              }}>
                <L style={{ fontSize: 13 }}>{question.correctAnswer}</L>
              </div>
            </div>
          )}

          {/* Misconceptions */}
          {question.feedback?.misconceptions?.filter(Boolean).length > 0 && (
            <div>
              <Label>Misconceptions</Label>
              {question.feedback.misconceptions.filter(Boolean).map((m, i) => (
                <div key={i} style={{
                  background: 'var(--warning-dim)', border: '1px solid rgba(251,191,36,0.2)',
                  borderRadius: 'var(--radius)', padding: '7px 11px', marginBottom: 4,
                  color: 'var(--warning)',
                }}>
                  <L style={{ fontSize: 12 }}>{'⚠ ' + m}</L>
                </div>
              ))}
            </div>
          )}

          {/* Alternatives */}
          {question.feedback?.alternatives?.filter(Boolean).length > 0 && (
            <div>
              <Label>Valid alternative approaches</Label>
              {question.feedback.alternatives.filter(Boolean).map((alt, i) => (
                <div key={i} style={{
                  background: 'var(--surface-2)', borderRadius: 'var(--radius)',
                  padding: '8px 12px', marginBottom: 4,
                }}>
                  <L style={{ fontSize: 13 }}>{alt}</L>
                </div>
              ))}
            </div>
          )}

          {/* Appeal result banner */}
          {appealResult && (
            <div style={{
              background: appealResult.upheld ? 'var(--success-dim)' : 'var(--surface-2)',
              border: `1px solid ${appealResult.upheld ? 'rgba(74,222,128,0.25)' : 'var(--border)'}`,
              borderRadius: 'var(--radius)', padding: '10px 12px',
            }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: appealResult.upheld ? 'var(--success)' : 'var(--ink-2)', marginBottom: 4 }}>
                {appealResult.upheld ? '✓ Appeal upheld' : '✗ Appeal rejected'}
                {appealResult.upheld && appealResult.previousMarks !== undefined && (
                  <span style={{ fontWeight: 400, marginLeft: 8 }}>
                    {appealResult.previousMarks} → {appealResult.newMarks} marks
                  </span>
                )}
              </div>
              <L style={{ fontSize: 12, color: 'var(--ink-2)' }}>{appealResult.response}</L>
            </div>
          )}

          {/* Appeal input */}
          {question.attemptId && !showAppeal && (
            <button className="btn btn-ghost" style={{ fontSize: 11, padding: '3px 0', alignSelf: 'flex-start' }}
              onClick={() => setShowAppeal(true)}>
              Appeal this mark
            </button>
          )}
          {showAppeal && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <Label>Appeal reason</Label>
              <textarea
                className="input"
                value={appealText}
                onChange={e => setAppealText(e.target.value)}
                placeholder="Explain specifically why the marking is wrong. Reference the question wording and your original answer."
                style={{ minHeight: 80, fontSize: 12, lineHeight: 1.6 }}
              />
              <p style={{ fontSize: 10, color: 'var(--ink-3)' }}>
                Note: the examiner will review your original answer as submitted — you cannot change it.
              </p>
              <div style={{ display: 'flex', gap: 6 }}>
                <button
                  className="btn btn-primary"
                  disabled={appealing || !appealText.trim()}
                  onClick={submitAppeal}
                  style={{ fontSize: 11 }}
                >
                  {appealing ? 'Submitting…' : 'Submit appeal'}
                </button>
                <button className="btn btn-ghost" style={{ fontSize: 11 }}
                  onClick={() => { setShowAppeal(false); setAppealText('') }}>
                  Cancel
                </button>
              </div>
            </div>
          )}

          {/* Marking scheme */}
          <div>
            <button className="btn btn-ghost" style={{ fontSize: 11, padding: '3px 0' }}
              onClick={() => setShowScheme(!showScheme)}>
              {showScheme ? '↑ Hide' : '↓ Show'} marking scheme
            </button>
            {showScheme && question.markingScheme && (
              <div style={{
                marginTop: 8, background: 'var(--surface-2)',
                borderRadius: 'var(--radius)', padding: '12px 14px',
              }} className="animate-fade-in">
                <L style={{ fontSize: 12 }}>{question.markingScheme}</L>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
