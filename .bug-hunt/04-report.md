# Bug Hunt Report

## Target
General codebase review — NeuroSync AI Aggregator

## Project Context
NeuroSync is a multi-LLM aggregator that broadcasts a single user prompt to N models simultaneously via a Node.js/Express backend proxy, then feeds all responses to a configurable "synthesizer" model to produce a consensus answer. API keys are stored encrypted (AES-256-GCM) in a local JSON file. The frontend is a React SPA using `useReducer` for global state and SSE streaming for real-time responses.

## Executive Summary
The codebase is well-structured with clean separation between backend proxy, REST routes, and frontend streaming logic. Four actionable defects were found. The most critical is a dead timeout configuration: `connectionTimeoutMs` and `generationTimeoutMs` are defined and exported but never applied to any network call, meaning a single hung upstream API can permanently block the synthesis engine with no recovery path. A companion server-side gap means long-lived hung connections accumulate on the Node.js server. Two secondary issues affect data integrity reporting in the settings panel and rendering performance during streaming.

---

## P1 — Critical (Must Fix Now)

### [BUG] Timeout config defined but never applied — synthesis can block forever

**File:** `constants.ts:4` / `config.ts:5-8` / `services/apiAdapters/proxyAdapter.ts:72-79` / `server/proxy.ts:90-98,175-184`
**Severity:** P1

**What happens:**
A model whose upstream API stalls (network hang, slow provider) remains permanently in `CONNECTING` or `STREAMING` status. The synthesis trigger in `App.tsx` requires all active models to reach a terminal state (`COMPLETED`, `ERROR`, or `TIMEOUT`). With no timeout mechanism, `TIMEOUT` is never set, `allModelsFinished` never becomes true, and synthesis never runs. The UI freezes with no error and no recovery path short of a full page reload.

**Why it happens:**
`config.ts` defines `connectionTimeoutMs: 60000` and `generationTimeoutMs: 60000`. These are exported as `APP_TIMEOUTS` from `constants.ts` but are never imported by `proxyAdapter.ts`, `proxy.ts`, or `App.tsx`. No `AbortSignal.timeout()`, no `setTimeout`-based cancellation, and no `ModelStatus.TIMEOUT` dispatch path exists in the streaming callbacks.

**Trigger scenario:**
1. User sends a prompt to 8 active models.
2. One provider (e.g. QWEN) establishes a TCP connection but sends no bytes.
3. `proxyAdapter.ts` `fetch()` awaits indefinitely — no timeout signal.
4. QWEN stays in `CONNECTING`. `allModelsFinished` = false.
5. Synthesis never triggers. 7 models completed, user sees no consensus, no error.

**Fix:**
```typescript
// proxyAdapter.ts — apply timeout to fetch
const timeoutSignal = AbortSignal.timeout(60_000);
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
```typescript
// proxyAdapter.ts — in the outer catch, distinguish TimeoutError:
if (error instanceof DOMException && error.name === 'AbortError') { return; }
if (error instanceof DOMException && error.name === 'TimeoutError') {
  params.onError('Request timed out');
  return;
}
```
```typescript
// App.tsx triggerModelStream onError — map timeout message to TIMEOUT status:
onError: (error) => {
  dispatch({
    type: 'UPDATE_RESPONSE',
    modelId,
    data: {
      status: error.includes('timed out') ? ModelStatus.TIMEOUT : ModelStatus.ERROR,
      error,
      latency: Date.now() - startTime,
    },
  });
},
```

---

### [BUG] Server-side proxy has no upstream request timeout — connections accumulate

**File:** `server/proxy.ts:90-98` (`handleOpenAIProxy`), `server/proxy.ts:175-184` (`handleAnthropicProxy`)
**Severity:** P1

**What happens:**
A hung upstream API keeps the server-side Node.js `fetch` open indefinitely, consuming a file descriptor and memory per pending request. The `AbortController` is only triggered by client disconnect — if the browser tab stays open, the server waits forever. Under load this accumulates into resource exhaustion.

**Why it happens:**
Both `handleOpenAIProxy` and `handleAnthropicProxy` pass only `controller.signal` to `fetch()`, wired solely to `req.on('close', ...)`. There is no server-side timeout signal. `handleGeminiProxy` uses the `@google/genai` SDK which has its own timeout behavior and is not affected.

**Trigger scenario:**
1. Upstream OpenAI returns 200 headers but stalls mid-stream.
2. Client tab remains open.
3. `reader.read()` in `pipeUpstreamBodyToResponse` blocks indefinitely.
4. With 10 concurrent users hitting a stalled provider, 10 connections accumulate on the server.

**Fix:**
```typescript
// server/proxy.ts — add server-side timeout to both OpenAI and Anthropic handlers
const controller = new AbortController();
const timeoutId = setTimeout(() => controller.abort(), 60_000);
req.on('close', () => { clearTimeout(timeoutId); controller.abort(); });

// ... existing fetch call using controller.signal ...
// After fetch resolves/rejects: clearTimeout(timeoutId);
```

---

## P2 — High (Fix Before Release)

### [BUG] `handleSave` silently closes on partial save failure — user data loss

**File:** `components/core/SettingsPanel.tsx:193-205`
**Severity:** P2

**What happens:**
When one or more model config saves fail (server error, validation rejection), the settings panel closes with no user-visible error. `loadModels()` refreshes state from the server (reflecting only what was successfully saved), then `onClose()` is called unconditionally. The user believes all changes were saved.

**Why it happens:**
`Promise.allSettled` resolves even with rejections. The failure check logs to console but neither sets an error state nor prevents `onClose()`:
```typescript
const results = await Promise.allSettled(tasks);
const failures = results.filter((r): r is PromiseRejectedResult => r.status === 'rejected');
if (failures.length > 0) {
  failures.forEach(f => console.error('Save error:', f.reason)); // console only
}
// always runs ↓
const refreshedModels = await loadModels();
dispatch({ type: 'SET_MODEL_CONFIGS', configs: refreshedModels });
onClose(); // panel closes regardless of failures
```

**Trigger scenario:**
1. User edits 3 model configs and clicks SAVE.
2. One PUT request returns 500.
3. Panel closes. 2 of 3 changes persisted. No feedback to user.

**Fix:**
```typescript
const [saveError, setSaveError] = useState<string | null>(null);

// After allSettled:
if (failures.length > 0) {
  setSaveError(`${failures.length} model(s) failed to save.`);
  setSaving(false);
  return; // do NOT close
}
```
Render `saveError` in the panel footer above the Save button.

---

## P2 — Performance (Fix Soon)

### [PERF] ReactMarkdown re-parses full accumulated text every 150ms during streaming

**File:** `components/core/ResponseViewer.tsx:90-95,97-110`
**Severity:** P2

**What happens:**
During streaming, `ReactMarkdown` re-parses the entire accumulated response from scratch every 150ms. For responses exceeding ~5000 chars, each parse takes measurably longer and causes visible frame drops, especially with 8 models streaming simultaneously.

**Why it happens:**
The debounce `useEffect` fires every 150ms because `currentContent` changes on every chunk. Each update triggers a full markdown parse — `ReactMarkdown` is O(n) in content length. At 8 concurrent streams, worst case is 8 × O(n) parses per 150ms tick.

**Trigger scenario:**
1. All 8 models stream concurrently. User views one tab during streaming.
2. Model generates 8000+ chars. Debounce fires, `ReactMarkdown` parses 8000 chars.
3. On mid-range hardware or complex markdown (tables, code blocks), this causes jank.

**Fix:**
Render plain `<pre>` during streaming; switch to `ReactMarkdown` only on completion:
```typescript
const renderContent = useCallback((content: string, streaming: boolean) => {
  if (!content) return <div className="text-gray-600 italic font-mono">Initialized. Awaiting data stream...</div>;
  if (streaming) return <pre className="whitespace-pre-wrap text-sm font-mono text-gray-200">{content}</pre>;
  return (
    <div className="prose prose-invert max-w-none prose-p:text-sm prose-pre:bg-black prose-pre:border prose-pre:border-cyber-gray">
      <ReactMarkdown>{content}</ReactMarkdown>
    </div>
  );
}, []);
```

---

## P3 — Minor (Track)

### [BUG] `RETRY_REQUEST` leaves stale synthesis text during re-analysis

**File:** `App.tsx:131-143`
**Severity:** P3

**What happens:**
After a successful synthesis, retrying a single model changes `consensus.status` to `ANALYZING` but leaves the old `consensus.text` visible. The user sees the previous synthesis result labeled as "analyzing."

**Why it happens:**
`RETRY_REQUEST` case does not reset `consensus.text`, `confidence`, or `contributors`, unlike `START_REQUEST` which explicitly clears all three.

**Fix:**
```typescript
case 'RETRY_REQUEST':
  return {
    ...state,
    isProcessing: true,
    responses: { ...state.responses, [action.modelId]: INITIAL_RESPONSE_STATE(action.modelId) },
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

## Recommended Fix Order

1. **[BUG]** `services/apiAdapters/proxyAdapter.ts:72-79` + `App.tsx:374-384` — Apply `AbortSignal.timeout` to frontend fetch and map `TimeoutError` → `ModelStatus.TIMEOUT` — Effort: **small**
2. **[BUG]** `server/proxy.ts:69-128,154-214` — Add server-side `setTimeout`/`clearTimeout` abort to OpenAI and Anthropic handlers — Effort: **small**
3. **[BUG]** `components/core/SettingsPanel.tsx:132-207` — Surface partial save failures in UI, block premature close — Effort: **small**
4. **[PERF]** `components/core/ResponseViewer.tsx:97-110` — Swap `ReactMarkdown` for `<pre>` during streaming — Effort: **small**
5. **[BUG]** `App.tsx:131-143` — Clear consensus text/confidence/contributors in `RETRY_REQUEST` — Effort: **trivial**

---

## Metrics

| | Count |
|---|---|
| Files reviewed | 11 |
| Files with findings | 5 |
| Files cleared | 6 |
| **P1 Critical** | 2 |
| **P2 High / Perf** | 2 |
| **P3 Minor** | 1 |
| **Total** | **5** |
