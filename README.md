# AI Visibility Report

A full-stack MVP that helps small businesses understand how AI systems discover and understand them.

## What it does

1. Business owner fills in a form (name, website, category, city, services, optional competitors)
2. App scrapes the website, extracts signals, runs deterministic scoring
3. Calls an LLM **once** for a positioning summary + one content asset draft
4. Displays a polished report with scores, findings, and prioritized recommendations

---

## File Structure

```
smbAnalyzer/
├── app/
│   ├── layout.tsx               # Root layout
│   ├── page.tsx                 # Landing page
│   ├── globals.css
│   ├── create/
│   │   └── page.tsx             # Report creation form page
│   ├── report/[id]/
│   │   └── page.tsx             # Report display page
│   └── api/
│       └── reports/
│           ├── route.ts         # POST /api/reports
│           └── [id]/
│               ├── route.ts     # GET /api/reports/[id]
│               └── process/
│                   └── route.ts # POST /api/reports/[id]/process
├── components/
│   ├── ui/
│   │   ├── Badge.tsx
│   │   ├── ScoreRing.tsx        # Circular score gauge
│   │   └── ScoreBar.tsx         # Horizontal score bar
│   ├── forms/
│   │   └── ReportForm.tsx       # Main creation form
│   └── report/
│       ├── ReportView.tsx       # Polling wrapper
│       ├── ReportLoading.tsx    # Progress / loading state
│       ├── ReportError.tsx      # Error state
│       └── ReportComplete.tsx   # Full report display
├── lib/
│   ├── types.ts                 # All shared TypeScript types
│   ├── utils.ts                 # cn(), score helpers
│   ├── llm/
│   │   ├── index.ts             # getLlmProvider() factory
│   │   ├── openai-compatible.ts # OpenAI / Groq / OpenRouter
│   │   ├── anthropic.ts         # Anthropic native API
│   │   └── mock.ts              # Mock for dev (MOCK_LLM=true)
│   ├── prompts/
│   │   └── report-summary.ts   # LLM prompt templates
│   ├── analysis/
│   │   ├── scraper.ts           # Website fetcher + HTML parser
│   │   ├── scoring.ts           # Deterministic scoring engine
│   │   ├── llm-summarizer.ts   # Single LLM call wrapper
│   │   └── pipeline.ts          # Full orchestration
│   └── supabase/
│       ├── server.ts            # Server-side client
│       ├── client.ts            # Browser client
│       └── database.types.ts   # DB type definitions
├── supabase/
│   ├── migrations/
│   │   └── 001_initial_schema.sql
│   └── seed.sql                 # Sample "Blue Ridge HVAC" report
├── .env.example
├── package.json
├── tailwind.config.ts
└── next.config.ts
```

---

## Setup Instructions

### 1. Install dependencies

```bash
npm install
```

### 2. Configure environment variables

```bash
cp .env.example .env.local
```

Edit `.env.local`:

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# LLM — cheapest option: Groq (free tier available at console.groq.com)
LLM_PROVIDER=openai
LLM_API_KEY=gsk_your_groq_api_key
LLM_BASE_URL=https://api.groq.com/openai/v1
LLM_MODEL=llama3-8b-8192

# OR use mock mode for UI dev (no LLM costs at all)
MOCK_LLM=true

NEXT_PUBLIC_APP_URL=http://localhost:3000
```

### 3. Set up Supabase

1. Create a project at [supabase.com](https://supabase.com)
2. In the SQL Editor, run the contents of `supabase/migrations/001_initial_schema.sql`
3. Optionally, run `supabase/seed.sql` to load the sample "Blue Ridge HVAC" report
4. Copy your project URL, anon key, and service role key into `.env.local`

### 4. Run the development server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

### 5. View sample report

If you ran the seed SQL, visit:
```
http://localhost:3000/report/22222222-2222-2222-2222-222222222222
```

---

## Switching LLM Providers

Change only environment variables — zero code changes required.

| Provider | LLM_PROVIDER | LLM_BASE_URL | LLM_MODEL |
|----------|-------------|--------------|-----------|
| Groq (free tier) | `openai` | `https://api.groq.com/openai/v1` | `llama3-8b-8192` |
| OpenAI | `openai` | `https://api.openai.com/v1` | `gpt-4o-mini` |
| OpenRouter | `openai` | `https://openrouter.ai/api/v1` | `mistralai/mistral-7b-instruct` |
| Anthropic | `anthropic` | *(leave blank)* | `claude-haiku-4-5-20251001` |
| Local Ollama | `openai` | `http://localhost:11434/v1` | `llama3` |
| Mock (free) | *(any)* | *(any)* | *(any)* — set `MOCK_LLM=true` |

---

## Architecture Decisions

- **No LLM for scoring**: scoring is 100% deterministic rule-based logic in `lib/analysis/scoring.ts`
- **One LLM call per report**: called only in `lib/analysis/llm-summarizer.ts`
- **LLM receives structured JSON**, not raw HTML
- **Async processing**: report creation is instant; analysis runs in a fire-and-forget request; UI polls every 3s
- **Graceful LLM fallback**: if the LLM call fails, a rule-based fallback summary is used so the report still renders
- **No auth for MVP**: all Supabase RLS policies are open; add auth later

---

## TODO / Next Steps

- [ ] Add real competitor comparison UI
- [ ] Add Google Business Profile analysis
- [ ] Implement Supabase Auth for saved reports
- [ ] Move processing to a proper queue (Inngest, trigger.dev)
- [ ] Add PDF export
- [ ] Add competitor gap analysis visualization
- [ ] Rate limiting on report creation endpoint
