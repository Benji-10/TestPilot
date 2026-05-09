import { useState, useMemo } from 'react'
import katex from 'katex'

function renderKatex(expr, display = false) {
  if (!expr) return ''
  try {
    return katex.renderToString(String(expr), { displayMode: display, throwOnError: false, errorColor: 'var(--danger)' })
  } catch { return String(expr) }
}

export default function OpenBookSidebar({ files, exam }) {
  const [search, setSearch] = useState('')

  // Prefer exam-level open book items extracted during generation
  const examItems = useMemo(() => {
    return exam?.metadata_json?.open_book_items || []
  }, [exam])

  // Fall back to file-level formula extraction
  const fileItems = useMemo(() => {
    if (examItems.length > 0) return []
    const result = []
    for (const file of (files || [])) {
      for (const f of (file.formulas_json || [])) {
        result.push({ ...f, source: file.name, type: 'formula' })
      }
    }
    return result
  }, [files, examItems])

  const allItems = examItems.length > 0 ? examItems : fileItems

  const filtered = allItems.filter(item => {
    if (!search) return true
    const s = search.toLowerCase()
    return (
      item.name?.toLowerCase().includes(s) ||
      item.latex?.toLowerCase().includes(s) ||
      item.type?.toLowerCase().includes(s)
    )
  })

  const typeColor = { definition: '#60a5fa', theorem: '#c4bbff', lemma: '#4ade80', proposition: '#fbbf24', corollary: '#f97316', formula: 'var(--ink-3)' }

  return (
    <div style={{ width: 300, minWidth: 300, background: 'var(--surface-1)', borderLeft: '1px solid var(--border)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <div style={{ padding: '12px 12px 8px', borderBottom: '1px solid var(--border)' }}>
        <div style={{ fontSize: 11, color: 'var(--ink-2)', fontWeight: 500, marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
          <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
            <path d="M1 2.5h5v9H1V2.5zM7 2.5h5v9H7V2.5z" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round"/>
          </svg>
          Open Book
          <span style={{ marginLeft: 'auto', fontSize: 10, color: 'var(--ink-3)' }}>{allItems.length} items</span>
        </div>
        <input
          className="input"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search definitions, theorems…"
          style={{ fontSize: 11, padding: '5px 8px' }}
        />
      </div>

      <div className="scroll-y" style={{ flex: 1, padding: 8 }}>
        {filtered.length === 0 && (
          <div style={{ padding: 16, textAlign: 'center', color: 'var(--ink-3)', fontSize: 11, lineHeight: 1.7 }}>
            {allItems.length === 0
              ? 'No reference material extracted.\nTry uploading a PDF with clearly marked definitions and theorems.'
              : 'No matches found'
            }
          </div>
        )}

        {filtered.map((item, i) => (
          <div key={i} style={{
            marginBottom: 10, background: 'var(--surface-2)',
            borderRadius: 'var(--radius)', border: '1px solid var(--border)', padding: '8px 10px'
          }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginBottom: 5 }}>
              {item.type && (
                <span style={{ fontSize: 9, textTransform: 'uppercase', letterSpacing: '0.06em', color: typeColor[item.type] || 'var(--ink-3)', fontWeight: 600 }}>
                  {item.type}
                </span>
              )}
              {item.name && (
                <span style={{ fontSize: 11, color: 'var(--ink-1)', fontWeight: 500 }}>{item.name}</span>
              )}
            </div>
            <div
              dangerouslySetInnerHTML={{ __html: renderKatex(item.latex, item.latex?.length > 40) }}
              style={{ overflowX: 'auto', fontSize: '0.9em', lineHeight: 1.8 }}
            />
          </div>
        ))}
      </div>
    </div>
  )
}
