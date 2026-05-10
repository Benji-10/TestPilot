import { useState, useRef, useEffect } from 'react'
import { renderLatex, renderMath } from '../../lib/latex.js'

const SHORTCUTS = {
  sin: '\\sin', cos: '\\cos', tan: '\\tan', cot: '\\cot',
  sec: '\\sec', csc: '\\csc', ln: '\\ln', log: '\\log',
  exp: '\\exp', lim: '\\lim_{} ', sup: '\\sup_{}',
  inf_: '\\inf_{}', max: '\\max', min: '\\min',
  sqrt: '\\sqrt{}', frac: '\\frac{}{}', int: '\\int_{}^{} ',
  sum: '\\sum_{}^{} ', prod: '\\prod_{}^{} ',
  partial: '\\partial', nabla: '\\nabla',
  infty: '\\infty', inf: '\\infty',
  alpha: '\\alpha', beta: '\\beta', gamma: '\\gamma',
  delta: '\\delta', epsilon: '\\epsilon', theta: '\\theta',
  lambda: '\\lambda', mu: '\\mu', sigma: '\\sigma',
  omega: '\\omega', phi: '\\phi', psi: '\\psi',
  pi: '\\pi', rho: '\\rho', tau: '\\tau',
  times: '\\times', div: '\\div', cdot: '\\cdot',
  pm: '\\pm', mp: '\\mp', leq: '\\leq', geq: '\\geq',
  neq: '\\neq', approx: '\\approx', equiv: '\\equiv',
  in: '\\in', notin: '\\notin', subset: '\\subset',
  forall: '\\forall', exists: '\\exists',
  to: '\\to', rightarrow: '\\rightarrow', leftarrow: '\\leftarrow',
  implies: '\\implies', iff: '\\iff',
  cup: '\\cup', cap: '\\cap', emptyset: '\\emptyset',
  mathbb: '\\mathbb{}', text: '\\text{}',
  vec: '\\vec{}', hat: '\\hat{}', bar: '\\bar{}', dot: '\\dot{}',
}

const QUICK_INSERTS = [
  { label: 'a/b',    insert: '\\frac{}{}',      cursor: 6  },
  { label: '√',      insert: '\\sqrt{}',         cursor: 6  },
  { label: 'xⁿ',    insert: '^{}',              cursor: 2  },
  { label: 'xₙ',    insert: '_{}',              cursor: 2  },
  { label: '∫',      insert: '\\int_{}^{} ',     cursor: 5  },
  { label: '∑',      insert: '\\sum_{}^{} ',     cursor: 5  },
  { label: 'sup',    insert: '\\sup_{} ',        cursor: 5  },
  { label: 'inf',    insert: '\\inf_{} ',        cursor: 5  },
  { label: 'lim',    insert: '\\lim_{} ',        cursor: 5  },
  { label: '∞',      insert: '\\infty ',         cursor: 7  },
  { label: 'π',      insert: '\\pi ',            cursor: 4  },
  { label: 'α',      insert: '\\alpha ',         cursor: 7  },
  { label: 'β',      insert: '\\beta ',          cursor: 6  },
  { label: 'θ',      insert: '\\theta ',         cursor: 7  },
  { label: 'λ',      insert: '\\lambda ',        cursor: 8  },
  { label: '±',      insert: '\\pm ',            cursor: 4  },
  { label: '×',      insert: '\\times ',         cursor: 7  },
  { label: '≤',      insert: '\\leq ',           cursor: 5  },
  { label: '≥',      insert: '\\geq ',           cursor: 5  },
  { label: '≠',      insert: '\\neq ',           cursor: 5  },
  { label: '∈',      insert: '\\in ',            cursor: 4  },
  { label: '→',      insert: '\\to ',            cursor: 4  },
  { label: '⟹',     insert: '\\implies ',       cursor: 9  },
  { label: 'text',   insert: '\\text{}',         cursor: 6  },
  { label: 'ℝ',      insert: '\\mathbb{R}',      cursor: 10 },
  { label: 'ℕ',      insert: '\\mathbb{N}',      cursor: 10 },
]

export default function MathEditor({ value, onChange, placeholder }) {
  const [raw, setRaw] = useState(value || '')
  const [focused, setFocused] = useState(false)
  const taRef = useRef(null)

  useEffect(() => {
    if (value !== undefined && value !== raw) setRaw(value)
  }, [value])

  function emit(v) { setRaw(v); onChange?.(v) }

  function handleChange(e) { emit(e.target.value) }

  function handleKeyDown(e) {
    const ta = taRef.current
    const pos = ta.selectionStart
    const val = raw

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
      const next = val.slice(0, pos) + e.key + pairs[e.key] + val.slice(pos)
      emit(next)
      requestAnimationFrame(() => { ta.selectionStart = ta.selectionEnd = pos + 1 })
      return
    }

    // Smart backspace: delete whole \command
    if (e.key === 'Backspace' && pos > 0) {
      const before = val.slice(0, pos)
      const cmd = before.match(/\\[a-zA-Z]+$/)
      if (cmd) {
        e.preventDefault()
        const next = before.slice(0, -cmd[0].length) + val.slice(pos)
        emit(next)
        requestAnimationFrame(() => { ta.selectionStart = ta.selectionEnd = pos - cmd[0].length })
        return
      }
    }

    // Word expansion on Space
    if (e.key === ' ') {
      const before = val.slice(0, pos)
      const word = before.match(/\b([a-zA-Z_]+)$/)
      if (word) {
        const key = word[1]
        const expansion = SHORTCUTS[key]
        if (expansion) {
          e.preventDefault()
          const next = before.slice(0, -key.length) + expansion + ' ' + val.slice(pos)
          emit(next)
          // Place cursor inside first empty {} if present
          const braceIdx = expansion.indexOf('{}')
          const newPos = pos - key.length + (braceIdx !== -1 ? braceIdx + 1 : expansion.length) + 1
          requestAnimationFrame(() => { ta.selectionStart = ta.selectionEnd = newPos })
          return
        }
      }
    }
  }

  function insertAt(text, cursorOffset) {
    const ta = taRef.current
    if (!ta) return
    const pos = ta.selectionStart ?? raw.length
    const next = raw.slice(0, pos) + text + raw.slice(pos)
    emit(next)
    requestAnimationFrame(() => {
      ta.focus()
      ta.selectionStart = ta.selectionEnd = pos + cursorOffset
    })
  }

  const preview = raw.trim() ? renderLatex(raw) : ''

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {/* Toolbar — shown when focused */}
      {focused && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3 }}>
          {QUICK_INSERTS.map(item => (
            <button
              key={item.label}
              className="btn"
              onMouseDown={e => { e.preventDefault(); insertAt(item.insert, item.cursor) }}
              style={{ padding: '2px 7px', fontSize: 12, height: 'auto', minWidth: 0, fontFamily: 'inherit' }}
            >
              {item.label}
            </button>
          ))}
        </div>
      )}

      {/* Input */}
      <div style={{ position: 'relative' }}>
        <textarea
          ref={taRef}
          value={raw}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          placeholder={placeholder || 'Type your answer. Use \\frac{}{}, \\sqrt{}, \\sup_D, \\leq etc. or click toolbar. Type "frac " to expand.'}
          className="input"
          style={{ minHeight: 110, fontFamily: 'JetBrains Mono, monospace', fontSize: 13, lineHeight: 1.7, resize: 'vertical', width: '100%', paddingRight: 44 }}
          spellCheck={false}
        />
        <span style={{ position: 'absolute', top: 7, right: 10, fontSize: 9, color: 'var(--ink-3)', pointerEvents: 'none', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
          LaTeX
        </span>
      </div>

      {/* Live preview */}
      {raw.trim() && (
        <div style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '10px 14px' }}>
          <div style={{ fontSize: 9, color: 'var(--ink-3)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Preview</div>
          <div dangerouslySetInnerHTML={{ __html: preview }} style={{ lineHeight: 2, color: 'var(--ink-1)', overflowX: 'auto' }} />
        </div>
      )}

      {/* Tips */}
      {focused && (
        <p style={{ fontSize: 10, color: 'var(--ink-3)', lineHeight: 1.7 }}>
          Type a keyword then Space to expand:{' '}
          {['frac', 'sqrt', 'sup', 'lim', 'sum', 'int', 'leq', 'geq', 'in', 'implies', 'forall', 'exists', 'alpha', 'beta', 'pi', 'infty'].map(k => (
            <code key={k} style={{ background: 'var(--surface-3)', padding: '0 3px', borderRadius: 2, marginRight: 3 }}>{k}</code>
          ))}
        </p>
      )}
    </div>
  )
}
