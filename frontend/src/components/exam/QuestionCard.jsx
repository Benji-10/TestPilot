import { useState } from 'react'
import katex from 'katex'
import MathEditor from '../editor/MathEditor.jsx'

function renderLatex(text) {
  if (!text) return ''
  // Handle $$display$$ first, then $inline$
  return String(text)
    .replace(/\$\$([\s\S]+?)\$\$/g, (_, expr) => {
      try { return katex.renderToString(expr, { displayMode: true, throwOnError: false }) }
      catch { return expr }
    })
    .replace(/\$([^$\n]+?)\$/g, (_, expr) => {
      try { return katex.renderToString(expr, { displayMode: false, throwOnError: false }) }
      catch { return expr }
    })
    .replace(/\n/g, '<br/>')
}

// Render a field that should be LaTeX — wrap bare expressions automatically
function renderExpected(text) {
  if (!text) return ''
  const s = String(text).trim()
  // Already has delimiters
  if (s.includes('$') || s.includes('\\begin')) return renderLatex(s)
  // Looks like LaTeX — wrap it
  if (/[\\^_{}]|\\[a-zA-Z]/.test(s)) {
    try { return katex.renderToString(s, { displayMode: false, throwOnError: false }) }
    catch { return s }
  }
  return s
}

export default function QuestionCard({ question, index, answer, onChange, mode = 'exam' }) {
  const [showScheme, setShowScheme] = useState(false)
  const [showCorrect, setShowCorrect] = useState(false)

  const status = mode === 'review'
    ? (question.isCorrect ? 'correct' : question.scoredMarks > 0 ? 'partial' : 'incorrect')
    : answer?.trim() ? 'answered' : ''

  const borderColor = status === 'correct' ? 'rgba(74,222,128,0.3)'
    : status === 'partial' ? 'rgba(251,191,36,0.3)'
    : status === 'incorrect' ? 'rgba(255,95,95,0.3)'
    : status === 'answered' ? 'rgba(124,106,255,0.3)'
    : 'var(--border)'

  return (
    <div style={{
      background: 'var(--surface-1)', border: `1px solid ${borderColor}`,
      borderRadius: 'var(--radius-lg)', transition: 'border-color 0.15s ease'
    }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, padding: '14px 16px 10px' }}>
        <div style={{
          width: 26, height: 26, borderRadius: '50%', flexShrink: 0, marginTop: 1,
          background: status === 'correct' ? 'var(--success-dim)'
            : status === 'partial' ? 'var(--warning-dim)'
            : status === 'incorrect' ? 'var(--danger-dim)'
            : status === 'answered' ? 'var(--accent-dim)' : 'var(--surface-3)',
          color: status === 'correct' ? 'var(--success)'
            : status === 'partial' ? 'var(--warning)'
            : status === 'incorrect' ? 'var(--danger)'
            : status === 'answered' ? '#c4bbff' : 'var(--ink-3)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 500
        }}>
          {status === 'correct' ? '✓' : status === 'incorrect' ? '✗' : status === 'partial' ? '~' : index + 1}
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          {/* Tags — but don't repeat the mark count as a standalone tag */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8, flexWrap: 'wrap' }}>
            {question.difficulty && (
              <span className={`tag ${question.difficulty === 'hard' ? 'tag-danger' : question.difficulty === 'easy' ? 'tag-success' : ''}`}>
                {question.difficulty}
              </span>
            )}
            {question.topics?.map(t => <span key={t} className="tag tag-accent">{t}</span>)}
            {mode === 'review' && (
              <span style={{ fontSize: 11, color: status === 'correct' ? 'var(--success)' : status === 'partial' ? 'var(--warning)' : 'var(--danger)', marginLeft: 'auto' }}>
                {question.scoredMarks ?? 0}/{question.marks} marks
              </span>
            )}
            {mode === 'exam' && question.marks && (
              <span style={{ fontSize: 11, color: 'var(--ink-3)', marginLeft: 'auto' }}>
                {question.marks} {question.marks === 1 ? 'mark' : 'marks'}
              </span>
            )}
          </div>

          {/* Question text */}
          <div
            dangerouslySetInnerHTML={{ __html: renderLatex(question.question) }}
            style={{ fontSize: 13, lineHeight: 1.9, color: 'var(--ink-1)' }}
          />
        </div>
      </div>

      {/* Exam mode: answer input */}
      {mode === 'exam' && (
        <div style={{ padding: '0 16px 16px' }}>
          <div style={{ fontSize: 10, color: 'var(--ink-3)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            Your answer
          </div>
          <MathEditor
            value={answer || ''}
            onChange={onChange}
            placeholder="Write your answer here. Use LaTeX for maths: \frac{1}{2}, \sqrt{x}, \sup_D f…"
          />
        </div>
      )}

      {/* Review mode: feedback */}
      {mode === 'review' && (
        <div style={{ borderTop: '1px solid var(--border)', padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 12 }}>

          {/* Student's answer rendered */}
          <div>
            <div style={{ fontSize: 10, color: 'var(--ink-3)', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Your answer</div>
            <div style={{ background: 'var(--surface-2)', borderRadius: 'var(--radius)', padding: '8px 12px', fontSize: 13, lineHeight: 1.8 }}>
              {question.studentAnswer?.trim() ? (
                <div dangerouslySetInnerHTML={{ __html: renderLatex(question.studentAnswer) }} />
              ) : (
                <span style={{ color: 'var(--ink-3)', fontStyle: 'italic' }}>No answer submitted</span>
              )}
            </div>
          </div>

          {/* Overall feedback */}
          {question.feedback?.overall && (
            <div style={{
              background: status === 'correct' ? 'var(--success-dim)' : status === 'partial' ? 'var(--warning-dim)' : 'var(--danger-dim)',
              border: `1px solid ${status === 'correct' ? 'rgba(74,222,128,0.2)' : status === 'partial' ? 'rgba(251,191,36,0.2)' : 'rgba(255,95,95,0.2)'}`,
              borderRadius: 'var(--radius)', padding: '8px 12px', fontSize: 12, lineHeight: 1.7,
              color: status === 'correct' ? 'var(--success)' : status === 'partial' ? 'var(--warning)' : 'var(--danger)'
            }}>
              {question.feedback.overall}
            </div>
          )}

          {/* Step-by-step */}
          {question.feedback?.steps?.length > 0 && (
            <div>
              <div style={{ fontSize: 10, color: 'var(--ink-3)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Step by step</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
                {question.feedback.steps.map((step, i) => (
                  <div key={i} style={{ display: 'flex', gap: 10, padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
                    <div style={{
                      width: 18, height: 18, borderRadius: '50%', flexShrink: 0, marginTop: 2,
                      background: step.awarded ? 'var(--success-dim)' : 'var(--danger-dim)',
                      color: step.awarded ? 'var(--success)' : 'var(--danger)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10
                    }}>
                      {step.awarded ? '✓' : '✗'}
                    </div>
                    <div style={{ flex: 1 }}>
                      {/* Step description — plain text */}
                      <div style={{ fontSize: 12, color: 'var(--ink-1)', marginBottom: 3 }}>
                        {step.description}
                        {step.marks > 0 && <span style={{ color: 'var(--ink-3)', fontSize: 11, marginLeft: 6 }}>({step.marks} {step.marks === 1 ? 'mark' : 'marks'})</span>}
                      </div>
                      {/* Examiner comment */}
                      {step.comment && (
                        <div style={{ fontSize: 11, color: 'var(--ink-2)', marginBottom: 4, lineHeight: 1.6 }}>{step.comment}</div>
                      )}
                      {/* Correct working for this step — always shown */}
                      {step.correct_working && (
                        <div style={{ background: 'var(--surface-2)', borderRadius: 6, padding: '5px 10px', fontSize: 12 }}>
                          <span style={{ fontSize: 10, color: 'var(--ink-3)', marginRight: 6 }}>Correct:</span>
                          <span dangerouslySetInnerHTML={{ __html: renderExpected(step.correct_working) }} />
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Correct answer — always shown if available */}
          {question.correctAnswer && (
            <div>
              <div style={{ fontSize: 10, color: 'var(--ink-3)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                {question.isCorrect ? 'Model answer' : 'Correct answer'}
              </div>
              <div style={{
                background: 'var(--surface-2)', border: '1px solid rgba(74,222,128,0.15)',
                borderRadius: 'var(--radius)', padding: '10px 14px', fontSize: 13, lineHeight: 1.9
              }}>
                <div dangerouslySetInnerHTML={{ __html: renderLatex(question.correctAnswer) }} />
              </div>
            </div>
          )}

          {/* Misconceptions */}
          {question.feedback?.misconceptions?.filter(Boolean).length > 0 && (
            <div>
              <div style={{ fontSize: 10, color: 'var(--ink-3)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Misconceptions</div>
              {question.feedback.misconceptions.filter(Boolean).map((m, i) => (
                <div key={i} style={{ background: 'var(--warning-dim)', border: '1px solid rgba(251,191,36,0.2)', borderRadius: 'var(--radius)', padding: '6px 10px', marginBottom: 4, fontSize: 12, color: 'var(--warning)' }}>
                  ⚠ {m}
                </div>
              ))}
            </div>
          )}

          {/* Alternatives */}
          {question.feedback?.alternatives?.filter(Boolean).length > 0 && (
            <div>
              <div style={{ fontSize: 10, color: 'var(--ink-3)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Alternative approaches</div>
              {question.feedback.alternatives.filter(Boolean).map((alt, i) => (
                <div key={i} style={{ background: 'var(--surface-2)', borderRadius: 'var(--radius)', padding: '6px 10px', marginBottom: 4, fontSize: 12 }}>
                  <div dangerouslySetInnerHTML={{ __html: renderLatex(alt) }} />
                </div>
              ))}
            </div>
          )}

          {/* Marking scheme toggle */}
          <div>
            <button className="btn btn-ghost" style={{ fontSize: 11, padding: '3px 0' }} onClick={() => setShowScheme(!showScheme)}>
              {showScheme ? 'Hide' : 'Show'} marking scheme
            </button>
            {showScheme && question.markingScheme && (
              <div style={{ marginTop: 8, background: 'var(--surface-2)', borderRadius: 'var(--radius)', padding: '10px 12px', fontSize: 12, lineHeight: 1.8 }} className="animate-fade-in">
                <div dangerouslySetInnerHTML={{ __html: renderLatex(question.markingScheme) }} />
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
