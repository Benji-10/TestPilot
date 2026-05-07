import { clsx } from 'clsx'

export { clsx as cx }

export function formatTime(seconds) {
  if (seconds < 0) seconds = 0
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = seconds % 60
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

export function formatDate(dateStr) {
  if (!dateStr) return ''
  const d = new Date(dateStr)
  const now = new Date()
  const diff = now - d
  const mins = Math.floor(diff / 60000)
  const hours = Math.floor(diff / 3600000)
  const days = Math.floor(diff / 86400000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  if (hours < 24) return `${hours}h ago`
  if (days < 7) return `${days}d ago`
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
}

export function formatFileSize(bytes) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export function slugify(str) {
  return str.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
}

export function randomId() {
  return Math.random().toString(36).slice(2, 10)
}

export function percentage(score, max) {
  if (!max) return 0
  return Math.round((score / max) * 100)
}

export function gradeLabel(pct) {
  if (pct >= 90) return { label: 'A*', color: '#4ade80' }
  if (pct >= 80) return { label: 'A', color: '#4ade80' }
  if (pct >= 70) return { label: 'B', color: '#60a5fa' }
  if (pct >= 60) return { label: 'C', color: '#fbbf24' }
  if (pct >= 50) return { label: 'D', color: '#f97316' }
  return { label: 'U', color: '#ff5f5f' }
}

export function debounce(fn, ms) {
  let t
  return (...args) => {
    clearTimeout(t)
    t = setTimeout(() => fn(...args), ms)
  }
}

export function groupBy(arr, key) {
  return arr.reduce((acc, item) => {
    const k = typeof key === 'function' ? key(item) : item[key]
    if (!acc[k]) acc[k] = []
    acc[k].push(item)
    return acc
  }, {})
}

// LaTeX token utilities
export const LATEX_SHORTCUTS = {
  'sin': '\\sin',
  'cos': '\\cos',
  'tan': '\\tan',
  'ln': '\\ln',
  'log': '\\log',
  'sqrt': '\\sqrt{}',
  'inf': '\\infty',
  'pi': '\\pi',
  'alpha': '\\alpha',
  'beta': '\\beta',
  'gamma': '\\gamma',
  'delta': '\\delta',
  'theta': '\\theta',
  'lambda': '\\lambda',
  'mu': '\\mu',
  'sigma': '\\sigma',
  'omega': '\\omega',
  'int': '\\int',
  'sum': '\\sum',
  'prod': '\\prod',
  'lim': '\\lim',
  'frac': '\\frac{}{}',
  'vec': '\\vec{}',
  'hat': '\\hat{}',
  'bar': '\\bar{}',
  '->': '\\rightarrow',
  '=>': '\\Rightarrow',
  '<=': '\\leq',
  '>=': '\\geq',
  '!=': '\\neq',
  '+-': '\\pm',
  'times': '\\times',
  'div': '\\div',
  'cdot': '\\cdot',
}

export function applyLatexShortcuts(text) {
  let result = text
  for (const [key, val] of Object.entries(LATEX_SHORTCUTS)) {
    const escaped = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    result = result.replace(new RegExp(`\\b${escaped}\\b`, 'g'), val)
  }
  return result
}

export function sessionColor(seed) {
  const colors = [
    '#7c6aff', '#ff6b9d', '#06d6a0', '#ffd166', '#ef476f',
    '#118ab2', '#f4a261', '#a8dadc', '#e76f51', '#2a9d8f'
  ]
  let hash = 0
  for (let i = 0; i < seed.length; i++) hash = seed.charCodeAt(i) + ((hash << 5) - hash)
  return colors[Math.abs(hash) % colors.length]
}

export function getFileIcon(mimeType) {
  if (mimeType?.includes('pdf')) return '📄'
  if (mimeType?.includes('image')) return '🖼'
  if (mimeType?.includes('word') || mimeType?.includes('document')) return '📝'
  if (mimeType?.includes('text')) return '📃'
  return '📎'
}
