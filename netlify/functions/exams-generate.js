const { requireAuth, respond, cors } = require('./_auth')
const { getDb } = require('./_db')
const { callGemini } = require('./_gemini')

async function getDbUser(sql, netlifyId, email) {
  await sql`INSERT INTO users (netlify_id, email) VALUES (${netlifyId}, ${email}) ON CONFLICT (netlify_id) DO UPDATE SET email = EXCLUDED.email`
  const [u] = await sql`SELECT id FROM users WHERE netlify_id = ${netlifyId}`
  return u.id
}

const EXAM_PROMPT = (context, instructions, settings) => `
You are an expert exam setter. Generate a rigorous exam based on the provided study materials.

## Study Material:
${context}

## Student Instructions:
${instructions || 'None.'}

## Parameters:
- Number of questions: ${settings.numQuestions || 5}
- Difficulty: ${settings.difficulty || 'medium'}
- Topic focus: ${settings.topicFocus || 'all topics in the material'}
- Total marks: ${settings.examLength?.type === 'marks' ? settings.examLength.value : 'distribute sensibly across questions'}
- Allow alternative methods: ${settings.allowAlternatives ? 'yes' : 'no'}

## Critical rules:
1. ONLY use definitions, theorems, notation, and vocabulary that appear in the study material. Do not introduce concepts not covered.
2. Use LaTeX for ALL mathematics. Inline: $x^2$. Display: $$\\sup_D f$$
3. Do NOT write "Q1" or "Question 1" in the question text — the UI numbers them automatically.
4. Marks per question should reflect complexity. A straightforward result = 1-2 marks. A proof = 3-6 marks. Avoid making everything 1 mark.
5. The marking scheme must be step-by-step. Each step should name what is being shown AND show the actual mathematics for that step (e.g. "Show $-M$ is a lower bound for $-S$: since $x \\leq M$ for all $x \\in S$, we have $-x \\geq -M$, so $-M$ is a lower bound for $-S$").
6. For yes/no or true/false questions, always require justification in the marking scheme and include a worked example or counterexample in the model answer.
7. Extract open-book reference material: anything in the source marked as a definition, theorem, lemma, proposition, or corollary — extract verbatim with its name.

Respond with ONLY valid JSON, no markdown:
{
  "title": "string — concise descriptive title e.g. 'Supremum and Infimum' not 'Practice Exam 1'",
  "total_marks": number,
  "metadata": {
    "topics": ["string"],
    "subject": "string",
    "level": "string"
  },
  "open_book_items": [
    {
      "name": "string — e.g. 'Definition 2.1 (Supremum)'",
      "latex": "string — the full statement in LaTeX",
      "type": "definition|theorem|lemma|proposition|corollary|formula"
    }
  ],
  "questions": [
    {
      "id": "q1",
      "question": "string — question text with LaTeX, no 'Q1' prefix",
      "marks": number,
      "difficulty": "easy|medium|hard",
      "topics": ["string — match vocabulary from source"],
      "expected_methods": ["string — describe expected approach using source vocabulary"],
      "marking_scheme": "string — step by step, each step shows BOTH what to show AND the actual maths for it",
      "model_answer": "string — complete worked solution in LaTeX showing every step"
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

    const [session] = await sql`SELECT * FROM sessions WHERE id = ${sessionId} AND user_id = ${userId}`
    if (!session) return respond(403, { error: 'Session not found' })

    const files = fileIds.length > 0
      ? await sql`SELECT name, extracted_text FROM files WHERE id = ANY(${fileIds}::uuid[]) AND session_id = ${sessionId}`
      : await sql`SELECT name, extracted_text FROM files WHERE session_id = ${sessionId} AND user_id = ${userId}`

    const fileTexts = files.map(f => `### ${f.name}\n${(f.extracted_text || '').slice(0, 8000)}`)

    let weakTopicContext = ''
    if (fromAttemptId) {
      const [attempt] = await sql`SELECT feedback_json FROM attempts WHERE id = ${fromAttemptId}`
      if (attempt?.feedback_json?.weak_topics?.length) {
        weakTopicContext = `\n\nThis is a follow-up exam. Focus on these weak areas: ${attempt.feedback_json.weak_topics.join(', ')}`
      }
    }

    const context = fileTexts.join('\n\n---\n\n') || 'No material uploaded.'
    const examData = await callGemini(EXAM_PROMPT(context + weakTopicContext, instructions, settings), { temperature: 0.7 })

    if (!examData.questions?.length) throw new Error('No questions generated')
    examData.questions = examData.questions.map((q, i) => ({ ...q, id: q.id || `q${i + 1}` }))

    const questionsForStorage = examData.questions.map(({ marking_scheme, model_answer, ...q }) => q)
    const markingSchemesForStorage = examData.questions.map(q => ({
      id: q.id, marking_scheme: q.marking_scheme, model_answer: q.model_answer,
    }))
    const openBookItems = examData.open_book_items || []

    const [exam] = await sql`
      INSERT INTO exams (session_id, user_id, title, instructions, settings_json, questions_json, marking_scheme_json, metadata_json, total_marks, duration_minutes)
      VALUES (
        ${sessionId}, ${userId}, ${examData.title}, ${instructions || ''},
        ${JSON.stringify(settings)}, ${JSON.stringify(questionsForStorage)},
        ${JSON.stringify(markingSchemesForStorage)}, ${JSON.stringify({ ...examData.metadata, open_book_items: openBookItems } || {})},
        ${examData.total_marks || 0}, ${settings.timerEnabled ? settings.timerDuration : null}
      )
      RETURNING id, title, total_marks, duration_minutes, metadata_json, questions_json, settings_json, session_id, created_at
    `
    return respond(201, exam)
  } catch (e) {
    console.error('exam generation error:', e.message)
    return respond(500, { error: e.message })
  }
}
