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

async function extractText(buffer, mimetype, filename) {
  try {
    if (mimetype === 'application/pdf' || filename.endsWith('.pdf')) {
      const pdfParse = require('pdf-parse')
      const data = await pdfParse(buffer)
      return data.text || ''
    }
    if (mimetype.includes('word') || filename.endsWith('.docx')) {
      const mammoth = require('mammoth')
      const result = await mammoth.extractRawText({ buffer })
      return result.value || ''
    }
    if (mimetype.startsWith('text/') || filename.endsWith('.txt')) {
      return buffer.toString('utf-8')
    }
  } catch (e) {
    console.error('Text extraction failed:', e.message)
  }
  return ''
}

function extractFormulas(text) {
  const formulas = []
  const latexPattern = /\$\$([^$]+)\$\$|\$([^$]+)\$/g
  let match
  while ((match = latexPattern.exec(text)) !== null) {
    const expr = (match[1] || match[2] || '').trim()
    if (expr.length > 2 && expr.length < 200) {
      formulas.push({ latex: expr, name: '', topic: '' })
    }
  }
  const namedPattern = /([A-Z][a-zA-Z\s']{3,40}(?:theorem|law|formula|equation|identity))\s*[:\-–]\s*([^\n]{2,80})/gi
  while ((match = namedPattern.exec(text)) !== null) {
    formulas.push({ name: match[1].trim(), latex: match[2].trim(), topic: '' })
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

    // Store file reference — in production replace storage_url with your object store URL
    const storageUrl = `uploaded:${sessionId}:${file.filename}`

    const [dbFile] = await sql`
      INSERT INTO files (session_id, user_id, name, size, mime_type, storage_url, extracted_text, formulas_json)
      VALUES (
        ${sessionId}, ${userId}, ${file.filename}, ${file.buffer.length},
        ${file.mimetype}, ${storageUrl},
        ${extractedText.slice(0, 50000)},
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
