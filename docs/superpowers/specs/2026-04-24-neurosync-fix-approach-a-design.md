# NeuroSync — Approach A Fix Design

**Date:** 2026-04-24  
**Project:** ai-aggregator-gemini-3 (NeuroSync Cyberpunk AI Aggregator)  
**Scope:** Targeted fixes to make the multi-LLM aggregator fully operational

---

## Problem Statement

The backend proxy infrastructure is correctly implemented and all 46 tests pass. However four concrete issues prevent the system from working end-to-end:

1. `initDb()` overwrites user-configured model settings on every server restart
2. Three planned providers (Minimax, Qwen, X.AI) are missing from the default set
3. TypeScript `tsc` compilation fails due to a type annotation error in integration tests
4. `customAdapter.ts` is dead code with a known CORS flaw that no longer has any callers

---

## Architecture (Unchanged)

```
Browser (React/Vite :3000)
  └── /api/* ──Vite proxy──► Express server (:3001)
                                ├── GET  /api/models
                                ├── PUT  /api/models/:id
                                ├── POST /api/models/:id/key
                                ├── POST /api/proxy/openai    ──► OpenAI / X.AI / ZAI / Minimax / Qwen
                                ├── POST /api/proxy/anthropic ──► Anthropic
                                └── POST /api/proxy/gemini   ──► Google Gemini SDK
```

All new providers (Minimax, Qwen, X.AI) use the OpenAI-compatible wire format, so the existing `handleOpenAIProxy` handler requires no changes.

---

## Fix 1: DB Init Overwrite Bug

**File:** `server/db.ts` — `initDb()`

**Current behavior:** On every start, for each default model already in `db.json`, the code runs `Object.assign(stored, DEFAULT_MODELS[i])`, which overwrites `modelName`, `endpoint`, `name`, and all other fields with factory values. User changes made via the Settings UI are lost.

**Fix:** Replace the sync loop with an additive-only strategy. If a model ID already exists in `db.json`, leave it untouched. Only insert records for IDs that are absent.

```typescript
// Pseudocode
const existingIds = new Set(db.data.models.map(m => m.id));
for (const def of DEFAULT_MODELS) {
  if (!existingIds.has(def.id)) {
    db.data.models.push(cloneModelConfig(def));
    needsPersist = true;
  }
}
```

API keys are stored in a separate `keys` map and are never touched by init logic — no change needed there.

---

## Fix 2: Add Three New Default Providers

**File:** `server/db.ts` — `DEFAULT_MODELS` array

| ID | Display Name | Endpoint | Model ID | API Style |
|---|---|---|---|---|
| `MINIMAX` | Minimax-2.7 | `https://api.minimax.chat/v1/chat/completions` | `Minimax-2.7` | `OPENAI` |
| `QWEN` | Qwen-3.6 Plus | `https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions` | `Qwen-3.6 Plus` | `OPENAI` |
| `XAI` | Grok-4.20 | `https://api.x.ai/v1/chat/completions` | `grok-4.20-reasoning-latest` | `OPENAI` |

These three entries will only be inserted into `db.json` if they are absent (see Fix 1). Users can override all fields via the Settings panel.

The same three entries must also be added to the frontend fallback list in `config.ts` (`DEFAULT_MODELS`) so the UI can render correctly even if the backend is temporarily unreachable.

---

## Fix 3: TypeScript Compilation Error

**Files:** `server/__tests__/integration/e2e-flow.test.ts` (line 136), `server/__tests__/integration/config-flow.test.ts` (line 30)

**Root cause:** Both files declare a `RoutesModule` type alias as `typeof import('../../routes')` (static module namespace type) and then assign a dynamic `await import(...)` result to it. TypeScript treats the static and dynamic shapes differently, causing a type mismatch.

**Fix:** Remove the explicit type annotation from the `routesModule` variable and let TypeScript infer the type from the dynamic import:

```typescript
// Before
const routesModule: RoutesModule = await import('../../routes.js');

// After
const routesModule = await import('../../routes.js');
```

The `RoutesModule` type alias becomes unused and can be removed from both files.

---

## Fix 4: Remove Dead Code

**File:** `services/apiAdapters/customAdapter.ts`

- Makes direct browser-to-API calls with API keys in the request headers
- Explicitly blocked for Anthropic (CORS guard comment in the file)
- Not imported by any file in the project (`grep` confirms zero callers)
- Superseded entirely by the backend proxy (`proxyAdapter.ts`)

**Action:** Delete the file.

---

## Out of Scope

- No changes to `proxyAdapter.ts` (frontend SSE parsing is correct for all three API styles)
- No changes to `App.tsx` reducer or synthesis logic
- No changes to UI components beyond what is needed for new providers to appear
- No Tailwind CDN migration (works, not blocking)
- No performance optimizations (separate concern)
- GitHub Copilot integration (deferred by user)

---

## Verification Plan

1. `cd server && npm run build` — must exit 0 (no TypeScript errors)
2. `npm test` (root) — all 46 tests must still pass
3. Start server: `cd server && npm run dev`; start frontend: `npm run dev`
4. Open Settings panel — confirm 7 providers listed (GEMINI, OPENAI, ANTHROPIC, ZAI, MINIMAX, QWEN, XAI)
5. Change a model's `modelName` via UI, click Save, restart server — confirm the changed value persists
6. Confirm `services/apiAdapters/customAdapter.ts` no longer exists
