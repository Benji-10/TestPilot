import { useState, useMemo } from 'react'
import { renderLatex, renderMath } from '../../lib/latex.js'

const LatexBlock = ({ children, display }) => (
  <div dangerouslySetInnerHTML={{ __html: display
    ? renderMath(String(children || ''), true)
    : renderLatex(String(children || ''))
  }} style={{ lineHeight: 1.9, overflowX: 'auto' }} />
)

const TYPE_COLOR = {
  definition: '#60a5fa', theorem: '#c4bbff', lemma: '#4ade80',
  proposition: '#fbbf24', corollary: '#f97316', formula: 'var(--ink-3)',
  corollary: '#f97316',
}

export default function OpenBookSidebar({ files, exam }) {
  const [search, setSearch] = useState('')

  const examItems = useMemo(() => exam?.metadata_json?.open_book_items || [], [exam])

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

  const filtered = useMemo(() => {
    if (!search.trim()) return allItems
    const s = search.toLowerCase()
    return allItems.filter(item =>
      item.name?.toLowerCase().includes(s) ||
      item.latex?.toLowerCase().includes(s) ||
      item.type?.toLowerCase().includes(s)
    )
  }, [allItems, search])

  return (
    <div style={{
      width: 300, minWidth: 300, background: 'var(--surface-1)',
      borderLeft: '1px solid var(--border)', display: 'flex',
      flexDirection: 'column', overflow: 'hidden'
    }}>
      {/* Header */}
      <div style={{ padding: '12px 12px 8px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
          <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
            <path d="M1 2.5h5v9H1V2.5zM7 2.5h5v9H7V2.5z" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round" style={{ color: 'var(--ink-2)' }}/>
          </svg>
          <span style={{ fontSize: 11, color: 'var(--ink-2)', fontWeight: 500 }}>Open Book</span>
          <span style={{ marginLeft: 'auto', fontSize: 10, color: 'var(--ink-3)' }}>{allItems.length} item{allItems.length !== 1 ? 's' : ''}</span>
        </div>
        <input
          className="input"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search definitions, theorems…"
          style={{ fontSize: 11, padding: '5px 8px' }}
        />
      </div>

      {/* Items */}
      <div className="scroll-y" style={{ flex: 1, padding: 8 }}>
        {filtered.length === 0 && (
          <div style={{ padding: '20px 8px', textAlign: 'center', color: 'var(--ink-3)', fontSize: 11, lineHeight: 1.8 }}>
            {allItems.length === 0
              ? 'No reference material found.\nUpload a PDF with clearly marked definitions or theorems.'
              : 'No matches for "' + search + '"'}
          </div>
        )}
        {filtered.map((item, i) => (
          <div key={i} style={{
            marginBottom: 8, background: 'var(--surface-2)',
            borderRadius: 'var(--radius)', border: '1px solid var(--border)', padding: '9px 11px'
          }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 7, marginBottom: 6 }}>
              {item.type && (
                <span style={{
                  fontSize: 9, textTransform: 'uppercase', letterSpacing: '0.07em',
                  color: TYPE_COLOR[item.type] || 'var(--ink-3)', fontWeight: 600, flexShrink: 0
                }}>
                  {item.type}
                </span>
              )}
              {item.name && (
                <span style={{ fontSize: 11, color: 'var(--ink-1)', fontWeight: 500, lineHeight: 1.4 }}>
                  {item.name}
                </span>
              )}
            </div>
            {item.latex && (
              <LatexBlock display={item.latex.length > 50}>{item.latex}</LatexBlock>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
