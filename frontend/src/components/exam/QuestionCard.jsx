import { useState } from 'react'
import katex from 'katex'
import MathEditor from '../editor/MathEditor.jsx'

export default function QuestionCard({ question, index, answer, onChange, mode = 'exam' }) {
  const [expanded, setExpanded] = useState(true)

  function renderLatex(text) {
    if (!text) return ''
    // Replace $$...$$ with display math and $...$ with inline math
    return text
      .replace(/\$\$(.*?)\$\$/gs, (_, expr) => {
        try { return katex.renderToString(expr, { displayMode: true, throwOnError: false }) }
        catch { return expr }
      })
      .replace(/\$([^$]+)\$/g, (_, expr) => {
        try { return katex.renderToString(expr, { displayMode: false, throwOnError: false }) }
        catch { return expr }
      })
  }

  const status = mode === 'review'
    ? (question.isCorrect ? 'correct' : 'incorrect')
    : answer?.trim() ? 'answered' : ''

  return (
    <div className={`question-card ${status}`}>
      {/* Header */}
      <div
        style={{
          display: 'flex', alignItems: 'flex-start', gap: 12,
          padding: '14px 16px', cursor: mode === 'review' ? 'pointer' : 'default'
        }}
        onClick={() => mode === 'review' && setExpanded(!expanded)}
      >
        <div style={{
          width: 26, height: 26, borderRadius: '50%', flexShrink: 0,
          background: status === 'correct' ? 'var(--success-dim)' :
                      status === 'incorrect' ? 'var(--danger-dim)' :
                      status === 'answered' ? 'var(--accent-dim)' : 'var(--surface-3)',
          color: status === 'correct' ? 'var(--success)' :
                 status === 'incorrect' ? 'var(--danger)' :
                 status === 'answered' ? '#c4bbff' : 'var(--ink-3)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 11, fontWeight: 500
        }}>
          {status === 'correct' ? '✓' : status === 'incorrect' ? '✗' : index + 1}
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 12, color: 'var(--ink-3)' }}>Q{index + 1}</span>
            {question.marks && (
              <span className="tag">
                {question.marks} mark{question.marks !== 1 ? 's' : ''}
              </span>
            )}
            {question.topics?.map(t => (
              <span key={t} className="tag tag-accent">{t}</span>
            ))}
            {question.difficulty && (
              <span className={`tag ${
                question.difficulty === 'hard' ? 'tag-danger' :
                question.difficulty === 'easy' ? 'tag-success' : ''
              }`}>
                {question.difficulty}
              </span>
            )}
          </div>

          <div
            dangerouslySetInnerHTML={{ __html: renderLatex(question.question) }}
            style={{ fontSize: 13, lineHeight: 1.8, color: 'var(--ink-1)' }}
          />
        </div>

        {mode === 'review' && (
          <div style={{
            color: 'var(--ink-3)', fontSize: 12, display: 'flex', alignItems: 'center', gap: 4
          }}>
            {question.scoredMarks ?? 0}/{question.marks}
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none"
              style={{ transform: expanded ? 'rotate(0)' : 'rotate(-90deg)', transition: 'transform 0.15s' }}>
              <path d="M2 4l4 4 4-4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
            </svg>
          </div>
        )}
      </div>

      {/* Answer input */}
      {mode === 'exam' && expanded && (
        <div style={{ padding: '0 16px 14px' }}>
          <div style={{ fontSize: 11, color: 'var(--ink-3)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            Your answer
          </div>
          <MathEditor
            value={answer || ''}
            onChange={onChange}
            placeholder="Write your answer here. Use LaTeX for math: $x^2$, \\frac{a}{b}, \\sin(x)..."
          />
        </div>
      )}

      {/* Review mode: show answer + feedback */}
      {mode === 'review' && expanded && (
        <ReviewContent question={question} renderLatex={renderLatex} />
      )}
    </div>
  )
}

function ReviewContent({ question, renderLatex }) {
  const [showMarkingScheme, setShowMarkingScheme] = useState(false)

  const feedback = question.feedback || {}

  return (
    <div style={{ padding: '0 16px 14px', borderTop: '1px solid var(--border)' }}>
      {/* Student answer */}
      <div style={{ marginTop: 12, marginBottom: 12 }}>
        <div style={{ fontSize: 11, color: 'var(--ink-3)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
          Your answer
        </div>
        <div style={{
          background: 'var(--surface-2)', borderRadius: 'var(--radius)',
          padding: '8px 12px', fontSize: 13
        }}>
          {question.studentAnswer ? (
            <div dangerouslySetInnerHTML={{ __html: renderLatex(question.studentAnswer) }} />
          ) : (
            <span style={{ color: 'var(--ink-3)', fontStyle: 'italic' }}>No answer submitted</span>
          )}
        </div>
      </div>

      {/* Overall feedback */}
      {feedback.overall && (
        <div style={{
          background: question.isCorrect ? 'var(--success-dim)' : 'var(--danger-dim)',
          border: `1px solid ${question.isCorrect ? 'rgba(74,222,128,0.2)' : 'rgba(255,95,95,0.2)'}`,
          borderRadius: 'var(--radius)', padding: '8px 12px', marginBottom: 10, fontSize: 12
        }}>
          <span style={{ color: question.isCorrect ? 'var(--success)' : 'var(--danger)', fontWeight: 500 }}>
            {question.isCorrect ? '✓ ' : '✗ '}
          </span>
          {feedback.overall}
        </div>
      )}

      {/* Per-step feedback */}
      {feedback.steps?.length > 0 && (
        <div style={{ marginBottom: 10 }}>
          <div style={{ fontSize: 11, color: 'var(--ink-3)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            Step-by-step
          </div>
          {feedback.steps.map((step, i) => (
            <div key={i} className="feedback-step">
              <div style={{
                width: 18, height: 18, borderRadius: '50%', flexShrink: 0,
                background: step.awarded ? 'var(--success-dim)' : 'var(--danger-dim)',
                color: step.awarded ? 'var(--success)' : 'var(--danger)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 10, marginTop: 2
              }}>
                {step.awarded ? '✓' : '✗'}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 12, color: 'var(--ink-1)', marginBottom: 2 }}>{step.description}</div>
                {step.comment && (
                  <div style={{ fontSize: 11, color: 'var(--ink-2)' }}>{step.comment}</div>
                )}
                {step.expected && (
                  <div style={{ fontSize: 11, color: 'var(--ink-3)', marginTop: 2 }}>
                    Expected: <span dangerouslySetInnerHTML={{ __html: renderLatex(`$${step.expected}$`) }} />
                  </div>
                )}
              </div>
              <div style={{ fontSize: 11, color: 'var(--ink-3)', flexShrink: 0 }}>
                {step.marks ?? 0}M
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Misconceptions */}
      {feedback.misconceptions?.length > 0 && (
        <div style={{ marginBottom: 10 }}>
          <div style={{ fontSize: 11, color: 'var(--ink-3)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            Misconceptions
          </div>
          {feedback.misconceptions.map((m, i) => (
            <div key={i} style={{
              background: 'var(--warning-dim)', border: '1px solid rgba(251,191,36,0.2)',
              borderRadius: 'var(--radius)', padding: '6px 10px', marginBottom: 4,
              fontSize: 12, color: 'var(--warning)'
            }}>
              ⚠ {m}
            </div>
          ))}
        </div>
      )}

      {/* Alternative approaches */}
      {feedback.alternatives?.length > 0 && (
        <div style={{ marginBottom: 10 }}>
          <div style={{ fontSize: 11, color: 'var(--ink-3)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            Valid alternatives
          </div>
          {feedback.alternatives.map((alt, i) => (
            <div key={i} style={{
              background: 'var(--surface-2)', borderRadius: 'var(--radius)',
              padding: '6px 10px', marginBottom: 4, fontSize: 12, color: 'var(--ink-2)'
            }}>
              <div dangerouslySetInnerHTML={{ __html: renderLatex(alt) }} />
            </div>
          ))}
        </div>
      )}

      {/* Show marking scheme */}
      <button
        className="btn btn-ghost"
        style={{ fontSize: 11, padding: '4px 0' }}
        onClick={() => setShowMarkingScheme(!showMarkingScheme)}
      >
        {showMarkingScheme ? 'Hide' : 'Show'} marking scheme
      </button>

      {showMarkingScheme && question.markingScheme && (
        <div style={{
          marginTop: 8, background: 'var(--surface-2)', borderRadius: 'var(--radius)',
          padding: '8px 12px', fontSize: 12
        }} className="animate-fade-in">
          <div dangerouslySetInnerHTML={{ __html: renderLatex(question.markingScheme) }} />
        </div>
      )}

      {/* Score */}
      <div style={{ marginTop: 10, textAlign: 'right', fontSize: 12, color: 'var(--ink-2)' }}>
        Score: <strong style={{ color: 'var(--ink-1)' }}>
          {question.scoredMarks ?? 0}/{question.marks}
        </strong>
      </div>
    </div>
  )
}
