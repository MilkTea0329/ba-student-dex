/* 什亭之匣 · 蔚蓝档案学生图鉴 — single page app (offline first) */
(function () {
  'use strict';

  const APP_NAME = '什亭之匣';
  const APP_VERSION = 'V1.0.0';

  // 内置数据（打包进 App），联网同步到的新学生会追加到这里
  const INDEX = (window.BA_INDEX || []).slice();
  const STUDENTS = window.BA_STUDENTS || {};
  const AVATARS = window.BA_AVATARS || null;
  const BY_ID = {};
  INDEX.forEach(function (s) { BY_ID[s.id] = s; });

  const LS_FAV = 'ba.dex.favs';
  const LS_SORT = 'ba.dex.sort';

  // localStorage can be unavailable when the page is opened from file:// —
  // fall back to in-memory storage so the app never crashes.
  const store = (function () {
    try {
      const k = '__ba_test__';
      window.localStorage.setItem(k, '1');
      window.localStorage.removeItem(k);
      return window.localStorage;
    } catch (e) {
      const mem = {};
      return {
        getItem: function (k) { return Object.prototype.hasOwnProperty.call(mem, k) ? mem[k] : null; },
        setItem: function (k, v) { mem[k] = String(v); },
      };
    }
  })();

  function loadJSON(key, fallback) {
    try { return JSON.parse(store.getItem(key) || JSON.stringify(fallback)); } catch (e) { return fallback; }
  }

  const state = {
    tab: 'students',
    query: '',
    filters: { rarity: [], school: [], attack: [], defense: [], position: [], role: [], tactic: [], weapon: [] },
    sort: store.getItem(LS_SORT) || 'date',
    favs: new Set(loadJSON(LS_FAV, [])),
    detail: null,
    detailTab: 'overview',
    skillLv: {},
    voiceCat: null,
    sheetOpen: false,
    draft: null,
  };

  /* ------------------------------------------------------------- helpers */
  const esc = function (s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  };

  function rich(s) {
    if (!s) return '';
    let out = esc(s);
    out = out.replace(/\*red:([^*]*)\*/g, '<em class="hl">$1</em>');
    out = out.replace(/\*red:/g, '');
    out = out.replace(/\*(?=\S)/g, '');
    return out.replace(/\n/g, '<br>');
  }

  // WIKI 里同一种属性存在不同译法（贯通/贯穿、支援/辅助），两种都要能取到颜色，
  // 否则会落到下面的灰色兜底 #7b8aa0 上。
  const ATK_COLOR = {
    '爆炸': '#ef5f3c',   // 红
    '贯通': '#d99a1f',   // 深黄（游戏内图标色）
    '贯穿': '#d99a1f',   // 同 贯通，兼容旧译名
    '神秘': '#4d7df2',   // 蓝
    '振动': '#9b5cf0',   // 紫
    '治疗': '#22a875'
  };
  const DEF_COLOR = {
    '轻装甲': '#4d9df2',
    '重装甲': '#d99a1f',
    '特殊装甲': '#9b5cf0',
    '弹力装甲': '#22a875',
    '复合装甲': '#e0742c'
  };
  const ROLE_COLOR = {
    '输出': '#ef5f3c',
    '坦克': '#4d9df2',
    '治疗': '#22a875',
    '辅助': '#9b5cf0',
    '支援': '#9b5cf0'
  };
  const GRADE_COLOR = { S: '#f2b132', A: '#9b5cf0', B: '#4d7df2', C: '#93a2b8', D: '#c3ccd8' };
  const POSITION_CN = { FRONT: '前排', MIDDLE: '中排', BACK: '后排' };
  const TACTIC_CN = { STRIKER: '突击', SPECIAL: '支援' };
  const SKILL_KIND = { 'EX技能': 'EX', '普通技能': 'NS', '被动技能': 'PS', '辅助技能': 'SS', '子技能': 'SUB' };
  const SKILL_COLOR = { EX: '#ef5f3c', NS: '#3b7bfa', PS: '#9b5cf0', SS: '#22a875', SUB: '#e8a92f' };

  function atkColor(v) { return ATK_COLOR[v] || '#7b8aa0'; }
  function defColor(v) { return DEF_COLOR[v] || '#7b8aa0'; }
  function roleColor(v) { return ROLE_COLOR[v] || '#7b8aa0'; }

  function avatar(id) {
    if (AVATARS && AVATARS[id]) return AVATARS[id];
    return 'avatars/' + id + '.jpg';
  }

  // 同步来的学生头像存的是 data URI
  function avatarOf(s) {
    if (s && s.avatar) return s.avatar;
    return avatar(s ? s.id : '');
  }

  // 同步来的学生没有「站位 / 战术作用」的文字映射时，直接显示 WIKI 上的文字图片
  function tagOrImage(text, image, height) {
    if (text) return esc(text);
    if (image) return '<img src="' + image + '" alt="" style="height:' + (height || 14) + 'px;width:auto;max-width:58px;object-fit:contain;display:inline-block;vertical-align:-2px">';
    return '—';
  }

  function stars(n) { return '★'.repeat(n || 0); }

  function fmtNum(v) {
    return String(v == null ? '' : v).replace(/\s*\n\s*/g, ' / ').trim();
  }

  function shortSchool(v) {
    return String(v || '')
      .replace(/学园$/, '').replace(/学院$/, '').replace(/高等学校$/, '')
      .replace(/高级中学$/, '').replace(/警察学校$/, '').replace(/分校$/, '')
      .replace(/高中$/, '').replace(/中学$/, '');
  }

  function fmtCV(v) {
    if (!v) return '';
    const parts = String(v).split('\n').map(function (line) {
      const m = line.match(/^\s*([日韩中英])\s*\|\s*(.+)$/);
      return m ? m[2].trim() + '（' + m[1] + '）' : line.trim();
    }).filter(Boolean);
    return parts.join(' / ');
  }

  function starBadge(v) {
    if (!v) return '<span class="st none">—</span>';
    if (/^[★]+$/.test(v)) return '<span class="st">' + v + '</span>';
    return '<span class="st none">' + esc(v) + '</span>';
  }

  const ICON = {
    students: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"><rect x="3.5" y="3.5" width="7" height="7" rx="2"/><rect x="13.5" y="3.5" width="7" height="7" rx="2"/><rect x="3.5" y="13.5" width="7" height="7" rx="2"/><rect x="13.5" y="13.5" width="7" height="7" rx="2"/></svg>',
    school: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M3 9.5 12 4l9 5.5"/><path d="M5 11v9h14v-9"/><path d="M9.5 20v-5h5v5"/></svg>',
    heart: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"><path d="M12 20s-7.5-4.7-7.5-9.6A4.4 4.4 0 0 1 12 7.4a4.4 4.4 0 0 1 7.5 3c0 4.9-7.5 9.6-7.5 9.6Z"/></svg>',
    heartFill: '<svg viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round"><path d="M12 20s-7.5-4.7-7.5-9.6A4.4 4.4 0 0 1 12 7.4a4.4 4.4 0 0 1 7.5 3c0 4.9-7.5 9.6-7.5 9.6Z"/></svg>',
    more: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round"><circle cx="5" cy="12" r="1.4" fill="currentColor" stroke="none"/><circle cx="12" cy="12" r="1.4" fill="currentColor" stroke="none"/><circle cx="19" cy="12" r="1.4" fill="currentColor" stroke="none"/></svg>',
    search: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="11" cy="11" r="6.5"/><path d="m16 16 4 4"/></svg>',
    back: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="m14.5 5-7 7 7 7"/></svg>',
    filter: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M4 7h16M7 12h10M10 17h4"/></svg>',
  };

  /* --------------------------------------------------------------- filter */
  function uniq(arr) {
    const seen = {};
    const out = [];
    arr.forEach(function (v) { if (v && !seen[v]) { seen[v] = 1; out.push(v); } });
    return out;
  }

  // 筛选面板的候选项依赖学生集合，同步到新学生后需要重建
  let FACETS = null;

  function buildFacets() {
    FACETS = {
      rarity: { label: '稀有度', values: [3, 2, 1], fmt: function (v) { return v + '★'; } },
      school: { label: '学院', values: uniq(INDEX.map(function (s) { return s.school; })) },
      attack: { label: '攻击类型', values: uniq(INDEX.map(function (s) { return s.attack; })) },
      defense: { label: '防御类型', values: uniq(INDEX.map(function (s) { return s.defense; })) },
      position: { label: '站位', values: ['FRONT', 'MIDDLE', 'BACK'], fmt: function (v) { return POSITION_CN[v]; } },
      role: { label: '作用', values: uniq(INDEX.map(function (s) { return s.role; })) },
      tactic: { label: '战术作用', values: ['STRIKER', 'SPECIAL'], fmt: function (v) { return TACTIC_CN[v]; } },
      weapon: { label: '武器', values: uniq(INDEX.map(function (s) { return s.weaponType; })) },
    };
  }

  buildFacets();

  function activeFilterCount() {
    return Object.keys(state.filters).reduce(function (n, k) { return n + state.filters[k].length; }, 0);
  }

  function matches(s) {
    const f = state.filters;
    if (f.rarity.length && f.rarity.indexOf(s.rarity) < 0) return false;
    if (f.school.length && f.school.indexOf(s.school) < 0) return false;
    if (f.attack.length && f.attack.indexOf(s.attack) < 0) return false;
    if (f.defense.length && f.defense.indexOf(s.defense) < 0) return false;
    if (f.position.length && f.position.indexOf(s.position) < 0) return false;
    if (f.role.length && f.role.indexOf(s.role) < 0) return false;
    if (f.tactic.length && f.tactic.indexOf(s.tactic) < 0) return false;
    if (f.weapon.length && f.weapon.indexOf(s.weaponType) < 0) return false;
    if (state.query) {
      const q = state.query.toLowerCase();
      const hay = (s.name + ' ' + (s.aliases || []).join(' ') + ' ' + (s.school || '') + ' ' + (s.club || '')).toLowerCase();
      if (hay.indexOf(q) < 0) return false;
    }
    return true;
  }

  // Wiki dates look like "2026/9/23" or "2021/02/04" — string comparison would
  // put 9/23 before 10/28, so always compare a numeric key.
  function dateKey(v) {
    const m = String(v == null ? '' : v).match(/(\d{4})\D+(\d{1,2})\D+(\d{1,2})/);
    if (!m) return -1;
    return (+m[1]) * 10000 + (+m[2]) * 100 + (+m[3]);
  }

  function latestReleaseDate() {
    let best = '';
    for (let i = 0; i < INDEX.length; i++) {
      if (dateKey(INDEX[i].releaseDate) > dateKey(best)) best = INDEX[i].releaseDate;
    }
    return best;
  }

  function sortList(list) {
    const out = list.slice();
    if (state.sort === 'name') {
      out.sort(function (a, b) { return a.name.localeCompare(b.name, 'zh-Hans-CN'); });
    } else if (state.sort === 'rarity') {
      out.sort(function (a, b) { return b.rarity - a.rarity || a.name.localeCompare(b.name, 'zh-Hans-CN'); });
    } else {
      out.sort(function (a, b) {
        return dateKey(b.releaseDate) - dateKey(a.releaseDate) ||
          a.name.localeCompare(b.name, 'zh-Hans-CN');
      });
    }
    return out;
  }

  function filtered() { return sortList(INDEX.filter(matches)); }

  /* ----------------------------------------------------------------- list */
  function isNewStudent(s) {
    return !!(s && s.isNew && s.syncedAt && (Date.now() - s.syncedAt) < 7 * 864e5);
  }

  function cardHTML(s) {
    return '' +
      '<button class="card" data-act="open" data-id="' + s.id + '">' +
        '<img loading="lazy" src="' + avatarOf(s) + '" alt="' + esc(s.name) + '">' +
        '<span class="scrim"></span>' +
        (isNewStudent(s) ? '<span class="newbadge">NEW</span>' : '') +
        '<span class="meta">' +
          '<span class="nm">' + esc(s.name) + '</span>' +
          '<span class="sub">' + esc(shortSchool(s.school)) + ' · ' + esc(s.role) + '</span>' +
        '</span>' +
        '<span class="accentbar" style="background:' + atkColor(s.attack) + '"></span>' +
      '</button>';
  }

  function sortLabel() {
    return { date: '日期', name: '名称', rarity: '稀有' }[state.sort];
  }

  function listView() {
    const list = filtered();
    const chips = [
      { k: 'all', label: '全部', on: activeFilterCount() === 0 && !state.query },
      { k: '3', label: '3★', on: state.filters.rarity.length === 1 && state.filters.rarity[0] === 3 },
      { k: '2', label: '2★', on: state.filters.rarity.length === 1 && state.filters.rarity[0] === 2 },
      { k: '1', label: '1★', on: state.filters.rarity.length === 1 && state.filters.rarity[0] === 1 },
    ];
    let html = '';
    html += '<div class="chiprow">';
    chips.forEach(function (c) {
      html += '<button class="chip ' + (c.on ? 'on' : '') + '" data-act="quick" data-k="' + c.k + '">' + c.label + '</button>';
    });
    html += '<button class="chip ' + (activeFilterCount() ? 'on' : '') + '" data-act="filter-open">' +
      '<span style="width:14px;height:14px;display:inline-flex">' + ICON.filter + '</span>筛选' +
      (activeFilterCount() ? '<span class="badge">' + activeFilterCount() + '</span>' : '') + '</button>';
    html += '<button class="chip" data-act="sort-cycle">' + sortLabel() + ' ⇅</button>';
    html += '</div>';

    if (!list.length) {
      html += '<div class="empty"><div class="big">🔍</div>没有符合条件的学生<br>试试更换筛选条件或关键词</div>';
      return html;
    }
    html += '<div class="grid">' + list.map(cardHTML).join('') + '</div>';
    html += '<div class="empty" style="padding:26px 0 4px">已显示 ' + list.length + ' / ' + INDEX.length + ' 名学生</div>';
    return html;
  }

  /* --------------------------------------------------------------- schools */
  function schoolsView() {
    const groups = {};
    INDEX.forEach(function (s) {
      if (!s.school) return;
      (groups[s.school] = groups[s.school] || []).push(s);
    });
    const names = Object.keys(groups).sort(function (a, b) { return groups[b].length - groups[a].length; });
    let html = '<div class="section-title">按学院浏览 · ' + names.length + ' 所</div>';
    names.forEach(function (n) {
      const arr = groups[n].slice().sort(function (a, b) { return b.rarity - a.rarity || a.name.localeCompare(b.name); });
      html += '<button class="school-card" data-act="school" data-name="' + esc(n) + '">' +
        '<span class="avatars">' + arr.slice(0, 3).map(function (s) {
          return '<img src="' + avatarOf(s) + '" alt="">';
        }).join('') + '</span>' +
        '<span class="col"><span class="nm">' + esc(n) + '</span><span class="cnt">' + arr.length + ' 名学生</span></span>' +
        '<span class="arrow">›</span>' +
      '</button>';
    });
    return html;
  }

  /* ----------------------------------------------------------------- favs */
  function favView() {
    const list = sortList(INDEX.filter(function (s) { return state.favs.has(s.id); }));
    if (!list.length) {
      return '<div class="empty" style="padding-top:80px"><div class="big">♡</div>还没有收藏的学生<br><span style="font-size:12.5px">在学生详情页点击右上角收藏</span></div>';
    }
    return '<div class="section-title">我的收藏 · ' + list.length + '</div><div class="grid">' + list.map(cardHTML).join('') + '</div>';
  }

  /* ----------------------------------------------------------------- more */
  function syncStatusText() {
    if (!window.BASync || !window.BASync.available()) return '需在 App 内使用';
    const st = window.BASync.state;
    if (st.running) return '检查中…';
    const r = st.lastResult;
    if (!r) return '点此检查';
    if (!r.ok) return '检查失败';
    if (r.added) return '新增 ' + r.added + ' 名';
    return '已是最新';
  }

  function lastCheckText() {
    const st = window.BASync && window.BASync.state;
    if (!st || !st.lastCheck) return '—';
    const d = new Date(st.lastCheck);
    return (d.getMonth() + 1) + '/' + d.getDate() + ' ' +
      String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
  }

  function moreView() {
    const schools = uniq(INDEX.map(function (s) { return s.school; })).length;
    const r3 = INDEX.filter(function (s) { return s.rarity === 3; }).length;
    const strikes = INDEX.filter(function (s) { return s.tactic === 'STRIKER'; }).length;
    return '' +
      '<div class="section-title">数据总览</div>' +
      '<div class="stat-cards">' +
        '<div class="stat-card"><div class="n">' + INDEX.length + '</div><div class="l">实装学生</div></div>' +
        '<div class="stat-card"><div class="n">' + r3 + '</div><div class="l">3★ 学生</div></div>' +
        '<div class="stat-card"><div class="n">' + schools + '</div><div class="l">所属学院</div></div>' +
      '</div>' +
      '<div class="section-title">数据更新</div>' +
      '<div class="panel">' +
        '<button class="rowlink" data-act="sync-now" style="width:100%;text-align:left">' +
          '<span>立即检查新学生</span><span class="r"><span id="sync-status">' + syncStatusText() + '</span> ›</span></button>' +
        '<div class="rowlink"><span>上次检查</span><span class="r">' + lastCheckText() + '</span></div>' +
        '<div class="rowlink"><span>自动检查</span><span class="r">每次启动 · 30 分钟内不重复</span></div>' +
      '</div>' +
      '<div class="section-title">关于</div>' +
      '<div class="panel">' +
        '<div class="rowlink"><span>应用名称</span><span class="r">' + esc(APP_NAME) + '</span></div>' +
        '<div class="rowlink"><span>版本</span><span class="r" id="app-version">' + esc(APP_VERSION) + '</span></div>' +
        '<div class="rowlink"><span>学生总数</span><span class="r">' + INDEX.length + ' 名</span></div>' +
        '<div class="rowlink"><span>突击 / 支援</span><span class="r">' + strikes + ' / ' + (INDEX.length - strikes) + '</span></div>' +
        '<div class="rowlink"><span>数据来源</span><span class="r">GameKee 蔚蓝档案 WIKI</span></div>' +
        '<div class="rowlink"><span>最新实装</span><span class="r">' + (latestReleaseDate() || '—') + '</span></div>' +
      '</div>' +
      '<div class="section-title">说明</div>' +
      '<div class="panel"><div class="panel-body" style="font-size:12.5px;line-height:1.7;color:var(--sub)">' +
        '本应用为玩家自制的非官方资料查询工具，学生资料、立绘与语音文本版权归 NEXON Games / Yostar 及原 WIKI 贡献者所有。' +
        '数据整理自 gamekee.com 蔚蓝档案 WIKI 的「游戏图鉴 · 实装学生」，仅用于学习交流，请勿用于商业用途。' +
        '新学生的资料由 App 启动时自动同步，图片为压缩后的离线副本。' +
      '</div></div>' +
      '<div style="height:20px"></div>';
  }

  /* --------------------------------------------------------------- detail */
  function detailHTML(s) {
    const isFav = state.favs.has(s.id);
    let html = '';
    html += '<div class="hero-block">';
    html += '<div class="hero">' +
      '<img class="bg" src="' + avatarOf(s) + '" alt="">' +
      '<span class="scrim"></span>' +
      '<img class="art" src="' + avatarOf(s) + '" alt="">' +
      '<button class="navbtn back" data-act="back">' + ICON.back + '</button>' +
      '<button class="navbtn fav ' + (isFav ? 'on' : '') + '" data-act="fav" data-id="' + s.id + '">' + (isFav ? ICON.heartFill : ICON.heart) + '</button>' +
      '</div>';

    html += '<div class="hero-info">' +
      '<h2>' + esc(s.name) + '</h2>' +
      '<div class="stars">' + stars(s.rarity) + '</div>' +
      '<div class="line">' + esc(s.school) + (s.club ? ' · ' + esc(s.club) : '') + '</div>' +
      '<div class="hero-tags">' +
        '<span class="tag solid" style="background:' + atkColor(s.attack) + '">' + esc(s.attack) + '</span>' +
        '<span class="tag" style="color:' + defColor(s.defense) + ';border-color:' + defColor(s.defense) + '55">' + esc(s.defense) + '</span>' +
        '<span class="tag" style="color:' + roleColor(s.role) + '">' + esc(s.role) + '</span>' +
        '<span class="tag">' + tagOrImage(POSITION_CN[s.position], s.positionImage, 12) + '</span>' +
        '<span class="tag">' + tagOrImage(TACTIC_CN[s.tactic], s.tacticImage, 12) + '</span>' +
      '</div>' +
    '</div>' +
    '</div>';

    const TABS = [
      ['overview', '概览'], ['skills', '技能'], ['stats', '属性'], ['grow', '养成'],
      ['profile', '资料'], ['voice', '语音'], ['art', '立绘'],
    ];
    html += '<div class="segwrap"><div class="seg">' +
      TABS.map(function (t) {
        return '<button class="' + (state.detailTab === t[0] ? 'on' : '') + '" data-act="dt" data-t="' + t[0] + '">' + t[1] + '</button>';
      }).join('') + '</div></div>';

    html += '<div class="detail-body">' + detailTabHTML(s) + '</div>';
    return html;
  }

  function secTitle(t, extra) {
    return '<div class="section-title">' + esc(t) + (extra || '') + '</div>';
  }

  function detailTabHTML(s) {
    switch (state.detailTab) {
      case 'skills': return skillsTab(s);
      case 'stats': return statsTab(s);
      case 'grow': return growTab(s);
      case 'profile': return profileTab(s);
      case 'voice': return voiceTab(s);
      case 'art': return artTab(s);
      default: return overviewTab(s);
    }
  }

  function overviewTab(s) {
    let html = '';
    if (s.summary) {
      html += '<div class="panel" style="margin-top:14px"><div class="panel-body">' +
        '<div style="font-size:12px;font-weight:800;color:var(--sub);letter-spacing:.06em;margin-bottom:6px">PROFILE</div>' +
        '<div style="font-size:13.5px;line-height:1.68">' + rich(s.summary) + '</div></div></div>';
    }

    html += secTitle('基础信息');
    const kv = [
      ['稀有度', stars(s.rarity)],
      ['战术作用', tagOrImage(TACTIC_CN[s.tactic], s.tacticImage, 11)],
      ['站位', tagOrImage(POSITION_CN[s.position], s.positionImage, 11)],
      ['攻击类型', s.attack],
      ['防御类型', s.defense],
      ['武器类型', s.weaponType || '—'],
      ['所属学院', s.school],
      ['所属社团', s.club || '—'],
      ['实装日期', s.releaseDate || '—'],
      ['声优', fmtCV(s.profile && s.profile.cv) || '—'],
    ];
    html += '<div class="panel"><div class="kvgrid">' + kv.map(function (r) {
      const raw = String(r[1] == null ? '' : r[1]);
      const body = raw.indexOf('<img') === 0 ? raw : esc(raw.replace(/\s*\n\s*/g, ' / '));
      return '<div class="cell"><div class="k">' + r[0] + '</div><div class="v">' + body + '</div></div>';
    }).join('') + '</div></div>';

    html += secTitle('地形适应');
    const t = s.terrain || {};
    html += '<div class="terrain">' + [['市街', t.urban], ['屋外', t.outdoor], ['屋内', t.indoor]].map(function (x) {
      const g = x[1] || '-';
      return '<div class="t"><div class="grade" style="color:' + (GRADE_COLOR[g] || 'var(--sub)') + '">' + esc(g) + '</div><div class="lbl">' + x[0] + '</div></div>';
    }).join('') + '</div>';

    const rv = s.review || {};
    html += secTitle('角色评测');
    html += '<div class="panel"><div class="panel-body">';
    if (rv.score) {
      const m = String(rv.score).match(/^(\d+)\s*\(?([A-Za-z]*)\)?$/);
      html += '<div class="score-box"><div class="score">' + (m ? m[1] : esc(rv.score)) +
        (m && m[2] ? '<small> ' + m[2] + '</small>' : '') + '</div>' +
        '<div style="color:var(--sub);font-size:12px;line-height:1.5">综合评分<br><span style="color:var(--ink-2);font-weight:700">WIKI 编辑组</span></div></div>';
    }
    if (rv.tiers && rv.tiers.length) {
      html += '<div class="tiers">' + rv.tiers.map(function (x) {
        return '<span class="tierchip">' + esc(x.name) + ' ' + starBadge(x.value) + '</span>';
      }).join('') + '</div>';
    }
    if (rv.employment) html += '<div class="note"><b>就业场合</b><br>' + rich(rv.employment) + '</div>';
    if (rv.advice) html += '<div class="note"><b>抽取与培养建议</b><br>' + rich(rv.advice) + '</div>';
    html += '</div></div>';

    html += secTitle('技能速览');
    html += '<div class="panel">' + (s.skills || []).map(function (k, i) {
      const kind = SKILL_KIND[k.kindLabel] || 'SK';
      return '<button class="skill-brief" data-act="skill" data-i="' + i + '" style="width:100%;text-align:left">' +
        '<span class="skill-icon" style="width:36px;height:32px;background:' + (SKILL_COLOR[kind] || '#7b8aa0') + ';font-size:11px">' + kind + '</span>' +
        '<span style="flex:1;min-width:0"><span class="t1">' + esc(k.name || k.kindLabel) + '</span>' +
        '<span class="t2">' + esc(k.kindLabel) + ' · ' + (k.levels ? k.levels.length : 0) + ' 级</span></span>' +
        '<span class="chev">›</span>' +
      '</button>';
    }).join('') + '</div>';

    return html;
  }

  function skillsTab(s) {
    let html = '<div style="height:14px"></div>';
    (s.skills || []).forEach(function (k, idx) {
      const kind = SKILL_KIND[k.kindLabel] || 'SK';
      const lv = state.skillLv[idx] || 1;
      const list = k.levels || [];
      const entry = list.filter(function (x) { return x.lv === lv; })[0] || list[0] || { text: '' };
      html += '<div class="skill" data-skill="' + idx + '">' +
        '<div class="skill-head">' +
          '<div class="skill-icon" style="background:' + (SKILL_COLOR[kind] || '#7b8aa0') + '">' +
            (k.icon ? '<img src="' + k.icon + '" alt="">' : kind) +
          '</div>' +
          '<div class="skill-title">' +
            '<div class="kind">' + esc(k.kindLabel) + '</div>' +
            '<div class="nm">' + esc(k.name || '—') + '</div>' +
            (entry.cost ? '<div class="cost">COST ' + esc(entry.cost) + '</div>' : '') +
          '</div>' +
        '</div>' +
        '<div class="lvbar">' + list.map(function (x) {
          return '<button class="' + (x.lv === lv ? 'on' : '') + '" data-act="lv" data-i="' + idx + '" data-lv="' + x.lv + '">LV' + x.lv + '</button>';
        }).join('') + '</div>' +
        '<div class="skill-text">' + (entry.text ? rich(entry.text) : '<span style="color:var(--sub)">暂无描述</span>') + '</div>' +
      '</div>';
    });

    html += secTitle('EX 技能升级材料');
    html += matTable(s.exMats);
    html += secTitle('其他技能升级材料');
    html += matTable(s.skillMats);
    return html;
  }

  function matTable(list) {
    if (!list || !list.length) return '<div class="panel"><div class="panel-body" style="color:var(--sub);font-size:13px">暂无数据</div></div>';
    let html = '<div class="panel"><div class="panel-body" style="padding:4px 12px">' +
      '<table class="matable"><thead><tr><th style="width:46px">等级</th><th>所需材料</th></tr></thead><tbody>';
    list.forEach(function (m) {
      html += '<tr><td class="lv">LV' + m.lv + '</td><td><div class="mat-inline">' +
        (m.items || []).map(function (it) {
          return '<span class="it">' + (it.icon ? '<img src="' + it.icon + '" alt="">' : '') +
            '<span>' + esc(fmtNum(it.count)) + '</span></span>';
        }).join('') + '</div></td></tr>';
    });
    html += '</tbody></table></div></div>';
    return html;
  }

  function statsTab(s) {
    const init = (s.stats && s.stats.init) || [];
    const max = (s.stats && s.stats.max) || [];
    const maxMap = {};
    max.forEach(function (x) { maxMap[x.name] = x.value; });
    let html = '<div style="height:14px"></div>';
    html += '<div class="panel"><div class="panel-body" style="padding:6px 12px">' +
      '<table class="stat-table"><thead><tr><th>属性</th><th>初始</th><th>满级</th><th style="text-align:right">成长</th></tr></thead><tbody>';
    init.forEach(function (x) {
      const a = parseFloat(String(x.value).replace(/[^\d.]/g, ''));
      const b = parseFloat(String(maxMap[x.name] || '').replace(/[^\d.]/g, ''));
      const d = (!isNaN(a) && !isNaN(b)) ? (b - a) : null;
      html += '<tr><td>' + esc(x.name) + '</td><td>' + esc(fmtNum(x.value)) + '</td><td class="v2">' + esc(fmtNum(maxMap[x.name] || '—')) + '</td>' +
        '<td class="delta">' + (d && d > 0 ? '+' + d.toLocaleString('en-US') : '') + '</td></tr>';
    });
    html += '</tbody></table></div></div>';

    if (s.equipDetails && s.equipDetails.length) {
      html += secTitle('装备（满级）');
      html += '<div class="panel">' + s.equipDetails.map(function (e) {
        return '<div style="padding:12px 14px;border-bottom:1px solid var(--line)">' +
          '<div style="display:flex;justify-content:space-between;align-items:center">' +
            '<span style="font-weight:700">' + esc(e.name) + '</span>' +
            '<span style="font-size:11px;color:var(--sub);font-weight:700">' + esc(e.slot) + ' · ' + esc(e.grade) + '</span>' +
          '</div>' +
          '<div style="margin-top:6px;display:flex;flex-wrap:wrap;gap:6px">' + (e.attrs || []).map(function (a) {
            return '<span class="tierchip">' + esc(a.name) + ' <span style="color:var(--accent)">' + esc(a.value) + '</span></span>';
          }).join('') + '</div>' +
        '</div>';
      }).join('') + '</div>';
    }

    const uw = s.uniqueWeapon || {};
    if (uw.table && uw.table.rows && uw.table.rows.length) {
      html += secTitle('专武数值');
      html += '<div class="panel"><div class="panel-body" style="padding:6px 12px">' +
        '<table class="stat-table"><thead><tr><th>' + esc(uw.name || '专武') + '</th>' +
        uw.table.cols.map(function (c) { return '<th>' + esc(c) + '</th>'; }).join('') + '</tr></thead><tbody>' +
        uw.table.rows.map(function (r) {
          return '<tr><td>' + esc(r.label) + '</td>' + r.values.map(function (v) { return '<td class="v2">' + esc(v || '—') + '</td>'; }).join('') + '</tr>';
        }).join('') + '</tbody></table></div></div>';
    }

    // 能力解放：优先用「25级」那一行（537 行）的数值，
    // 介绍区的 279~281 行经常是 WIKI 的占位文字（如「这个不用写」）
    const abilityAttrs = (s.abilityDetail && s.abilityDetail.attrs && s.abilityDetail.attrs.length)
      ? s.abilityDetail.attrs
      : ((s.ability && s.ability.attrs) || []).filter(function (a) { return a && a.value && !/不用写/.test(a.value); });
    if (abilityAttrs.length) {
      html += secTitle('能力解放（25级）');
      html += '<div class="panel"><div class="panel-body"><div class="matgrid">' + abilityAttrs.map(function (a) {
        return '<span class="mat"><span class="n">' + esc(a.name) + '</span><span class="x">+' + esc(a.value) + '</span></span>';
      }).join('') + '</div></div></div>';
    }

    const bonds = (s.bond || []).filter(function (b) { return b && ((b.attrs && b.attrs.length) || b.icon); });
    if (bonds.length) {
      html += secTitle('羁绊等级奖励（50级）');
      html += '<div class="panel">' + bonds.map(function (b) {
        return '<div style="padding:12px 14px;border-bottom:1px solid var(--line);display:flex;align-items:center;gap:10px">' +
          (b.icon ? '<img src="' + b.icon + '" style="width:34px;height:38px;object-fit:contain;border-radius:8px" alt="">' : '') +
          '<span style="flex:1;font-weight:700;font-size:13.5px">' + esc(b.label) + '</span>' +
          '<span style="display:flex;gap:6px;flex-wrap:wrap">' + (b.attrs || []).map(function (a) {
            return '<span class="tierchip">' + esc(a.name) + ' <span style="color:var(--accent)">' + esc(a.value) + '</span></span>';
          }).join('') + '</span>' +
        '</div>';
      }).join('') + '</div>';
    }
    return html;
  }

  function growTab(s) {
    const uw = s.uniqueWeapon || {};
    let html = '<div style="height:14px"></div>';
    if (uw.name) {
      html += '<div class="skill">' +
        '<div class="skill-head">' +
          '<div class="skill-icon" style="background:linear-gradient(135deg,#f2b132,#ef5f3c)">' + (uw.icon ? '<img src="' + uw.icon + '" alt="">' : '★') + '</div>' +
          '<div class="skill-title"><div class="kind">专属武器</div><div class="nm">' + esc(uw.name) + '</div></div>' +
        '</div>' +
        '<div class="skill-text" style="color:var(--sub)">' + esc(uw.desc) + '</div>' +
        (uw.star3 ? '<div class="note" style="margin-top:10px"><b>★3</b>　' + esc(uw.star3) + (uw.star4 ? '<br><b>★4</b>　' + esc(uw.star4) : '') + '</div>' : '') +
      '</div>';

      if (uw.skill && uw.skill.levels && uw.skill.levels.length) {
        const lv = state.skillLv['uw'] || 10;
        const e = uw.skill.levels.filter(function (x) { return x.lv === lv; })[0] || uw.skill.levels[0];
        html += '<div class="skill"><div class="skill-head">' +
          '<div class="skill-icon" style="background:#9b5cf0">' + (uw.skill.icon ? '<img src="' + uw.skill.icon + '" alt="">' : '★2') + '</div>' +
          '<div class="skill-title"><div class="kind">★2 强化技能</div><div class="nm">' + esc(uw.skill.name || '—') + '</div></div>' +
          '</div><div class="lvbar">' + uw.skill.levels.map(function (x) {
            return '<button class="' + (x.lv === lv ? 'on' : '') + '" data-act="lv" data-i="uw" data-lv="' + x.lv + '">LV' + x.lv + '</button>';
          }).join('') + '</div><div class="skill-text">' + rich(e.text) + '</div></div>';
      }
    }

    const fi = s.favoriteItem || {};
    if (fi.name) {
      const lv = state.skillLv['fi'] || 10;
      const lvl = (fi.t2skill && fi.t2skill.levels) || [];
      const e = lvl.filter(function (x) { return x.lv === lv; })[0] || lvl[0] || { text: '' };
      html += '<div class="skill">' +
        '<div class="skill-head">' +
          '<div class="skill-icon" style="background:linear-gradient(135deg,#ff7a9a,#9b5cf0)">' + (fi.icon ? '<img src="' + fi.icon + '" alt="">' : '♥') + '</div>' +
          '<div class="skill-title"><div class="kind">爱用品</div><div class="nm">' + esc(fi.name) + '</div></div>' +
        '</div>' +
        '<div class="skill-text" style="color:var(--sub)">' + esc(fi.desc) + '</div>' +
        (fi.t1 ? '<div class="note"><b>T1</b>　' + rich(fi.t1) + '</div>' : '') +
        (lvl.length ? '<div class="lvbar">' + lvl.map(function (x) {
          return '<button class="' + (x.lv === lv ? 'on' : '') + '" data-act="lv" data-i="fi" data-lv="' + x.lv + '">LV' + x.lv + '</button>';
        }).join('') + '</div><div class="skill-text">' + rich(e.text) + '</div>' : '') +
      '</div>';
    }

    if (s.exMats && s.exMats.length) { html += secTitle('EX 技能材料'); html += matTable(s.exMats); }
    if (s.skillMats && s.skillMats.length) { html += secTitle('普通技能材料'); html += matTable(s.skillMats); }
    return html;
  }

  // 「★3 爱丽丝（女仆）」→ 找 App 里同名的学生，实现跳转
  function resolveSameName(rawName) {
    const nm = String(rawName || '').replace(/^★\d+\s*/, '').replace(/^NPC\s*/, '').trim();
    if (!nm) return null;
    for (let i = 0; i < INDEX.length; i++) {
      if (INDEX[i].name === nm) return INDEX[i];
    }
    return null;
  }

  function profileTab(s) {
    const p = s.profile || {};
    const rows = [
      ['全名', p.fullName], ['假名', p.kana], ['繁中译名', p.twName], ['简中译名', p.cnName],
      ['年龄', p.age], ['生日', p.birthday], ['身高', p.height], ['兴趣', p.hobby],
      ['设计', p.designer], ['画师', p.artist], ['声优', fmtCV(p.cv)],
      ['回忆大厅解锁', p.hallLevel ? 'Lv.' + p.hallLevel : ''], ['MomoTalk 解锁', p.momoTalkLevel],
    ].filter(function (r) { return r[1] && r[1] !== '-'; });
    let html = '<div style="height:14px"></div>';
    html += '<div class="panel"><div class="panel-body" style="padding:4px 14px">' + rows.map(function (r) {
      return '<div class="kvline"><span class="k">' + r[0] + '</span><span class="v" style="white-space:pre-line">' + esc(String(r[1]).replace(/\s*\n\s*/g, '\n')) + '</span></div>';
    }).join('') + '</div></div>';

    if (p.bio) html += secTitle('个人简介') + '<div class="panel"><div class="panel-body"><div class="quote">' + rich(p.bio) + '</div></div></div>';

    // 礼物偏好：三档「喜欢程度」，每档后面才是具体礼物
    const tiers = s.giftTiers || [];
    if (tiers.length) {
      html += secTitle('礼物偏好');
      html += '<div class="panel">' + tiers.map(function (t) {
        const items = (t.items || []);
        return '<div class="gift-tier">' +
          (t.level ? '<img class="lv" src="' + t.level + '" alt="">' : '<span class="lv empty"></span>') +
          '<div class="items">' + (items.length
            ? items.map(function (u) { return '<img src="' + u + '" alt="">'; }).join('')
            : '<span class="none">暂无收录</span>') + '</div>' +
        '</div>';
      }).join('') + '</div>';
    } else if (s.gifts && s.gifts.length) {
      html += secTitle('礼物偏好');
      html += '<div class="panel"><div class="panel-body"><div class="gift-row">' + s.gifts.map(function (g) {
        return '<span class="g"><img src="' + g + '" alt=""></span>';
      }).join('') + '</div></div></div>';
    }

    const c = s.chocolate || {};
    if (c.name) {
      html += secTitle('情人节巧克力');
      html += '<div class="panel"><div class="panel-body" style="display:flex;gap:12px;align-items:center">' +
        (c.icon ? '<img src="' + c.icon + '" style="width:60px;height:60px;object-fit:contain;border-radius:12px;background:var(--card-2)" alt="">' : '') +
        '<div><div style="font-weight:700">' + esc(c.name) + '</div><div style="font-size:12.5px;color:var(--sub);margin-top:3px;line-height:1.6">' + esc(c.desc) + '</div></div>' +
      '</div></div>';
    }

    if (s.sameName && s.sameName.length) {
      html += secTitle('同名角色');
      html += '<div class="panel">' + s.sameName.map(function (x) {
        const target = resolveSameName(x.name);
        const inner = '<span class="rowlabel">' + esc(x.name) + '</span>' +
          '<span class="r">' + (target ? '查看 ›' : '未收录') + '</span>';
        return target
          ? '<button class="rowlink" data-act="open" data-id="' + target.id + '" style="width:100%;text-align:left">' + inner + '</button>'
          : '<div class="rowlink" style="opacity:.55">' + inner + '</div>';
      }).join('') + '</div>';
    }

    html += secTitle('数据来源');
    html += '<div class="panel"><div class="panel-body" style="font-size:12.5px;color:var(--sub);line-height:1.7">' +
      '内容整理自 GameKee 蔚蓝档案 WIKI：' +
      '<a href="https://www.gamekee.com/ba/second/23941" target="_blank" rel="noreferrer">实装学生图鉴</a>' +
      (p.sourceUrl ? '<br>角色考据：<a href="' + p.sourceUrl + '" target="_blank" rel="noreferrer">' + p.sourceUrl + '</a>' : '') +
    '</div></div>';
    return html;
  }

  function voiceTab(s) {
    const cats = Object.keys(s.voices || {});
    if (!cats.length) return '<div class="empty">暂无语音资料</div>';
    if (!state.voiceCat || cats.indexOf(state.voiceCat) < 0) state.voiceCat = cats[0];
    const items = s.voices[state.voiceCat] || [];
    let html = '<div style="height:14px"></div><div class="voice-cat">' + cats.map(function (c) {
      return '<button class="chip ' + (c === state.voiceCat ? 'on' : '') + '" data-act="vcat" data-c="' + esc(c) + '">' + esc(c) +
        '<span style="opacity:.6;font-weight:600">' + s.voices[c].length + '</span></button>';
    }).join('') + '</div>';
    html += '<div class="panel"><div class="panel-body" style="padding:2px 14px">' + items.map(function (v) {
      return '<div class="voice-item"><div class="lb">' + esc(v.label) + '</div>' +
        (v.jp ? '<div class="jp">' + esc(v.jp) + '</div>' : '') +
        (v.zh ? '<div class="zh">' + esc(v.zh) + '</div>' : '') + '</div>';
    }).join('') + '</div></div>';
    return html;
  }

  function artTab(s) {
    const list = (s.portraits || []).slice();
    if (!list.length && !(s.hall && s.hall.image)) return '<div class="empty">暂无立绘</div>';
    let html = '<div style="height:14px"></div>';
    html += '<div class="gallery">' + list.map(function (p) {
      return '<figure><img loading="lazy" src="' + p.url + '" alt="">' +
        '<figcaption>' + esc(p.name) + '</figcaption></figure>';
    }).join('');
    if (s.hall && s.hall.image) {
      html += '<figure style="grid-column:1/-1"><img loading="lazy" src="' + s.hall.image + '" style="height:220px" alt="">' +
        '<figcaption>回忆大厅</figcaption></figure>';
    }
    html += '</div>';
    html += '<div style="margin-top:12px;font-size:11.5px;color:var(--sub);text-align:center">立绘为原图，需要联网加载</div>';
    return html;
  }

  /* ------------------------------------------------------------------ view */
  const view = document.getElementById('view');
  const topbar = document.getElementById('topbar');
  const tabbar = document.getElementById('tabbar');
  const detailEl = document.getElementById('detail');
  const sheetRoot = document.getElementById('sheet');

  function chrome() {
    if (state.detail) { topbar.style.display = 'none'; tabbar.style.display = 'none'; }
    else { topbar.style.display = ''; tabbar.style.display = ''; }
  }

  function renderTop() {
    const titles = { students: ['STUDENT DEX', '学生图鉴'], schools: ['ACADEMY', '学院'], favorites: ['FAVORITES', '收藏'], more: ['ABOUT', '更多'] };
    const t = titles[state.tab];
    const count = state.tab === 'students' ? (filtered().length + ' / ' + INDEX.length) : '';
    topbar.innerHTML =
      '<div class="topbar-title"><h1><small>' + t[0] + '</small>' + t[1] + '</h1>' +
      '<div class="count">' + count + '</div></div>' +
      (state.tab === 'students' ?
        '<div class="search ' + (state.query ? 'has-text' : '') + '">' + ICON.search +
        '<input id="q" type="search" inputmode="search" enterkeyhint="search" autocomplete="off" ' +
        'autocorrect="off" autocapitalize="off" spellcheck="false" ' +
        'placeholder="搜索学生 / 别名 / 学院" value="' + esc(state.query) + '">' +
        '<button class="clear" data-act="clear-q">✕</button></div>' : '');
    Array.prototype.forEach.call(tabbar.querySelectorAll('button'), function (b) {
      b.classList.toggle('on', b.dataset.tab === state.tab);
    });
  }

  function render() {
    chrome();
    if (state.detail) {
      const s = STUDENTS[state.detail];
      if (!s) { state.detail = null; return render(); }
      detailEl.innerHTML = detailHTML(s);
    } else {
      renderTop();
      let html = '';
      if (state.tab === 'students') html = listView();
      else if (state.tab === 'schools') html = schoolsView();
      else if (state.tab === 'favorites') html = favView();
      else html = moreView();
      view.innerHTML = html;
      window.scrollTo(0, 0);
    }
  }

  function rerenderBody() {
    if (state.detail) {
      const s = STUDENTS[state.detail];
      detailEl.innerHTML = detailHTML(s);
    } else {
      render();
    }
  }

  /* ------------------------------------------------------------- navigation */
  function openDetail(id) {
    state.detail = id;
    state.detailTab = 'overview';
    state.voiceCat = null;
    state.skillLv = {};
    detailEl.classList.add('in');
    render();
    try { history.pushState({ detail: id }, ''); } catch (e) { /* file:// */ }
  }

  function closeDetail() {
    if (!state.detail) return;
    detailEl.classList.remove('in');
    state.detail = null;
    render();
  }

  window.addEventListener('popstate', function () {
    if (state.detail) closeDetail();
  });

  /* ------------------------------------------------- 从左边缘右滑返回上一级 */
  // 和 iOS 原生返回手势一样：手指跟手拖动详情页，松手时按位移/速度判定。
  (function initEdgeSwipe() {
    const EDGE = 30;        // 手指必须落在左侧 30px 内才触发
    const RATIO = 0.3;      // 拖过屏宽 30% 就返回
    const VELOCITY = 0.45;  // px/ms，快速轻扫也能返回

    let active = false;
    let decided = false;
    let startX = 0;
    let startY = 0;
    let dx = 0;
    let startedAt = 0;

    function reset() {
      active = false;
      decided = false;
      dx = 0;
      detailEl.style.transition = '';
      detailEl.style.transform = '';
    }

    detailEl.addEventListener('touchstart', function (e) {
      if (!state.detail || e.touches.length !== 1) return;
      const t = e.touches[0];
      if (t.clientX > EDGE) return;
      active = true;
      decided = false;
      dx = 0;
      startX = t.clientX;
      startY = t.clientY;
      startedAt = Date.now();
      detailEl.style.transition = 'none';
    }, { passive: true });

    detailEl.addEventListener('touchmove', function (e) {
      if (!active || e.touches.length !== 1) return;
      const t = e.touches[0];
      dx = t.clientX - startX;
      const dy = t.clientY - startY;

      // 竖向为主 → 交给页面滚动，放弃本次手势
      if (!decided) {
        if (Math.abs(dy) > Math.abs(dx) && Math.abs(dy) > 10) { reset(); return; }
        if (dx > 8) decided = true;
      }
      if (dx <= 0) return;
      if (e.cancelable) e.preventDefault();
      detailEl.style.transform = 'translateX(' + dx + 'px)';
    }, { passive: false });

    function finish() {
      if (!active) return;
      const width = detailEl.clientWidth || window.innerWidth || 390;
      const velocity = dx / Math.max(1, Date.now() - startedAt);
      const back = dx > width * RATIO || (dx > 56 && velocity > VELOCITY);
      active = false;

      detailEl.style.transition = 'transform .26s cubic-bezier(.32,.72,0,1)';
      if (!back) {
        detailEl.style.transform = 'translateX(0)';
        setTimeout(reset, 280);
        return;
      }
      detailEl.style.transform = 'translateX(100%)';
      setTimeout(function () {
        // 先清掉内联样式，再走原来的关闭逻辑，避免视觉跳变
        detailEl.style.transition = '';
        detailEl.style.transform = '';
        closeDetail();
        dx = 0;
        decided = false;
      }, 240);
    }

    detailEl.addEventListener('touchend', finish);
    detailEl.addEventListener('touchcancel', finish);
  })();

  /* ----------------------------------------------------------------- events */
  document.addEventListener('click', function (e) {
    const btn = e.target.closest('[data-act]');
    if (!btn) return;
    const act = btn.dataset.act;

    if (act === 'open') { openDetail(Number(btn.dataset.id)); return; }
    if (act === 'back') { closeDetail(); return; }
    if (act === 'fav') {
      const id = Number(btn.dataset.id);
      if (state.favs.has(id)) state.favs.delete(id); else state.favs.add(id);
      store.setItem(LS_FAV, JSON.stringify(Array.from(state.favs)));
      detailEl.innerHTML = detailHTML(STUDENTS[state.detail]);
      return;
    }
    if (act === 'tab') { state.tab = btn.dataset.tab; render(); return; }
    if (act === 'quick') {
      const k = btn.dataset.k;
      state.filters.rarity = k === 'all' ? [] : [Number(k)];
      state.query = '';
      render();
      return;
    }
    if (act === 'sort-cycle') {
      const order = ['date', 'rarity', 'name'];
      state.sort = order[(order.indexOf(state.sort) + 1) % order.length];
      store.setItem(LS_SORT, state.sort);
      render();
      return;
    }
    if (act === 'clear-q') { state.query = ''; render(); return; }
    if (act === 'school') {
      state.tab = 'students';
      state.query = '';
      state.filters = { rarity: [], school: [btn.dataset.name], attack: [], defense: [], position: [], role: [], tactic: [], weapon: [] };
      render();
      return;
    }
    if (act === 'filter-open') { openSheet(); return; }
    if (act === 'filter-close') { closeSheet(true); return; }
    if (act === 'filter-reset') { state.draft = emptyFilters(); renderSheet(); return; }
    if (act === 'facet') {
      const k = btn.dataset.k;
      let v = btn.dataset.v;
      if (k === 'rarity') v = Number(v);
      const arr = state.draft[k];
      const i = arr.indexOf(v);
      if (i < 0) arr.push(v); else arr.splice(i, 1);
      renderSheet();
      return;
    }
    if (act === 'sync-now') {
      if (!window.BASync || !window.BASync.available()) { toast('联网同步需在 App 内使用'); return; }
      const st = document.getElementById('sync-status');
      if (st) st.textContent = '检查中…';
      window.BASync.check({ force: true, known: knownIds() }).then(function (r) {
        if (r && r.ok && r.added) {
          afterSync(r);
        } else if (r && r.ok) {
          toast('已是最新，共 ' + (r.total || INDEX.length) + ' 名学生');
        } else {
          toast('检查失败：' + ((r && r.error) || '网络错误'));
        }
        if (!state.detail) render();
      });
      return;
    }
    if (act === 'skill') {
      state.detailTab = 'skills';
      state.voiceCat = null;
      rerenderBody();
      const target = detailEl.querySelector('[data-skill="' + btn.dataset.i + '"]');
      if (target) target.scrollIntoView({ block: 'start' });
      return;
    }
    if (act === 'dt') { state.detailTab = btn.dataset.t; state.voiceCat = null; rerenderBody(); detailEl.scrollTop = 0; return; }
    if (act === 'lv') { state.skillLv[btn.dataset.i] = Number(btn.dataset.lv); rerenderBody(); return; }
    if (act === 'vcat') { state.voiceCat = btn.dataset.c; rerenderBody(); return; }
  });

  // --------------------------------------------------------------- search
  // IMPORTANT: never re-create the <input> while typing — on iOS that kills
  // the keyboard / IME composition. Only the result list and the counters are
  // refreshed, the input node itself is left untouched.
  let composing = false;

  function applySearch() {
    const box = topbar.querySelector('.search');
    if (box) box.classList.toggle('has-text', !!state.query);
    const cnt = topbar.querySelector('.count');
    if (cnt) cnt.textContent = filtered().length + ' / ' + INDEX.length;
    view.innerHTML = listView();
  }

  function scheduleSearch(delay) {
    clearTimeout(window.__qt);
    window.__qt = setTimeout(applySearch, delay == null ? 140 : delay);
  }

  document.addEventListener('input', function (e) {
    if (e.target.id !== 'q') return;
    state.query = e.target.value;
    if (composing) return; // wait for compositionend (Chinese / Japanese IME)
    scheduleSearch(140);
  });

  document.addEventListener('compositionstart', function (e) {
    if (e.target.id === 'q') composing = true;
  });

  document.addEventListener('compositionend', function (e) {
    if (e.target.id !== 'q') return;
    composing = false;
    state.query = e.target.value;
    scheduleSearch(40);
  });

  // native "clear" button of <input type="search">
  document.addEventListener('search', function (e) {
    if (e.target.id !== 'q') return;
    state.query = e.target.value;
    scheduleSearch(0);
  });

  /* ------------------------------------------------------------------ sheet */
  function emptyFilters() {
    return { rarity: [], school: [], attack: [], defense: [], position: [], role: [], tactic: [], weapon: [] };
  }

  function openSheet() {
    state.draft = JSON.parse(JSON.stringify(state.filters));
    sheetRoot.hidden = false;
    requestAnimationFrame(function () { sheetRoot.classList.add('open'); });
    renderSheet();
  }

  function closeSheet(apply) {
    if (apply && state.draft) state.filters = state.draft;
    state.draft = null;
    sheetRoot.classList.remove('open');
    setTimeout(function () { sheetRoot.hidden = true; }, 280);
    render();
  }

  function countWith(f) {
    const saved = state.filters;
    state.filters = f;
    let n = 0;
    INDEX.forEach(function (s) { if (matches(s)) n++; });
    state.filters = saved;
    return n;
  }

  function renderSheet() {
    const d = state.draft || emptyFilters();
    let html = '';
    Object.keys(FACETS).forEach(function (k) {
      const f = FACETS[k];
      if (!f.values.length) return;
      html += '<div class="fgroup"><div class="fl">' + f.label + '</div><div class="fchips">' +
        f.values.map(function (v) {
          const on = d[k].indexOf(v) >= 0;
          const label = f.fmt ? f.fmt(v) : v;
          return '<button class="fchip ' + (on ? 'on' : '') + '" data-act="facet" data-k="' + k + '" data-v="' + esc(v) + '">' + esc(label) + '</button>';
        }).join('') + '</div></div>';
    });
    sheetRoot.innerHTML =
      '<div class="sheet-backdrop" data-act="filter-close"></div>' +
      '<div class="sheet">' +
        '<div class="sheet-head"><h3>筛选</h3><button class="done" data-act="filter-close">完成</button></div>' +
        '<div class="sheet-body">' + html + '</div>' +
        '<div class="sheet-foot"><button class="btn ghost" data-act="filter-reset">重置</button>' +
        '<button class="btn primary" data-act="filter-close">查看 ' + countWith(d) + ' 名学生</button></div>' +
      '</div>';
  }

  /* ------------------------------------------------------------------- boot */

  function toast(msg) {
    const el = document.createElement('div');
    el.className = 'toast';
    el.textContent = msg;
    document.body.appendChild(el);
    requestAnimationFrame(function () { el.classList.add('show'); });
    setTimeout(function () {
      el.classList.remove('show');
      setTimeout(function () { if (el.parentNode) el.parentNode.removeChild(el); }, 300);
    }, 2600);
  }

  // 把联网同步到的学生合并进内存数据
  function mergeOverlay(ov) {
    if (!ov) return 0;
    let added = 0;
    (ov.index || []).forEach(function (summary) {
      if (!summary || !summary.id || BY_ID[summary.id]) return;
      const full = (ov.students || {})[summary.id];
      if (full) { summary.isNew = full.isNew; summary.syncedAt = full.syncedAt; }
      INDEX.push(summary);
      BY_ID[summary.id] = summary;
      added++;
    });
    Object.keys(ov.students || {}).forEach(function (id) {
      if (!STUDENTS[id]) STUDENTS[id] = ov.students[id];
    });
    if (added) buildFacets();
    return added;
  }

  function knownIds() {
    return INDEX.map(function (s) { return s.id; });
  }

  function afterSync(result) {
    if (!result || !result.ok || !result.added) return;
    window.BASync.load().then(function (ov) {
      mergeOverlay(ov);
      if (!state.detail) render();
      toast('已同步 ' + result.added + ' 名新学生');
    });
  }

  function startApp() {
    render();
    const boot = document.getElementById('boot');
    if (boot) boot.remove();
    if (window.BASync && window.BASync.available()) {
      // 等首屏渲染完再联网，避免拖慢启动
      setTimeout(function () { window.BASync.check({ known: knownIds() }).then(afterSync); }, 1200);
    }
  }

  tabbar.innerHTML = [
    ['students', '学生', ICON.students],
    ['schools', '学院', ICON.school],
    ['favorites', '收藏', ICON.heart],
    ['more', '更多', ICON.more],
  ].map(function (t) {
    return '<button data-act="tab" data-tab="' + t[0] + '">' + t[2] + '<span>' + t[1] + '</span></button>';
  }).join('');

  window.addEventListener('scroll', function () {
    if (window.scrollY > 4) topbar.classList.add('scrolled'); else topbar.classList.remove('scrolled');
  }, { passive: true });

  if (window.BASync && window.BASync.available()) {
    window.BASync.load()
      .then(function (ov) { mergeOverlay(ov); startApp(); })
      .catch(startApp);
  } else {
    startApp();
  }
})();
