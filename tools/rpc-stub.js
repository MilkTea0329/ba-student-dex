// Test-only stub for the native bridge: exposes POST /rpc that performs the
// real HTTP request (Node has no CORS) and returns {status, b64}.
// api.github.com is faked so the update dialog can be exercised offline:
//   GET /mode?tag=v1.1.0   -> change the faked latest tag
//   GET /mode?off=1        -> make the API fail (network error path)
const http = require('http');

const UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1';

let fakeTag = 'v1.1.0';
let fakeOff = false;

function fakeRelease(tag) {
  return {
    tag_name: tag,
    name: '什亭之匣 ' + tag,
    html_url: 'https://github.com/MilkTea0329/ba-student-dex/releases/tag/' + tag,
    published_at: '2026-11-09T00:00:00Z',
    body: [
      '## 什亭之匣 ' + tag,
      '',
      '本次更新内容：',
      '',
      '- 新增「资料变更检测」，WIKI 改动会自动同步',
      '- 优化左滑返回手势',
      '**修复**若干已知问题',
      '',
      '下载 ipa 后需要自签才能安装，教程见仓库根目录的安装文档。'
    ].join('\n')
  };
}

const server = http.createServer(async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS, GET');
  if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }

  // 测试控制端点
  if (req.method === 'GET' && req.url.indexOf('/mode') === 0) {
    const u = new URL(req.url, 'http://x');
    if (u.searchParams.get('tag')) fakeTag = u.searchParams.get('tag');
    if (u.searchParams.get('off')) fakeOff = u.searchParams.get('off') === '1';
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ tag: fakeTag, off: fakeOff }));
    return;
  }

  let body = '';
  for await (const chunk of req) body += chunk;

  try {
    const msg = JSON.parse(body || '{}');

    if (msg.url && msg.url.indexOf('api.github.com') >= 0) {
      if (fakeOff) throw new Error('fake network off');
      const payload = JSON.stringify(fakeRelease(fakeTag));
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ status: 200, b64: Buffer.from(payload).toString('base64') }));
      console.log('[rpc] FAKE github release', fakeTag);
      return;
    }

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
