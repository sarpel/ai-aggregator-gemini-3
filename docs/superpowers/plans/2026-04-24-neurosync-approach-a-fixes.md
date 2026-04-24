# NeuroSync Approach A Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix 4 targeted issues so the NeuroSync multi-LLM aggregator works end-to-end: stop DB init from overwriting user model configs, add 3 new default providers, fix TypeScript compilation errors in tests, and remove dead code.

**Architecture:** Express backend proxy on port 3001 forwards LLM requests; React/Vite frontend on port 3000 proxies `/api/*` to the backend. All fixes are additive or subtractive — no structural changes to the proxy pipeline.

**Tech Stack:** TypeScript, Node.js, Express, Vite, React, lowdb (JSON file DB), Vitest

---

## File Map

| File | Action | Reason |
|---|---|---|
| `server/db.ts` | Modify | Fix `initDb()` overwrite bug + add 3 new DEFAULT_MODELS entries |
| `config.ts` | Modify | Add 3 new entries to frontend fallback DEFAULT_MODELS |
| `server/__tests__/integration/e2e-flow.test.ts` | Modify | Remove bad `RoutesModule` type annotation on line 136 |
| `server/__tests__/integration/config-flow.test.ts` | Modify | Remove bad `RoutesModule` type annotation on line 30 |
| `services/apiAdapters/customAdapter.ts` | Delete | Dead code — no callers, CORS-broken direct browser calls |

---

### Task 1: Fix DB Init Overwrite Bug

**Files:**
- Modify: `server/db.ts` — `initDb()` function (lines ~105–125)

The current `initDb()` runs `Object.assign(stored, updated)` for every default model that already exists in `db.json`, wiping out any user-edited `modelName`, `endpoint`, or `name`. The fix: replace that sync loop with a pure additive approach — only insert records whose `id` is absent from the DB.

- [ ] **Step 1: Read the current initDb() to confirm the exact lines**

Run: `grep -n "Object.assign\|needsPersist\|sync seeded\|Sync seeded" /home/sarpel/ai-aggregator-gemini-3/server/db.ts`

Expected output shows the loop starting around line 110 with `Object.assign(stored, cloneModelConfig(updated))`.

- [ ] **Step 2: Replace the sync loop in initDb()**

In `server/db.ts`, locate the block inside `initDb()` that reads:

```typescript
  } else {
    // Sync seeded models (default entries) with updated defaults
    let needsPersist = false;
    for (const stored of db.data.models) {
      const updated = DEFAULT_MODELS.find((d) => d.id === stored.id);
      if (updated) {
        Object.assign(stored, cloneModelConfig(updated));
        needsPersist = true;
      }
    }
    if (needsPersist) {
      await persistDb(db);
    }
  }
```

Replace it with:

```typescript
  } else {
    // Add any default models not yet in the DB (additive only — never overwrite user changes)
    const existingIds = new Set(db.data.models.map((m) => m.id));
    let needsPersist = false;
    for (const def of DEFAULT_MODELS) {
      if (!existingIds.has(def.id)) {
        db.data.models.push(cloneModelConfig(def));
        needsPersist = true;
      }
    }
    if (needsPersist) {
      await persistDb(db);
    }
  }
```

- [ ] **Step 3: Write a test that verifies the fix**

Open `server/db.test.ts`. Check the existing imports at the top of the file. Ensure `initDb`, `saveModelConfig`, and `getModelConfigs` are imported from `'./db.js'`. Add this test block at the end of the file:

```typescript
describe('initDb – additive-only seeding', () => {
  it('does not overwrite user-edited modelName on re-init', async () => {
    // First init seeds the DB
    await initDb();

    // Simulate user saving a custom modelName via the Settings UI
    const models = getModelConfigs();
    const gemini = models.find((m) => m.id === 'GEMINI');
    if (!gemini) throw new Error('GEMINI not seeded after initDb()');
    await saveModelConfig({ ...gemini, modelName: 'user-custom-gemini-model' });

    // Re-init simulates a server restart — the custom value must survive
    await initDb();

    const after = getModelConfigs().find((m) => m.id === 'GEMINI');
    expect(after?.modelName).toBe('user-custom-gemini-model');
  });
});
```

This test uses only the already-exported public API (`initDb`, `saveModelConfig`, `getModelConfigs`) — no need to export `db` internals.

- [ ] **Step 4: Run all server tests to confirm no regressions**

```bash
cd /home/sarpel/ai-aggregator-gemini-3/server
npm test 2>&1 | tail -15
```

Expected: all tests pass (previously 46; now 47 with the new test).

- [ ] **Step 5: Commit**

```bash
cd /home/sarpel/ai-aggregator-gemini-3
git add server/db.ts server/db.test.ts
git commit -m "fix: stop initDb from overwriting user-edited model configs on restart"
```

---

### Task 2: Add 3 New Default Providers to Backend

**Files:**
- Modify: `server/db.ts` — `DEFAULT_MODELS` array (around line 30)

All three new providers use the OpenAI-compatible wire format. The existing `handleOpenAIProxy` handler requires no changes.

- [ ] **Step 1: Add MINIMAX, QWEN, XAI to DEFAULT_MODELS in server/db.ts**

In `server/db.ts`, find the `DEFAULT_MODELS` array. Add:

```typescript
  { id: 'MINIMAX', name: 'Minimax-2.7', endpoint: 'https://api.minimax.chat/v1/chat/completions', modelName: 'Minimax-2.7', apiStyle: 'OPENAI', avatarColor: '#ff6b35', description: 'Minimax 2.7', isCustom: false },
  { id: 'QWEN', name: 'Qwen-3.6 Plus', endpoint: 'https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions', modelName: 'Qwen-3.6 Plus', apiStyle: 'OPENAI', avatarColor: '#6e40c9', description: 'Alibaba Qwen 3.6 Plus', isCustom: false },
  { id: 'XAI', name: 'Grok-4.20', endpoint: 'https://api.x.ai/v1/chat/completions', modelName: 'grok-4.20-reasoning-latest', apiStyle: 'OPENAI', avatarColor: '#e8e8e8', description: 'xAI Grok 4.20 Reasoning', isCustom: false },
```

The closing `];` stays after these new entries.

- [ ] **Step 2: Run server tests to confirm no regressions**

```bash
cd /home/sarpel/ai-aggregator-gemini-3/server
npm test 2>&1 | tail -10
```

Expected: all tests pass.

- [ ] **Step 3: Manually verify new providers appear via API**

```bash
cd /home/sarpel/ai-aggregator-gemini-3/server
npx tsx index.ts &
sleep 2
curl -s http://localhost:3001/api/models | python3 -m json.tool | grep '"id"'
kill %1 2>/dev/null
```

Expected output includes:
```
"id": "GEMINI",
"id": "OPENAI",
"id": "ANTHROPIC",
"id": "ZAI",
"id": "MINIMAX",
"id": "QWEN",
"id": "XAI",
```

Note: If `db.json` already exists and doesn't have these entries, they will be added by the fixed `initDb()`. If you need to test a clean state, temporarily rename `server/db.json` before starting.

- [ ] **Step 4: Commit**

```bash
cd /home/sarpel/ai-aggregator-gemini-3
git add server/db.ts
git commit -m "feat: add Minimax, Qwen, and xAI as default providers in backend"
```

---

### Task 3: Add 3 New Default Providers to Frontend Fallback

**Files:**
- Modify: `config.ts` — `DEFAULT_MODELS` array (frontend fallback used when backend is unreachable)

The frontend fetches models from `/api/models` on load. The `DEFAULT_MODELS` in `config.ts` is only used as a fallback. Without this update, the 3 new providers won't appear if the backend is temporarily down.

- [ ] **Step 1: Add MINIMAX, QWEN, XAI to DEFAULT_MODELS in config.ts**

In `config.ts`, find the `DEFAULT_MODELS` array. Add:

```typescript
  {
    "id": "MINIMAX",
    "name": "Minimax-2.7",
    "provider": "MINIMAX",
    "avatarColor": "#ff6b35",
    "description": "Minimax 2.7",
    "apiStyle": "OPENAI",
    "endpoint": "https://api.minimax.chat/v1/chat/completions",
    "modelName": "Minimax-2.7",
    "isCustom": false,
    "isSimulated": false
  },
  {
    "id": "QWEN",
    "name": "Qwen-3.6 Plus",
    "provider": "QWEN",
    "avatarColor": "#6e40c9",
    "description": "Alibaba Qwen 3.6 Plus",
    "apiStyle": "OPENAI",
    "endpoint": "https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions",
    "modelName": "Qwen-3.6 Plus",
    "isCustom": false,
    "isSimulated": false
  },
  {
    "id": "XAI",
    "name": "Grok-4.20",
    "provider": "XAI",
    "avatarColor": "#e8e8e8",
    "description": "xAI Grok 4.20 Reasoning",
    "apiStyle": "OPENAI",
    "endpoint": "https://api.x.ai/v1/chat/completions",
    "modelName": "grok-4.20-reasoning-latest",
    "isCustom": false,
    "isSimulated": false
  },
```

- [ ] **Step 2: Run frontend build to confirm no TypeScript errors**

```bash
cd /home/sarpel/ai-aggregator-gemini-3
npm run build 2>&1 | tail -10
```

Expected: `✓ built in X.XXs` with no errors.

- [ ] **Step 3: Commit**

```bash
cd /home/sarpel/ai-aggregator-gemini-3
git add config.ts
git commit -m "feat: add Minimax, Qwen, and xAI to frontend fallback model list"
```

---

### Task 4: Fix TypeScript Compilation Errors in Integration Tests

**Files:**
- Modify: `server/__tests__/integration/e2e-flow.test.ts` — line 136
- Modify: `server/__tests__/integration/config-flow.test.ts` — line 30

Both files declare `type RoutesModule = typeof import('../../routes')` then assign `await import('../../routes.js')` to a variable typed as `RoutesModule`. TypeScript treats static `typeof import(...)` and dynamic `await import(...)` differently — the dynamic result wraps the module in a namespace object causing a type mismatch. The fix: remove the explicit annotation and let TypeScript infer it.

- [ ] **Step 1: Fix e2e-flow.test.ts**

Open `server/__tests__/integration/e2e-flow.test.ts`.

Find and remove the `RoutesModule` type alias (around line 56):
```typescript
type RoutesModule = typeof import('../../routes');
```

Find line 136:
```typescript
    const routesModule: RoutesModule = await import('../../routes.js');
```

Change it to (remove the type annotation):
```typescript
    const routesModule = await import('../../routes.js');
```

- [ ] **Step 2: Fix config-flow.test.ts**

Open `server/__tests__/integration/config-flow.test.ts`.

Find and remove the `RoutesModule` type alias (around line 10):
```typescript
type RoutesModule = typeof import('../../routes');
```

Find line 30:
```typescript
    const routesModule: RoutesModule = await import('../../routes.js');
```

Change it to:
```typescript
    const routesModule = await import('../../routes.js');
```

- [ ] **Step 3: Verify tsc now passes**

```bash
cd /home/sarpel/ai-aggregator-gemini-3/server
npx tsc --noEmit 2>&1
```

Expected: no output (exit code 0).

- [ ] **Step 4: Run all server tests to confirm no regressions**

```bash
cd /home/sarpel/ai-aggregator-gemini-3/server
npm test 2>&1 | tail -10
```

Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
cd /home/sarpel/ai-aggregator-gemini-3
git add server/__tests__/integration/e2e-flow.test.ts server/__tests__/integration/config-flow.test.ts
git commit -m "fix: remove bad RoutesModule type annotation causing tsc failure in integration tests"
```

---

### Task 5: Remove Dead Code (customAdapter.ts)

**Files:**
- Delete: `services/apiAdapters/customAdapter.ts`

This file makes direct browser-to-API calls with API keys in headers — a pattern that is CORS-blocked for Anthropic and a security anti-pattern for all providers. It has zero callers in the codebase and is fully superseded by the backend proxy (`proxyAdapter.ts`).

- [ ] **Step 1: Confirm zero callers**

```bash
grep -r "customAdapter\|streamCustomLLM" /home/sarpel/ai-aggregator-gemini-3 \
  --include="*.ts" --include="*.tsx" \
  --exclude-dir=node_modules \
  --exclude-dir=dist
```

Expected: no output (zero matches).

- [ ] **Step 2: Delete the file**

```bash
rm /home/sarpel/ai-aggregator-gemini-3/services/apiAdapters/customAdapter.ts
```

- [ ] **Step 3: Run frontend build to confirm nothing broke**

```bash
cd /home/sarpel/ai-aggregator-gemini-3
npm run build 2>&1 | tail -10
```

Expected: `✓ built in X.XXs` with no errors.

- [ ] **Step 4: Commit**

```bash
cd /home/sarpel/ai-aggregator-gemini-3
git add -A
git commit -m "chore: remove dead customAdapter.ts (CORS-broken direct browser calls, zero callers)"
```

---

### Task 6: Full Verification

- [ ] **Step 1: Run the complete test suite**

```bash
cd /home/sarpel/ai-aggregator-gemini-3
npm test 2>&1 | tail -20
```

Expected: all tests pass (root + server).

- [ ] **Step 2: Verify tsc passes on both frontend and backend**

```bash
cd /home/sarpel/ai-aggregator-gemini-3
npx tsc --noEmit 2>&1 && echo "FRONTEND OK"
cd server
npx tsc --noEmit 2>&1 && echo "SERVER OK"
```

Expected: `FRONTEND OK` and `SERVER OK` (or only the known non-blocking errors in the excluded test files if `--noEmit` still catches them).

- [ ] **Step 3: Start backend and confirm 8 providers**

```bash
cd /home/sarpel/ai-aggregator-gemini-3/server
npx tsx index.ts &
sleep 2
curl -s http://localhost:3001/api/models | python3 -c "import json,sys; [print(m['id']) for m in json.load(sys.stdin)]"
kill %1 2>/dev/null
```

Expected output (order may vary):
```
GEMINI
OPENAI
ANTHROPIC
ZAI
MINIMAX
QWEN
XAI
```

- [ ] **Step 4: Verify user config persists across restart**

```bash
cd /home/sarpel/ai-aggregator-gemini-3/server
# Start server
npx tsx index.ts &
sleep 2

# Change GEMINI modelName to a custom value
curl -s -X PUT http://localhost:3001/api/models/GEMINI \
  -H "Content-Type: application/json" \
  -d '{"modelName":"my-custom-gemini-999"}' | python3 -m json.tool | grep modelName

# Stop server
kill %1 2>/dev/null
sleep 1

# Restart server
npx tsx index.ts &
sleep 2

# Confirm the custom value is still there
curl -s http://localhost:3001/api/models | python3 -c "
import json, sys
models = json.load(sys.stdin)
g = next(m for m in models if m['id'] == 'GEMINI')
print('modelName after restart:', g['modelName'])
"

kill %1 2>/dev/null
```

Expected: `modelName after restart: my-custom-gemini-999`

- [ ] **Step 5: Start the full stack and open the UI**

```bash
# Terminal 1
cd /home/sarpel/ai-aggregator-gemini-3/server && npx tsx index.ts

# Terminal 2
cd /home/sarpel/ai-aggregator-gemini-3 && npm run dev
```

Open `http://localhost:3000` in a browser. Click SETTINGS and confirm:
- 7 provider cards are visible (GEMINI, OPENAI, ANTHROPIC, ZAI, MINIMAX, QWEN, XAI)
- Each card shows the correct model name and has API key input
- `customAdapter.ts` file no longer exists in the project

- [ ] **Step 6: Final commit if any loose files remain**

```bash
cd /home/sarpel/ai-aggregator-gemini-3
git status
# If any modified files remain uncommitted:
git add -A
git commit -m "chore: final cleanup after Approach A fixes"
```
