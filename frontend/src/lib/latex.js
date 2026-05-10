import katex from 'katex'

/**
 * Render a string containing LaTeX delimiters or bare LaTeX commands.
 * Handles: $$display$$, $inline$, bare \commands, plain text.
 * Returns an HTML string safe to set via dangerouslySetInnerHTML.
 */
export function renderLatex(text) {
  if (!text) return ''
  const s = String(text)

  // If it has explicit $ delimiters, parse them
  if (s.includes('$')) {
    return s
      .replace(/\$\$([\s\S]+?)\$\$/g, (_, expr) => katexStr(expr, true))
      .replace(/\$([^$\n]+?)\$/g, (_, expr) => katexStr(expr, false))
      .replace(/\n/g, '<br/>')
  }

  // No delimiters — check for bare LaTeX content
  const hasLatex = /\\[a-zA-Z]|[\\^_{}]/.test(s)
  if (hasLatex) {
    return s.split('\n').map(line => {
      const t = line.trim()
      if (!t) return '<br/>'
      if (/\\[a-zA-Z]|[\\^_{}]/.test(t)) {
        return katexStr(t, false) + '<br/>'
      }
      return escHtml(line) + '<br/>'
    }).join('')
  }

  // Plain text
  return escHtml(s).replace(/\n/g, '<br/>')
}

/**
 * Render a single LaTeX expression (no delimiters needed).
 * Use for known-math fields like marking scheme steps.
 */
export function renderMath(expr, display = false) {
  if (!expr) return ''
  const s = String(expr).trim()
  if (!s) return ''
  // If it already has delimiters, strip them
  const stripped = s.replace(/^\$\$|\$\$$/g, '').replace(/^\$|\$$/g, '').trim()
  return katexStr(stripped || s, display)
}

function katexStr(expr, display) {
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

/** Inline LaTeX component */
export function LatexSpan({ children, display = false }) {
  const html = renderMath(String(children || ''), display)
  return <span dangerouslySetInnerHTML={{ __html: html }} />
}

/** Block with mixed text + LaTeX */
export function LatexBlock({ children, style }) {
  const html = renderLatex(String(children || ''))
  return <div dangerouslySetInnerHTML={{ __html: html }} style={{ lineHeight: 1.9, ...style }} />
}
