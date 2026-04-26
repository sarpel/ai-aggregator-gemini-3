import express from 'express';
const app = express();
app.use(express.json());
app.post('/test', (req: any, res: any) => {
  console.log('socket.destroyed BEFORE await:', req.socket?.destroyed);
  res.setHeader('Content-Type','text/event-stream');
  res.setHeader('Cache-Control','no-cache');
  res.setHeader('Connection','keep-alive');
  setTimeout(() => {
    console.log('socket.destroyed 50ms AFTER:', req.socket?.destroyed);
    res.write('data: hello\n\n');
    res.end();
  }, 50);
});
const srv = app.listen(9997, async () => {
  try {
    const r = await fetch('http://localhost:9997/test', {
      method:'POST', headers:{'Content-Type':'application/json'}, body: '{"a":1}'
    });
    const text = await r.text();
    console.log('Client got body len:', text.length, '| content:', JSON.stringify(text));
  } catch (err) {
    console.error('socket_test fetch error:', err instanceof Error ? err.message : String(err));
  } finally {
    srv.close();
  }
});
