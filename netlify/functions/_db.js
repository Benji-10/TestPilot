const { neon } = require('@neondatabase/serverless')

let _sql = null

function getDb() {
  if (_sql) return _sql

  let url = process.env.DATABASE_URL || ''

  // Guard against the value being set as "DATABASE_URL=postgresql://..."
  // (i.e. the user accidentally included the key name in the value)
  if (url.startsWith('DATABASE_URL=')) {
    url = url.slice('DATABASE_URL='.length)
  }
  url = url.trim()

  if (!url) throw new Error('DATABASE_URL environment variable is not set')
  if (!url.startsWith('postgresql://') && !url.startsWith('postgres://')) {
    throw new Error(`DATABASE_URL does not look like a postgres URL. Got: ${url.slice(0, 40)}`)
  }

  _sql = neon(url)
  return _sql
}

module.exports = { getDb }
