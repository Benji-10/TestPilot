import { useState, useEffect, useRef } from 'react'
import useStore from '../../lib/store.js'
import { apiClient } from '../../lib/api.js'
import { formatFileSize, getFileIcon, debounce, formatDate } from '../../lib/utils.js'
import ExamSettings from './ExamSettings.jsx'
import toast from 'react-hot-toast'

export default function SessionView({ session }) {
  const {
    files, setFiles, addFile, removeFile,
    exams, setExams,
    instructions, setInstructions,
    examSettings, setExamSettings,
    setActiveView, setActiveAttempt,
    generatingExam, setGeneratingExam,
    addExam
  } = useStore()

  const sessionFiles = files[session.id] || []
  const sessionExams = exams[session.id] || []
  const sessionInstructions = instructions[session.id] || ''
  const settings = examSettings[session.id] || defaultSettings()

  const [uploading, setUploading] = useState(false)
  const [dragOver, setDragOver] = useState(false)
  const fileInputRef = useRef(null)

  const saveInstructions = debounce(async (text) => {
    try {
      await apiClient.updateSession(session.id, { instructions: text })
    } catch {}
  }, 1000)

  useEffect(() => {
    loadFiles()
    loadExams()
  }, [session.id])

  async function loadFiles() {
    try {
      const data = await apiClient.getFiles(session.id)
      setFiles(session.id, data)
    } catch (e) {
      console.error(e)
    }
  }

  async function loadExams() {
    try {
      const data = await apiClient.getExams(session.id)
      setExams(session.id, data)
    } catch (e) {
      console.error(e)
    }
  }

  async function handleFileUpload(files) {
    setUploading(true)
    const fileArr = Array.from(files)
    for (const file of fileArr) {
      try {
        const uploaded = await apiClient.uploadFile(session.id, file)
        addFile(session.id, uploaded)
        toast.success(`Uploaded ${file.name}`)
      } catch (e) {
        toast.error(`Failed to upload ${file.name}`)
      }
    }
    setUploading(false)
  }

  async function handleDeleteFile(fileId) {
    try {
      await apiClient.deleteFile(session.id, fileId)
      removeFile(session.id, fileId)
    } catch (e) {
      toast.error('Failed to delete file')
    }
  }

  async function generateExam() {
    if (sessionFiles.length === 0) {
      toast.error('Upload at least one file to generate an exam')
      return
    }
    setGeneratingExam(true)
    try {
      const exam = await apiClient.generateExam({
        sessionId: session.id,
        fileIds: sessionFiles.map(f => f.id),
        instructions: sessionInstructions,
        settings,
      })
      addExam(session.id, exam)
      // Start an attempt
      const attempt = await apiClient.createAttempt(exam.id)
      setActiveAttempt({ ...attempt, exam })
      setActiveView('exam')
      toast.success('Exam generated!')
    } catch (e) {
      toast.error(e.message || 'Failed to generate exam')
    } finally {
      setGeneratingExam(false)
    }
  }

  async function openExam(exam) {
    try {
      const attempt = await apiClient.createAttempt(exam.id)
      setActiveAttempt({ ...attempt, exam })
      setActiveView('exam')
    } catch (e) {
      toast.error('Failed to open exam')
    }
  }

  function handleDrop(e) {
    e.preventDefault()
    setDragOver(false)
    handleFileUpload(e.dataTransfer.files)
  }

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {/* Header */}
      <div style={{ padding: '16px 24px 12px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
        <h1 style={{ fontSize: 16, fontFamily: 'Instrument Serif, serif', color: 'var(--ink-1)', marginBottom: 2 }}>
          {session.name}
        </h1>
        <p style={{ fontSize: 11, color: 'var(--ink-3)' }}>
          {sessionFiles.length} file{sessionFiles.length !== 1 ? 's' : ''} · {sessionExams.length} exam{sessionExams.length !== 1 ? 's' : ''}
        </p>
      </div>

      <div className="scroll-y" style={{ flex: 1, padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 24 }}>
        {/* File Upload */}
        <section>
          <SectionHeader title="Study Materials" hint="Upload PDFs, docs, or images" />
          <div
            style={{
              border: `1.5px dashed ${dragOver ? 'var(--accent)' : 'var(--border)'}`,
              borderRadius: 'var(--radius-lg)',
              padding: 20,
              textAlign: 'center',
              cursor: 'pointer',
              background: dragOver ? 'var(--accent-glow)' : 'transparent',
              transition: 'all 0.15s ease',
              marginBottom: 10
            }}
            onClick={() => fileInputRef.current?.click()}
            onDragOver={e => { e.preventDefault(); setDragOver(true) }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
          >
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept=".pdf,.doc,.docx,.txt,.png,.jpg,.jpeg"
              style={{ display: 'none' }}
              onChange={e => handleFileUpload(e.target.files)}
            />
            <div style={{ color: 'var(--ink-3)', marginBottom: 6 }}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" style={{ margin: '0 auto 8px' }}>
                <path d="M12 16V4M7 9l5-5 5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                <path d="M4 18h16" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" opacity="0.5"/>
              </svg>
            </div>
            <p style={{ fontSize: 13, color: 'var(--ink-2)', marginBottom: 3 }}>
              {uploading ? 'Uploading...' : 'Drop files or click to upload'}
            </p>
            <p style={{ fontSize: 11, color: 'var(--ink-3)' }}>PDF, Word, Images · Max 20MB each</p>
          </div>

          {sessionFiles.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {sessionFiles.map(file => (
                <FileRow key={file.id} file={file} onDelete={() => handleDeleteFile(file.id)} />
              ))}
            </div>
          )}
        </section>

        {/* Instructions */}
        <section>
          <SectionHeader title="Instructions" hint="Guide the AI on exam style, topics, constraints" />
          <textarea
            className="input"
            value={sessionInstructions}
            onChange={e => {
              setInstructions(session.id, e.target.value)
              saveInstructions(e.target.value)
            }}
            placeholder="e.g. Focus on integration techniques from Chapters 3–5. Avoid calculator questions. Include at least one proof-based question..."
            style={{ minHeight: 100, fontSize: 12, lineHeight: 1.7 }}
          />
        </section>

        {/* Exam Settings */}
        <ExamSettings
          settings={settings}
          onChange={(patch) => setExamSettings(session.id, patch)}
        />

        {/* Generate Button */}
        <div>
          <button
            className="btn btn-primary"
            onClick={generateExam}
            disabled={generatingExam || sessionFiles.length === 0}
            style={{ width: '100%', justifyContent: 'center', padding: '11px', fontSize: 13 }}
          >
            {generatingExam ? (
              <>
                <div style={{
                  width: 13, height: 13, border: '1.5px solid rgba(255,255,255,0.3)',
                  borderTopColor: 'white', borderRadius: '50%',
                  animation: 'spin 0.8s linear infinite'
                }} />
                Generating exam...
              </>
            ) : (
              <>
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                  <path d="M7 1l1.8 3.6L13 5.5l-3 2.9.7 4.1L7 10.5 3.3 12.5l.7-4.1L1 5.5l4.2-.9L7 1z" fill="currentColor"/>
                </svg>
                Generate Exam
              </>
            )}
          </button>
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </div>

        {/* Previous Exams */}
        {sessionExams.length > 0 && (
          <section>
            <SectionHeader title="Previous Exams" hint="Click to take again" />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {sessionExams.map(exam => (
                <ExamRow key={exam.id} exam={exam} onOpen={() => openExam(exam)} />
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  )
}

function SectionHeader({ title, hint }) {
  return (
    <div style={{ marginBottom: 10 }}>
      <h2 style={{ fontSize: 12, fontWeight: 500, color: 'var(--ink-1)', marginBottom: 2 }}>{title}</h2>
      {hint && <p style={{ fontSize: 11, color: 'var(--ink-3)' }}>{hint}</p>}
    </div>
  )
}

function FileRow({ file, onDelete }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 10,
      padding: '7px 10px', background: 'var(--surface-2)',
      borderRadius: 'var(--radius)', border: '1px solid var(--border)'
    }}>
      <span style={{ fontSize: 16 }}>{getFileIcon(file.mime_type)}</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 12, color: 'var(--ink-1)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {file.name}
        </div>
        <div style={{ fontSize: 10, color: 'var(--ink-3)' }}>{formatFileSize(file.size)}</div>
      </div>
      <button className="btn btn-ghost btn-icon" onClick={onDelete} style={{ padding: 4, color: 'var(--ink-3)' }}>
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
          <path d="M2 2l8 8M10 2L2 10" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
        </svg>
      </button>
    </div>
  )
}

function ExamRow({ exam, onOpen }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 12,
      padding: '10px 12px', background: 'var(--surface-1)',
      borderRadius: 'var(--radius)', border: '1px solid var(--border)',
      cursor: 'pointer', transition: 'all 0.1s ease'
    }}
    onClick={onOpen}
    onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--border-active)'}
    onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border)'}
    >
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, color: 'var(--ink-1)', marginBottom: 2 }}>{exam.title}</div>
        <div style={{ fontSize: 11, color: 'var(--ink-3)' }}>
          {exam.questions_json?.length || 0} questions · {exam.total_marks} marks · {formatDate(exam.created_at)}
        </div>
      </div>
      <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
        {exam.metadata_json?.topics?.slice(0, 2).map(t => (
          <span key={t} className="tag tag-accent">{t}</span>
        ))}
        <svg width="13" height="13" viewBox="0 0 13 13" fill="none" style={{ color: 'var(--ink-3)' }}>
          <path d="M4 2.5l5 4-5 4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
        </svg>
      </div>
    </div>
  )
}

function defaultSettings() {
  return {
    numQuestions: 5,
    examLength: { type: 'marks', value: 50 },
    difficulty: 'medium',
    topicFocus: '',
    markingStrictness: 'standard',
    allowAlternatives: true,
    openBook: false,
    timerEnabled: false,
    timerDuration: 60,
    autoSubmit: false,
  }
}
