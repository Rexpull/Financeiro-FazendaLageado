# AGENTS.md

## Cursor Cloud specific instructions

### Architecture
This is a Cloudflare Workers + React (Vite) financial management app ("Financeiro Fazenda Lageado"). Single `package.json` at root — no monorepo.

- **Backend**: Cloudflare Worker at `backend/src/index.ts`, runs via `npm start` (`wrangler dev`, default port 8787)
- **Frontend**: React 19 + Vite SPA, runs via `npm run dev` (`vite`, default port 5173)
- **Database**: Cloudflare D1 (local SQLite via wrangler). No external DB needed.

### Environment Files (not committed)
- `.env` — must contain `VITE_API_URL=http://localhost:8787` for the frontend to reach the backend
- `.dev.vars` — must contain `JWT_SECRET=<any-string>` for authentication to work

### Running Services
1. Start backend: `npx wrangler dev --port 8787`
2. Start frontend: `npx vite --host 0.0.0.0 --port 5173`

Both must run simultaneously. The backend auto-creates a local D1 SQLite database.

### Database Initialization
On a fresh local D1, tables must be created before the app works. Use `npx wrangler d1 execute financeiro_db --local --command="<SQL>"` to create tables. Key tables: `banco`, `usuario`, `ContaCorrente`, `planoContas`, `Parametros`, `MovimentoBancario`, `Financiamento`, `parcelaFinanciamento`, `Resultado`, `MovimentoCentroCustos`, `CentroCustos`, `HistoricoImportacaoOFX`, `pessoa`.

A test user must also be inserted with a bcrypt-hashed password for login to work.

### Key Commands
- `npm run dev` — Vite frontend dev server
- `npm start` — Wrangler backend dev server
- `npm run build` — Vite production build
- `npm test` — Vitest (note: existing test has a pre-existing import path issue — `test/index.spec.ts` imports from `../src/index` but the worker entry is at `backend/src/index.ts`)

### Gotchas
- No ESLint is configured in this project.
- `wrangler.toml` and `wrangler.json` both exist; `wrangler.json` is the primary config used by vitest.
- The `wrangler.toml` uses `main = "src/index.ts"` (wrong path) while `wrangler.json` correctly uses `backend/src/index.ts`.
- Some tables (CentroCustos, HistoricoImportacaoOFX) auto-create themselves via repository constructors, but most tables must be created manually.
