
# NeuroSync | Cyberpunk AI Aggregator

> **Parallel Intelligence Aggregator & Neural Consensus Engine**

**NeuroSync** is a high-fidelity, cyberpunk-themed web application that orchestrates multiple Large Language Models (LLMs) in parallel. It streams responses in real-time to a unified dashboard and uses a configurable **Neural Consensus Engine** to synthesize a superior "source of truth" answer from the collective intelligence.

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![Status](https://img.shields.io/badge/status-production-green.svg)

---

## ⚡ Core Features

*   **Multi-Model Orchestration**: Query Gemini, OpenAI, Anthropic, Grok, and DeepSeek simultaneously.
*   **Real-Time Streaming**: 
    *   Visual "Matrix-style" data feeds.
    *   Animated terminal windows for every model ("Mini TV" effect).
    *   Auto-scrolling command console.
*   **Neural Consensus Engine (LLM Mode)**:
    *   Uses a master model (Gemini or Custom Local/Remote LLM) to intelligently merge, summarize, and verify inputs.
    *   Configurable system prompts and endpoints via the UI.
*   **Cyberpunk UI/UX**:
    *   Full responsive design with neon aesthetics.
    *   Visual status indicators (Green: Streaming, Yellow: Slow, Red: Error).
    *   In-memory "Secure Vault" for API key management (Zero-Persistence).
*   **Robust Error Handling**:
    *   30s Connection Timeout / 60s Generation Timeout.
    *   Non-blocking failure: if one model dies, the others continue.
    *   Visual error states with glitch effects.

---

## 🛠️ Tech Stack

*   **Frontend**: React 19, TypeScript, Vite
*   **Styling**: Tailwind CSS + Custom Cyberpunk Config
*   **State Management**: React `useReducer` + Context
*   **AI Integration**: Google GenAI SDK (Gemini), Custom Fetch Adapters (OpenAI/Anthropic/Local)
*   **Icons**: Lucide React, Official Brand SVGs

---

## 🚀 Installation & Setup

### Prerequisites
*   Node.js v18+
*   npm or yarn

### Option A: One-Click Start (Recommended)

**Windows:**
1.  Double-click `install_and_run.bat`.
2.  The script will install dependencies and launch the interface automatically.

**Linux / macOS:**
1.  Open a terminal.
2.  Run `chmod +x install_and_run.sh` to make it executable.
3.  Run `./install_and_run.sh`.

### Option B: Manual Setup

1.  **Install Dependencies**:
    ```bash
    npm install
    ```

2.  **Run Development Server**:
    ```bash
    npm run dev
    ```
    The app will launch at `http://localhost:5173`.

---

## ⚙️ Configuration

### Adding/Editing Models
All model definitions are stored in `config.ts`. You can modify this file to add new providers or change endpoints (e.g., for local LLMs like Ollama).

**Example `config.ts`:**
```typescript
export const config = {
  "appSettings": {
    "connectionTimeoutMs": 30000, // 30s to start stream
    "generationTimeoutMs": 60000  // 60s max generation time
  },
  "models": [
    {
      "id": "LOCAL_LLAMA", // Unique ID
      "name": "Llama 3 (Local)",
      "provider": "CUSTOM",
      "avatarColor": "#ff9900",
      "description": "Local Ollama Instance",
      "apiStyle": "OPENAI", // or 'ANTHROPIC'
      "endpoint": "http://localhost:11434/v1/chat/completions",
      "modelName": "llama3",
      "isSimulated": false
    },
    // ... other models
  ]
};
```

### Neural Consensus Setup
The synthesis engine is configured **at runtime** via the UI settings button (CPU Icon) in the Consensus tab.
*   **Provider**: Choose between Gemini (Native) or Custom (OpenAI/Anthropic compatible).
*   **System Directive**: Customize the persona of the synthesizer (e.g., "You are a strict fact-checker").

---

## 🎮 Usage Guide

### 1. Credential Setup (Secure Vault)
Click the **"SECURE VAULT"** button in the top right.
*   **Gemini Key**: Required for the Gemini model and the default Consensus Engine.
*   **Other Keys**: Enter keys for OpenAI, Anthropic, etc., if you plan to use those models.
*   *Note: Keys are stored in RAM only and are wiped on page refresh.*
### 4. Managing Session
*   **Clear**: Clears the text input buffer.
*   **New Query**: Resets all output screens and consensus state (keeps API keys).
*   **Reset Session** (in Vault): Wipes everything, including API keys.

---

## 📂 Architecture

```
/
├── components/
│   ├── core/          # Major functional blocks (ResponseViewer, StatusMatrix, CredentialManager)
│   └── ui/            # Reusable UI elements (CyberButton, ModelAvatar)
├── services/
│   ├── apiAdapters/   # Logic for connecting to different LLM providers (Gemini, Custom)
│   └── consensus/     # Logic for preparing synthesis prompts
├── server/            # Backend skeleton (Optional proxy)
├── App.tsx            # Main State Machine
├── config.ts          # Central Configuration
├── types.ts           # Global TypeScript definitions
└── constants.ts       # Config loaders
```

---

## 🔒 Security Note
This application is designed as a **Client-Side** tool. API keys entered into the UI are:
1.  Stored in React State (Memory) **only**.
2.  Never sent to any 3rd party server (other than the specific AI provider's official API).
3.  Never written to `localStorage` or Cookies.

---

*System Status: ONLINE*  
*Protocol: SECURE*