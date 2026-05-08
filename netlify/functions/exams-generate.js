const { requireAuth, respond, cors } = require('./_auth')
const { getDb } = require('./_db')
const { GoogleGenerativeAI } = require('@google/generative-ai')

async function getDbUser(sql, netlifyId, email) {
  await sql`
    INSERT INTO users (netlify_id, email) VALUES (${netlifyId}, ${email})
    ON CONFLICT (netlify_id) DO UPDATE SET email = EXCLUDED.email
  `
  const [u] = await sql`SELECT id FROM users WHERE netlify_id = ${netlifyId}`
  return u.id
}

const EXAM_GENERATION_PROMPT = (context, instructions, settings) => `
You are an expert exam setter. Generate a high-quality exam based on the provided study materials.

## Study Material:
${context}

## Student Instructions:
${instructions || 'None.'}

## Parameters:
- Questions: ${settings.numQuestions || 5}
- Difficulty: ${settings.difficulty || 'medium'}
- Topic focus: ${settings.topicFocus || 'all topics'}
- Total marks: ${settings.examLength?.type === 'marks' ? settings.examLength.value : 'auto'}
- Allow alternative methods: ${settings.allowAlternatives ? 'yes' : 'no'}

## Rules:
1. Base questions on the study material content
2. Use LaTeX for ALL math: inline $x^2$ and display $$\\int_0^1 x\\,dx$$
3. Provide detailed step-by-step marking schemes with M (method) and A (accuracy) marks
4. Vary difficulty within the specified level

Respond with ONLY valid JSON, no markdown fences:
{
  "title": "string",
  "total_marks": number,
  "metadata": { "topics": ["string"], "subject": "string", "level": "string" },
  "questions": [
    {
      "id": "q1",
      "question": "string with LaTeX",
      "marks": number,
      "difficulty": "easy|medium|hard",
      "topics": ["string"],
      "expected_methods": ["string"],
      "marking_scheme": "detailed step-by-step with M/A marks",
      "model_answer": "full worked solution"
    }
  ]
}
`

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return cors()
  if (event.httpMethod !== 'POST') return respond(405, { error: 'Method not allowed' })

  try {
    const authUser = await requireAuth(event)
    const sql = getDb()
    const userId = await getDbUser(sql, authUser.netlifyId, authUser.email)

    const body = JSON.parse(event.body || '{}')
    const { sessionId, fileIds = [], instructions, settings = {}, fromAttemptId } = body

    if (!sessionId) return respond(400, { error: 'sessionId required' })
    if (!process.env.GEMINI_API_KEY) return respond(500, { error: 'GEMINI_API_KEY not configured' })

    const [session] = await sql`SELECT * FROM sessions WHERE id = ${sessionId} AND user_id = ${userId}`
    if (!session) return respond(403, { error: 'Session not found' })

    // Get file content
    const files = fileIds.length > 0
      ? await sql`SELECT name, extracted_text FROM files WHERE id = ANY(${fileIds}::uuid[]) AND session_id = ${sessionId}`
      : await sql`SELECT name, extracted_text FROM files WHERE session_id = ${sessionId} AND user_id = ${userId}`

    const fileTexts = files.map(f => `### ${f.name}\n${(f.extracted_text || '').slice(0, 8000)}`)

    let weakTopicContext = ''
    if (fromAttemptId) {
      const [attempt] = await sql`SELECT feedback_json FROM attempts WHERE id = ${fromAttemptId}`
      if (attempt?.feedback_json?.weak_topics?.length) {
        weakTopicContext = `\n\nFocus on these weak areas: ${attempt.feedback_json.weak_topics.join(', ')}`
      }
    }

    const context = fileTexts.join('\n\n---\n\n') || 'No material uploaded — use topic focus to generate questions.'
    const prompt = EXAM_GENERATION_PROMPT(context + weakTopicContext, instructions, settings)

    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY)
    const model = genAI.getGenerativeModel({
      model: 'gemini-1.5-flash-latest',
      generationConfig: { temperature: 0.7, maxOutputTokens: 8192, responseMimeType: 'application/json' }
    })

    const result = await model.generateContent(prompt)
    const responseText = result.response.text()

    let examData
    try {
      examData = JSON.parse(responseText)
    } catch {
      const match = responseText.match(/\{[\s\S]*\}/)
      if (!match) throw new Error('Failed to parse Gemini response as JSON')
      examData = JSON.parse(match[0])
    }

    if (!examData.questions?.length) throw new Error('No questions in generated exam')

    examData.questions = examData.questions.map((q, i) => ({ ...q, id: q.id || `q${i + 1}` }))

    const questionsForStorage = examData.questions.map(({ marking_scheme, model_answer, ...q }) => q)
    const markingSchemesForStorage = examData.questions.map(q => ({
      id: q.id,
      marking_scheme: q.marking_scheme,
      model_answer: q.model_answer,
    }))

    const [exam] = await sql`
      INSERT INTO exams (
        session_id, user_id, title, instructions, settings_json,
        questions_json, marking_scheme_json, metadata_json, total_marks, duration_minutes
      ) VALUES (
        ${sessionId}, ${userId}, ${examData.title}, ${instructions || ''},
        ${JSON.stringify(settings)},
        ${JSON.stringify(questionsForStorage)},
        ${JSON.stringify(markingSchemesForStorage)},
        ${JSON.stringify(examData.metadata || {})},
        ${examData.total_marks || 0},
        ${settings.timerEnabled ? settings.timerDuration : null}
      )
      RETURNING id, title, total_marks, duration_minutes, metadata_json, questions_json, settings_json, session_id, created_at
    `

    return respond(201, exam)
  } catch (e) {
    console.error('exam generation error:', e.message)
    return respond(500, { error: e.message || 'Exam generation failed' })
  }
}
