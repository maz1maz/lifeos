// Online courses & students: tuition in rial, payments (deposit / installments / refunds), dues, attendance,
// reminder message, CSV/print, returning students, optional mirroring of payments into Finance.
import { useEffect, useMemo, useState } from 'react';
import { useCol, Page, FormDrawer, api, fa, faD, jShort, todayIso, dueChip, SaveErrorBar } from './life-core';
import { JalaliDateInput } from './jdate';
import './courses.css';
import { CopyBtn, xcAuto } from './xcards';
import { SideLayout } from './sidelist';
import { WEEKDAYS, courseSessions, daysLabel } from './sessions';
const CS_HEX = { violet: '#9f47f0', graphite: '#3a3a42', cyan: '#17bcd6', blue: '#3478f6', gold: '#e0a93c', green: '#22b884', rose: '#f04466' };

const rial = n => `${fa(Math.round(Number(n) || 0), 0)} ریال`;
const num = v => { const n = Number(String(v ?? '').replace(/[,٬\s]/g, '').replace(/[۰-۹]/g, d => '۰۱۲۳۴۵۶۷۸۹'.indexOf(d))); return Number.isFinite(n) ? n : 0; };
const normPhone = p => String(p || '').replace(/[۰-۹]/g, d => '۰۱۲۳۴۵۶۷۸۹'.indexOf(d)).replace(/\D/g, '').replace(/^98/, '0').replace(/^9/, '09');
const STATUS = [['enroll', 'ثبت‌نام'], ['running', 'در حال برگزاری'], ['done', 'تمام‌شده']];
const KIND = { full: 'پرداخت کامل', deposit: 'بیعانه', installment: 'قسط', refund: 'بازپرداخت' };
const PLAN = [['installment', 'قسطی'], ['full', 'نقدی (کامل)']];
const rid = () => Math.random().toString(36).slice(2, 10);
export function studentMoney(st) {
  const pays = st.payments || [], paid = pays.reduce((n, x) => n + (x.kind === 'refund' ? -1 : 1) * (Number(x.amount) || 0), 0);
  const fee = Number(st.fee) || 0, off = st.status === 'withdrawn';
  return { fee: off ? Math.max(0, paid) : fee, paid, remaining: off ? 0 : Math.max(0, fee - paid), deposit: pays.filter(x => x.kind === 'deposit' || x.kind === 'full').reduce((n, x) => n + (Number(x.amount) || 0), 0) };
}

function PayDrawer({ st, edit, onClose, onSave }) {
  const m = studentMoney(st);
  const [f, setF] = useState(edit ? { kind: edit.kind, amount: Number(edit.amount || 0).toLocaleString('en-US'), date: edit.date || todayIso(), method: edit.method || '', note: edit.note || '', toFinance: !!edit.txId } : { kind: (st.payments || []).length ? 'installment' : 'deposit', amount: m.remaining ? m.remaining.toLocaleString('en-US') : '', date: todayIso(), method: 'کارت به کارت', note: '', toFinance: true });
  const [busy, setBusy] = useState(false), [err, setErr] = useState('');
  const set = (k, v) => setF(o => ({ ...o, [k]: v }));
  const submit = async e => { e.preventDefault(); const amount = num(f.amount); if (!amount) { setErr('مبلغ را بنویس.'); return; } setBusy(true); try { await onSave({ ...f, amount }); onClose(); } catch (x) { setErr(x.message); } setBusy(false); };
  return <div className="lf-drawer-bg" onClick={onClose}><form className="lf-drawer" onClick={e => e.stopPropagation()} onSubmit={submit}>
    <header><h2>{edit ? 'ویرایش پرداخت' : 'پرداخت'} · {st.name}</h2><button type="button" onClick={onClose} aria-label="بستن">×</button></header>
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
    <footer><button className="lf-btn" disabled={busy}>{busy ? '…' : edit ? 'ذخیرهٔ تغییرات' : 'ثبت پرداخت'}</button><button type="button" className="lf-btn ghost" onClick={onClose}>انصراف</button></footer>
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

// Group message to a course's students. Students have no LifeOS account, so sending goes through the phone:
// one SMS to everyone (same text), or one personalised WhatsApp chat per student, or copy text/numbers.
const MSG_TPL = [
  ['fee', 'یادآوری شهریه', 'سلام {نام} عزیز 🌿\nمبلغ باقی‌ماندهٔ شهریهٔ دورهٔ «{دوره}» {مانده} است و سررسید آن {سررسید} است.\n{کارت}\nممنون 🙏'],
  ['time', 'تغییر زمان جلسه', 'سلام {نام} عزیز\nزمان جلسهٔ بعدی دورهٔ «{دوره}» تغییر کرد:\n{جلسه بعد}'],
  ['next', 'یادآوری جلسه', 'سلام {نام} عزیز 🌿\nیادآوری: {جلسه بعد} — دورهٔ «{دوره}».\nمنتظرت هستیم.'],
  ['link', 'لینک جلسه', 'سلام {نام} عزیز\nلینک جلسهٔ امروز دورهٔ «{دوره}»:\n…'],
  ['free', 'متن دلخواه', '']
];
const intlPhone = p => { p = normPhone(p); return p.length >= 10 ? '98' + p.replace(/^0/, '') : ''; };
function fillMsg(t, st, course) {
  const m = st ? studentMoney(st) : null;
  const card = course.cardNo ? `شماره کارت: ${course.cardNo}${course.cardName ? ` (${course.cardName})` : ''}` : '';
  if (!st?.dueDate) t = t.replace(/\s*و سررسید آن \{سررسید\} است/g, '');
  const nx = courseSessions(course).find(x => x.date >= todayIso());
  t = t.replace(/\{جلسه بعد\}/g, nx ? `جلسهٔ ${fa(nx.n)} — ${WEEKDAYS.find(([k]) => k === new Date(nx.date + 'T12:00:00Z').getUTCDay())[1]} ${jShort(nx.date)}${nx.time ? ' ساعت ' + faD(nx.time) : ''}` : '…');
  return t.replace(/\{نام\}/g, st ? st.name : '').replace(/\{دوره\}/g, course.name || '').replace(/\{مانده\}/g, m ? `${fa(m.remaining, 0)} ریال` : '…')
    .replace(/\{سررسید\}/g, st?.dueDate ? jShort(st.dueDate) : '…').replace(/\{کارت\}/g, card).replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').replace(/سلام\s+عزیز/g, 'سلام').trim();
}
function BulkMsgDrawer({ course, rows, onClose, onLog }) {
  const today = todayIso(), week = new Date(Date.parse(today + 'T12:00:00Z') + 7 * 864e5).toISOString().slice(0, 10);
  const active = rows.filter(s => s.status !== 'withdrawn');
  const groups = { all: ['همه', active], owe: ['بدهکارها', active.filter(s => studentMoney(s).remaining > 0)], due: ['سررسید تا یک هفته', active.filter(s => studentMoney(s).remaining > 0 && s.dueDate && s.dueDate <= week)], pick: ['انتخاب دستی', active] };
  const [grp, setGrp] = useState('all'), [pickSel, setPickSel] = useState({}), [tpl, setTpl] = useState('free'), [text, setText] = useState(''), [done, setDone] = useState({}), [note, setNote] = useState(''), [logged, setLogged] = useState(false), [hist, setHist] = useState(false);
  const to = grp === 'pick' ? active.filter(s => pickSel[s.id]) : groups[grp][1];
  const withPhone = to.filter(s => intlPhone(s.phone)), noPhone = to.length - withPhone.length;
  const personal = /\{(نام|مانده|سررسید)\}/.test(text);
  const log = via => { if (logged) return; setLogged(true); onLog({ id: Math.random().toString(36).slice(2), at: Date.now(), text, n: withPhone.length, via, group: groups[grp][0] }); };
  const copy = async (v, what) => { try { await navigator.clipboard.writeText(v); setNote(`${what} کپی شد ✓`); } catch { setNote('کپی نشد.'); } setTimeout(() => setNote(''), 2000); };
  const smsHref = `sms:${withPhone.map(s => '+' + intlPhone(s.phone)).join(',')}?&body=${encodeURIComponent(fillMsg(text, null, course))}`;
  return <div className="lf-drawer-bg" onClick={onClose}><div className="lf-drawer cs-bulk" onClick={e => e.stopPropagation()}>
    <header><h2>📨 پیام گروهی · {course.name}</h2><button type="button" onClick={onClose}>×</button></header>
    <div className="lf-drawer-body">
      <div className="cs-bgrp">{Object.entries(groups).map(([k, [l, list]]) => <button key={k} type="button" className={grp === k ? 'on' : ''} onClick={() => setGrp(k)}>{l}{k !== 'pick' ? <em>{fa(list.length)}</em> : null}</button>)}</div>
      {grp === 'pick' ? <div className="cs-copy">{active.map(s => <label key={s.id}><input type="checkbox" checked={!!pickSel[s.id]} onChange={e => setPickSel(o => ({ ...o, [s.id]: e.target.checked }))} /><b>{s.name}</b><small dir="ltr">{s.phone || '—'}</small><small>{studentMoney(s).remaining ? rial(studentMoney(s).remaining) : 'تسویه'}</small></label>)}</div> : null}
      <div className="cs-btpl">{MSG_TPL.map(([k, l, t]) => <button key={k} type="button" className={tpl === k ? 'on' : ''} onClick={() => { setTpl(k); if (t) setText(t); }}>{l}</button>)}</div>
      <label className="lf-field"><span>متن پیام</span><textarea rows={6} value={text} onChange={e => setText(e.target.value)} placeholder="متن را بنویس… می‌توانی {نام}، {مانده}، {سررسید}، {دوره} و {کارت} بگذاری." /></label>
      <div className="cs-bph">{['{نام}', '{مانده}', '{سررسید}', '{دوره}', '{کارت}', '{جلسه بعد}'].map(x => <button key={x} type="button" onClick={() => setText(t => t + (t && !/\s$/.test(t) ? ' ' : '') + x)}>{x}</button>)}</div>
      {text.trim() && withPhone[0] ? <div className="cs-bprev"><small>پیش‌نمایش برای {withPhone[0].name}:</small><p>{fillMsg(text, withPhone[0], course)}</p></div> : null}
      <p className="cs-note">{fa(withPhone.length)} گیرنده{noPhone ? ` · ${fa(noPhone)} نفر شماره ندارند` : ''}</p>
      {text.trim() && withPhone.length ? <>
        <div className="cs-bsend">
          <a className="lf-btn" href={smsHref} onClick={() => log('sms')}>💬 پیامک به همه ({fa(withPhone.length)})</a>
          <button type="button" className="lf-btn ghost" onClick={() => { copy(fillMsg(text, null, course), 'متن'); log('copy'); }}>کپی متن</button>
          <button type="button" className="lf-btn ghost" onClick={() => copy(withPhone.map(s => normPhone(s.phone)).join('\n'), 'شماره‌ها')}>کپی شماره‌ها</button>
        </div>
        {personal ? <p className="cs-note">پیامک برای همه یک متن است و {'{نام}'} و مبلغ در آن پر نمی‌شود؛ برای متن شخصی از واتساپِ هر نفر استفاده کن.</p> : null}
        <div className="cs-bwa"><b>واتساپ — هر نفر با متن خودش</b>{withPhone.map(s => <div key={s.id} className={done[s.id] ? 'done' : ''}><span>{done[s.id] ? '✓ ' : ''}{s.name}</span><a href={`https://wa.me/${intlPhone(s.phone)}?text=${encodeURIComponent(fillMsg(text, s, course))}`} target="_blank" rel="noreferrer" onClick={() => { setDone(o => ({ ...o, [s.id]: true })); log('whatsapp'); }}>واتساپ ↗</a></div>)}</div>
      </> : null}
      {note ? <p className="cs-note ok">{note}</p> : null}
      {(course.msgLog || []).length ? <div className="cs-bhist"><button type="button" className="lf-link" onClick={() => setHist(h => !h)}>{hist ? '▾' : '◂'} پیام‌های قبلی این دوره ({fa(course.msgLog.length)})</button>
        {hist ? course.msgLog.slice().reverse().map(m => <div key={m.id}><p>{m.text}</p><small>{jShort(new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Tehran' }).format(new Date(m.at)))} · {m.group} · {fa(m.n)} نفر · {{ sms: 'پیامک', whatsapp: 'واتساپ', copy: 'کپی' }[m.via] || m.via}</small><button type="button" className="lf-link" onClick={() => { setText(m.text); setTpl('free'); }}>استفادهٔ دوباره</button></div>) : null}</div> : null}
    </div>
    <footer><button type="button" className="lf-btn ghost" onClick={onClose}>بستن</button></footer>
  </div></div>;
}

// WhatsApp/SMS receipt for one payment; st must already include that payment.
function receiptText(st, p, course) {
  const m = studentMoney(st);
  const head = p.kind === 'refund' ? `مبلغ ${rial(p.amount)} به‌عنوان بازپرداخت برایت واریز شد.` : `پرداخت شما دریافت شد ✅\n${KIND[p.kind]}: ${rial(p.amount)}${p.date ? ` · ${jShort(p.date)}` : ''}`;
  const tail = st.status === 'withdrawn' ? '' : m.remaining > 0 ? `\nجمع پرداختی: ${rial(m.paid)} از ${rial(m.fee)}\nباقی‌مانده: ${rial(m.remaining)}${st.dueDate ? ` · سررسید ${jShort(st.dueDate)}` : ''}` : '\nشهریهٔ دوره کامل تسویه شد 🎉';
  return `سلام ${st.name} عزیز 🌿\n${head}${tail}\nدورهٔ «${course.name}»\nممنون 🙏`;
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
  const [cEdit, setCEdit] = useState(null), [sEdit, setSEdit] = useState(null), [pay, setPay] = useState(null), [payEdit, setPayEdit] = useState(null), [copy, setCopy] = useState(false), [bulk, setBulk] = useState(false), [receipt, setReceipt] = useState(null);
  const [xOpen, setXOpen] = useState(null);
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

  const cFields = [{ k: 'name', l: 'نام دوره', req: true, ph: 'مثلاً طراحی و اجرای نما — دوره ۱' }, { k: 'startDate', l: 'تاریخ شروع', t: 'date', half: true }, { k: 'sessions', l: 'تعداد جلسات', t: 'num', half: true, def: '8' }, { k: 'days', l: 'روزهای کلاس', t: 'days', o: WEEKDAYS, hint: 'تاریخ جلسه‌ها خودکار ساخته می‌شود' }, { k: 'time', l: 'ساعت کلاس', t: 'time', half: true }, { k: 'price', l: 'شهریهٔ هر نفر (ریال)', t: 'money', half: true }, { k: 'status', l: 'وضعیت', t: 'sel', o: STATUS, def: 'enroll', half: true }, { k: 'color', l: 'رنگ کارت', t: 'sel', o: [['', 'خودکار'], ['violet', 'بنفش'], ['graphite', 'مشکی'], ['cyan', 'فیروزه‌ای'], ['blue', 'آبی'], ['gold', 'طلایی'], ['green', 'سبز'], ['rose', 'قرمز']], half: true }, { k: 'cardNo', l: 'شماره کارت (برای پیام یادآوری)', half: true }, { k: 'cardName', l: 'به نام', half: true }, { k: 'notes', l: 'توضیحات', t: 'area' }];
  const inst = v => (v.plan || 'installment') === 'installment';
  const sFields = [{ k: 'name', l: 'نام و نام خانوادگی', req: true }, { k: 'phone', l: 'شماره تماس', half: true, ph: '۰۹۱۲…' }, { k: 'fee', l: 'شهریه (ریال)', t: 'money', half: true, hint: 'برای تخفیف تغییر بده' }, { k: 'plan', l: 'نوع پرداخت', t: 'sel', o: PLAN, def: 'installment', half: true }, ...(sEdit && !sEdit.id ? [{ k: 'deposit', l: 'بیعانه (ریال)', t: 'money', half: true, hint: 'اختیاری', show: inst }] : []), { k: 'dueDate', l: 'سررسید باقی‌مانده', t: 'date', half: true, show: inst }, { k: 'status', l: 'وضعیت', t: 'sel', o: [['active', 'فعال'], ['withdrawn', 'انصراف']], def: 'active', half: true }, { k: 'notes', l: 'توضیحات', t: 'area' }];

  const finTx = async (st, p) => {
    if (!p.toFinance) return null;
    try { const r = await api('/api/transactions', { method: 'POST', body: JSON.stringify({ title: `${p.kind === 'refund' ? 'بازپرداخت' : KIND[p.kind]} شهریه · ${st.name} · ${cur.name}`, amount: p.amount, kind: p.kind === 'refund' ? 'expense' : 'income', category: 'آموزش', account: 'بدون حساب', date: p.date }) }); return r.id || null; } catch { return null; }
  };
  const addPayment = async (st, p) => {
    const txId = await finTx(st, p);
    const payment = { id: rid(), kind: p.kind, amount: p.amount, date: p.date, method: p.method || '', note: p.note || '', txId };
    await students.patch(st.id, { payments: [...(st.payments || []), payment] });
    setReceipt({ st: { ...st, payments: [...(st.payments || []), payment] }, p: payment });
    flash(`${KIND[p.kind]} ${rial(p.amount)} برای ${st.name} ثبت شد${txId ? ' و در مالی هم آمد' : ''}.`);
  };
  const editPayment = async (st, old, p) => {
    let txId = old.txId || null;
    const title = `${p.kind === 'refund' ? 'بازپرداخت' : KIND[p.kind]} شهریه · ${st.name} · ${cur.name}`;
    if (txId && !p.toFinance) { try { await api(`/api/transactions/${txId}`, { method: 'DELETE' }); } catch {} txId = null; }
    else if (txId) { try { await api(`/api/transactions/${txId}`, { method: 'PATCH', body: JSON.stringify({ title, amount: p.amount, kind: p.kind === 'refund' ? 'expense' : 'income', date: p.date }) }); } catch {} }
    else if (p.toFinance) txId = await finTx(st, p);
    await students.patch(st.id, { payments: (st.payments || []).map(x => x.id === old.id ? { ...x, kind: p.kind, amount: p.amount, date: p.date, method: p.method || '', note: p.note || '', txId } : x) });
    flash('پرداخت ویرایش شد.');
  };
  const delPayment = async (st, p) => {
    if (!window.confirm(`این ${KIND[p.kind]} (${rial(p.amount)}) حذف شود؟${p.txId ? '\nتراکنش مربوط در مالی هم حذف می‌شود.' : ''}`)) return;
    if (p.txId) { try { await api(`/api/transactions/${p.txId}`, { method: 'DELETE' }); } catch {} }
    await students.patch(st.id, { payments: (st.payments || []).filter(x => x.id !== p.id) });
  };
  const saveStudent = async b => {
    const { deposit, ...body } = b, full = body.plan === 'full';
    if (full) body.dueDate = '';
    if (sEdit.id) {
      const st = await students.patch(sEdit.id, body);
      // switched to «نقدی»: settle whatever is still open with one full payment
      const m = studentMoney({ ...sEdit, ...body });
      if (full && sEdit.plan !== 'full' && m.remaining > 0 && body.status !== 'withdrawn') await addPayment({ ...sEdit, ...body, ...(st || {}) }, { kind: 'full', amount: m.remaining, date: todayIso(), method: '', note: 'تسویهٔ کامل', toFinance: true });
      return;
    }
    const st = await students.add({ ...body, plan: body.plan || 'installment', courseId: cur.id, fee: body.fee ?? cur.price ?? 0, payments: [], attendance: [] });
    const fee = Number(st.fee) || 0;
    if (full && fee) await addPayment(st, { kind: 'full', amount: fee, date: todayIso(), method: '', note: '', toFinance: true });
    else if (deposit) await addPayment(st, { kind: 'deposit', amount: deposit, date: todayIso(), method: '', note: '', toFinance: true });
  };
  const copyText = async st => { const t = reminderText(st, cur); try { await navigator.clipboard.writeText(t); flash('متن یادآوری کپی شد — در واتس‌اپ یا تلگرام بچسبان.'); } catch { window.prompt('متن را کپی کن:', t); } };
  const waLink = st => { const p = normPhone(st.phone); return p.length >= 10 ? `https://wa.me/98${p.replace(/^0/, '')}?text=${encodeURIComponent(reminderText(st, cur))}` : null; };
  const toggleAtt = (st, n) => { const a = new Set(st.attendance || []); a.has(n) ? a.delete(n) : a.add(n); students.patch(st.id, { attendance: [...a].sort((x, y) => x - y) }); };
  const doCopy = async picked => { for (const s of picked) await students.add({ courseId: cur.id, name: s.name, phone: s.phone, notes: s.notes || '', fee: Number(cur.price) || Number(s.fee) || 0, status: 'active', payments: [], attendance: [] }); setCopy(false); flash(`${fa(picked.length)} نفر کپی شد.`); };
  const removeCourse = async () => { const n = rows.length; if (!window.confirm(`دورهٔ «${cur.name}»${n ? ` و ${fa(n)} دانشجوی آن` : ''} حذف شود؟ این کار برگشت ندارد.`)) return; for (const s of rows) await students.remove(s.id); await courses.remove(cur.id); setCEdit(null); };

  const sessions = Math.max(0, Math.min(60, Number(cur?.sessions) || 0));
  const active = rows.filter(s => s.status !== 'withdrawn');
  const sesList = cur ? courseSessions(cur) : [];
  const nextSes = sesList.find(x => x.date >= todayIso());
  return <Page Nav={Nav} className="wide" kicker="کار" title="دوره‌ها و دانشجوها" sub="شهریه، پرداخت‌ها، سررسیدها و حضور و غیاب هر دوره" actions={<button className="lf-btn" onClick={() => setCEdit({})}>＋ دورهٔ تازه</button>}>
    <SaveErrorBar />
    {courses.items === null ? <p className="lf-empty">در حال دریافت…</p> : !list.length ? <p className="lf-empty">هنوز دوره‌ای نساختی. با «＋ دورهٔ تازه» شروع کن؛ هر دوره لیست دانشجوها و حساب شهریهٔ خودش را دارد.</p> : <>
      <SideLayout storageKey="lifeos-course-side" title="دوره‌ها" selected={cur?.id} onPick={pick} tabs={[['active', 'فعال'], ['done', 'تمام‌شده']]}
        items={list.map(c => { const sm = courseSum(c), pct = sm.fee ? Math.round(sm.paid / sm.fee * 100) : 0, col = c.color || xcAuto(c.id); return { id: c.id, name: c.name, color: CS_HEX[col] || CS_HEX.graphite, dim: !sm.n, group: c.status === 'done' ? 'done' : 'active', bar: [{ flex: Math.max(pct, 0.001), color: '#34d399' }, { flex: Math.max(100 - pct, 0.001), color: 'transparent' }], sub: `${fa(pct)}٪ وصول · ${fa(sm.n)} نفر${c.startDate ? ` · ${jShort(c.startDate)}` : ''}` }; })}>
      {cur ? <section className="lf-card cs-course sl-top" style={{ '--c': CS_HEX[cur.color || xcAuto(cur.id)] || CS_HEX.graphite }}>
        <div className="lf-row-head"><div><h2>{cur.name}</h2><small>{[cur.startDate ? `شروع ${jShort(cur.startDate)}` : '', sessions ? `${fa(sessions)} جلسه` : '', cur.price ? `شهریه ${rial(cur.price)}` : '', (cur.days || []).length ? `${daysLabel(cur.days)}${cur.time ? ' ساعت ' + faD(cur.time) : ''}` : '', nextSes ? `جلسهٔ بعد: ${fa(nextSes.n)} · ${nextSes.date === todayIso() ? 'امروز' : jShort(nextSes.date)}` : ''].filter(Boolean).join(' · ')}</small></div>
          <div className="lf-ops"><button className="lf-btn cs-bbtn" onClick={() => setBulk(true)}>📨 پیام گروهی</button><button className="lf-link" onClick={() => setCEdit(cur)}>ویرایش دوره</button><button className="lf-link" onClick={() => setCopy(true)}>کپی از دورهٔ دیگر</button><button className="lf-link" onClick={() => toCsv(cur, rows)}>خروجی اکسل</button><button className="lf-link" onClick={() => printList(cur, rows)}>چاپ</button></div></div>
        {(() => { const owe = rows.map(x => ({ x, m: studentMoney(x) })).filter(o => o.m.remaining > 0 && o.x.dueDate).sort((a, b) => a.x.dueDate.localeCompare(b.x.dueDate)); const col = cur.color || xcAuto(cur.id); return <div className="cs-headx">
          <div className="lf-dots" role="radiogroup" aria-label="رنگ دوره">{Object.entries(CS_HEX).map(([k, h]) => <button key={k} role="radio" aria-checked={col === k} className={col === k ? 'on' : ''} style={{ background: h }} onClick={() => courses.patch(cur.id, { color: k })} title={k} />)}</div>
          {cur.cardNo ? <div className="cs-cardcopy"><CopyBtn label="کارت واریز" text={cur.cardNo} /></div> : null}
          {owe.length ? <div className="lf-palerts">{owe.slice(0, 6).map(({ x, m }) => <button key={x.id} className={x.dueDate < todayIso() ? 'late' : 'soon'} onClick={() => { setTab('money'); setQ(''); setOpen(x.id); setTimeout(() => document.getElementById('cs-row-' + x.id)?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 60); }}>{x.dueDate < todayIso() ? '⛔' : '⏳'} {x.name} · {rial(m.remaining)} · {jShort(x.dueDate)}</button>)}</div> : null}
        </div>; })()}
        <div className="lf-kpis cs-kpis">
          <div><small>دانشجو</small><b>{fa(rows.length - sum.off)}</b><em>{fa(sum.clear)} تسویه · {fa(sum.owe)} بدهکار{sum.off ? ` · ${fa(sum.off)} انصراف` : ''}</em></div>
          <div><small>جمع شهریه‌ها</small><b>{rial(sum.fee)}</b><em>بیعانه‌ها {rial(sum.dep)}</em></div>
          <div><small>دریافتی</small><b className="pos">{rial(sum.paid)}</b><em>{fa(sum.fee ? sum.paid / sum.fee * 100 : 0, 0)}٪ وصول شده</em></div>
          <div className={sum.rem ? 'warn' : ''}><small>باقی‌ماندهٔ کل</small><b>{rial(sum.rem)}</b><em>{fa(sum.owe)} نفر</em></div>
        </div>
        <div className="cs-bar"><i style={{ width: `${sum.fee ? Math.min(100, sum.paid / sum.fee * 100) : 0}%` }} /></div>
        {msg ? <p className="lf-note cs-msg">{msg}</p> : null}
        <div className="cs-toolbar">
          <div className="fu-seg cs-tabs"><button className={tab === 'money' ? 'on' : ''} onClick={() => setTab('money')}>شهریه و پرداخت</button><button className={tab === 'att' ? 'on' : ''} onClick={() => setTab('att')}>حضور و غیاب</button><button className={tab === 'ses' ? 'on' : ''} onClick={() => setTab('ses')}>جلسه‌ها</button></div>
          <input className="lf-search" value={q} onChange={e => setQ(e.target.value)} placeholder="جستجوی نام، شماره یا توضیح…" />
          <button className="lf-btn" onClick={() => setSEdit({ fee: cur.price || '', status: 'active' })}>＋ دانشجو</button>
        </div>
        {tab === 'money' ? <div className="cs-table">
          <div className="cs-tr cs-th"><span>#</span><span>نام و نام خانوادگی</span><span>تماس</span><span>شهریه</span><span>پرداخت‌شده</span><span>باقی‌مانده</span><span>سررسید</span><span>توضیحات</span><span /></div>
          {shown.map((s, i) => { const m = studentMoney(s), off = s.status === 'withdrawn', wa = waLink(s); return <div key={s.id} id={'cs-row-' + s.id} className={`cs-row ${off ? 'off' : m.remaining ? 'owe' : 'clear'} ${open === s.id ? 'open' : ''}`}>
            <div className="cs-tr" onClick={() => setOpen(open === s.id ? null : s.id)}>
              <span className="n">{fa(i + 1)}</span>
              <span className="nm"><b>{s.name}</b>{off ? <em className="tag off">انصراف</em> : m.remaining ? <em className="tag">قسطی</em> : <em className="tag ok">{s.plan === 'full' ? 'نقدی' : 'تسویه'}</em>}{history(s.phone, s.id).length ? <em className="tag old" title={history(s.phone, s.id).map(h => h.c?.name).join('، ')}>دورهٔ دیگر</em> : null}</span>
              <span dir="ltr" className="ph">{s.phone || '—'}</span>
              <span>{fa(m.fee, 0)}</span>
              <span className="pos">{fa(m.paid, 0)}</span>
              <span className={m.remaining ? 'neg' : ''}>{m.remaining ? fa(m.remaining, 0) : '—'}</span>
              <span>{s.dueDate && m.remaining ? dueChip(s.dueDate) : '—'}</span>
              <span className="nt" title={s.notes || ''}>{s.notes || '—'}</span>
              <span className="ops" onClick={e => e.stopPropagation()}>{!off && m.remaining > 0 ? <button className="cs-b pay" onClick={() => setPay(s)}>＋ پرداخت</button> : null}<button className="cs-b" onClick={() => setSEdit(s)}>ویرایش</button></span>
            </div>
            {open === s.id ? <div className="cs-detail">
              <div className="cs-pays">{(s.payments || []).length ? (s.payments || []).slice().sort((a, b) => String(a.date).localeCompare(String(b.date))).map(p => <div key={p.id} className={p.kind}><b>{KIND[p.kind]}</b><span>{rial(p.amount)}</span><small>{jShort(p.date)}{p.method ? ` · ${p.method}` : ''}{p.note ? ` · ${p.note}` : ''}{p.txId ? ' · در مالی ✓' : ''}</small><span className="cs-pops"><button className="lf-link" onClick={() => setReceipt({ st: s, p })}>رسید</button><button className="lf-link" onClick={() => setPayEdit({ st: s, p })}>ویرایش</button><button className="lf-link del" onClick={() => delPayment(s, p)}>حذف</button></span></div>) : <p className="lf-empty">هنوز پرداختی ثبت نشده.</p>}</div>
              {m.remaining ? <div className="cs-remind"><button className="cs-b" onClick={() => copyText(s)}>📋 کپی متن یادآوری</button>{wa ? <a className="cs-b" href={wa} target="_blank" rel="noreferrer">واتس‌اپ</a> : null}<small>{reminderText(s, cur).split('\n')[1]}</small></div> : null}
              {s.notes ? <p className="cs-notes">📝 {s.notes}</p> : null}
              {history(s.phone, s.id).length ? <p className="cs-notes">🎓 در دوره‌های دیگر: {history(s.phone, s.id).map(h => `${h.c?.name || '—'} (${studentMoney(h.s).remaining ? 'بدهکار ' + rial(studentMoney(h.s).remaining) : 'تسویه'})`).join('، ')}</p> : null}
            </div> : null}
          </div>; })}
          {!rows.length ? <p className="lf-empty">هنوز دانشجویی در این دوره نیست — «＋ دانشجو» یا «کپی از دورهٔ دیگر».</p> : <div className="cs-tr cs-foot"><span /><span>جمع ({fa(rows.length - sum.off)} نفر)</span><span /><span>{fa(sum.fee, 0)}</span><span className="pos">{fa(sum.paid, 0)}</span><span className="neg">{fa(sum.rem, 0)}</span><span /><span /><span /></div>}
          <p className="cs-unit">همهٔ مبالغ به ریال · روی هر ردیف بزن تا پرداخت‌ها، یادآوری و سابقه باز شود.</p>
        </div> : tab === 'ses' ? <SessionsTab course={cur} active={active} onPatch={b => courses.patch(cur.id, b)} onEdit={() => setCEdit(cur)} /> : <div className="cs-att">
          {!sessions ? <p className="lf-empty">تعداد جلسات دوره را در «ویرایش دوره» وارد کن.</p> : <>
            <div className="cs-att-grid" style={{ gridTemplateColumns: `minmax(150px,1.4fr) repeat(${sessions}, minmax(30px, 1fr)) 70px` }}>
              <span className="h">دانشجو</span>{Array.from({ length: sessions }, (_, i) => <span key={i} className="h c" title={sesList[i] ? jShort(sesList[i].date) : ''}>ج{fa(i + 1)}{sesList[i] ? <small className="cs-hd">{jShort(sesList[i].date).replace(/\s.*$/, '')}</small> : null}</span>)}<span className="h c">حضور</span>
              {active.map(s => <FragmentRow key={s.id} s={s} sessions={sessions} onToggle={toggleAtt} />)}
              <span className="h">حاضرین هر جلسه</span>{Array.from({ length: sessions }, (_, i) => <span key={i} className="c tot">{fa(active.filter(s => (s.attendance || []).includes(i + 1)).length)}</span>)}<span />
            </div>
            <p className="cs-unit">روی هر خانه بزن تا حاضر/غایب شود.</p>
          </>}
        </div>}
      </section> : null}
      </SideLayout>
    </>}
    <FormDrawer open={!!cEdit} title={cEdit?.id ? 'ویرایش دوره' : 'دورهٔ تازه'} fields={cFields} initial={cEdit} onClose={() => setCEdit(null)} onSubmit={async b => { if (cEdit.id) await courses.patch(cEdit.id, b); else { const r = await courses.add(b); pick(r.id); } }} extra={() => cEdit?.id ? <button type="button" className="lf-link del" onClick={removeCourse}>حذف این دوره</button> : null} />
    <FormDrawer open={!!sEdit} title={sEdit?.id ? 'ویرایش دانشجو' : 'دانشجوی تازه'} fields={sFields} initial={sEdit} onClose={() => setSEdit(null)} onSubmit={saveStudent}
      extra={(v) => { const h = history(v.phone, sEdit?.id); return <>{h.length ? <p className="cs-notes">🎓 این شماره در دوره‌های دیگر: {h.map(x => `${x.c?.name || '—'}${studentMoney(x.s).remaining ? ` (بدهکار ${rial(studentMoney(x.s).remaining)})` : ' (تسویه)'}`).join('، ')}</p> : null}{sEdit?.id ? <button type="button" className="lf-link del" onClick={() => { if (window.confirm(`«${sEdit.name}» حذف شود؟ پرداخت‌هایش هم پاک می‌شود (تراکنش‌های مالی می‌مانند).`)) { students.remove(sEdit.id); setSEdit(null); } }}>حذف دانشجو</button> : null}</>; }} />
    {receipt && cur ? (() => { const t = receiptText(receipt.st, receipt.p, cur), ph = intlPhone(receipt.st.phone); return <div className="cs-receipt" role="dialog" aria-label="رسید پرداخت">
      <div className="cs-rhead"><b>🧾 رسید برای {receipt.st.name}</b><button type="button" onClick={() => setReceipt(null)} aria-label="بستن">×</button></div>
      <p>{t}</p>
      <div className="cs-racts">{ph ? <a className="lf-btn" href={`https://wa.me/${ph}?text=${encodeURIComponent(t)}`} target="_blank" rel="noreferrer" onClick={() => setReceipt(null)}>واتساپ ↗</a> : null}{ph ? <a className="lf-btn ghost" href={`sms:+${ph}?&body=${encodeURIComponent(t)}`} onClick={() => setReceipt(null)}>پیامک</a> : null}<button type="button" className="lf-btn ghost" onClick={async () => { try { await navigator.clipboard.writeText(t); flash('رسید کپی شد ✓'); } catch {} setReceipt(null); }}>کپی</button>{!ph ? <small>شماره ندارد</small> : null}</div>
    </div>; })() : null}
    {pay ? <PayDrawer st={pay} onClose={() => setPay(null)} onSave={p => addPayment(pay, p)} /> : null}
    {payEdit ? <PayDrawer st={payEdit.st} edit={payEdit.p} onClose={() => setPayEdit(null)} onSave={p => editPayment(payEdit.st, payEdit.p, p)} /> : null}
    {bulk && cur ? <BulkMsgDrawer course={cur} rows={rows} onClose={() => setBulk(false)} onLog={m => courses.patch(cur.id, { msgLog: [...(cur.msgLog || []), m].slice(-30) })} /> : null}
    {copy && cur ? <CopyDrawer courses={list} students={all} target={cur} onClose={() => setCopy(false)} onCopy={doCopy} /> : null}
  </Page>;
}
const wdName = iso => WEEKDAYS.find(([k]) => k === new Date(iso + 'T12:00:00Z').getUTCDay())[1];
function SessionsTab({ course, active, onPatch, onEdit }) {
  const list = courseSessions(course, true), today = todayIso();
  const [mv, setMv] = useState(null);
  if (!(course.days || []).length || !course.startDate) return <div className="cs-ses"><p className="lf-empty">برای ساخت خودکار تاریخ جلسه‌ها، «تاریخ شروع» و «روزهای کلاس» را در ویرایش دوره بزن.</p><button className="lf-btn" onClick={onEdit}>ویرایش دوره</button></div>;
  const nextN = list.find(x => x.n && x.date >= today)?.n;
  const skip = d => onPatch({ skip: [...new Set([...(course.skip || []), d])] });
  const unskip = d => onPatch({ skip: (course.skip || []).filter(x => x !== d) });
  const saveMove = () => { const m = { ...(course.moves || {}) }; if (mv.date === mv.orig && (mv.time || '') === (course.time || '')) delete m[mv.orig]; else m[mv.orig] = { date: mv.date, time: mv.time }; onPatch({ moves: m }); setMv(null); };
  const reset = o => { const m = { ...(course.moves || {}) }; delete m[o]; onPatch({ moves: m }); };
  return <div className="cs-ses">
    <p className="cs-unit">{daysLabel(course.days)}{course.time ? ` · ساعت ${faD(course.time)}` : ''} · از {jShort(course.startDate)} · لغو یک جلسه، بقیه را یک نوبت عقب می‌برد.</p>
    {list.map(x => { const att = x.n ? active.filter(s => (s.attendance || []).includes(x.n)).length : 0, past = x.date < today, isToday = x.date === today;
      return <div key={x.orig + (x.n || 'c')} className={`cs-srow ${x.cancelled ? 'off' : ''} ${isToday ? 'today' : ''} ${x.n === nextN && !isToday ? 'next' : ''} ${past && !x.cancelled ? 'past' : ''}`}>
        <b>{x.n ? `جلسهٔ ${fa(x.n)}` : 'لغو شد'}</b>
        <span>{wdName(x.date)} {jShort(x.date)}{x.time ? ` · ${faD(x.time)}` : ''}{x.moved ? <em> (جابه‌جا از {jShort(x.orig)})</em> : null}</span>
        <small>{x.cancelled ? 'تعطیل' : isToday ? 'امروز' : x.n === nextN ? 'بعدی' : past ? `${fa(att)} از ${fa(active.length)} حاضر` : ''}</small>
        <span className="ops">{x.cancelled ? <button className="lf-link" onClick={() => unskip(x.orig)}>برگردون</button> : <>
          <button className="lf-link" onClick={() => setMv({ orig: x.orig, date: x.date, time: x.time })}>جابه‌جا</button>
          {x.moved ? <button className="lf-link" onClick={() => reset(x.orig)}>زمان اصلی</button> : null}
          {!past ? <button className="lf-link del" onClick={() => skip(x.orig)}>لغو</button> : null}</>}</span>
        {mv && mv.orig === x.orig ? <div className="cs-smove"><JalaliDateInput value={mv.date} onChange={v => setMv(o => ({ ...o, date: v }))} /><input type="time" value={mv.time || ''} onChange={e => setMv(o => ({ ...o, time: e.target.value }))} /><button className="lf-btn" onClick={saveMove}>ذخیره</button><button className="lf-btn ghost" onClick={() => setMv(null)}>انصراف</button></div> : null}
      </div>; })}
  </div>;
}

// Home card on class days: today's session(s) with one-tap attendance.
export function ClassTodayCard() {
  const [cs, setCs] = useState(null), [sts, setSts] = useState([]);
  useEffect(() => { Promise.all([api('/api/col/courses'), api('/api/col/students')]).then(([a, b]) => { setCs(a.items || []); setSts(b.items || []); }).catch(() => setCs([])); }, []);
  const today = todayIso();
  const todays = (cs || []).filter(c => c.status !== 'done').flatMap(c => courseSessions(c).filter(x => x.date === today).map(x => ({ c, x })));
  if (!todays.length) return null;
  const toggle = async (st, n) => { const a = new Set(st.attendance || []); a.has(n) ? a.delete(n) : a.add(n); const attendance = [...a].sort((x, y) => x - y); setSts(xs => xs.map(s => s.id === st.id ? { ...s, attendance } : s)); try { await api(`/api/col/students/${st.id}`, { method: 'PATCH', body: JSON.stringify({ attendance }) }); } catch {} };
  return <section className="cs-today">{todays.map(({ c, x }) => { const list = sts.filter(s => s.courseId === c.id && s.status !== 'withdrawn'), here = list.filter(s => (s.attendance || []).includes(x.n)).length;
    return <div key={c.id + x.n} className="cs-tcard" style={{ '--c': CS_HEX[c.color || xcAuto(c.id)] || CS_HEX.graphite }}>
      <div className="cs-thead"><b>🎓 کلاس امروز · {c.name}</b><span>جلسهٔ {fa(x.n)}{x.time ? ` · ساعت ${faD(x.time)}` : ''}</span><em>{fa(here)} از {fa(list.length)} حاضر</em><a href="/?page=courses">دوره ←</a></div>
      <div className="cs-tlist">{list.map(s => { const on = (s.attendance || []).includes(x.n); return <button key={s.id} type="button" className={on ? 'on' : ''} onClick={() => toggle(s, x.n)}>{on ? '✓ ' : ''}{s.name}</button>; })}{!list.length ? <small>دانشجویی ثبت نشده.</small> : null}</div>
    </div>; })}</section>;
}

function FragmentRow({ s, sessions, onToggle }) {
  const att = new Set(s.attendance || []);
  return <><span className="nm">{s.name}</span>{Array.from({ length: sessions }, (_, i) => <button key={i} className={`c cell ${att.has(i + 1) ? 'on' : ''}`} onClick={() => onToggle(s, i + 1)} aria-label={`جلسهٔ ${i + 1}`}>{att.has(i + 1) ? '✓' : ''}</button>)}<span className="c pct">{fa(att.size)}/{fa(sessions)}</span></>;
}
