# Bug Hunt Scope

## Target
General codebase review

## Files Reviewed

### Backend (server/)
- `server/index.ts` — Express app entry point
- `server/db.ts` — lowdb JSON database + AES-256-GCM key encryption
- `server/routes.ts` — REST API routes for model config CRUD
- `server/proxy.ts` — SSE proxy handlers (OpenAI, Anthropic, Gemini)

### Frontend
- `App.tsx` — Main React component, reducer, stream orchestration
- `components/core/SettingsPanel.tsx` — Model config UI
- `components/core/ResponseViewer.tsx` — Response/consensus display
- `services/apiAdapters/proxyAdapter.ts` — Frontend SSE client
- `services/consensus/consensusEngine.ts` — Synthesis prompt builder

### Shared
- `types.ts` — Shared TypeScript types
- `constants.ts` — Normalization helpers, APP_TIMEOUTS export
- `config.ts` — Default model definitions, timeout config values
