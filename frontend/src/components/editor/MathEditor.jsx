import { useState, useRef, useEffect, useId } from 'react'
import { renderLatex } from '../../lib/latex.js'

// ── Shortcuts ─────────────────────────────────────────────────────────────────
const SHORTCUTS = {
  frac: '\\frac{}{}', sqrt: '\\sqrt{}', vec: '\\vec{}',
  hat: '\\hat{}', bar: '\\bar{}', text: '\\text{}',
  sin: '\\sin ', cos: '\\cos ', tan: '\\tan ', cot: '\\cot ',
  ln: '\\ln ', log: '\\log ', exp: '\\exp ',
  max: '\\max ', min: '\\min ', sup: '\\sup ', inf: '\\inf ',
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

function insideTextGroup(str, pos) {
  let depth = 0
  let i = pos - 1
  while (i >= 0) {
    if (str[i] === '}') depth++
    else if (str[i] === '{') {
      if (depth === 0) {
        const before = str.slice(0, i)
        if (/\\text\s*$/.test(before)) return true
      } else depth--
    }
    i--
  }
  return false
}

function insideMath(str, pos) {
  const before = str.slice(0, pos)
  const dd = (before.match(/\$\$/g) || []).length
  if (dd % 2 === 1) return true
  const cleaned = before.replace(/\$\$/g, '')
  return ((cleaned.match(/\$/g) || []).length) % 2 === 1
}

// ── Live preview renderer ─────────────────────────────────────────────────────
// Strategy: for the block being edited, find which $...$ region the caret is in.
// Render all OTHER $...$ regions normally. The ACTIVE $...$ region shows as raw text.
// Plain text segments always render as-is (no syntax to break).

function renderBlockWithCursor(text, caretPos) {
  // Tokenise into segments
  const segs = []
  let i = 0
  while (i < text.length) {
    // $$...$$
    if (text[i] === '$' && text[i + 1] === '$') {
      const start = i + 2
      const end = text.indexOf('$$', start)
      if (end !== -1) {
        segs.push({ type: 'display', content: text.slice(start, end), from: i, to: end + 2 })
        i = end + 2
        continue
      }
      // unclosed $$ — rest is active math
      segs.push({ type: 'display_open', content: text.slice(start), from: i, to: text.length })
      break
    }
    // $...$
    if (text[i] === '$') {
      const start = i + 1
      let j = start
      while (j < text.length) {
        if (text[j] === '$') break
        if (text[j] === '\n') break
        j++
      }
      if (j < text.length && text[j] === '$' && j > start) {
        segs.push({ type: 'inline', content: text.slice(start, j), from: i, to: j + 1 })
        i = j + 1
        continue
      }
      // unclosed $
      segs.push({ type: 'inline_open', content: text.slice(start), from: i, to: text.length })
      break
    }
    // plain text
    let j = i
    while (j < text.length && text[j] !== '$') j++
    segs.push({ type: 'text', content: text.slice(i, j), from: i, to: j })
    i = j
  }

  // Find which segment contains the caret
  const activeIdx = segs.findIndex(s => caretPos > s.from && caretPos <= s.to)

  return segs.map((seg, idx) => {
    const isActive = idx === activeIdx

    if (seg.type === 'text') {
      // Plain text always renders as text (no LaTeX to break)
      return seg.content
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    }

    if (isActive) {
      // Active math region — show raw with a cursor marker
      const delim = seg.type === 'display' || seg.type === 'display_open' ? '$$' : '$'
      const raw = seg.content
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      return `<span style="font-family:JetBrains Mono,monospace;font-size:12px;color:var(--ink-2);background:var(--accent-glow);border-radius:3px;padding:1px 3px">${delim}${raw}${delim}</span>`
    }

    // Inactive math — render properly
    if (seg.type === 'display' || seg.type === 'display_open') {
      return katexRender(seg.content, true)
    }
    return katexRender(seg.content, false)
  }).join('')
}

function katexRender(expr, display) {
  if (!expr.trim()) return ''
  try {
    const katex = window._katex
    if (!katex) return expr
    return katex.renderToString(expr, {
      displayMode: display,
      throwOnError: false,
      errorColor: 'var(--danger)',
    })
  } catch { return expr }
}

// Expose katex globally so renderBlockWithCursor can use it without an import cycle
import katex from 'katex'
if (typeof window !== 'undefined') window._katex = katex

// ── Block component ───────────────────────────────────────────────────────────
function Block({ id, text, focused, caretPos, onFocus, onChange, onKeyDown, onCaretChange, textareaRef }) {

  function handleClick(e) {
    if (!focused) {
      // Don't prevent default — let browser place cursor naturally
      onFocus()
    }
    // If already focused, do nothing — let browser handle caret placement
  }

  function handleMouseDown(e) {
    if (!focused) {
      // We want the click to focus the textarea at the right position.
      // Don't call e.preventDefault() here — that would prevent cursor placement.
      // Just schedule focus after the click resolves.
      e.preventDefault()
      onFocus()
    }
    // If focused, let default happen so user can reposition cursor by clicking
  }

  function handleSelectionChange() {
    if (textareaRef.current && focused) {
      onCaretChange(textareaRef.current.selectionStart)
    }
  }

  const previewHtml = focused && text.includes('$')
    ? renderBlockWithCursor(text, caretPos ?? 0)
    : text.trim()
      ? renderLatex(text)
      : null

  return (
    <div style={{ position: 'relative', minHeight: 32 }}>
      {/* Always-present textarea, visible only when focused */}
      <textarea
        ref={textareaRef}
        value={text}
        onChange={e => { onChange(e.target.value); onCaretChange(e.target.selectionStart) }}
        onKeyDown={onKeyDown}
        onKeyUp={handleSelectionChange}
        onClick={handleSelectionChange}
        onSelect={handleSelectionChange}
        rows={1}
        style={{
          position: focused ? 'relative' : 'absolute',
          opacity: focused ? 1 : 0,
          pointerEvents: focused ? 'auto' : 'none',
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
          zIndex: focused ? 2 : 0,
        }}
        onInput={e => {
          e.target.style.height = 'auto'
          e.target.style.height = e.target.scrollHeight + 'px'
        }}
      />

      {/* Rendered overlay — shown when not focused, or as live preview when focused with $ */}
      {!focused && (
        <div
          onMouseDown={handleMouseDown}
          style={{
            minHeight: 32,
            padding: '3px 0',
            lineHeight: 1.9,
            cursor: 'text',
            fontSize: 14,
            userSelect: 'text',
            color: previewHtml ? 'var(--ink-1)' : 'var(--ink-3)',
          }}
        >
          {previewHtml ? (
            <span dangerouslySetInnerHTML={{ __html: previewHtml }} />
          ) : (
            <span style={{ opacity: 0.25, fontSize: 13, fontFamily: 'JetBrains Mono, monospace' }}>
              {text || ''}
            </span>
          )}
        </div>
      )}

      {/* Live preview strip when focused and has math */}
      {focused && text.includes('$') && previewHtml && (
        <div
          style={{
            marginTop: 2,
            padding: '4px 8px',
            background: 'var(--surface-2)',
            borderRadius: 'var(--radius)',
            borderLeft: '2px solid var(--accent)',
            fontSize: 13,
            lineHeight: 1.9,
            userSelect: 'none',
            pointerEvents: 'none',
          }}
          dangerouslySetInnerHTML={{ __html: previewHtml }}
        />
      )}
    </div>
  )
}

// ── Main editor ───────────────────────────────────────────────────────────────
function toBlocks(raw) {
  if (!raw) return [{ id: 0, text: '' }]
  return raw.split('\n').map((line, i) => ({ id: i, text: line }))
}

function fromBlocks(blocks) {
  return blocks.map(b => b.text).join('\n')
}

export default function MathEditor({ value = '', onChange, placeholder }) {
  const [blocks, setBlocks] = useState(() => toBlocks(value))
  const [focusedIdx, setFocusedIdx] = useState(null)
  const [caretPos, setCaretPos] = useState(0)
  const textareaRefs = useRef([])
  const lastEmitted = useRef(value)
  const editorRef = useRef(null)

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

  function focusAt(index, pos) {
    setFocusedIdx(index)
    requestAnimationFrame(() => {
      const ta = textareaRefs.current[index]
      if (!ta) return
      ta.style.height = 'auto'
      ta.style.height = ta.scrollHeight + 'px'
      ta.focus()
      if (pos !== undefined) {
        ta.selectionStart = ta.selectionEnd = pos
        setCaretPos(pos)
      }
    })
  }

  function handleKeyDown(e, index) {
    const ta = textareaRefs.current[index]
    if (!ta) return
    const pos = ta.selectionStart
    const text = blocks[index].text
    const before = text.slice(0, pos)
    const after = text.slice(pos)

    if (e.key === 'Enter') {
      e.preventDefault()
      const newId = Date.now() + index
      const updated = [
        ...blocks.slice(0, index),
        { ...blocks[index], text: before },
        { id: newId, text: after },
        ...blocks.slice(index + 1),
      ]
      setBlocks(updated)
      emit(updated)
      const ni = index + 1
      setFocusedIdx(ni)
      requestAnimationFrame(() => {
        const next = textareaRefs.current[ni]
        if (next) { next.focus(); next.selectionStart = next.selectionEnd = 0; setCaretPos(0) }
      })
      return
    }

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
      focusAt(index - 1, prevText.length)
      return
    }

    if (e.key === 'ArrowUp' && index > 0) {
      e.preventDefault(); focusAt(index - 1); return
    }
    if (e.key === 'ArrowDown' && index < blocks.length - 1) {
      e.preventDefault(); focusAt(index + 1); return
    }

    if (e.key === '$') {
      e.preventDefault()
      const next = before + '$$' + after
      updateBlock(index, next)
      const np = pos + 1
      requestAnimationFrame(() => { if (ta) { ta.selectionStart = ta.selectionEnd = np; setCaretPos(np) } })
      return
    }

    if (e.key === '{') {
      e.preventDefault()
      const next = before + '{}' + after
      updateBlock(index, next)
      const np = pos + 1
      requestAnimationFrame(() => { if (ta) { ta.selectionStart = ta.selectionEnd = np; setCaretPos(np) } })
      return
    }

    if (e.key === 'Tab') {
      e.preventDefault()
      updateBlock(index, before + '  ' + after)
      const np = pos + 2
      requestAnimationFrame(() => { if (ta) { ta.selectionStart = ta.selectionEnd = np; setCaretPos(np) } })
      return
    }

    if (e.key === ' ') {
      if (insideMath(text, pos) && !insideTextGroup(text, pos)) {
        const m = before.match(/[a-zA-Z_]+$/)
        if (m && SHORTCUTS[m[0]]) {
          e.preventDefault()
          const latex = SHORTCUTS[m[0]]
          const replaced = before.slice(0, -m[0].length)
          const next = replaced + latex + after
          updateBlock(index, next)
          const cp = CURSOR_AFTER[latex]
          const np = replaced.length + (cp ?? latex.length)
          requestAnimationFrame(() => { if (ta) { ta.selectionStart = ta.selectionEnd = np; setCaretPos(np) } })
          return
        }
      }
    }
  }

  // Click outside → blur
  useEffect(() => {
    function down(e) {
      if (editorRef.current && !editorRef.current.contains(e.target)) {
        setFocusedIdx(null)
      }
    }
    document.addEventListener('mousedown', down)
    return () => document.removeEventListener('mousedown', down)
  }, [])

  const isEmpty = blocks.every(b => !b.text.trim())

  return (
    <div
      ref={editorRef}
      style={{ position: 'relative', minHeight: 80, cursor: 'text' }}
      onClick={e => {
        // Only focus last block if clicking the container itself (not a block)
        if (e.target === editorRef.current && focusedIdx === null) {
          focusAt(blocks.length - 1)
        }
      }}
    >
      {isEmpty && focusedIdx === null && (
        <div style={{
          position: 'absolute', top: 3, left: 0, pointerEvents: 'none',
          color: 'var(--ink-3)', fontSize: 13,
          fontFamily: 'JetBrains Mono, monospace', lineHeight: 1.9,
        }}>
          {placeholder || 'Write your answer. Maths inside $…$ — inside $, type keywords + Space to expand (frac, sqrt, lim, leq, veps…)'}
        </div>
      )}

      {blocks.map((block, index) => (
        <Block
          key={block.id}
          id={block.id}
          text={block.text}
          focused={focusedIdx === index}
          caretPos={focusedIdx === index ? caretPos : 0}
          onFocus={() => focusAt(index)}
          onChange={text => updateBlock(index, text)}
          onKeyDown={e => handleKeyDown(e, index)}
          onCaretChange={p => setCaretPos(p)}
          textareaRef={el => { textareaRefs.current[index] = el }}
        />
      ))}

      {focusedIdx !== null && (
        <div style={{
          fontSize: 9, color: 'var(--ink-3)', marginTop: 6,
          textTransform: 'uppercase', letterSpacing: '0.06em',
        }}>
          Inside $…$: keywords expand on Space · Enter = new line · ↑↓ navigate
        </div>
      )}
    </div>
  )
}
