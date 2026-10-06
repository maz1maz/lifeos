import { useEffect, useMemo, useState } from 'react';
import { Download, Play, Square, Trash2, X } from 'lucide-react';
import { Page, api, fa, jShort, todayIso, addDays } from './life-core';
import { JalaliDateInput, isoToJ, jToIso } from './jdate';

// «زمان کار» (tab of the planner hub): live timer, manual entries, and a report for a chosen range
// (total, per-day bars, per-project and per-title split, CSV). Backend: /api/timer(+start|stop|cancel), /api/time.
const toNum = v => Number(String(v ?? '').replace(/[۰-۹]/g, d => '۰۱۲۳۴۵۶۷۸۹'.indexOf(d)).replace(/[٫/]/g, '.'));
// "90", "1:30" or "1.5h" style input → minutes
const parseMinutes = v => { const s = String(v || '').replace(/[۰-۹]/g, d => '۰۱۲۳۴۵۶۷۸۹'.indexOf(d)).trim(); const m = s.match(/^(\d+):(\d{1,2})$/); return m ? Number(m[1]) * 60 + Number(m[2]) : Math.round(toNum(s)); };
const hm = m => { m = Math.round(m || 0); const h = Math.floor(m / 60), r = m % 60; return h ? `${fa(h)} ساعت${r ? ` و ${fa(r)} دقیقه` : ''}` : `${fa(r)} دقیقه`; };
const clock = ms => { const s = Math.max(0, Math.floor(ms / 1000)), h = Math.floor(s / 3600), m = Math.floor(s / 60) % 60, x = s % 60; return [h, m, x].map(n => String(n).padStart(2, '0')).join(':').replace(/\d/g, d => '۰۱۲۳۴۵۶۷۸۹'[d]); };
const weekStart = iso => addDays(iso, -((new Date(iso + 'T12:00:00Z').getUTCDay() + 1) % 7));
function ranges(today) {
  const j = isoToJ(today), mStart = jToIso(j.jy, j.jm, 1), pj = j.jm === 1 ? { jy: j.jy - 1, jm: 12 } : { jy: j.jy, jm: j.jm - 1 };
  return [['week', 'این هفته', weekStart(today), today], ['month', 'این ماه', mStart, today], ['last', 'ماه قبل', jToIso(pj.jy, pj.jm, 1), addDays(mStart, -1)], ['30', '۳۰ روز اخیر', addDays(today, -29), today]];
}

function LiveTimer({ projects, onLogged }) {
  const [t, setT] = useState(undefined), [title, setTitle] = useState(''), [pid, setPid] = useState(''), [now, setNow] = useState(Date.now()), [err, setErr] = useState('');
  const load = () => api('/api/timer').then(d => setT(d.timer)).catch(e => setErr(e.message));
  useEffect(() => { load(); }, []);
  useEffect(() => { if (!t) return; const h = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(h); }, [t]);
  const start = async e => { e.preventDefault(); if (!title.trim()) { setErr('عنوان کار را بنویس.'); return; } setErr(''); try { setT(await api('/api/timer/start', { method: 'POST', body: JSON.stringify({ title: title.trim(), projectId: pid || null }) })); setNow(Date.now()); } catch (x) { setErr(x.message); load(); } };
  const stop = async () => { try { const r = await api('/api/timer/stop', { method: 'POST', body: JSON.stringify({ date: todayIso() }) }); setT(null); setTitle(''); onLogged(r); } catch (x) { setErr(x.message); } };
  const cancel = async () => { if (!window.confirm('تایمر بدون ثبت لغو شود؟')) return; await api('/api/timer/cancel', { method: 'POST', body: '{}' }).catch(() => {}); setT(null); };
  const pName = id => projects.find(p => p.id === id)?.title;
  return <section className={`lf-card tl-timer${t ? ' running' : ''}`}>
    <h3>⏱ تایمر کار</h3>
    {t === undefined ? <p className="tl-muted">…</p> : t ? <div className="tl-run">
      <b className="tl-clock" aria-live="off">{clock(now - t.startedAt)}</b>
      <span className="tl-run-t">{t.title}{t.projectId && pName(t.projectId) ? <small> · {pName(t.projectId)}</small> : null}</span>
      <button type="button" className="lf-btn" onClick={stop}><Square size={15} /> توقف و ثبت</button>
      <button type="button" className="tl-x" onClick={cancel} aria-label="لغو تایمر"><X size={16} /></button>
    </div> : <form className="tl-start" onSubmit={start}>
      <input value={title} onChange={e => setTitle(e.target.value)} placeholder="روی چه کاری کار می‌کنی؟" aria-label="عنوان کار" maxLength={120} />
      {projects.length ? <select value={pid} onChange={e => setPid(e.target.value)} aria-label="پروژه"><option value="">بدون پروژه</option>{projects.map(p => <option key={p.id} value={p.id}>{p.title}</option>)}</select> : null}
      <button type="submit" className="lf-btn"><Play size={15} /> شروع</button>
    </form>}
    {err ? <p className="tl-err" role="status">⚠ {err}</p> : null}
  </section>;
}

export function TimeLogPage({ Nav }) {
  const today = todayIso(), R = useMemo(() => ranges(today), [today]);
  const [rk, setRk] = useState('week'), [items, setItems] = useState(null), [projects, setProjects] = useState([]), [err, setErr] = useState('');
  const [f, setF] = useState({ title: '', minutes: '', pid: '', date: today }), [busy, setBusy] = useState(false);
  const [, , from, to] = R.find(r => r[0] === rk);
  const load = () => api(`/api/time?from=${from}&to=${to}`).then(d => setItems((d.items || []).sort((a, b) => b.date.localeCompare(a.date) || b.createdAt - a.createdAt))).catch(e => setErr(e.message));
  useEffect(() => { setItems(null); load(); }, [rk]);
  useEffect(() => { api('/api/col/projects').then(d => setProjects((d.items || []).filter(p => p.title && !p.archived))).catch(() => {}); }, []);
  const pName = id => projects.find(p => p.id === id)?.title || '';
  const add = async e => {
    e.preventDefault(); const minutes = parseMinutes(f.minutes);
    if (!f.title.trim() || !(minutes >= 1)) { setErr('عنوان و مدت را بنویس (مثلاً ۹۰ یا ۱:۳۰).'); return; }
    setBusy(true); setErr('');
    try { await api('/api/time', { method: 'POST', body: JSON.stringify({ title: f.title.trim(), minutes, date: f.date || today, projectId: f.pid || null }) }); setF(o => ({ ...o, title: '', minutes: '' })); await load(); }
    catch (x) { setErr(x.message); }
    setBusy(false);
  };
  const del = async x => { if (!window.confirm(`«${x.title}» حذف شود؟`)) return; setItems(xs => xs.filter(y => y.id !== x.id)); await api(`/api/time/${x.id}`, { method: 'DELETE' }).catch(() => load()); };

  const s = useMemo(() => {
    const list = items || [], total = list.reduce((a, x) => a + x.minutes, 0);
    const days = []; for (let d = from; d <= to; d = addDays(d, 1)) days.push(d);
    const perDay = days.map(d => ({ d, m: list.filter(x => x.date === d).reduce((a, x) => a + x.minutes, 0) }));
    const group = key => Object.entries(list.reduce((o, x) => { const k = key(x); o[k] = (o[k] || 0) + x.minutes; return o; }, {})).sort((a, b) => b[1] - a[1]);
    const worked = perDay.filter(x => x.m).length;
    return { total, perDay, worked, avg: worked ? total / worked : 0, byProject: group(x => pName(x.projectId) || 'بدون پروژه'), byTitle: group(x => x.title).slice(0, 8) };
  }, [items, projects]);
  const maxDay = Math.max(60, ...s.perDay.map(x => x.m));
  const csv = () => {
    const rows = [['تاریخ', 'تاریخ شمسی', 'عنوان', 'پروژه', 'دقیقه'], ...(items || []).map(x => [x.date, jShort(x.date), x.title, pName(x.projectId), x.minutes])];
    const blob = new Blob(['﻿' + rows.map(r => r.map(c => `"${String(c ?? '').replace(/"/g, '""')}"`).join(',')).join('\n')], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `work-time-${from}_${to}.csv`; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  };

  return <Page Nav={Nav} className="tl" kicker="برنامه‌ریز" title="زمان کار" sub="تایمر، ثبت دستی و گزارش ساعت‌های کار">
    <LiveTimer projects={projects} onLogged={() => load()} />

    <section className="lf-card">
      <h3>ثبت دستی</h3>
      <form className="tl-form" onSubmit={add}>
        <label>عنوان<input value={f.title} onChange={e => setF(o => ({ ...o, title: e.target.value }))} maxLength={120} placeholder="مثلاً جلسه با مشتری" /></label>
        <label>مدت<input value={f.minutes} onChange={e => setF(o => ({ ...o, minutes: e.target.value }))} placeholder="۹۰ یا ۱:۳۰" inputMode="numeric" data-raw="" /></label>
        {projects.length ? <label>پروژه<select value={f.pid} onChange={e => setF(o => ({ ...o, pid: e.target.value }))}><option value="">بدون پروژه</option>{projects.map(p => <option key={p.id} value={p.id}>{p.title}</option>)}</select></label> : null}
        <label>تاریخ<JalaliDateInput value={f.date} onChange={v => setF(o => ({ ...o, date: v || today }))} clearable={false} /></label>
        <button type="submit" className="lf-btn" disabled={busy}>{busy ? '…' : 'ثبت'}</button>
      </form>
      {err ? <p className="tl-err" role="status">⚠ {err}</p> : null}
    </section>

    <section className="lf-card">
      <div className="tl-head">
        <div className="tl-ranges" role="tablist" aria-label="بازهٔ گزارش">{R.map(([k, l]) => <button type="button" key={k} role="tab" aria-selected={rk === k} className={rk === k ? 'on' : ''} onClick={() => setRk(k)}>{l}</button>)}</div>
        <button type="button" className="lf-btn ghost" onClick={csv} disabled={!items?.length}><Download size={15} /> CSV</button>
      </div>
      <div className="tl-kpis">
        <div><small>جمع</small><b>{hm(s.total)}</b></div>
        <div><small>روزهای کاری</small><b>{fa(s.worked)} روز</b></div>
        <div><small>میانگین روز کاری</small><b>{hm(s.avg)}</b></div>
      </div>
      <div className="tl-chart" role="img" aria-label="نمودار ساعت کار روزانه">{s.perDay.map(x => <div key={x.d} className={`tl-bar${x.d === today ? ' now' : ''}`} title={`${jShort(x.d)}: ${hm(x.m)}`}><i style={{ height: `${x.m / maxDay * 100}%` }} /></div>)}</div>
      <div className="tl-axis"><span>{jShort(from)}</span><span>{jShort(to)}</span></div>
      {s.total ? <div className="tl-split">
        <div><h4>بر اساس پروژه</h4><ul>{s.byProject.map(([k, m]) => <li key={k}><span>{k}</span><i><em style={{ width: `${m / s.byProject[0][1] * 100}%` }} /></i><b>{hm(m)}</b></li>)}</ul></div>
        <div><h4>بیشترین کارها</h4><ul>{s.byTitle.map(([k, m]) => <li key={k}><span>{k}</span><i><em style={{ width: `${m / s.byTitle[0][1] * 100}%` }} /></i><b>{hm(m)}</b></li>)}</ul></div>
      </div> : null}
    </section>

    <section className="lf-card">
      <h3>ثبت‌ها</h3>
      {items === null ? <p className="tl-muted">در حال بارگذاری…</p> : !items.length ? <p className="tl-muted">در این بازه زمانی ثبت نشده. تایمر را بزن یا دستی ثبت کن (در Ctrl+K هم می‌شود نوشت «۲ ساعت کار روی گزارش»).</p>
        : <ul className="tl-list">{items.slice(0, 80).map(x => <li key={x.id}><span className="tl-d">{x.date === today ? 'امروز' : jShort(x.date)}</span><span className="tl-t"><b>{x.title}</b>{pName(x.projectId) ? <small>{pName(x.projectId)}</small> : null}</span><b className="tl-m">{hm(x.minutes)}</b><button type="button" className="tl-x" onClick={() => del(x)} aria-label={`حذف ${x.title}`}><Trash2 size={15} /></button></li>)}</ul>}
    </section>
  </Page>;
}
