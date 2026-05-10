const BASE = '/.netlify/functions'

async function getAuthHeaders() {
  const user = window.netlifyIdentity?.currentUser()
  if (!user) return {}
  try { return { Authorization: `Bearer ${await user.jwt()}` } }
  catch { return {} }
}

async function request(path, options = {}) {
  const authHeaders = await getAuthHeaders()
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'Content-Type': 'application/json', ...authHeaders, ...options.headers },
    ...options,
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: `HTTP ${res.status}` }))
    throw new Error(err.error || `HTTP ${res.status}`)
  }
  return res.json()
}

export const apiClient = {
  syncUser: (data) => request('/auth-sync', { method: 'POST', body: JSON.stringify(data) }),

  getSessions: () => request('/sessions'),
  createSession: (data) => request('/sessions', { method: 'POST', body: JSON.stringify(data) }),
  updateSession: (id, data) => request(`/sessions?id=${id}&action=update`, { method: 'PATCH', body: JSON.stringify(data) }),
  deleteSession: (id) => request(`/sessions?id=${id}`, { method: 'DELETE' }),
  duplicateSession: (id) => request(`/sessions?id=${id}&action=duplicate`, { method: 'POST' }),

  getFiles: (sessionId) => request(`/sessions?id=${sessionId}&action=files`),
  deleteFile: (sessionId, fileId) => request(`/files?sessionId=${sessionId}&fileId=${fileId}`, { method: 'DELETE' }),
  getExams: (sessionId) => request(`/sessions?id=${sessionId}&action=exams`),
  getSessionAnalytics: (sessionId) => request(`/sessions?id=${sessionId}&action=analytics`),

  uploadFile: async (sessionId, file) => {
    const authHeaders = await getAuthHeaders()
    const formData = new FormData()
    formData.append('file', file)
    formData.append('sessionId', sessionId)
    const res = await fetch(`${BASE}/upload`, { method: 'POST', headers: authHeaders, body: formData })
    if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.error || 'Upload failed') }
    return res.json()
  },

  generateExam: (data) => request('/exams-generate', { method: 'POST', body: JSON.stringify(data) }),
  deleteExam: (examId) => request(`/sessions?examId=${examId}`, { method: 'DELETE' }),

  getAttempts: (examId) => request(`/attempts?examId=${examId}`),
  getAttempt: (attemptId) => request(`/attempts?id=${attemptId}`),
  createAttempt: (examId) => request(`/attempts?examId=${examId}`, { method: 'POST' }),
  saveAttempt: (attemptId, data) => request(`/attempts?id=${attemptId}`, { method: 'PATCH', body: JSON.stringify(data) }),
  submitAttempt: (attemptId, data) => request(`/attempts?id=${attemptId}&action=submit`, { method: 'POST', body: JSON.stringify(data) }),
  markAttempt: (attemptId) => request(`/attempts?id=${attemptId}&action=mark`, { method: 'POST' }),
  deleteAttempt: (attemptId) => request(`/attempts?id=${attemptId}`, { method: 'DELETE' }),
  appealMark: (attemptId, questionId, reason) => request(`/attempts?id=${attemptId}&action=appeal`, { method: 'POST', body: JSON.stringify({ questionId, reason }) }),

  getGlobalAnalytics: () => request('/analytics'),
}
