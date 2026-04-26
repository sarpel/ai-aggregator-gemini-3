import cors from 'cors';
import dotenv from 'dotenv';
import express, { type Request, type Response } from 'express';
import { initDb } from './db.js';
import { handleAnthropicProxy, handleGeminiProxy, handleOpenAIProxy } from './proxy.js';
import modelRoutes from './routes.js';

// Initialize Environment
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors({
  origin: ['http://localhost:3000', 'http://localhost:5173'],
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  credentials: true,
}));
app.use(express.json({ limit: '100kb' }));
app.use('/api', modelRoutes);

// --- System Routes ---

// Health Check (Heartbeat)
app.get('/health', (_req: Request, res: Response) => {
  res.json({
    status: 'ONLINE',
    system: 'NeuroSync Core',
    timestamp: Date.now(),
    version: '1.0.0'
  });
});

app.post('/api/proxy/openai', handleOpenAIProxy);
app.post('/api/proxy/anthropic', handleAnthropicProxy);
app.post('/api/proxy/gemini', handleGeminiProxy);

// Start Server
async function startServer(): Promise<void> {
  try {
    await initDb();

    app.listen(PORT, () => {
      console.log(`\n⚡ [NEUROSYNC CORE] Backend Uplink Active on port ${PORT}`);
      console.log(`   Health Check: http://localhost:${PORT}/health\n`);
    });
  } catch (error) {
    console.error('[startServer] Fatal error during startup (initDb/PORT):', error);
    process.exit(1);
  }
}

void startServer();
