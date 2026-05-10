import katex from 'katex'

function katexStr(expr, display) {
  try {
    return katex.renderToString(expr.trim(), {
      displayMode: display,
      throwOnError: false,
      errorColor: '#ff5f5f',
      trust: false,
    })
  } catch {
    return `<span style="color:#ff5f5f;font-size:11px">${escHtml(expr)}</span>`
  }
}

function escHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

function isProse(s) {
  const words = s.match(/(?<!\\)\b[a-z]{3,}\b/g)
  return words && words.length >= 2
}

/**
 * Tokenise a mixed prose+math string, wrapping prose words in \text{}.
 * Handles: \commands, ^, _, {}, math symbols, and plain English words.
 */
function proseToLatex(str) {
  const tokens = []
  let i = 0
  let buf = ''

  const flush = () => {
    if (!buf) return
    const v = buf.trim()
    if (!v) { buf = ''; return }
    if (/^[A-Za-z]$/.test(v)) tokens.push(v)           // single letter = math var
    else if (/^[,.\s;:]+$/.test(v)) tokens.push(v)     // punctuation as-is
    else tokens.push(`\\text{${buf}}`)                  // prose → \text{}
    buf = ''
  }

  while (i < str.length) {
    if (str[i] === '\\') {
      flush()
      let cmd = '\\'
      i++
      while (i < str.length && /[a-zA-Z]/.test(str[i])) cmd += str[i++]
      // consume optional braced argument(s)
      while (str[i] === '{') {
        let depth = 0, arg = ''
        while (i < str.length) {
          if (str[i] === '{') depth++
          else if (str[i] === '}') { depth--; if (depth === 0) { arg += '}'; i++; break } }
          arg += str[i++]
        }
        cmd += arg
      }
      tokens.push(cmd)
      continue
    }
    if ('^_=<>+*/|%!'.includes(str[i]) || /\d/.test(str[i])) {
      flush()
      tokens.push(str[i++])
      continue
    }
    buf += str[i++]
  }
  flush()
  return tokens.join('')
}

/**
 * Universal renderer. Accepts any string — with or without $ delimiters.
 * - With $...$ / $$...$$: parses them explicitly
 * - With bare \commands but prose words: tokenises and wraps prose in \text{}
 * - With bare \commands and no prose: renders as math directly
 * - Plain text: returns escaped HTML
 */
export function renderLatex(text) {
  if (!text) return ''
  const s = String(text)

  // Has explicit $ delimiters → parse them, render rest as HTML
  if (s.includes('$')) {
    return s
      .replace(/\$\$([\s\S]+?)\$\$/g, (_, e) => katexStr(e, true))
      .replace(/\$([^$\n]+?)\$/g, (_, e) => katexStr(e, false))
      .replace(/\n/g, '<br/>')
  }

  // Has LaTeX commands
  if (/\\[a-zA-Z]/.test(s)) {
    return s.split('\n').map(line => {
      const t = line.trim()
      if (!t) return '<br/>'
      const converted = isProse(t) ? proseToLatex(t) : t
      return katexStr(converted, false) + '<br/>'
    }).join('')
  }

  // Plain text
  return escHtml(s).replace(/\n/g, '<br/>')
}

/**
 * Render a known-math field (no $ delimiters needed).
 * If it contains prose, auto-wraps in \text{}.
 */
export function renderMath(expr, display = false) {
  if (!expr) return ''
  const s = String(expr).trim()
  if (!s) return ''
  const stripped = s.replace(/^\$\$?|\$\$?$/g, '').trim()
  const target = stripped || s
  if (s.includes('$')) return renderLatex(s)
  const converted = isProse(target) ? proseToLatex(target) : target
  return katexStr(converted, display)
}
