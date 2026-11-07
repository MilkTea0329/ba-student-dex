// Crawl Blue Archive student data from gamekee wiki.
// Usage: node crawl/crawl.js
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const RAW_DIR = path.join(ROOT, 'data', 'raw');
fs.mkdirSync(RAW_DIR, { recursive: true });

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';
const H = {
  'User-Agent': UA,
  'Referer': 'https://www.gamekee.com/ba/second/23941',
  'game-alias': 'ba',
  'Accept': 'application/json,*/*',
};
const CDNH = { ...H, Referer: 'https://www.gamekee.com/', Origin: 'https://www.gamekee.com' };

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function fetchJSON(url, headers, tries = 4) {
  let err;
  for (let i = 0; i < tries; i++) {
    try {
      const r = await fetch(url, { headers });
      const t = await r.text();
      if (r.status !== 200) throw new Error('HTTP ' + r.status);
      return JSON.parse(t);
    } catch (e) {
      err = e;
      await sleep(400 * (i + 1) + Math.random() * 300);
    }
  }
  throw err;
}

async function fetchText(url, headers, tries = 4) {
  let err;
  for (let i = 0; i < tries; i++) {
    try {
      const r = await fetch(url, { headers });
      const t = await r.text();
      if (r.status !== 200) throw new Error('HTTP ' + r.status);
      if (t.startsWith('<!doctype') || t.startsWith('<html')) throw new Error('anti-bot page');
      return t;
    } catch (e) {
      err = e;
      await sleep(500 * (i + 1) + Math.random() * 400);
    }
  }
  throw err;
}

function compactRows(baseData) {
  // Keep the original column index (c) so cell positions stay meaningful.
  return baseData.map((row) => {
    const cells = [];
    for (let i = 0; i < row.length; i++) {
      const c = row[i];
      let v = c.value;
      if (v === undefined || v === null) v = '';
      v = String(v);
      if (!v.trim()) continue;
      const cell = { c: i, v, t: c.type === 'image' ? 'i' : c.type === 'text' ? 't' : c.type };
      if (c.isGlobal) cell.g = 1;
      cells.push(cell);
    }
    return cells;
  });
}

async function getStudent(item) {
  const d = await fetchJSON(`https://www.gamekee.com/v1/content/detail/${item.content_id}`, H);
  if (!d.data) throw new Error('no data');
  const data = d.data;
  let inner = null;
  if (data.content_cdn) {
    const cdnUrl = data.content_cdn.startsWith('//') ? 'https:' + data.content_cdn : data.content_cdn;
    const txt = await fetchText(cdnUrl, CDNH);
    const o = JSON.parse(txt);
    inner = typeof o.content === 'string' ? JSON.parse(o.content) : o;
  } else if (data.content_json) {
    inner = JSON.parse(data.content_json);
  }
  if (!inner || !Array.isArray(inner.baseData)) throw new Error('no baseData');
  return {
    entryId: item.id,
    contentId: item.content_id,
    title: data.title,
    summary: data.summary || '',
    updatedAt: data.updated_at,
    icon: item.icon,
    nameAlias: item.alias || '',
    rows: compactRows(inner.baseData),
  };
}

async function main() {
  const index = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'students_index.json'), 'utf8'));
  const only = process.argv[2] ? Number(process.argv[2]) : null;
  const list = only ? index.filter((s) => s.id === only) : index;
  let done = 0, fail = [];
  const queue = [...list];
  const CONC = 6;

  async function worker(id) {
    while (queue.length) {
      const item = queue.shift();
      const out = path.join(RAW_DIR, item.id + '.json');
      if (fs.existsSync(out) && fs.statSync(out).size > 5000) { done++; continue; }
      try {
        const s = await getStudent(item);
        fs.writeFileSync(out, JSON.stringify(s));
        done++;
        if (done % 10 === 0) console.log(`[${done}/${list.length}] ${item.name}`);
      } catch (e) {
        fail.push({ id: item.id, name: item.name, err: e.message });
        console.log('FAIL', item.name, e.message);
      }
      await sleep(120 + Math.random() * 120);
    }
  }

  await Promise.all(Array.from({ length: CONC }, (_, i) => worker(i)));
  console.log(`DONE ${done}, FAIL ${fail.length}`);
  if (fail.length) fs.writeFileSync(path.join(ROOT, 'data', 'crawl_fail.json'), JSON.stringify(fail, null, 1));
}

main().catch((e) => { console.error(e); process.exit(1); });
