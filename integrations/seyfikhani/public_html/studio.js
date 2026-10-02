// Private panel for Melina: projects + courses/students, read and written live in LifeOS
// through studio-api.php (which holds the LifeOS token server-side). No data is cached here.
(function () {
  'use strict';
  const $ = s => document.querySelector(s);
  const API = 'studio-api.php';
  let csrf = '', me = null, tab = 'projects', busy = false;
  const S = { projects: [], cards: [], processes: [], contracts: [], financials: [], supplies: [], reminders: [], courses: [], students: [], pid: '', cid: '', openSt: '' };
  try { tab = localStorage.getItem('studio-tab') || 'projects'; S.pid = localStorage.getItem('studio-pid') || ''; S.cid = localStorage.getItem('studio-cid') || ''; } catch (e) {}

  /* ───────── helpers ───────── */
  function h(tag, attrs, ...kids) {
    const el = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs || {})) {
      if (v == null || v === false) continue;
      if (k === 'class') el.className = v;
      else if (k === 'style') el.style.cssText = v;
      else if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
      else el.setAttribute(k, v === true ? '' : v);
    }
    for (const c of kids.flat(Infinity)) if (c != null && c !== false) el.append(c.nodeType ? c : String(c));
    return el;
  }
  const fa = n => Number(n || 0).toLocaleString('fa-IR');
  const rial = n => fa(Math.round(Number(n) || 0)) + ' ریال';
  const faT = t => String(t || '').replace(/\d/g, d => '۰۱۲۳۴۵۶۷۸۹'[d]);
  const num = v => { const n = Number(String(v ?? '').replace(/[,٬\s]/g, '').replace(/[۰-۹]/g, d => '۰۱۲۳۴۵۶۷۸۹'.indexOf(d)).replace(/[٠-٩]/g, d => '٠١٢٣٤٥٦٧٨٩'.indexOf(d))); return Number.isFinite(n) ? n : 0; };
  const enDigits = s => String(s || '').replace(/[۰-۹]/g, d => '۰۱۲۳۴۵۶۷۸۹'.indexOf(d)).replace(/[٠-٩]/g, d => '٠١٢٣٤٥٦٧٨٩'.indexOf(d));
  function todayIso() { const p = {}; for (const x of new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Tehran', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date())) p[x.type] = x.value; return `${p.year}-${p.month}-${p.day}`; }
  const addDays = (iso, n) => new Date(Date.parse(iso + 'T12:00:00Z') + n * 864e5).toISOString().slice(0, 10);
  // Jalali ⇄ Gregorian (jdf algorithm)
  function g2j(gy, gm, gd) { const a = [0, 31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334]; const gy2 = gm > 2 ? gy + 1 : gy; let days = 355666 + 365 * gy + Math.floor((gy2 + 3) / 4) - Math.floor((gy2 + 99) / 100) + Math.floor((gy2 + 399) / 400) + gd + a[gm - 1]; let jy = -1595 + 33 * Math.floor(days / 12053); days %= 12053; jy += 4 * Math.floor(days / 1461); days %= 1461; if (days > 365) { jy += Math.floor((days - 1) / 365); days = (days - 1) % 365; } const jm = days < 186 ? 1 + Math.floor(days / 31) : 7 + Math.floor((days - 186) / 30), jd = 1 + (days < 186 ? days % 31 : (days - 186) % 30); return [jy, jm, jd]; }
  function j2g(jy, jm, jd) { jy += 1595; let days = -355668 + 365 * jy + Math.floor(jy / 33) * 8 + Math.floor(((jy % 33) + 3) / 4) + jd + (jm < 7 ? (jm - 1) * 31 : (jm - 7) * 30 + 186); let gy = 400 * Math.floor(days / 146097); days %= 146097; if (days > 36524) { gy += 100 * Math.floor(--days / 36524); days %= 36524; if (days >= 365) days++; } gy += 4 * Math.floor(days / 1461); days %= 1461; if (days > 365) { gy += Math.floor((days - 1) / 365); days = (days - 1) % 365; } let gd = days + 1; const ml = [0, 31, (gy % 4 === 0 && gy % 100 !== 0) || gy % 400 === 0 ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]; let gm; for (gm = 0; gm < 13 && gd > ml[gm]; gm++) gd -= ml[gm]; return [gy, gm, gd]; }
  const pad = n => String(n).padStart(2, '0');
  const isoToJ = iso => { if (!/^\d{4}-\d{2}-\d{2}$/.test(iso || '')) return ''; const [y, m, d] = iso.split('-').map(Number), j = g2j(y, m, d); return `${j[0]}/${pad(j[1])}/${pad(j[2])}`; };
  const jToIso = s => { const m = enDigits(s).trim().match(/^(\d{4})[\/\-.](\d{1,2})[\/\-.](\d{1,2})$/); if (!m) return null; const [jy, jm, jd] = [+m[1], +m[2], +m[3]]; if (jm < 1 || jm > 12 || jd < 1 || jd > 31) return null; const g = j2g(jy, jm, jd); return `${g[0]}-${pad(g[1])}-${pad(g[2])}`; };
  const jShort = iso => { if (!iso) return ''; const [y, m, d] = iso.split('-').map(Number); return new Intl.DateTimeFormat('fa-IR-u-ca-persian', { timeZone: 'UTC', day: 'numeric', month: 'long', year: 'numeric' }).format(Date.UTC(y, m - 1, d)); };
  function toast(t) { const el = $('#toast'); el.textContent = t; el.hidden = false; clearTimeout(toast._t); toast._t = setTimeout(() => { el.hidden = true; }, 3500); }

  async function call(url, opt = {}) {
    const r = await fetch(url, { credentials: 'same-origin', ...opt, headers: { 'Content-Type': 'application/json', 'X-CSRF': csrf, ...(opt.headers || {}) } });
    let d = null; try { d = await r.json(); } catch (e) {}
    if (r.status === 401 && url.includes('a=api')) { showLogin(); throw new Error((d && d.error) || 'ابتدا وارد شو.'); }
    if (!r.ok) throw new Error((d && d.error) || 'خطا ' + r.status);
    return d;
  }
  const api = (path, method = 'GET', body) => call(`${API}?a=api&p=${encodeURIComponent(path)}`, { method, body: body === undefined ? undefined : JSON.stringify(body) });
  async function act(fn, okMsg) { try { await fn(); if (okMsg) toast(okMsg); } catch (e) { toast(e.message); } await load(); }

  /* ───────── modal form ───────── */
  // fields: [{k, l, t:'text'|'num'|'money'|'date'|'time'|'sel'|'area'|'check'|'days', o:[[v,l]], req, full}]
  function form(title, fields, initial, onSubmit, extra) {
    const m = $('#modal'), f = $('#modalForm'); f.textContent = '';
    const v = { ...(initial || {}) };
    f.append(h('h2', {}, title));
    for (const x of fields) {
      const id = 'f_' + x.k, val = v[x.k];
      let input;
      if (x.t === 'sel') input = h('select', { id }, x.o.map(([ov, ol]) => h('option', { value: ov, selected: String(val ?? x.def ?? '') === String(ov) }, ol)));
      else if (x.t === 'area') input = h('textarea', { id, rows: 3 }, val || '');
      else if (x.t === 'check') { f.append(h('label', { class: 'st-check full' }, h('input', { type: 'checkbox', id, checked: val ?? x.def ?? false }), x.l)); continue; }
      else if (x.t === 'days') { f.append(h('div', { class: 'full' }, h('label', {}, x.l), h('div', { class: 'st-days', id }, x.o.map(([dv, dl]) => h('label', {}, h('input', { type: 'checkbox', value: dv, checked: (val || []).map(Number).includes(dv) }), dl))))); continue; }
      else if (x.t === 'date') input = h('input', { id, value: isoToJ(val), placeholder: '۱۴۰۵/۰۷/۱۰', inputmode: 'numeric', dir: 'ltr' });
      else if (x.t === 'time') input = h('input', { id, type: 'time', value: val || x.def || '', dir: 'ltr' });
      else if (x.t === 'money') input = h('input', { id, value: val ? Number(val).toLocaleString('en-US') : '', inputmode: 'numeric', dir: 'ltr' });
      else input = h('input', { id, value: val ?? x.def ?? '', inputmode: x.t === 'num' ? 'numeric' : null });
      if (x.req) input.required = true;
      f.append(h('label', { class: x.full || x.t === 'area' ? 'full' : '' }, x.l + (x.req ? ' *' : ''), input));
    }
    const err = h('p', { class: 'st-err full' });
    const save = h('button', { class: 'st-btn', type: 'submit' }, 'ذخیره');
    f.append(err, h('footer', {}, save, h('button', { class: 'st-btn ghost', type: 'button', onclick: close }, 'انصراف'), extra ? extra(close) : null));
    function close() { m.hidden = true; f.onsubmit = null; }
    f.onsubmit = async e => {
      e.preventDefault(); err.textContent = '';
      const out = {};
      for (const x of fields) {
        const el = f.querySelector('#f_' + x.k);
        if (x.t === 'check') out[x.k] = el.checked;
        else if (x.t === 'days') out[x.k] = [...el.querySelectorAll('input:checked')].map(i => Number(i.value));
        else if (x.t === 'date') { const s = el.value.trim(); if (!s) out[x.k] = ''; else { const iso = jToIso(s); if (!iso) { err.textContent = `«${x.l}» را به شکل ۱۴۰۵/۰۷/۱۰ بنویس.`; return; } out[x.k] = iso; } }
        else if (x.t === 'num' || x.t === 'money') out[x.k] = el.value.trim() === '' ? '' : num(el.value);
        else out[x.k] = el.value.trim();
      }
      save.disabled = true;
      try { await onSubmit(out); close(); } catch (x) { err.textContent = x.message; }
      save.disabled = false;
    };
    m.hidden = false;
    const first = f.querySelector('input,select,textarea'); if (first) first.focus();
  }
  $('#modal').addEventListener('click', e => { if (e.target.id === 'modal') $('#modal').hidden = true; });
  document.addEventListener('keydown', e => { if (e.key === 'Escape') $('#modal').hidden = true; });

  /* ───────── projects ───────── */
  const STAGES = [['کنترل پروژه', 'تأیید رنگ از کارفرما'], ['کنترل پروژه', 'فرم ابعادبرداری برآوردی'], ['کنترل پروژه', 'فرم ابعادبرداری دقیق'], ['اجرا', 'ابعادبرداری دقیق'], ['تأمین', 'سفارش بیلت بر اساس قرارداد'], ['تأمین', 'سفارش یراق‌آلات بر اساس قرارداد'], ['تأمین', 'عقد قرارداد شیشه'], ['کنترل پروژه', 'ارسال تیپ‌بندی پنجره بر اساس قرارداد به کارفرما جهت تأیید'], ['کنترل پروژه', 'دریافت تأیید برآورد پنجره از کارفرما'], ['فنی', 'ارسال جزئیات برآورد پنجره جهت تأمین به کارخانه'], ['کنترل پروژه', 'ارسال تیپ‌بندی کرتین‌وال بر اساس قرارداد به کارفرما جهت تأیید'], ['کنترل پروژه', 'دریافت تأیید برآورد کرتین‌وال از کارفرما'], ['فنی', 'ارسال جزئیات برآورد کرتین‌وال جهت تأمین به کارخانه'], ['فنی', 'تهیه نقشهٔ جزئیات ساخت دقیق'], ['کنترل پروژه', 'دریافت تأیید نقشهٔ جزئیات ساخت از کارفرما'], ['فنی', 'ارسال جزئیات ساخت دقیق به کارخانه'], ['فنی', 'تهیه لیست ابعاد شیشه'], ['کنترل پروژه', 'ارسال لیست شیشه به کارفرما / کارخانه شیشه'], ['فنی', 'تهیه نقشهٔ شاپ'], ['کنترل پروژه', 'دریافت تأیید نقشهٔ شاپ از کارفرما'], ['فنی', 'ارسال نقشهٔ شاپ به کارخانه'], ['تأمین', 'وضعیت تأمین پروفیل‌ها'], ['تأمین', 'وضعیت تأمین شیشه'], ['تأمین', 'وضعیت تأمین اقلام نما'], ['تأمین', 'ارسال پنجره به پروژه'], ['تأمین', 'ارسال کرتین‌وال به پروژه'], ['تأمین', 'ارسال اقلام نما به پروژه'], ['اجرا', 'شروع نصب پنجره'], ['اجرا', 'شروع نصب کرتین‌وال'], ['اجرا', 'شروع نصب نما'], ['اجرا', 'شروع زیرسازی'], ['اجرا', 'اتمام نصب پنجره'], ['اجرا', 'اتمام نصب کرتین‌وال'], ['اجرا', 'اتمام نصب نما'], ['اجرا', 'تحویل پروژه']];
  // same weighting as LifeOS (control 10, technical 15, supply 30, execution per stage)
  const DEPT_W = { 'کنترل پروژه': 10, 'فنی': 15, 'تأمین': 30 }, EXEC_W = { 'ابعادبرداری دقیق': 2, 'شروع زیرسازی': 3, 'شروع نصب پنجره': 3, 'شروع نصب کرتین‌وال': 3, 'شروع نصب نما': 3, 'اتمام نصب پنجره': 9, 'اتمام نصب کرتین‌وال': 11, 'اتمام نصب نما': 9, 'تحویل پروژه': 2 };
  const DEPT_N = STAGES.reduce((m, [d]) => ({ ...m, [d]: (m[d] || 0) + 1 }), {});
  const INSTALL = new Set(['اتمام نصب پنجره', 'اتمام نصب کرتین‌وال', 'اتمام نصب نما']);
  function progress(stages) {
    const by = new Map(stages.map(s => [s.department + '|' + s.title, s])); let tot = 0, got = 0;
    for (const [d, t] of STAGES) { const w = d === 'اجرا' ? EXEC_W[t] || 0 : DEPT_W[d] / DEPT_N[d], s = by.get(d + '|' + t); tot += w; got += w * (s && s.status === 'done' ? 1 : s && d === 'اجرا' && INSTALL.has(t) ? Math.max(0, Math.min(100, Number(s.percent) || 0)) / 100 : 0); }
    const p = tot ? got / tot * 100 : 0; return p >= 99.999 ? 100 : Math.min(99, Math.round(p));
  }
  const COLS = [['todo', 'انجام نشده'], ['doing', 'در حال انجام'], ['review', 'بازبینی'], ['done', 'انجام شد']];
  const PRIO = [['n', 'عادی'], ['h', 'بالا'], ['l', 'پایین']];
  const PSTATUS = [['', 'فعال'], ['done', 'تمام‌شده']];
  const PCOLORS = ['#e0a93c', '#60a5fa', '#34d399', '#f472b6', '#a78bfa', '#fb923c'];

  function projectView() {
    const t = todayIso();
    const list = S.projects.slice().map((p, i) => [p, Number.isFinite(p.order) ? p.order : 1e6 + i]).sort((a, b) => a[1] - b[1]).map(x => x[0]);
    const cur = list.find(p => p.id === S.pid) || list[0];
    const side = h('aside', { class: 'st-side' }, h('div', { class: 'st-side-head' }, h('h2', {}, 'پروژه‌ها'), h('button', { class: 'st-btn small', onclick: newProject }, '＋ پروژه')),
      list.map(p => { const st = S.processes.filter(x => x.projectId === p.id), pct = progress(st);
        return h('button', { class: 'st-item' + (cur && p.id === cur.id ? ' on' : ''), style: `--c:${p.color || PCOLORS[0]}`, onclick: () => { S.pid = p.id; try { localStorage.setItem('studio-pid', p.id); } catch (e) {} render(); } },
          h('b', {}, p.name), h('div', { class: 'st-bar' }, h('i', { style: `width:${pct}%` })), h('small', {}, `${fa(pct)}٪ پیشرفت${p.status === 'done' ? ' · تمام‌شده' : ''}`)); }));
    if (!cur) return h('div', { class: 'st-layout' }, side, h('p', { class: 'st-empty' }, 'هنوز پروژه‌ای نیست — با «＋ پروژه» بساز.'));
    const stages = S.processes.filter(x => x.projectId === cur.id), cards = S.cards.filter(c => c.projectId === cur.id), rems = S.reminders.filter(r => r.projectId === cur.id && !r.done);
    const pct = progress(stages);
    const main = h('div', { class: 'st-main' },
      h('section', { class: 'st-card' },
        h('div', { class: 'st-head' }, h('div', {}, h('h2', {}, cur.name), h('p', { class: 'st-muted' }, [cur.client ? 'کارفرما: ' + cur.client : '', cur.deadline ? 'مهلت ' + jShort(cur.deadline) : ''].filter(Boolean).join(' · ') || '—')),
          h('div', { class: 'st-ops' }, h('button', { class: 'st-link', onclick: () => editProject(cur) }, 'ویرایش پروژه'))),
        h('div', { class: 'st-kpis', style: 'margin-top:12px' },
          h('div', {}, h('small', {}, 'پیشرفت وزنی'), h('b', {}, fa(pct) + '٪')),
          h('div', {}, h('small', {}, 'مراحل انجام‌شده'), h('b', {}, `${fa(stages.filter(s => s.status === 'done').length)} از ${fa(STAGES.length)}`)),
          h('div', {}, h('small', {}, 'کارهای باز'), h('b', {}, fa(cards.filter(c => c.col !== 'done').length))),
          h('div', {}, h('small', {}, 'یادآوری‌های فعال'), h('b', {}, fa(rems.length))))),
      me.scopes.includes('projectFiles') ? contractSection(cur) : null,
      remindersSection({ projectId: cur.id }, rems, 'یادآوری پروژه'),
      h('section', { class: 'st-card st-sec' }, h('h3', {}, 'کارت‌ها', h('button', { class: 'st-btn small', onclick: () => editCard({ projectId: cur.id, col: 'todo', prio: 'n' }) }, '＋ کار')),
        h('div', { class: 'st-kanban' }, COLS.map(([k, l]) => h('div', { class: 'st-col' }, h('b', {}, `${l} (${fa(cards.filter(c => (c.col || 'todo') === k).length)})`),
          cards.filter(c => (c.col || 'todo') === k).map(c => h('div', { class: 'st-kcard' + (c.col !== 'done' && c.due && c.due < t ? ' late' : '') },
            h('b', {}, c.title), h('small', {}, [c.due ? 'مهلت ' + jShort(c.due) : '', c.owner || '', c.prio === 'h' ? 'اولویت بالا' : ''].filter(Boolean).join(' · ')),
            h('div', { class: 'st-ops' }, h('select', { 'aria-label': 'ستون', onchange: e => act(() => api('/api/ext/col/cards/' + c.id, 'PATCH', { col: e.target.value, doneAt: e.target.value === 'done' ? Date.now() : null })) }, COLS.map(([v, lb]) => h('option', { value: v, selected: v === (c.col || 'todo') }, lb))),
              h('button', { class: 'st-link', onclick: () => editCard(c) }, 'ویرایش')))))))),
      stagesSection(cur, stages),
      me.scopes.includes('projectFiles') ? financeSection(cur) : null,
      me.scopes.includes('projectFiles') ? supplySection(cur) : null);
    return h('div', { class: 'st-layout' }, side, main);
  }
  function stagesSection(cur, stages) {
    const by = new Map(stages.map(s => [s.department + '|' + s.title, s]));
    const missing = STAGES.filter(([d, t]) => !by.has(d + '|' + t));
    const groups = {}; for (const [d, t] of STAGES) (groups[d] = groups[d] || []).push([d, t]);
    return h('section', { class: 'st-card st-sec' }, h('h3', {}, 'مراحل پروژه', missing.length ? h('button', { class: 'st-btn small ghost', onclick: () => act(() => seedStages(cur.id, missing), 'مراحل ساخته شد.') }, `ساخت ${fa(missing.length)} مرحلهٔ استاندارد`) : null),
      Object.entries(groups).map(([dep, rows]) => h('div', { class: 'st-stage-group' }, h('b', {}, dep),
        rows.map(([d, t]) => { const s = by.get(d + '|' + t); if (!s) return h('div', { class: 'st-stage' }, h('span', {}, '·'), h('span', { class: 'st-muted' }, t), h('span'));
          return h('div', { class: 'st-stage' + (s.status === 'done' ? ' done' : '') },
            h('input', { type: 'checkbox', checked: s.status === 'done', 'aria-label': t, onchange: e => act(() => api('/api/ext/col/projectProcesses/' + s.id, 'PATCH', { status: e.target.checked ? 'done' : 'todo' })) }),
            h('span', {}, t, h('small', {}, [s.status === 'doing' ? 'در حال انجام' : '', s.owner ? 'مسئول: ' + s.owner : '', s.reminderDate ? '🔔 ' + jShort(s.reminderDate) + ' ساعت ' + faT(s.reminderTime || '09:00') : '', s.note || ''].filter(Boolean).join(' · '))),
            h('button', { class: 'st-link', onclick: () => editStage(s) }, 'جزئیات')); }))));
  }
  async function seedStages(projectId, rows) { for (const [department, title] of rows) await api('/api/ext/col/projectProcesses', 'POST', { projectId, department, title, order: STAGES.findIndex(x => x[0] === department && x[1] === title), status: 'todo' }); }
  function newProject() {
    form('پروژهٔ تازه', [{ k: 'name', l: 'نام پروژه', req: true, full: true }, { k: 'client', l: 'کارفرما' }, { k: 'deadline', l: 'مهلت', t: 'date' }], {}, async b => {
      const color = PCOLORS.find(c => !S.projects.some(p => (p.color || PCOLORS[0]) === c)) || PCOLORS[S.projects.length % PCOLORS.length];
      const p = await api('/api/ext/col/projects', 'POST', { ...b, color, order: S.projects.length });
      await seedStages(p.id, STAGES); S.pid = p.id; await load(); toast('پروژه ساخته شد و در LifeOS هم هست.');
    });
  }
  function editProject(p) {
    form('ویرایش پروژه', [{ k: 'name', l: 'نام پروژه', req: true, full: true }, { k: 'client', l: 'کارفرما' }, { k: 'deadline', l: 'مهلت', t: 'date' }, { k: 'status', l: 'وضعیت', t: 'sel', o: PSTATUS }, { k: 'color', l: 'رنگ', t: 'sel', o: PCOLORS.map((c, i) => [c, ['طلایی', 'آبی', 'سبز', 'صورتی', 'بنفش', 'نارنجی'][i]]) }],
      p, b => act(() => api('/api/ext/col/projects/' + p.id, 'PATCH', b), 'ذخیره شد.'));
  }
  function editCard(c) {
    form(c.id ? 'ویرایش کار' : 'کار تازه', [{ k: 'title', l: 'عنوان', req: true, full: true }, { k: 'col', l: 'ستون', t: 'sel', o: COLS }, { k: 'due', l: 'مهلت', t: 'date' }, { k: 'owner', l: 'مسئول' }, { k: 'prio', l: 'اولویت', t: 'sel', o: PRIO }, { k: 'note', l: 'جزئیات', t: 'area' }], c,
      b => act(() => c.id ? api('/api/ext/col/cards/' + c.id, 'PATCH', { ...b, doneAt: b.col === 'done' ? (c.doneAt || Date.now()) : null }) : api('/api/ext/col/cards', 'POST', { ...b, projectId: c.projectId, doneAt: b.col === 'done' ? Date.now() : null }), 'ذخیره شد.'),
      c.id ? close => h('button', { type: 'button', class: 'st-link del', onclick: () => { if (confirm(`«${c.title}» حذف شود؟`)) { close(); act(() => api('/api/ext/col/cards/' + c.id, 'DELETE'), 'حذف شد.'); } } }, 'حذف') : null);
  }
  function editStage(s) {
    form(s.title, [{ k: 'status', l: 'وضعیت', t: 'sel', o: [['todo', 'انجام نشده'], ['doing', 'در حال انجام'], ['done', 'انجام شد']] }, { k: 'owner', l: 'مسئول' }, ...(INSTALL.has(s.title) ? [{ k: 'percent', l: 'درصد نصب', t: 'num' }] : []), { k: 'reminderDate', l: 'تاریخ یادآوری', t: 'date' }, { k: 'reminderTime', l: 'ساعت یادآوری', t: 'time', def: '09:00' }, { k: 'note', l: 'توضیحات', t: 'area' }], s,
      b => act(() => api('/api/ext/col/projectProcesses/' + s.id, 'PATCH', b), b.reminderDate ? 'ذخیره شد؛ یادآوری در LifeOS ساخته شد.' : 'ذخیره شد.'));
  }

  /* ───────── contract / statements / supply (scope projectFiles) ───────── */
  const SETTLE = [['cash', 'نقدی'], ['check', 'چک'], ['statement', 'صورت‌وضعیتی'], ['barter', 'تهاتری'], ['other', 'سایر']];
  const CONTRACT_F = [{ k: 'contractNo', l: 'شماره قرارداد' }, { k: 'subject', l: 'آیتم‌های قرارداد' }, { k: 'contractStartDate', l: 'تاریخ شروع قرارداد', t: 'date' }, { k: 'contractEndDate', l: 'تاریخ اتمام قرارداد', t: 'date' }, { k: 'area', l: 'متراژ (مترمربع)', t: 'num' }, { k: 'amount', l: 'مبلغ کل قرارداد (ریال)', t: 'money' }, { k: 'advancePayment', l: 'پیش‌پرداخت (ریال)', t: 'money' }, { k: 'settlementType', l: 'نوع تسویه', t: 'sel', o: SETTLE }, { k: 'note', l: 'توضیح', t: 'area' }];
  const FIN_F = [{ k: 'statementNo', l: 'شماره صورت‌وضعیت', t: 'num', req: true }, { k: 'amount', l: 'مبلغ صورت‌وضعیت (ریال)', t: 'money' }, { k: 'noticeSent', l: 'اعلام وضعیت به کارفرما ارسال شد', t: 'check' }, { k: 'noticeSentDate', l: 'تاریخ ارسال اعلام وضعیت', t: 'date' }, { k: 'noticeApproved', l: 'اعلام وضعیت تأیید شد', t: 'check' }, { k: 'noticeApprovedDate', l: 'تاریخ تأیید اعلام وضعیت', t: 'date' }, { k: 'statementSent', l: 'صورت‌وضعیت ارسال شد', t: 'check' }, { k: 'statementSentDate', l: 'تاریخ ارسال صورت‌وضعیت', t: 'date' }, { k: 'paidAmount', l: 'واریز کارفرما (ریال)', t: 'money' }, { k: 'paymentDate', l: 'تاریخ واریز', t: 'date' }, { k: 'note', l: 'توضیح', t: 'area' }];
  const SUP_F = [{ k: 'title', l: 'عنوان تأمین / اجرا', req: true, full: true }, { k: 'category', l: 'دسته‌بندی' }, { k: 'supplier', l: 'تأمین‌کننده' }, { k: 'date', l: 'تاریخ', t: 'date' }, { k: 'quantity', l: 'مقدار', t: 'num' }, { k: 'unit', l: 'واحد' }, { k: 'unitPrice', l: 'قیمت واحد (ریال)', t: 'money' }, { k: 'note', l: 'توضیح', t: 'area' }];
  const kv = (l, v) => h('div', {}, h('small', {}, l), h('b', {}, v || '—'));
  function contractSection(cur) {
    const c = S.contracts.find(x => x.projectId === cur.id), t = todayIso();
    const save = c => form('اطلاعات قرارداد', CONTRACT_F, c || { settlementType: 'cash' }, b => { b.remainingAmount = Math.max(0, num(b.amount) - num(b.advancePayment)); return act(() => c && c.id ? api('/api/ext/col/projectContracts/' + c.id, 'PATCH', b) : api('/api/ext/col/projectContracts', 'POST', { ...b, projectId: cur.id }), b.contractEndDate ? 'ذخیره شد؛ یادآوری تمدید در LifeOS تنظیم شد.' : 'ذخیره شد.'); });
    if (!c) return h('section', { class: 'st-card st-sec' }, h('h3', {}, 'قرارداد', h('button', { class: 'st-btn small', onclick: () => save(null) }, 'ثبت قرارداد')), h('p', { class: 'st-muted' }, 'هنوز اطلاعات قرارداد ثبت نشده.'));
    const left = c.contractEndDate ? Math.round((Date.parse(c.contractEndDate) - Date.parse(t)) / 864e5) : null;
    return h('section', { class: 'st-card st-sec' }, h('h3', {}, 'قرارداد', h('button', { class: 'st-link', onclick: () => save(c) }, 'ویرایش قرارداد')),
      h('div', { class: 'st-kpis' }, kv('شماره قرارداد', c.contractNo), kv('آیتم‌ها', c.subject), kv('شروع', jShort(c.contractStartDate)), kv('اتمام', c.contractEndDate ? jShort(c.contractEndDate) + (left < 0 ? ` (${fa(-left)} روز گذشته)` : ` (${fa(left)} روز مانده)`) : ''),
        kv('متراژ', c.area ? fa(c.area) + ' مترمربع' : ''), kv('مبلغ کل', c.amount ? rial(c.amount) : ''), kv('پیش‌پرداخت', c.advancePayment ? rial(c.advancePayment) : ''), kv('باقی‌مانده', rial(Math.max(0, num(c.amount) - num(c.advancePayment)))), kv('نوع تسویه', (SETTLE.find(x => x[0] === c.settlementType) || [])[1])),
      c.note ? h('p', { class: 'st-muted', style: 'margin-top:8px' }, c.note) : null);
  }
  function financeSection(cur) {
    const rows = S.financials.filter(x => x.projectId === cur.id).sort((a, b) => num(a.statementNo) - num(b.statementNo));
    const tot = rows.reduce((a, r) => { a.amount += num(r.amount); a.paid += num(r.paidAmount); return a; }, { amount: 0, paid: 0 });
    const edit = r => form(r && r.id ? 'ویرایش صورت‌وضعیت' : 'صورت‌وضعیت تازه', FIN_F, r || { statementNo: rows.length + 1 }, b => { b.remainingAmount = Math.max(0, num(b.amount) - num(b.paidAmount)); return act(() => r && r.id ? api('/api/ext/col/projectFinancials/' + r.id, 'PATCH', b) : api('/api/ext/col/projectFinancials', 'POST', { ...b, projectId: cur.id }), 'ذخیره شد.'); },
      r && r.id ? close => h('button', { type: 'button', class: 'st-link del', onclick: () => { if (confirm('این صورت‌وضعیت حذف شود؟')) { close(); act(() => api('/api/ext/col/projectFinancials/' + r.id, 'DELETE'), 'حذف شد.'); } } }, 'حذف') : null);
    const step = r => r.paidAmount && num(r.paidAmount) >= num(r.amount) && num(r.amount) ? h('span', { class: 'st-chip ok' }, 'تسویه') : r.statementSent ? h('span', { class: 'st-chip' }, 'صورت‌وضعیت ارسال شد') : r.noticeApproved ? h('span', { class: 'st-chip' }, 'اعلام وضعیت تأیید شد') : r.noticeSent ? h('span', { class: 'st-chip' }, 'اعلام وضعیت ارسال شد') : h('span', { class: 'st-chip bad' }, 'شروع نشده');
    return h('section', { class: 'st-card st-sec' }, h('h3', {}, 'صورت‌وضعیت‌ها و مالی', h('button', { class: 'st-btn small', onclick: () => edit(null) }, '＋ صورت‌وضعیت')),
      rows.length ? h('div', { class: 'st-scroll' }, h('table', { class: 'st-table' }, h('thead', {}, h('tr', {}, ['شماره', 'مبلغ', 'وضعیت', 'واریز کارفرما', 'باقی‌مانده', ''].map(x => h('th', {}, x)))),
        h('tbody', {}, rows.map(r => h('tr', {}, h('td', {}, fa(r.statementNo)), h('td', {}, rial(r.amount)), h('td', {}, step(r)), h('td', { class: 'pos' }, r.paidAmount ? rial(r.paidAmount) + (r.paymentDate ? ' · ' + jShort(r.paymentDate) : '') : '—'), h('td', { class: num(r.amount) - num(r.paidAmount) > 0 ? 'neg' : '' }, rial(Math.max(0, num(r.amount) - num(r.paidAmount)))), h('td', {}, h('button', { class: 'st-link', onclick: () => edit(r) }, 'ویرایش'))))),
        h('tfoot', {}, h('tr', {}, h('td', {}, h('b', {}, 'جمع')), h('td', {}, rial(tot.amount)), h('td'), h('td', { class: 'pos' }, rial(tot.paid)), h('td', { class: 'neg' }, rial(Math.max(0, tot.amount - tot.paid))), h('td'))))) : h('p', { class: 'st-muted' }, 'هنوز صورت‌وضعیتی ثبت نشده.'));
  }
  function supplySection(cur) {
    const rows = S.supplies.filter(x => x.projectId === cur.id).sort((a, b) => String(a.date || '').localeCompare(String(b.date || '')));
    const edit = r => form(r && r.id ? 'ویرایش تأمین / اجرا' : 'تأمین / اجرای تازه', SUP_F, r || { date: todayIso() }, b => act(() => r && r.id ? api('/api/ext/col/projectSupplies/' + r.id, 'PATCH', b) : api('/api/ext/col/projectSupplies', 'POST', { ...b, projectId: cur.id }), 'ذخیره شد.'),
      r && r.id ? close => h('button', { type: 'button', class: 'st-link del', onclick: () => { if (confirm(`«${r.title}» حذف شود؟`)) { close(); act(() => api('/api/ext/col/projectSupplies/' + r.id, 'DELETE'), 'حذف شد.'); } } }, 'حذف') : null);
    const total = rows.reduce((n, r) => n + num(r.quantity) * num(r.unitPrice), 0);
    return h('section', { class: 'st-card st-sec' }, h('h3', {}, 'تأمین و اجرا', h('button', { class: 'st-btn small', onclick: () => edit(null) }, '＋ ردیف')),
      rows.length ? h('div', { class: 'st-scroll' }, h('table', { class: 'st-table' }, h('thead', {}, h('tr', {}, ['عنوان', 'تأمین‌کننده', 'تاریخ', 'مقدار', 'قیمت واحد', 'جمع', ''].map(x => h('th', {}, x)))),
        h('tbody', {}, rows.map(r => h('tr', {}, h('td', {}, h('b', {}, r.title), r.category ? h('div', { class: 'st-muted' }, r.category) : null), h('td', {}, r.supplier || '—'), h('td', {}, r.date ? jShort(r.date) : '—'), h('td', {}, r.quantity ? fa(r.quantity) + ' ' + (r.unit || '') : '—'), h('td', {}, r.unitPrice ? rial(r.unitPrice) : '—'), h('td', {}, r.quantity && r.unitPrice ? rial(num(r.quantity) * num(r.unitPrice)) : '—'), h('td', {}, h('button', { class: 'st-link', onclick: () => edit(r) }, 'ویرایش'))))),
        total ? h('tfoot', {}, h('tr', {}, h('td', { colspan: 5 }, h('b', {}, 'جمع')), h('td', {}, rial(total)), h('td'))) : null)) : h('p', { class: 'st-muted' }, 'هنوز ردیفی ثبت نشده.'));
  }

  /* ───────── reminders (projects and courses) ───────── */
  function remindersSection(link, rems, label) {
    return h('section', { class: 'st-card st-sec' }, h('h3', {}, 'یادآوری‌ها', h('button', { class: 'st-btn small', onclick: () => editReminder({ ...link, date: todayIso(), time: '09:00' }, label) }, '＋ یادآوری')),
      me && !me.telegram ? h('p', { class: 'st-warn' }, 'تلگرام هنوز در LifeOS وصل نیست؛ یادآوری ذخیره می‌شود اما پیام تلگرام نمی‌رسد تا در تنظیمات LifeOS وصل شود.') : null,
      rems.length ? h('div', { class: 'st-list' }, rems.map(r => h('div', { class: 'st-row' + (r.done ? ' done' : '') },
        h('span', {}, '🔔 ', h('b', {}, r.title), ' · ', jShort(r.date), r.time ? ' ساعت ' + faT(r.time) : '', r.notifiedAt ? ' · ارسال شد ✓' : ''),
        h('span', { class: 'st-ops' }, h('button', { class: 'st-link', onclick: () => editReminder(r, label) }, 'ویرایش'), h('button', { class: 'st-link', onclick: () => act(() => api('/api/ext/reminders/' + r.id, 'PATCH', { done: true }), 'انجام شد.') }, 'انجام شد'),
          h('button', { class: 'st-link del', onclick: () => confirm('این یادآوری حذف شود؟') && act(() => api('/api/ext/reminders/' + r.id, 'DELETE'), 'حذف شد.') }, 'حذف'))))) : h('p', { class: 'st-muted' }, 'یادآوری فعالی نیست.'));
  }
  function editReminder(r, label) {
    form(r.id ? 'ویرایش یادآوری' : label, [{ k: 'title', l: 'عنوان', req: true, full: true }, { k: 'date', l: 'تاریخ', t: 'date', req: true }, { k: 'time', l: 'ساعت', t: 'time', req: true }, { k: 'leadMinutes', l: 'هشدار زودتر', t: 'sel', o: [['0', 'ندارد'], ['10', '۱۰ دقیقه قبل'], ['30', '۳۰ دقیقه قبل'], ['60', '۱ ساعت قبل'], ['180', '۳ ساعت قبل'], ['1440', '۱ روز قبل']] }, { k: 'notes', l: 'توضیحات', t: 'area' }], r,
      b => { if (!b.date) throw new Error('تاریخ لازم است.'); return act(() => r.id ? api('/api/ext/reminders/' + r.id, 'PATCH', b) : api('/api/ext/reminders', 'POST', { ...b, projectId: r.projectId, courseId: r.courseId }), 'یادآوری در LifeOS ثبت شد.'); });
  }

  /* ───────── courses & students ───────── */
  const WEEKDAYS = [[6, 'شنبه'], [0, 'یکشنبه'], [1, 'دوشنبه'], [2, 'سه‌شنبه'], [3, 'چهارشنبه'], [4, 'پنجشنبه'], [5, 'جمعه']];
  const CSTATUS = [['enroll', 'ثبت‌نام'], ['running', 'در حال برگزاری'], ['done', 'تمام‌شده']];
  const KIND = { full: 'پرداخت کامل', deposit: 'بیعانه', installment: 'قسط', refund: 'بازپرداخت' };
  function courseSessions(c) { // mirrors LifeOS sessions.js
    const N = Math.max(0, Math.min(60, Number(c && c.sessions) || 0)), days = (Array.isArray(c && c.days) ? c.days : []).map(Number);
    if (!c || !c.startDate || !days.length || !N) return [];
    const skip = new Set(c.skip || []), mv = c.moves || {}, out = []; let d = c.startDate, g = 800, k = 0;
    while (k < N && g-- > 0) { const wd = new Date(d + 'T12:00:00Z').getUTCDay(); if (days.includes(wd) && !skip.has(d)) { k++; const m = mv[d] || {}; out.push({ n: k, date: m.date || d, time: m.time || c.time || '' }); } d = addDays(d, 1); }
    return out;
  }
  function money(st) { const pays = st.payments || [], paid = pays.reduce((n, x) => n + (x.kind === 'refund' ? -1 : 1) * (Number(x.amount) || 0), 0), fee = Number(st.fee) || 0, off = st.status === 'withdrawn'; return { fee: off ? Math.max(0, paid) : fee, paid, remaining: off ? 0 : Math.max(0, fee - paid) }; }

  function courseView() {
    const t = todayIso();
    const list = S.courses.slice().sort((a, b) => String(b.startDate || '').localeCompare(String(a.startDate || '')) || (b.createdAt || 0) - (a.createdAt || 0));
    const cur = list.find(c => c.id === S.cid) || list[0];
    const side = h('aside', { class: 'st-side' }, h('div', { class: 'st-side-head' }, h('h2', {}, 'دوره‌ها'), h('button', { class: 'st-btn small', onclick: () => editCourse({ status: 'enroll', sessions: 8 }) }, '＋ دوره')),
      list.map(c => { const sts = S.students.filter(s => s.courseId === c.id), sum = sts.reduce((a, s) => { const m = money(s); a.fee += m.fee; a.paid += m.paid; a.n += s.status === 'withdrawn' ? 0 : 1; return a; }, { fee: 0, paid: 0, n: 0 }), pct = sum.fee ? Math.round(sum.paid / sum.fee * 100) : 0;
        return h('button', { class: 'st-item' + (cur && c.id === cur.id ? ' on' : ''), onclick: () => { S.cid = c.id; try { localStorage.setItem('studio-cid', c.id); } catch (e) {} render(); } },
          h('b', {}, c.name), h('div', { class: 'st-bar' }, h('i', { style: `width:${pct}%` })), h('small', {}, `${fa(pct)}٪ وصول · ${fa(sum.n)} نفر${c.status === 'done' ? ' · تمام‌شده' : ''}`)); }));
    if (!cur) return h('div', { class: 'st-layout' }, side, h('p', { class: 'st-empty' }, 'هنوز دوره‌ای نیست — با «＋ دوره» بساز.'));
    const rows = S.students.filter(s => s.courseId === cur.id).sort((a, b) => (a.status === 'withdrawn') - (b.status === 'withdrawn') || (a.createdAt || 0) - (b.createdAt || 0));
    const sum = rows.reduce((a, s) => { const m = money(s); a.fee += m.fee; a.paid += m.paid; a.rem += m.remaining; return a; }, { fee: 0, paid: 0, rem: 0 });
    const ses = courseSessions(cur), next = ses.find(x => x.date >= t), N = Math.max(0, Math.min(60, Number(cur.sessions) || 0));
    const rems = S.reminders.filter(r => r.courseId === cur.id && !r.done);
    const main = h('div', { class: 'st-main' },
      h('section', { class: 'st-card' },
        h('div', { class: 'st-head' }, h('div', {}, h('h2', {}, cur.name), h('p', { class: 'st-muted' }, [cur.startDate ? 'شروع ' + jShort(cur.startDate) : '', N ? fa(N) + ' جلسه' : '', (cur.days || []).length ? WEEKDAYS.filter(([k]) => cur.days.map(Number).includes(k)).map(x => x[1]).join(' و ') + (cur.time ? ' ساعت ' + faT(cur.time) : '') : '', next ? `جلسهٔ بعد: ${fa(next.n)} · ${next.date === t ? 'امروز' : jShort(next.date)}` : ''].filter(Boolean).join(' · ') || '—')),
          h('div', { class: 'st-ops' }, h('button', { class: 'st-link', onclick: () => editCourse(cur) }, 'ویرایش دوره'))),
        h('div', { class: 'st-kpis', style: 'margin-top:12px' },
          h('div', {}, h('small', {}, 'دانشجو'), h('b', {}, fa(rows.filter(s => s.status !== 'withdrawn').length))),
          h('div', {}, h('small', {}, 'جمع شهریه‌ها'), h('b', {}, rial(sum.fee))),
          h('div', {}, h('small', {}, 'دریافتی'), h('b', {}, rial(sum.paid))),
          h('div', {}, h('small', {}, 'باقی‌مانده'), h('b', {}, rial(sum.rem))))),
      h('section', { class: 'st-card st-sec' }, h('h3', {}, 'دانشجوها', h('button', { class: 'st-btn small', onclick: () => editStudent({ courseId: cur.id, fee: cur.price || '', status: 'active', plan: 'installment' }) }, '＋ دانشجو')),
        rows.length ? h('div', { class: 'st-scroll' }, h('table', { class: 'st-table' },
          h('thead', {}, h('tr', {}, ['#', 'نام', 'تماس', 'شهریه', 'پرداخت‌شده', 'باقی‌مانده', 'سررسید', N ? 'حضور' : null, ''].filter(x => x !== null).map(x => h('th', {}, x)))),
          h('tbody', {}, rows.map((s, i) => { const m = money(s), off = s.status === 'withdrawn', open = S.openSt === s.id;
            return [h('tr', { class: off ? 'off' : '' },
              h('td', {}, fa(i + 1)), h('td', {}, h('b', {}, s.name), ' ', off ? h('span', { class: 'st-chip' }, 'انصراف') : m.remaining ? h('span', { class: 'st-chip' + (s.dueDate && s.dueDate < t ? ' bad' : '') }, 'قسطی') : h('span', { class: 'st-chip ok' }, 'تسویه'), s.notes ? h('div', { class: 'st-muted' }, s.notes) : null),
              h('td', { dir: 'ltr' }, s.phone || '—'), h('td', {}, fa(m.fee)), h('td', { class: 'pos' }, fa(m.paid)), h('td', { class: m.remaining ? 'neg' : '' }, m.remaining ? fa(m.remaining) : '—'), h('td', {}, s.dueDate && m.remaining ? jShort(s.dueDate) : '—'),
              N ? h('td', {}, h('div', { class: 'st-att' }, Array.from({ length: N }, (_, k) => { const on = (s.attendance || []).includes(k + 1); return h('button', { class: on ? 'on' : '', title: ses[k] ? jShort(ses[k].date) : '', 'aria-label': 'جلسهٔ ' + (k + 1), onclick: () => { const a = new Set(s.attendance || []); a.has(k + 1) ? a.delete(k + 1) : a.add(k + 1); act(() => api('/api/ext/col/students/' + s.id, 'PATCH', { attendance: [...a].sort((x, y) => x - y) })); } }, fa(k + 1)); }))) : null,
              h('td', {}, h('div', { class: 'st-ops' }, !off && m.remaining > 0 ? h('button', { class: 'st-btn small', onclick: () => editPayment(s) }, '＋ پرداخت') : null, h('button', { class: 'st-link', onclick: () => { S.openSt = open ? '' : s.id; render(); } }, open ? 'بستن' : 'پرداخت‌ها'), h('button', { class: 'st-link', onclick: () => editStudent(s) }, 'ویرایش')))),
              open ? h('tr', {}, h('td', { colspan: N ? 9 : 8 }, h('div', { class: 'st-pays' }, (s.payments || []).length ? (s.payments || []).slice().sort((a, b) => String(a.date).localeCompare(String(b.date))).map(p => h('div', {}, h('b', {}, KIND[p.kind] || p.kind), (p.kind === 'refund' ? '−' : '+') + rial(p.amount), h('span', { class: 'st-muted' }, [jShort(p.date), p.method, p.note, p.txId ? 'در مالی LifeOS ✓' : ''].filter(Boolean).join(' · ')),
                h('button', { class: 'st-link', onclick: () => editPayment(s, p) }, 'ویرایش'), h('button', { class: 'st-link del', onclick: () => confirm(`این ${KIND[p.kind]} حذف شود؟${p.txId ? ' تراکنش مالی‌اش هم حذف می‌شود.' : ''}`) && act(() => api(`/api/ext/students/${s.id}/payments/${p.id}`, 'DELETE'), 'حذف شد.') }, 'حذف'))) : h('span', { class: 'st-muted' }, 'پرداختی ثبت نشده.')))) : null]; })))) : h('p', { class: 'st-muted' }, 'هنوز دانشجویی نیست.'),
        h('p', { class: 'st-muted' }, 'همهٔ مبالغ به ریال است.')),
      remindersSection({ courseId: cur.id }, rems, 'یادآوری دوره'),
      ses.length ? h('section', { class: 'st-card st-sec' }, h('h3', {}, 'جلسه‌ها'), h('div', { class: 'st-list' }, ses.map(x => h('div', { class: 'st-row' + (x.date < t ? ' done' : '') }, h('span', {}, h('b', {}, 'جلسهٔ ' + fa(x.n)), ' · ', jShort(x.date), x.time ? ' · ساعت ' + faT(x.time) : ''), x.date === t ? h('span', { class: 'st-chip ok' }, 'امروز') : x === next ? h('span', { class: 'st-chip' }, 'بعدی') : null))),
        h('p', { class: 'st-muted', style: 'margin-top:8px' }, 'لغو یا جابه‌جایی جلسه فعلاً از داخل LifeOS انجام می‌شود.')) : null);
    return h('div', { class: 'st-layout' }, side, main);
  }
  function editCourse(c) {
    form(c.id ? 'ویرایش دوره' : 'دورهٔ تازه', [{ k: 'name', l: 'نام دوره', req: true, full: true }, { k: 'startDate', l: 'تاریخ شروع', t: 'date' }, { k: 'sessions', l: 'تعداد جلسات', t: 'num' }, { k: 'days', l: 'روزهای کلاس', t: 'days', o: WEEKDAYS }, { k: 'time', l: 'ساعت کلاس', t: 'time' }, { k: 'price', l: 'شهریهٔ هر نفر (ریال)', t: 'money' }, { k: 'status', l: 'وضعیت', t: 'sel', o: CSTATUS }, { k: 'cardNo', l: 'شماره کارت واریز' }, { k: 'cardName', l: 'به نام' }], c,
      async b => { if (c.id) await act(() => api('/api/ext/col/courses/' + c.id, 'PATCH', b), 'ذخیره شد.'); else { const r = await api('/api/ext/col/courses', 'POST', b); S.cid = r.id; await load(); toast('دوره ساخته شد.'); } },
      c.id ? close => h('button', { type: 'button', class: 'st-link del', onclick: () => { const n = S.students.filter(s => s.courseId === c.id).length; if (n) { alert('اول دانشجوهای این دوره را حذف کن (یا دوره را از داخل LifeOS حذف کن).'); return; } if (confirm(`دورهٔ «${c.name}» حذف شود؟`)) { close(); act(() => api('/api/ext/col/courses/' + c.id, 'DELETE'), 'حذف شد.'); } } }, 'حذف دوره') : null);
  }
  function editStudent(s) {
    const isNew = !s.id;
    form(isNew ? 'دانشجوی تازه' : 'ویرایش دانشجو', [{ k: 'name', l: 'نام و نام خانوادگی', req: true, full: true }, { k: 'phone', l: 'شماره تماس' }, { k: 'fee', l: 'شهریه (ریال)', t: 'money' }, { k: 'plan', l: 'نوع پرداخت', t: 'sel', o: [['installment', 'قسطی'], ['full', 'نقدی (کامل)']] }, ...(isNew ? [{ k: 'deposit', l: 'بیعانه (ریال)', t: 'money' }] : []), { k: 'dueDate', l: 'سررسید باقی‌مانده', t: 'date' }, { k: 'status', l: 'وضعیت', t: 'sel', o: [['active', 'فعال'], ['withdrawn', 'انصراف']] }, { k: 'notes', l: 'توضیحات', t: 'area' }], s,
      async b => {
        const { deposit, ...body } = b; if (body.plan === 'full') body.dueDate = '';
        if (!isNew) return act(() => api('/api/ext/col/students/' + s.id, 'PATCH', body), 'ذخیره شد.');
        const st = await api('/api/ext/col/students', 'POST', { ...body, courseId: s.courseId, fee: body.fee === '' ? 0 : body.fee, payments: [], attendance: [] });
        if (body.plan === 'full' && Number(st.fee)) await api(`/api/ext/students/${st.id}/payments`, 'POST', { kind: 'full', amount: Number(st.fee), toFinance: true });
        else if (Number(deposit)) await api(`/api/ext/students/${st.id}/payments`, 'POST', { kind: 'deposit', amount: Number(deposit), toFinance: true });
        await load(); toast('دانشجو اضافه شد.');
      },
      isNew ? null : close => h('button', { type: 'button', class: 'st-link del', onclick: () => { if (confirm(`«${s.name}» حذف شود؟ پرداخت‌هایش هم پاک می‌شود (تراکنش‌های مالی می‌مانند).`)) { close(); act(() => api('/api/ext/col/students/' + s.id, 'DELETE'), 'حذف شد.'); } } }, 'حذف دانشجو'));
  }
  function editPayment(s, p) {
    const m = money(s);
    form(`${p ? 'ویرایش پرداخت' : 'پرداخت'} · ${s.name}`, [{ k: 'kind', l: 'نوع', t: 'sel', o: Object.entries(KIND) }, { k: 'amount', l: 'مبلغ (ریال)', t: 'money', req: true }, { k: 'date', l: 'تاریخ', t: 'date' }, { k: 'method', l: 'روش' }, { k: 'note', l: 'یادداشت', full: true }, { k: 'toFinance', l: 'در «مالی» LifeOS هم با دستهٔ «آموزش» ثبت شود', t: 'check' }],
      p ? { ...p, toFinance: !!p.txId } : { kind: (s.payments || []).length ? 'installment' : 'deposit', amount: m.remaining || '', date: todayIso(), method: 'کارت به کارت', toFinance: true },
      b => act(() => p ? api(`/api/ext/students/${s.id}/payments/${p.id}`, 'PATCH', b) : api(`/api/ext/students/${s.id}/payments`, 'POST', b), 'پرداخت ثبت شد.'));
  }

  /* ───────── load / render / auth ───────── */
  async function load() {
    if (busy) return; busy = true; $('#syncState').textContent = 'در حال دریافت…';
    try {
      const sc = new Set((me && me.scopes) || []);
      const get = async (p, on) => on ? ((await api(p)).items || []) : [];
      const pf = sc.has('projectFiles');
      const [projects, cards, processes, courses, students, reminders, contracts, financials, supplies] = await Promise.all([get('/api/ext/col/projects', sc.has('projects')), get('/api/ext/col/cards', sc.has('projects')), get('/api/ext/col/projectProcesses', sc.has('projects')), get('/api/ext/col/courses', sc.has('courses')), get('/api/ext/col/students', sc.has('courses')), get('/api/ext/reminders', true), get('/api/ext/col/projectContracts', pf), get('/api/ext/col/projectFinancials', pf), get('/api/ext/col/projectSupplies', pf)]);
      Object.assign(S, { projects, cards, processes, courses, students, reminders, contracts, financials, supplies });
      $('#syncState').textContent = 'همگام با LifeOS · ' + new Intl.DateTimeFormat('fa-IR', { timeZone: 'Asia/Tehran', timeStyle: 'short' }).format(new Date());
      render();
    } catch (e) { $('#syncState').textContent = 'خطا در همگام‌سازی'; toast(e.message); }
    busy = false;
  }
  function render() {
    for (const b of document.querySelectorAll('#tabs button')) b.classList.toggle('on', b.dataset.tab === tab);
    const v = $('#view'); v.textContent = '';
    const sc = new Set((me && me.scopes) || []);
    if (tab === 'projects' && !sc.has('projects')) v.append(h('p', { class: 'st-empty' }, 'دسترسی پروژه‌ها برای این اتصال فعال نیست.'));
    else if (tab === 'courses' && !sc.has('courses')) v.append(h('p', { class: 'st-empty' }, 'دسترسی دوره‌ها برای این اتصال فعال نیست.'));
    else v.append(tab === 'projects' ? projectView() : courseView());
  }
  function showLogin() { me = null; $('#loginView').hidden = false; $('#tabs').hidden = $('#meta').hidden = true; $('#view').textContent = ''; }
  async function enter() {
    $('#loginView').hidden = true; $('#tabs').hidden = $('#meta').hidden = false;
    try { me = await api('/api/ext/me'); } catch (e) { $('#view').textContent = ''; $('#view').append(h('p', { class: 'st-empty' }, e.message)); return; }
    await load();
  }
  $('#loginForm').addEventListener('submit', async e => {
    e.preventDefault(); const f = e.target; $('#loginErr').textContent = '';
    try { const r = await call(`${API}?a=login`, { method: 'POST', body: JSON.stringify({ email: f.email.value, password: f.password.value }) }); csrf = r.csrf; f.password.value = ''; await enter(); }
    catch (x) { $('#loginErr').textContent = x.message; }
  });
  $('#logoutBtn').addEventListener('click', async () => { try { const r = await call(`${API}?a=logout`, { method: 'POST' }); csrf = r.csrf; } catch (e) {} showLogin(); });
  $('#refreshBtn').addEventListener('click', load);
  $('#tabs').addEventListener('click', e => { const b = e.target.closest('button[data-tab]'); if (!b) return; tab = b.dataset.tab; try { localStorage.setItem('studio-tab', tab); } catch (x) {} render(); });
  // LifeOS → site: re-read every 30 s while visible (never while a form is open, so typing is not lost)
  setInterval(() => { if (me && !document.hidden && $('#modal').hidden) load(); }, 30000);
  document.addEventListener('visibilitychange', () => { if (me && !document.hidden && $('#modal').hidden) load(); });

  (async () => {
    try { const s = await call(`${API}?a=state`); csrf = s.csrf; if (s.signedIn) await enter(); else showLogin(); }
    catch (e) { showLogin(); $('#loginErr').textContent = e.message; }
  })();
})();
