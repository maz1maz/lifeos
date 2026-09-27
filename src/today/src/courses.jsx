// Online courses & students: tuition in rial, payments (deposit / installments / refunds), dues, attendance,
// reminder message, CSV/print, returning students, optional mirroring of payments into Finance.
import { useMemo, useState } from 'react';
import { useCol, Page, FormDrawer, api, fa, faD, jShort, todayIso, dueChip } from './life';
import { JalaliDateInput } from './jdate';
import './courses.css';

const rial = n => `${fa(Math.round(Number(n) || 0), 0)} ریال`;
const num = v => { const n = Number(String(v ?? '').replace(/[,٬\s]/g, '').replace(/[۰-۹]/g, d => '۰۱۲۳۴۵۶۷۸۹'.indexOf(d))); return Number.isFinite(n) ? n : 0; };
const normPhone = p => String(p || '').replace(/[۰-۹]/g, d => '۰۱۲۳۴۵۶۷۸۹'.indexOf(d)).replace(/\D/g, '').replace(/^98/, '0').replace(/^9/, '09');
const STATUS = [['enroll', 'ثبت‌نام'], ['running', 'در حال برگزاری'], ['done', 'تمام‌شده']];
const KIND = { deposit: 'بیعانه', installment: 'قسط', refund: 'بازپرداخت' };
const rid = () => Math.random().toString(36).slice(2, 10);
export function studentMoney(st) {
  const pays = st.payments || [], paid = pays.reduce((n, x) => n + (x.kind === 'refund' ? -1 : 1) * (Number(x.amount) || 0), 0);
  const fee = Number(st.fee) || 0, off = st.status === 'withdrawn';
  return { fee: off ? Math.max(0, paid) : fee, paid, remaining: off ? 0 : Math.max(0, fee - paid), deposit: pays.filter(x => x.kind === 'deposit').reduce((n, x) => n + (Number(x.amount) || 0), 0) };
}

function PayDrawer({ st, course, onClose, onSave }) {
  const m = studentMoney(st);
  const [f, setF] = useState({ kind: (st.payments || []).length ? 'installment' : 'deposit', amount: m.remaining ? m.remaining.toLocaleString('en-US') : '', date: todayIso(), method: 'کارت به کارت', note: '', toFinance: true });
  const [busy, setBusy] = useState(false), [err, setErr] = useState('');
  const set = (k, v) => setF(o => ({ ...o, [k]: v }));
  const submit = async e => { e.preventDefault(); const amount = num(f.amount); if (!amount) { setErr('مبلغ را بنویس.'); return; } setBusy(true); try { await onSave({ ...f, amount }); onClose(); } catch (x) { setErr(x.message); } setBusy(false); };
  return <div className="lf-drawer-bg" onClick={onClose}><form className="lf-drawer" onClick={e => e.stopPropagation()} onSubmit={submit}>
    <header><h2>پرداخت · {st.name}</h2><button type="button" onClick={onClose} aria-label="بستن">×</button></header>
    <div className="lf-drawer-body">
      <p className="cs-note">شهریه {rial(m.fee)} · پرداخت‌شده {rial(m.paid)} · <b>باقی‌مانده {rial(m.remaining)}</b></p>
      <label className="lf-field half"><span>نوع</span><select value={f.kind} onChange={e => set('kind', e.target.value)}>{Object.entries(KIND).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></label>
      <label className="lf-field half"><span>مبلغ (ریال) *</span><input value={f.amount} onChange={e => set('amount', e.target.value)} inputMode="numeric" autoFocus /></label>
      <label className="lf-field half"><span>تاریخ</span><JalaliDateInput value={f.date} onChange={v => set('date', v)} /></label>
      <label className="lf-field half"><span>روش</span><input value={f.method} onChange={e => set('method', e.target.value)} list="cs-methods" /><datalist id="cs-methods"><option value="کارت به کارت" /><option value="نقد" /><option value="پرداخت آنلاین" /><option value="چک" /></datalist></label>
      <label className="lf-field"><span>یادداشت</span><input value={f.note} onChange={e => set('note', e.target.value)} placeholder="مثلاً شمارهٔ پیگیری" /></label>
      <label className="cs-check"><input type="checkbox" checked={f.toFinance} onChange={e => set('toFinance', e.target.checked)} /> در «مالی» هم به‌عنوان {f.kind === 'refund' ? 'هزینه' : 'درآمد'} با دستهٔ «آموزش» ثبت شود</label>
      {err ? <p className="lf-err">{err}</p> : null}
    </div>
    <footer><button className="lf-btn" disabled={busy}>{busy ? '…' : 'ثبت پرداخت'}</button><button type="button" className="lf-btn ghost" onClick={onClose}>انصراف</button></footer>
  </form></div>;
}

function CopyDrawer({ courses, students, target, onClose, onCopy }) {
  const others = courses.filter(c => c.id !== target.id);
  const [src, setSrc] = useState(others[0]?.id || ''), [sel, setSel] = useState({});
  const have = new Set(students.filter(s => s.courseId === target.id).map(s => normPhone(s.phone)).filter(Boolean));
  const list = students.filter(s => s.courseId === src);
  return <div className="lf-drawer-bg" onClick={onClose}><div className="lf-drawer" onClick={e => e.stopPropagation()}>
    <header><h2>کپی دانشجو از دورهٔ دیگر</h2><button type="button" onClick={onClose}>×</button></header>
    <div className="lf-drawer-body">
      {!others.length ? <p className="lf-empty">دورهٔ دیگری نیست.</p> : <>
        <label className="lf-field"><span>از دورهٔ</span><select value={src} onChange={e => { setSrc(e.target.value); setSel({}); }}>{others.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
        <div className="cs-copy">{list.map(s => { const dup = have.has(normPhone(s.phone)); return <label key={s.id} className={dup ? 'dup' : ''}><input type="checkbox" disabled={dup} checked={!!sel[s.id]} onChange={e => setSel(o => ({ ...o, [s.id]: e.target.checked }))} /><b>{s.name}</b><small dir="ltr">{s.phone}</small>{dup ? <em>در این دوره هست</em> : null}</label>; })}{!list.length ? <p className="lf-empty">این دوره دانشجو ندارد.</p> : null}</div>
        <p className="cs-note">شهریهٔ هر نفر از شهریهٔ همین دوره ({rial(target.price)}) پر می‌شود؛ پرداخت‌ها کپی نمی‌شوند.</p>
      </>}
    </div>
    <footer><button className="lf-btn" disabled={!Object.values(sel).some(Boolean)} onClick={() => onCopy(list.filter(s => sel[s.id]))}>کپی {fa(Object.values(sel).filter(Boolean).length)} نفر</button><button type="button" className="lf-btn ghost" onClick={onClose}>انصراف</button></footer>
  </div></div>;
}

function reminderText(st, course) {
  const m = studentMoney(st);
  return `سلام ${st.name} عزیز 🌿\nمبلغ باقی‌ماندهٔ شهریهٔ دورهٔ «${course.name}» ${fa(m.remaining, 0)} ریال است${st.dueDate ? ` و سررسید آن ${jShort(st.dueDate)} است` : ''}.${course.cardNo ? `\nلطفاً به کارت ${course.cardNo}${course.cardName ? ` به نام ${course.cardName}` : ''} واریز کنید و رسید را بفرستید.` : ''}\nممنون از همراهی‌ات 🙏`;
}

function toCsv(course, rows) {
  const esc = v => { v = String(v ?? ''); return /[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v; };
  const head = ['ردیف', 'نام و نام خانوادگی', 'شماره تماس', 'شهریه (ریال)', 'بیعانه', 'پرداخت‌شده', 'باقی‌مانده', 'سررسید', 'وضعیت', 'جلسات حاضر', 'توضیحات'];
  const lines = rows.map((s, i) => { const m = studentMoney(s); return [i + 1, s.name, s.phone, m.fee, m.deposit, m.paid, m.remaining, s.dueDate ? jShort(s.dueDate) : '', s.status === 'withdrawn' ? 'انصراف' : m.remaining ? 'بدهکار' : 'تسویه', (s.attendance || []).length, s.notes || ''].map(esc).join(','); });
  const t = rows.reduce((a, s) => { const m = studentMoney(s); a.fee += m.fee; a.paid += m.paid; a.rem += m.remaining; a.dep += m.deposit; return a; }, { fee: 0, paid: 0, rem: 0, dep: 0 });
  lines.push(['', 'جمع', '', t.fee, t.dep, t.paid, t.rem, '', '', '', ''].map(esc).join(','));
  const blob = new Blob(['﻿' + [head.join(','), ...lines].join('\r\n')], { type: 'text/csv;charset=utf-8' });
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `${course.name || 'course'}.csv`; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}
function printList(course, rows) {
  const t = rows.reduce((a, s) => { const m = studentMoney(s); a.fee += m.fee; a.paid += m.paid; a.rem += m.remaining; return a; }, { fee: 0, paid: 0, rem: 0 });
  const tr = rows.map((s, i) => { const m = studentMoney(s); return `<tr${s.status === 'withdrawn' ? ' class="off"' : ''}><td>${faD(i + 1)}</td><td>${s.name || ''}</td><td dir="ltr">${s.phone || ''}</td><td>${fa(m.fee, 0)}</td><td>${fa(m.paid, 0)}</td><td>${fa(m.remaining, 0)}</td><td>${s.dueDate ? jShort(s.dueDate) : ''}</td><td>${(s.notes || '').replace(/</g, '&lt;')}</td></tr>`; }).join('');
  const w = window.open('', '_blank'); if (!w) return;
  w.document.write(`<!doctype html><html dir="rtl" lang="fa"><head><meta charset="utf-8"><title>${course.name}</title><style>body{font-family:Vazirmatn,Tahoma,sans-serif;padding:24px}h1{font-size:20px;margin:0 0 4px}p{color:#555;margin:0 0 16px}table{width:100%;border-collapse:collapse;font-size:13px}th,td{border:1px solid #ccc;padding:6px 8px;text-align:right}th{background:#f3f3f3}tfoot td{font-weight:700;background:#fafafa}tr.off td{color:#999;text-decoration:line-through}</style></head><body><h1>${course.name}</h1><p>${course.startDate ? 'شروع ' + jShort(course.startDate) + ' · ' : ''}${faD(rows.length)} دانشجو · شهریه ${fa(course.price || 0, 0)} ریال</p><table><thead><tr><th>#</th><th>نام و نام خانوادگی</th><th>تماس</th><th>شهریه (ریال)</th><th>پرداخت‌شده</th><th>باقی‌مانده</th><th>سررسید</th><th>توضیحات</th></tr></thead><tbody>${tr}</tbody><tfoot><tr><td></td><td>جمع</td><td></td><td>${fa(t.fee, 0)}</td><td>${fa(t.paid, 0)}</td><td>${fa(t.rem, 0)}</td><td></td><td></td></tr></tfoot></table><script>onload=()=>print()</script></body></html>`);
  w.document.close();
}

export function CoursesPage({ Nav }) {
  const courses = useCol('courses'), students = useCol('students');
  const [cid, setCid] = useState(() => { try { return localStorage.getItem('lifeos-course') || ''; } catch { return ''; } });
  const [cEdit, setCEdit] = useState(null), [sEdit, setSEdit] = useState(null), [pay, setPay] = useState(null), [copy, setCopy] = useState(false);
  const [tab, setTab] = useState('money'), [open, setOpen] = useState(null), [msg, setMsg] = useState(''), [q, setQ] = useState('');
  const list = (courses.items || []).slice().sort((a, b) => String(b.startDate || '').localeCompare(String(a.startDate || '')) || (b.createdAt || 0) - (a.createdAt || 0));
  const cur = list.find(c => c.id === cid) || list[0] || null;
  const pick = id => { setCid(id); setOpen(null); try { localStorage.setItem('lifeos-course', id); } catch {} };
  const all = students.items || [];
  const rows = useMemo(() => all.filter(s => cur && s.courseId === cur.id).sort((a, b) => (a.status === 'withdrawn') - (b.status === 'withdrawn') || (a.createdAt || 0) - (b.createdAt || 0)), [all, cur?.id]);
  const shown = rows.filter(s => !q.trim() || `${s.name} ${s.phone} ${s.notes || ''}`.includes(q.trim()));
  const sum = rows.reduce((a, s) => { const m = studentMoney(s); a.fee += m.fee; a.paid += m.paid; a.rem += m.remaining; a.dep += m.deposit; if (s.status === 'withdrawn') a.off++; else if (m.remaining) a.owe++; else a.clear++; return a; }, { fee: 0, paid: 0, rem: 0, dep: 0, off: 0, owe: 0, clear: 0 });
  const courseSum = c => all.filter(s => s.courseId === c.id).reduce((a, s) => { const m = studentMoney(s); a.n += s.status === 'withdrawn' ? 0 : 1; a.fee += m.fee; a.paid += m.paid; return a; }, { n: 0, fee: 0, paid: 0 });
  const history = (phone, selfId) => { const p = normPhone(phone); if (p.length < 10) return []; return all.filter(s => normPhone(s.phone) === p && s.id !== selfId && s.courseId !== cur?.id).map(s => ({ s, c: (courses.items || []).find(c => c.id === s.courseId) })); };
  const flash = t => { setMsg(t); setTimeout(() => setMsg(m => (m === t ? '' : m)), 4000); };

  const cFields = [{ k: 'name', l: 'نام دوره', req: true, ph: 'مثلاً طراحی و اجرای نما — دوره ۱' }, { k: 'startDate', l: 'تاریخ شروع', t: 'date', half: true }, { k: 'sessions', l: 'تعداد جلسات', t: 'num', half: true, def: '8' }, { k: 'price', l: 'شهریهٔ هر نفر (ریال)', t: 'money', half: true }, { k: 'status', l: 'وضعیت', t: 'sel', o: STATUS, def: 'enroll', half: true }, { k: 'cardNo', l: 'شماره کارت (برای پیام یادآوری)', half: true }, { k: 'cardName', l: 'به نام', half: true }, { k: 'notes', l: 'توضیحات', t: 'area' }];
  const sFields = [{ k: 'name', l: 'نام و نام خانوادگی', req: true }, { k: 'phone', l: 'شماره تماس', half: true, ph: '۰۹۱۲…' }, { k: 'fee', l: 'شهریه (ریال)', t: 'money', half: true, hint: 'برای تخفیف تغییر بده' }, ...(sEdit && !sEdit.id ? [{ k: 'deposit', l: 'بیعانه (ریال)', t: 'money', half: true, hint: 'اختیاری' }] : []), { k: 'dueDate', l: 'سررسید باقی‌مانده', t: 'date', half: true }, { k: 'status', l: 'وضعیت', t: 'sel', o: [['active', 'فعال'], ['withdrawn', 'انصراف']], def: 'active', half: true }, { k: 'notes', l: 'توضیحات', t: 'area' }];

  const finTx = async (st, p) => {
    if (!p.toFinance) return null;
    try { const r = await api('/api/transactions', { method: 'POST', body: JSON.stringify({ title: `${p.kind === 'refund' ? 'بازپرداخت' : KIND[p.kind]} شهریه · ${st.name} · ${cur.name}`, amount: p.amount, kind: p.kind === 'refund' ? 'expense' : 'income', category: 'آموزش', account: 'بدون حساب', date: p.date }) }); return r.id || null; } catch { return null; }
  };
  const addPayment = async (st, p) => {
    const txId = await finTx(st, p);
    const payment = { id: rid(), kind: p.kind, amount: p.amount, date: p.date, method: p.method || '', note: p.note || '', txId };
    await students.patch(st.id, { payments: [...(st.payments || []), payment] });
    flash(`${KIND[p.kind]} ${rial(p.amount)} برای ${st.name} ثبت شد${txId ? ' و در مالی هم آمد' : ''}.`);
  };
  const delPayment = async (st, p) => {
    if (!window.confirm(`این ${KIND[p.kind]} (${rial(p.amount)}) حذف شود؟${p.txId ? '\nتراکنش مربوط در مالی هم حذف می‌شود.' : ''}`)) return;
    if (p.txId) { try { await api(`/api/transactions/${p.txId}`, { method: 'DELETE' }); } catch {} }
    await students.patch(st.id, { payments: (st.payments || []).filter(x => x.id !== p.id) });
  };
  const saveStudent = async b => {
    const { deposit, ...body } = b;
    if (sEdit.id) return students.patch(sEdit.id, body);
    const st = await students.add({ ...body, courseId: cur.id, fee: body.fee ?? cur.price ?? 0, payments: [], attendance: [] });
    if (deposit) await addPayment(st, { kind: 'deposit', amount: deposit, date: todayIso(), method: '', note: '', toFinance: true });
  };
  const copyText = async st => { const t = reminderText(st, cur); try { await navigator.clipboard.writeText(t); flash('متن یادآوری کپی شد — در واتس‌اپ یا تلگرام بچسبان.'); } catch { window.prompt('متن را کپی کن:', t); } };
  const waLink = st => { const p = normPhone(st.phone); return p.length >= 10 ? `https://wa.me/98${p.replace(/^0/, '')}?text=${encodeURIComponent(reminderText(st, cur))}` : null; };
  const toggleAtt = (st, n) => { const a = new Set(st.attendance || []); a.has(n) ? a.delete(n) : a.add(n); students.patch(st.id, { attendance: [...a].sort((x, y) => x - y) }); };
  const doCopy = async picked => { for (const s of picked) await students.add({ courseId: cur.id, name: s.name, phone: s.phone, notes: s.notes || '', fee: Number(cur.price) || Number(s.fee) || 0, status: 'active', payments: [], attendance: [] }); setCopy(false); flash(`${fa(picked.length)} نفر کپی شد.`); };
  const removeCourse = async () => { const n = rows.length; if (!window.confirm(`دورهٔ «${cur.name}»${n ? ` و ${fa(n)} دانشجوی آن` : ''} حذف شود؟ این کار برگشت ندارد.`)) return; for (const s of rows) await students.remove(s.id); await courses.remove(cur.id); setCEdit(null); };

  const sessions = Math.max(0, Math.min(60, Number(cur?.sessions) || 0));
  const active = rows.filter(s => s.status !== 'withdrawn');
  return <Page Nav={Nav} kicker="کار" title="دوره‌ها و دانشجوها" sub="شهریه، پرداخت‌ها، سررسیدها و حضور و غیاب هر دوره" actions={<button className="lf-btn" onClick={() => setCEdit({})}>＋ دورهٔ تازه</button>}>
    {courses.items === null ? <p className="lf-empty">در حال دریافت…</p> : !list.length ? <p className="lf-empty">هنوز دوره‌ای نساختی. با «＋ دورهٔ تازه» شروع کن؛ هر دوره لیست دانشجوها و حساب شهریهٔ خودش را دارد.</p> : <>
      <div className="cs-courses">{list.map(c => { const s = courseSum(c), pct = s.fee ? Math.round(s.paid / s.fee * 100) : 0; return <button key={c.id} className={cur?.id === c.id ? 'on' : ''} onClick={() => pick(c.id)}>
        <b>{c.name}</b><small>{STATUS.find(x => x[0] === (c.status || 'enroll'))?.[1]}{c.startDate ? ` · ${jShort(c.startDate)}` : ''} · {fa(s.n)} نفر</small>
        <span className="cs-mini"><i style={{ width: `${Math.min(100, pct)}%` }} /></span><em>{fa(pct)}٪ وصول</em>
      </button>; })}</div>
      {cur ? <section className="lf-card cs-course">
        <div className="lf-row-head"><div><h2>{cur.name}</h2><small>{[cur.startDate ? `شروع ${jShort(cur.startDate)}` : '', sessions ? `${fa(sessions)} جلسه` : '', cur.price ? `شهریه ${rial(cur.price)}` : ''].filter(Boolean).join(' · ')}</small></div>
          <div className="lf-ops"><button className="lf-link" onClick={() => setCEdit(cur)}>ویرایش دوره</button><button className="lf-link" onClick={() => setCopy(true)}>کپی از دورهٔ دیگر</button><button className="lf-link" onClick={() => toCsv(cur, rows)}>خروجی اکسل</button><button className="lf-link" onClick={() => printList(cur, rows)}>چاپ</button></div></div>
        <div className="lf-kpis cs-kpis">
          <div><small>دانشجو</small><b>{fa(rows.length - sum.off)}</b><em>{fa(sum.clear)} تسویه · {fa(sum.owe)} بدهکار{sum.off ? ` · ${fa(sum.off)} انصراف` : ''}</em></div>
          <div><small>جمع شهریه‌ها</small><b>{rial(sum.fee)}</b><em>بیعانه‌ها {rial(sum.dep)}</em></div>
          <div><small>دریافتی</small><b className="pos">{rial(sum.paid)}</b><em>{fa(sum.fee ? sum.paid / sum.fee * 100 : 0, 0)}٪ وصول شده</em></div>
          <div className={sum.rem ? 'warn' : ''}><small>باقی‌ماندهٔ کل</small><b>{rial(sum.rem)}</b><em>{fa(sum.owe)} نفر</em></div>
        </div>
        <div className="cs-bar"><i style={{ width: `${sum.fee ? Math.min(100, sum.paid / sum.fee * 100) : 0}%` }} /></div>
        {msg ? <p className="lf-note cs-msg">{msg}</p> : null}
        <div className="cs-toolbar">
          <div className="fu-seg cs-tabs"><button className={tab === 'money' ? 'on' : ''} onClick={() => setTab('money')}>شهریه و پرداخت</button><button className={tab === 'att' ? 'on' : ''} onClick={() => setTab('att')}>حضور و غیاب</button></div>
          <input className="lf-search" value={q} onChange={e => setQ(e.target.value)} placeholder="جستجوی نام، شماره یا توضیح…" />
          <button className="lf-btn" onClick={() => setSEdit({ fee: cur.price || '', status: 'active' })}>＋ دانشجو</button>
        </div>
        {tab === 'money' ? <div className="cs-table">
          <div className="cs-tr cs-th"><span>#</span><span>نام و نام خانوادگی</span><span>تماس</span><span>شهریه</span><span>پرداخت‌شده</span><span>باقی‌مانده</span><span>سررسید</span><span>توضیحات</span><span /></div>
          {shown.map((s, i) => { const m = studentMoney(s), off = s.status === 'withdrawn', wa = waLink(s); return <div key={s.id} className={`cs-row ${off ? 'off' : m.remaining ? 'owe' : 'clear'} ${open === s.id ? 'open' : ''}`}>
            <div className="cs-tr" onClick={() => setOpen(open === s.id ? null : s.id)}>
              <span className="n">{fa(i + 1)}</span>
              <span className="nm"><b>{s.name}</b>{off ? <em className="tag off">انصراف</em> : m.remaining ? null : <em className="tag ok">تسویه</em>}{history(s.phone, s.id).length ? <em className="tag old" title={history(s.phone, s.id).map(h => h.c?.name).join('، ')}>دورهٔ دیگر</em> : null}</span>
              <span dir="ltr" className="ph">{s.phone || '—'}</span>
              <span>{fa(m.fee, 0)}</span>
              <span className="pos">{fa(m.paid, 0)}</span>
              <span className={m.remaining ? 'neg' : ''}>{m.remaining ? fa(m.remaining, 0) : '—'}</span>
              <span>{s.dueDate && m.remaining ? dueChip(s.dueDate) : '—'}</span>
              <span className="nt" title={s.notes || ''}>{s.notes || '—'}</span>
              <span className="ops" onClick={e => e.stopPropagation()}>{!off ? <button className="cs-b pay" onClick={() => setPay(s)}>＋ پرداخت</button> : null}<button className="cs-b" onClick={() => setSEdit(s)}>ویرایش</button></span>
            </div>
            {open === s.id ? <div className="cs-detail">
              <div className="cs-pays">{(s.payments || []).length ? (s.payments || []).slice().sort((a, b) => String(a.date).localeCompare(String(b.date))).map(p => <div key={p.id} className={p.kind}><b>{KIND[p.kind]}</b><span>{p.kind === 'refund' ? '−' : '+'}{rial(p.amount)}</span><small>{jShort(p.date)}{p.method ? ` · ${p.method}` : ''}{p.note ? ` · ${p.note}` : ''}{p.txId ? ' · در مالی ✓' : ''}</small><button className="lf-link del" onClick={() => delPayment(s, p)}>حذف</button></div>) : <p className="lf-empty">هنوز پرداختی ثبت نشده.</p>}</div>
              {m.remaining ? <div className="cs-remind"><button className="cs-b" onClick={() => copyText(s)}>📋 کپی متن یادآوری</button>{wa ? <a className="cs-b" href={wa} target="_blank" rel="noreferrer">واتس‌اپ</a> : null}<small>{reminderText(s, cur).split('\n')[1]}</small></div> : null}
              {s.notes ? <p className="cs-notes">📝 {s.notes}</p> : null}
              {history(s.phone, s.id).length ? <p className="cs-notes">🎓 در دوره‌های دیگر: {history(s.phone, s.id).map(h => `${h.c?.name || '—'} (${studentMoney(h.s).remaining ? 'بدهکار ' + rial(studentMoney(h.s).remaining) : 'تسویه'})`).join('، ')}</p> : null}
            </div> : null}
          </div>; })}
          {!rows.length ? <p className="lf-empty">هنوز دانشجویی در این دوره نیست — «＋ دانشجو» یا «کپی از دورهٔ دیگر».</p> : <div className="cs-tr cs-foot"><span /><span>جمع ({fa(rows.length - sum.off)} نفر)</span><span /><span>{fa(sum.fee, 0)}</span><span className="pos">{fa(sum.paid, 0)}</span><span className="neg">{fa(sum.rem, 0)}</span><span /><span /><span /></div>}
          <p className="cs-unit">همهٔ مبالغ به ریال · روی هر ردیف بزن تا پرداخت‌ها، یادآوری و سابقه باز شود.</p>
        </div> : <div className="cs-att">
          {!sessions ? <p className="lf-empty">تعداد جلسات دوره را در «ویرایش دوره» وارد کن.</p> : <>
            <div className="cs-att-grid" style={{ gridTemplateColumns: `minmax(150px,1.4fr) repeat(${sessions}, minmax(30px, 1fr)) 70px` }}>
              <span className="h">دانشجو</span>{Array.from({ length: sessions }, (_, i) => <span key={i} className="h c">ج{fa(i + 1)}</span>)}<span className="h c">حضور</span>
              {active.map(s => <FragmentRow key={s.id} s={s} sessions={sessions} onToggle={toggleAtt} />)}
              <span className="h">حاضرین هر جلسه</span>{Array.from({ length: sessions }, (_, i) => <span key={i} className="c tot">{fa(active.filter(s => (s.attendance || []).includes(i + 1)).length)}</span>)}<span />
            </div>
            <p className="cs-unit">روی هر خانه بزن تا حاضر/غایب شود.</p>
          </>}
        </div>}
      </section> : null}
    </>}
    <FormDrawer open={!!cEdit} title={cEdit?.id ? 'ویرایش دوره' : 'دورهٔ تازه'} fields={cFields} initial={cEdit} onClose={() => setCEdit(null)} onSubmit={async b => { if (cEdit.id) await courses.patch(cEdit.id, b); else { const r = await courses.add(b); pick(r.id); } }} extra={() => cEdit?.id ? <button type="button" className="lf-link del" onClick={removeCourse}>حذف این دوره</button> : null} />
    <FormDrawer open={!!sEdit} title={sEdit?.id ? 'ویرایش دانشجو' : 'دانشجوی تازه'} fields={sFields} initial={sEdit} onClose={() => setSEdit(null)} onSubmit={saveStudent}
      extra={(v) => { const h = history(v.phone, sEdit?.id); return <>{h.length ? <p className="cs-notes">🎓 این شماره در دوره‌های دیگر: {h.map(x => `${x.c?.name || '—'}${studentMoney(x.s).remaining ? ` (بدهکار ${rial(studentMoney(x.s).remaining)})` : ' (تسویه)'}`).join('، ')}</p> : null}{sEdit?.id ? <button type="button" className="lf-link del" onClick={() => { if (window.confirm(`«${sEdit.name}» حذف شود؟ پرداخت‌هایش هم پاک می‌شود (تراکنش‌های مالی می‌مانند).`)) { students.remove(sEdit.id); setSEdit(null); } }}>حذف دانشجو</button> : null}</>; }} />
    {pay ? <PayDrawer st={pay} course={cur} onClose={() => setPay(null)} onSave={p => addPayment(pay, p)} /> : null}
    {copy && cur ? <CopyDrawer courses={list} students={all} target={cur} onClose={() => setCopy(false)} onCopy={doCopy} /> : null}
  </Page>;
}
function FragmentRow({ s, sessions, onToggle }) {
  const att = new Set(s.attendance || []);
  return <><span className="nm">{s.name}</span>{Array.from({ length: sessions }, (_, i) => <button key={i} className={`c cell ${att.has(i + 1) ? 'on' : ''}`} onClick={() => onToggle(s, i + 1)} aria-label={`جلسهٔ ${i + 1}`}>{att.has(i + 1) ? '✓' : ''}</button>)}<span className="c pct">{fa(att.size)}/{fa(sessions)}</span></>;
}
