# TestPilot — AI-Powered Exam Practice

A full-stack web app for generating personalised exams from your study materials, with AI marking, step-by-step feedback, and performance analytics.

---

## Stack

| Layer | Tech |
|---|---|
| Frontend | React 18 + Vite + Tailwind |
| Backend | Netlify Functions (serverless) |
| Database | Neon.tech (PostgreSQL) |
| AI | Google Gemini 1.5 Flash |
| Auth | Netlify Identity |
| Hosting | Netlify |

---

## Quick Start (Local Dev)

### Prerequisites
- Node.js 18+
- Netlify CLI: `npm install -g netlify-cli`
- A [Neon.tech](https://neon.tech) account (free tier is fine)
- A [Google AI Studio](https://aistudio.google.com) API key (free)

### 1. Clone & install

```bash
git clone <your-repo-url> testpilot
cd testpilot

# Install all deps (root installs function deps, frontend installs its own)
npm install
cd frontend && npm install && cd ..
```

### 2. Set up the database

1. Go to [console.neon.tech](https://console.neon.tech) and create a new project called `testpilot`
2. Open the SQL Editor and paste the contents of `db/schema.sql`
3. Click **Run** — this creates all tables, indexes, and triggers
4. Copy your connection string from **Connection Details**

### 3. Configure environment variables

```bash
cp .env.example .env
# Edit .env and fill in:
# - DATABASE_URL  (from Neon)
# - GEMINI_API_KEY (from Google AI Studio)
# - URL=http://localhost:8888
```

### 4. Enable Netlify Identity (local)

```bash
netlify login
netlify link   # or: netlify init
netlify dev    # starts everything on http://localhost:8888
```

On first run, go to your Netlify dashboard → Site Settings → Identity → **Enable Identity**.

### 5. Open the app

Navigate to `http://localhost:8888`. Sign up for an account, create a session, upload a PDF, and generate your first exam.

---

## Deploying to Netlify

### 1. Push to GitHub

```bash
git init
git add .
git commit -m "Initial TestPilot commit"
git remote add origin https://github.com/YOUR_USERNAME/testpilot.git
git push -u origin main
```

### 2. Connect to Netlify

1. Go to [app.netlify.com](https://app.netlify.com) → **Add new site** → **Import from Git**
2. Select your GitHub repo
3. Build settings are auto-detected from `netlify.toml`:
   - Base directory: `frontend`
   - Build command: `npm run build`
   - Publish directory: `dist`

### 3. Add environment variables

In **Site Settings → Environment Variables**, add:
- `DATABASE_URL` — your Neon connection string
- `GEMINI_API_KEY` — your Google Gemini key
- `URL` — your Netlify site URL (e.g. `https://testpilot.netlify.app`)

### 4. Enable Netlify Identity

In **Site Settings → Identity → Enable Identity**. Under **Registration**, choose **Invite only** or **Open** depending on your needs.

### 5. Deploy

Trigger a deploy from the Netlify dashboard or push a commit. Done!

---

## Project Structure

```
testpilot/
├── frontend/                    # React SPA
│   ├── src/
│   │   ├── components/
│   │   │   ├── sidebar/         # Session sidebar
│   │   │   ├── session/         # Session workspace + settings
│   │   │   ├── exam/            # Exam UI, timer, review, open book
│   │   │   ├── editor/          # Rich LaTeX math editor
│   │   │   ├── analytics/       # Analytics dashboard
│   │   │   └── ui/              # Shared UI (empty states etc.)
│   │   ├── hooks/               # useTimer
│   │   ├── lib/                 # store.js, api.js, utils.js
│   │   ├── pages/               # AuthScreen
│   │   └── styles/              # globals.css (design tokens)
│   ├── index.html
│   ├── vite.config.js
│   └── package.json
│
├── netlify/functions/           # Serverless backend
│   ├── _auth.js                 # JWT auth middleware
│   ├── _db.js                   # Neon DB connection
│   ├── auth-sync.js             # POST /api/auth/sync
│   ├── sessions.js              # CRUD + files/exams/analytics sub-routes
│   ├── upload.js                # POST /api/upload (multipart)
│   ├── files.js                 # DELETE /api/sessions/:id/files/:id
│   ├── exams-generate.js        # POST /api/exams/generate (Gemini)
│   ├── attempts.js              # Attempt lifecycle + AI marking
│   ├── analytics.js             # GET /api/analytics (global)
│   └── package.json
│
├── db/
│   └── schema.sql               # Full Postgres schema
│
├── netlify.toml                 # Build + redirect config
├── .env.example                 # Environment variable template
└── README.md
```

---

## Features

### Sessions
- Create, rename, delete, duplicate sessions
- Each session holds: files, instructions, exams, attempts, analytics
- Right-click context menu on session tiles

### File Upload
- Drag-and-drop or click to upload
- Supports PDF, Word (.docx), plain text, images
- Automatic text extraction and formula detection
- Formulas surfaced in open-book sidebar during exams

### Exam Generation (Gemini AI)
- Configure: question count, difficulty, topic focus, marks, timing
- Toggle: open book mode, timer, auto-submit, marking strictness
- AI reads your uploaded material and generates curriculum-aligned questions
- Full LaTeX support for mathematical content
- Questions weighted toward methods used in uploaded notes

### Rich Math Editor
- Textarea-based input with live LaTeX preview
- Auto-expansion: typing `sin ` → `\sin`, `frac ` → `\frac{}{}`
- Smart backspace: deletes full LaTeX commands as tokens
- Auto-closing brackets: `(` → `()`
- Quick-insert toolbar: fractions, integrals, Greek letters, etc.
- Graceful syntax error handling (never breaks)

### Timer
- Configurable countdown with pause/resume
- Visual ring progress indicator
- Warning states at 25% and 10% remaining
- Auto-submit on expiry (optional)
- Pauses on tab/window switch (autosave)

### Open Book Mode
- Sidebar shows all formulas/theorems extracted from uploaded files
- Full-text search across all formulas
- KaTeX rendered display

### AI Marking (Gemini)
- Step-by-step mark allocation (method marks + accuracy marks)
- Per-question feedback: what was right, what was wrong
- Misconception identification
- Alternative valid approaches (if enabled)
- Overall examiner comment
- Grade label: A*, A, B, C, D, U

### Review Mode
- Inline tick/cross per question
- Expandable per-step feedback
- Reveal marking scheme button
- Weak/strong topic identification
- Generate next exam from weak topics

### Analytics
- Per-session and global views
- Accuracy by topic (bar chart)
- Score trend over time (line chart)
- Performance by difficulty
- Exam count, average grade, best score

---

## Customisation Notes

### File Storage
The upload function currently stores a truncated base64 stub in the DB column. For production:
1. Replace `storeFile()` in `netlify/functions/upload.js` with your storage provider
2. Recommended: [Cloudflare R2](https://developers.cloudflare.com/r2/), [Supabase Storage](https://supabase.com/storage), or [AWS S3](https://aws.amazon.com/s3/)
3. Return a signed URL and store that as `storage_url`

### Gemini Model
The functions use `gemini-1.5-flash-latest`. You can switch to:
- `gemini-1.5-pro-latest` — higher quality, slower, higher cost
- `gemini-2.0-flash-exp` — latest experimental flash model

### Auth
Netlify Identity handles registration, login, and JWT issuance. For SSO/OAuth, enable providers in Site Settings → Identity → External Providers.

---

## License

MIT — use freely, attribution appreciated.
