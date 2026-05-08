const { requireAuth, respond, cors } = require('./_auth')
const { getDb } = require('./_db')

async function getDbUser(sql, netlifyId, email) {
  await sql`INSERT INTO users (netlify_id, email) VALUES (${netlifyId}, ${email}) ON CONFLICT (netlify_id) DO UPDATE SET email = EXCLUDED.email`
  const [u] = await sql`SELECT id FROM users WHERE netlify_id = ${netlifyId}`
  return u.id
}

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return cors()

  try {
    const authUser = await requireAuth(event)
    const sql = getDb()
    const userId = await getDbUser(sql, authUser.netlifyId, authUser.email)
    const qs = event.queryStringParameters || {}

    if (event.httpMethod === 'DELETE') {
      const { sessionId, fileId } = qs
      if (!sessionId || !fileId) return respond(400, { error: 'sessionId and fileId required' })
      await sql`DELETE FROM files WHERE id = ${fileId} AND session_id = ${sessionId} AND user_id = ${userId}`
      return respond(200, { ok: true })
    }

    return respond(405, { error: 'Method not allowed' })
  } catch (e) {
    console.error('files error:', e.message)
    return respond(500, { error: e.message })
  }
}
