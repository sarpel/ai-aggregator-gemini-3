import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';

/**
 * A lightweight HTTP server that returns mock SSE responses in
 * OpenAI, Anthropic, and Gemini streaming formats.
 */
export interface MockLLMServer {
  /** Start the server and resolve with the base URL. */
  start(): Promise<string>;
  /** Stop the server. */
  stop(): Promise<void>;
  /** Base URL (available after start). */
  url: string;
  /** Number of requests received per endpoint path. */
  requestCounts: Record<string, number>;
  /** Force next response to be an error (status code). */
  nextErrorStatus: number | null;
}

function writeSSE(res: ServerResponse, chunks: string[], delayMs = 0): Promise<void> {
  return new Promise((resolve) => {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    });

    let index = 0;

    function writeNext(): void {
      if (index < chunks.length) {
        res.write(chunks[index]);
        index++;
        if (delayMs > 0) {
          setTimeout(writeNext, delayMs);
        } else {
          writeNext();
        }
      } else {
        res.end();
        resolve();
      }
    }

    writeNext();
  });
}

function collectBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const parts: Buffer[] = [];
    let settled = false;

    const cleanup = (): void => {
      req.off('data', onData);
      req.off('end', onEnd);
      req.off('error', onError);
      req.off('close', onClose);
    };

    const settle = (callback: () => void): void => {
      if (settled) {
        return;
      }

      settled = true;
      cleanup();
      callback();
    };

    const onData = (chunk: Buffer): void => {
      parts.push(chunk);
    };
    const onEnd = (): void => settle(() => resolve(Buffer.concat(parts).toString('utf8')));
    const onError = (err: Error): void => settle(() => reject(err));
    const onClose = (): void => {
      if (!req.complete) {
        settle(() => reject(new Error('Request closed before body was fully received')));
      }
    };

    req.on('data', onData);
    req.on('end', onEnd);
    req.on('error', onError);
    req.on('close', onClose);
  });
}

export function createMockLLMServer(): MockLLMServer {
  let server: Server | null = null;
  let baseUrl = '';
  const requestCounts: Record<string, number> = {};
  let nextErrorStatus: number | null = null;

  const openaiChunks = [
    'data: {"choices":[{"delta":{"content":"Hello"}}]}\n\n',
    'data: {"choices":[{"delta":{"content":" world"}}]}\n\n',
    'data: [DONE]\n\n',
  ];

  const anthropicChunks = [
    'data: {"type":"content_block_delta","delta":{"type":"text_delta","text":"Hello"}}\n\n',
    'data: {"type":"content_block_delta","delta":{"type":"text_delta","text":" world"}}\n\n',
    'data: {"type":"message_stop"}\n\n',
  ];

  // Gemini format: the proxy handler uses @google/genai SDK internally,
  // but for integration tests we mock the SDK. This endpoint is for direct
  // SSE testing if needed.
  const geminiChunks = [
    'data: {"text":"Hello"}\n\n',
    'data: {"text":" world"}\n\n',
    'data: [DONE]\n\n',
  ];

  async function handleRequest(req: IncomingMessage, res: ServerResponse): Promise<void> {
    const path = req.url ?? '/';
    requestCounts[path] = (requestCounts[path] ?? 0) + 1;

    // Consume body to prevent socket hang
    await collectBody(req);

    if (nextErrorStatus !== null) {
      const status = nextErrorStatus;
      nextErrorStatus = null;
      res.writeHead(status, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: `Mock error ${status}` }));
      return;
    }

    if (path.includes('/openai') || path.includes('/v1/chat/completions')) {
      await writeSSE(res, openaiChunks);
    } else if (path.includes('/anthropic') || path.includes('/v1/messages')) {
      await writeSSE(res, anthropicChunks);
    } else if (path.includes('/gemini')) {
      await writeSSE(res, geminiChunks);
    } else {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Unknown endpoint' }));
    }
  }

  return {
    requestCounts,
    get url() {
      return baseUrl;
    },
    get nextErrorStatus() {
      return nextErrorStatus;
    },
    set nextErrorStatus(status: number | null) {
      nextErrorStatus = status;
    },

    start(): Promise<string> {
      return new Promise((resolve, reject) => {
        server = createServer((req, res) => {
          handleRequest(req, res).catch((err) => {
            console.error('[MockLLMServer] Unhandled error in request handler:', err);
            if (!res.headersSent) {
              res.writeHead(500, { 'Content-Type': 'application/json' });
            }
            res.end(JSON.stringify({ error: 'Internal mock server error' }));
          });
        });

        server.listen(0, '127.0.0.1', () => {
          const addr = server!.address();
          if (addr && typeof addr === 'object') {
            baseUrl = `http://127.0.0.1:${addr.port}`;
            resolve(baseUrl);
          } else {
            reject(new Error('Failed to get server address'));
          }
        });

        server.on('error', reject);
      });
    },

    stop(): Promise<void> {
      return new Promise((resolve, reject) => {
        if (!server) {
          resolve();
          return;
        }
        server.close((err) => {
          server = null;
          if (err) reject(err);
          else resolve();
        });
      });
    },
  };
}
