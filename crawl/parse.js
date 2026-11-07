// Build data/build/students/*.json from the raw wiki tables.
// The parsing itself lives in web/parser-core.js so the browser (in-app sync)
// and this Node build use exactly the same code.
const fs = require('fs');
const path = require('path');
const BAParse = require('../web/parser-core.js');

const ROOT = path.resolve(__dirname, '..');
const RAW = path.join(ROOT, 'data', 'raw');
const OUT = path.join(ROOT, 'data', 'build');
fs.mkdirSync(path.join(OUT, 'students'), { recursive: true });

const iconGroups = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'icon_groups.json'), 'utf8'));
BAParse.setIconMap(iconGroups.map);

// WIKI 日期是 "2026/9/23" 这种不补零的格式，必须按数值比较，
// 否则 9/23 会排在 10/28 前面。
function dateKey(v) {
  const m = String(v == null ? '' : v).match(/(\d{4})\D+(\d{1,2})\D+(\d{1,2})/);
  return m ? (+m[1]) * 10000 + (+m[2]) * 100 + (+m[3]) : -1;
}

function main() {
  const files = fs.readdirSync(RAW).filter((f) => f.endsWith('.json'));
  const index = [];
  let bytes = 0;
  for (const f of files) {
    const raw = JSON.parse(fs.readFileSync(path.join(RAW, f), 'utf8'));
    const s = BAParse.parseStudent(raw);
    const json = JSON.stringify(s);
    bytes += json.length;
    fs.writeFileSync(path.join(OUT, 'students', s.id + '.json'), json);
    index.push(BAParse.summarize(s));
  }
  index.sort((a, b) =>
    dateKey(b.releaseDate) - dateKey(a.releaseDate) ||
    a.name.localeCompare(b.name, 'zh'));
  fs.writeFileSync(path.join(OUT, 'index.json'), JSON.stringify(index));
  console.log('students', index.length, 'detail MB', (bytes / 1048576).toFixed(2));
  console.log('newest 3:', index.slice(0, 3).map((s) => s.name + ' ' + s.releaseDate).join(' | '));
}

main();
