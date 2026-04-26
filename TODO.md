# TODO

## Impact map
- `services/apiAdapters/proxyAdapter.ts`: distinguish valid Anthropic `message_stop` completion from premature stream close.
- `App.tsx`: abort active proxy streams on New Query and repair orphaned synthesizer model IDs.
- `server/routes.ts` + `server/routes.test.ts`: block default-model provider routing mutation while preserving safe metadata updates.
- `types.ts`: remove dead `SET_API_KEY` action variant.
- `install_and_run.bat`: start backend and frontend; convert to CRLF for Windows batch reliability.
- `components/core/ResponseViewer.tsx` and `ModelDetailsModal.tsx`: finish type-safe enum/accessibility PR items.
- `.coderabbit.yaml`: remove stale microWakeWord project settings and disable early access.
- `components/core/SettingsPanel.test.tsx`: isolate global mocks.
- `server/db.test.ts`: make encryption assertion meaningful with hex-safe plaintext checks.

## Assumptions
- Anthropic normal completion should be detected from `message_stop`, not raw socket close. Confidence: 9/10. Evidence: `server/proxy.ts` pipes Anthropic upstream SSE and does not append `[DONE]`; mock server emits `message_stop`. Fallback: if upstream format changes, premature-close handling still reports an error instead of false completion.
- Default built-in model display metadata may remain editable, but provider routing fields (`endpoint`, `modelName`, `apiStyle`) must not be mutable. Confidence: 9/10. Evidence: PR item specifically identifies stored-key exfiltration via endpoint/modelName/apiStyle mutation. Fallback: custom models remain fully editable.
- The batch-file CRLF requirement cannot be reliably represented by `apply_patch` alone, so a targeted Python newline conversion is required after content edits. Confidence: 8/10. Evidence: Windows batch reviewer item explicitly requires CRLF. Fallback: verify bytes contain CRLF after conversion.

## Ordered tasks
1. [x] Read `pr-fix-suggestions.md` and target files.
2. [x] Launch parallel explore validations for frontend/backend PR items.
3. [x] Patch still-unfixed actionable PR items.
4. [x] Collect explore results and reconcile any missed items.
5. [x] Run diagnostics, builds, tests, and targeted line-ending/status checks.

## Verification plan
- [x] `lsp_diagnostics` for repo and server: 0 diagnostics.
- [x] `npm run build` at repo root: passed.
- [x] `npm run test` at repo root: 2 frontend files / 4 tests passed; server suite also passed.
- [x] `npm run build` in `server/`: passed.
- [x] `npm run test` in `server/`: 7 files / 50 tests passed.
- [x] Verify `install_and_run.bat` uses CRLF: passed via byte check.
- [x] Verify no remaining actionable PR-list grep hits for fixed symbols: only remaining `global.fetch =` hit is unrelated `server/proxy.test.ts`, not SettingsPanel item #17.
