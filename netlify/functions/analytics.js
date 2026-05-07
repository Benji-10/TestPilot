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

    const byTopic = await sql`
      SELECT topic,
             ROUND(AVG(score::decimal / NULLIF(max_score,0) * 100), 1) as avg_pct,
             COUNT(*) as count
      FROM analytics
      WHERE user_id = ${userId} AND max_score > 0
      GROUP BY topic ORDER BY avg_pct ASC
      LIMIT 20
    `

    const summary = await sql`
      SELECT COUNT(DISTINCT attempt_id) as total_exams,
             ROUND(AVG(score::decimal / NULLIF(max_score,0) * 100), 1) as avg_pct,
             SUM(score) as total_scored,
             SUM(max_score) as total_possible,
             MAX(score::decimal / NULLIF(max_score,0) * 100) as best_pct
      FROM analytics WHERE user_id = ${userId} AND max_score > 0
    `

    const trend = await sql`
      SELECT DATE_TRUNC('day', recorded_at) as date,
             ROUND(AVG(score::decimal / NULLIF(max_score,0) * 100), 1) as pct
      FROM analytics WHERE user_id = ${userId} AND max_score > 0
      GROUP BY 1 ORDER BY 1
      LIMIT 30
    `

    const byDiff = await sql`
      SELECT difficulty,
             ROUND(AVG(score::decimal / NULLIF(max_score,0) * 100), 1) as avg_pct,
             COUNT(*) as count
      FROM analytics WHERE user_id = ${userId}
      GROUP BY difficulty
    `

    const byDiffMap = Object.fromEntries(byDiff.map(r => [r.difficulty, r]))

    return respond(200, {
      ...summary[0],
      by_topic: byTopic,
      trend,
      by_difficulty: byDiffMap,
    })
  } catch (e) {
    console.error('analytics error:', e)
    return respond(500, { error: e.message })
  }
}
