# MailMind: Gmail Intelligence Platform

Live app: https://mail-mind-two.vercel.app  
GitHub repository: https://github.com/chay1504/Mail-Mind  
Assignment: Repeatless AI Automation Executive technical assessment

## 1. What This Product Is

MailMind is an AI-powered Gmail Intelligence Platform.

In normal language: it connects to a Gmail account, syncs emails into a database, understands those emails with AI, and gives the user a dashboard where they can:

- Review synced Gmail threads.
- See thread summaries.
- See email categories like newsletters, finance, jobs, notifications, work, and personal.
- Ask questions across their Gmail inbox.
- Get answers with email sources.
- Generate draft replies or new emails.
- Generate a newsletter digest that removes repeated stories.
- Use n8n workflows as the automation layer.

The goal is not just to build a Gmail reader. The goal is to show that the system can combine Gmail API, database design, vector search, AI reasoning, and automation into one product-like workflow.

## 2. The Honest OAuth Problem

This is the most important operational issue.

Right now, the Google OAuth app is configured for an external Gmail OAuth flow, but if the Google app is still in **Testing** mode, only emails added as **test users** in Google Cloud can connect.

That is why this happened:

1. You tried to connect Gmail.
2. Google showed an access/testing error.
3. You added your Gmail as a test user in Google Cloud.
4. Then the login worked.

Tomorrow, if a reviewer uses their own Gmail and that email is not listed as a test user, they may hit the same blocked OAuth screen.

### What Must Be Done For Any Gmail Account To Connect

There are three realistic options.

### Option A: Add The Reviewer As A Test User

This is the fastest option for the assignment.

Before submission, ask the reviewer which Gmail account they will use, then add it here:

Google Cloud Console -> Google Auth Platform / OAuth consent screen -> Audience -> Test users

This does not make the app public for everyone, but it lets the specific reviewer test the product.

Best for: assignment demo, interview review, short deadline.

### Option B: Publish The OAuth App To Production

This is required if you want any Google user to connect without being manually added as a test user.

However, MailMind uses Gmail scopes. Gmail scopes can be sensitive or restricted. Google states that apps requesting sensitive or restricted scopes require verification, and restricted scopes can require additional review and possibly a security assessment.

Official references:

- Google OAuth consent screen setup: https://developers.google.com/workspace/guides/configure-oauth-consent
- Gmail API scopes: https://developers.google.com/workspace/gmail/api/auth/scopes
- Restricted scope verification: https://developers.google.com/identity/protocols/oauth2/production-readiness/restricted-scope-verification
- Google API Services User Data Policy: https://developers.google.com/terms/api-services-user-data-policy

Best for: real production product.

Not ideal for: a 1-2 day hiring assignment, because verification can take time and may require policy pages, demo video, domain verification, and security review depending on scopes.

### Option C: Use A Controlled Demo Account

Create one Gmail account specifically for the demo, connect that account, sync data, and show the reviewer the working product from that account.

This avoids the reviewer needing to connect their own Gmail during the first review.

Best for: reducing demo risk.

My recommendation for this assignment:

- Add the expected reviewer Gmail as a test user if possible.
- Also prepare a connected demo Gmail account so the product can be shown even if OAuth blocks the reviewer.
- Be honest in the architecture document/interview: public Gmail access requires Google OAuth production verification.

## 3. Logout / Disconnect Requirement

You asked for a sign out or logout button so the connected Gmail can be disconnected.

Current status: **not implemented yet**.

What it should do:

- Clear the `mailmind_user_id` cookie.
- Optionally delete or revoke Gmail OAuth tokens.
- Return the UI to the disconnected state.
- Ideally provide two choices:
  - "Sign out from this browser" - clears local session only.
  - "Disconnect Gmail" - removes stored Gmail OAuth tokens from Supabase.

Why this matters:

- The current app can connect and sync Gmail, but a reviewer cannot easily disconnect from the UI.
- For a production-grade product, disconnect is required for trust.
- For an assignment demo, this is a clear next improvement to mention.

## 4. What We Have Built

### Frontend

The frontend is a Next.js dashboard.

It now has a guided workflow instead of a crowded control panel:

- Top explanation: what MailMind does.
- Step cards: Connect, Sync, Use AI.
- Metrics: total threads, processed threads, high-priority threads.
- Inbox list: synced email threads.
- Tabs:
  - Inbox review
  - Ask AI
  - Write email
  - News digest

The redesign was done because the original dashboard looked too raw and text-heavy. It had too many features crowded into one area, which made it hard for a beginner to understand what to click.

### Backend

The backend is implemented through Next.js API routes.

Main API areas:

- Google OAuth start route.
- Google OAuth callback route.
- Gmail sync route.
- Gmail thread list route.
- Gmail thread message route.
- Gmail send route.
- AI chat route.
- AI draft route.
- AI thread processing route.
- Newsletter digest route.

### Database

Supabase is used as the database.

It stores:

- User profiles.
- Gmail OAuth tokens.
- Gmail sync state.
- Email threads.
- Email messages.
- Email chunks for search.
- AI interaction records.

Supabase also supports `pgvector`, which is used for vector search over email chunks.

### AI

Two AI providers are used:

- Gemini: main reasoning, summarization, embeddings, drafting, chat answers.
- NVIDIA NIM: secondary model for category hinting.

Why both?

The assignment specifically requires Gemini as the primary model and NVIDIA NIM as a secondary model. Gemini is used for the heavier reasoning work. NVIDIA NIM is used as an additional classifier/hinting model so the system satisfies the secondary-model requirement without overcomplicating the product.

### Automation

n8n workflow JSON files exist in the repo:

- `n8n/mailmind-scheduled-sync.json`
- `n8n/mailmind-process-thread-webhook.json`

These are importable into n8n.

Current automation status: **prepared but not fully verified as active production automation**.

That means:

- The workflow files exist.
- The workflow design is valid at a high level.
- They are intended to call MailMind API routes.
- But they still need to be imported into your n8n instance and tested with real environment variables.

Important: the core product does work without n8n because the dashboard has a manual Sync button. n8n is the automation layer for scheduled/background execution.

## 5. Why These Technologies Were Chosen

### Next.js

Chosen because it gives frontend and backend API routes in one project.

Why that matters:

- Easier to deploy on Vercel.
- Faster to build.
- Free-tier friendly.
- Good for a hiring assignment where working delivery matters more than over-engineering.

### Vercel

Chosen because the project is Next.js and Vercel has a free Hobby tier.

Why that matters:

- Fast deployment.
- GitHub integration.
- Good demo URL.
- No rupee spend.

### Supabase

Chosen because it gives:

- Postgres database.
- Free tier.
- SQL editor.
- `pgvector` support.
- Good developer experience.

Why not just store emails in files?

Because the assignment evaluates database design and real-world architecture. Supabase gives a real database with relationships, indexes, and vector search.

### Gmail API

Chosen because the assignment requires Gmail API, not IMAP or SMTP.

The system uses OAuth 2.0 and Gmail API message endpoints.

### Gemini

Chosen because the assignment requires Google Gemini as the primary AI model.

Gemini is used for:

- Thread summaries.
- Chat answers.
- Draft emails.
- Embeddings.

### NVIDIA NIM

Chosen because the assignment requires a secondary free-tier model from NVIDIA NIM.

It is used for:

- Category hints.
- Model diversity.
- Showing that the system can orchestrate more than one AI provider.

### n8n

Chosen because your backend/automation strategy is based on n8n.

n8n is good for:

- Scheduled syncs.
- Webhook-based processing.
- Visual automation.
- Future integrations.

## 6. Core Architecture In Simple Terms

Think of the system like this:

1. The user connects Gmail.
2. Google gives MailMind permission through OAuth.
3. MailMind stores the user's Gmail token securely in Supabase.
4. The sync route asks Gmail for recent email messages.
5. Emails are normalized and saved into Supabase.
6. Email text is converted into searchable chunks.
7. Gemini creates embeddings for those chunks.
8. Threads are summarized and categorized.
9. The dashboard shows threads, categories, summaries, and messages.
10. When the user asks a question, the system searches relevant email chunks.
11. Gemini answers only from those email sources.
12. The UI shows the answer and the source emails.
13. n8n can call the same API routes automatically on a schedule or webhook.

## 7. Database Design

Main tables:

### `user_profiles`

Stores each connected Gmail user.

Important fields:

- `id`
- `email`
- `display_name`
- `avatar_url`

### `gmail_oauth_tokens`

Stores Gmail access and refresh tokens for a user.

Important fields:

- `user_id`
- `access_token`
- `refresh_token`
- `scope`
- `expiry_date`

This is what allows the app to keep syncing Gmail after OAuth.

### `gmail_sync_state`

Designed to store sync progress.

Important fields:

- `history_id`
- `last_full_sync_at`
- `last_incremental_sync_at`
- `next_page_token`

This supports future incremental sync and pagination.

### `email_threads`

Stores one Gmail conversation thread.

Important fields:

- `gmail_thread_id`
- `subject`
- `participants`
- `last_message_at`
- `thread_summary`
- `category`
- `priority`
- `key_facts`
- `message_count`

This table is important because the assignment requires threads to be first-class, not just individual emails.

### `email_messages`

Stores individual Gmail messages.

Important fields:

- `gmail_message_id`
- `gmail_thread_id`
- `label_ids`
- `sender`
- `recipients`
- `sent_at`
- `snippet`
- `plain_text`
- `html_text`
- `raw_headers`
- `message_summary`

The raw headers are needed for thread-aware replies because Gmail replies should preserve headers like `In-Reply-To` and `References`.

### `email_chunks`

Stores searchable email content.

Important fields:

- `content`
- `embedding`
- `search_document`
- source metadata like subject, sender, date, Gmail IDs

This powers the AI chat agent.

### `ai_interactions`

Designed to store prompts/responses for traceability.

## 8. AI Design

### Summarization

For each thread, the app tries to summarize the conversation using Gemini.

If AI is slow or unavailable, fallback processing still categorizes and summarizes enough for the product to stay usable.

This was added because during manual QA many synced emails stayed "Unprocessed." That made the app look incomplete. The fallback makes the demo more reliable.

### Categorization

Supported categories:

- Newsletters
- Job / Recruitment
- Finance
- Notifications
- Personal
- Work / Professional
- Other

The app uses AI where possible, and heuristic fallback rules when AI is slow.

Example:

- Emails mentioning payment, receipt, UPI, credited, debited -> Finance.
- Emails mentioning newsletter, digest, AINews, Rundown -> Newsletters.
- Emails mentioning job, internship, hiring, interview -> Job / Recruitment.
- Emails mentioning OTP, sign-in, login, verification -> Notifications.

This is not perfect, but it is practical and demo-safe.

### AI Chat Agent

The chat agent uses synced emails as the knowledge base.

The flow:

1. User asks a question.
2. The backend retrieves relevant email chunks.
3. If the question is category-based, it also retrieves sources from matching categories.
4. Gemini answers using only those sources.
5. The UI shows the answer and source emails.

This fixed a real QA issue:

Earlier, asking "What newsletters did I receive recently?" returned "not found" even though newsletters existed. The retrieval system now handles category-style questions better.

### Newsletter Deduplication

The newsletter digest feature:

- Finds newsletter emails from recent days.
- Asks Gemini to deduplicate and summarize.
- Falls back to a fast grouped digest if AI is slow.

This is important because the bonus feature must not feel broken during demo.

## 9. Gmail API Strategy

### OAuth

The app uses Google OAuth 2.0.

Current scopes include Gmail read/modify/compose/send related scopes and user profile scopes.

Important warning:

Because Gmail scopes are sensitive/restricted, public production access can require Google verification.

### Sync

The app syncs Gmail messages using Gmail API.

It fetches:

- Message IDs.
- Full message payload.
- Thread IDs.
- Labels.
- Headers.
- Sender/recipient metadata.
- Snippet/body.

### Pagination

The Gmail sync endpoint supports `nextPageToken`.

For demo stability, the UI currently syncs smaller batches. This avoids the dashboard feeling frozen while processing a large inbox.

### Rate Limiting

Gmail API calls are wrapped with exponential backoff for:

- `429`
- `500`
- `502`
- `503`
- `504`

This means temporary Gmail/API failures are retried instead of instantly crashing.

### Incremental Sync

The schema supports incremental sync through Gmail `historyId`, but full `users.history.list` incremental sync is still a future improvement.

Honest status: initial/batch sync works; production-grade incremental sync is designed but not fully completed.

## 10. n8n Automation Status

There are two n8n workflows.

### Scheduled Gmail Sync

File:

`n8n/mailmind-scheduled-sync.json`

What it does:

- Runs every 30 minutes.
- Calls MailMind `/api/gmail/sync`.
- Sends `x-mailmind-user-id` header.

Required environment variables:

- `MAILMIND_APP_URL`
- `MAILMIND_USER_ID`

### Process Thread Webhook

File:

`n8n/mailmind-process-thread-webhook.json`

What it does:

- Creates a webhook endpoint.
- Accepts a `threadId`.
- Calls MailMind `/api/ai/process`.
- Returns the result as JSON.

Required environment variables:

- `MAILMIND_APP_URL`
- `MAILMIND_USER_ID`

### Are Automations Working?

Brutal answer: **not confirmed end-to-end in active n8n**.

What is confirmed:

- Workflow JSON files exist.
- They point to valid MailMind API routes.
- The app API routes they call exist.
- Manual dashboard sync works.

What is not confirmed:

- The workflows are imported into your n8n instance.
- n8n has the correct environment variables.
- n8n can reach the deployed Vercel URL.
- The scheduled workflow has executed successfully from n8n.
- The webhook workflow has been triggered successfully from n8n.

What must be done before claiming "all automations are working":

1. Open n8n at `http://localhost:5678`.
2. Import both workflow JSON files.
3. Set:
   - `MAILMIND_APP_URL=https://mail-mind-two.vercel.app`
   - `MAILMIND_USER_ID=<user_profiles.id from Supabase>`
4. Run the scheduled sync workflow manually.
5. Confirm it returns success.
6. Trigger the webhook with:

```json
{
  "userId": "<user_profiles.id>",
  "threadId": "<email_threads.id>"
}
```

7. Confirm the response is JSON and the thread gets processed.

Until those steps are done, say:

> n8n workflows are prepared and importable, but active n8n execution still needs final verification.

## 11. What Was Manually Tested

Manual testing was done on the deployed app:

https://mail-mind-two.vercel.app

Additional local testing was done on June 18, 2026:

- Local MailMind app: `http://localhost:3000`
- Local n8n: `http://localhost:5678`
- ngrok inspector: `http://localhost:4040`
- Current ngrok public URL for n8n: `https://mckayla-handmade-jaime.ngrok-free.dev`

Current local process reality:

- `3000` is a Node/Next.js process serving MailMind.
- `5678` is n8n running through WSL.
- `4040` is ngrok's local inspector.
- ngrok is exposing `localhost:5678`, so the public ngrok URL points to n8n, not directly to the MailMind app.

Browser testing reality:

- The in-app browser can open the local and deployed MailMind pages.
- Both pages load correctly.
- In that testing browser, the app showed the disconnected state because no Gmail OAuth cookie existed there.
- The Chrome-extension browser path was not available because Google Chrome was not running and the Codex Chrome Extension was not installed in the selected Chrome profiles.
- Your Windows default browser appears to be Brave, but the available Chrome automation plugin does not control Brave.

Database/backend verification:

- Supabase has one connected profile for `chaitanyaseema1504@gmail.com`.
- Gmail OAuth token exists for that profile.
- Supabase currently contains synced Gmail data:
  - 51 threads
  - 55 messages
  - 55 chunks
- Local `/api/gmail/threads` returns 50 recent threads when tested with the connected user session cookie.
- Deployed `/api/gmail/threads` also returns 50 recent threads with the same connected user session cookie.

### Tested: Production Page Load

Result: working.

The deployed app loads and shows the MailMind dashboard.

### Tested: Gmail Connected State

Result: working for the test user.

The app loaded real synced Gmail data after OAuth was configured for the test Gmail.

### Tested: Sync Button

Initial problem:

- Sync felt like it was hanging.
- Status stayed on "Syncing..." too long.

Fix:

- Sync now processes a smaller batch.
- Button disables while syncing.
- Status message explains what is happening.
- After sync, categories and processed count update.

Observed result after fix:

- 50 threads visible.
- Processed count increased from 7 to 21.
- Categories like Finance and Newsletters appeared correctly.

### Tested: Thread List

Result: working.

Threads display subject, category, and message count.

Improvement made:

- Replaced "Unprocessed" with "Pending" because "Unprocessed" looked too raw and technical.

### Tested: Thread Message View

Initial problem:

- Newsletter messages displayed raw links, tracking text, and "View image" noise.

Fix:

- Message previews are now cleaned and shortened.

Result: better and more readable.

### Tested: AI Chat

Initial problem:

- Asking "What newsletters did I receive recently?" returned "not found" even though newsletters were visible.

Fix:

- Added category-aware retrieval.

Second problem found during June 18 local testing:

- Gemini free-tier quota returned a `429 RESOURCE_EXHAUSTED` error.
- The chat endpoint returned a 500 error instead of a usable answer.

Fix:

- Added a fallback path to source-backed chat.
- If Gemini quota is temporarily unavailable, the app now returns the most relevant synced email sources instead of crashing.

Result:

- The agent now lists actual newsletter sources and shows source references.
- Under Gemini quota exhaustion, local chat now returns HTTP 200 with a useful fallback answer and sources.

### Tested: Newsletter Digest

Initial problem:

- The digest feature did not visibly return an answer in a reasonable time.

Fix:

- Added fast fallback digest.

Result:

- The digest now returns a visible recent newsletter digest with sources.

### Tested: Compose / Reply

What worked:

- Compose tab appears.
- Reply mode exists.
- Recipient auto-fills from selected sender.
- Send button is guarded so empty recipient/subject/body cannot be sent.
- Draft API now has a fallback path when Gemini quota is exhausted.

Important warning:

- Sending was not clicked during testing because it would send a real Gmail email.
- Draft generation worked earlier, but during the final browser automation pass, the Generate Draft button did not reliably trigger in that browser session.
- The button was hardened with explicit button type, pointer handling, and draft in-flight state.

Honest status:

- Draft API exists.
- Draft UI exists.
- Earlier draft generation worked.
- Direct local draft API test returned HTTP 200 with a fallback professional draft when Gemini quota was unavailable.
- Final automated click test was unreliable.
- Before final submission, manually click Generate Draft once in the browser and confirm a draft appears.

### Tested: n8n / ngrok

What is confirmed:

- n8n health endpoint returns OK at `http://localhost:5678/healthz`.
- ngrok is running and exposing n8n at `https://mckayla-handmade-jaime.ngrok-free.dev`.
- n8n UI opens locally.

What blocked full verification:

- n8n UI showed the sign-in screen.
- n8n REST API returned `401 Unauthorized`.
- `.env.local` does not currently include `MAILMIND_USER_ID`.
- Without n8n login/API access and `MAILMIND_USER_ID`, I cannot honestly confirm that the workflows are imported or active.

Important workflow note:

- `n8n/mailmind-scheduled-sync.json` calls MailMind `/api/gmail/sync`.
- `n8n/mailmind-process-thread-webhook.json` exposes a webhook and calls MailMind `/api/ai/process`.
- Both need `MAILMIND_APP_URL` and `MAILMIND_USER_ID` in the n8n runtime.
- For local n8n calling deployed MailMind, use `MAILMIND_APP_URL=https://mail-mind-two.vercel.app`.
- For local n8n calling local MailMind, use `MAILMIND_APP_URL=http://host.docker.internal:3000` if n8n is inside Docker, or `http://localhost:3000` if n8n can reach the host directly.

Brutal status:

> n8n is running and reachable through ngrok, but the MailMind workflows are not proven active yet.

### Tested: Build Quality

Commands run successfully:

```bash
npm run lint
npm run build
```

Both passed after the Gemini quota fallback patch.

## 12. What Is Working Right Now

Working:

- Deployed app loads.
- Gmail OAuth works for added test users.
- Gmail sync works for the connected test user.
- Supabase storage works.
- Thread list works.
- Categories work better after fallback processing.
- Thread messages display cleaner previews.
- AI chat works.
- AI chat has a source-backed fallback when Gemini quota is exhausted.
- Source-backed newsletter question works.
- Newsletter digest works.
- Draft API works and has a fallback when Gemini quota is exhausted.
- Manual sync works.
- Vercel deployment works.
- GitHub repository is public/linked.
- Local app runs on `http://localhost:3000`.
- Local n8n runs on `http://localhost:5678`.
- ngrok exposes local n8n at `https://mckayla-handmade-jaime.ngrok-free.dev`.

Partially working / needs final confirmation:

- n8n automation execution.
- Draft generation button after final hardening.
- Local one-message automation-style sync request did not finish within a two-minute test window, so scheduled sync should be tested carefully before demo claims.
- Real Gmail sending, because final send was intentionally not tested.

Not implemented:

- Logout/sign out button.
- Public OAuth verification for any Gmail user.
- Full production incremental sync with Gmail History API.
- Full background queue system.

## 13. What To Do Before Submission

### Must Do

1. Add the reviewer Gmail as a Google OAuth test user, or prepare a connected demo account.
2. Manually open the deployed app.
3. Click Generate Draft once and confirm it shows a draft.
4. Decide whether to mention n8n as "prepared workflows" or actually import and test them.
5. If you want to claim n8n is working, run both workflows manually in n8n.

### Strongly Recommended

1. Add logout/disconnect button.
2. Record a 2-3 minute demo video.
3. Explain the Google OAuth testing limitation upfront.
4. Keep one connected demo Gmail account ready.

## 14. Future Roadmap

### Short-Term Improvements

- Add logout/disconnect Gmail.
- Add user-facing "OAuth test mode" warning.
- Add a "Sync next page" button for pagination.
- Add "Process selected thread" button.
- Add a clear "Draft created" preview state.
- Add safer "Send email" confirmation modal.

### Medium-Term Improvements

- Implement Gmail History API incremental sync.
- Add real background queue for AI processing.
- Add better newsletter story extraction.
- Add semantic clustering for duplicate news items.
- Add filters by category, sender, date, and priority.
- Add a settings page.
- Add token revoke/disconnect.

### Production Improvements

- Complete Google OAuth production verification.
- Add privacy policy and terms page.
- Add domain verification.
- Add Supabase Auth or a proper session system.
- Add row-level policies for multi-user production use.
- Host n8n publicly or replace it with a hosted queue/cron service.
- Add observability/logging.

## 15. How To Explain This In The Interview

Say this:

> I built MailMind as a Gmail intelligence platform. The architecture separates user-facing product flows from automation flows. Next.js handles the UI and API routes, Supabase stores Gmail threads/messages/chunks, Gemini handles reasoning and embeddings, NVIDIA NIM supports classification, and n8n is prepared for scheduled/background workflows. I deliberately kept sync batched and demo-safe because Gmail quotas and AI processing can become slow on large inboxes. I also added fallback categorization so the product remains usable when AI is slow.

Also say this:

> The main production limitation is Google OAuth verification. In test mode, only test users can connect. To allow any Gmail account, the app must be published and verified by Google because Gmail scopes are sensitive/restricted. For this assignment, I would add the reviewer as a test user or use a prepared demo Gmail account.

That is mature. That sounds like someone who understands real-world constraints.

## 16. Will This Product Help Get The Job?

Brutal answer: **yes, it can help, but only if you explain it correctly.**

This is not a perfect production product. It has limitations:

- OAuth is not production-verified.
- n8n workflows need active execution verification.
- Logout is missing.
- Full incremental sync is not complete.
- Draft/send flow needs one final manual confidence check.

But for a startup assignment, this is a strong strategic submission because it shows:

- You understood the assignment.
- You used the required stack.
- You built a real deployed app.
- You connected Gmail API, Supabase, Gemini, NVIDIA NIM, and n8n.
- You thought about architecture, quotas, sync, source-backed AI, and product usability.
- You can explain trade-offs honestly.

The key is not to oversell it as a finished SaaS. Position it as:

> A functional MVP with clear architecture, working core flows, and honest production-readiness notes.

That is exactly the kind of thinking an automation startup should respect.

## 17. Setup Instructions

### Install

```bash
npm install
```

### Environment

Copy the example:

```bash
copy .env.example .env.local
```

Required variables:

```bash
NEXT_PUBLIC_APP_URL=
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GOOGLE_REDIRECT_URI=
GEMINI_API_KEY=
GEMINI_MODEL=
GEMINI_EMBEDDING_MODEL=
NVIDIA_API_KEY=
NVIDIA_NIM_MODEL=
N8N_WEBHOOK_BASE_URL=
```

Never commit `.env.local`.

### Supabase

Run:

```sql
supabase/schema.sql
```

in Supabase SQL editor.

### Google OAuth

Local redirect:

```text
http://localhost:3000/api/auth/google/callback
```

Production redirect:

```text
https://mail-mind-two.vercel.app/api/auth/google/callback
```

If the app is in Testing mode, add test users before they connect.

### Run Locally

```bash
npm run dev
```

### Build

```bash
npm run build
```

### Lint

```bash
npm run lint
```

## 18. Final Status

Current final status:

- Product MVP: working.
- Deployed app: working.
- GitHub repo: available.
- Gmail sync: working for test user.
- AI chat: working.
- Newsletter digest: working.
- Categories: working better after fallback processing.
- n8n workflows: prepared, not fully execution-verified.
- Logout: missing.
- Public Google OAuth for any Gmail: not available until production verification or reviewer is added as test user.

Final honest submission line:

> MailMind is a functional MVP of a Gmail Intelligence Platform. It demonstrates the required architecture and core workflows, while clearly documenting production limitations around Google OAuth verification, n8n hosting, and full incremental sync.
