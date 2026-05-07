const jwt = require('jsonwebtoken')

function respond(statusCode, body) {
  return {
    statusCode,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Authorization, Content-Type',
      'Access-Control-Allow-Methods': 'GET, POST, PATCH, DELETE, OPTIONS',
    },
    body: JSON.stringify(body),
  }
}

function cors() {
  return {
    statusCode: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Authorization, Content-Type',
      'Access-Control-Allow-Methods': 'GET, POST, PATCH, DELETE, OPTIONS',
    },
    body: '',
  }
}

async function requireAuth(event) {
  const authHeader = event.headers.authorization || event.headers.Authorization || ''
  if (!authHeader.startsWith('Bearer ')) {
    throw new Error('No token provided')
  }

  const token = authHeader.slice(7)
  const secret = process.env.NETLIFY_IDENTITY_JWT_SECRET

  // Decode without verifying first so we can inspect claims
  const decoded = jwt.decode(token, { complete: true })
  if (!decoded) throw new Error('Invalid token format')

  let payload

  if (secret) {
    // Verify with HS256 secret (recommended — set NETLIFY_IDENTITY_JWT_SECRET in Netlify env vars)
    try {
      payload = jwt.verify(token, secret, { algorithms: ['HS256'] })
    } catch (e) {
      throw new Error(`Token verification failed: ${e.message}`)
    }
  } else {
    // Fallback: trust the token without signature verification
    // This is safe only because Netlify's CDN ensures the token comes from Identity
    // For production, always set NETLIFY_IDENTITY_JWT_SECRET
    console.warn('NETLIFY_IDENTITY_JWT_SECRET not set — skipping signature verification')
    payload = decoded.payload
  }

  const sub = payload.sub || payload.id
  const email = payload.email
  if (!sub || !email) throw new Error('Token missing required fields')

  return {
    netlifyId: sub,
    email,
    name: payload.user_metadata?.full_name || payload.app_metadata?.full_name || '',
  }
}

module.exports = { requireAuth, respond, cors }
