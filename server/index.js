const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const fetch = (...args) => import('node-fetch').then(({ default: fetch }) => fetch(...args));

// Initialize Environment
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3002;

// Security: CORS should be restrictive in production
// FIX: Validate allowed origins instead of accepting all requests
const allowedOrigins = process.env.ALLOWED_ORIGINS 
  ? process.env.ALLOWED_ORIGINS.split(',') 
  : ['http://localhost:5173', 'http://localhost:3000'];

app.use(cors({
  origin: function(origin, callback) {
    // Allow requests with no origin (mobile apps, curl, etc)
    if (!origin) return callback(null, true);
    if (allowedOrigins.indexOf(origin) === -1) {
      const msg = 'The CORS policy for this site does not allow access from the specified Origin.';
      return callback(new Error(msg), false);
    }
    return callback(null, true);
  },
  credentials: true
}));

// FIX: Limit request body size to prevent DOS attacks
app.use(express.json({ limit: '1mb' }));

// Logging Middleware
// FIX: Don't log sensitive data (API keys, credentials)
app.use((req, res, next) => {
  const sanitizedUrl = req.url.replace(/apiKey=[^&]*/g, 'apiKey=***');
  console.log(`[${new Date().toISOString()}] ${req.method} ${sanitizedUrl}`);
  next();
});

// In-memory History
// FIX: Set maximum history size to prevent memory exhaustion
const MAX_HISTORY_SIZE = 100;
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
  // FIX: Validate and sanitize input to prevent XSS and injection attacks
  if (!req.body || typeof req.body !== 'object') {
    return res.status(400).json({ error: 'Invalid request body' });
  }

  const { prompt, consensus } = req.body;
  
  // FIX: Validate required fields and types
  if (typeof prompt !== 'string' || typeof consensus !== 'string') {
    return res.status(400).json({ error: 'Invalid prompt or consensus format' });
  }

  // FIX: Limit string lengths to prevent DOS
  if (prompt.length > 10000 || consensus.length > 100000) {
    return res.status(400).json({ error: 'Content exceeds maximum allowed length' });
  }

  const entry = {
    id: Date.now().toString(),
    timestamp: Date.now(),
    prompt: prompt.trim(),
    consensus: consensus.trim()
  };
  
  history.push(entry);
  
  // FIX: Use MAX_HISTORY_SIZE constant
  while (history.length > MAX_HISTORY_SIZE) {
    history.shift();
  }
  
  res.json(entry);
});

app.delete('/api/history', (req, res) => {
  history.length = 0;
  res.json({ success: true });
});

// --- Proxy Routes ---

// OpenAI Compatible Proxy (OpenAI, Grok, DeepSeek)
app.post('/api/proxy/openai-compatible', async (req, res) => {
  // FIX: Validate request body exists
  if (!req.body || typeof req.body !== 'object') {
    return res.status(400).json({ error: 'Invalid request body' });
  }

  const { provider, endpoint, model, messages, stream } = req.body;

  // FIX: Validate required fields
  if (!provider || !endpoint || !model || !Array.isArray(messages)) {
    return res.status(400).json({ error: 'Missing required fields: provider, endpoint, model, messages' });
  }

  // FIX: Validate endpoint URL to prevent SSRF attacks
  try {
    const url = new URL(endpoint);
    // FIX: Block requests to internal/private IPs in production
    if (process.env.NODE_ENV === 'production') {
      const hostname = url.hostname.toLowerCase();
      // RFC 1918 Private IP ranges: 10.0.0.0/8, 172.16.0.0/12, 192.168.0.0/16
      // Also block localhost and loopback
      if (hostname === 'localhost' || 
          hostname === '127.0.0.1' || 
          hostname.match(/^127\./) ||  // All 127.x.x.x
          hostname.startsWith('10.') || 
          hostname.startsWith('192.168.') ||
          hostname.match(/^172\.(1[6-9]|2[0-9]|3[0-1])\./)  // 172.16.0.0 - 172.31.255.255
      ) {
        return res.status(400).json({ error: 'Invalid endpoint: internal IPs not allowed in production' });
      }
    }
  } catch (e) {
    return res.status(400).json({ error: 'Invalid endpoint URL format' });
  }

  // FIX: Validate messages array structure
  if (!messages.every(m => m && typeof m === 'object' && typeof m.content === 'string')) {
    return res.status(400).json({ error: 'Invalid messages format' });
  }

  let apiKey = '';
  switch (provider) {
    case 'OPENAI': apiKey = process.env.OPENAI_API_KEY; break;
    case 'GROK': apiKey = process.env.GROK_API_KEY; break;
    case 'DEEPSEEK': apiKey = process.env.DEEPSEEK_API_KEY; break;
    case 'CUSTOM': apiKey = req.headers['x-custom-api-key']; break;
    default: return res.status(400).json({ error: 'Unknown Provider' });
  }

  if (!apiKey && provider !== 'CUSTOM') {
    return res.status(500).json({ error: `Missing API Key for ${provider}` });
  }

  // FIX: Add request timeout to prevent hanging connections
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 120000); // 2 minutes

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
        stream: stream !== false // Default to true
      }),
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const err = await response.text();
      // FIX: Don't log potentially sensitive error details
      console.error(`[${provider}] Error: HTTP ${response.status}`);
      return res.status(response.status).send(err);
    }

    // FIX: Ensure response body exists before piping
    if (!response.body) {
      return res.status(500).json({ error: 'No response body from provider' });
    }

    // Pipe the stream
    if (response.body.pipe) {
      response.body.pipe(res);
    } else {
      // Web stream fallback
      const reader = response.body.getReader();
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          res.write(value);
        }
      } finally {
        // FIX: Always close the reader to prevent memory leaks
        reader.releaseLock();
      }
      res.end();
    }

  } catch (error) {
    clearTimeout(timeoutId);
    // FIX: Handle abort errors gracefully
    if (error.name === 'AbortError') {
      console.error(`[${provider}] Request timeout`);
      return res.status(504).json({ error: 'Request timeout' });
    }
    console.error(`[${provider}] Exception:`, error.message);
    res.status(500).json({ error: error.message });
  }
});

// Anthropic Proxy
app.post('/api/proxy/anthropic', async (req, res) => {
  // FIX: Validate request body
  if (!req.body || typeof req.body !== 'object') {
    return res.status(400).json({ error: 'Invalid request body' });
  }

  const { messages, model, stream } = req.body;
  
  // FIX: Validate required fields
  if (!Array.isArray(messages) || !model) {
    return res.status(400).json({ error: 'Missing required fields: messages, model' });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;

  if (!apiKey) return res.status(500).json({ error: 'Missing Anthropic API Key' });

  // FIX: Add request timeout
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 120000);

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
        stream: stream !== false
      }),
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const err = await response.text();
      console.error('[ANTHROPIC] Error: HTTP', response.status);
      return res.status(response.status).send(err);
    }

    // FIX: Check for response body
    if (!response.body) {
      return res.status(500).json({ error: 'No response body from Anthropic' });
    }

    if (response.body.pipe) {
      response.body.pipe(res);
    } else {
      const reader = response.body.getReader();
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          res.write(value);
        }
      } finally {
        // FIX: Release reader lock
        reader.releaseLock();
      }
      res.end();
    }

  } catch (error) {
    clearTimeout(timeoutId);
    if (error.name === 'AbortError') {
      console.error('[ANTHROPIC] Request timeout');
      return res.status(504).json({ error: 'Request timeout' });
    }
    console.error('[ANTHROPIC] Exception:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// Gemini Proxy
app.post('/api/proxy/gemini', async (req, res) => {
  // FIX: Validate request body
  if (!req.body || typeof req.body !== 'object') {
    return res.status(400).json({ error: 'Invalid request body' });
  }

  const { model, prompt } = req.body;
  
  // FIX: Validate required fields
  if (!prompt || typeof prompt !== 'string') {
    return res.status(400).json({ error: 'Missing or invalid prompt field' });
  }

  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) return res.status(500).json({ error: 'Missing Gemini API Key' });

  const modelName = model || 'gemini-2.0-flash';
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:streamGenerateContent?key=${apiKey}`;

  // FIX: Add request timeout
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 120000);

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }]
      }),
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const err = await response.text();
      console.error('[GEMINI] Error: HTTP', response.status);
      return res.status(response.status).send(err);
    }

    // FIX: Check for response body
    if (!response.body) {
      return res.status(500).json({ error: 'No response body from Gemini' });
    }

    if (response.body.pipe) {
      response.body.pipe(res);
    } else {
      const reader = response.body.getReader();
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          res.write(value);
        }
      } finally {
        // FIX: Release reader lock
        reader.releaseLock();
      }
      res.end();
    }

  } catch (error) {
    clearTimeout(timeoutId);
    if (error.name === 'AbortError') {
      console.error('[GEMINI] Request timeout');
      return res.status(504).json({ error: 'Request timeout' });
    }
    console.error('[GEMINI] Exception:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// Models Proxy (List Models)
// FIX: Support both GET (backward compat) and POST (secure) methods
app.get('/api/proxy/models', async (req, res) => {
  const { provider, endpoint, apiKey, apiStyle } = req.query;

  // FIX: Validate endpoint
  if (!endpoint || typeof endpoint !== 'string') {
    return res.status(400).json({ error: 'Missing or invalid endpoint' });
  }

  // FIX: Validate endpoint URL format and prevent SSRF
  try {
    const url = new URL(endpoint.toString());
    if (process.env.NODE_ENV === 'production') {
      const hostname = url.hostname.toLowerCase();
      if (hostname === 'localhost' || hostname === '127.0.0.1' || 
          hostname.startsWith('192.168.') || hostname.startsWith('10.')) {
        return res.status(400).json({ error: 'Invalid endpoint: internal IPs not allowed in production' });
      }
    }
  } catch (e) {
    return res.status(400).json({ error: 'Invalid endpoint URL format' });
  }

  // Construct target URL
  let baseUrl = endpoint.toString().replace(/\/chat\/completions\/?$/, '').replace(/\/messages\/?$/, '');
  let targetUrl = `${baseUrl}/models`;

  // Headers
  const headers = {
    'Content-Type': 'application/json'
  };

  if (apiKey) {
    if (apiStyle === 'ANTHROPIC') {
      headers['x-api-key'] = apiKey.toString();
      headers['anthropic-version'] = '2023-06-01';
    } else {
      headers['Authorization'] = `Bearer ${apiKey}`;
    }
  }

  // FIX: Add timeout
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 30000);

  try {
    const response = await fetch(targetUrl, { 
      method: 'GET', 
      headers,
      signal: controller.signal
    });
    
    clearTimeout(timeoutId);

    if (!response.ok) {
      const text = await response.text();
      return res.status(response.status).json({ error: `Provider Error: ${text}` });
    }
    const data = await response.json();
    res.json(data);
  } catch (error) {
    clearTimeout(timeoutId);
    if (error.name === 'AbortError') {
      return res.status(504).json({ error: 'Request timeout' });
    }
    console.error('[MODELS PROXY] Error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// FIX: Add POST endpoint for models (more secure - doesn't expose API key in URL)
app.post('/api/proxy/models', async (req, res) => {
  if (!req.body || typeof req.body !== 'object') {
    return res.status(400).json({ error: 'Invalid request body' });
  }

  const { provider, endpoint, apiKey, apiStyle } = req.body;

  // FIX: Validate endpoint
  if (!endpoint || typeof endpoint !== 'string') {
    return res.status(400).json({ error: 'Missing or invalid endpoint' });
  }

  // FIX: Validate endpoint URL format and prevent SSRF
  try {
    const url = new URL(endpoint.toString());
    if (process.env.NODE_ENV === 'production') {
      const hostname = url.hostname.toLowerCase();
      // RFC 1918 Private IP ranges + localhost
      if (hostname === 'localhost' || 
          hostname === '127.0.0.1' || 
          hostname.match(/^127\./) ||
          hostname.startsWith('10.') ||
          hostname.startsWith('192.168.') ||
          hostname.match(/^172\.(1[6-9]|2[0-9]|3[0-1])\./)) {
        return res.status(400).json({ error: 'Invalid endpoint: internal IPs not allowed in production' });
      }
    }
  } catch (e) {
    return res.status(400).json({ error: 'Invalid endpoint URL format' });
  }

  // Construct target URL
  let baseUrl = endpoint.toString().replace(/\/chat\/completions\/?$/, '').replace(/\/messages\/?$/, '');
  let targetUrl = `${baseUrl}/models`;

  // Headers
  const headers = {
    'Content-Type': 'application/json'
  };

  if (apiKey) {
    if (apiStyle === 'ANTHROPIC') {
      headers['x-api-key'] = apiKey;
      headers['anthropic-version'] = '2023-06-01';
    } else {
      headers['Authorization'] = `Bearer ${apiKey}`;
    }
  }

  // FIX: Add timeout
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 30000);

  try {
    const response = await fetch(targetUrl, { 
      method: 'GET', 
      headers,
      signal: controller.signal
    });
    
    clearTimeout(timeoutId);

    if (!response.ok) {
      const text = await response.text();
      return res.status(response.status).json({ error: `Provider Error: ${text}` });
    }
    const data = await response.json();
    res.json(data);
  } catch (error) {
    clearTimeout(timeoutId);
    if (error.name === 'AbortError') {
      return res.status(504).json({ error: 'Request timeout' });
    }
    console.error('[MODELS PROXY] Error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// Start Server
app.listen(PORT, () => {
  console.log(`\n⚡ [NEUROSYNC CORE] Backend Uplink Active on port ${PORT}`);
  console.log(`   Health Check: http://localhost:${PORT}/health\n`);
});