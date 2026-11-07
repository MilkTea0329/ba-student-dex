// Parse the raw wiki tables (570 rows per student, fixed template)
// into a structured JSON database used by the iOS app / web preview.
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const RAW = path.join(ROOT, 'data', 'raw');
const OUT = path.join(ROOT, 'data', 'build');
fs.mkdirSync(path.join(OUT, 'students'), { recursive: true });

const ICON_GROUPS = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'icon_groups.json'), 'utf8'));
const ICON_LABEL = {
  'a7988774d4b347e1': 'STRIKER', '6f4366f6bca47e12': 'STRIKER', '1557215891c1e697': 'STRIKER',
  'fdaca2580c8db24d': 'BACK', '554848c8951ae562': 'BACK', '321ddff3ff84406b': 'BACK',
  'cbee79f02729d862': 'MIDDLE', '6225eff195ee53bc': 'MIDDLE', 'ca2c05340874014e': 'MIDDLE',
  '47a8320bf18d46d4': 'MIDDLE', 'b67d9e3aaeb22b6e': 'MIDDLE', '2b947b5dd57d0f50': 'MIDDLE',
  '719b1007be0bbf65': 'MIDDLE',
  '57a98b3d8e512096': 'FRONT', 'ab9bf5d4e7edacf5': 'FRONT', 'c45b6046f28d5155': 'FRONT',
  '71a3369b0edc6ef9': 'FRONT', '3c33b1bd73f06601': 'FRONT',
  '204715b69264f888': 'SPECIAL', 'a5dc4e0c3773632b': 'SPECIAL', '72200c5083b3a117': 'SPECIAL',
  'e99f72a5e100eadb': 'SPECIAL', 'ee89c2f2c90a2017': 'SPECIAL', 'c86b383e5a832fc2': 'SPECIAL',
};

const clean = (s) => String(s == null ? '' : s).replace(/\u00a0/g, ' ').replace(/[ \t]+/g, ' ').trim();

// The wiki uses a few inconsistent school / role spellings; normalise them.
const SCHOOL_ALIAS = {
  '三一综合学院': '三一综合学园',
  '百鬼夜行综合学院': '百鬼夜行联合学院',
  '阿拜多斯高等学校': '阿拜多斯高中',
  '崔尼蒂综合学园': '三一综合学园',
  '格黑娜学园': '格黑娜学园',
};
const ROLE_ALIAS = { 'T.S': '支援', 'TS': '支援' };
const normSchool = (v) => SCHOOL_ALIAS[v] || v;
const normRole = (v) => ROLE_ALIAS[v] || v;
const url = (u) => (!u ? '' : u.startsWith('//') ? 'https:' + u : u);

function helpers(rows) {
  const label = (row) => {
    if (!row || !row.length) return '';
    const g = row.find((c) => c.g);
    return clean((g || row[0]).v);
  };
  const col = (row, i) => {
    const c = (row || []).find((x) => x.c === i);
    return c ? clean(c.v) : '';
  };
  const raw = (row, i) => {
    const c = (row || []).find((x) => x.c === i);
    return c || null;
  };
  return { label, col, raw };
}

function imgOf(row) {
  const c = (row || []).find((x) => x.t === 'i');
  return c ? url(c.v) : '';
}

function hashOfUrl(u) {
  const m = ICON_GROUPS.map[u];
  return m ? ICON_LABEL[m] || '' : '';
}

function kvPairs(row, startCol) {
  const cells = (row || []).filter((c) => c.t === 't' && c.c >= (startCol || 0));
  const out = [];
  for (let i = 0; i + 1 < cells.length; i += 2) {
    const k = clean(cells[i].v);
    const v = clean(cells[i + 1].v);
    if (k) out.push({ name: k, value: v });
  }
  return out;
}

function parseSkillBlock(rows, i) {
  // block: 技能类型 / 技能名称 / 技能图标 / 技能描述 / LV1..n (+ 技能COST for EX)
  const { label, col } = helpers(rows);
  const skill = { kindLabel: '', name: '', icon: '', levels: [] };
  let j = i;
  while (j < rows.length) {
    const l = label(rows[j]);
    if (j > i && l === '技能类型') break;
    if (l === '技能类型') skill.kindLabel = col(rows[j], 1);
    else if (l === '技能名称') skill.name = col(rows[j], 1);
    else if (l === '技能图标') skill.icon = imgOf(rows[j]);
    else if (l === '技能描述') { /* description text lives in the level rows */ }
    else if (/^LV\d+$/.test(l)) {
      const lv = Number(l.replace('LV', ''));
      const entry = { lv, text: col(rows[j], 1) };
      const next = rows[j + 1];
      if (next && label(next) === '技能COST') {
        entry.cost = col(next, 1);
        j++;
      }
      skill.levels.push(entry);
    } else break;
    j++;
  }
  return { skill, next: j };
}

function parseMaterials(rows, start, count) {
  const { label, col, raw } = helpers(rows);
  const out = [];
  let i = start;
  while (i < rows.length && label(rows[i]) !== '其他技能升级材料' && label(rows[i]) !== '技能名词') {
    const l = label(rows[i]);
    if (/^LV\d+$/.test(l)) {
      const lv = Number(l.replace('LV', ''));
      const imgs = (rows[i] || []).filter((c) => c.t === 'i');
      const nums = rows[i + 1] || [];
      const items = [];
      for (const im of imgs) {
        const numCell = nums.find((c) => c.c === im.c);
        const n = numCell ? clean(numCell.v) : '';
        if (n) items.push({ icon: url(im.v), count: n });
        else items.push({ icon: url(im.v), count: '' });
      }
      out.push({ lv, items });
      i += 2;
      continue;
    }
    if (l === '所需个数' || l === '') { i++; continue; }
    break;
  }
  return { out, next: i };
}

function parseStudent(raw) {
  const rows = raw.rows;
  const { label, col, raw: rc } = helpers(rows);
  const s = {};

  s.id = raw.entryId;
  s.contentId = raw.contentId;
  s.name = col(rows[0], 1) || raw.title;
  s.avatarRemote = url(raw.icon);
  s.aliases = clean(raw.nameAlias).split(',').map((x) => x.trim()).filter(Boolean);
  s.summary = clean(raw.summary);
  s.updatedAt = raw.updatedAt;

  const rarityRaw = col(rows[2], 1);
  s.rarity = Number((rarityRaw.match(/\d/) || [3])[0]);
  s.tactic = hashOfUrl(col(rows[3], 2)) || '';
  s.school = normSchool(col(rows[4], 1));
  s.schoolIcon = imgOf(rows[4]);
  s.club = col(rows[5], 1);
  s.releaseDate = col(rows[6], 1);
  s.role = normRole(col(rows[7], 1));
  s.roleIcon = imgOf(rows[7]);
  s.attack = col(rows[8], 1);
  s.attackIcon = imgOf(rows[8]);
  s.defense = col(rows[9], 1);
  s.defenseIcon = imgOf(rows[9]);
  s.position = hashOfUrl(col(rows[10], 2)) || '';
  s.terrain = { urban: col(rows[11], 1), outdoor: col(rows[12], 1), indoor: col(rows[13], 1) };
  s.weaponType = col(rows[14], 1);
  s.weaponIcon = imgOf(rows[14]);
  s.equipment = [col(rows[15], 1), col(rows[16], 1), col(rows[17], 1)].filter(Boolean);

  s.portraits = [];
  for (let i = 19; i <= 24; i++) {
    const img = imgOf(rows[i]);
    if (!img) continue;
    s.portraits.push({ name: col(rows[i], 1) || '立绘' + (i - 18), url: img });
  }
  s.hall = { image: imgOf(rows[26]) };
  s.bgm = url(col(rows[30], 1));

  // skills: EX blocks (33..92), material tables, then normal skill blocks
  s.skills = [];
  let i = 33;
  while (i < rows.length) {
    const l = label(rows[i]);
    if (l === '技能名词') break;
    if (l === '技能类型') {
      const r = parseSkillBlock(rows, i);
      const hasContent = r.skill.name || r.skill.icon || r.skill.levels.some((x) => x.text);
      if (hasContent) s.skills.push(r.skill);
      i = r.next;
      continue;
    }
    i++;
  }
  const exIdx = rows.findIndex((r, k) => k > 30 && label(r) === 'EX技能升级材料');
  if (exIdx > 0) { const m = parseMaterials(rows, exIdx + 1); s.exMats = m.out; }
  const otherIdx = rows.findIndex((r, k) => k > 30 && label(r) === '其他技能升级材料');
  if (otherIdx > 0) { const m = parseMaterials(rows, otherIdx + 1); s.skillMats = m.out; }

  s.terms = [];
  const termIdx = rows.findIndex((r, k) => k > 30 && label(r) === '技能名词');
  if (termIdx > 0) {
    for (let k = termIdx + 1; k < termIdx + 12; k++) {
      const l = label(rows[k]);
      if (!l || l === '专武') break;
      s.terms.push({ name: l, icon: imgOf(rows[k]) });
    }
  }

  // 专武
  const uwStart = 194;
  s.uniqueWeapon = {
    icon: imgOf(rows[195]),
    name: col(rows[196], 1),
    desc: col(rows[197], 1),
    table: { cols: [], rows: [] },
    skill: { name: col(rows[202], 1), icon: imgOf(rows[203]), description: col(rows[204], 1), levels: [] },
    star3: col(rows[215], 1),
    star3Icon: imgOf(rows[215]),
    star4: col(rows[216], 1),
  };
  for (let k = 198; k <= 201; k++) {
    const l = label(rows[k]);
    const vals = [];
    for (let c = 1; c <= 5; c++) vals.push(col(rows[k], c));
    if (k === 198) s.uniqueWeapon.table.cols = vals.filter(Boolean);
    else if (l && vals.some(Boolean)) s.uniqueWeapon.table.rows.push({ label: l, values: vals });
  }
  for (let k = 205; k <= 214; k++) {
    const t = col(rows[k], 1);
    if (t) s.uniqueWeapon.skill.levels.push({ lv: Number(label(rows[k]).replace('LV', '')), text: t });
  }

  // 爱用品
  s.favoriteItem = {
    icon: imgOf(rows[219]),
    name: col(rows[220], 1),
    desc: col(rows[221], 1),
    t1: col(rows[222], 1),
    t2mats: (rows[223] || []).filter((c) => c.t === 'i').map((c) => url(c.v)),
    t2skill: { name: col(rows[224], 1), icon: imgOf(rows[225]), levels: [] },
  };
  for (let k = 227; k <= 236; k++) {
    const t = col(rows[k], 1);
    if (t) s.favoriteItem.t2skill.levels.push({ lv: Number(label(rows[k]).replace('LV', '')), text: t });
  }

  // profile
  s.profile = {
    fullName: col(rows[240], 1),
    kana: (col(rows[241], 1) + ' ' + col(rows[241], 2)).trim(),
    twName: col(rows[243], 1),
    cnName: col(rows[244], 1),
    age: col(rows[245], 1),
    birthday: col(rows[246], 1),
    height: col(rows[247], 1),
    hobby: col(rows[248], 1),
    designer: col(rows[249], 1),
    artist: col(rows[250], 1),
    cv: col(rows[251], 1),
    hallLevel: col(rows[252], 1),
    momoTalkLevel: col(rows[253], 1),
    momoTalkStatus: col(rows[254], 1),
    bio: col(rows[255], 1),
    sourceUrl: col(rows[256], 1),
  };

  // gifts (3 slots of icons)
  s.gifts = [];
  for (const k of [260, 263, 266]) {
    const c = (rows[k] || [])[0];
    if (c && c.v) s.gifts.push(url(c.v));
  }

  s.chocolate = { icon: imgOf(rows[273]), name: col(rows[274], 1), desc: col(rows[275], 1) };

  s.ability = {
    attrs: [kvPairs(rows[279], 1)[0], kvPairs(rows[280], 1)[0], kvPairs(rows[281], 1)[0]].filter(Boolean),
    mats: (rows[282] || []).filter((c) => c.t === 'i').map((c) => url(c.v)),
  };

  s.sameName = [];
  for (let k = 285; k <= 290; k++) {
    const nm = col(rows[k], 1);
    if (!nm) continue;
    const ic = imgOf(rows[k]);
    const c = (rows[k] || []).find((x) => x.t === 't' && /https?:\/\//.test(x.v));
    s.sameName.push({ name: nm, icon: ic, url: c ? c.v : '' });
  }

  // voices
  const voices = {};
  for (let k = 295; k <= 447; k++) {
    const cat = col(rows[k], 0);
    const lb = col(rows[k], 1);
    if (!cat || !lb) continue;
    const jp = col(rows[k], 2);
    const zh = col(rows[k], 5) || col(rows[k], 3);
    if (!jp && !zh) continue;
    voices[cat] = voices[cat] || [];
    voices[cat].push({ label: lb, jp, zh });
  }
  s.voices = voices;

  // stats
  s.stats = {
    init: kvPairs(rows[505], 0).concat(kvPairs(rows[506], 0), kvPairs(rows[507], 0), kvPairs(rows[508], 0)),
    max: kvPairs(rows[511], 0).concat(kvPairs(rows[512], 0), kvPairs(rows[513], 0), kvPairs(rows[514], 0)),
    weapon: [
      { name: '攻击力', value: col(rows[517], 1) },
      { name: '生命值', value: col(rows[518], 1) },
      { name: '治愈力', value: col(rows[519], 1) },
    ].filter((x) => x.value),
  };

  s.equipDetails = [];
  for (const [slotRow, nameRow, slot] of [[522, 523, '1号装备'], [525, 526, '2号装备'], [528, 529, '3号装备']]) {
    const type = col(rows[nameRow], 0);
    if (!type) continue;
    s.equipDetails.push({
      slot,
      name: type,
      grade: col(rows[nameRow], 1),
      attrs: kvPairs(rows[nameRow], 2),
    });
  }
  s.giftDetail = { t1Value: kvPairs(rows[533], 1) };
  s.abilityDetail = { attrs: kvPairs(rows[537], 1) };
  s.bond = [];
  for (let k = 540; k <= 542; k++) {
    const l = label(rows[k]);
    if (!l) continue;
    s.bond.push({ label: l, icon: imgOf(rows[k]), attrs: kvPairs(rows[k], 2) });
  }

  // review
  s.review = {
    score: col(rows[552], 2),
    scoreIcon: imgOf(rows[552]),
    tiers: [],
    skills: { ex: col(rows[561], 1), ns: col(rows[562], 1), ps: col(rows[563], 1), ss: col(rows[564], 1) },
    employment: col(rows[566], 1),
    advice: col(rows[567], 1),
  };
  for (let k = 553; k <= 558; k++) {
    const l = label(rows[k]);
    if (!l) continue;
    s.review.tiers.push({ name: l, value: col(rows[k], 2), icon: imgOf(rows[k]) });
  }

  // media
  s.officialImages = [];
  for (let k = 450; k <= 453; k++) {
    const c = (rows[k] || []).find((x) => x.t === 'i');
    if (c) s.officialImages.push(url(c.v));
  }
  s.expressions = [];
  const expr = (rows[456] || []).slice(1).map((c) => c.v).filter(Boolean);
  s.expressions = expr.map(url);

  return s;
}

function summarize(s) {
  return {
    id: s.id,
    name: s.name,
    rarity: s.rarity,
    school: s.school,
    role: s.role,
    attack: s.attack,
    defense: s.defense,
    position: s.position,
    tactic: s.tactic,
    weaponType: s.weaponType,
    releaseDate: s.releaseDate,
    aliases: s.aliases,
    club: s.club,
  };
}

function main() {
  const files = fs.readdirSync(RAW).filter((f) => f.endsWith('.json'));
  const index = [];
  let bytes = 0;
  for (const f of files) {
    const raw = JSON.parse(fs.readFileSync(path.join(RAW, f), 'utf8'));
    const s = parseStudent(raw);
    const json = JSON.stringify(s);
    bytes += json.length;
    fs.writeFileSync(path.join(OUT, 'students', s.id + '.json'), json);
    index.push(summarize(s));
  }
  index.sort((a, b) => (b.releaseDate || '').localeCompare(a.releaseDate || '') || a.name.localeCompare(b.name, 'zh'));
  fs.writeFileSync(path.join(OUT, 'index.json'), JSON.stringify(index));
  console.log('students', index.length, 'detail MB', (bytes / 1048576).toFixed(2));
  // sanity dump
  const demo = JSON.parse(fs.readFileSync(path.join(OUT, 'students', '44388.json'), 'utf8'));
  console.log(JSON.stringify({ ...demo, voices: { keys: Object.keys(demo.voices), counts: Object.fromEntries(Object.entries(demo.voices).map(([k, v]) => [k, v.length])) } }, null, 1).slice(0, 3500));
}

main();
