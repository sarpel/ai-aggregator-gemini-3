# Phase 2: Functional Bug Hunt

## BUG-01 — Timeout config defined but never applied (P1)

**File:** `constants.ts` line 4 / `config.ts` lines 5-8 / `services/apiAdapters/proxyAdapter.ts` (entire file) / `server/proxy.ts` (entire file)

**Severity:** P1

**What happens:**
Models that fail to respond (network hang, slow upstream) remain permanently stuck in `CONNECTING` or `STREAMING` status. The synthesis engine never triggers, and the user sees a frozen UI with no recovery path short of a full page reload.

**Why it happens:**
`config.ts` defines `connectionTimeoutMs: 60000` and `generationTimeoutMs: 60000`, exported as `APP_TIMEOUTS` from `constants.ts`. Neither the frontend `proxyAdapter.ts` nor the backend `proxy.ts` ever imports or uses these values. No `AbortSignal.timeout()`, no `setTimeout`-based cancellation, nothing.

The synthesis trigger in `App.tsx` (line 293-305) only fires when every active model reaches a terminal status (`COMPLETED`, `ERROR`, or `TIMEOUT`). With no timeout mechanism, `TIMEOUT` status is never set, so `allModelsFinished` never becomes true if any model hangs.

**Trigger scenario:**
1. User sends a prompt.
2. One of the 8 active models (e.g. QWEN) has a network-level stall — TCP connection established but no bytes arrive.
3. The frontend `fetch()` in `proxyAdapter.ts` waits indefinitely.
4. QWEN stays in `CONNECTING` or `STREAMING` status forever.
5. `allModelsFinished` in the `useEffect` (App.tsx:293) never becomes true.
6. Synthesis never runs. User sees a partial results screen with no progress and no error.

**Fix:**
In `proxyAdapter.ts`, apply a timeout signal to the `fetch` call:
```typescript
// Before:
const response = await fetch(proxyUrl, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(requestBody),
  signal: params.abortSignal,
});

// After:
const timeoutMs = 60_000;
const timeoutSignal = AbortSignal.timeout(timeoutMs);
const combinedSignal = params.abortSignal
  ? AbortSignal.any([params.abortSignal, timeoutSignal])
  : timeoutSignal;
const response = await fetch(proxyUrl, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(requestBody),
  signal: combinedSignal,
});
```
In `App.tsx`, handle `TimeoutError` in `triggerModelStream` by dispatching `ModelStatus.TIMEOUT`.
In `server/proxy.ts`, add `AbortSignal.timeout(60_000)` to each upstream `fetch` call, combined with the existing `controller.signal`.

---

## BUG-02 — Server-side proxy has no upstream request timeout (P1)

**File:** `server/proxy.ts` lines 90-98 (`handleOpenAIProxy`), lines 175-184 (`handleAnthropicProxy`)

**Severity:** P1

**What happens:**
A hung upstream API (e.g. OpenAI with slow network) keeps the server-side Node.js connection open indefinitely, consuming a file descriptor and memory for the pending request. Under load, this accumulates into resource exhaustion.

**Why it happens:**
Both `handleOpenAIProxy` and `handleAnthropicProxy` pass `controller.signal` to `fetch()`, but `controller` is only aborted when the *client* disconnects (`req.on('close', ...)`). There is no server-initiated timeout. If the upstream API hangs and the browser tab stays open, the server waits forever.

**Trigger scenario:**
1. Upstream API (e.g. OpenAI) returns 200 headers but then stalls mid-stream.
2. Client is still connected — user hasn't closed the tab.
3. Server-side `fetch` body reader blocks on `reader.read()` forever.
4. With multiple concurrent users hitting the same stalled endpoint, open connections accumulate.

**Fix:**
```typescript
// In handleOpenAIProxy and handleAnthropicProxy, combine with a timeout:
const timeoutController = new AbortController();
const timeoutId = setTimeout(() => timeoutController.abort(), 60_000);
const combinedSignal = AbortSignal.any([controller.signal, timeoutController.signal]);

const response = await fetch(modelConfig.endpoint, {
  ...
  signal: combinedSignal,
});
clearTimeout(timeoutId);
```

---

## BUG-03 — `RETRY_REQUEST` leaves stale consensus text during re-analysis (P3)

**File:** `App.tsx` lines 131-143

**Severity:** P3

**What happens:**
When the user clicks retry on a model, the consensus panel shows the old synthesis text with status `ANALYZING`, giving the misleading impression the old synthesis is still valid while analysis is in progress.

**Why it happens:**
The `RETRY_REQUEST` case updates `consensus.status` to `ConsensusStatus.ANALYZING` but does not clear `consensus.text`:
```typescript
case 'RETRY_REQUEST':
  return {
    ...state,
    isProcessing: true,
    responses: {
      ...state.responses,
      [action.modelId]: INITIAL_RESPONSE_STATE(action.modelId),
    },
    consensus: {
      ...state.consensus,
      status: ConsensusStatus.ANALYZING,  // status changes
      // text: NOT cleared — stale synthesis remains
    },
  };
```
Compare to `START_REQUEST` (line 110-129) which explicitly clears `text: ''` and `confidence: 0` and `contributors: []`.

**Trigger scenario:**
1. User sends a prompt. All models complete. Synthesis runs and shows a result.
2. User clicks retry on one model (e.g. ANTHROPIC).
3. Consensus panel shows old synthesis text, status badge shows `ANALYZING`.
4. New synthesis runs and overwrites the text, but during the retry window the user sees stale content labeled as in-progress analysis.

**Fix:**
```typescript
case 'RETRY_REQUEST':
  return {
    ...state,
    isProcessing: true,
    responses: {
      ...state.responses,
      [action.modelId]: INITIAL_RESPONSE_STATE(action.modelId),
    },
    consensus: {
      ...state.consensus,
      status: ConsensusStatus.ANALYZING,
      text: '',
      confidence: 0,
      contributors: [],
    },
  };
```

---

## BUG-04 — `handleSave` silently closes settings panel on partial save failure (P2)

**File:** `components/core/SettingsPanel.tsx` lines 132-207

**Severity:** P2

**What happens:**
If one or more model save requests fail (e.g. validation error, network error), the settings panel closes and dispatches the server's current state (which excludes the failed changes), with no indication to the user that anything went wrong. The user believes their changes were saved.

**Why it happens:**
`Promise.allSettled` never rejects — it settles with `{ status: 'rejected', reason }` entries. The failure check at lines 194-197 logs errors to console but does NOT set any error state and does NOT prevent the subsequent `onClose()` call:
```typescript
const results = await Promise.allSettled(tasks);
const failures = results.filter((r): r is PromiseRejectedResult => r.status === 'rejected');
if (failures.length > 0) {
  failures.forEach(f => console.error('Save error:', f.reason));  // logs only
}
// ↓ always runs, even with failures
const refreshedModels = await loadModels();
dispatch({ type: 'SET_MODEL_CONFIGS', configs: refreshedModels });
onClose();
```

**Trigger scenario:**
1. User has 8 models; edits 3 of them.
2. Network blips — one PUT request returns 500.
3. `Promise.allSettled` resolves. `failures.length === 1`. Error logged to console.
4. `loadModels()` refreshes from server (fetches only what was successfully saved).
5. `onClose()` is called. Panel closes.
6. User sees 2 of 3 changes persisted, no error message shown.

**Fix:**
Add an error state and render it in the panel, blocking close:
```typescript
const [saveError, setSaveError] = useState<string | null>(null);

// In handleSave, after allSettled:
if (failures.length > 0) {
  setSaveError(`${failures.length} model(s) failed to save. Check console for details.`);
  setSaving(false);
  return;  // don't close
}
```
