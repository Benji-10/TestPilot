import { useState, useRef, useEffect, useCallback } from 'react'
import katex from 'katex'

// Render a string that may contain $...$ / $$...$$ delimiters,
// OR bare LaTeX commands like \frac{1}{2}, OR plain text.
function renderMixed(raw) {
  if (!raw) return ''

  // If the string contains explicit $ delimiters, parse them properly
  if (raw.includes('$')) {
    return raw
      .replace(/\$\$([\s\S]+?)\$\$/g, (_, expr) => renderKatex(expr, true))
      .replace(/\$([^$\n]+?)\$/g, (_, expr) => renderKatex(expr, false))
      .replace(/\n/g, '<br/>')
  }

  // No $ delimiters — check if it looks like it contains LaTeX commands
  // If so, try rendering the whole thing as a single display expression
  const hasLatex = /[\\^_{}]|\\[a-zA-Z]/.test(raw)
  if (hasLatex) {
    // Try wrapping lines: lines that look like math render as math,
    // plain text lines render as text
    const lines = raw.split('\n')
    return lines.map(line => {
      const lineTrimmed = line.trim()
      if (!lineTrimmed) return '<br/>'
      const lineHasLatex = /[\\^_{}]|\\[a-zA-Z]/.test(lineTrimmed)
      if (lineHasLatex) {
        return renderKatex(lineTrimmed, false) + '<br/>'
      }
      return escHtml(line) + '<br/>'
    }).join('')
  }

  // Plain text
  return escHtml(raw).replace(/\n/g, '<br/>')
}

function renderKatex(expr, display) {
  try {
    return katex.renderToString(expr.trim(), {
      displayMode: display,
      throwOnError: false,
      errorColor: 'var(--danger)',
      trust: false,
    })
  } catch {
    return `<span style="color:var(--danger);font-size:11px">${escHtml(expr)}</span>`
  }
}

function escHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

const QUICK_INSERTS = [
  { label: '½',   insert: '\\frac{}{}',         cursor: 6,  preview: '\\frac{a}{b}' },
  { label: '√',   insert: '\\sqrt{}',            cursor: 6,  preview: '\\sqrt{x}' },
  { label: 'xⁿ',  insert: '^{}',                cursor: 2,  preview: 'x^{n}' },
  { label: 'xₙ',  insert: '_{}',                cursor: 2,  preview: 'x_{i}' },
  { label: '∫',   insert: '\\int_{}^{} ',        cursor: 5,  preview: '\\int' },
  { label: '∑',   insert: '\\sum_{}^{} ',        cursor: 5,  preview: '\\sum' },
  { label: 'lim', insert: '\\lim_{} ',           cursor: 6,  preview: '\\lim' },
  { label: '∞',   insert: '\\infty',             cursor: 6,  preview: '\\infty' },
  { label: 'π',   insert: '\\pi',                cursor: 3,  preview: '\\pi' },
  { label: 'α',   insert: '\\alpha',             cursor: 6,  preview: '\\alpha' },
  { label: 'β',   insert: '\\beta',              cursor: 5,  preview: '\\beta' },
  { label: 'θ',   insert: '\\theta',             cursor: 6,  preview: '\\theta' },
  { label: 'λ',   insert: '\\lambda',            cursor: 7,  preview: '\\lambda' },
  { label: '±',   insert: '\\pm',                cursor: 3,  preview: '\\pm' },
  { label: '×',   insert: '\\times',             cursor: 6,  preview: '\\times' },
  { label: '≤',   insert: '\\leq',               cursor: 4,  preview: '\\leq' },
  { label: '≥',   insert: '\\geq',               cursor: 4,  preview: '\\geq' },
  { label: '≠',   insert: '\\neq',               cursor: 4,  preview: '\\neq' },
  { label: '→',   insert: '\\rightarrow',        cursor: 11, preview: '\\rightarrow' },
  { label: '·',   insert: '\\cdot',              cursor: 5,  preview: '\\cdot' },
  { label: 'vec', insert: '\\vec{}',             cursor: 5,  preview: '\\vec{v}' },
]

export default function MathEditor({ value, onChange, placeholder = 'Type your answer here…' }) {
  const [raw, setRaw] = useState(value || '')
  const [focused, setFocused] = useState(false)
  const taRef = useRef(null)

  // Sync external value changes
  useEffect(() => {
    if (value !== undefined && value !== raw) setRaw(value)
  }, [value])

  function emit(newVal) {
    setRaw(newVal)
    onChange?.(newVal)
  }

  function handleChange(e) {
    emit(e.target.value)
  }

  function handleKeyDown(e) {
    const ta = taRef.current
    const pos = ta.selectionStart
    const val = raw

    // Tab → 2 spaces
    if (e.key === 'Tab') {
      e.preventDefault()
      const next = val.slice(0, pos) + '  ' + val.slice(pos)
      emit(next)
      requestAnimationFrame(() => { ta.selectionStart = ta.selectionEnd = pos + 2 })
      return
    }

    // Auto-close brackets
    const pairs = { '(': ')', '[': ']', '{': '}' }
    if (pairs[e.key]) {
      e.preventDefault()
      const close = pairs[e.key]
      const next = val.slice(0, pos) + e.key + close + val.slice(pos)
      emit(next)
      requestAnimationFrame(() => { ta.selectionStart = ta.selectionEnd = pos + 1 })
      return
    }

    // Smart backspace — delete whole \command token
    if (e.key === 'Backspace' && pos > 0) {
      const before = val.slice(0, pos)
      const cmdMatch = before.match(/\\[a-zA-Z]+$/)
      if (cmdMatch) {
        e.preventDefault()
        const next = before.slice(0, -cmdMatch[0].length) + val.slice(pos)
        emit(next)
        requestAnimationFrame(() => { ta.selectionStart = ta.selectionEnd = pos - cmdMatch[0].length })
        return
      }
    }

    // Word shortcuts: type "sin " → "\sin "
    if (e.key === ' ') {
      const before = val.slice(0, pos)
      const wordMatch = before.match(/\b(sin|cos|tan|cot|sec|csc|ln|log|exp|sqrt|frac|int|sum|lim|prod|pi|alpha|beta|gamma|delta|theta|lambda|mu|sigma|omega|phi|psi|chi|inf|infty|times|div|cdot|vec|hat|bar|dot|partial|nabla)$/)
      if (wordMatch) {
        e.preventDefault()
        const word = wordMatch[1]
        const map = {
          sqrt: '\\sqrt{}', frac: '\\frac{}{}', vec: '\\vec{}',
          hat: '\\hat{}', bar: '\\bar{}', dot: '\\dot{}',
          inf: '\\infty', infty: '\\infty', times: '\\times',
          div: '\\div', cdot: '\\cdot', partial: '\\partial',
          nabla: '\\nabla',
        }
        const latex = map[word] || `\\${word}`
        const next = before.slice(0, -word.length) + latex + ' ' + val.slice(pos)
        emit(next)
        // Place cursor inside first {} if present
        const cursorOffset = latex.indexOf('{}')
        const newPos = pos - word.length + (cursorOffset !== -1 ? cursorOffset + 1 : latex.length) + 1
        requestAnimationFrame(() => { ta.selectionStart = ta.selectionEnd = newPos })
        return
      }
    }
  }

  function insertAt(text, cursorOffset) {
    const ta = taRef.current
    if (!ta) return
    const pos = ta.selectionStart
    const next = raw.slice(0, pos) + text + raw.slice(pos)
    emit(next)
    requestAnimationFrame(() => {
      ta.focus()
      ta.selectionStart = ta.selectionEnd = pos + cursorOffset
    })
  }

  const preview = renderMixed(raw)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {/* Toolbar */}
      {focused && (
        <div style={{
          display: 'flex', flexWrap: 'wrap', gap: 3,
          padding: '4px 0 2px',
        }}>
          {QUICK_INSERTS.map(item => (
            <button
              key={item.label}
              className="btn"
              onMouseDown={e => { e.preventDefault(); insertAt(item.insert, item.cursor) }}
              style={{ padding: '2px 7px', fontSize: 12, height: 'auto', minWidth: 0 }}
              title={item.preview}
            >
              <span dangerouslySetInnerHTML={{ __html: renderKatex(item.preview, false) }} />
            </button>
          ))}
        </div>
      )}

      {/* Raw input */}
      <div style={{ position: 'relative' }}>
        <textarea
          ref={taRef}
          value={raw}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          placeholder={placeholder}
          className="input"
          style={{
            minHeight: 110,
            fontFamily: 'JetBrains Mono, monospace',
            fontSize: 13,
            lineHeight: 1.7,
            resize: 'vertical',
            width: '100%',
          }}
          spellCheck={false}
        />
        <div style={{
          position: 'absolute', top: 7, right: 10,
          fontSize: 9, color: 'var(--ink-3)', pointerEvents: 'none',
          textTransform: 'uppercase', letterSpacing: '0.06em'
        }}>
          LaTeX
        </div>
      </div>

      {/* Live preview — always shown when there's content */}
      {raw.trim() && (
        <div style={{
          background: 'var(--surface-2)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius)',
          padding: '10px 14px',
        }}>
          <div style={{
            fontSize: 9, color: 'var(--ink-3)', marginBottom: 6,
            textTransform: 'uppercase', letterSpacing: '0.06em'
          }}>
            Preview
          </div>
          <div
            dangerouslySetInnerHTML={{ __html: preview }}
            style={{ lineHeight: 2, color: 'var(--ink-1)', overflowX: 'auto' }}
          />
        </div>
      )}

      {focused && (
        <p style={{ fontSize: 10, color: 'var(--ink-3)', lineHeight: 1.6 }}>
          Tip: type <code style={{ background: 'var(--surface-3)', padding: '0 3px', borderRadius: 3 }}>sin </code>,{' '}
          <code style={{ background: 'var(--surface-3)', padding: '0 3px', borderRadius: 3 }}>frac </code>,{' '}
          <code style={{ background: 'var(--surface-3)', padding: '0 3px', borderRadius: 3 }}>sqrt </code> etc. to expand.
          Wrap in <code style={{ background: 'var(--surface-3)', padding: '0 3px', borderRadius: 3 }}>$...$</code> for inline math or{' '}
          <code style={{ background: 'var(--surface-3)', padding: '0 3px', borderRadius: 3 }}>$$...$$</code> for display math.
        </p>
      )}
    </div>
  )
}
