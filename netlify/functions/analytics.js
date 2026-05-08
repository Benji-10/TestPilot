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

    const [summary] = await sql`
      SELECT COUNT(DISTINCT attempt_id)::int as total_exams,
             ROUND(AVG(score::decimal / NULLIF(max_score,0) * 100), 1) as avg_pct,
             COALESCE(SUM(score), 0)::int as total_scored,
             COALESCE(SUM(max_score), 0)::int as total_possible,
             COALESCE(MAX(score::decimal / NULLIF(max_score,0) * 100), 0) as best_pct
      FROM analytics WHERE user_id = ${userId} AND max_score > 0
    `
    const byTopic = await sql`
      SELECT topic,
             ROUND(AVG(score::decimal / NULLIF(max_score,0) * 100), 1) as avg_pct,
             COUNT(*)::int as count
      FROM analytics WHERE user_id = ${userId} AND max_score > 0
      GROUP BY topic ORDER BY avg_pct ASC LIMIT 20
    `
    const trend = await sql`
      SELECT DATE_TRUNC('day', recorded_at) as date,
             ROUND(AVG(score::decimal / NULLIF(max_score,0) * 100), 1) as pct
      FROM analytics WHERE user_id = ${userId} AND max_score > 0
      GROUP BY 1 ORDER BY 1 LIMIT 30
    `
    const byDiff = await sql`
      SELECT difficulty,
             ROUND(AVG(score::decimal / NULLIF(max_score,0) * 100), 1) as avg_pct,
             COUNT(*)::int as count
      FROM analytics WHERE user_id = ${userId}
      GROUP BY difficulty
    `

    return respond(200, {
      ...summary,
      by_topic: byTopic,
      trend,
      by_difficulty: Object.fromEntries(byDiff.map(r => [r.difficulty, r]))
    })
  } catch (e) {
    console.error('analytics error:', e.message)
    return respond(500, { error: e.message })
  }
}
