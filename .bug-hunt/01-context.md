# Phase 1: Context & Architecture Scan

## System Overview
NeuroSync is a multi-LLM aggregator: users send a prompt to N models simultaneously via a backend proxy, then a "synthesizer" model produces a consensus answer from all responses. The backend stores encrypted API keys in a JSON file.

## File-by-File Analysis

### server/db.ts
- **Purpose:** Persistent storage (lowdb/JSON) for model configs and AES-256-GCM encrypted API keys
- **Data flow:** Read at startup via `initDb()`. Models and keys stored in `db.json`. Keys encrypted with per-key salt, IV, and tag derived from `ENCRYPTION_KEY` env var.
- **External deps:** Filesystem (`db.json`), `ENCRYPTION_KEY` env var
- **State:** Module-level `db` singleton, set once per process
- **Error boundaries:** `ensureDb()` throws if uninitialized; individual DB operations throw through to callers
- **Hot paths:** `getModelConfigs()` called on every proxy request

### server/routes.ts
- **Purpose:** CRUD REST API for model configurations and API key management
- **Data flow:** HTTP → validation → db read/write → response
- **External deps:** `db.ts` functions
- **State:** Stateless per-request
- **Error boundaries:** Try/catch around all DB calls; 500 on failure

### server/proxy.ts
- **Purpose:** Server-side SSE proxy forwarding browser requests to upstream LLM APIs
- **Data flow:** POST /api/proxy/{style} → fetch upstream with stored API key → pipe SSE back to client
- **External deps:** Upstream LLM APIs (network), `db.ts` for key retrieval
- **State:** Per-request `AbortController` and `isClosed` flag
- **Error boundaries:** try/catch wraps upstream fetch; checks `res.writableEnded` before writing errors
- **Hot paths:** `pipeUpstreamBodyToResponse()` inner read loop — runs for duration of each stream

### server/index.ts
- **Purpose:** Express app bootstrap — middleware, routes, DB init, listen
- **State:** None beyond Express app
- **Error boundaries:** `startServer()` calls `process.exit(1)` on `initDb()` failure

### services/apiAdapters/proxyAdapter.ts
- **Purpose:** Frontend SSE client — connects to backend proxy, parses SSE chunks, calls callbacks
- **Data flow:** fetch → ReadableStream → TextDecoder → line buffer → JSON parse → onChunk/onComplete/onError
- **State:** `hasCompleted` flag, local `buffer` string, `shouldStop` flag
- **Error boundaries:** Outer try/catch; AbortError check; `hasCompleted` guard prevents double-complete

### services/consensus/consensusEngine.ts
- **Purpose:** Builds synthesis prompt from all completed model responses
- **Data flow:** State → filter completed responses → format prompt string
- **State:** Pure function, no side effects

### App.tsx
- **Purpose:** Root component; manages global state via `useReducer`; orchestrates parallel model streams and synthesis
- **State:** `AppState` (all app state), `promptInput` local state, `synthesisTriggeredRef` ref guard
- **Error boundaries:** Stream errors dispatched to `UPDATE_RESPONSE`; synthesis errors dispatched to `UPDATE_CONSENSUS`
- **Hot paths:** `triggerModelStream` callback — dispatches on every SSE chunk from each model

### components/core/SettingsPanel.tsx
- **Purpose:** Settings modal for editing model configs and API keys
- **State:** Local `models`, `originalModels`, `apiKeys`, `keyStatuses`, `saving`, `loading`
- **Data flow:** Load from /api/models → edit locally → save back (POST new, PUT changed) → reload → dispatch to app state

### components/core/ResponseViewer.tsx
- **Purpose:** Tabbed display of model responses and consensus; auto-scroll during streaming
- **State:** `selectedTab`, `copiedState`, `debouncedContent`, scroll ref
- **Hot paths:** `useEffect` for debounced markdown content (150ms timer reset on every chunk)

## Key Architectural Observations
1. `APP_TIMEOUTS` is exported from `constants.ts` (sourced from `config.ts` values `connectionTimeoutMs: 60000`, `generationTimeoutMs: 60000`) but is **never imported or used** anywhere in streaming code.
2. Both server-side proxy `fetch()` calls and frontend `proxyAdapter.ts` have **no timeout** on network requests — only client-disconnect abort.
3. `RETRY_REQUEST` reducer resets the target model but does **not** clear `consensus.text`, leaving stale synthesis visible during re-analysis.
4. `SettingsPanel.handleSave` uses `Promise.allSettled` but never surfaces partial failures to the user — silently closes on mixed success/failure.
