---
name: cloud-agent-starter
description: Quick start for Cloud agents to run, log in, and test this codebase by frontend, backend/worker, and database areas.
---

# Cloud Agent Starter Skill

Use this skill when you need to get productive fast in this repo (run app, log in, test core flows, and unblock common environment issues).

## 1) Quick start (first 5 minutes)

1. Install dependencies:
   - `npm ci`
2. Create frontend env:
   - `.env.local`:
     - `VITE_API_URL=http://127.0.0.1:8787`
3. Create worker secrets for local auth:
   - `.dev.vars`:
     - `JWT_SECRET=dev-secret-change-me`
4. Start backend worker (Cloudflare Worker API):
   - `npm run start`
5. Start frontend (new terminal):
   - `npm run dev -- --host 0.0.0.0 --port 5173`

Frontend runs on `http://127.0.0.1:5173`; API runs on `http://127.0.0.1:8787`.

## 2) Login and auth setup

### Preferred path: local-only (no remote account needed)

Run with local worker + local D1 emulation using `npm run start`.

If login fails due to missing user, create a local user via API with a bcrypt hash:

1. Generate hash:
   - `node -e "const b=require('bcryptjs'); b.hash('123456',10).then(h=>console.log(h))"`
2. Create user (replace `HASH_AQUI`):
   - `curl -i -X POST http://127.0.0.1:8787/api/usuario -H "Content-Type: application/json" -d '{"nome":"Cloud Agent","usuario":"cloudagent","email":"cloudagent@example.com","senha":"HASH_AQUI","ativo":1}'`
3. Login in UI with:
   - user/email: `cloudagent` or `cloudagent@example.com`
   - password: `123456`

### Optional path: remote Cloudflare resources

Use only if you specifically need real remote D1 data:

1. `npx wrangler login`
2. `npx wrangler whoami`
3. Start worker in remote mode when needed.

If login is not possible in the environment, continue with local mode and local seed data.

## 3) Feature flags and mocks (practical reality)

There is no centralized feature-flag framework in this repo right now. Use these practical toggles:

1. API target toggle (most important):
   - Set `VITE_API_URL` in `.env.local` to point frontend to:
     - local worker (`http://127.0.0.1:8787`)
     - or another mock API endpoint for isolated UI tests
2. Session/context quick reset:
   - In browser devtools:
     - `localStorage.removeItem("user")`
     - `localStorage.removeItem("contaSelecionada")`
3. Mock API strategy:
   - For frontend-only checks, point `VITE_API_URL` to a mock server that returns minimal JSON for called endpoints.

## 4) Workflows by codebase area

## Area A: Frontend app (`frontend/`, routes, pages, services)

### Run
- `npm run dev -- --host 0.0.0.0 --port 5173`

### Test workflow (happy path)
1. Ensure backend worker is running.
2. Open `/login`.
3. Log in with seeded user.
4. Validate protected route behavior:
   - authenticated user reaches `/dashboard`
   - after clearing `localStorage.user`, refresh should redirect to `/login`
5. Validate one CRUD screen quickly (example: bancos):
   - create one item in UI
   - reload page and confirm it persists

## Area B: Worker API (`backend/src/index.ts` and `backend/src/routes/*`)

### Run
- `npm run start`

### Test workflow (terminal-driven smoke test)
1. List bancos:
   - `curl -i http://127.0.0.1:8787/api/bancos`
2. Create banco:
   - `curl -i -X POST http://127.0.0.1:8787/api/bancos -H "Content-Type: application/json" -d '{"nome":"Banco Teste","codigo":"999"}'`
3. Verify banco exists:
   - `curl -i http://127.0.0.1:8787/api/bancos`
4. Auth API smoke:
   - `curl -i -X POST http://127.0.0.1:8787/api/auth/login -H "Content-Type: application/json" -d '{"email":"cloudagent","senha":"123456"}'`

If these 4 commands pass, routing + DB binding + auth basics are usually healthy.

## Area C: Database and persistence (D1 via `DB` binding)

### Run
- Worker must be running (`npm run start`).

### Test workflow
1. Seed minimum data through API endpoints (avoid direct SQL unless needed).
2. Read back via GET endpoints to confirm persistence.
3. Restart worker and re-check one record to confirm data continuity in your chosen mode.

Use API-first validation unless debugging SQL issues specifically.

## Area D: Automated tests (`test/`, Vitest + Workers pool)

### Run
- `npm run test`

### Practical guidance
Current test scaffold may not represent this app's real routes/entrypoints. Treat this command as a baseline signal, then prioritize area-specific smoke tests above (A/B/C) for real confidence.

## 5) Common unblockers for Cloud agents

1. `401` on login:
   - confirm `.dev.vars` has `JWT_SECRET`
   - ensure seeded user password is bcrypt-hashed, not plain text in DB
2. Frontend cannot reach API:
   - confirm `.env.local` has correct `VITE_API_URL`
   - confirm worker is running on `:8787`
3. Empty pages after login:
   - check browser console for failed fetches
   - run API curl smoke tests to isolate frontend vs backend issue

## 6) Keep this skill updated (short runbook loop)

Whenever a new testing trick/runbook item is discovered:

1. Add a short bullet under the relevant area (A/B/C/D), not in a random section.
2. Include:
   - exact command(s)
   - expected success signal
   - fallback if it fails
3. Keep entries concise and executable by a fresh Cloud agent without extra context.
