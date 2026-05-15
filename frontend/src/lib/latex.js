import katex from 'katex'

function katexStr(expr, display) {
  if (!expr || !expr.trim()) return ''
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
  // Two or more plain English words (3+ letters, not preceded by backslash)
  const words = s.match(/(?<!\\)\b[a-z]{3,}\b/g)
  return words && words.length >= 2
}

function proseToLatex(str) {
  const tokens = []
  let i = 0
  let buf = ''

  const flush = () => {
    if (!buf) return
    const v = buf.trim()
    if (!v) { buf = ''; return }
    if (/^[A-Za-z]$/.test(v)) tokens.push(v)
    else if (/^[,.\s;:()\-]+$/.test(v)) tokens.push(v)
    else tokens.push(`\\text{${buf}}`)
    buf = ''
  }

  while (i < str.length) {
    if (str[i] === '\\') {
      flush()
      let cmd = '\\'
      i++
      while (i < str.length && /[a-zA-Z]/.test(str[i])) cmd += str[i++]
      // consume braced arguments
      while (i < str.length && str[i] === '{') {
        let depth = 0, arg = ''
        while (i < str.length) {
          if (str[i] === '{') depth++
          else if (str[i] === '}') {
            depth--
            if (depth === 0) { arg += '}'; i++; break }
          }
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
 * Tokenise a string with $ delimiters into segments.
 * Returns array of {type: 'text'|'inline'|'display', content: string}
 */
function tokenise(s) {
  const segments = [];
  let i = 0;
  while (i < s.length) {
    if (s[i] === '$' && s[i+1] === '$') {
      const start = i + 2;
      const end = s.indexOf('$$', start);
      if (end !== -1) {
        segments.push({ type: 'display', content: s.slice(start, end) });
        i = end + 2;
        continue;
      } else {
        segments.push({ type: 'text', content: '$$' });
        i += 2;
        continue;
      }
    }
    if (s[i] === '$') {
      const start = i + 1;
      let j = start;
      while (j < s.length) {
        if (s[j] === '$') {
          if (s[j+1] === '$') { j += 2; continue; }
          break;
        }
        if (s[j] === '\n') break;
        j++;
      }
      if (j < s.length && s[j] === '$' && j > start) {
        segments.push({ type: 'inline', content: s.slice(start, j) });
        i = j + 1;
        continue;
      } else {
        segments.push({ type: 'text', content: '$' });
        i++;
        continue;
      }
    }
    let j = i;
    while (j < s.length && s[j] !== '$') j++;
    if (j > i) segments.push({ type: 'text', content: s.slice(i, j) });
    i = j;
  }
  return segments;
}

/**
 * Main renderer. Handles:
 * 1. Strings with $...$ / $$...$$ delimiters — parsed properly via tokeniser
 * 2. Bare \commands with prose — auto-wraps prose in \text{}
 * 3. Bare \commands without prose — renders as inline math
 * 4. Plain text — escaped HTML
 */
export function renderLatex(text) {
  if (!text) return ''
  const s = String(text)

  if (s.includes('$')) {
    const segments = tokenise(s)
    return segments.map(seg => {
      if (seg.type === 'display') return katexStr(seg.content, true)
      if (seg.type === 'inline') return katexStr(seg.content, false)
      // Plain text segment — convert newlines to <br>
      return escHtml(seg.content).replace(/\n/g, '<br/>')
    }).join('')
  }

  // Bare LaTeX commands
  if (/\\[a-zA-Z]/.test(s)) {
    return s.split('\n').map(line => {
      const t = line.trim()
      if (!t) return '<br/>'
      const converted = isProse(t) ? proseToLatex(t) : t
      return katexStr(converted, false) + '<br/>'
    }).join('')
  }

  return escHtml(s).replace(/\n/g, '<br/>')
}

/**
 * Render a known-math expression (no $ needed).
 */
export function renderMath(expr, display = false) {
  if (!expr) return ''
  const s = String(expr).trim()
  if (!s) return ''
  if (s.includes('$')) return renderLatex(s)
  const converted = isProse(s) ? proseToLatex(s) : s
  return katexStr(converted, display)
}
