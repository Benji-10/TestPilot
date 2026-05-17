import { useState, useRef, useEffect, useCallback } from 'react'
import { renderLatex } from '../../lib/latex.js'

// ── Shortcuts (only fire outside \text{} and outside prose context) ──────────
const SHORTCUTS = {
  frac: '\\frac{}{}', sqrt: '\\sqrt{}', vec: '\\vec{}',
  hat: '\\hat{}', bar: '\\bar{}', text: '\\text{}',
  sin: '\\sin ', cos: '\\cos ', tan: '\\tan ', ln: '\\ln ', log: '\\log ',
  exp: '\\exp ', max: '\\max ', min: '\\min ', sup: '\\sup ', inf: '\\inf ',
  lim: '\\lim ', sum: '\\sum ', prod: '\\prod ', int: '\\int ',
  partial: '\\partial ', nabla: '\\nabla ', infty: '\\infty ',
  pi: '\\pi ', alpha: '\\alpha ', beta: '\\beta ', gamma: '\\gamma ',
  delta: '\\delta ', epsilon: '\\epsilon ', eps: '\\epsilon ',
  varepsilon: '\\varepsilon ', vareps: '\\varepsilon ', veps: '\\varepsilon ',
  theta: '\\theta ', lambda: '\\lambda ', mu: '\\mu ', sigma: '\\sigma ',
  omega: '\\omega ', phi: '\\phi ', varphi: '\\varphi ', psi: '\\psi ',
  times: '\\times ', cdot: '\\cdot ', pm: '\\pm ',
  leq: '\\leq ', geq: '\\geq ', neq: '\\neq ', approx: '\\approx ',
  equiv: '\\equiv ', subset: '\\subset ', subseteq: '\\subseteq ',
  in: '\\in ', notin: '\\notin ', cup: '\\cup ', cap: '\\cap ',
  emptyset: '\\emptyset ', forall: '\\forall ', exists: '\\exists ',
  to: '\\to ', implies: '\\implies ', iff: '\\iff ',
  RR: '\\mathbb{R}', NN: '\\mathbb{N}', ZZ: '\\mathbb{Z}',
  QQ: '\\mathbb{Q}', CC: '\\mathbb{C}',
}

const CURSOR_AFTER = {
  '\\frac{}{}': 6, '\\sqrt{}': 6, '\\vec{}': 5,
  '\\hat{}': 5, '\\bar{}': 5, '\\text{}': 6,
  '\\mathbb{R}': 11, '\\mathbb{N}': 11, '\\mathbb{Z}': 11,
  '\\mathbb{Q}': 11, '\\mathbb{C}': 11,
}

/** Is the caret inside a \text{...} group? */
function insideTextGroup(str, pos) {
  // Walk backwards from pos looking for unclosed \text{
  let depth = 0
  let i = pos - 1
  while (i >= 0) {
    if (str[i] === '}') depth++
    else if (str[i] === '{') {
      if (depth === 0) {
        // Check if preceded by \text
        const before = str.slice(0, i)
        if (/\\text\s*$/.test(before)) return true
        // any other \cmd{ — not text
      } else {
        depth--
      }
    }
    i--
  }
  return false
}

/** Is the caret inside a $ math region? */
function insideMath(str, pos) {
  const before = str.slice(0, pos)
  const dd = (before.match(/\$\$/g) || []).length
  if (dd % 2 === 1) return true
  const cleaned = before.replace(/\$\$/g, '')
  return ((cleaned.match(/\$/g) || []).length) % 2 === 1
}

/** Split raw text into blocks by newline */
function toBlocks(raw) {
  return raw.split('\n').map((line, i) => ({ id: i, text: line }))
}

/** Join blocks back to raw text */
function fromBlocks(blocks) {
  return blocks.map(b => b.text).join('\n')
}

// ── Single block component ────────────────────────────────────────────────────
function Block({ text, focused, onFocus, onChange, onKeyDown, inputRef, index }) {
  const preview = text.trim() ? renderLatex(text) : ''

  if (!focused) {
    // Rendered mode — click anywhere to edit
    return (
      <div
        onClick={() => onFocus(index)}
        style={{
          minHeight: 32,
          padding: '3px 0',
          lineHeight: 1.9,
          cursor: 'text',
          color: text.trim() ? 'var(--ink-1)' : 'var(--ink-3)',
          fontSize: 14,
          fontFamily: text.trim() ? 'inherit' : 'JetBrains Mono, monospace',
          userSelect: 'text',
        }}
      >
        {text.trim() ? (
          <span dangerouslySetInnerHTML={{ __html: preview }} />
        ) : (
          <span style={{ opacity: 0.3, fontSize: 13 }}>New line…</span>
        )}
      </div>
    )
  }

  // Edit mode
  return (
    <textarea
      ref={inputRef}
      value={text}
      onChange={e => onChange(e.target.value)}
      onKeyDown={onKeyDown}
      rows={1}
      style={{
        width: '100%',
        background: 'transparent',
        border: 'none',
        outline: 'none',
        resize: 'none',
        fontFamily: 'JetBrains Mono, monospace',
        fontSize: 13,
        lineHeight: 1.9,
        color: 'var(--ink-1)',
        padding: '3px 0',
        overflow: 'hidden',
        minHeight: 32,
      }}
      onInput={e => {
        // Auto-resize
        e.target.style.height = 'auto'
        e.target.style.height = e.target.scrollHeight + 'px'
      }}
    />
  )
}

// ── Main editor ───────────────────────────────────────────────────────────────
export default function MathEditor({ value = '', onChange, placeholder }) {
  const [blocks, setBlocks] = useState(() => toBlocks(value))
  const [focusedBlock, setFocusedBlock] = useState(null)
  const inputRefs = useRef({})

  // Sync value → blocks when parent changes value externally
  const lastEmitted = useRef(value)
  useEffect(() => {
    if (value !== lastEmitted.current) {
      setBlocks(toBlocks(value))
    }
  }, [value])

  function emit(newBlocks) {
    const raw = fromBlocks(newBlocks)
    lastEmitted.current = raw
    onChange?.(raw)
  }

  function updateBlock(index, text) {
    const next = blocks.map((b, i) => i === index ? { ...b, text } : b)
    setBlocks(next)
    emit(next)
  }

  function focusBlock(index, caretPos) {
    setFocusedBlock(index)
    requestAnimationFrame(() => {
      const ta = inputRefs.current[index]
      if (ta) {
        ta.style.height = 'auto'
        ta.style.height = ta.scrollHeight + 'px'
        ta.focus()
        if (caretPos !== undefined) {
          ta.selectionStart = ta.selectionEnd = caretPos
        }
      }
    })
  }

  function handleKeyDown(e, index) {
    const ta = inputRefs.current[index]
    if (!ta) return
    const pos = ta.selectionStart
    const text = blocks[index].text
    const before = text.slice(0, pos)
    const after = text.slice(pos)

    // Enter → split block or create new block
    if (e.key === 'Enter') {
      e.preventDefault()
      const newBlock = { id: Date.now(), text: after }
      const updated = [
        ...blocks.slice(0, index),
        { ...blocks[index], text: before },
        newBlock,
        ...blocks.slice(index + 1),
      ]
      setBlocks(updated)
      emit(updated)
      // Focus new block
      const newIndex = index + 1
      requestAnimationFrame(() => {
        setFocusedBlock(newIndex)
        requestAnimationFrame(() => {
          const nextTa = inputRefs.current[newIndex]
          if (nextTa) { nextTa.focus(); nextTa.selectionStart = nextTa.selectionEnd = 0 }
        })
      })
      return
    }

    // Backspace at start of block → merge with previous
    if (e.key === 'Backspace' && pos === 0 && index > 0) {
      e.preventDefault()
      const prevText = blocks[index - 1].text
      const merged = prevText + text
      const updated = [
        ...blocks.slice(0, index - 1),
        { ...blocks[index - 1], text: merged },
        ...blocks.slice(index + 1),
      ]
      setBlocks(updated)
      emit(updated)
      focusBlock(index - 1, prevText.length)
      return
    }

    // Arrow up → go to previous block
    if (e.key === 'ArrowUp' && index > 0) {
      e.preventDefault()
      focusBlock(index - 1)
      return
    }

    // Arrow down → go to next block
    if (e.key === 'ArrowDown' && index < blocks.length - 1) {
      e.preventDefault()
      focusBlock(index + 1)
      return
    }

    // $ → insert matching $, cursor between
    if (e.key === '$') {
      e.preventDefault()
      const next = before + '$$' + after
      updateBlock(index, next)
      requestAnimationFrame(() => {
        if (ta) ta.selectionStart = ta.selectionEnd = pos + 1
      })
      return
    }

    // { → auto-close
    if (e.key === '{') {
      e.preventDefault()
      const next = before + '{}' + after
      updateBlock(index, next)
      requestAnimationFrame(() => {
        if (ta) ta.selectionStart = ta.selectionEnd = pos + 1
      })
      return
    }

    // Tab → 2 spaces
    if (e.key === 'Tab') {
      e.preventDefault()
      updateBlock(index, before + '  ' + after)
      requestAnimationFrame(() => {
        if (ta) ta.selectionStart = ta.selectionEnd = pos + 2
      })
      return
    }

    // Space → keyword expansion, only when inside math AND not inside \text{}
    if (e.key === ' ') {
      const inMath = insideMath(text, pos)
      const inText = insideTextGroup(text, pos)
      if (inMath && !inText) {
        const m = before.match(/[a-zA-Z_]+$/)
        if (m) {
          const latex = SHORTCUTS[m[0]]
          if (latex) {
            e.preventDefault()
            const replaced = before.slice(0, -m[0].length)
            const next = replaced + latex + after
            updateBlock(index, next)
            const cp = CURSOR_AFTER[latex]
            const newCaret = replaced.length + (cp ?? latex.length)
            requestAnimationFrame(() => {
              if (ta) ta.selectionStart = ta.selectionEnd = newCaret
            })
            return
          }
        }
      }
    }
  }

  // Click outside → blur all
  useEffect(() => {
    function handleClick(e) {
      const editorEl = document.getElementById('math-editor-root')
      if (editorEl && !editorEl.contains(e.target)) {
        setFocusedBlock(null)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  const isEmpty = blocks.every(b => !b.text.trim())

  return (
    <div
      id="math-editor-root"
      style={{
        position: 'relative',
        minHeight: 80,
        padding: '8px 0',
        cursor: 'text',
      }}
      onClick={() => {
        if (focusedBlock === null) focusBlock(blocks.length - 1)
      }}
    >
      {/* Placeholder */}
      {isEmpty && focusedBlock === null && (
        <div style={{
          position: 'absolute', top: 8, left: 0, pointerEvents: 'none',
          color: 'var(--ink-3)', fontSize: 13, fontFamily: 'JetBrains Mono, monospace',
          lineHeight: 1.9,
        }}>
          {placeholder || 'Write your answer. Click to edit. Maths goes inside $…$ — type keywords then Space inside $ to expand.'}
        </div>
      )}

      {blocks.map((block, index) => (
        <Block
          key={block.id}
          index={index}
          text={block.text}
          focused={focusedBlock === index}
          onFocus={(i) => focusBlock(i)}
          onChange={(text) => updateBlock(index, text)}
          onKeyDown={(e) => handleKeyDown(e, index)}
          inputRef={el => { inputRefs.current[index] = el }}
        />
      ))}

      {/* Subtle editing indicator */}
      {focusedBlock !== null && (
        <div style={{
          fontSize: 9, color: 'var(--ink-3)', marginTop: 4,
          textTransform: 'uppercase', letterSpacing: '0.06em',
        }}>
          Inside $…$: keywords expand on Space (frac, sqrt, sup, lim, leq, veps, RR…) · Enter for new line
        </div>
      )}
    </div>
  )
}
