const { requireAuth, respond, cors } = require('./_auth')
const { getDb } = require('./_db')
const { GoogleGenerativeAI } = require('@google/generative-ai')
const { v4: uuidv4 } = require('uuid')

async function getDbUser(sql, netlifyId) {
  const [u] = await sql`SELECT id FROM users WHERE netlify_id = ${netlifyId}`
  if (!u) throw new Error('User not found')
  return u.id
}

const EXAM_GENERATION_PROMPT = (context, instructions, settings) => `
You are an expert exam setter for academic subjects. Generate a high-quality exam based on the provided study materials.

## Study Material Content:
${context}

## Instructions from student:
${instructions || 'None provided.'}

## Exam Parameters:
- Number of questions: ${settings.numQuestions || 5}
- Difficulty: ${settings.difficulty || 'medium'}
- Topic focus: ${settings.topicFocus || 'all topics in material'}
- Total marks: ${settings.examLength?.type === 'marks' ? settings.examLength.value : 'determine from questions'}
- Marking strictness: ${settings.markingStrictness || 'standard'}
- Allow alternative methods: ${settings.allowAlternatives ? 'yes' : 'no'}

## Rules:
1. Questions MUST be based on content in the study materials
2. Prefer methods and notation consistent with the uploaded material
3. Use LaTeX for all mathematical expressions (wrap in $...$ for inline, $$...$$ for display)
4. Each question must have a detailed step-by-step marking scheme
5. Include method marks (M) and accuracy marks (A) separately
6. Questions should vary in difficulty within the specified range
7. Extract the key topics/methods being tested for each question

## Output Format:
Respond with ONLY valid JSON, no markdown, no explanation. Structure:

{
  "title": "string — descriptive exam title",
  "total_marks": number,
  "metadata": {
    "topics": ["topic1", "topic2"],
    "subject": "string",
    "level": "string e.g. A-Level, GCSE, Undergraduate"
  },
  "questions": [
    {
      "id": "q1",
      "question": "string — question text with LaTeX math",
      "marks": number,
      "difficulty": "easy|medium|hard",
      "topics": ["topic"],
      "expected_methods": ["method description 1", "method description 2"],
      "marking_scheme": "string — detailed hidden marking scheme with LaTeX, step by step with M/A marks labeled",
      "model_answer": "string — full worked solution in LaTeX"
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
    const userId = await getDbUser(sql, authUser.netlifyId)

    const body = JSON.parse(event.body || '{}')
    const { sessionId, fileIds = [], instructions, settings = {}, fromAttemptId } = body

    if (!sessionId) return respond(400, { error: 'sessionId required' })
    if (!process.env.GEMINI_API_KEY) return respond(500, { error: 'GEMINI_API_KEY not configured' })

    // Verify session
    const [session] = await sql`SELECT * FROM sessions WHERE id = ${sessionId} AND user_id = ${userId}`
    if (!session) return respond(403, { error: 'Session not found' })

    // Get file content
    let fileTexts = []
    if (fileIds.length > 0) {
      const files = await sql`
        SELECT name, extracted_text FROM files
        WHERE id = ANY(${fileIds}::uuid[]) AND session_id = ${sessionId}
      `
      fileTexts = files.map(f => `### ${f.name}\n${(f.extracted_text || '').slice(0, 8000)}`)
    } else {
      // Use all session files
      const files = await sql`
        SELECT name, extracted_text FROM files WHERE session_id = ${sessionId} AND user_id = ${userId}
      `
      fileTexts = files.map(f => `### ${f.name}\n${(f.extracted_text || '').slice(0, 8000)}`)
    }

    // If generating from weak topics, add context
    let weakTopicContext = ''
    if (fromAttemptId) {
      const [attempt] = await sql`SELECT feedback_json FROM attempts WHERE id = ${fromAttemptId}`
      if (attempt?.feedback_json?.weak_topics?.length) {
        weakTopicContext = `\n\nThis exam is a follow-up. Focus specifically on these weak areas: ${attempt.feedback_json.weak_topics.join(', ')}`
      }
    }

    const context = fileTexts.join('\n\n---\n\n') || 'No study material provided — generate general questions based on the topic focus.'
    const prompt = EXAM_GENERATION_PROMPT(context + weakTopicContext, instructions, settings)

    // Call Gemini
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY)
    const model = genAI.getGenerativeModel({
      model: 'gemini-1.5-flash-latest',
      generationConfig: {
        temperature: 0.7,
        maxOutputTokens: 8192,
        responseMimeType: 'application/json',
      }
    })

    const result = await model.generateContent(prompt)
    const responseText = result.response.text()

    let examData
    try {
      examData = JSON.parse(responseText)
    } catch {
      // Try to extract JSON from response
      const match = responseText.match(/\{[\s\S]*\}/)
      if (!match) throw new Error('Failed to parse exam JSON from Gemini response')
      examData = JSON.parse(match[0])
    }

    if (!examData.questions?.length) throw new Error('No questions generated')

    // Ensure each question has an ID
    examData.questions = examData.questions.map((q, i) => ({
      ...q,
      id: q.id || `q${i + 1}`,
    }))

    // Store exam in DB (without marking scheme in questions_json for security)
    const questionsForStorage = examData.questions.map(q => ({
      ...q,
      marking_scheme: undefined, // hidden
      model_answer: undefined,
    }))

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
        ${sessionId}, ${userId},
        ${examData.title},
        ${instructions || ''},
        ${JSON.stringify(settings)},
        ${JSON.stringify(questionsForStorage)},
        ${JSON.stringify(markingSchemesForStorage)},
        ${JSON.stringify(examData.metadata || {})},
        ${examData.total_marks || 0},
        ${settings.timerEnabled ? settings.timerDuration : null}
      )
      RETURNING id, title, total_marks, duration_minutes, metadata_json, questions_json, settings_json, created_at
    `

    return respond(201, exam)
  } catch (e) {
    console.error('exam generation error:', e)
    return respond(500, { error: e.message || 'Exam generation failed' })
  }
}
