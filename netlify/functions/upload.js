const { requireAuth, respond, cors } = require('./_auth')
const { getDb } = require('./_db')
const Busboy = require('busboy')

async function getDbUser(sql, netlifyId, email) {
  await sql`
    INSERT INTO users (netlify_id, email) VALUES (${netlifyId}, ${email})
    ON CONFLICT (netlify_id) DO UPDATE SET email = EXCLUDED.email
  `
  const [u] = await sql`SELECT id FROM users WHERE netlify_id = ${netlifyId}`
  return u.id
}

function parseMultipart(event) {
  return new Promise((resolve, reject) => {
    const fields = {}
    const files = []
    const busboy = Busboy({
      headers: { 'content-type': event.headers['content-type'] || event.headers['Content-Type'] },
      limits: { fileSize: 20 * 1024 * 1024 },
    })
    busboy.on('field', (name, val) => { fields[name] = val })
    busboy.on('file', (name, stream, info) => {
      const chunks = []
      stream.on('data', chunk => chunks.push(chunk))
      stream.on('end', () => files.push({
        filename: info.filename,
        mimetype: info.mimeType,
        buffer: Buffer.concat(chunks),
      }))
    })
    busboy.on('finish', () => resolve({ fields, files }))
    busboy.on('error', reject)
    const body = event.isBase64Encoded
      ? Buffer.from(event.body, 'base64')
      : Buffer.from(event.body || '')
    busboy.write(body)
    busboy.end()
  })
}

// Strip characters that Postgres UTF-8 rejects: null bytes and other
// non-printable control chars that sneak in from PDF extraction
function sanitizeText(str) {
  if (!str) return ''
  return str
    .replace(/\x00/g, '')           // null bytes — main culprit
    .replace(/[\x01-\x08\x0B\x0C\x0E-\x1F\x7F]/g, ' ') // other control chars
    .replace(/\uFFFD/g, '')          // replacement chars from bad decoding
    .trim()
}

async function extractText(buffer, mimetype, filename) {
  try {
    if (mimetype === 'application/pdf' || filename.toLowerCase().endsWith('.pdf')) {
      const pdfParse = require('pdf-parse')
      const data = await pdfParse(buffer)
      return sanitizeText(data.text || '')
    }
    if (mimetype.includes('word') || filename.toLowerCase().endsWith('.docx')) {
      const mammoth = require('mammoth')
      const result = await mammoth.extractRawText({ buffer })
      return sanitizeText(result.value || '')
    }
    if (mimetype.startsWith('text/') || filename.toLowerCase().endsWith('.txt')) {
      return sanitizeText(buffer.toString('utf-8'))
    }
  } catch (e) {
    console.error('Text extraction failed:', e.message)
  }
  return ''
}

function extractFormulas(text) {
  const formulas = []
  const seen = new Set()
  const latexPattern = /\$\$([^$]+)\$\$|\$([^$]+)\$/g
  let match
  while ((match = latexPattern.exec(text)) !== null) {
    const expr = sanitizeText(match[1] || match[2] || '')
    if (expr.length > 2 && expr.length < 200 && !seen.has(expr)) {
      seen.add(expr)
      formulas.push({ latex: expr, name: '', topic: '' })
    }
  }
  return formulas.slice(0, 100)
}

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return cors()
  if (event.httpMethod !== 'POST') return respond(405, { error: 'Method not allowed' })

  try {
    const authUser = await requireAuth(event)
    const sql = getDb()
    const userId = await getDbUser(sql, authUser.netlifyId, authUser.email)

    const { fields, files } = await parseMultipart(event)
    if (!files.length) return respond(400, { error: 'No file uploaded' })

    const file = files[0]
    const sessionId = fields.sessionId
    if (!sessionId) return respond(400, { error: 'sessionId required' })

    const [session] = await sql`SELECT id FROM sessions WHERE id = ${sessionId} AND user_id = ${userId}`
    if (!session) return respond(403, { error: 'Session not found' })

    const extractedText = await extractText(file.buffer, file.mimetype, file.filename)
    const formulas = extractFormulas(extractedText)

    // Truncate to 50k chars and sanitize once more before insert
    const safeText = sanitizeText(extractedText).slice(0, 50000)
    const storageUrl = `uploaded:${sessionId}:${Date.now()}:${file.filename}`

    const [dbFile] = await sql`
      INSERT INTO files (session_id, user_id, name, size, mime_type, storage_url, extracted_text, formulas_json)
      VALUES (
        ${sessionId}, ${userId},
        ${sanitizeText(file.filename)},
        ${file.buffer.length},
        ${file.mimetype},
        ${storageUrl},
        ${safeText},
        ${JSON.stringify(formulas)}
      )
      RETURNING *
    `

    return respond(201, dbFile)
  } catch (e) {
    console.error('upload error:', e.message)
    return respond(500, { error: e.message })
  }
}
