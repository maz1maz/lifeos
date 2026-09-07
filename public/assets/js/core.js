/* هسته — اسکریپت مشترک صفحات design
 * استفاده: <script src="/assets/js/core.js" defer></script>
 * API: window.LifeCore = { fa, esc, toast }
 */
(function (global) {
  'use strict';

  var faD = '۰۱۲۳۴۵۶۷۸۹';
  function fa(n) {
    return String(n).replace(/\d/g, function (d) { return faD[d]; });
  }
  function esc(s) {
    return String(s || '')
      .replace(/&/g, '&')
      .replace(/</g, '<')
      .replace(/>/g, '>')
      .replace(/"/g, '"');
  }
  function toast(msg) {
    var t = document.getElementById('toast');
    if (!t) {
      t = document.createElement('div');
      t.id = 'toast';
      document.body.appendChild(t);
    }
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(window._toastT);
    window._toastT = setTimeout(function () { t.classList.remove('show'); }, 2200);
  }

  function initTheme() {
    var mb = document.getElementById('modeBtn');
    try {
      if (localStorage.getItem('lifeos-mode') === 'light') {
        document.documentElement.dataset.mode = 'light';
        if (mb) mb.textContent = '☀️';
      }
    } catch (e) {}
    if (mb) {
      mb.addEventListener('click', function () {
        var r = document.documentElement;
        var light = r.dataset.mode === 'light';
        r.dataset.mode = light ? 'dark' : 'light';
        mb.textContent = light ? '🌙' : '☀️';
        try { localStorage.setItem('lifeos-mode', r.dataset.mode); } catch (e) {}
      });
    }
  }

  function initAccent() {
    try {
      var c = localStorage.getItem('accent');
      if (c) document.documentElement.style.setProperty('--acc', c);
    } catch (e) {}
  }

  function initNavMobile() {
    var nav = document.querySelector('.nav');
    if (!nav || nav.querySelector('.nav-toggle')) return;
    var btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'nav-toggle';
    btn.setAttribute('aria-label', 'منو');
    btn.textContent = '☰';
    var brand = nav.querySelector('.brand');
    if (brand && brand.nextSibling) nav.insertBefore(btn, brand.nextSibling);
    else nav.insertBefore(btn, nav.firstChild);

    var bd = document.querySelector('.nav-backdrop');
    if (!bd) {
      bd = document.createElement('div');
      bd.className = 'nav-backdrop';
      document.body.appendChild(bd);
    }
    function close() {
      document.body.classList.remove('nav-open');
      btn.textContent = '☰';
    }
    function open() {
      document.body.classList.add('nav-open');
      btn.textContent = '✕';
    }
    btn.addEventListener('click', function (e) {
      e.preventDefault();
      document.body.classList.contains('nav-open') ? close() : open();
    });
    bd.addEventListener('click', close);
    window.addEventListener('resize', function () {
      if (window.innerWidth > 900) close();
    });
  }

  function loadAuth() {
    var box = document.getElementById('navAuth');
    if (!box) return;
    fetch('/api/me', { credentials: 'include' })
      .then(function (r) { return r.json(); })
      .then(function (d) {
        if (d && d.user) {
          box.innerHTML =
            '<span class="navuser">' + esc(d.user.name || d.user.email || '') +
            '</span> <button type="button" class="navout" id="navOut">خروج</button>';
          var o = document.getElementById('navOut');
          if (o) {
            o.onclick = function () {
              fetch('/api/auth/logout', { method: 'POST', credentials: 'include' })
                .finally(function () { location.href = '/design/login-page.html'; });
            };
          }
        } else {
          box.innerHTML = '<a class="navin" href="/design/login-page.html">ورود</a>';
        }
      })
      .catch(function () {});
  }

  function boot() {
    initAccent();
    initTheme();
    initNavMobile();
    loadAuth();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }

  global.LifeCore = { fa: fa, esc: esc, toast: toast };
})(window);
