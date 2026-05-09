const { requireAuth, respond, cors } = require('./_auth')
const { getDb } = require('./_db')
const { callGemini } = require('./_gemini')

async function getDbUser(sql, netlifyId, email) {
  await sql`INSERT INTO users (netlify_id, email) VALUES (${netlifyId}, ${email}) ON CONFLICT (netlify_id) DO UPDATE SET email = EXCLUDED.email`
  const [u] = await sql`SELECT id FROM users WHERE netlify_id = ${netlifyId}`
  return u.id
}

const MARKING_PROMPT = (questions, answers, markingSchemes, settings) => `
You are an expert mathematics examiner. Mark the student's answers carefully and helpfully.

Marking strictness: ${settings.markingStrictness || 'standard'}
Allow alternative methods: ${settings.allowAlternatives !== false ? 'yes — if the student uses a valid alternative method, award full marks and note it' : 'no'}

For EACH question:
- Work through the marking scheme step by step
- Try to match the student's method to the marking scheme where possible — if they took a different valid route, follow their logic and award marks accordingly
- If the student is wrong, show the CORRECT answer in full (worked solution)
- If the question asks for a counterexample and the student got it wrong, provide a correct counterexample
- If the student got partial credit, explain exactly what they did right and what was missing
- All mathematics in feedback MUST use proper LaTeX: $inline$ or $$display$$
- "Expected" fields must be proper LaTeX expressions, not plain text mixed with LaTeX
- Step descriptions must be plain English, not LaTeX-encoded text

${questions.map((q, i) => {
  const scheme = markingSchemes.find(s => s.id === q.id) || {}
  return `
=== Question ${i + 1} (${q.marks} marks total) ===
Question: ${q.question}
Marking scheme: ${scheme.marking_scheme || 'Award marks for correct working'}
Model answer: ${scheme.model_answer || ''}
Student answer: ${answers[q.id] || '(no answer provided)'}
`}).join('\n')}

Respond with ONLY valid JSON, no markdown fences:
{
  "total_score": number,
  "max_score": number,
  "method_marks_total": number,
  "weak_topics": ["topic — use vocabulary from the source material"],
  "strong_topics": ["topic"],
  "overall_comment": "string — 2-3 sentences, specific and constructive",
  "questions": [
    {
      "id": "q1",
      "scored_marks": number,
      "is_correct": boolean,
      "marking_scheme": "string — the full marking scheme now revealed to the student",
      "correct_answer": "string — complete worked correct answer in LaTeX, always provided whether student was right or wrong",
      "feedback": {
        "overall": "string — 2-3 sentences specific to this answer. If wrong, explain the error clearly and what was needed.",
        "steps": [
          {
            "description": "plain English description of what this step requires",
            "awarded": boolean,
            "marks": number,
            "comment": "string — if not awarded: what was missing or wrong AND what the correct approach is. If awarded: brief confirmation.",
            "correct_working": "LaTeX string — the correct mathematical working for this step, always shown"
          }
        ],
        "misconceptions": ["string — specific misconception identified, plain English"],
        "alternatives": ["LaTeX string — valid alternative approach if applicable"]
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
    const userId = await getDbUser(sql, authUser.netlifyId, authUser.email)

    const method = event.httpMethod
    const qs = event.queryStringParameters || {}
    const { examId, id: attemptId, action } = qs

    // POST ?examId=X — create attempt
    if (method === 'POST' && examId && !action) {
      const [exam] = await sql`
        SELECT e.* FROM exams e JOIN sessions s ON s.id = e.session_id
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

    // GET ?examId=X — list attempts for an exam
    if (method === 'GET' && examId) {
      const attempts = await sql`
        SELECT id, total_score, max_score, percentage, status, started_at, submitted_at, created_at
        FROM attempts WHERE exam_id = ${examId} AND user_id = ${userId}
        ORDER BY created_at DESC
      `
      return respond(200, attempts)
    }

    // PATCH ?id=X — autosave
    if (method === 'PATCH' && attemptId && !action) {
      const body = JSON.parse(event.body || '{}')
      await sql`
        UPDATE attempts SET
          answers_json = COALESCE(${body.answers_json ? JSON.stringify(body.answers_json) : null}::jsonb, answers_json),
          updated_at = NOW()
        WHERE id = ${attemptId} AND user_id = ${userId}
      `
      return respond(200, { ok: true })
    }

    // POST ?id=X&action=submit
    if (method === 'POST' && attemptId && action === 'submit') {
      const body = JSON.parse(event.body || '{}')
      const [attempt] = await sql`
        UPDATE attempts SET
          answers_json = ${JSON.stringify(body.answers_json || {})}::jsonb,
          status = 'submitted', submitted_at = NOW(), updated_at = NOW()
        WHERE id = ${attemptId} AND user_id = ${userId}
        RETURNING *
      `
      if (!attempt) return respond(404, { error: 'Attempt not found' })
      return respond(200, attempt)
    }

    // POST ?id=X&action=mark
    if (method === 'POST' && attemptId && action === 'mark') {
      const [attempt] = await sql`
        SELECT a.*, e.questions_json, e.marking_scheme_json, e.settings_json, e.total_marks, e.session_id
        FROM attempts a JOIN exams e ON e.id = a.exam_id
        WHERE a.id = ${attemptId} AND a.user_id = ${userId}
      `
      if (!attempt) return respond(404, { error: 'Attempt not found' })

      const questions = attempt.questions_json || []
      const markingSchemes = attempt.marking_scheme_json || []
      const answers = attempt.answers_json || {}
      const settings = attempt.settings_json || {}

      const markingData = await callGemini(
        MARKING_PROMPT(questions, answers, markingSchemes, settings),
        { temperature: 0.2, maxTokens: 12000 }
      )

      const totalScore = markingData.total_score || 0
      const maxScore = markingData.max_score || attempt.total_marks || 0
      const pct = maxScore > 0 ? Math.round(totalScore / maxScore * 1000) / 10 : 0

      const enrichedQuestions = questions.map(q => {
        const qf = markingData.questions?.find(mq => mq.id === q.id) || {}
        return {
          ...q,
          studentAnswer: answers[q.id] || '',
          scoredMarks: qf.scored_marks ?? 0,
          isCorrect: qf.is_correct ?? false,
          markingScheme: qf.marking_scheme || '',
          correctAnswer: qf.correct_answer || '',
          feedback: qf.feedback || {},
        }
      })

      const feedbackJson = { ...markingData, questions: enrichedQuestions }

      const [updated] = await sql`
        UPDATE attempts SET
          feedback_json = ${JSON.stringify(feedbackJson)}::jsonb,
          total_score = ${totalScore}, max_score = ${maxScore}, percentage = ${pct},
          status = 'marked', updated_at = NOW()
        WHERE id = ${attemptId} RETURNING *
      `

      for (const q of questions) {
        const qf = markingData.questions?.find(mq => mq.id === q.id)
        for (const topic of (q.topics?.length ? q.topics : ['general'])) {
          await sql`
            INSERT INTO analytics (user_id, session_id, attempt_id, topic, score, max_score, difficulty)
            VALUES (${userId}, ${attempt.session_id}, ${attemptId}, ${topic}, ${qf?.scored_marks ?? 0}, ${q.marks || 0}, ${q.difficulty || 'medium'})
          `
        }
      }

      return respond(200, { ...updated, feedback_json: feedbackJson })
    }

    // DELETE ?id=X&action=delete — delete an attempt
    if (method === 'DELETE' && attemptId) {
      await sql`DELETE FROM attempts WHERE id = ${attemptId} AND user_id = ${userId}`
      return respond(200, { ok: true })
    }

    return respond(404, { error: `No handler for ${method} action=${action}` })
  } catch (e) {
    console.error('attempts error:', e.message)
    return respond(500, { error: e.message })
  }
}
