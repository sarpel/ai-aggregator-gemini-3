# AGENTS.md — NeuroSync Project Context

<!-- AUTO-GENERATED: overview -->
## Project Overview

NeuroSync is a cyberpunk-themed AI aggregator that queries multiple LLMs in parallel and synthesizes their responses into a consensus answer. The architecture consists of a React 19 frontend, Express 4 backend with encrypted file storage, and real-time SSE streaming for all LLM interactions.

**Key Innovation**: Dynamic model configuration system allowing users to add/remove/edit LLM providers via UI without code changes. All API keys stored encrypted (AES-256-GCM) on backend, never exposed to frontend.
<!-- END_AUTO_GENERATED -->

## Tech Stack

| Layer | Technology | Version |
|-------|------------|---------|
| Frontend | React | 19.2.0 |
| Build Tool | Vite | 6.2.0 |
| Language | TypeScript | 5.8.2 |
| Styling | Tailwind CSS | Custom cyberpunk theme |
| Backend | Express | 4.18.2 |
| Database | lowdb | 7.0.1 (JSON file) |
| Testing | Vitest | 4.1.4 |
| AI SDK | @google/genai | 1.49.0 |

## Commands

### Frontend (project root)
```bash
npm install          # Install dependencies
npm run dev          # Dev server: http://localhost:5173
npm run build        # Production build
npm run test         # Run tests
npx tsc --noEmit     # Type check
```

### Backend (server/)
```bash
cd server
npm install          # Install dependencies
npm run dev          # Dev server: http://localhost:3001 (tsx watch)
npm run build        # Compile to dist/
npm run test         # Run tests
npx tsc --noEmit     # Type check
```

## Architecture

### Frontend Structure
- **App.tsx**: Main state machine (useReducer), orchestrates model streams + synthesis
- **components/core/**:
  - `SettingsPanel.tsx` — Model CRUD UI, replaces CredentialManager
  - `ResponseViewer.tsx` — Shows model responses + consensus tab
  - `StatusMatrix.tsx` — Grid of model status cards
  - `SynthesizerSettings.tsx` — Consensus model selection
- **services/apiAdapters/**:
  - `proxyAdapter.ts` — Unified streaming through backend proxy
  - `mockAdapter.ts` — Simulated responses for testing
  - `customAdapter.ts`, `geminiAdapter.ts` — Legacy direct adapters

### Backend Structure
- **index.ts**: Express server, CORS, route wiring
- **db.ts**: Encrypted storage with lowdb (AES-256-GCM)
- **proxy.ts**: SSE proxy handlers for OpenAI/Anthropic/Gemini
- **routes.ts**: REST API for model CRUD + key management

### Data Flow
```
User Input → App.tsx → proxyAdapter.ts → POST /api/proxy/{style}
                                      ↓
                         server/proxy.ts → db.ts (getApiKey)
                                      ↓
                              Upstream LLM API (encrypted key)
                                      ↓
                         SSE Stream → ResponseViewer.tsx
```

## Code Conventions

### TypeScript
- Strict mode not enabled (strict mode is enabled in the server)
- No `any` types in production code
- Explicit return types on exported functions
- Interface naming: `PascalCase`
- Type naming: `PascalCase` with `Type` suffix if ambiguous

### React
- Functional components with explicit `React.FC<Props>`
- useReducer for complex state (App.tsx pattern)
- useCallback for event handlers passed to children
- React.memo for expensive renders (ResponseViewer)

### Backend
- Express handlers: `async (req, res) =>` with try/catch
- SSE responses: Always set `Content-Type: text/event-stream`
- Error format: `{ error: string }` with appropriate HTTP status
- File imports: Use `.js` extension for NodeNext module resolution

### Naming
- Components: PascalCase (`SettingsPanel.tsx`)
- Utilities: camelCase (`streamViaProxy`)
- Constants: UPPER_SNAKE_CASE (`DEFAULT_MODELS`)
- Types/Interfaces: PascalCase (`ModelConfig`, `ApiStyle`)

## Critical Files

| File | Purpose | Never Modify Without Review |
|------|---------|----------------------------|
| `types.ts` | Central type definitions | Yes — affects entire codebase |
| `server/db.ts` | Encryption/storage logic | Yes — security critical |
| `server/proxy.ts` | SSE streaming handlers | Yes — core functionality |
| `App.tsx` | State machine | Yes — orchestration logic |
| `services/apiAdapters/proxyAdapter.ts` | Frontend proxy client | Yes — streaming logic |

## Boundaries (Never Do)

1. **Never expose API keys in frontend** — All keys stored in server/db.ts, never returned in API responses
2. **Never use real API keys in tests** — Always mock upstream responses
3. **Never buffer full SSE responses** — Stream chunks as they arrive
4. **Never delete mockAdapter.ts, customAdapter.ts, geminiAdapter.ts** — Preserved for compatibility
5. **Never add database server** — File-based storage only (lowdb)
6. **Never add authentication system** — Local-only proxy by design

## Domain Knowledge

### Terms
- **ModelConfig**: LLM provider configuration (endpoint, modelName, apiStyle, etc.)
- **ApiStyle**: 'OPENAI' | 'ANTHROPIC' | 'GEMINI' — determines proxy route
- **Synthesis**: Consensus engine merging multiple model outputs
- **SSE**: Server-Sent Events for streaming text generation
- **Proxy Pattern**: Frontend → Backend → LLM API (keys stay on backend)

### File Locations
- Configs: `config.ts` (defaults), `server/db.json` (user data, encrypted)
- Tests: `__tests__/` (frontend), `server/__tests__/` (backend)
- Evidence: `.sisyphus/evidence/` (verification artifacts)

### Environment Variables
- `ENCRYPTION_KEY`: Master key for AES-256-GCM (server only, required)
- `PORT`: Backend port (default: 3001)
- `DB_PATH`: Path to db.json (default: './db.json')

## Current Phase

**Status**: Production Ready — LLM Config Overhaul Complete

**Recent Changes**:
- Dynamic model configuration via Settings Panel
- Backend proxy with encrypted storage
- SSE streaming for all providers
- TypeScript migration complete
- 46/46 tests passing

**Next Steps** (if continuing):
- Add more model providers (Ollama local, Azure OpenAI)
- Streaming consensus (currently buffers then synthesizes)
- Response caching for repeated queries
