const { requireAuth, respond, cors } = require('./_auth')
const { getDb } = require('./_db')

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return cors()

  try {
    const authUser = await requireAuth(event)
    const sql = getDb()
    const body = JSON.parse(event.body || '{}')

    await sql`
      INSERT INTO users (netlify_id, email, name)
      VALUES (${authUser.netlifyId}, ${authUser.email}, ${body.name || authUser.name || ''})
      ON CONFLICT (netlify_id) DO UPDATE
        SET email = EXCLUDED.email,
            name = COALESCE(NULLIF(EXCLUDED.name,''), users.name),
            updated_at = NOW()
    `

    const [dbUser] = await sql`
      SELECT id, email, name, created_at FROM users WHERE netlify_id = ${authUser.netlifyId}
    `

    return respond(200, dbUser)
  } catch (e) {
    console.error('auth-sync error:', e.message)
    return respond(500, { error: e.message })
  }
}
