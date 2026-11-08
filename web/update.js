/*
 * update.js — 检查 GitHub Release 是否有新版本。
 *
 * 走原生桥（和 sync.js 共用 BAFetch）避免 file:// 页面的跨域问题；
 * 浏览器预览时退化为普通 fetch（GitHub API 允许 * 跨域）。
 *
 * 只用 `/releases/latest`：它本身就排除了 draft 与 prerelease。
 */
(function (root) {
  'use strict';

  var REPO = 'MilkTea0329/ba-student-dex';
  var API = 'https://api.github.com/repos/' + REPO + '/releases/latest';
  var TIMEOUT = 15000;

  function parseVer(v) {
    var s = String(v == null ? '' : v).replace(/^\s*v/i, '');
    var m = s.match(/(\d+)\.(\d+)(?:\.(\d+))?/);
    if (!m) return null;
    return [parseInt(m[1], 10) || 0, parseInt(m[2], 10) || 0, parseInt(m[3] || '0', 10) || 0];
  }

  function isNewer(latest, current) {
    var a = parseVer(latest);
    var b = parseVer(current);
    if (!a || !b) return false;
    for (var i = 0; i < 3; i++) {
      if (a[i] !== b[i]) return a[i] > b[i];
    }
    return false;
  }

  function withTimeout(promise, ms) {
    return new Promise(function (resolve, reject) {
      var done = false;
      var timer = setTimeout(function () {
        if (!done) { done = true; reject(new Error('timeout')); }
      }, ms);
      promise.then(function (v) {
        if (done) return;
        done = true; clearTimeout(timer); resolve(v);
      }, function (e) {
        if (done) return;
        done = true; clearTimeout(timer); reject(e);
      });
    });
  }

  function fetchLatest() {
    if (root.BAFetch && root.BAFetch.available()) {
      return root.BAFetch.json(API, { Accept: 'application/vnd.github+json' });
    }
    return fetch(API, { headers: { Accept: 'application/vnd.github+json' }, cache: 'no-store' })
      .then(function (r) {
        if (!r.ok) throw new Error('http-' + r.status);
        return r.json();
      });
  }

  /**
   * @param {string} currentVersion 形如 "V1.0.0"
   * @returns {Promise<{ok:boolean, hasUpdate:boolean, latest?:string, url?:string, notes?:string, name?:string, error?:string}>}
   */
  function check(currentVersion) {
    return withTimeout(fetchLatest(), TIMEOUT)
      .then(function (rel) {
        if (!rel || !rel.tag_name) return { ok: false, error: 'bad-response' };
        var latest = rel.tag_name;
        return {
          ok: true,
          hasUpdate: isNewer(latest, currentVersion),
          latest: latest,
          current: currentVersion,
          name: rel.name || latest,
          notes: rel.body || '',
          url: rel.html_url || ('https://github.com/' + REPO + '/releases/tag/' + latest),
          publishedAt: rel.published_at || ''
        };
      })
      .catch(function (e) {
        return { ok: false, error: String((e && e.message) || e) };
      });
  }

  root.BAUpdate = {
    check: check,
    isNewer: isNewer,
    current: function () { return root.BA_VERSION || ''; }
  };
})(typeof window !== 'undefined' ? window : this);
