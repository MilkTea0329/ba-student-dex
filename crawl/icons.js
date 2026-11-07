// Download shared UI icons (position / tactic) used inside the wiki tables and
// group them by content hash so we can map each cluster to a human label.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ROOT = path.resolve(__dirname, '..');
const RAW = path.join(ROOT, 'data', 'raw');
const CACHE = path.join(ROOT, 'cache', 'icons');
fs.mkdirSync(CACHE, { recursive: true });

const H = { 'User-Agent': 'Mozilla/5.0', 'Referer': 'https://www.gamekee.com/' };

async function dl(url) {
  const name = crypto.createHash('sha1').update(url).digest('hex') + '.png';
  const p = path.join(CACHE, name);
  if (fs.existsSync(p)) return fs.readFileSync(p);
  for (let i = 0; i < 3; i++) {
    try {
      const r = await fetch(url.startsWith('//') ? 'https:' + url : url, { headers: H });
      if (r.status !== 200) throw new Error('HTTP ' + r.status);
      const buf = Buffer.from(await r.arrayBuffer());
      fs.writeFileSync(p, buf);
      return buf;
    } catch (e) { await new Promise((r) => setTimeout(r, 300)); }
  }
  return null;
}

(async () => {
  const files = fs.readdirSync(RAW);
  const tasks = [];
  const rows = [];
  for (const f of files) {
    const j = JSON.parse(fs.readFileSync(path.join(RAW, f), 'utf8'));
    const pos = (j.rows[10] || []).find((c) => c.t === 'i');
    const tac = (j.rows[3] || []).find((c) => c.t === 'i');
    rows.push({ id: j.entryId, title: j.title, pos: pos && pos.v, tac: tac && tac.v });
    if (pos) tasks.push(pos.v);
    if (tac) tasks.push(tac.v);
  }
  const uniq = [...new Set(tasks)];
  console.log('unique icon urls', uniq.length);
  const map = new Map();
  let i = 0;
  const CONC = 8;
  await Promise.all(Array.from({ length: CONC }, async () => {
    while (i < uniq.length) {
      const u = uniq[i++];
      const buf = await dl(u);
      map.set(u, buf ? crypto.createHash('sha256').update(buf).digest('hex').slice(0, 16) : 'ERR');
    }
  }));
  const groups = {};
  for (const [u, h] of map) {
    groups[h] = groups[h] || { hash: h, urls: [], students: [] };
    groups[h].urls.push(u);
  }
  for (const r of rows) {
    if (r.pos && map.get(r.pos)) groups[map.get(r.pos)].students.push(r.title + '|POS');
    if (r.tac && map.get(r.tac)) groups[map.get(r.tac)].students.push(r.title + '|TAC');
  }
  const out = Object.values(groups).map((g) => ({ hash: g.hash, sample: g.urls[0], count: g.students.length, pos: g.students.filter((s) => s.endsWith('|POS')).length, tac: g.students.filter((s) => s.endsWith('|TAC')).length, students: g.students.slice(0, 6) }));
  out.sort((a, b) => b.count - a.count);
  console.log(JSON.stringify(out.map(({ students, urls, ...rest }) => ({ ...rest, students })), null, 1));
  fs.writeFileSync(path.join(ROOT, 'data', 'icon_groups.json'), JSON.stringify({ groups: out, map: Object.fromEntries(map) }, null, 1));
})();
