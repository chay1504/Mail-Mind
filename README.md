# MailMind

MailMind is a Gmail Intelligence Platform built for the Repeatless AI Automation Executive assignment. It connects Gmail through OAuth, syncs email data into Supabase, summarizes and categorizes threads with AI, and provides a source-backed chat assistant over the user's email knowledge base.

The system is intentionally free-tier friendly:

- Frontend and thin backend: Next.js
- Automation engine: local n8n
- Database and vector search: Supabase free tier
- Primary AI model: Google Gemini API
- Secondary AI model: NVIDIA NIM API

## Current Scope

Implemented:

- Gmail OAuth start and callback routes
- Gmail API message sync using `users.messages.list` and `users.messages.get`
- Exponential backoff for quota and transient Gmail API failures
- Supabase schema with thread, message, chunk, token, and AI interaction tables
- pgvector retrieval function for source-backed email search
- Gemini-powered thread summarization, agent answers, and draft generation
- NVIDIA NIM-powered category hinting
- AI chat UI with source display
- Draft assistant for compose/reply workflows
- Importable n8n workflow JSON exports
- Architecture and setup documentation

Credential-dependent:

- Real Gmail OAuth client
- Supabase project keys
- Gemini API key
- NVIDIA NIM API key

## Local Setup

1. Install dependencies:

```bash
npm install
```

2. Create your environment file:

```bash
copy .env.example .env.local
```

3. Create a free Supabase project and run:

```sql
-- Paste and execute supabase/schema.sql in the Supabase SQL editor.
```

4. Create a Google OAuth client:

- Application type: Web application
- Authorized redirect URI: `http://localhost:3000/api/auth/google/callback`
- Required scopes are listed in `src/lib/google.ts`

5. Add credentials to `.env.local`.

6. Run locally:

```bash
npm run dev
```

Open `http://localhost:3000`.

## n8n Setup

Your local n8n is expected at `http://localhost:5678`.

Import these workflow files manually in n8n:

- `n8n/mailmind-scheduled-sync.json`
- `n8n/mailmind-process-thread-webhook.json`

Set these environment variables for n8n if running through Docker:

```bash
MAILMIND_APP_URL=http://host.docker.internal:3000
MAILMIND_USER_ID=<your user_profiles.id from Supabase>
```

The app also works without n8n by using the UI sync button. n8n is used as the automation layer for scheduled sync and webhook-triggered AI processing.

## Folder Structure

```text
src/app
  API routes and the main product UI
src/lib
  Gmail, Google OAuth, AI, RAG, Supabase, and environment helpers
supabase
  Database schema and pgvector RPC
n8n
  Importable local n8n workflow JSON exports
```

## Useful Commands

```bash
npm run lint
npm run build
npm run dev
```

## Deployment

The lowest-friction free deployment is Vercel for the Next.js app and Supabase free tier for the database.

For deployment, update:

- `NEXT_PUBLIC_APP_URL` to the deployed URL
- Google OAuth redirect URI to `https://your-domain/api/auth/google/callback`
- `GOOGLE_REDIRECT_URI` to the deployed callback URL

If using local n8n, the deployed app cannot call your local n8n. For a real production deployment, n8n must be hosted somewhere reachable by the app.
