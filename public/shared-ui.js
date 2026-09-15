/* رابط مشترک lifeos — تم سراسری و رفتار پایهٔ نوار منو */
(function () {
  'use strict';

  var MODE_KEY = 'lifeos-mode';
  var LEGACY_MODE_KEY = 'mode';
  var root = document.documentElement;

  function validMode(value) {
    return value === 'light' || value === 'dark' ? value : null;
  }

  function readMode() {
    try {
      return validMode(localStorage.getItem(MODE_KEY)) ||
        validMode(localStorage.getItem(LEGACY_MODE_KEY));
    } catch (e) {
      return null;
    }
  }

  function saveMode(mode) {
    try {
      localStorage.setItem(MODE_KEY, mode);
      /* تقویمِ نسخه‌های قدیمی این کلید را می‌خواند؛ برای مهاجرت همگام می‌ماند. */
      localStorage.setItem(LEGACY_MODE_KEY, mode);
    } catch (e) {}
  }

  function paintMode(mode, persist) {
    mode = validMode(mode) || 'dark';
    root.dataset.mode = mode;
    var button = document.getElementById('modeBtn');
    if (button) {
      button.textContent = mode === 'light' ? '☀️' : '🌙';
      button.setAttribute('aria-label', mode === 'light' ? 'فعال‌کردن حالت شب' : 'فعال‌کردن حالت روز');
      button.title = mode === 'light' ? 'حالت شب' : 'حالت روز';
      button.setAttribute('aria-pressed', mode === 'light' ? 'true' : 'false');
    }
    if (persist) saveMode(mode);
    return mode;
  }

  /* قبل از رسم صفحه اجرا می‌شود تا هنگام جابه‌جایی، صفحه یک لحظه تغییر رنگ ندهد. */
  var initialMode = readMode() || validMode(root.dataset.mode) || 'dark';
  paintMode(initialMode, true);

  function initThemeButton() {
    var button = document.getElementById('modeBtn');
    paintMode(readMode() || root.dataset.mode || initialMode, false);
    if (!button || button.dataset.sharedThemeBound === '1') return;
    button.dataset.sharedThemeBound = '1';

    /* capture جلوی هندلرهای قدیمی و تکراری داخل صفحه‌ها را می‌گیرد. */
    button.addEventListener('click', function (event) {
      event.preventDefault();
      event.stopImmediatePropagation();
      var next = root.dataset.mode === 'light' ? 'dark' : 'light';
      paintMode(next, true);
    }, true);
  }

  function initMobileNav() {
    var nav = document.querySelector('.nav');
    if (!nav) return;
    var button = nav.querySelector('.nav-toggle');
    var createdHere = false;
    if (!button) {
      button = document.createElement('button');
      button.type = 'button';
      button.className = 'nav-toggle';
      button.setAttribute('aria-label', 'بازکردن منو');
      button.setAttribute('aria-expanded', 'false');
      button.textContent = '☰';
      button.dataset.sharedCreated = '1';
      createdHere = true;
      var brand = nav.querySelector('.brand');
      if (brand) brand.insertAdjacentElement('afterend', button);
      else nav.insertBefore(button, nav.firstChild);
    }

    var backdrop = document.querySelector('.nav-backdrop');
    if (!backdrop) {
      backdrop = document.createElement('div');
      backdrop.className = 'nav-backdrop';
      document.body.appendChild(backdrop);
    }

    /* دکمه‌ای که خود صفحه ساخته، هندلر خودش را دارد؛ دوباره وصل نکن. */
    if (!createdHere || button.dataset.sharedNavBound === '1') return;
    button.dataset.sharedNavBound = '1';

    function close() {
      document.body.classList.remove('nav-open');
      button.textContent = '☰';
      button.setAttribute('aria-expanded', 'false');
      button.setAttribute('aria-label', 'بازکردن منو');
    }
    function open() {
      document.body.classList.add('nav-open');
      button.textContent = '✕';
      button.setAttribute('aria-expanded', 'true');
      button.setAttribute('aria-label', 'بستن منو');
    }
    button.addEventListener('click', function (event) {
      event.preventDefault();
      event.stopPropagation();
      document.body.classList.contains('nav-open') ? close() : open();
    });
    backdrop.addEventListener('click', close);
    var links = nav.querySelector('.navlinks');
    if (links) links.addEventListener('click', function (event) {
      if (event.target.closest('a') && window.matchMedia('(max-width:900px)').matches) close();
    });
    document.addEventListener('keydown', function (event) {
      if (event.key === 'Escape') close();
    });
    window.addEventListener('resize', function () {
      if (window.innerWidth > 900) close();
    });
  }

  function boot() {
    initThemeButton();
    initMobileNav();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();

  window.addEventListener('storage', function (event) {
    if (event.key === MODE_KEY || event.key === LEGACY_MODE_KEY) {
      paintMode(validMode(event.newValue) || readMode() || 'dark', false);
    }
  });

  window.LifeTheme = { get: readMode, set: function (mode) { return paintMode(mode, true); } };
})();
