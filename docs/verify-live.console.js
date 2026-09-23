/* ============================================================================
 * راستی‌آزمایی زندهٔ هِسته — اسکریپت کنسول مرورگر (۵ چک، ~۱ دقیقه)
 * ----------------------------------------------------------------------------
 * چرا این فایل هست: از محیط مدل هیچ دسترسی شبکه‌ای به `*.workers.dev` نیست
 * (فقط npm و GitHub باز است)، پس دیپلوی را فقط از روی درخت/تست‌ها می‌شود تأیید
 * کرد، نه از روی نسخهٔ زنده. این اسکریپت همان چک‌ها را با کوکی سشن خودت
 * (first-party) می‌زند — چیزی که از بیرون قابل تقلید نیست.
 *
 * طرز استفاده:
 *   ۱. در یک تب معمولی وارد هِسته شو:
 *      https://pdmaz.hamidreza-mazlaghani.workers.dev
 *   ۲. F12 → تب Console (اگر «allow pasting / اجازهٔ چسباندن» خواست، تأیید کن).
 *   ۳. کل محتوای همین فایل را پیست کن و Enter بزن.
 *
 * نکتهٔ مهمی که خودِ این اسکریپت روشن کرد:
 *   باگ ۵۰۰ پروداکشن (هلپرهای export نشده) **با ویرایش سرفصل تراکنش گرفته نمی‌شود**:
 *   در هندلر PATCH، شرط `k==='category' && normalizeCategoryName(...)` اول
 *   `k==='category'` را چک می‌کند و برای `title` اصلاً هلپر را صدا نمی‌زند
 *   (short-circuit). ضمناً خودِ صفحهٔ مالی هم فقط `title/amount/kind/tags`
 *   می‌فرستد، نه `category`. پس چک ۳ عمداً یک PATCH **با دستهٔ فعلیِ همان تراکنش**
 *   می‌زند: مسیر خراب را واقعاً اجرا می‌کند، ولی چون مقدار عوض نمی‌شود هیچ
 *   تغییر واقعی و هیچ `catManual`ی روی داده‌ات نمی‌گذارد.
 *   چک ۴ (پیش‌نمایش دسته‌بندی مجدد) همان دکمهٔ «🧹» در صفحهٔ مالی است — این یکی
 *   تنها مسیری است که در پروداکشن واقعاً به دست کاربر ۵۰۰ می‌داد.
 *
 * چه چیزی را عوض می‌کند؟ چک ۲ سرفصل یک تراکنش را لحظه‌ای عوض و **فوراً برمی‌گرداند**
 * (اگر برگشت شکست بخورد، id و سرفصل اصلی چاپ می‌شود تا دستی برگردانی). چک‌های
 * ۳ و ۴ هیچ تغییری روی داده نمی‌دهند (پیش‌نمایش، بدون apply). چک ۵ فقط دو فایل
 * استاتیک می‌خواند (شِل index.html و باندل React که به آن اشاره می‌کند) و هیچ
 * درخواست تغییری نمی‌زند.
 *
 * انتظار: پنج خط ✅ (و طبیعتاً اگر ورکر نسخهٔ قدیمی باشد، ❌ روی چک ۳ و ۴).
 * نکتهٔ تازه (۲۴ شهریور): کلادفلر assetهای استاتیک را «آدرس تمیز» می‌دهد —
 *   `/x.html` با ۳۰۷ به `/x` ریدایرکت می‌شود. چک ۱ به همین دلیل دیگر
 *   «redirected بودن» را خطا نمی‌شمارد و پاسخ **نهایی** را با نشانه‌های خودِ صفحه
 *   (`id="qIn"` و «ثبت سریع») می‌سنجد؛ قرمز شدنش همچنان یعنی یا دروازهٔ لاگین
 *   وسط است (سشن نیست) یا asset روی دیپلوی نیست. قبل از این اصلاح، همین چک روی
 *   دیپلویِ سالم قرمز می‌شد.
 *
 * ==========================================================================*/
(async () => {
  'use strict';

  const B = location.origin;
  const TIMEOUT = 20000;
  const rows = [];
  const out = (pass, label, detail) => {
    const line = (pass ? '✅' : '❌') + ' ' + label + (detail ? ' — ' + detail : '');
    rows.push(line);
    console.log(line);
    return line;
  };
  const kb = (s) => Math.round(new Blob([s]).size / 1024) + 'KB';

  // درخواست با کوکی same-origin (همان کاری که خودِ صفحه می‌کند)
  async function req(path, opt) {
    const o = Object.assign({ credentials: 'include' }, opt || {});
    if (o.body && typeof o.body === 'string') o.headers = Object.assign({ 'Content-Type': 'application/json' }, o.headers || {});
    const ctl = new AbortController();
    const t = setTimeout(() => ctl.abort(), TIMEOUT);
    o.signal = ctl.signal;
    try {
      const r = await fetch(B + path, o);
      const raw = await r.text();
      let d = null;
      try { d = raw ? JSON.parse(raw) : null; } catch (e) { /* HTML یا خالی */ }
      return { st: r.status, d: d, raw: raw, redirected: r.redirected, url: r.url };
    } catch (e) {
      return { st: 0, d: null, raw: '', err: e.message };
    } finally { clearTimeout(t); }
  }
  const is500 = (r) => r.st === 500;
  // 'HTTP 0' یعنی خودِ fetch خطا داد (آفلاین، DNS، بلاک‌شدن) — متن خطا را هم نشان بده
  const code = (r) => 'HTTP ' + r.st + (r.err ? ' (' + r.err + ')' : '');
  const hint500 = ' ← این همان باگ هلپرهای export نشده است؛ یعنی نسخهٔ قبل از فیکس روی دیپلوی است (deploy دوباره لازم است)';

  console.log('%cراستی‌آزمایی زندهٔ هِسته — ' + B, 'font-weight:bold');
  if (!/^https?:$/.test(location.protocol)) {
    console.warn('این اسکریپت را در تب خودِ اپ اجرا کن (نه در کنسول افزونه / صفحهٔ chrome-extension).');
  }

  // ۰) پیش‌نیاز: سشن
  const me = await req('/api/me');
  const user = me.d && me.d.user;
  out(me.st === 200 && !!user, 'سشن فعال است (GET /api/me)', code(me) + (user && user.email ? ' · ' + user.email : ''));
  if (me.st !== 200 || !user) {
    console.warn('اول در همین تب وارد هِسته شو و بعد اسکریپت را دوباره بزن — بقیهٔ چک‌ها بی‌معنا می‌شوند.');
    return rows.join('\n');
  }

  // ۱) صفحهٔ New Tab واقعاً روی دیپلوی است (و از دروازهٔ لاگین رد نمی‌شود)
  //    توجه: assetهای استاتیک کلادفلر «آدرس تمیز» دارند — درخواست `/newtab.html`
  //    با ۳۰۷ به `/newtab` ریدایرکت می‌شود (html_handling پیش‌فرض). پس
  //    «ریدایرکت‌شده بودن» به خودش خطا نیست؛ معیار، فایلی است که **در انتها** سرو
  //    شده. دروازهٔ لاگین (ورکر بدون سشن → ۳۰۲ به /design/login-page.html) همچنان
  //    قرمز می‌شود، چون آن صفحه نشانه‌های `qIn`/«ثبت سریع» را ندارد.
  const nt = await req('/newtab.html');
  const ntPath = (() => { try { return new URL(nt.url, B).pathname; } catch (e) { return String(nt.url || ''); } })();
  // دروازهٔ لاگین یعنی «آدرس نهایی، فایلِ صفحهٔ ورود است». دقت کن که خودِ
  // newtab.html هم یک لینک به /design/login-page.html دارد («ورود به هِسته»)،
  // پس نشانهٔ صفحهٔ ورود آدرسِ نهایی یا `id="fEmail"` است — نه هر ارجاعی به
  // login-page داخل متن صفحه.
  const atLoginGate = /login-page/.test(ntPath) || /id="fEmail"/.test(nt.raw || '');
  const isNewtab = nt.st === 200 && !atLoginGate && /id="qIn"/.test(nt.raw) && /ثبت سریع/.test(nt.raw);
  const assetRewrite = nt.redirected && (ntPath === '/newtab' || ntPath === '');
  out(
    isNewtab,
    'چک ۱ — باز شدن /newtab.html',
    isNewtab
      ? 'نسخهٔ New Tab روی دیپلوی است (' + kb(nt.raw) + (assetRewrite ? ' · ریدایرکت خودکار asset: /newtab.html → /newtab' : '') + ')'
      : atLoginGate
        ? 'به صفحهٔ ورود ریدایرکت شد — یا سشن در این تب نیست، یا دروازهٔ لاگین فعال است'
        : code(nt) + (nt.st === 404 ? ' — asset روی دیپلوی نیست' : '') + (nt.st === 200 ? ' — پاسخ ۲۰۰ است ولی نشانه‌های خودِ صفحهٔ New Tab در آن نیست' : '')
  );

  // یک تراکنش برای چک‌های ۲ و ۳ (لیست پیش‌فرض فقط ماه جاری است؛ بازهٔ باز می‌پرسیم)
  const list = await req('/api/transactions?from=2000-01-01&to=2030-12-31');
  const items = (list.d && list.d.items) || [];
  const tx = items[0];

  // ۲) ویرایش سرفصل — همان کاری که در UI هم می‌شود کرد (رفت و برگشت کامل)
  if (!tx) {
    out(false, 'چک ۲ — ویرایش سرفصل یک تراکنش', 'تراکنشی برای تست پیدا نشد (لیست خالی است)');
  } else {
    const original = String(tx.title || '');
    const probe = original + ' ✎test';
    const p1 = await req('/api/transactions/' + encodeURIComponent(tx.id), { method: 'PATCH', body: JSON.stringify({ title: probe }) });
    const wrote = p1.st === 200 && p1.d && p1.d.title === probe;
    out(
      wrote,
      'چک ۲ — ویرایش سرفصل تراکنش (PATCH /api/transactions/:id)',
      wrote
        ? 'ذخیره شد («' + original + '» → «' + probe + '»)'
        : code(p1) + (is500(p1) ? hint500 : (p1.d && p1.d.error ? ' · ' + p1.d.error : ''))
    );
    if (wrote) {
      const p2 = await req('/api/transactions/' + encodeURIComponent(tx.id), { method: 'PATCH', body: JSON.stringify({ title: original }) });
      const back = p2.st === 200 && p2.d && p2.d.title === original;
      out(back, 'برگشت سرفصل به حالت اول', back ? '«' + original + '»' : '⚠️ دستی برگردان: id=' + tx.id + ' — سرفصل اصلی: «' + original + '»');
    }
  }

  // ۳) PATCH با همان دستهٔ فعلی — مسیر `normalizeCategoryName` را واقعاً اجرا می‌کند
  //    (نکته در سرصفحهٔ فایل: ویرایش سرفصل این مسیر را لمس نمی‌کند)
  if (!tx) {
    out(false, 'چک ۳ — ویرایش دستهٔ تراکنش', 'تراکنشی برای تست پیدا نشد');
  } else if (!tx.category) {
    out(false, 'چک ۳ — ویرایش دستهٔ تراکنش', 'این تراکنش دسته ندارد؛ یکی از تراکنش‌های دارای دسته را دستی تست کن');
  } else {
    const same = String(tx.category);
    const p3 = await req('/api/transactions/' + encodeURIComponent(tx.id), { method: 'PATCH', body: JSON.stringify({ category: same }) });
    const ok3 = p3.st === 200 && p3.d && String(p3.d.category) === same && p3.d.catManual !== true;
    out(
      ok3,
      'چک ۳ — ویرایش دستهٔ تراکنش (همان دستهٔ فعلی، بدون تغییر واقعی)',
      ok3
        ? 'مسیر دسته‌بندی سالم است («' + same + '» بدون تغییر ماند)'
        : code(p3) + (is500(p3) ? hint500 : (p3.d && p3.d.error ? ' · ' + p3.d.error : ''))
    );
  }

  // ۴) پیش‌نمایش دسته‌بندی مجدد «متفرقه»ها — همان دکمهٔ «🧹» صفحهٔ مالی؛ فقط پیش‌نمایش
  const rc = await req('/api/transactions/recategorize', { method: 'POST', body: JSON.stringify({}) });
  const preview = rc.st === 200 && rc.d && rc.d.applied === false;
  out(
    preview,
    'چک ۴ — پیش‌نمایش دسته‌بندی مجدد (دکمهٔ 🧹)',
    preview
      ? 'اسکن‌شده: ' + rc.d.scanned + ' · پیشنهاد تغییر: ' + rc.d.matched + ' · دست‌نخورده: ' + rc.d.untouched + ' · هیچ تغییری اعمال نشد'
      : code(rc) + (is500(rc) ? hint500 : (rc.d && rc.d.error ? ' · ' + rc.d.error : ''))
  );

  // ۵) اپ React روی دیپلوی: از مهاجرت React به بعد، صفحهٔ مالی (و بقیهٔ صفحه‌ها) داخل
  //    باندل Vite هستند و /design/finance-page.html فقط یک ریدایرکت به /?page=finance است.
  //    خرابی کلاسیک دیپلوی این‌جاست: index.html تازه آپلود شده ولی باندل هش‌داری که به آن
  //    اشاره می‌کند روی دیپلوی نیست (صفحهٔ سفید). پس: شِل را می‌خوانیم، آدرس باندل را از
  //    خودش درمی‌آوریم، همان باندل را می‌گیریم و نشانهٔ صفحهٔ مالی React را در آن می‌سنجیم.
  const shell = await req('/');
  const bundleM = (shell.raw || '').match(/<script[^>]+type="module"[^>]+src="(\/assets\/index-[^"]+\.js)"/);
  const bundlePath = bundleM ? bundleM[1] : null;
  const bundle = bundlePath ? await req(bundlePath) : { st: 0, raw: '', err: 'index.html به هیچ باندل /assets/index-*.js اشاره نمی‌کند' };
  const hasFinanceReact = shell.st === 200 && !!bundlePath && bundle.st === 200 && /finance-react/.test(bundle.raw || '');
  out(
    hasFinanceReact,
    'چک ۵ — اپ React (باندل index.html) روی دیپلوی',
    hasFinanceReact
      ? 'شِل و باندل با هم می‌خوانند: ' + bundlePath + ' (' + kb(bundle.raw) + ') · صفحهٔ مالی React داخلش هست'
      : shell.st !== 200
        ? 'index.html: ' + code(shell)
        : !bundlePath
          ? 'index.html ۲۰۰ است ولی تگ <script type="module" src="/assets/index-*.js"> ندارد — شِل قدیمی روی دیپلوی است'
          : bundle.st !== 200
            ? 'باندل ' + bundlePath + ': ' + code(bundle) + ' — index.html به باندلی اشاره می‌کند که روی دیپلوی نیست (صفحهٔ سفید)؛ `public/assets` را با همان بیلد دیپلوی کن'
            : 'باندل ' + bundlePath + ' ۲۰۰ است ولی نشانهٔ صفحهٔ مالی React (finance-react) در آن نیست — بیلد قدیمی است'
  );

  const failed = rows.filter((r) => r.startsWith('❌')).length;
  console.log('--------------------------------------------------------------');
  console.log('%c' + (failed
    ? failed + ' چک قرمز شد — خط‌های بالا را بخوان'
    : 'همه سبز: این دیپلوی همان درخت مرج‌شدهٔ master است'), 'font-weight:bold');
  console.log('%cاین خط‌ها را کپی کن و بفرست:', 'font-weight:bold');
  console.log(rows.join('\n'));
  return rows.join('\n');
})();
