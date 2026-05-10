const { requireAuth, respond, cors } = require('./_auth')
const { getDb } = require('./_db')
const { callGemini } = require('./_gemini')

async function getDbUser(sql, netlifyId, email) {
  await sql`INSERT INTO users (netlify_id, email) VALUES (${netlifyId}, ${email}) ON CONFLICT (netlify_id) DO UPDATE SET email = EXCLUDED.email`
  const [u] = await sql`SELECT id FROM users WHERE netlify_id = ${netlifyId}`
  return u.id
}

function recalculateScores(markingData, questions) {
  const recalculated = (markingData.questions || []).map(qf => {
    const steps = qf.feedback?.steps || []
    const fromSteps = steps.reduce((sum, s) => sum + (s.awarded ? (s.marks || 0) : 0), 0)
    const question = questions.find(q => q.id === qf.id)
    const maxMarks = question?.marks || 0
    const scored = Math.min(fromSteps > 0 ? fromSteps : (qf.scored_marks || 0), maxMarks)
    return { ...qf, scored_marks: scored }
  })
  const totalScore = recalculated.reduce((sum, qf) => sum + (qf.scored_marks || 0), 0)
  const maxScore = questions.reduce((sum, q) => sum + (q.marks || 0), 0)
  return { ...markingData, questions: recalculated, total_score: totalScore, max_score: maxScore }
}

const MARKING_PROMPT = (questions, answers, markingSchemes, settings) => `
You are an expert mathematics examiner. Mark the student's answers carefully and helpfully.

Marking strictness: ${settings.markingStrictness || 'standard'}
Allow alternative methods: ${settings.allowAlternatives !== false ? 'yes — award full marks for any valid equivalent method' : 'no'}

LaTeX formatting rules — STRICT:
- ALL mathematics must use $inline$ or $$display$$ delimiters
- Prose fields must be plain English sentences — no bare \\commands outside delimiters
- correct_working example: "Since $x \\leq M$ for all $x \\in S$, we have $-x \\geq -M$"
- misconceptions, alternatives, step descriptions: plain English with $math$ where needed

Critical marking rules:
- Mark ONLY what is in the question as written. Do not add conditions not stated.
- Read the question EXACTLY. If it says "finite set" it means finite set — not "non-empty finite set".
- If a student provides a valid counterexample or proof, award the marks even if other parts are wrong.
- For true/false, the student's conclusion must match mathematical truth — not your assumptions about the question.
- If the student's method is valid but different from the scheme, follow their method and award marks.

${questions.map((q, i) => {
  const scheme = markingSchemes.find(s => s.id === q.id) || {}
  return `=== Q${i+1} (${q.marks} marks) ===
Question: ${q.question}
Marking scheme: ${scheme.marking_scheme || 'Award marks for correct working'}
Model answer: ${scheme.model_answer || ''}
Student answer: ${answers[q.id] || '(no answer)'}`
}).join('\n\n')}

Respond with ONLY valid JSON, no markdown. Double-escape all backslashes (\\\\frac not \\frac):
{
  "total_score": number,
  "max_score": number,
  "method_marks_total": number,
  "weak_topics": ["topic"],
  "strong_topics": ["topic"],
  "overall_comment": "string",
  "questions": [{
    "id": "q1",
    "scored_marks": number,
    "is_correct": boolean,
    "marking_scheme": "string",
    "correct_answer": "full worked answer with $LaTeX$ delimiters",
    "feedback": {
      "overall": "plain English 2-3 sentences with $math$ where needed",
      "steps": [{
        "description": "plain English with $math$ where needed",
        "awarded": boolean,
        "marks": number,
        "comment": "plain English with $math$ where needed",
        "correct_working": "working with $LaTeX$ delimiters"
      }],
      "misconceptions": ["plain English with $math$ where needed"],
      "alternatives": ["description with $LaTeX$ delimiters"]
    }
  }]
}`

// IMPORTANT: original_answer is the VERBATIM text the student submitted at exam time.
// It cannot be changed. The appeal is only about whether the MARKING of that answer was correct.
const APPEAL_PROMPT = (question, originalAnswer, currentFeedback, appealReason, markingScheme) => `
You are a senior examiner reviewing an appeal. You must be RIGOROUS — only uphold if the original marking was genuinely wrong.

CRITICAL: The student's original answer is fixed and cannot change. The appeal is ONLY about whether the marking of that exact answer was correct.
If the student claims they wrote something that is not in their original answer, REJECT the appeal.
If the student argues the question wording was different from what it says, check carefully.

Question (exactly as set): ${question}
Marking scheme: ${markingScheme}
Student's original answer (verbatim, cannot change): ${originalAnswer || '(blank)'}
Current marks: ${currentFeedback.scored_marks ?? 0} / ${currentFeedback.feedback?.steps?.reduce((s,t) => s + (t.marks||0), 0) || '?'}
Current feedback given to student: ${currentFeedback.feedback?.overall || ''}
Current step breakdown: ${JSON.stringify(currentFeedback.feedback?.steps || [])}

Student's appeal argument: ${appealReason}

Be rigorous. Ask yourself:
1. Is the student's ORIGINAL answer actually correct or partially correct for the marks claimed?
2. Did the marker misread the question or overlook valid working IN THE ORIGINAL ANSWER?
3. Is the student trying to claim credit for something NOT in their original answer? → REJECT.
4. Is the student correct that the question wording does not include a condition the marker assumed? → Check carefully.

LaTeX rules: $inline$ and $$display$$ delimiters. Prose in plain English.

Respond with ONLY valid JSON:
{
  "appeal_upheld": boolean,
  "new_scored_marks": number,
  "examiner_response": "2-4 sentences — clear explanation referencing both the original answer and the appeal argument",
  "updated_steps": [{
    "description": "plain English with $math$",
    "awarded": boolean,
    "marks": number,
    "comment": "plain English with $math$",
    "correct_working": "with $LaTeX$ delimiters"
  }]
}`

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

    // GET ?examId=X — list attempts
    if (method === 'GET' && examId) {
      const attempts = await sql`
        SELECT id, total_score, max_score, percentage, status,
               answers_json, feedback_json, started_at, submitted_at, created_at
        FROM attempts WHERE exam_id = ${examId} AND user_id = ${userId}
        ORDER BY created_at DESC
      `
      return respond(200, attempts)
    }

    // GET ?id=X — get single attempt with full exam data
    if (method === 'GET' && attemptId && !action) {
      const [attempt] = await sql`
        SELECT a.*, e.questions_json, e.marking_scheme_json, e.settings_json,
               e.total_marks, e.session_id, e.title, e.metadata_json
        FROM attempts a JOIN exams e ON e.id = a.exam_id
        WHERE a.id = ${attemptId} AND a.user_id = ${userId}
      `
      if (!attempt) return respond(404, { error: 'Attempt not found' })
      return respond(200, attempt)
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
        WHERE id = ${attemptId} AND user_id = ${userId} RETURNING *
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

      const rawMarking = await callGemini(
        MARKING_PROMPT(questions, answers, markingSchemes, settings),
        { temperature: 0.2, maxTokens: 12000 }
      )
      const markingData = recalculateScores(rawMarking, questions)

      const totalScore = markingData.total_score
      const maxScore = markingData.max_score
      const pct = maxScore > 0 ? Math.round(totalScore / maxScore * 1000) / 10 : 0

      const enrichedQuestions = questions.map(q => {
        const qf = markingData.questions?.find(mq => mq.id === q.id) || {}
        return {
          ...q,
          studentAnswer: answers[q.id] || '',
          scoredMarks: qf.scored_marks ?? 0,
          isCorrect: (qf.scored_marks ?? 0) >= (q.marks || 1),
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
            VALUES (${userId}, ${attempt.session_id}, ${attemptId}, ${topic},
                    ${qf?.scored_marks ?? 0}, ${q.marks || 0}, ${q.difficulty || 'medium'})
          `
        }
      }

      return respond(200, { ...updated, feedback_json: feedbackJson })
    }

    // POST ?id=X&action=appeal
    if (method === 'POST' && attemptId && action === 'appeal') {
      const body = JSON.parse(event.body || '{}')
      const { questionId, reason } = body
      if (!questionId || !reason?.trim()) return respond(400, { error: 'questionId and reason required' })

      const [attempt] = await sql`
        SELECT a.*, e.questions_json, e.marking_scheme_json
        FROM attempts a JOIN exams e ON e.id = a.exam_id
        WHERE a.id = ${attemptId} AND a.user_id = ${userId}
      `
      if (!attempt) return respond(404, { error: 'Attempt not found' })

      const feedback = attempt.feedback_json || {}
      const questions = attempt.questions_json || []
      const markingSchemes = attempt.marking_scheme_json || []

      const question = questions.find(q => q.id === questionId)
      const originalQFeedback = feedback.questions?.find(q => q.id === questionId)
      const scheme = markingSchemes.find(s => s.id === questionId)

      if (!question || !originalQFeedback) return respond(404, { error: 'Question not found' })

      // Pass the ORIGINAL student answer (stored at marking time) — not what they claim now
      const originalAnswer = originalQFeedback.studentAnswer || attempt.answers_json?.[questionId] || ''

      const appealResult = await callGemini(
        APPEAL_PROMPT(
          question.question,
          originalAnswer,
          originalQFeedback,
          reason,
          scheme?.marking_scheme || ''
        ),
        { temperature: 0.1, maxTokens: 4000 }
      )

      const question_max = question.marks || 0
      const newMarks = Math.min(Math.max(0, appealResult.new_scored_marks ?? originalQFeedback.scoredMarks ?? 0), question_max)

      const updatedQuestions = feedback.questions.map(q => {
        if (q.id !== questionId) return q
        return {
          ...q,
          scoredMarks: newMarks,
          isCorrect: newMarks >= question_max,
          appealResult: {
            upheld: appealResult.appeal_upheld,
            response: appealResult.examiner_response,
            previousMarks: originalQFeedback.scoredMarks ?? 0,
            newMarks,
          },
          feedback: {
            ...q.feedback,
            steps: appealResult.updated_steps?.length ? appealResult.updated_steps : q.feedback?.steps || [],
            overall: `[Appeal ${appealResult.appeal_upheld ? 'upheld' : 'rejected'}] ${appealResult.examiner_response}`,
          },
        }
      })

      const newTotal = updatedQuestions.reduce((sum, q) => sum + (q.scoredMarks || 0), 0)
      const maxScore = questions.reduce((sum, q) => sum + (q.marks || 0), 0)
      const newPct = maxScore > 0 ? Math.round(newTotal / maxScore * 1000) / 10 : 0
      const newFeedback = { ...feedback, questions: updatedQuestions, total_score: newTotal }

      await sql`
        UPDATE attempts SET
          feedback_json = ${JSON.stringify(newFeedback)}::jsonb,
          total_score = ${newTotal}, percentage = ${newPct}, updated_at = NOW()
        WHERE id = ${attemptId}
      `

      return respond(200, {
        appeal_upheld: appealResult.appeal_upheld,
        examiner_response: appealResult.examiner_response,
        new_scored_marks: newMarks,
        updated_feedback: newFeedback,
      })
    }

    // DELETE ?id=X
    if (method === 'DELETE' && attemptId) {
      await sql`DELETE FROM analytics WHERE attempt_id = ${attemptId}`
      await sql`DELETE FROM attempts WHERE id = ${attemptId} AND user_id = ${userId}`
      return respond(200, { ok: true })
    }

    return respond(404, { error: `No handler for ${method} action=${action}` })
  } catch (e) {
    console.error('attempts error:', e.message)
    return respond(500, { error: e.message })
  }
}
