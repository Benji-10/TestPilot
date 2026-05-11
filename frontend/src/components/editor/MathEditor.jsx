import { useRef } from 'react'
import { renderLatex } from '../../lib/latex.js'

const SHORTCUTS = {
  frac:       '\\frac{}{}',
  sqrt:       '\\sqrt{}',
  vec:        '\\vec{}',
  hat:        '\\hat{}',
  bar:        '\\bar{}',
  text:       '\\text{}',
  sin:        '\\sin ',
  cos:        '\\cos ',
  tan:        '\\tan ',
  ln:         '\\ln ',
  log:        '\\log ',
  exp:        '\\exp ',
  max:        '\\max ',
  min:        '\\min ',
  sup:        '\\sup ',
  inf:        '\\inf ',
  lim:        '\\lim ',
  sum:        '\\sum ',
  prod:       '\\prod ',
  int:        '\\int ',
  partial:    '\\partial ',
  nabla:      '\\nabla ',
  infty:      '\\infty ',
  pi:         '\\pi ',
  alpha:      '\\alpha ',
  beta:       '\\beta ',
  gamma:      '\\gamma ',
  delta:      '\\delta ',
  epsilon:    '\\epsilon ',
  eps:        '\\epsilon ',
  varepsilon: '\\varepsilon ',
  vareps:     '\\varepsilon ',
  veps:       '\\varepsilon ',
  theta:      '\\theta ',
  lambda:     '\\lambda ',
  mu:         '\\mu ',
  sigma:      '\\sigma ',
  omega:      '\\omega ',
  phi:        '\\phi ',
  times:      '\\times ',
  cdot:       '\\cdot ',
  pm:         '\\pm ',
  leq:        '\\leq ',
  geq:        '\\geq ',
  neq:        '\\neq ',
  approx:     '\\approx ',
  equiv:      '\\equiv ',
  subset:     '\\subset ',
  subseteq:   '\\subseteq ',
  in:         '\\in ',
  notin:      '\\notin ',
  cup:        '\\cup ',
  cap:        '\\cap ',
  emptyset:   '\\emptyset ',
  forall:     '\\forall ',
  exists:     '\\exists ',
  to:         '\\to ',
  implies:    '\\implies ',
  iff:        '\\iff ',
  RR:         '\\mathbb{R}',
  NN:         '\\mathbb{N}',
  ZZ:         '\\mathbb{Z}',
  QQ:         '\\mathbb{Q}',
  CC:         '\\mathbb{C}',
}

// cursor position after inserting latex (index where caret goes)
const CURSOR_POS = {
  '\\frac{}{}': 6,
  '\\sqrt{}': 6,
  '\\vec{}': 5,
  '\\hat{}': 5,
  '\\bar{}': 5,
  '\\text{}': 6,
  '\\mathbb{R}': 11,
  '\\mathbb{N}': 11,
  '\\mathbb{Z}': 11,
  '\\mathbb{Q}': 11,
  '\\mathbb{C}': 11,
}

const QUICK_INSERTS = [
  ['a/b', '\\frac{}{}'], ['√', '\\sqrt{}'], ['xⁿ', '^{}'], ['xₙ', '_{}'],
  ['∫', '\\int '], ['∑', '\\sum '], ['sup', '\\sup '], ['lim', '\\lim '],
  ['∞', '\\infty '], ['ε', '\\varepsilon '], ['π', '\\pi '], ['α', '\\alpha '],
  ['β', '\\beta '], ['θ', '\\theta '], ['λ', '\\lambda '], ['±', '\\pm '],
  ['×', '\\times '], ['≤', '\\leq '], ['≥', '\\geq '], ['≠', '\\neq '],
  ['∈', '\\in '], ['→', '\\to '], ['⟹', '\\implies '],
  ['∀', '\\forall '], ['∃', '\\exists '], ['ℝ', '\\mathbb{R}'],
]

export default function MathEditor({ value = '', onChange, placeholder }) {
  const taRef = useRef(null)

  function insert(text, caretOffset) {
    const ta = taRef.current
    if (!ta) return
    const start = ta.selectionStart
    const end = ta.selectionEnd
    const before = value.slice(0, start)
    const after = value.slice(end)
    const next = before + text + after
    onChange?.(next)
    const newCaret = start + (caretOffset ?? text.length)
    requestAnimationFrame(() => {
      if (taRef.current) {
        taRef.current.selectionStart = taRef.current.selectionEnd = newCaret
      }
    })
  }

  function handleKeyDown(e) {
    const ta = taRef.current
    if (!ta) return
    const pos = ta.selectionStart
    const before = value.slice(0, pos)
    const after = value.slice(pos)

    if (e.key === 'Tab') {
      e.preventDefault()
      insert('  ', 2)
      return
    }

    if (e.key === '$') {
      e.preventDefault()
      insert('$$', 1)
      return
    }

    if (e.key === '{') {
      e.preventDefault()
      insert('{}', 1)
      return
    }

    if (e.key === ' ') {
      const m = before.match(/[a-zA-Z_]+$/)
      if (m) {
        const latex = SHORTCUTS[m[0]]
        if (latex) {
          e.preventDefault()
          const replaced = before.slice(0, -m[0].length)
          const next = replaced + latex + after
          onChange?.(next)
          const cp = CURSOR_POS[latex]
          const newCaret = replaced.length + (cp ?? latex.length)
          requestAnimationFrame(() => {
            if (taRef.current) {
              taRef.current.selectionStart = taRef.current.selectionEnd = newCaret
            }
          })
          return
        }
      }
    }
  }

  const preview = value.trim() ? renderLatex(value) : ''

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3 }}>
        {QUICK_INSERTS.map(([label, latex]) => {
          const cp = CURSOR_POS[latex]
          return (
            <button
              key={label}
              className="btn"
              onMouseDown={e => {
                e.preventDefault()
                const ta = taRef.current
                if (!ta) return
                const pos = ta.selectionStart
                const b = value.slice(0, pos)
                const a = value.slice(pos)
                const next = b + latex + a
                onChange?.(next)
                const newCaret = pos + (cp ?? latex.length)
                requestAnimationFrame(() => {
                  if (taRef.current) {
                    taRef.current.focus()
                    taRef.current.selectionStart = taRef.current.selectionEnd = newCaret
                  }
                })
              }}
              style={{ padding: '2px 7px', fontSize: 12, height: 'auto', minWidth: 0 }}
            >
              {label}
            </button>
          )
        })}
      </div>

      <div style={{ position: 'relative' }}>
        <textarea
          ref={taRef}
          value={value}
          onChange={e => onChange?.(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder || 'Type maths inside $...$  e.g. $\\frac{1}{2}$. Type keywords then Space: frac sqrt sup lim leq veps RR'}
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

      {value.trim() && (
        <div style={{
          background: 'var(--surface-2)', border: '1px solid var(--border)',
          borderRadius: 'var(--radius)', padding: '10px 14px',
        }}>
          <div style={{ fontSize: 9, color: 'var(--ink-3)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            Preview
          </div>
          <div
            dangerouslySetInnerHTML={{ __html: preview }}
            style={{ lineHeight: 2, color: 'var(--ink-1)', overflowX: 'auto' }}
          />
        </div>
      )}

      <p style={{ fontSize: 10, color: 'var(--ink-3)', lineHeight: 1.8 }}>
        Wrap maths in{' '}
        <code style={{ background: 'var(--surface-3)', padding: '0 3px', borderRadius: 2 }}>$...$</code>{' '}
        or{' '}
        <code style={{ background: 'var(--surface-3)', padding: '0 3px', borderRadius: 2 }}>$$...$$</code>.{' '}
        Keywords expand on Space:{' '}
        {['frac', 'sqrt', 'sup', 'lim', 'leq', 'in', 'veps', 'RR', 'alpha', 'theta', 'infty', 'implies', 'forall'].map(k => (
          <code key={k} style={{ background: 'var(--surface-3)', padding: '0 3px', borderRadius: 2, marginRight: 3 }}>{k}</code>
        ))}
      </p>
    </div>
  )
}
