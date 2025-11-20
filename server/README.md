
# NeuroSync Backend Core

This directory contains the server-side skeleton for NeuroSync. While the main application runs entirely client-side by default, this backend is provided to enable **Proxy Mode** for enhanced security in production environments.

## Purpose

In a production deployment, you may want to hide API keys from the client browser. This server is designed to:
1.  Store API keys in server-side environment variables (`.env`).
2.  Accept requests from the frontend.
3.  Proxy those requests to LLM providers (OpenAI, Anthropic, etc.).
4.  Stream the responses back to the client.

## Getting Started

### 1. Install Dependencies
```bash
cd server
npm install
```

### 2. Configuration
Create a `.env` file in the `server/` directory:
```env
PORT=3001
OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=sk-...
GEMINI_API_KEY=...
```

### 3. Run Server
```bash
# Development Mode (Auto-restart)
npm run dev

# Production Mode
npm start
```

## Extending the Proxy

Edit `index.js` to implement the actual proxy logic.

**Example Implementation Plan:**
1.  **Endpoint**: `POST /api/proxy/openai`
2.  **Logic**:
    *   Receive `messages` and `model` from `req.body`.
    *   Use `fetch` or the OpenAI SDK to call the upstream API using `process.env.OPENAI_API_KEY`.
    *   Pipe the upstream response stream directly to `res` (Server-Sent Events).

## Integration with Frontend

Once the proxy is implemented, update the frontend `config.ts` to point to your local server instead of the public APIs:

```typescript
// frontend/config.ts
{
  "id": "OPENAI",
  "endpoint": "http://localhost:3001/api/proxy/openai", // Point to your backend
  // ...
}
```
