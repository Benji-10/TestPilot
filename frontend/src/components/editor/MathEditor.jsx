import { useState, useRef, useEffect, useCallback } from 'react'
import katex from 'katex'

// Token types
const T = {
  TEXT: 'text',
  LATEX: 'latex',
  CURSOR: 'cursor',
}

function parseToTokens(raw) {
  // Split raw LaTeX string into inline text and display math
  const tokens = []
  let i = 0
  let textBuf = ''

  while (i < raw.length) {
    // Display math: $$...$$
    if (raw[i] === '$' && raw[i+1] === '$') {
      if (textBuf) { tokens.push({ type: T.TEXT, value: textBuf }); textBuf = '' }
      const end = raw.indexOf('$$', i+2)
      if (end !== -1) {
        tokens.push({ type: T.LATEX, value: raw.slice(i+2, end), display: true })
        i = end + 2
      } else {
        textBuf += raw[i++]
      }
    }
    // Inline math: $...$
    else if (raw[i] === '$') {
      if (textBuf) { tokens.push({ type: T.TEXT, value: textBuf }); textBuf = '' }
      const end = raw.indexOf('$', i+1)
      if (end !== -1) {
        tokens.push({ type: T.LATEX, value: raw.slice(i+1, end), display: false })
        i = end + 1
      } else {
        textBuf += raw[i++]
      }
    }
    else {
      textBuf += raw[i++]
    }
  }
  if (textBuf) tokens.push({ type: T.TEXT, value: textBuf })
  return tokens
}

function renderKatex(expr, display = false) {
  try {
    return katex.renderToString(expr, {
      displayMode: display,
      throwOnError: false,
      errorColor: 'var(--danger)',
      trust: false,
    })
  } catch {
    return `<span style="color:var(--danger)">${expr}</span>`
  }
}

export default function MathEditor({ value, onChange, placeholder = 'Type your answer here...' }) {
  const [raw, setRaw] = useState(value || '')
  const [focused, setFocused] = useState(false)
  const [caretPos, setCaretPos] = useState(0)
  const textareaRef = useRef(null)
  const displayRef = useRef(null)

  useEffect(() => {
    if (value !== raw) setRaw(value || '')
  }, [value])

  function handleChange(e) {
    let text = e.target.value
    // Apply shortcuts
    text = applyShortcuts(text, e.target.selectionStart)
    setRaw(text)
    setCaretPos(e.target.selectionStart)
    onChange?.(text)
  }

  function applyShortcuts(text, pos) {
    const shortcuts = {
      '\\sin': true, '\\cos': true, '\\tan': true,
      '\\ln': true, '\\log': true, '\\pi': true,
    }

    // Auto-close braces
    return text
  }

  function handleKeyDown(e) {
    const ta = textareaRef.current
    const pos = ta.selectionStart
    const cur = raw

    // Tab inserts spaces
    if (e.key === 'Tab') {
      e.preventDefault()
      const newVal = cur.slice(0, pos) + '    ' + cur.slice(pos)
      setRaw(newVal)
      onChange?.(newVal)
      setTimeout(() => { ta.selectionStart = ta.selectionEnd = pos + 4 }, 0)
      return
    }

    // Auto-close brackets
    const pairs = { '(': ')', '[': ']', '{': '}' }
    if (pairs[e.key]) {
      e.preventDefault()
      const close = pairs[e.key]
      const newVal = cur.slice(0, pos) + e.key + close + cur.slice(pos)
      setRaw(newVal)
      onChange?.(newVal)
      setTimeout(() => { ta.selectionStart = ta.selectionEnd = pos + 1 }, 0)
      return
    }

    // Smart backspace: delete full LaTeX command
    if (e.key === 'Backspace' && pos > 0) {
      const before = cur.slice(0, pos)
      // Check if we're at end of a LaTeX command like \sin, \frac, etc.
      const cmdMatch = before.match(/\\[a-zA-Z]+$/)
      if (cmdMatch) {
        e.preventDefault()
        const newVal = before.slice(0, -cmdMatch[0].length) + cur.slice(pos)
        setRaw(newVal)
        onChange?.(newVal)
        setTimeout(() => { ta.selectionStart = ta.selectionEnd = pos - cmdMatch[0].length }, 0)
        return
      }
    }

    // Shortcuts: type word and space to expand
    // e.g., "sin " -> "\sin "
    if (e.key === ' ') {
      const before = cur.slice(0, pos)
      const wordMatch = before.match(/\b(sin|cos|tan|ln|log|sqrt|int|sum|lim|frac|pi|alpha|beta|gamma|theta|lambda|sigma|omega|inf|times|div|cdot|vec|hat|bar)$/)
      if (wordMatch) {
        e.preventDefault()
        const word = wordMatch[1]
        const replacements = {
          sqrt: '\\sqrt{}', frac: '\\frac{}{}', vec: '\\vec{}',
          hat: '\\hat{}', bar: '\\bar{}', inf: '\\infty',
          times: '\\times', div: '\\div', cdot: '\\cdot',
        }
        const latex = replacements[word] || `\\${word}`
        const newVal = before.slice(0, -word.length) + latex + ' ' + cur.slice(pos)
        setRaw(newVal)
        onChange?.(newVal)
        setTimeout(() => {
          const newPos = pos - word.length + latex.length + 1
          ta.selectionStart = ta.selectionEnd = newPos
        }, 0)
        return
      }
    }
  }

  // Build display HTML
  function buildDisplay() {
    if (!raw) return ''
    const tokens = parseToTokens(raw)
    return tokens.map(t => {
      if (t.type === T.LATEX) return renderKatex(t.value, t.display)
      if (t.type === T.TEXT) return `<span style="white-space:pre-wrap">${escHtml(t.value)}</span>`
      return ''
    }).join('')
  }

  function escHtml(s) {
    return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
  }

  const displayHtml = buildDisplay()

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {/* Raw input */}
      <div style={{ position: 'relative' }}>
        <textarea
          ref={textareaRef}
          value={raw}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          onSelect={e => setCaretPos(e.target.selectionStart)}
          placeholder={placeholder}
          className="input"
          style={{
            minHeight: 100,
            fontFamily: 'JetBrains Mono, monospace',
            fontSize: 13,
            lineHeight: 1.7,
            resize: 'vertical',
          }}
          spellCheck={false}
        />
        <div style={{
          position: 'absolute', top: 6, right: 8,
          fontSize: 10, color: 'var(--ink-3)', pointerEvents: 'none'
        }}>
          LaTeX
        </div>
      </div>

      {/* Live preview */}
      {raw.trim() && (
        <div style={{
          background: 'var(--surface-2)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius)',
          padding: '10px 14px',
          minHeight: 40,
        }}>
          <div style={{ fontSize: 10, color: 'var(--ink-3)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            Preview
          </div>
          <div
            dangerouslySetInnerHTML={{ __html: displayHtml }}
            style={{ lineHeight: 1.8, color: 'var(--ink-1)' }}
          />
        </div>
      )}

      {/* Quick insert toolbar */}
      {focused && (
        <div style={{
          display: 'flex', flexWrap: 'wrap', gap: 4,
          padding: '6px 0'
        }} className="animate-fade-in">
          {QUICK_INSERTS.map(item => (
            <button
              key={item.label}
              className="btn"
              onMouseDown={e => {
                e.preventDefault()
                const ta = textareaRef.current
                const pos = ta.selectionStart
                const newVal = raw.slice(0, pos) + item.insert + raw.slice(pos)
                setRaw(newVal)
                onChange?.(newVal)
                setTimeout(() => {
                  const newPos = pos + item.cursor
                  ta.selectionStart = ta.selectionEnd = newPos
                  ta.focus()
                }, 0)
              }}
              style={{ padding: '3px 8px', fontSize: 11, height: 'auto' }}
              title={item.label}
            >
              <span dangerouslySetInnerHTML={{ __html: renderKatex(item.preview) }} />
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

const QUICK_INSERTS = [
  { label: 'Fraction', insert: '\\frac{}{}', cursor: 6, preview: '\\frac{a}{b}' },
  { label: 'Square root', insert: '\\sqrt{}', cursor: 6, preview: '\\sqrt{x}' },
  { label: 'Superscript', insert: '^{}', cursor: 2, preview: 'x^{n}' },
  { label: 'Subscript', insert: '_{}', cursor: 2, preview: 'x_{i}' },
  { label: 'Integral', insert: '\\int_{}^{}', cursor: 5, preview: '\\int' },
  { label: 'Sum', insert: '\\sum_{}^{}', cursor: 5, preview: '\\sum' },
  { label: 'Limit', insert: '\\lim_{}', cursor: 6, preview: '\\lim' },
  { label: 'Infinity', insert: '\\infty', cursor: 6, preview: '\\infty' },
  { label: 'Greek α', insert: '\\alpha', cursor: 6, preview: '\\alpha' },
  { label: 'Greek β', insert: '\\beta', cursor: 5, preview: '\\beta' },
  { label: 'Greek π', insert: '\\pi', cursor: 3, preview: '\\pi' },
  { label: 'Greek θ', insert: '\\theta', cursor: 6, preview: '\\theta' },
  { label: 'Vector', insert: '\\vec{}', cursor: 5, preview: '\\vec{v}' },
  { label: 'Matrix', insert: '\\begin{pmatrix} & \\\\ & \\end{pmatrix}', cursor: 16, preview: '\\begin{pmatrix}a\\end{pmatrix}' },
  { label: '±', insert: '\\pm', cursor: 3, preview: '\\pm' },
  { label: '×', insert: '\\times', cursor: 6, preview: '\\times' },
  { label: '≤', insert: '\\leq', cursor: 4, preview: '\\leq' },
  { label: '≥', insert: '\\geq', cursor: 4, preview: '\\geq' },
  { label: '≠', insert: '\\neq', cursor: 4, preview: '\\neq' },
  { label: '→', insert: '\\rightarrow', cursor: 11, preview: '\\rightarrow' },
]
