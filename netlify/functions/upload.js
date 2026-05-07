const { requireAuth, respond, cors } = require('./_auth')
const { getDb } = require('./_db')
const { v4: uuidv4 } = require('uuid')
const Busboy = require('busboy')

async function getDbUser(sql, netlifyId) {
  const [u] = await sql`SELECT id FROM users WHERE netlify_id = ${netlifyId}`
  if (!u) throw new Error('User not found')
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
      stream.on('end', () => {
        files.push({
          fieldname: name,
          filename: info.filename,
          mimetype: info.mimeType,
          buffer: Buffer.concat(chunks),
        })
      })
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

async function extractText(buffer, mimetype, filename) {
  try {
    if (mimetype === 'application/pdf' || filename.endsWith('.pdf')) {
      const pdfParse = require('pdf-parse')
      const data = await pdfParse(buffer)
      return data.text
    }
    if (mimetype.includes('word') || filename.endsWith('.docx')) {
      const mammoth = require('mammoth')
      const result = await mammoth.extractRawText({ buffer })
      return result.value
    }
    if (mimetype.startsWith('text/') || filename.endsWith('.txt')) {
      return buffer.toString('utf-8')
    }
  } catch (e) {
    console.error('Text extraction failed:', e)
  }
  return ''
}

async function extractFormulas(text) {
  // Simple heuristic: find LaTeX-like patterns and named formulas
  const formulas = []
  const latexPattern = /\$\$([^$]+)\$\$|\$([^$]+)\$/g
  let match
  while ((match = latexPattern.exec(text)) !== null) {
    const expr = match[1] || match[2]
    if (expr && expr.length > 2 && expr.length < 200) {
      formulas.push({ latex: expr.trim(), name: '', topic: '' })
    }
  }
  // Named formula patterns like "F = ma", "E = mc^2"
  const namedPattern = /([A-Z][a-zA-Z\s']+(?:theorem|law|formula|equation|identity)?)\s*[:\-–]\s*\$?([^$\n]{2,80})\$?/g
  while ((match = namedPattern.exec(text)) !== null) {
    formulas.push({ name: match[1].trim(), latex: match[2].trim(), topic: '' })
  }
  return formulas.slice(0, 100) // cap at 100
}

async function storeFile(buffer, filename, sessionId) {
  // In production, upload to Cloudflare R2 / S3 / Supabase Storage
  // For now, store as base64 data URL (for demo; replace with real storage)
  // Return a storage URL that can be retrieved later
  const base64 = buffer.toString('base64')
  // In real deployment, return signed URL from your storage provider
  return `data:application/octet-stream;base64,${base64.slice(0, 100)}...` // truncated for DB; full file served from storage
}

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return cors()
  if (event.httpMethod !== 'POST') return respond(405, { error: 'Method not allowed' })

  try {
    const authUser = await requireAuth(event)
    const sql = getDb()
    const userId = await getDbUser(sql, authUser.netlifyId)

    const { fields, files } = await parseMultipart(event)
    if (!files.length) return respond(400, { error: 'No file uploaded' })

    const file = files[0]
    const sessionId = fields.sessionId
    if (!sessionId) return respond(400, { error: 'sessionId required' })

    // Verify session belongs to user
    const [session] = await sql`SELECT id FROM sessions WHERE id = ${sessionId} AND user_id = ${userId}`
    if (!session) return respond(403, { error: 'Session not found' })

    // Extract text
    const extractedText = await extractText(file.buffer, file.mimetype, file.filename)
    const formulas = await extractFormulas(extractedText)

    // Store file (use real object storage in production)
    const storageUrl = await storeFile(file.buffer, file.filename, sessionId)

    const [dbFile] = await sql`
      INSERT INTO files (session_id, user_id, name, size, mime_type, storage_url, extracted_text, formulas_json)
      VALUES (
        ${sessionId}, ${userId}, ${file.filename}, ${file.buffer.length},
        ${file.mimetype}, ${storageUrl}, ${extractedText.slice(0, 50000)},
        ${JSON.stringify(formulas)}
      )
      RETURNING *
    `

    return respond(201, dbFile)
  } catch (e) {
    console.error('upload error:', e)
    return respond(500, { error: e.message })
  }
}
