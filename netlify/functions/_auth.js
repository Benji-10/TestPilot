const jwt = require('jsonwebtoken')
const jwksClient = require('jwks-rsa')

// Netlify Identity JWKS endpoint
const client = jwksClient({
  jwksUri: `${process.env.URL}/.netlify/identity/keys`,
  cache: true,
  cacheMaxAge: 600000,
})

async function getSigningKey(kid) {
  return new Promise((resolve, reject) => {
    client.getSigningKey(kid, (err, key) => {
      if (err) reject(err)
      else resolve(key.getPublicKey())
    })
  })
}

async function verifyToken(authHeader) {
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    throw new Error('No token provided')
  }
  const token = authHeader.slice(7)

  // Decode header to get kid
  const decoded = jwt.decode(token, { complete: true })
  if (!decoded) throw new Error('Invalid token')

  let signingKey
  try {
    signingKey = await getSigningKey(decoded.header.kid)
  } catch {
    // Fallback: use NETLIFY_IDENTITY_SECRET if set (for local dev)
    signingKey = process.env.NETLIFY_IDENTITY_SECRET
    if (!signingKey) throw new Error('Cannot verify token')
  }

  const payload = jwt.verify(token, signingKey, { algorithms: ['RS256', 'HS256'] })
  return payload
}

async function requireAuth(event) {
  const payload = await verifyToken(event.headers.authorization || event.headers.Authorization)
  if (!payload.sub) throw new Error('No user ID in token')
  return { netlifyId: payload.sub, email: payload.email, name: payload.user_metadata?.full_name }
}

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

module.exports = { requireAuth, respond, cors }
