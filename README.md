# RFP Platform

Multi-channel request-for-proposal workspace that captures buyer intents over chat, persists proposals in Postgres, emails vendors through Resend, and ingests vendor replies via Gmail IMAP for AI-assisted comparison.

## 1. Project Setup

### a. Prerequisites
- Node.js 20.x (tested with npm 10) for both the Express backend and Next.js frontend.
- PostgreSQL with the `pg-vector` extensions enabled (required by the initial migration).
- Google AI Studio project with access to the Gemini API (`LLM_API_KEY`) and the Embeddings API.
- Resend account and verified sending domain/API key (`RESEND_API_KEY`).
- Dedicated Gmail inbox with IMAP enabled plus an app password (`EMAIL_ADDRESS` / `EMAIL_PASSWORD`) for polling inbound proposals.
- Optional: Docker (or similar) to run Postgres locally; `psql` CLI for running migrations.

### b. Install Steps
```bash
# Backend
cd backend
npm install

# Frontend
cd ../frontend
npm install
```

Create `backend/.env` populated with the variables referenced in `src/config/config.ts`.

Minimal example: also present in .env.example

```env
PORT=4000
FRONTEND_URL=http://localhost:3000
DB_HOST=127.0.0.1
DB_PORT=5432
DB_USER=postgres
DB_PASS=postgres
DB_NAME=rfp_db
LLM_API_KEY=your-google-gemini-key
RESEND_API_KEY=your-resend-key
EMAIL_ADDRESS=team+rfp@yourdomain.com
EMAIL_PASSWORD=app-password-for-inbox
TYPEORM_LOGGING=true
```
Frontend only needs `NEXT_PUBLIC_BACKEND_URL=http://localhost:4000` in `frontend/.env.local`.

### c. Email Sending/Receiving
1. **Outbound (Resend)**: verify the domain or sender used in `sendRfpToVendors`. The backend sends from `onboarding@resend.dev` by default—replace it with your verified sender if needed. Set `RESEND_API_KEY` accordingly.
2. **Inbound (Gmail IMAP)**: use a workspace or service Gmail inbox, enable IMAP, and generate an app password. The email monitor connects to `imap.gmail.com:993` via `EMAIL_ADDRESS` / `EMAIL_PASSWORD`, marks processed messages as read, and looks for `RFP Request - ID: <uuid>` patterns in the subject/body.
3. Ensure MX rules or forwarding send vendor replies into this mailbox so the `emailMonitor` can parse them and call `parseVendorProposalEmail`.

### d. Running Locally
```bash
# 1. Start Postgres (example using Docker)
docker run --name rfp-db -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=rfp_db \
  -p 5442:5432 -d ankane/pgvector

# 2. Apply migrations
cd backend
npm run migration:run

# 3. Start backend (Express + Socket.IO)
npm start

# 4. Start frontend (Next.js)
cd ../frontend
npm run dev
```
Backend listens on `http://localhost:4000`, exposes REST endpoints under `/api`, and the proposal WebSocket namespace at `/proposal` with `path=/proposal-socket`. The Next.js app runs on `http://localhost:3000`.

### e. Seed Data & Initial Scripts
- No static seed data is bundled; running `npm run migration:run` creates all tables, indexes, and vector/uuid extensions.
- Create test vendors through the API/UI, e.g.:
  ```bash
  curl -X POST http://localhost:4000/api/vendor \
    -H "Content-Type: application/json" \
    -d '{"email":"vendor1@example.com"}'
  ```
- Start a proposal session from the UI home page to generate the first RFP records and to test socket-driven questioning.

## 2. Tech Stack
- **Frontend**: Next.js 16 (App Router) + React 19, Tailwind utility classes, TanStack Query, and `socket.io-client` for live proposal rooms.
- **Backend**: Express 5, Socket.IO 4, TypeORM, Zod builders to validate LLM output, LangChain’s `ChatGoogleGenerativeAI`, and `@langchain/google-genai` embeddings.
- **Database**: PostgreSQL with pgvector for storing embeddings plus TypeORM migrations for schema control.
- **AI Provider**: Google Gemini 2.5 Flash for extraction plus `embedding-001` for semantic storage.
- **Email & Messaging**: Resend for outbound vendor blasts, ImapFlow + Mailparser for ingesting replies, and the Resend/Gmail credentials configured via `.env`.
- **Supporting Libraries**: `@tanstack/react-query` for cache-aware API calls, `socket.io-client`, `lodash`, `uuid`, `zod`, and `resend`.

## 3. API Documentation

### GET `/api/rfp`
- Returns all saved RFPs with items and proposals.
- Success:
```json
{
  "success": true,
  "count": 2,
  "data": [
    {
      "id": "3e5d2...",
      "user_input": "Need 10 laptops...",
      "items": [],
      "proposals": []
    }
  ]
}
```
- Error:
```json
{
  "success": false,
  "message": "Failed to fetch RFPs",
  "error": "Database connection lost"
}
```

### GET `/api/rfp/:id`
- Fetches a single RFP (path param `id`).
- Success mirrors the list response but with one record; `404` returns `{ "success": false, "message": "RFP not found" }`.

### POST `/api/rfp/:id/send`
- Body: `{ "vendorIds": ["uuid-1","uuid-2"] }`.
- Sends the selected RFP to vendors via Resend.
- Success:
```json
{
  "success": true,
  "message": "RFP sent to 2 vendor(s)",
  "data": {
    "rfpId": "3e5d2...",
    "vendorCount": 2
  }
}
```
- Common errors:
```json
{ "success": false, "message": "vendorIds array is required" }
{ "success": false, "message": "RFP not found" }
```

### GET `/api/rfp/:id/recommendation`
- Runs Gemini to summarize vendor proposals and produce a recommendation once proposals exist.
- Success payload:
```json
{
  "success": true,
  "data": {
    "recommendation": {
      "recommendedVendor": "acme@example.com",
      "reasoning": "Lowest price and fastest delivery",
      "summary": "Acme meets... "
    },
    "comparison": {
      "lowestPrice": "USD 12,500",
      "highestPrice": "USD 18,900",
      "averagePrice": 15000,
      "priceRange": 6400,
      "insights": ["Vendor A includes extended warranty"]
    }
  }
}
```
- Errors mirror other routes with `success: false` and a `message`.

### POST `/api/vendor`
- Body: `{ "email": "vendor@example.com" }`.
- Success returns the created vendor; `409` when the email already exists.

### PUT `/api/vendor/:id`
- Body: `{ "email": "new-email@example.com" }`.
- Success returns the updated vendor, errors for missing email or duplicate addresses.

### POST `/api/proposal/submit`
- Body: `{ "rfpId": "<uuid>", "vendorEmail": "foo@bar.com", "emailContent": "<raw html/text>" }`.
- Parses vendor replies, persists a proposal, and returns:
```json
{
  "success": true,
  "message": "Vendor proposal submitted successfully",
  "data": {
    "proposalId": "f6a1...",
    "rfpId": "3e5d2...",
    "vendorEmail": "foo@bar.com",
    "budgetAmount": "14500",
    "itemCount": 3
  }
}
```
- Errors include `400` for missing fields or incomplete parsed content (`missingFields` is returned).

### GET `/api/proposal/rfp/:rfpId`
- Lists proposals for the specified RFP.
- Error response: `{ "success": false, "message": "Failed to fetch proposals", "error": "..." }`.

## 4. Decisions & Assumptions

### Key Decisions
- **Schema-first validation**: LLM output flows through `RfpCoreBuilder`/`RfpProposalBuilder` (Zod) so incomplete or hallucinated data never persists without explicit confirmation. The **Temperature** is kept to prevent it from hallucinations.
- **Socket-first interviews**: `RfpCorePartial` which is returned from the previous step is used to check for missing required fields and the socket is used to ask the users back the required fields to complete the proporsal. Session state for each room is stored in a map since it is a single user
- **Semantic storage**: Conversations are embedded with `embedding-001` and stored via pgvector, enabling future retrieval/ranking without redesigning later.
- **Email loop closure**: Combined Resend (outbound) and Gmail IMAP (inbound) instead of a custom SMTP server to reuse dependable tooling and keep monitoring logic small. 
- **Modular AI layer**: LangChain ChainBuilder encapsulates prompts so swapping Gemini for another provider requires minimal edits.
- **Recommendation**: Comparison, reasoning and 3 scores (price, ease of terms and completeness,i.e all items availability) scores.

### Assumptions
- Vendor replies will include the RFP ID emitted in the subject/body, and they respond in plain text/HTML (attachments are ignored).
- Gmail account has IMAP/app-password access; OAuth was intentionally avoided for speed.
- Proposal sessions are single-tenant per RFP; reconnect logic assumes a browser session re-joins by room ID.
- Emails may occasionally miss fields; when parsing fails, the API returns `missingFields` and expects the operator to request a resend.
- Sessions to chat to request for proporsal is **in-memory** and subject to cleanup after expiry.
- Two separate emails used for outbound and inbound mails for now due to time constraint

## 5. AI Tools Usage
- **Tools**: GitHub Copilot for inline completions, Claude Code.
- **Contributions**: 
1. Frontend is completely generated based on instructions after providing the backend.
2. Also changing the RfpBuilder from Concrete to Generic type so that it can support almost every type.
3. email inbound parsing logic. mailgun wasn't working so I used resend because it was easy but dodnt support outbound emails.
- **Learnings**: 
1. It is fast but need boiler plate concept to absorb it specially the plan mode helped.
2. Taught how to get inbound mails, webhook with mailgun would be good but this scheduler was also good for an mvp.
3. Generic type conversion was good as I felt little out of touch with zod schema and even still now I haven't done email validation in zod schema except for only in one function used to send the outbound emails.
