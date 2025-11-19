const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');

// Initialize Environment
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());

// --- System Routes ---

// Health Check (Heartbeat)
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ONLINE', 
    system: 'NeuroSync Core', 
    timestamp: Date.now(),
    version: '1.0.0' 
  });
});

// --- Future API Proxies ---
// In a production environment, these endpoints would handle requests to 
// LLM providers (OpenAI, Anthropic) using server-side API keys, 
// preventing exposure of credentials to the client browser.

app.post('/api/proxy/openai', (req, res) => {
  // TODO: Implement OpenAI Proxy
  // 1. Extract body
  // 2. Attach process.env.OPENAI_API_KEY
  // 3. Forward to https://api.openai.com/v1/...
  // 4. Stream response back to client
  res.status(501).json({ error: 'Proxy Not Implemented. Use Client-Side Key Mode.' });
});

app.post('/api/proxy/anthropic', (req, res) => {
  // TODO: Implement Anthropic Proxy
  res.status(501).json({ error: 'Proxy Not Implemented. Use Client-Side Key Mode.' });
});

// Start Server
app.listen(PORT, () => {
  console.log(`\n⚡ [NEUROSYNC CORE] Backend Uplink Active on port ${PORT}`);
  console.log(`   Health Check: http://localhost:${PORT}/health\n`);
});