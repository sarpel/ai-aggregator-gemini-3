const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const fetch = (...args) => import('node-fetch').then(({ default: fetch }) => fetch(...args)); // Dynamic import for node-fetch if needed, or use global fetch if Node 18+

// Initialize Environment
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());

// Logging Middleware
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  next();
});

// In-memory History (Simple persistence for this session)
const history = [];

// --- System Routes ---

// Health Check
app.get('/health', (req, res) => {
  res.json({
    status: 'ONLINE',
    system: 'NeuroSync Core',
    timestamp: Date.now(),
    version: '1.0.0'
  });
});

// History Routes
app.get('/api/history', (req, res) => {
  res.json(history);
});

app.post('/api/history', (req, res) => {
  const entry = {
    id: Date.now().toString(),
    timestamp: Date.now(),
    ...req.body
  };
  history.push(entry);
  // Keep only last 50
  if (history.length > 50) history.shift();
  res.json(entry);
});

app.delete('/api/history', (req, res) => {
  history.length = 0;
  res.json({ success: true });
});

// --- Proxy Routes ---

// Helper for streaming responses
const streamResponse = async (fetchPromise, res) => {
  try {
    const response = await fetchPromise;

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Upstream API Error:', response.status, errorText);
      return res.status(response.status).json({ error: `Upstream Error: ${errorText}` });
    }

    // Forward headers
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    if (response.body) {
      // Node 18+ fetch body is a ReadableStream, but we might need to handle it as a Node stream
      // If using node-fetch, it's a Node stream. If global fetch, it's a Web Stream.
      // Let's assume global fetch (Node 18+) for now, or handle both.

      const reader = response.body.getReader ? response.body.getReader() : null;

      if (reader) {
        // Web Stream (Node 18+ global fetch)
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          res.write(value);
        }
        res.end();
      } else {
        // Node Stream (node-fetch)
        response.body.pipe(res);
      }
    } else {
      res.end();
    }
  } catch (error) {
    console.error('Proxy Error:', error);
    if (!res.headersSent) {
      res.status(500).json({ error: error.message });
    } else {
      res.end();
    }
  }
};

// OpenAI Compatible Proxy (OpenAI, Grok, DeepSeek)
app.post('/api/proxy/openai-compatible', async (req, res) => {
  const { provider, endpoint, model, messages, stream } = req.body;

  let apiKey = '';
  switch (provider) {
    case 'OPENAI': apiKey = process.env.OPENAI_API_KEY; break;
    case 'GROK': apiKey = process.env.GROK_API_KEY; break;
    case 'DEEPSEEK': apiKey = process.env.DEEPSEEK_API_KEY; break;
    case 'CUSTOM': apiKey = req.headers['x-custom-api-key']; break; // Allow custom key for custom endpoint
    default: return res.status(400).json({ error: 'Unknown Provider' });
  }

  if (!apiKey && provider !== 'CUSTOM') {
    return res.status(500).json({ error: `Missing API Key for ${provider}` });
  }

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model,
        messages,
        stream: stream || true
      })
    });

    if (!response.ok) {
      const err = await response.text();
      console.error(`[${provider}] Error:`, err);
      return res.status(response.status).send(err);
    }

    // Pipe the stream
    if (response.body.pipe) {
      response.body.pipe(res);
    } else {
      // Web stream fallback
      const reader = response.body.getReader();
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        res.write(value);
      }
      res.end();
    }

  } catch (error) {
    console.error(`[${provider}] Exception:`, error);
    res.status(500).json({ error: error.message });
  }
});

// Anthropic Proxy
app.post('/api/proxy/anthropic', async (req, res) => {
  const { messages, model, stream } = req.body;
  const apiKey = process.env.ANTHROPIC_API_KEY;

  if (!apiKey) return res.status(500).json({ error: 'Missing Anthropic API Key' });

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: model || 'claude-3-sonnet-20240229',
        messages,
        max_tokens: 4096,
        stream: stream || true
      })
    });

    if (!response.ok) {
      const err = await response.text();
      console.error('[ANTHROPIC] Error:', err);
      return res.status(response.status).send(err);
    }

    if (response.body.pipe) {
      response.body.pipe(res);
    } else {
      const reader = response.body.getReader();
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        res.write(value);
      }
      res.end();
    }

  } catch (error) {
    console.error('[ANTHROPIC] Exception:', error);
    res.status(500).json({ error: error.message });
  }
});

// Gemini Proxy
app.post('/api/proxy/gemini', async (req, res) => {
  const { prompt, model } = req.body;
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) return res.status(500).json({ error: 'Missing Gemini API Key' });

  // Using REST API for Gemini to avoid server-side SDK complexity for now, 
  // and to easily pipe the stream.
  const modelName = model || 'gemini-2.0-flash';
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:streamGenerateContent?key=${apiKey}`;

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }]
      })
    });

    if (!response.ok) {
      const err = await response.text();
      console.error('[GEMINI] Error:', err);
      return res.status(response.status).send(err);
    }

    if (response.body.pipe) {
      response.body.pipe(res);
    } else {
      const reader = response.body.getReader();
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        res.write(value);
      }
      res.end();
    }

  } catch (error) {
    console.error('[GEMINI] Exception:', error);
    res.status(500).json({ error: error.message });
  }
});

// Start Server
app.listen(PORT, () => {
  console.log(`\n⚡ [NEUROSYNC CORE] Backend Uplink Active on port ${PORT}`);
  console.log(`   Health Check: http://localhost:${PORT}/health\n`);
});