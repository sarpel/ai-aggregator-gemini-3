# TODO

All tasks completed:

1. [x] Read required files: types.ts, App.tsx, SynthesizerSettings.tsx, proxyAdapter.ts, and T13 plan notes.
2. [x] Confirm CUSTOM synthesis proxy contract: proxyAdapter/server proxy carry custom endpoint/modelName from App.tsx via modelConfig.
3. [x] Update SynthesizerConfig in types.ts to use modelId reference (simplified, non-optional pattern).
4. [x] Update components/core/SynthesizerSettings.tsx to use modelConfigs dropdown for model selection.
5. [x] Route CUSTOM synthesis in App.tsx through the backend proxy path via streamViaProxy.
6. [x] Run lsp_diagnostics on changed files and `npx tsc --noEmit` — zero errors.

**Status: COMPLETE** ✅
