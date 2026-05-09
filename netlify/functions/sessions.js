const { requireAuth, respond, cors } = require('./_auth')
const { getDb } = require('./_db')

async function getDbUser(sql, netlifyId, email, name) {
  await sql`
    INSERT INTO users (netlify_id, email, name)
    VALUES (${netlifyId}, ${email}, ${name || ''})
    ON CONFLICT (netlify_id) DO UPDATE SET email = EXCLUDED.email, updated_at = NOW()
  `
  const [u] = await sql`SELECT id FROM users WHERE netlify_id = ${netlifyId}`
  return u.id
}

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return cors()

  try {
    const authUser = await requireAuth(event)
    const sql = getDb()
    const userId = await getDbUser(sql, authUser.netlifyId, authUser.email, authUser.name)

    const method = event.httpMethod
    const qs = event.queryStringParameters || {}
    const sessionId = qs.id
    const action = qs.action
    const examId = qs.examId

    // ── Exam-level routes (examId param) ──────────────────────────

    // DELETE ?examId=X — delete exam + its attempts
    if (method === 'DELETE' && examId) {
      await sql`DELETE FROM analytics WHERE attempt_id IN (SELECT id FROM attempts WHERE exam_id = ${examId})`
      await sql`DELETE FROM attempts WHERE exam_id = ${examId} AND user_id = ${userId}`
      await sql`DELETE FROM exams WHERE id = ${examId} AND user_id = ${userId}`
      return respond(200, { ok: true })
    }

    // ── Session list / create ──────────────────────────────────────

    // GET /sessions
    if (method === 'GET' && !sessionId) {
      const sessions = await sql`
        SELECT s.*,
          (SELECT COUNT(*) FROM files f WHERE f.session_id = s.id)::int as file_count,
          (SELECT COUNT(*) FROM exams e WHERE e.session_id = s.id)::int as exam_count
        FROM sessions s WHERE s.user_id = ${userId}
        ORDER BY s.updated_at DESC
      `
      return respond(200, sessions)
    }

    // POST /sessions — create
    if (method === 'POST' && !sessionId && !action) {
      const body = JSON.parse(event.body || '{}')
      const [session] = await sql`
        INSERT INTO sessions (user_id, name) VALUES (${userId}, ${body.name || 'New Session'})
        RETURNING *
      `
      return respond(201, session)
    }

    // ── Session sub-resource GETs ──────────────────────────────────

    if (method === 'GET' && sessionId && action === 'files') {
      const files = await sql`SELECT * FROM files WHERE session_id = ${sessionId} AND user_id = ${userId} ORDER BY created_at DESC`
      return respond(200, files)
    }

    if (method === 'GET' && sessionId && action === 'exams') {
      const exams = await sql`
        SELECT id, title, total_marks, duration_minutes, metadata_json,
               questions_json, settings_json, session_id, created_at
        FROM exams WHERE session_id = ${sessionId} AND user_id = ${userId}
        ORDER BY created_at DESC
      `
      return respond(200, exams)
    }

    if (method === 'GET' && sessionId && action === 'analytics') {
      const [summary] = await sql`
        SELECT COUNT(DISTINCT attempt_id)::int as total_exams,
               ROUND(AVG(score::decimal / NULLIF(max_score,0) * 100), 1) as avg_pct,
               COALESCE(SUM(score), 0)::int as total_scored,
               COALESCE(SUM(max_score), 0)::int as total_possible,
               COALESCE(MAX(score::decimal / NULLIF(max_score,0) * 100), 0) as best_pct
        FROM analytics WHERE user_id = ${userId} AND session_id = ${sessionId}
      `
      const byTopic = await sql`
        SELECT topic, ROUND(AVG(score::decimal / NULLIF(max_score,0) * 100), 1) as avg_pct, COUNT(*)::int as count
        FROM analytics WHERE user_id = ${userId} AND session_id = ${sessionId} AND max_score > 0
        GROUP BY topic ORDER BY avg_pct ASC
      `
      const trend = await sql`
        SELECT DATE_TRUNC('day', recorded_at) as date,
               ROUND(AVG(score::decimal / NULLIF(max_score,0) * 100), 1) as pct
        FROM analytics WHERE user_id = ${userId} AND session_id = ${sessionId} AND max_score > 0
        GROUP BY 1 ORDER BY 1
      `
      const byDiff = await sql`
        SELECT difficulty, ROUND(AVG(score::decimal / NULLIF(max_score,0) * 100), 1) as avg_pct, COUNT(*)::int as count
        FROM analytics WHERE user_id = ${userId} AND session_id = ${sessionId} GROUP BY difficulty
      `
      return respond(200, { ...summary, by_topic: byTopic, trend, by_difficulty: Object.fromEntries(byDiff.map(r => [r.difficulty, r])) })
    }

    // ── Session mutations ──────────────────────────────────────────

    // PATCH — rename
    if (method === 'PATCH' && sessionId) {
      const body = JSON.parse(event.body || '{}')
      const [session] = await sql`
        UPDATE sessions SET name = COALESCE(${body.name ?? null}, name), updated_at = NOW()
        WHERE id = ${sessionId} AND user_id = ${userId} RETURNING *
      `
      if (!session) return respond(404, { error: 'Session not found' })
      return respond(200, session)
    }

    // DELETE — session + all its data
    if (method === 'DELETE' && sessionId) {
      // Delete in order: analytics → attempts → exams → files → session
      await sql`DELETE FROM analytics WHERE session_id = ${sessionId} AND user_id = ${userId}`
      await sql`DELETE FROM attempts WHERE session_id = ${sessionId} AND user_id = ${userId}`
      await sql`DELETE FROM exams WHERE session_id = ${sessionId} AND user_id = ${userId}`
      await sql`DELETE FROM files WHERE session_id = ${sessionId} AND user_id = ${userId}`
      await sql`DELETE FROM sessions WHERE id = ${sessionId} AND user_id = ${userId}`
      return respond(200, { ok: true })
    }

    // POST duplicate
    if (method === 'POST' && sessionId && action === 'duplicate') {
      const [orig] = await sql`SELECT * FROM sessions WHERE id = ${sessionId} AND user_id = ${userId}`
      if (!orig) return respond(404, { error: 'Session not found' })
      const [dup] = await sql`INSERT INTO sessions (user_id, name) VALUES (${userId}, ${orig.name + ' (copy)'}) RETURNING *`
      await sql`
        INSERT INTO files (session_id, user_id, name, size, mime_type, storage_url, extracted_text, formulas_json)
        SELECT ${dup.id}, user_id, name, size, mime_type, storage_url, extracted_text, formulas_json
        FROM files WHERE session_id = ${sessionId}
      `
      return respond(201, dup)
    }

    return respond(404, { error: `No handler for ${method} action=${action}` })
  } catch (e) {
    console.error('sessions error:', e.message)
    return respond(500, { error: e.message })
  }
}
