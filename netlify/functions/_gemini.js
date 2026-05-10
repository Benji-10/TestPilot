const GEMINI_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-lite-preview:generateContent'

function robustJsonParse(text) {
  // 1. Strip markdown fences
  let clean = text
    .replace(/^```json\s*/im, '')
    .replace(/^```\s*/im, '')
    .replace(/```\s*$/im, '')
    .trim()

  // 2. Try direct parse first
  try { return JSON.parse(clean) } catch {}

  // 3. Fix common Gemini JSON escape issues:
  //    - Unescaped backslashes in LaTeX (e.g. \frac → \\frac inside JSON strings)
  //    - Unescaped newlines inside strings
  //    - Trailing commas
  let fixed = clean
    // Fix unescaped backslashes that aren't already escaped or part of valid escape sequences
    .replace(/\\(?!["\\/bfnrtu])/g, '\\\\')
    // Fix unescaped newlines inside JSON strings
    .replace(/("(?:[^"\\]|\\.)*")|(\n)/g, (match, str, nl) => str ? str : '\\n')
    // Remove trailing commas before } or ]
    .replace(/,(\s*[}\]])/g, '$1')

  try { return JSON.parse(fixed) } catch {}

  // 4. Extract outermost JSON object using bracket matching
  let depth = 0, start = -1
  for (let i = 0; i < clean.length; i++) {
    if (clean[i] === '{') { if (depth === 0) start = i; depth++ }
    else if (clean[i] === '}') { depth--; if (depth === 0 && start !== -1) {
      try { return JSON.parse(clean.slice(start, i + 1)) } catch {}
    }}
  }

  throw new Error(`Could not parse Gemini response as JSON. First 200 chars: ${text.slice(0, 200)}`)
}

async function callGemini(prompt, { temperature = 0.7, maxTokens = 12000 } = {}) {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) throw new Error('GEMINI_API_KEY not configured')

  const res = await fetch(`${GEMINI_URL}?key=${apiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        temperature,
        maxOutputTokens: maxTokens,
        responseMimeType: 'application/json',
      },
    }),
  })

  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Gemini API error ${res.status}: ${err.slice(0, 300)}`)
  }

  const data = await res.json()
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text
  if (!text) throw new Error('Empty response from Gemini')

  return robustJsonParse(text)
}

module.exports = { callGemini }
