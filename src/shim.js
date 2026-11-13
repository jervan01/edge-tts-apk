/* 后端地址适配层：让原网页里 fetch('/api/...') 和 <audio src="/..."> 在 APK 里指向用户填的后端。
   - 网络请求走 Tauri http 插件（Rust 发出，不受 WebView 跨域限制）
   - 地址存 localStorage */
(function () {
  'use strict';
  var KEY = 'edgetts_backend';
  var isApp = !!window.__TAURI__;
  function norm(u) {
    u = (u || '').trim().replace(/\/+$/, '');
    if (!u) return '';
    if (!/^https?:\/\//i.test(u)) u = 'http://' + u;
    return u;
  }
  function get() { try { return localStorage.getItem(KEY) || ''; } catch (e) { return ''; } }
  function set(u) { try { localStorage.setItem(KEY, norm(u)); } catch (e) {} }
  window.BACKEND = {
    get: get, set: set, norm: norm,
    ready: function () { return !isApp || !!get(); },
    show: show
  };
  window.absUrl = function (u) {
    var b = get();
    return (typeof u === 'string' && u.charAt(0) === '/' && b) ? b + u : u;
  };

  /* fetch：相对路径 -> 后端地址 */
  var origFetch = window.fetch.bind(window);
  window.fetch = function (input, init) {
    if (typeof input === 'string' && input.charAt(0) === '/') {
      var b = get();
      if (isApp || b) {
        if (!b) return Promise.reject(new Error('未设置后端地址'));
        var http = window.__TAURI__ && window.__TAURI__.http;
        return (http ? http.fetch : origFetch)(b + input, init);
      }
    }
    return origFetch(input, init);
  };

  /* <audio>.src：相对路径 -> 后端地址 */
  try {
    var d = Object.getOwnPropertyDescriptor(HTMLMediaElement.prototype, 'src');
    Object.defineProperty(HTMLMediaElement.prototype, 'src', {
      configurable: true, enumerable: d.enumerable, get: d.get,
      set: function (v) { d.set.call(this, window.absUrl(v)); }
    });
  } catch (e) {}

  /* 样式：安全区 + 弹层 */
  var st = document.createElement('style');
  st.textContent =
    'header{padding-top:calc(12px + env(safe-area-inset-top))!important}' +
    '#bk{position:fixed;inset:0;z-index:100;background:rgba(0,0,0,.6);display:flex;align-items:center;justify-content:center;padding:16px}' +
    '#bk .box{background:var(--card);border:1px solid var(--line);border-radius:var(--r);padding:20px;width:min(440px,100%);box-shadow:0 10px 40px rgba(0,0,0,.5)}' +
    '#bk h2{margin-bottom:10px}#bk input{width:100%;margin:8px 0}#bk .msg{min-height:20px;font-size:13px;margin-top:4px}' +
    '#bk .msg.ok{color:#5ac8a0}#bk .msg.er{color:var(--danger)}';
  document.head.appendChild(st);

  function show() {
    if (document.getElementById('bk')) return;
    var w = document.createElement('div');
    w.id = 'bk';
    w.innerHTML =
      '<div class="box"><h2>后端地址</h2>' +
      '<div class="muted">填写 EDGE_TTS 服务端地址，例如 http://192.168.1.10:8000 或 https://tts.example.com。手机必须能访问到它。</div>' +
      '<input id="bk_url" placeholder="http://192.168.1.10:8000" autocomplete="off" autocapitalize="off" spellcheck="false" inputmode="url">' +
      '<div class="msg muted" id="bk_msg"></div>' +
      '<div class="row"><button id="bk_test">测试连接</button><button class="pri" id="bk_ok">保存并进入</button><button id="bk_cancel">取消</button></div></div>';
    document.body.appendChild(w);
    var ip = w.querySelector('#bk_url'), msg = w.querySelector('#bk_msg');
    ip.value = get();
    function say(t, c) { msg.textContent = t; msg.className = 'msg ' + (c || 'muted'); }
    w.querySelector('#bk_cancel').style.display = get() ? '' : 'none';
    w.querySelector('#bk_cancel').onclick = function () { w.remove(); };
    function test() {
      var u = norm(ip.value);
      if (!u) { say('请输入地址', 'er'); return Promise.reject(); }
      say('连接中…');
      var http = window.__TAURI__ && window.__TAURI__.http, t0 = Date.now();
      return (http ? http.fetch : origFetch)(u + '/api/settings', { method: 'GET' }).then(function (r) {
        if (!r.ok) throw new Error('HTTP ' + r.status);
        return r.json();
      }).then(function () { say('连接成功 · ' + (Date.now() - t0) + ' ms', 'ok'); return u; })
        .catch(function (e) { say('连接失败：' + (e && e.message || e), 'er'); throw e; });
    }
    w.querySelector('#bk_test').onclick = function () { test().catch(function () {}); };
    w.querySelector('#bk_ok').onclick = function () {
      var u = norm(ip.value);
      if (!u) return say('请输入地址', 'er');
      set(u); location.reload();
    };
    ip.addEventListener('keydown', function (e) { if (e.key === 'Enter') w.querySelector('#bk_ok').click(); });
    setTimeout(function () { ip.focus(); }, 50);
  }
  document.addEventListener('click', function (e) {
    if (e.target.closest && e.target.closest('#backend')) show();
  });
})();
