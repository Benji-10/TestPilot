const { requireAuth, respond, cors } = require('./_auth')
const { getDb } = require('./_db')
const { v4: uuidv4 } = require('uuid')

async function getDbUser(sql, netlifyId) {
  const [u] = await sql`SELECT id FROM users WHERE netlify_id = ${netlifyId}`
  if (!u) throw new Error('User not found — call /auth/sync first')
  return u.id
}

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return cors()

  try {
    const authUser = await requireAuth(event)
    const sql = getDb()
    const userId = await getDbUser(sql, authUser.netlifyId)

    const path = event.path.replace(/^\/api\/sessions\/?/, '').replace(/^\/\.netlify\/functions\/sessions\/?/, '')
    const segments = path.split('/').filter(Boolean)
    const sessionId = segments[0]
    const action = segments[1]

    // GET /sessions
    if (event.httpMethod === 'GET' && !sessionId) {
      const sessions = await sql`
        SELECT s.*, 
          (SELECT COUNT(*) FROM files f WHERE f.session_id = s.id) as file_count,
          (SELECT COUNT(*) FROM exams e WHERE e.session_id = s.id) as exam_count
        FROM sessions s
        WHERE s.user_id = ${userId}
        ORDER BY s.updated_at DESC
      `
      return respond(200, sessions)
    }

    // POST /sessions
    if (event.httpMethod === 'POST' && !sessionId) {
      const body = JSON.parse(event.body || '{}')
      const [session] = await sql`
        INSERT INTO sessions (user_id, name)
        VALUES (${userId}, ${body.name || 'New Session'})
        RETURNING *
      `
      return respond(201, session)
    }

    // PATCH /sessions/:id
    if (event.httpMethod === 'PATCH' && sessionId && !action) {
      const body = JSON.parse(event.body || '{}')
      const updates = {}
      if (body.name !== undefined) updates.name = body.name
      if (Object.keys(updates).length === 0) return respond(400, { error: 'Nothing to update' })

      const [session] = await sql`
        UPDATE sessions
        SET name = COALESCE(${updates.name ?? null}, name),
            updated_at = NOW()
        WHERE id = ${sessionId} AND user_id = ${userId}
        RETURNING *
      `
      if (!session) return respond(404, { error: 'Session not found' })
      return respond(200, session)
    }

    // DELETE /sessions/:id
    if (event.httpMethod === 'DELETE' && sessionId && !action) {
      await sql`DELETE FROM sessions WHERE id = ${sessionId} AND user_id = ${userId}`
      return respond(200, { ok: true })
    }

    // POST /sessions/:id/duplicate
    if (event.httpMethod === 'POST' && action === 'duplicate') {
      const [orig] = await sql`SELECT * FROM sessions WHERE id = ${sessionId} AND user_id = ${userId}`
      if (!orig) return respond(404, { error: 'Session not found' })

      const [dup] = await sql`
        INSERT INTO sessions (user_id, name)
        VALUES (${userId}, ${orig.name + ' (copy)'})
        RETURNING *
      `

      // Copy files metadata (not actual files)
      await sql`
        INSERT INTO files (session_id, user_id, name, size, mime_type, storage_url, extracted_text, formulas_json)
        SELECT ${dup.id}, user_id, name, size, mime_type, storage_url, extracted_text, formulas_json
        FROM files WHERE session_id = ${sessionId}
      `

      return respond(201, dup)
    }

    // GET /sessions/:id/files
    if (event.httpMethod === 'GET' && action === 'files') {
      const files = await sql`
        SELECT * FROM files WHERE session_id = ${sessionId} AND user_id = ${userId}
        ORDER BY created_at DESC
      `
      return respond(200, files)
    }

    // GET /sessions/:id/exams
    if (event.httpMethod === 'GET' && action === 'exams') {
      const exams = await sql`
        SELECT id, title, total_marks, duration_minutes, metadata_json,
               questions_json, settings_json, created_at
        FROM exams WHERE session_id = ${sessionId} AND user_id = ${userId}
        ORDER BY created_at DESC
      `
      return respond(200, exams)
    }

    // GET /sessions/:id/analytics
    if (event.httpMethod === 'GET' && action === 'analytics') {
      const byTopic = await sql`
        SELECT topic,
               ROUND(AVG(score::decimal / NULLIF(max_score,0) * 100), 1) as avg_pct,
               COUNT(*) as count
        FROM analytics
        WHERE user_id = ${userId} AND session_id = ${sessionId} AND max_score > 0
        GROUP BY topic ORDER BY avg_pct ASC
      `
      const summary = await sql`
        SELECT COUNT(DISTINCT attempt_id) as total_exams,
               ROUND(AVG(score::decimal / NULLIF(max_score,0) * 100), 1) as avg_pct,
               SUM(score) as total_scored,
               SUM(max_score) as total_possible,
               MAX(score::decimal / NULLIF(max_score,0) * 100) as best_pct
        FROM analytics WHERE user_id = ${userId} AND session_id = ${sessionId}
      `
      const trend = await sql`
        SELECT DATE_TRUNC('day', recorded_at) as date,
               ROUND(AVG(score::decimal / NULLIF(max_score,0) * 100), 1) as pct
        FROM analytics WHERE user_id = ${userId} AND session_id = ${sessionId} AND max_score > 0
        GROUP BY 1 ORDER BY 1
      `
      const byDiff = await sql`
        SELECT difficulty,
               ROUND(AVG(score::decimal / NULLIF(max_score,0) * 100), 1) as avg_pct,
               COUNT(*) as count
        FROM analytics WHERE user_id = ${userId} AND session_id = ${sessionId}
        GROUP BY difficulty
      `
      const byDiffMap = Object.fromEntries(byDiff.map(r => [r.difficulty, r]))
      return respond(200, { ...summary[0], by_topic: byTopic, trend, by_difficulty: byDiffMap })
    }

    return respond(404, { error: 'Not found' })
  } catch (e) {
    console.error('sessions error:', e)
    return respond(e.message.includes('not found') ? 404 : 500, { error: e.message })
  }
}
