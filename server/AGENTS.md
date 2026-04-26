# Server Directory — AGENTS.md

## Overview
Express 4 backend with TypeScript. Handles encrypted API key storage, model configuration CRUD, and SSE proxy streaming to LLM providers.

## Structure
```
server/
├── index.ts           # Express entry: middleware, routes, proxy wiring
├── routes.ts          # REST API: /api/models CRUD + key management
├── proxy.ts           # SSE handlers: OpenAI/Anthropic/Gemini streaming
├── db.ts              # Encrypted storage: AES-256-GCM + lowdb
├── package.json       # Separate dependencies (Express, lowdb, @google/genai)
├── tsconfig.json      # Strict mode, NodeNext modules
├── vitest.config.ts   # Test config (Node environment)
└── __tests__/         # Integration tests + helpers
```

## Key Patterns

### Express Handlers
```typescript
async (req: Request, res: Response): Promise<void> => {
  try {
    // handler logic
  } catch (error) {
    res.status(500).json({ error: 'message' });
  }
}
```

### SSE Streaming
Always set headers:
```typescript
res.setHeader('Content-Type', 'text/event-stream');
res.setHeader('Cache-Control', 'no-cache');
res.setHeader('Connection', 'keep-alive');
```

### File Imports
Use `.js` extension for NodeNext:
```typescript
import { initDb } from './db.js';
import modelRoutes from './routes.js';
```

## API Endpoints

| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | /health | System status |
| GET | /api/models | List all model configs |
| POST | /api/models | Create custom model |
| PUT | /api/models/:id | Update model config |
| DELETE | /api/models/:id | Delete custom model |
| POST | /api/models/:id/key | Set encrypted API key |
| GET | /api/models/:id/key/status | Check key existence |
| POST | /api/proxy/openai | Stream OpenAI responses |
| POST | /api/proxy/anthropic | Stream Anthropic responses |
| POST | /api/proxy/gemini | Stream Gemini responses |

## Conventions

- **Strict TypeScript**: Enabled (unlike frontend)
- **Error Format**: `{ error: string }` with HTTP status
- **Encryption**: AES-256-GCM with scrypt key derivation
- **Storage**: lowdb JSON file (no database server)
- **Testing**: Vitest with Node environment, integration tests in `__tests__/integration/`

## Critical Files

- `db.ts` — Security-critical encryption logic
- `proxy.ts` — Core SSE streaming functionality
- `routes.ts` — API validation and CRUD

## Environment

Required in `.env`:
```
PORT=3001
ENCRYPTION_KEY=your-32-char-minimum-key
DB_PATH=./db.json  # optional, defaults to ./db.json
```

## Commands

```bash
npm run dev      # tsx watch mode
npm run build    # Compile to dist/
npm run test     # Run Vitest
npx tsc --noEmit # Type check
```

## Anti-Patterns

- Never expose decrypted API keys in responses
- Never use `any` types (strict mode enforced)
- Never buffer full SSE responses (stream chunks)
- Never require real API keys in tests (use mocks)
