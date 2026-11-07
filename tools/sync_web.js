// Copy the built web app into the iOS bundle resources.
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const SRC = path.join(ROOT, 'web');
const DEST = path.join(ROOT, 'StudentDex', 'Resources', 'Web');
const ICON = path.join(ROOT, 'build-tools', 'generated', 'icon-1024.png');
const ICON_DEST = path.join(ROOT, 'StudentDex', 'Resources', 'Assets.xcassets', 'AppIcon.appiconset', 'icon-1024.png');

function copyDir(from, to) {
  fs.mkdirSync(to, { recursive: true });
  for (const f of fs.readdirSync(from)) {
    if (f.charAt(0) === '_') continue; // dev/test-only files (e.g. _test.html)
    const a = path.join(from, f);
    const b = path.join(to, f);
    if (fs.statSync(a).isDirectory()) copyDir(a, b);
    else fs.copyFileSync(a, b);
  }
}

fs.rmSync(DEST, { recursive: true, force: true });
copyDir(SRC, DEST);
fs.copyFileSync(ICON, ICON_DEST);

let bytes = 0;
let files = 0;
(function walk(dir) {
  for (const f of fs.readdirSync(dir)) {
    const p = path.join(dir, f);
    const st = fs.statSync(p);
    if (st.isDirectory()) walk(p);
    else { bytes += st.size; files++; }
  }
})(DEST);
console.log('synced', files, 'files,', (bytes / 1048576).toFixed(1), 'MB ->', DEST);
