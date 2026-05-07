import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import { immer } from 'zustand/middleware/immer'
import { apiClient } from '../lib/api.js'

const useStore = create(
  persist(
    immer((set, get) => ({
      // Auth
      user: null,
      setUser: (user) => set(state => { state.user = user }),

      // Sessions
      sessions: [],
      activeSessionId: null,

      setSessions: (sessions) => set(state => { state.sessions = sessions }),

      setActiveSession: (id) => set(state => { state.activeSessionId = id }),

      addSession: (session) => set(state => {
        state.sessions.unshift(session)
        state.activeSessionId = session.id
      }),

      updateSession: (id, updates) => set(state => {
        const idx = state.sessions.findIndex(s => s.id === id)
        if (idx !== -1) Object.assign(state.sessions[idx], updates)
      }),

      removeSession: (id) => set(state => {
        state.sessions = state.sessions.filter(s => s.id !== id)
        if (state.activeSessionId === id) {
          state.activeSessionId = state.sessions[0]?.id || null
        }
      }),

      // Files per session
      files: {}, // { sessionId: [file...] }

      setFiles: (sessionId, files) => set(state => {
        state.files[sessionId] = files
      }),

      addFile: (sessionId, file) => set(state => {
        if (!state.files[sessionId]) state.files[sessionId] = []
        state.files[sessionId].push(file)
      }),

      removeFile: (sessionId, fileId) => set(state => {
        if (state.files[sessionId]) {
          state.files[sessionId] = state.files[sessionId].filter(f => f.id !== fileId)
        }
      }),

      // Exams per session
      exams: {}, // { sessionId: [exam...] }

      setExams: (sessionId, exams) => set(state => {
        state.exams[sessionId] = exams
      }),

      addExam: (sessionId, exam) => set(state => {
        if (!state.exams[sessionId]) state.exams[sessionId] = []
        state.exams[sessionId].unshift(exam)
      }),

      // Current exam attempt
      activeAttempt: null,

      setActiveAttempt: (attempt) => set(state => { state.activeAttempt = attempt }),

      updateAnswer: (questionId, answer) => set(state => {
        if (!state.activeAttempt) return
        const answers = state.activeAttempt.answers || {}
        answers[questionId] = answer
        state.activeAttempt.answers = answers
        state.activeAttempt.lastSaved = Date.now()
      }),

      // Timer state
      timerState: null,
      setTimerState: (ts) => set(state => { state.timerState = ts }),

      // UI state
      sidebarOpen: true,
      toggleSidebar: () => set(state => { state.sidebarOpen = !state.sidebarOpen }),

      activeView: 'session', // 'session' | 'exam' | 'review' | 'analytics'
      setActiveView: (view) => set(state => { state.activeView = view }),

      // Session instructions (local, synced to DB)
      instructions: {}, // { sessionId: text }
      setInstructions: (sessionId, text) => set(state => {
        state.instructions[sessionId] = text
      }),

      // Exam settings per session
      examSettings: {}, // { sessionId: settings }
      setExamSettings: (sessionId, settings) => set(state => {
        state.examSettings[sessionId] = { ...(state.examSettings[sessionId] || {}), ...settings }
      }),

      // Attempts per exam
      attempts: {}, // { examId: [attempt...] }
      setAttempts: (examId, attempts) => set(state => {
        state.attempts[examId] = attempts
      }),
      addAttempt: (examId, attempt) => set(state => {
        if (!state.attempts[examId]) state.attempts[examId] = []
        state.attempts[examId].unshift(attempt)
      }),

      // Analytics cache
      analytics: null,
      setAnalytics: (data) => set(state => { state.analytics = data }),

      // Loading states
      loading: {},
      setLoading: (key, val) => set(state => { state.loading[key] = val }),

      // Generating exam flag
      generatingExam: false,
      setGeneratingExam: (v) => set(state => { state.generatingExam = v }),

      // Marking flag
      markingExam: false,
      setMarkingExam: (v) => set(state => { state.markingExam = v }),
    })),
    {
      name: 'testpilot-state',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        sessions: state.sessions,
        activeSessionId: state.activeSessionId,
        files: state.files,
        exams: state.exams,
        instructions: state.instructions,
        examSettings: state.examSettings,
        sidebarOpen: state.sidebarOpen,
        activeAttempt: state.activeAttempt,
        timerState: state.timerState,
      }),
    }
  )
)

export default useStore
