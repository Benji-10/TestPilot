const { requireAuth, respond, cors } = require('./_auth')
const { getDb } = require('./_db')
const { GoogleGenerativeAI } = require('@google/generative-ai')
const { v4: uuidv4 } = require('uuid')

async function getDbUser(sql, netlifyId) {
  const [u] = await sql`SELECT id FROM users WHERE netlify_id = ${netlifyId}`
  if (!u) throw new Error('User not found')
  return u.id
}

const MARKING_PROMPT = (questions, answers, markingSchemes, settings) => `
You are an expert examiner marking a student's exam. Be fair but thorough.
Marking strictness: ${settings.markingStrictness || 'standard'}
Allow alternative solutions: ${settings.allowAlternatives ? 'yes — award full marks for any correct equivalent method' : 'no — only accept the expected method'}

## Questions, Marking Schemes & Student Answers:
${questions.map((q, i) => {
  const scheme = markingSchemes.find(s => s.id === q.id) || {}
  const studentAnswer = answers[q.id] || ''
  return `
### Question ${i + 1} (${q.marks} marks)
**Question:** ${q.question}
**Expected methods:** ${(q.expected_methods || []).join('; ')}
**Marking scheme:** ${scheme.marking_scheme || 'Award marks for correct working'}
**Model answer:** ${scheme.model_answer || ''}
**Student's answer:** ${studentAnswer || '(no answer provided)'}
`
}).join('\n')}

## Instructions:
1. Mark each question step-by-step following the marking scheme
2. Identify method marks (M) and accuracy marks (A) separately
3. For blank answers give 0 marks
4. Identify specific misconceptions or errors
5. Note alternative valid approaches if relevant
6. Be encouraging but precise — emulate human examiner style
7. Use LaTeX in expected/model answers for math

## Output ONLY valid JSON:
{
  "total_score": number,
  "max_score": number,
  "method_marks_total": number,
  "weak_topics": ["topic"],
  "strong_topics": ["topic"],
  "overall_comment": "string — 1-2 sentence examiner comment on overall performance",
  "questions": [
    {
      "id": "q1",
      "scored_marks": number,
      "is_correct": boolean,
      "student_answer": "string",
      "marking_scheme": "string — the full marking scheme (now revealed)",
      "feedback": {
        "overall": "string — 1-2 sentence question-level feedback",
        "steps": [
          {
            "description": "string — what this mark is for",
            "awarded": boolean,
            "marks": number,
            "comment": "string — why mark was/wasn't awarded",
            "expected": "LaTeX expression of expected value (optional)"
          }
        ],
        "misconceptions": ["string"],
        "alternatives": ["LaTeX string — alternative valid approach if any"]
      }
    }
  ]
}
`

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return cors()

  try {
    const authUser = await requireAuth(event)
    const sql = getDb()
    const userId = await getDbUser(sql, authUser.netlifyId)

    const path = event.path
    // Routes:
    // POST /exams/:examId/attempts  — create attempt
    // GET  /exams/:examId/attempts  — list attempts
    // PATCH /attempts/:id           — save progress
    // POST /attempts/:id/submit     — submit
    // POST /attempts/:id/mark       — trigger marking

    const examAttemptMatch = path.match(/exams\/([^/]+)\/attempts/)
    const attemptMatch = path.match(/attempts\/([^/]+)(?:\/(.+))?$/)

    // POST /exams/:examId/attempts
    if (examAttemptMatch && event.httpMethod === 'POST') {
      const examId = examAttemptMatch[1]
      const [exam] = await sql`
        SELECT e.* FROM exams e
        JOIN sessions s ON s.id = e.session_id
        WHERE e.id = ${examId} AND s.user_id = ${userId}
      `
      if (!exam) return respond(404, { error: 'Exam not found' })

      const [attempt] = await sql`
        INSERT INTO attempts (exam_id, session_id, user_id, answers_json, status)
        VALUES (${examId}, ${exam.session_id}, ${userId}, '{}', 'in_progress')
        RETURNING *
      `
      return respond(201, attempt)
    }

    // GET /exams/:examId/attempts
    if (examAttemptMatch && event.httpMethod === 'GET') {
      const examId = examAttemptMatch[1]
      const attempts = await sql`
        SELECT id, total_score, max_score, percentage, status, started_at, submitted_at
        FROM attempts WHERE exam_id = ${examId} AND user_id = ${userId}
        ORDER BY created_at DESC
      `
      return respond(200, attempts)
    }

    // PATCH /attempts/:id
    if (attemptMatch && event.httpMethod === 'PATCH' && !attemptMatch[2]) {
      const attemptId = attemptMatch[1]
      const body = JSON.parse(event.body || '{}')

      await sql`
        UPDATE attempts SET
          answers_json = COALESCE(${body.answers_json ? JSON.stringify(body.answers_json) : null}::jsonb, answers_json),
          timer_state_json = COALESCE(${body.timer_state_json ? JSON.stringify(body.timer_state_json) : null}::jsonb, timer_state_json),
          updated_at = NOW()
        WHERE id = ${attemptId} AND user_id = ${userId}
      `
      return respond(200, { ok: true })
    }

    // POST /attempts/:id/submit
    if (attemptMatch && event.httpMethod === 'POST' && attemptMatch[2] === 'submit') {
      const attemptId = attemptMatch[1]
      const body = JSON.parse(event.body || '{}')

      const [attempt] = await sql`
        UPDATE attempts SET
          answers_json = ${JSON.stringify(body.answers_json || {})}::jsonb,
          status = 'submitted',
          submitted_at = NOW(),
          updated_at = NOW()
        WHERE id = ${attemptId} AND user_id = ${userId}
        RETURNING *
      `
      if (!attempt) return respond(404, { error: 'Attempt not found' })
      return respond(200, attempt)
    }

    // POST /attempts/:id/mark
    if (attemptMatch && event.httpMethod === 'POST' && attemptMatch[2] === 'mark') {
      const attemptId = attemptMatch[1]

      if (!process.env.GEMINI_API_KEY) return respond(500, { error: 'GEMINI_API_KEY not configured' })

      // Get attempt + exam + marking scheme
      const [attempt] = await sql`
        SELECT a.*, e.questions_json, e.marking_scheme_json, e.settings_json, e.total_marks, e.session_id
        FROM attempts a
        JOIN exams e ON e.id = a.exam_id
        WHERE a.id = ${attemptId} AND a.user_id = ${userId}
      `
      if (!attempt) return respond(404, { error: 'Attempt not found' })

      const questions = attempt.questions_json || []
      const markingSchemes = attempt.marking_scheme_json || []
      const answers = attempt.answers_json || {}
      const settings = attempt.settings_json || {}

      const prompt = MARKING_PROMPT(questions, answers, markingSchemes, settings)

      const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY)
      const model = genAI.getGenerativeModel({
        model: 'gemini-1.5-flash-latest',
        generationConfig: {
          temperature: 0.3,
          maxOutputTokens: 8192,
          responseMimeType: 'application/json',
        }
      })

      const result = await model.generateContent(prompt)
      const responseText = result.response.text()

      let markingData
      try {
        markingData = JSON.parse(responseText)
      } catch {
        const match = responseText.match(/\{[\s\S]*\}/)
        if (!match) throw new Error('Failed to parse marking response')
        markingData = JSON.parse(match[0])
      }

      const totalScore = markingData.total_score || 0
      const maxScore = markingData.max_score || attempt.total_marks || 0
      const pct = maxScore > 0 ? Math.round((totalScore / maxScore) * 100 * 10) / 10 : 0

      // Merge student answers and marking scheme back into question objects for review
      const enrichedQuestions = questions.map(q => {
        const qFeedback = markingData.questions?.find(mq => mq.id === q.id) || {}
        return {
          ...q,
          studentAnswer: answers[q.id] || '',
          scoredMarks: qFeedback.scored_marks ?? 0,
          isCorrect: qFeedback.is_correct ?? false,
          markingScheme: qFeedback.marking_scheme || '',
          feedback: qFeedback.feedback || {},
        }
      })

      const feedbackJson = {
        ...markingData,
        questions: enrichedQuestions,
      }

      // Save marking results
      const [updated] = await sql`
        UPDATE attempts SET
          feedback_json = ${JSON.stringify(feedbackJson)}::jsonb,
          total_score = ${totalScore},
          max_score = ${maxScore},
          percentage = ${pct},
          status = 'marked',
          updated_at = NOW()
        WHERE id = ${attemptId}
        RETURNING *
      `

      // Record analytics
      for (const q of questions) {
        const qFeedback = markingData.questions?.find(mq => mq.id === q.id)
        for (const topic of (q.topics || ['general'])) {
          await sql`
            INSERT INTO analytics (user_id, session_id, attempt_id, topic, score, max_score, difficulty)
            VALUES (
              ${userId}, ${attempt.session_id}, ${attemptId},
              ${topic},
              ${qFeedback?.scored_marks ?? 0},
              ${q.marks || 0},
              ${q.difficulty || 'medium'}
            )
          `
        }
      }

      return respond(200, { ...updated, feedback_json: feedbackJson })
    }

    return respond(404, { error: 'Not found' })
  } catch (e) {
    console.error('attempts error:', e)
    return respond(500, { error: e.message })
  }
}
