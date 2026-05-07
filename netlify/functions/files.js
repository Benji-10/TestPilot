const { requireAuth, respond, cors } = require('./_auth')
const { getDb } = require('./_db')

async function getDbUser(sql, netlifyId) {
  const [u] = await sql`SELECT id FROM users WHERE netlify_id = ${netlifyId}`
  if (!u) throw new Error('User not found')
  return u.id
}

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return cors()

  try {
    const authUser = await requireAuth(event)
    const sql = getDb()
    const userId = await getDbUser(sql, authUser.netlifyId)

    // Path: /sessions/:sessionId/files/:fileId
    const path = event.path
    const match = path.match(/sessions\/([^/]+)\/files\/([^/]+)/)
    if (!match) return respond(400, { error: 'Invalid path' })

    const [, sessionId, fileId] = match

    if (event.httpMethod === 'DELETE') {
      await sql`
        DELETE FROM files
        WHERE id = ${fileId} AND session_id = ${sessionId} AND user_id = ${userId}
      `
      return respond(200, { ok: true })
    }

    return respond(405, { error: 'Method not allowed' })
  } catch (e) {
    console.error('files error:', e)
    return respond(500, { error: e.message })
  }
}
