import { useState } from 'react'
import { renderLatex, renderMath } from '../../lib/latex.js'
import MathEditor from '../editor/MathEditor.jsx'

const Latex = ({ children, display }) => (
  <span dangerouslySetInnerHTML={{ __html: renderMath(String(children || ''), display) }} />
)
const LatexBlock = ({ children, style }) => (
  <div dangerouslySetInnerHTML={{ __html: renderLatex(String(children || '')) }} style={{ lineHeight: 1.9, ...style }} />
)

export default function QuestionCard({ question, index, answer, onChange, mode = 'exam' }) {
  const [showScheme, setShowScheme] = useState(false)

  const scored = question.scoredMarks ?? 0
  const total = question.marks ?? 0
  const status = mode === 'review'
    ? (question.isCorrect ? 'correct' : scored > 0 ? 'partial' : 'incorrect')
    : answer?.trim() ? 'answered' : ''

  const borderColor = {
    correct: 'rgba(74,222,128,0.35)', partial: 'rgba(251,191,36,0.35)',
    incorrect: 'rgba(255,95,95,0.35)', answered: 'rgba(124,106,255,0.35)'
  }[status] || 'var(--border)'

  const statusIcon = { correct: '✓', incorrect: '✗', partial: '~' }[status] || String(index + 1)
  const statusBg = { correct: 'var(--success-dim)', incorrect: 'var(--danger-dim)', partial: 'var(--warning-dim)', answered: 'var(--accent-dim)' }[status] || 'var(--surface-3)'
  const statusColor = { correct: 'var(--success)', incorrect: 'var(--danger)', partial: 'var(--warning)', answered: '#c4bbff' }[status] || 'var(--ink-3)'

  return (
    <div style={{ background: 'var(--surface-1)', border: `1px solid ${borderColor}`, borderRadius: 'var(--radius-lg)', transition: 'border-color 0.15s' }}>

      {/* Question header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, padding: '14px 16px 10px' }}>
        <div style={{ width: 26, height: 26, borderRadius: '50%', flexShrink: 0, marginTop: 2, background: statusBg, color: statusColor, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 600 }}>
          {statusIcon}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8, flexWrap: 'wrap' }}>
            {question.difficulty && (
              <span className={`tag ${question.difficulty === 'hard' ? 'tag-danger' : question.difficulty === 'easy' ? 'tag-success' : ''}`}>{question.difficulty}</span>
            )}
            {question.topics?.map(t => <span key={t} className="tag tag-accent">{t}</span>)}
            <span style={{ marginLeft: 'auto', fontSize: 11, color: mode === 'review' ? statusColor : 'var(--ink-3)', flexShrink: 0 }}>
              {mode === 'review' ? `${scored}/${total} marks` : `${total} ${total === 1 ? 'mark' : 'marks'}`}
            </span>
          </div>
          <LatexBlock>{question.question}</LatexBlock>
        </div>
      </div>

      {/* Exam: answer input */}
      {mode === 'exam' && (
        <div style={{ padding: '0 16px 16px' }}>
          <div style={{ fontSize: 10, color: 'var(--ink-3)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Your answer</div>
          <MathEditor
            value={answer || ''}
            onChange={onChange}
            placeholder="Write your answer here. Type \frac{}{}, \sqrt{}, \sup_D f, etc. or use the toolbar."
          />
        </div>
      )}

      {/* Review: feedback */}
      {mode === 'review' && (
        <div style={{ borderTop: '1px solid var(--border)', padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 14 }}>

          {/* Student answer */}
          <div>
            <Label>Your answer</Label>
            <div style={{ background: 'var(--surface-2)', borderRadius: 'var(--radius)', padding: '10px 14px', fontSize: 13, minHeight: 36 }}>
              {question.studentAnswer?.trim()
                ? <LatexBlock>{question.studentAnswer}</LatexBlock>
                : <span style={{ color: 'var(--ink-3)', fontStyle: 'italic' }}>No answer submitted</span>
              }
            </div>
          </div>

          {/* Overall verdict */}
          {question.feedback?.overall && (
            <div style={{
              background: status === 'correct' ? 'var(--success-dim)' : status === 'partial' ? 'var(--warning-dim)' : 'var(--danger-dim)',
              border: `1px solid ${status === 'correct' ? 'rgba(74,222,128,0.2)' : status === 'partial' ? 'rgba(251,191,36,0.2)' : 'rgba(255,95,95,0.2)'}`,
              borderRadius: 'var(--radius)', padding: '9px 12px', fontSize: 12, lineHeight: 1.7,
              color: status === 'correct' ? 'var(--success)' : status === 'partial' ? 'var(--warning)' : 'var(--danger)'
            }}>
              {question.feedback.overall}
            </div>
          )}

          {/* Step by step */}
          {question.feedback?.steps?.length > 0 && (
            <div>
              <Label>Step by step</Label>
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                {question.feedback.steps.map((step, i) => (
                  <div key={i} style={{ display: 'flex', gap: 10, padding: '10px 0', borderBottom: i < question.feedback.steps.length - 1 ? '1px solid var(--border)' : 'none' }}>
                    <div style={{ width: 20, height: 20, borderRadius: '50%', flexShrink: 0, marginTop: 2, background: step.awarded ? 'var(--success-dim)' : 'var(--danger-dim)', color: step.awarded ? 'var(--success)' : 'var(--danger)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10 }}>
                      {step.awarded ? '✓' : '✗'}
                    </div>
                    <div style={{ flex: 1 }}>
                      {/* Step title — plain English */}
                      <div style={{ fontSize: 12, color: 'var(--ink-1)', fontWeight: 500, marginBottom: 3 }}>
                        {step.description}
                        {step.marks > 0 && <span style={{ color: 'var(--ink-3)', fontWeight: 400, fontSize: 11, marginLeft: 6 }}>({step.marks} {step.marks === 1 ? 'mark' : 'marks'})</span>}
                      </div>
                      {/* Comment */}
                      {step.comment && (
                        <div style={{ fontSize: 12, color: 'var(--ink-2)', marginBottom: 6, lineHeight: 1.7 }}>{step.comment}</div>
                      )}
                      {/* Correct working for this step */}
                      {step.correct_working && (
                        <div style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 6, padding: '6px 10px', marginTop: 4 }}>
                          <span style={{ fontSize: 10, color: 'var(--ink-3)', display: 'block', marginBottom: 3, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Correct working</span>
                          <LatexBlock style={{ fontSize: 13 }}>{step.correct_working}</LatexBlock>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Correct answer — always shown */}
          {question.correctAnswer && (
            <div>
              <Label>{question.isCorrect ? 'Model answer' : 'Correct answer'}</Label>
              <div style={{ background: 'var(--surface-2)', border: '1px solid rgba(74,222,128,0.15)', borderRadius: 'var(--radius)', padding: '12px 14px' }}>
                <LatexBlock style={{ fontSize: 13 }}>{question.correctAnswer}</LatexBlock>
              </div>
            </div>
          )}

          {/* Misconceptions */}
          {question.feedback?.misconceptions?.filter(Boolean).length > 0 && (
            <div>
              <Label>Misconceptions</Label>
              {question.feedback.misconceptions.filter(Boolean).map((m, i) => (
                <div key={i} style={{ background: 'var(--warning-dim)', border: '1px solid rgba(251,191,36,0.2)', borderRadius: 'var(--radius)', padding: '7px 11px', marginBottom: 4, fontSize: 12, color: 'var(--warning)', lineHeight: 1.6 }}>
                  ⚠ {m}
                </div>
              ))}
            </div>
          )}

          {/* Alternative approaches */}
          {question.feedback?.alternatives?.filter(Boolean).length > 0 && (
            <div>
              <Label>Valid alternative approaches</Label>
              {question.feedback.alternatives.filter(Boolean).map((alt, i) => (
                <div key={i} style={{ background: 'var(--surface-2)', borderRadius: 'var(--radius)', padding: '8px 12px', marginBottom: 4 }}>
                  <LatexBlock style={{ fontSize: 13 }}>{alt}</LatexBlock>
                </div>
              ))}
            </div>
          )}

          {/* Marking scheme */}
          <div>
            <button className="btn btn-ghost" style={{ fontSize: 11, padding: '3px 0' }} onClick={() => setShowScheme(!showScheme)}>
              {showScheme ? '↑ Hide' : '↓ Show'} marking scheme
            </button>
            {showScheme && question.markingScheme && (
              <div style={{ marginTop: 8, background: 'var(--surface-2)', borderRadius: 'var(--radius)', padding: '12px 14px' }} className="animate-fade-in">
                <LatexBlock style={{ fontSize: 12 }}>{question.markingScheme}</LatexBlock>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

function Label({ children }) {
  return <div style={{ fontSize: 10, color: 'var(--ink-3)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{children}</div>
}
