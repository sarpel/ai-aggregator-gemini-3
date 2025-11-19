# NeuroSync | Cyberpunk AI Aggregator

> **Parallel Intelligence Aggregator & Neural Consensus Engine**

NeuroSync is a high-fidelity, cyberpunk-themed web application that orchestrates multiple Large Language Models (LLMs) in parallel. It streams responses in real-time to a unified dashboard and uses a configurable **Consensus Engine** to synthesize a superior "source of truth" answer from the collective intelligence.

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![Status](https://img.shields.io/badge/status-beta-orange.svg)

---

## ⚡ Core Features

*   **Multi-Model Orchestration**: Query Gemini, OpenAI, Anthropic, Grok, and DeepSeek simultaneously.
*   **Real-Time Streaming**: Visual "Matrix-style" data feeds and animated terminal windows for every model.
*   **Neural Consensus Engine**:
    *   **Heuristic Mode**: Client-side algorithm weights responses based on agreement, structure, and latency.
    *   **LLM Mode**: Uses a master model (Gemini or Custom Local/Remote LLM) to intelligently merge and summarize inputs.
*   **Cyberpunk UI/UX**:
    *   Full responsive design with neon aesthetics.
    *   Micro-interactions, glitch effects, and scanline animations.
    *   In-memory "Secure Vault" for API key management (Zero-Persistence).
*   **Custom Protocol Support**: Connect to local LLMs (Ollama, LM Studio) via the generic OpenAI/Anthropic adapter.

---

## 🛠️ Tech Stack

*   **Frontend**: React 19, TypeScript, Vite
*   **Styling**: Tailwind CSS + Custom Cyberpunk Config
*   **State Management**: React `useReducer` + Context
*   **AI Integration**: Google GenAI SDK (Gemini), Custom Fetch Adapters (OpenAI/Anthropic/Local)
*   **Icons**: Lucide React

---

## 🚀 Installation & Setup

### Prerequisites
*   Node.js v18+
*   npm or yarn

### 1. Clone & Install Frontend
```bash
# Clone repository
git clone https://github.com/your-username/neurosync.git
cd neurosync

# Install dependencies
npm install
```

### 2. Run Development Server
```bash
npm run dev
```
The app will launch at `http://localhost:5173` (or similar).

### 3. (Optional) Backend Skeleton
A backend skeleton is provided in `server/` for future server-side proxying implementation.

```bash
cd server
npm install
npm run dev
```

---

## 🎮 Usage Guide

### 1. Credential Setup (Secure Vault)
Click the **"SECURE VAULT"** button in the top right.
*   **Gemini**: Required for the default Consensus Engine and Gemini model tile.
*   **Other Providers**: Currently simulated (Mock Mode) unless you configure a **Custom Endpoint** in the Neural Core settings.
*   *Note: Keys are stored in RAM only and are wiped on page refresh.*

### 2. Querying Models
Type your prompt in the bottom console and hit **ENTER** or click **SEND**.
*   Watch as all active models stream responses in parallel.
*   The "Mini Terminal" under each avatar shows the raw data feed.

### 3. Neural Consensus
Click the **Consensus** tab in the main viewer.
*   **Heuristic Mode**: Uses a weighted scoring algorithm to identify the best answer and extract key insights.
*   **LLM Mode**: Click the **CPU/Settings Icon** in the Consensus tab.
    *   Select **LLM Mode**.
    *   Choose **Gemini** or **Custom** (e.g., for local Ollama).
    *   If **Custom**, enter your endpoint (e.g., `http://localhost:11434/v1/chat/completions`) and model name.

### 4. Managing Context
*   **Clear**: Clears the input buffer only.
*   **New Query**: Wipes all output screens and resets the session state (keeps keys intact).
*   **Reset Session** (in Vault): Wipes everything, including API keys.

---

## 📂 Architecture

```
/
├── components/
│   ├── core/          # Major functional blocks (ResponseViewer, StatusMatrix)
│   └── ui/            # Reusable UI elements (CyberButton, ModelAvatar)
├── services/
│   ├── apiAdapters/   # Logic for connecting to different LLM providers
│   └── consensus/     # Algorithms for merging/scoring responses
├── server/            # Backend skeleton (Express.js)
├── App.tsx            # Main State Machine
├── types.ts           # Global TypeScript definitions
└── constants.ts       # Configuration constants
```

---

## 🔒 Security Note
This application is designed as a **Client-Side** tool. API keys entered into the UI are:
1.  Stored in React State (Memory) **only**.
2.  Never sent to any 3rd party server (other than the specific AI provider's official API).
3.  Never written to `localStorage` or Cookies.

For production deployment, it is recommended to implement the `server/` proxy to handle API keys server-side.

---

*System Status: ONLINE*  
*Protocol: SECURE*