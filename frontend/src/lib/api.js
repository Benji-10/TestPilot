const BASE = '/api'

async function getAuthHeaders() {
  // Use the global netlifyIdentity injected by the CDN script in index.html
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
  const res = await fetch(`${BASE}${path}`, {
    headers: {
      'Content-Type': 'application/json',
      ...authHeaders,
      ...options.headers,
    },
    ...options,
  })

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Request failed' }))
    throw new Error(err.error || `HTTP ${res.status}`)
  }

  return res.json()
}

export const apiClient = {
  // Sessions
  getSessions: () => request('/sessions'),
  createSession: (data) => request('/sessions', { method: 'POST', body: JSON.stringify(data) }),
  updateSession: (id, data) => request(`/sessions/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  deleteSession: (id) => request(`/sessions/${id}`, { method: 'DELETE' }),
  duplicateSession: (id) => request(`/sessions/${id}/duplicate`, { method: 'POST' }),

  // Files
  getFiles: (sessionId) => request(`/sessions/${sessionId}/files`),
  deleteFile: (sessionId, fileId) => request(`/sessions/${sessionId}/files/${fileId}`, { method: 'DELETE' }),

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
  getExams: (sessionId) => request(`/sessions/${sessionId}/exams`),
  generateExam: (data) => request('/exams/generate', { method: 'POST', body: JSON.stringify(data) }),
  getExam: (id) => request(`/exams/${id}`),

  // Attempts
  getAttempts: (examId) => request(`/exams/${examId}/attempts`),
  createAttempt: (examId) => request(`/exams/${examId}/attempts`, { method: 'POST' }),
  saveAttempt: (attemptId, data) => request(`/attempts/${attemptId}`, { method: 'PATCH', body: JSON.stringify(data) }),
  submitAttempt: (attemptId, data) => request(`/attempts/${attemptId}/submit`, { method: 'POST', body: JSON.stringify(data) }),
  markAttempt: (attemptId) => request(`/attempts/${attemptId}/mark`, { method: 'POST' }),

  // Analytics
  getSessionAnalytics: (sessionId) => request(`/sessions/${sessionId}/analytics`),
  getGlobalAnalytics: () => request('/analytics'),

  // Auth
  syncUser: (data) => request('/auth/sync', { method: 'POST', body: JSON.stringify(data) }),
}
