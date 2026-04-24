# Phase 3: Performance Audit

## PERF-01 — Markdown re-render on every chunk despite debounce: debouncedContent timer resets each chunk (P2)

**File:** `components/core/ResponseViewer.tsx` lines 90-95

**Severity:** P2

**What happens:**
During a fast-streaming model response, `ReactMarkdown` re-parses the entire accumulated response text from scratch every 150ms regardless of how large it grows. For long responses (>5000 chars), each parse takes measurably longer, causing visible jank at the 150ms tick.

**Why it happens:**
The debounce `useEffect` correctly delays rendering, but `currentContent` changes on every chunk dispatch. Each new chunk resets the 150ms timer. This means in practice the debounce fires every 150ms throughout streaming (not just at the end). A 10,000-character response still triggers a full `ReactMarkdown` parse every 150ms, and `ReactMarkdown` is O(n) in content length. With 8 models streaming simultaneously, each potentially doing this, it's 8 concurrent 150ms-tick markdown parses.

**Trigger scenario:**
1. User sends a prompt to all 8 models.
2. A model streams a long code-heavy response (e.g. >8000 tokens).
3. If the user has that model's tab open, `debouncedContent` updates every 150ms with the full accumulated text.
4. Each update triggers a full `ReactMarkdown` parse. At 8000 chars the parse takes ~5-10ms.
5. On older hardware or in complex documents, this causes noticeable frame drops.

**Fix:**
For streaming tabs, use a plain `<pre>` or split the content at a fixed char limit, only running `ReactMarkdown` once streaming is complete:
```typescript
const isStreaming = selectedResponse?.status === ModelStatus.STREAMING;
// In renderContent:
if (isStreaming) {
  return <pre className="whitespace-pre-wrap text-sm font-mono text-gray-200">{content}</pre>;
}
return <ReactMarkdown>{content}</ReactMarkdown>;
```
This avoids repeated parsing overhead while keeping proper markdown rendering for completed responses.

---

## No other significant hot-path performance issues found.

- `getModelConfigs()` called on every proxy request: performs a `.map()` over ≤20 items — negligible.
- `consensusEngine.ts` string concat in forEach: single call, bounded size — not a hot path.
- `pipeUpstreamBodyToResponse()`: simple pipe, no accumulation — correct pattern.
- Server-side routes: no N+1 queries, no unbounded collections. All data access is O(1) hash lookup on a bounded JSON file.
