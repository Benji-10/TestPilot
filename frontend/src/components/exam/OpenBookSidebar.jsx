import { useState, useMemo } from 'react'
import katex from 'katex'

export default function OpenBookSidebar({ files }) {
  const [search, setSearch] = useState('')

  // Aggregate all formulas from files
  const allFormulas = useMemo(() => {
    const result = []
    for (const file of files) {
      const formulas = file.formulas_json || []
      for (const f of formulas) {
        result.push({ ...f, source: file.name })
      }
    }
    return result
  }, [files])

  const filtered = allFormulas.filter(f => {
    if (!search) return true
    const s = search.toLowerCase()
    return (
      f.name?.toLowerCase().includes(s) ||
      f.latex?.toLowerCase().includes(s) ||
      f.topic?.toLowerCase().includes(s)
    )
  })

  function renderKatex(expr) {
    try {
      return katex.renderToString(expr, {
        throwOnError: false,
        errorColor: 'var(--danger)',
        displayMode: true,
      })
    } catch {
      return expr
    }
  }

  return (
    <div className="openbook-sidebar">
      <div style={{ padding: '12px 12px 8px', borderBottom: '1px solid var(--border)' }}>
        <div style={{ fontSize: 11, color: 'var(--ink-2)', fontWeight: 500, marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
          <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
            <path d="M1 2.5h5v9H1V2.5zM7 2.5h5v9H7V2.5z" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round"/>
          </svg>
          Open Book
        </div>
        <input
          className="input"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search formulas..."
          style={{ fontSize: 11, padding: '5px 8px' }}
        />
      </div>

      <div className="scroll-y" style={{ flex: 1, padding: 8 }}>
        {filtered.length === 0 && (
          <div style={{ padding: 16, textAlign: 'center', color: 'var(--ink-3)', fontSize: 11 }}>
            {allFormulas.length === 0
              ? 'No formulas extracted from uploaded files'
              : 'No matches found'
            }
          </div>
        )}

        {filtered.map((f, i) => (
          <div
            key={i}
            style={{
              marginBottom: 10,
              background: 'var(--surface-2)',
              borderRadius: 'var(--radius)',
              border: '1px solid var(--border)',
              padding: '8px 10px',
              cursor: 'default'
            }}
          >
            {f.name && (
              <div style={{ fontSize: 11, color: 'var(--ink-2)', marginBottom: 4 }}>{f.name}</div>
            )}
            <div
              dangerouslySetInnerHTML={{ __html: renderKatex(f.latex) }}
              style={{ overflowX: 'auto', fontSize: '0.85em' }}
            />
            <div style={{ fontSize: 10, color: 'var(--ink-3)', marginTop: 4 }}>
              {f.topic && <span className="tag" style={{ marginRight: 4 }}>{f.topic}</span>}
              <span>{f.source}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
