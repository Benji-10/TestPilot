// Call Netlify Functions directly — no /api proxy, no redirect rules needed
const BASE = '/.netlify/functions'

async function getAuthHeaders() {
  const identity = window.netlifyIdentity
  const user = identity?.currentUser()
  if (!user) return {}
  try {
    const token = await user.jwt()
    return { Authorization: `Bearer ${token}` }
  } catch (e) {
    console.error('Failed to get JWT:', e)
    return {}
  }
}

async function request(path, options = {}) {
  const authHeaders = await getAuthHeaders()
  const url = `${BASE}${path}`
  const res = await fetch(url, {
    headers: {
      'Content-Type': 'application/json',
      ...authHeaders,
      ...options.headers,
    },
    ...options,
  })

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: `HTTP ${res.status}` }))
    throw new Error(err.error || `HTTP ${res.status}`)
  }

  return res.json()
}

export const apiClient = {
  // Auth
  syncUser: (data) => request('/auth-sync', { method: 'POST', body: JSON.stringify(data) }),

  // Sessions — all go to /sessions function, path suffix routed internally
  getSessions: () => request('/sessions'),
  createSession: (data) => request('/sessions', { method: 'POST', body: JSON.stringify(data) }),
  updateSession: (id, data) => request(`/sessions?id=${id}&action=update`, { method: 'PATCH', body: JSON.stringify(data) }),
  deleteSession: (id) => request(`/sessions?id=${id}&action=delete`, { method: 'DELETE' }),
  duplicateSession: (id) => request(`/sessions?id=${id}&action=duplicate`, { method: 'POST' }),

  // Sub-resources
  getFiles: (sessionId) => request(`/sessions?id=${sessionId}&action=files`),
  deleteFile: (sessionId, fileId) => request(`/files?sessionId=${sessionId}&fileId=${fileId}`, { method: 'DELETE' }),
  getExams: (sessionId) => request(`/sessions?id=${sessionId}&action=exams`),
  getSessionAnalytics: (sessionId) => request(`/sessions?id=${sessionId}&action=analytics`),

  // File upload
  uploadFile: async (sessionId, file) => {
    const authHeaders = await getAuthHeaders()
    const formData = new FormData()
    formData.append('file', file)
    formData.append('sessionId', sessionId)
    const res = await fetch(`${BASE}/upload`, {
      method: 'POST',
      headers: authHeaders,
      body: formData,
    })
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Upload failed' }))
      throw new Error(err.error || 'Upload failed')
    }
    return res.json()
  },

  // Exams
  generateExam: (data) => request('/exams-generate', { method: 'POST', body: JSON.stringify(data) }),

  // Attempts
  getAttempts: (examId) => request(`/attempts?examId=${examId}`),
  createAttempt: (examId) => request(`/attempts?examId=${examId}`, { method: 'POST' }),
  saveAttempt: (attemptId, data) => request(`/attempts?id=${attemptId}`, { method: 'PATCH', body: JSON.stringify(data) }),
  submitAttempt: (attemptId, data) => request(`/attempts?id=${attemptId}&action=submit`, { method: 'POST', body: JSON.stringify(data) }),
  markAttempt: (attemptId) => request(`/attempts?id=${attemptId}&action=mark`, { method: 'POST' }),

  // Analytics
  getGlobalAnalytics: () => request('/analytics'),
}
