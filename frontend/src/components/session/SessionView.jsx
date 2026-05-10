import { useState, useEffect, useRef } from 'react'
import useStore from '../../lib/store.js'
import { apiClient } from '../../lib/api.js'
import { formatFileSize, getFileIcon, debounce, formatDate, gradeLabel, percentage } from '../../lib/utils.js'
import ExamSettings from './ExamSettings.jsx'
import Spinner from '../ui/Spinner.jsx'
import toast from 'react-hot-toast'

export default function SessionView({ session }) {
  const {
    files, setFiles, addFile, removeFile,
    exams, setExams, addExam,
    instructions, setInstructions,
    examSettings, setExamSettings,
    setActiveView, setActiveAttempt,
    generatingExam, setGeneratingExam,
  } = useStore()

  const sessionFiles = files[session.id] || []
  const sessionExams = exams[session.id] || []
  const sessionInstructions = instructions[session.id] || ''
  const settings = examSettings[session.id] || defaultSettings()

  const [uploading, setUploading] = useState(false)
  const [dragOver, setDragOver] = useState(false)
  const [examAttempts, setExamAttempts] = useState({}) // { examId: [attempt] }
  const [expandedExam, setExpandedExam] = useState(null)
  const fileInputRef = useRef(null)

  useEffect(() => { loadFiles(); loadExams() }, [session.id])

  async function loadFiles() {
    try { setFiles(session.id, await apiClient.getFiles(session.id)) }
    catch (e) { console.error('loadFiles:', e.message) }
  }

  async function loadExams() {
    try { setExams(session.id, await apiClient.getExams(session.id)) }
    catch (e) { console.error('loadExams:', e.message) }
  }

  async function loadAttempts(examId) {
    try {
      const attempts = await apiClient.getAttempts(examId)
      setExamAttempts(prev => ({ ...prev, [examId]: attempts }))
    } catch (e) { console.error('loadAttempts:', e.message) }
  }

  async function handleFileUpload(fileList) {
    setUploading(true)
    for (const file of Array.from(fileList)) {
      try {
        addFile(session.id, await apiClient.uploadFile(session.id, file))
        toast.success(`Uploaded ${file.name}`)
      } catch (e) { toast.error(`Failed: ${e.message}`) }
    }
    setUploading(false)
  }

  async function handleDeleteFile(fileId) {
    try { await apiClient.deleteFile(session.id, fileId); removeFile(session.id, fileId) }
    catch (e) { toast.error('Failed to delete file') }
  }

  async function generateExam() {
    if (sessionFiles.length === 0) { toast.error('Upload at least one file first'); return }
    setGeneratingExam(true)
    try {
      const exam = await apiClient.generateExam({
        sessionId: session.id, fileIds: sessionFiles.map(f => f.id),
        instructions: sessionInstructions, settings,
      })
      addExam(session.id, exam)
      const attempt = await apiClient.createAttempt(exam.id)
      setActiveAttempt({ ...attempt, exam })
      setActiveView('exam')
      toast.success('Exam generated!')
    } catch (e) { toast.error(e.message || 'Failed to generate exam') }
    finally { setGeneratingExam(false) }
  }

  async function openAttempt(exam, attempt) {
    // If attempt is already marked, go straight to review
    if (attempt.status === 'marked' && attempt.feedback_json) {
      setActiveAttempt({ ...attempt, exam })
      setActiveView('review')
    } else {
      setActiveAttempt({ ...attempt, exam })
      setActiveView('exam')
    }
  }

  async function newAttempt(exam) {
    try {
      const attempt = await apiClient.createAttempt(exam.id)
      setActiveAttempt({ ...attempt, exam })
      setActiveView('exam')
    } catch (e) { toast.error('Failed to start exam') }
  }

  async function handleDeleteExam(examId) {
    if (!confirm('Delete this exam and all its attempts?')) return
    try {
      await apiClient.deleteExam(examId)
      setExams(session.id, sessionExams.filter(e => e.id !== examId))
      toast.success('Exam deleted')
    } catch (e) { toast.error('Failed to delete exam') }
  }

  function toggleExam(examId) {
    if (expandedExam === examId) {
      setExpandedExam(null)
    } else {
      setExpandedExam(examId)
      if (!examAttempts[examId]) loadAttempts(examId)
    }
  }

  function handleDrop(e) {
    e.preventDefault(); setDragOver(false)
    handleFileUpload(e.dataTransfer.files)
  }

  // Number exams oldest→newest so Exam 1, Exam 2, etc.
  const numberedExams = [...sessionExams].reverse().map((exam, i) => ({ ...exam, number: i + 1 })).reverse()

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <div style={{ padding: '16px 24px 12px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
        <h1 style={{ fontSize: 16, fontFamily: 'Instrument Serif, serif', color: 'var(--ink-1)', marginBottom: 2 }}>
          {session.name}
        </h1>
        <p style={{ fontSize: 11, color: 'var(--ink-3)' }}>
          {sessionFiles.length} file{sessionFiles.length !== 1 ? 's' : ''} · {sessionExams.length} exam{sessionExams.length !== 1 ? 's' : ''}
        </p>
      </div>

      <div className="scroll-y" style={{ flex: 1, padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 24 }}>

        {/* Files */}
        <section>
          <SectionHeader title="Study Materials" hint="Upload PDFs, Word docs, or text files" />
          <div
            style={{
              border: `1.5px dashed ${dragOver ? 'var(--accent)' : 'var(--border)'}`,
              borderRadius: 'var(--radius-lg)', padding: 20, textAlign: 'center',
              cursor: 'pointer', background: dragOver ? 'var(--accent-glow)' : 'transparent',
              transition: 'all 0.15s ease', marginBottom: 10
            }}
            onClick={() => fileInputRef.current?.click()}
            onDragOver={e => { e.preventDefault(); setDragOver(true) }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
          >
            <input ref={fileInputRef} type="file" multiple accept=".pdf,.doc,.docx,.txt" style={{ display: 'none' }} onChange={e => handleFileUpload(e.target.files)} />
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" style={{ margin: '0 auto 8px', display: 'block', color: 'var(--ink-3)' }}>
              <path d="M12 16V4M7 9l5-5 5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
              <path d="M4 18h16" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" opacity="0.5"/>
            </svg>
            <p style={{ fontSize: 13, color: 'var(--ink-2)', marginBottom: 2 }}>{uploading ? 'Uploading…' : 'Drop files or click to upload'}</p>
            <p style={{ fontSize: 11, color: 'var(--ink-3)' }}>PDF, Word, Text · Max 20MB</p>
          </div>
          {sessionFiles.map(file => (
            <FileRow key={file.id} file={file} onDelete={() => handleDeleteFile(file.id)} />
          ))}
        </section>

        {/* Instructions */}
        <section>
          <SectionHeader title="Instructions" hint="Guide the AI on exam style, topics, constraints" />
          <textarea
            className="input"
            value={sessionInstructions}
            onChange={e => setInstructions(session.id, e.target.value)}
            placeholder="e.g. Focus on proof-based questions about supremum and infimum. No calculator questions."
            style={{ minHeight: 90, fontSize: 12, lineHeight: 1.7 }}
          />
        </section>

        <ExamSettings settings={settings} onChange={patch => setExamSettings(session.id, patch)} />

        {/* Generate */}
        <div>
          <button
            className="btn btn-primary"
            onClick={generateExam}
            disabled={generatingExam || sessionFiles.length === 0}
            style={{ width: '100%', justifyContent: 'center', padding: '11px', fontSize: 13 }}
          >
            {generatingExam ? <><Spinner /> Generating exam…</> : <>✦ Generate Exam</>}
          </button>
          {sessionFiles.length === 0 && <p style={{ fontSize: 11, color: 'var(--ink-3)', textAlign: 'center', marginTop: 6 }}>Upload at least one file first</p>}
        </div>

        {/* Past exams */}
        {numberedExams.length > 0 && (
          <section>
            <SectionHeader title="Exams" hint="Expand to see attempts or start a new one" />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {numberedExams.map(exam => (
                <ExamAccordion
                  key={exam.id}
                  exam={exam}
                  attempts={examAttempts[exam.id]}
                  expanded={expandedExam === exam.id}
                  onToggle={() => toggleExam(exam.id)}
                  onNewAttempt={() => newAttempt(exam)}
                  onOpenAttempt={(attempt) => openAttempt(exam, attempt)}
                  onDelete={() => handleDeleteExam(exam.id)}
                />
              ))}
            </div>
          </section>
        )}

        <div style={{ height: 32 }} />
      </div>
    </div>
  )
}

function ExamAccordion({ exam, attempts, expanded, onToggle, onNewAttempt, onOpenAttempt, onDelete }) {
  const topics = exam.metadata_json?.topics || []
  const bestAttempt = attempts?.filter(a => a.status === 'marked').sort((a, b) => (b.percentage || 0) - (a.percentage || 0))[0]

  return (
    <div style={{ background: 'var(--surface-1)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', overflow: 'hidden' }}>
      {/* Header row */}
      <div
        style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', cursor: 'pointer' }}
        onClick={onToggle}
      >
        <div style={{
          width: 28, height: 28, borderRadius: 6, background: 'var(--surface-3)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 11, color: 'var(--ink-3)', fontWeight: 500, flexShrink: 0
        }}>
          #{exam.number}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 12, color: 'var(--ink-1)', marginBottom: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {topics.length > 0 ? topics.join(', ') : exam.title}
          </div>
          <div style={{ fontSize: 10, color: 'var(--ink-3)' }}>
            {exam.questions_json?.length || 0} questions · {exam.total_marks} marks · {formatDate(exam.created_at)}
            {bestAttempt && <span style={{ marginLeft: 8, color: gradeLabel(bestAttempt.percentage || 0).color }}>Best: {Math.round(bestAttempt.percentage || 0)}%</span>}
          </div>
        </div>
        <button
          className="btn btn-ghost btn-icon"
          style={{ padding: 4, color: 'var(--danger)', flexShrink: 0 }}
          onClick={e => { e.stopPropagation(); onDelete() }}
          title="Delete exam"
        >
          <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
            <path d="M2 3.5h9M5 3.5V2h3v1.5M5.5 6v4M7.5 6v4M3 3.5l.5 7a1 1 0 001 1h4a1 1 0 001-1l.5-7" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
          </svg>
        </button>
        <svg width="13" height="13" viewBox="0 0 13 13" fill="none"
          style={{ color: 'var(--ink-3)', transform: expanded ? 'rotate(0)' : 'rotate(-90deg)', transition: 'transform 0.15s', flexShrink: 0 }}>
          <path d="M2 4.5l4.5 4 4.5-4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
        </svg>
      </div>

      {/* Expanded: attempts list */}
      {expanded && (
        <div style={{ borderTop: '1px solid var(--border)', padding: '10px 14px', display: 'flex', flexDirection: 'column', gap: 6 }}>
          <button
            className="btn btn-primary"
            onClick={onNewAttempt}
            style={{ justifyContent: 'center', fontSize: 12, padding: '7px' }}
          >
            + New attempt
          </button>

          {!attempts && (
            <p style={{ fontSize: 11, color: 'var(--ink-3)', textAlign: 'center', padding: '8px 0' }}>Loading…</p>
          )}
          {attempts?.length === 0 && (
            <p style={{ fontSize: 11, color: 'var(--ink-3)', textAlign: 'center', padding: '8px 0' }}>No attempts yet</p>
          )}
          {attempts?.map((attempt, i) => (
            <AttemptRow
              key={attempt.id}
              attempt={attempt}
              number={attempts.length - i}
              onClick={() => onOpenAttempt(attempt)}
            />
          ))}
        </div>
      )}
    </div>
  )
}

function AttemptRow({ attempt, number, onClick }) {
  const pct = attempt.percentage || 0
  const grade = gradeLabel(pct)
  const statusLabel = attempt.status === 'marked' ? `${Math.round(pct)}% · ${grade.label}` : attempt.status === 'submitted' ? 'Submitted' : 'In progress'

  return (
    <div
      style={{
        display: 'flex', alignItems: 'center', gap: 10,
        padding: '8px 10px', background: 'var(--surface-2)',
        borderRadius: 'var(--radius)', border: '1px solid var(--border)',
        cursor: 'pointer', transition: 'border-color 0.1s'
      }}
      onClick={onClick}
      onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--border-active)'}
      onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border)'}
    >
      <span style={{ fontSize: 11, color: 'var(--ink-3)', minWidth: 60 }}>Attempt {number}</span>
      <span style={{ fontSize: 11, color: grade.color, flex: 1 }}>{statusLabel}</span>
      <span style={{ fontSize: 10, color: 'var(--ink-3)' }}>{formatDate(attempt.created_at)}</span>
      <svg width="11" height="11" viewBox="0 0 11 11" fill="none" style={{ color: 'var(--ink-3)' }}>
        <path d="M3 2l4 3.5L3 9" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
      </svg>
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
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '7px 10px', background: 'var(--surface-2)', borderRadius: 'var(--radius)', border: '1px solid var(--border)', marginBottom: 4 }}>
      <span style={{ fontSize: 15 }}>{getFileIcon(file.mime_type)}</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 12, color: 'var(--ink-1)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{file.name}</div>
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


function defaultSettings() {
  return {
    numQuestions: 5,
    examLength: { type: 'marks', value: 20 },
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
