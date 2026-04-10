<!-- AUTO-GENERATED: header -->
# NeuroSync | Cyberpunk AI Aggregator

> **Parallel Intelligence Aggregator & Neural Consensus Engine**

**NeuroSync** is a high-fidelity, cyberpunk-themed web application that orchestrates multiple Large Language Models (LLMs) in parallel. It streams responses in real-time to a unified dashboard and uses a configurable **Neural Consensus Engine** to synthesize a superior "source of truth" answer from the collective intelligence.

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![Status](https://img.shields.io/badge/status-production-green.svg)
<!-- END_AUTO_GENERATED -->

---

## ⚡ Core Features

*   **Multi-Model Orchestration**: Query Gemini, OpenAI, Anthropic, Grok, and DeepSeek simultaneously.
*   **Dynamic Model Configuration**: Add, edit, and remove model providers via the Settings Panel. No code changes required.
*   **Secure Backend Proxy**: All LLM traffic routes through backend proxy. API keys stored encrypted (AES-256-GCM), never exposed to frontend.
*   **Real-Time Streaming**:
    *   Visual "Matrix-style" data feeds.
    *   Animated terminal windows for every model ("Mini TV" effect).
    *   Auto-scrolling command console.
*   **Neural Consensus Engine (LLM Mode)**:
    *   Uses a configurable master model to intelligently merge, summarize, and verify inputs.
    *   Select synthesis model from available providers via UI.
    *   Customizable system prompts.
*   **Cyberpunk UI/UX**:
    *   Full responsive design with neon aesthetics.
    *   Visual status indicators (Green: Streaming, Yellow: Slow, Red: Error).
    *   Encrypted "Secure Vault" for API key management.
*   **Robust Error Handling**:
    *   60s Connection/Generation Timeouts.
    *   Non-blocking failure: if one model dies, the others continue.
    *   Visual error states with glitch effects.

---

## 🛠️ Tech Stack

*   **Frontend**: React 19, TypeScript, Vite 6, React Markdown
*   **Backend**: Express 4, TypeScript, lowdb (JSON file storage)
*   **Styling**: Tailwind CSS + Custom Cyberpunk Config
*   **State Management**: React `useReducer` + Context
*   **AI Integration**: Google GenAI SDK (Gemini), OpenAI-compatible REST APIs
*   **Encryption**: Node.js crypto (AES-256-GCM with scrypt key derivation)
*   **Testing**: Vitest 4, React Testing Library
*   **Icons**: Lucide React

---

## 🚀 Installation & Setup

### Prerequisites
*   Node.js v18+
*   npm or bun

### Quick Start

**Start Backend (Terminal 1):**
```bash
cd server
npm install
npm run dev
```

**Start Frontend (Terminal 2):**
```bash
npm install
npm run dev
```

The app will launch at `http://localhost:5173` (frontend) with backend proxy at `http://localhost:3001`.

### Environment Variables

Create `server/.env`:
```env
PORT=3001
ENCRYPTION_KEY=your-secure-encryption-key-min-32-chars
# DB_PATH=./custom-db.json  # Optional: override default database file location (defaults to server/db.json)
```

> **`PORT`** and **`ENCRYPTION_KEY`** are required. **`DB_PATH`** is optional and defaults to `db.json` in the server directory.

---

## ⚙️ Configuration

### Adding Models (via Settings Panel)

Click the **"SETTINGS"** button in the top right:

1. **Default Providers**: Edit existing providers (OpenAI, Anthropic, Grok, DeepSeek, Gemini)
   - Endpoint URL
   - Model Name
   - API Key (encrypted at rest)
   - API Style (OpenAI/Anthropic/Gemini)

2. **Custom Models**: Add your own providers
   - Click "ADD CUSTOM MODEL"
   - Configure endpoint, model name, API key
   - Select API style
   - Save to persist

All configurations stored encrypted in `server/db.json`.

### Neural Consensus Setup

1. Click the **Settings (CPU)** icon in the Consensus tab
2. Select **Synthesis Model** from dropdown
3. Customize **System Prompt** (persona)
4. Save configuration

---

## 🎮 Usage Guide

### 1. Configure Models
Open **Settings Panel** → add API keys for providers you want to use → Save.

### 2. Activate Models
Toggle model buttons in the header to activate/deactivate.

### 3. Query Models
Type your prompt in the bottom console and click **SEND** (or press Enter).
*   Models will light up and stream text in real-time.
*   Status indicators:
    *   **Green Pulse**: Active Streaming.
    *   **Yellow Pulse**: Connection > 60s (Warning).
    *   **Red Glitch**: Error or Timeout.

### 4. Neural Consensus
Once models finish, **Neural Synthesis** triggers automatically.
*   Navigate to the **Consensus Tab**.
*   Read the unified answer synthesized by the selected model.

---

## 📂 Architecture

<!-- AUTO-GENERATED: architecture -->
```
/
├── components/
│   ├── core/              # Major functional blocks
│   │   ├── SettingsPanel.tsx      # Model configuration UI
│   │   ├── ResponseViewer.tsx     # Consensus + model responses
│   │   ├── StatusMatrix.tsx       # Model status grid
│   │   ├── SynthesizerSettings.tsx # Consensus config
│   │   └── ModelDetailsModal.tsx  # Model info popup
│   └── ui/                # Reusable UI elements
│       ├── CyberButton.tsx
│       ├── CyberTooltip.tsx
│       └── ModelAvatar.tsx
├── services/
│   ├── apiAdapters/       # LLM connection logic
│   │   ├── proxyAdapter.ts        # Unified proxy streaming
│   │   ├── mockAdapter.ts         # Simulated responses
│   │   ├── customAdapter.ts       # OpenAI/Anthropic direct (legacy)
│   │   └── geminiAdapter.ts       # Gemini SDK direct (legacy)
│   └── consensus/         # Synthesis logic
│       └── consensusEngine.ts
├── server/                # Backend Express API
│   ├── index.ts           # Server entry + route wiring
│   ├── db.ts              # Encrypted file storage (lowdb)
│   ├── proxy.ts           # SSE proxy handlers
│   ├── routes.ts          # Model CRUD API
│   └── __tests__/         # Tests
│       ├── integration/   # Integration tests
│       └── unit/          # Unit tests
├── App.tsx                # Main React app + state machine
├── config.ts              # Default model configs
├── types.ts               # Global TypeScript definitions
├── constants.ts           # Config helpers
└── vite.config.ts         # Vite + dev proxy config
```
<!-- END_AUTO_GENERATED -->

---

## 🔒 Security Architecture

<!-- AUTO-GENERATED: security -->
1. **API Key Storage**: Encrypted with AES-256-GCM using `ENCRYPTION_KEY` env var
2. **Key Derivation**: scrypt with 32-byte random salt
3. **Transport**: All LLM calls proxied through backend (no keys in browser)
4. **Persistence**: lowdb JSON file (no database server required)
5. **Isolation**: Each model's API key stored separately, never returned in API responses
<!-- END_AUTO_GENERATED -->

---

## 🧪 Testing

```bash
# Frontend tests
npm run test

# Backend tests
cd server && npm run test

# Full test suite
npx vitest run
```

---

## 📋 Available Scripts

<!-- AUTO-GENERATED: scripts -->
| Command | Description |
|---------|-------------|
| `npm run dev` | Start Vite dev server (port 5173) |
| `npm run build` | Build for production |
| `npm run test` | Run Vitest tests |
| `cd server && npm run dev` | Start backend (port 3001, auto-reload) |
| `cd server && npm run build` | Compile TypeScript to dist/ |
| `cd server && npm run test` | Run server tests |
<!-- END_AUTO_GENERATED -->

---

## 🔧 Troubleshooting

**Backend won't start:**
- Check `server/.env` has `ENCRYPTION_KEY` set
- Verify port 3001 is available

**Models not responding:**
- Verify API keys configured in Settings Panel
- Check browser DevTools Network tab for `/api/proxy/*` requests
- Review server logs for upstream errors

**Synthesis not triggering:**
- Ensure at least one model completed successfully
- Check selected synthesis model has valid API key

---

*System Status: ONLINE*
*Protocol: SECURE*
