// Test-only stub for the native bridge: exposes POST /rpc that performs the
// real HTTP request (Node has no CORS) and returns {status, b64}.
// Used by web/_test.html to exercise web/sync.js in a desktop browser.
const http = require('http');

const UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1';

const server = http.createServer(async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }

  let body = '';
  for await (const chunk of req) body += chunk;

  try {
    const msg = JSON.parse(body || '{}');
    const headers = Object.assign({ 'User-Agent': UA }, msg.headers || {});
    const r = await fetch(msg.url, { headers });
    const buf = Buffer.from(await r.arrayBuffer());
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: r.status, b64: buf.toString('base64') }));
    console.log('[rpc]', r.status, buf.length, msg.url.slice(0, 90));
  } catch (e) {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 0, b64: '' }));
    console.log('[rpc] FAIL', e.message);
  }
});

server.listen(8899, () => console.log('rpc stub on http://127.0.0.1:8899'));
