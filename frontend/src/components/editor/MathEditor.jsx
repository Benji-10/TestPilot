import { useState, useRef, useEffect } from 'react'
import { renderLatex } from '../../lib/latex.js'

// ─── Shortcut table ───────────────────────────────────────────────────────────
// Each entry: { latex, cursor }
// cursor = index within latex where caret should land (relative to insertion start)
// If cursor points inside {}, no trailing space is added.
// If cursor is at end of string, a space is appended.

const SHORTCUTS = {
  // Structures with cursor inside first {}
  frac:     { latex: '\\frac{}{}',   cursor: 6  },
  sqrt:     { latex: '\\sqrt{}',     cursor: 6  },
  vec:      { latex: '\\vec{}',      cursor: 5  },
  hat:      { latex: '\\hat{}',      cursor: 5  },
  bar:      { latex: '\\bar{}',      cursor: 5  },
  dot:      { latex: '\\dot{}',      cursor: 5  },
  text:     { latex: '\\text{}',     cursor: 6  },
  mathbb:   { latex: '\\mathbb{}',   cursor: 8  },
  mathcal:  { latex: '\\mathcal{}',  cursor: 9  },
  // Structures with cursor at end (space will be added)
  sin:      { latex: '\\sin',        cursor: null },
  cos:      { latex: '\\cos',        cursor: null },
  tan:      { latex: '\\tan',        cursor: null },
  cot:      { latex: '\\cot',        cursor: null },
  sec:      { latex: '\\sec',        cursor: null },
  csc:      { latex: '\\csc',        cursor: null },
  ln:       { latex: '\\ln',         cursor: null },
  log:      { latex: '\\log',        cursor: null },
  exp:      { latex: '\\exp',        cursor: null },
  max:      { latex: '\\max',        cursor: null },
  min:      { latex: '\\min',        cursor: null },
  sup:      { latex: '\\sup',        cursor: null },
  inf:      { latex: '\\inf',        cursor: null },
  lim:      { latex: '\\lim',        cursor: null },
  sum:      { latex: '\\sum',        cursor: null },
  prod:     { latex: '\\prod',       cursor: null },
  int:      { latex: '\\int',        cursor: null },
  partial:  { latex: '\\partial',    cursor: null },
  nabla:    { latex: '\\nabla',      cursor: null },
  infty:    { latex: '\\infty',      cursor: null },
  infinity: { latex: '\\infty',      cursor: null },
  pi:       { latex: '\\pi',         cursor: null },
  alpha:    { latex: '\\alpha',      cursor: null },
  beta:     { latex: '\\beta',       cursor: null },
  gamma:    { latex: '\\gamma',      cursor: null },
  delta:    { latex: '\\delta',      cursor: null },
  epsilon:  { latex: '\\epsilon',    cursor: null },
  eps:      { latex: '\\epsilon',    cursor: null },
  varepsilon:{ latex: '\\varepsilon', cursor: null },
  vareps:   { latex: '\\varepsilon', cursor: null },
  veps:     { latex: '\\varepsilon', cursor: null },
  theta:    { latex: '\\theta',      cursor: null },
  lambda:   { latex: '\\lambda',     cursor: null },
  mu:       { latex: '\\mu',         cursor: null },
  sigma:    { latex: '\\sigma',      cursor: null },
  omega:    { latex: '\\omega',      cursor: null },
  phi:      { latex: '\\phi',        cursor: null },
  varphi:   { latex: '\\varphi',     cursor: null },
  psi:      { latex: '\\psi',        cursor: null },
  rho:      { latex: '\\rho',        cursor: null },
  tau:      { latex: '\\tau',        cursor: null },
  zeta:     { latex: '\\zeta',       cursor: null },
  eta:      { latex: '\\eta',        cursor: null },
  xi:       { latex: '\\xi',         cursor: null },
  times:    { latex: '\\times',      cursor: null },
  div:      { latex: '\\div',        cursor: null },
  cdot:     { latex: '\\cdot',       cursor: null },
  pm:       { latex: '\\pm',         cursor: null },
  mp:       { latex: '\\mp',         cursor: null },
  leq:      { latex: '\\leq',        cursor: null },
  geq:      { latex: '\\geq',        cursor: null },
  neq:      { latex: '\\neq',        cursor: null },
  approx:   { latex: '\\approx',     cursor: null },
  equiv:    { latex: '\\equiv',      cursor: null },
  subset:   { latex: '\\subset',     cursor: null },
  subseteq: { latex: '\\subseteq',   cursor: null },
  supset:   { latex: '\\supset',     cursor: null },
  in:       { latex: '\\in',         cursor: null },
  notin:    { latex: '\\notin',      cursor: null },
  cup:      { latex: '\\cup',        cursor: null },
  cap:      { latex: '\\cap',        cursor: null },
  emptyset: { latex: '\\emptyset',   cursor: null },
  forall:   { latex: '\\forall',     cursor: null },
  exists:   { latex: '\\exists',     cursor: null },
  to:       { latex: '\\to',         cursor: null },
  implies:  { latex: '\\implies',    cursor: null },
  iff:      { latex: '\\iff',        cursor: null },
  rightarrow:{ latex: '\\rightarrow', cursor: null },
  leftarrow: { latex: '\\leftarrow',  cursor: null },
  RR:       { latex: '\\mathbb{R}',  cursor: null },
  NN:       { latex: '\\mathbb{N}',  cursor: null },
  ZZ:       { latex: '\\mathbb{Z}',  cursor: null },
  QQ:       { latex: '\\mathbb{Q}',  cursor: null },
  CC:       { latex: '\\mathbb{C}',  cursor: null },
}

const QUICK_INSERTS = [
  { label: 'a/b',  latex: '\\frac{}{}',    cursor: 6  },
  { label: '√',    latex: '\\sqrt{}',      cursor: 6  },
  { label: 'xⁿ',  latex: '^{}',           cursor: 2  },
  { label: 'xₙ',  latex: '_{}',           cursor: 2  },
  { label: '∫',    latex: '\\int',         cursor: null },
  { label: '∑',    latex: '\\sum',         cursor: null },
  { label: 'sup',  latex: '\\sup',         cursor: null },
  { label: 'lim',  latex: '\\lim',         cursor: null },
  { label: '∞',    latex: '\\infty',       cursor: null },
  { label: 'ε',    latex: '\\varepsilon',  cursor: null },
  { label: 'π',    latex: '\\pi',          cursor: null },
  { label: 'α',    latex: '\\alpha',       cursor: null },
  { label: 'β',    latex: '\\beta',        cursor: null },
  { label: 'θ',    latex: '\\theta',       cursor: null },
  { label: 'λ',    latex: '\\lambda',      cursor: null },
  { label: '±',    latex: '\\pm',          cursor: null },
  { label: '×',    latex: '\\times',       cursor: null },
  { label: '≤',    latex: '\\leq',         cursor: null },
  { label: '≥',    latex: '\\geq',         cursor: null },
  { label: '≠',    latex: '\\neq',         cursor: null },
  { label: '∈',    latex: '\\in',          cursor: null },
  { label: '→',    latex: '\\to',          cursor: null },
  { label: '⟹',   latex: '\\implies',     cursor: null },
  { label: '∀',    latex: '\\forall',      cursor: null },
  { label: '∃',    latex: '\\exists',      cursor: null },
  { label: 'ℝ',    latex: '\\mathbb{R}',   cursor: null },
]

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Is the caret at `pos` inside a math region?
 * Simple approach: count unescaped $ signs before pos.
 * Odd count = inside inline math. Also checks for $$ pairs.
 */
function mathContext(str, pos) {
  try {
    const before = str.slice(0, pos)
    // Count $$ pairs
    const displayMatches = before.match(/\$\$/g) || []
    // If odd number of $$ openers, we're in display math
    if (displayMatches.length % 2 === 1) return 'display'
    // Remove all $$ to count single $
    const withoutDisplay = before.replace(/\$\$/g, '')
    const inlineCount = (withoutDisplay.match(/\$/g) || []).length
    if (inlineCount % 2 === 1) return 'inline'
    return null
  } catch {
    return null
  }
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function MathEditor({ value, onChange, placeholder }) {
  const [raw, setRaw] = useState(value || '')
  const [focused, setFocused] = useState(false)
  const taRef = useRef(null)

  useEffect(() => {
    if (value !== undefined && value !== raw) setRaw(value)
  }, [value])

  function emit(v) { setRaw(v); onChange?.(v) }

  function setCaret(pos) {
    requestAnimationFrame(() => {
      if (taRef.current) {
        taRef.current.selectionStart = taRef.current.selectionEnd = pos
      }
    })
  }

  function handleChange(e) { emit(e.target.value) }

  function handleKeyDown(e) {
    const ta = taRef.current
    if (!ta) return
    const pos = ta.selectionStart
    const val = raw
    const before = val.slice(0, pos)
    const after = val.slice(pos)

    if (e.key === 'Tab') {
      e.preventDefault()
      emit(before + '  ' + after)
      setCaret(pos + 2)
      return
    }

    if (e.key === '$') {
      e.preventDefault()
      emit(before + '$$' + after)
      setCaret(pos + 1)
      return
    }

    if (e.key === '{') {
      e.preventDefault()
      emit(before + '{}' + after)
      setCaret(pos + 1)
      return
    }

    if (e.key === ' ') {
      const wordMatch = before.match(/[a-zA-Z_]+$/)
      if (wordMatch) {
        const shortcut = SHORTCUTS[wordMatch[0]]
        if (shortcut) {
          e.preventDefault()
          const { latex, cursor } = shortcut
          const insideBrace = cursor !== null
          const full = before.slice(0, -wordMatch[0].length) + latex + (insideBrace ? '' : ' ') + after
          emit(full)
          setCaret(insideBrace ? pos - wordMatch[0].length + cursor : pos - wordMatch[0].length + latex.length + 1)
          return
        }
      }
    }
  }

    function insertSnippet(latex, cursor) {
    const ta = taRef.current
    if (!ta) return
    const pos = ta.selectionStart ?? raw.length
    const before = raw.slice(0, pos)
    const after = raw.slice(pos)

    const insideBrace = cursor !== null
    const full = insideBrace
      ? before + latex + after
      : before + latex + ' ' + after

    emit(full)
    const newPos = insideBrace
      ? pos + cursor
      : pos + latex.length + 1
    requestAnimationFrame(() => {
      ta.focus()
      ta.selectionStart = ta.selectionEnd = newPos
    })
  }

  const preview = raw.trim() ? renderLatex(raw) : ''

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {/* Toolbar */}
      {focused && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3 }}>
          {QUICK_INSERTS.map(item => (
            <button
              key={item.label}
              className="btn"
              onMouseDown={e => { e.preventDefault(); insertSnippet(item.latex, item.cursor) }}
              style={{ padding: '2px 7px', fontSize: 12, height: 'auto', minWidth: 0 }}
            >
              {item.label}
            </button>
          ))}
        </div>
      )}

      {/* Textarea */}
      <div style={{ position: 'relative' }}>
        <textarea
          ref={taRef}
          value={raw}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          placeholder={placeholder || 'Type answer. Surround maths with $...$. Inside $, type keywords + Space: frac sqrt sup lim leq in implies veps RR …'}
          className="input"
          style={{
            minHeight: 110,
            fontFamily: 'JetBrains Mono, monospace',
            fontSize: 13,
            lineHeight: 1.7,
            resize: 'vertical',
            width: '100%',
            paddingRight: 44,
          }}
          spellCheck={false}
        />
        <span style={{
          position: 'absolute', top: 7, right: 10,
          fontSize: 9, color: 'var(--ink-3)', pointerEvents: 'none',
          textTransform: 'uppercase', letterSpacing: '0.06em',
        }}>
          LaTeX
        </span>
      </div>

      {/* Live preview */}
      {raw.trim() && (
        <div style={{
          background: 'var(--surface-2)', border: '1px solid var(--border)',
          borderRadius: 'var(--radius)', padding: '10px 14px',
        }}>
          <div style={{
            fontSize: 9, color: 'var(--ink-3)', marginBottom: 6,
            textTransform: 'uppercase', letterSpacing: '0.06em',
          }}>
            Preview
          </div>
          <div
            dangerouslySetInnerHTML={{ __html: preview }}
            style={{ lineHeight: 2, color: 'var(--ink-1)', overflowX: 'auto' }}
          />
        </div>
      )}

      {/* Tips */}
      {focused && (
        <p style={{ fontSize: 10, color: 'var(--ink-3)', lineHeight: 1.8 }}>
          Wrap maths in <code style={{ background: 'var(--surface-3)', padding: '0 3px', borderRadius: 2 }}>$...$</code>{' '}
          or <code style={{ background: 'var(--surface-3)', padding: '0 3px', borderRadius: 2 }}>$$...$$</code>.{' '}
          Inside $, keywords expand on Space:{' '}
          {['frac', 'sqrt', 'sup', 'lim', 'leq', 'geq', 'in', 'implies', 'forall', 'exists',
            'veps', 'RR', 'NN', 'alpha', 'beta', 'theta', 'lambda', 'infty'].map(k => (
            <code key={k} style={{ background: 'var(--surface-3)', padding: '0 3px', borderRadius: 2, marginRight: 3 }}>{k}</code>
          ))}
        </p>
      )}
    </div>
  )
}
