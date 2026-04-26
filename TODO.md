# TODO

## Impact map
- Config/docs: `.coderabbit.yaml`, `.gitignore`, `AGENTS.md`, `README.md`, `server/.env.example`.
- Frontend behavior/a11y: `App.tsx`, `components/core/*`, `components/ui/CyberTooltip.tsx`, `constants.ts`, `services/apiAdapters/proxyAdapter.ts`, `types.ts`.
- Backend/runtime security: `server/db.ts`, `server/index.ts`, `server/proxy.ts`, `server/package.json`, `server/package-lock.json`, removed tracked `server/.env` and `server/db.json`.
- Tests/helpers: `components/core/SettingsPanel.test.tsx`, `server/db.test.ts`, `server/__tests__/helpers/mockLLMServer.ts`, `server/__tests__/integration/*.test.ts`.

## Assumptions
- Removing tracked `server/.env` and `server/db.json` from the working tree is the correct local remediation for committed secrets. Confidence: 9/10. Evidence: both files were tracked and contained secret material; `.gitignore` already/now ignores them. Fallback: operators must rotate keys and purge history outside this working-tree-only fix.
- Keeping Express 4 and downgrading typings to Express 4 is lower risk than upgrading to Express 5. Confidence: 9/10. Evidence: project docs and installed runtime are Express 4.22.1.
- Async `crypto.scrypt` must propagate through `getApiKey` rather than keeping sync encryption. Confidence: 10/10. Evidence: review explicitly requested async scrypt and awaiting callers.

## Ordered tasks
1. [x] Verify each reported finding against current files before fixing.
2. [x] Fix config and documentation validation/port/version issues.
3. [x] Remove tracked secret files from the working tree, ignore runtime secrets, and add safe env example.
4. [x] Fix frontend runtime correctness, accessibility, copy fallback, tooltip, model selection, and type consistency issues.
5. [x] Fix backend async encryption, decryption errors, env key generation race/write handling, CORS/body limits, socket safety, Gemini timeout, and Express typings alignment.
6. [x] Fix test helper and integration/unit test issues impacted by async key reads and stricter assertions.
7. [x] Run diagnostics, builds, and tests for frontend and backend.
8. [x] Run final review/Oracle pass before completion and fix the Gemini abort-signal blocker it found.

## Verification plan
- [x] `lsp_diagnostics` on all modified source/test files after final Oracle fix: 0 diagnostics.
- [x] Root `npm run build` after final Oracle fix: passed.
- [x] Root `npm run test` after final Oracle fix: 2 frontend files / 4 tests passed; server suite also passed via root script.
- [x] Server `npm run build` after final Oracle fix: passed.
- [x] Server `npm run test` after final Oracle fix: 7 files / 48 tests passed.
- [x] Inspect git status for remaining tracked secrets and unexpected files: `server/.env` and `server/db.json` are deleted from the working tree and ignored for future runtime copies.
