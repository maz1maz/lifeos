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

  /* بعضی صفحه‌های قدیمی نوار منوی خودشان را نگه داشته‌اند. این دو مسیر
     جدید را یک‌بار در همهٔ آن‌ها ثبت می‌کنیم تا منو در جابه‌جایی گم نشود. */
  function syncNavigationLinks() {
    var links = document.querySelector('.nav .navlinks');
    if (!links) return;
    [
      { href: '/design/planner-page.html', label: '✅ برنامه‌ریز' },
      { href: '/design/notes-page.html', label: '📝 یادداشت‌ها' }
    ].forEach(function (entry) {
      var link = links.querySelector('a[href="' + entry.href + '"]');
      if (!link) {
        link = document.createElement('a');
        link.href = entry.href;
        link.textContent = entry.label;
        links.appendChild(link);
      }
      if (location.pathname === entry.href) link.classList.add('on');
    });
  }

  /* داده‌ها در API با ISO نگه‌داری می‌شوند، اما هیچ‌کدام از فرم‌های سایت نباید
     تقویم میلادیِ مرورگر را به کاربر نشان دهند. این لایه inputهای تاریخ را به
     ورودی شمسی تبدیل می‌کند و مقدار پنهانِ ISO را برای کدهای فعلی حفظ می‌کند. */
  function initJalaliDateInputs() {
    var faDigits = '۰۱۲۳۴۵۶۷۸۹';
    function fa(value) { return String(value).replace(/\d/g, function (d) { return faDigits[d]; }); }
    function en(value) { return String(value).replace(/[۰-۹]/g, function (d) { return String(faDigits.indexOf(d)); }); }
    function jalaliToGregorianIso(jy, jm, jd) {
      var gy;
      if (jy > 979) { gy = 1600; jy -= 979; } else { gy = 621; }
      var days = (365 * jy) + (Math.floor(jy / 33) * 8) + Math.floor(((jy % 33) + 3) / 4) + 78 + jd + (jm < 7 ? (jm - 1) * 31 : ((jm - 7) * 30) + 186);
      gy += 400 * Math.floor(days / 146097); days %= 146097;
      if (days > 36524) { gy += 100 * Math.floor(--days / 36524); days %= 36524; if (days >= 365) days++; }
      gy += 4 * Math.floor(days / 1461); days %= 1461;
      if (days > 365) { gy += Math.floor((days - 1) / 365); days = (days - 1) % 365; }
      var gd = days + 1, leap = (gy % 4 === 0 && gy % 100 !== 0) || gy % 400 === 0;
      var months = [0,31,leap ? 29 : 28,31,30,31,30,31,31,30,31,30,31], gm;
      for (gm = 1; gm <= 12; gm++) { if (gd <= months[gm]) break; gd -= months[gm]; }
      return gy + '-' + String(gm).padStart(2, '0') + '-' + String(gd).padStart(2, '0');
    }
    function formatIso(iso, withTime) {
      if (!iso || !/^\d{4}-\d{2}-\d{2}/.test(iso)) return '';
      try {
        var output = new Intl.DateTimeFormat('fa-IR-u-ca-persian-nu-latn', { timeZone: 'Asia/Tehran', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(iso.slice(0, 10) + 'T12:00:00Z'));
        return fa(output.replace(/-/g, '/')) + (withTime && /^\d{2}:\d{2}/.test(iso.slice(11)) ? ' · ' + fa(iso.slice(11, 16)) : '');
      } catch (e) { return iso; }
    }
    function parseJalali(value, withTime) {
      var match = en(value).trim().match(/^(\d{4})[\/\-.](\d{1,2})[\/\-.](\d{1,2})(?:\s*(?:·|،)?\s*(\d{1,2}):(\d{2}))?$/);
      if (!match) return null;
      var jy = Number(match[1]), jm = Number(match[2]), jd = Number(match[3]), hh = match[4] == null ? '00' : String(Number(match[4])).padStart(2, '0'), mm = match[5] == null ? '00' : match[5];
      if (jy < 1200 || jy > 1600 || jm < 1 || jm > 12 || jd < 1 || jd > 31 || Number(hh) > 23 || Number(mm) > 59) return null;
      var iso = jalaliToGregorianIso(jy, jm, jd);
      return withTime ? iso + 'T' + hh + ':' + mm : iso;
    }
    Array.prototype.forEach.call(document.querySelectorAll('input[type="date"],input[type="datetime-local"]'), function (hidden) {
      if (hidden.dataset.jalaliReady === '1') return;
      var withTime = hidden.type === 'datetime-local', originalId = hidden.id;
      if (!originalId) return;
      hidden.dataset.jalaliReady = '1';
      hidden.type = 'hidden';
      var visible = document.createElement('input');
      visible.type = 'text'; visible.id = originalId + '-jalali'; visible.className = 'lifeos-jdate';
      visible.autocomplete = 'off'; visible.inputMode = 'numeric';
      visible.placeholder = withTime ? '۱۴۰۵/۰۶/۲۹ · ۱۴:۳۰' : '۱۴۰۵/۰۶/۲۹';
      visible.setAttribute('aria-label', (hidden.getAttribute('aria-label') || 'تاریخ شمسی'));
      hidden.insertAdjacentElement('afterend', visible);
      var label = document.querySelector('label[for="' + originalId + '"]');
      if (label) label.htmlFor = visible.id;
      function sync() { visible.value = formatIso(hidden.value, withTime); }
      var descriptor = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value');
      if (descriptor) Object.defineProperty(hidden, 'value', { configurable: true, get: function () { return descriptor.get.call(hidden); }, set: function (value) { descriptor.set.call(hidden, value); sync(); } });
      visible.addEventListener('change', function () {
        var iso = parseJalali(visible.value, withTime);
        if (!iso) { visible.setCustomValidity('تاریخ را به شکل ۱۴۰۵/۰۶/۲۹ وارد کن.'); visible.reportValidity(); return; }
        visible.setCustomValidity(''); hidden.value = iso;
        hidden.dispatchEvent(new Event('input', { bubbles: true }));
        hidden.dispatchEvent(new Event('change', { bubbles: true }));
      });
      visible.addEventListener('blur', function () { if (hidden.value) sync(); });
      sync();
    });
  }

  function boot() {
    syncNavigationLinks();
    initThemeButton();
    initMobileNav();
    initJalaliDateInputs();
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
