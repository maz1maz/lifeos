// Site admin: users, activity and database size. Read-only; only the admin account gets data (server enforces 403).
import { useEffect, useMemo, useState } from 'react';
import { Page, api, fa, jShort } from './life';
import './admin.css';

const MOD_FA = { football: 'فوتبال', watch: 'فیلم و سریال', market: 'بازار', finance: 'مالی', media: 'رسانه', notes: 'یادداشت', documents: 'مدارک', contacts: 'مخاطبین', health: 'سلامت', car: 'خودرو', travel: 'سفر', projects: 'پروژه', crm: 'فروش', learning: 'یادگیری', journal: 'روزنگار', 'همه': 'همه (پیش‌فرض)' };
const ITEM_FA = { tasks: 'کار', reminders: 'یادآوری', transactions: 'تراکنش', notes: 'یادداشت', movies: 'فیلم/سریال', contacts: 'مخاطب', documents: 'مدرک', poker: 'پوکر', col: 'سایر بخش‌ها' };
const isoOf = ms => ms ? new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Tehran' }).format(new Date(ms)) : '';
function ago(ms) {
  if (!ms) return 'هرگز';
  const m = Math.round((Date.now() - ms) / 60000);
  if (m < 2) return 'همین الان'; if (m < 60) return `${fa(m)} دقیقه پیش`;
  const h = Math.round(m / 60); if (h < 24) return `${fa(h)} ساعت پیش`;
  const d = Math.round(h / 24); if (d < 31) return `${fa(d)} روز پیش`;
  return jShort(isoOf(ms));
}
const kb = b => b >= 1048576 ? `${fa(b / 1048576, 2)} مگابایت` : `${fa(b / 1024, 0)} کیلوبایت`;

function Weeks({ weeks }) {
  const max = Math.max(1, ...weeks.flatMap(w => [w.signups, w.active]));
  return <div className="ad-weeks">{weeks.map((w, i) => <div key={w.from} title={`هفتهٔ ${jShort(w.from)}: ${fa(w.signups)} عضو جدید · ${fa(w.active)} فعال`}>
    <div className="ad-wbars"><i className="a" style={{ height: `${(w.active / max) * 100}%` }} /><i className="s" style={{ height: `${(w.signups / max) * 100}%` }} /></div>
    <small>{i === weeks.length - 1 ? 'این هفته' : jShort(w.from)}</small>
  </div>)}</div>;
}

export function AdminPage({ Nav }) {
  const [d, setD] = useState(null), [err, setErr] = useState(''), [q, setQ] = useState(''), [open, setOpen] = useState(null), [sort, setSort] = useState('seen');
  const load = () => api('/api/admin/overview').then(x => { setD(x); setErr(''); }).catch(e => setErr(e.message));
  useEffect(() => { load(); }, []);
  const users = useMemo(() => {
    const t = q.trim().toLowerCase();
    const list = (d?.users || []).filter(u => !t || `${u.name} ${u.displayName} ${u.email}`.toLowerCase().includes(t));
    const key = { seen: u => u.lastSeenAt || 0, joined: u => u.createdAt || 0, items: u => u.total }[sort];
    return [...list].sort((a, b) => key(b) - key(a));
  }, [d, q, sort]);
  if (err) return <Page Nav={Nav} kicker="مدیریت" title="کاربران سایت"><p className="lf-empty">{err}</p></Page>;
  if (!d) return <Page Nav={Nav} kicker="مدیریت" title="کاربران سایت"><p className="lf-empty">در حال دریافت…</p></Page>;
  const T = d.totals, dbPct = Math.min(100, (T.dbBytes / T.dbLimit) * 100);
  const mods = Object.entries(d.modules || {}).sort((a, b) => b[1] - a[1]), modMax = Math.max(1, ...mods.map(m => m[1]));
  return <Page Nav={Nav} kicker="مدیریت" title="کاربران سایت" sub={`به‌روزرسانی ${ago(d.generatedAt)} · فقط تو این صفحه را می‌بینی`} actions={<button className="lf-btn ghost" onClick={load}>تازه‌سازی</button>}>
    <div className="lf-kpis ad-kpis">
      <div><small>کل کاربرها</small><b>{fa(T.users)}</b><em>{fa(T.new30)} عضو جدید در ۳۰ روز</em></div>
      <div><small>فعال امروز</small><b className="pos">{fa(T.active1)}</b><em>۲۴ ساعت اخیر</em></div>
      <div><small>فعال هفته / ماه</small><b>{fa(T.active7)} / {fa(T.active30)}</b><em>۷ و ۳۰ روز اخیر</em></div>
      <div><small>وصل به تلگرام</small><b>{fa(T.telegram)}</b><em>{fa(T.push)} با اعلان گوشی · {fa(T.sessions)} نشست باز</em></div>
    </div>
    <div className="ad-grid">
      <section className="lf-card"><h3>عضو جدید و کاربران فعال · ۱۲ هفته</h3><Weeks weeks={d.weeks} /><div className="ad-legend"><span><i className="s" />عضو جدید</span><span><i className="a" />فعال</span></div></section>
      <section className="lf-card"><h3>بخش‌های فعال کاربرها</h3>{mods.map(([k, n]) => <div className="ad-mod" key={k}><span>{MOD_FA[k] || k}</span><i style={{ width: `${(n / modMax) * 100}%` }} /><b>{fa(n)}</b></div>)}</section>
      <section className={`lf-card ad-db ${dbPct > 80 ? 'warn' : ''}`}><h3>حجم دیتابیس</h3><b>{kb(T.dbBytes)}</b><div className="ad-dbbar"><i style={{ width: `${dbPct}%` }} /></div><small>{fa(dbPct, 1)}٪ از سقف ۲ مگابایتی یک ردیف D1. {dbPct > 80 ? 'نزدیک سقف است — وقت جدا کردن داده‌ها به چند ردیف است.' : 'جای کافی هست.'}</small></section>
    </div>
    <section className="lf-card ad-users">
      <div className="ad-uhead"><h3>کاربرها ({fa(users.length)})</h3><input className="lf-search" value={q} onChange={e => setQ(e.target.value)} placeholder="جستجوی نام یا ایمیل…" />
        <div className="ad-sort">{[['seen', 'آخرین بازدید'], ['joined', 'تاریخ عضویت'], ['items', 'حجم داده']].map(([k, l]) => <button key={k} className={sort === k ? 'on' : ''} onClick={() => setSort(k)}>{l}</button>)}</div></div>
      <div className="ad-table">
        <div className="ad-row ad-th"><span>کاربر</span><span>عضویت</span><span>آخرین بازدید</span><span>اتصال‌ها</span><span>داده</span></div>
        {users.map(u => { const on = u.lastSeenAt && Date.now() - u.lastSeenAt < 864e5; return <div key={u.id} className={`ad-urow ${open === u.id ? 'open' : ''}`}>
          <button className="ad-row" onClick={() => setOpen(open === u.id ? null : u.id)}>
            <span className="ad-name"><i className={on ? 'on' : ''} /><b>{u.displayName || u.name || '—'}{u.admin ? <em className="ad-tag">مدیر</em> : null}</b><small dir="ltr">{u.email}</small></span>
            <span>{u.createdAt ? jShort(isoOf(u.createdAt)) : '—'}</span>
            <span>{ago(u.lastSeenAt || u.lastLoginAt)}</span>
            <span className="ad-conn">{u.telegram ? <em title="تلگرام">✈️</em> : null}{u.push ? <em title="اعلان گوشی">🔔</em> : null}{u.google ? <em title="ورود با گوگل">G</em> : null}{u.calendar ? <em title="تقویم گوگل">📅</em> : null}{!u.telegram && !u.push && !u.google && !u.calendar ? '—' : null}</span>
            <span>{fa(u.total)} ردیف</span>
          </button>
          {open === u.id ? <div className="ad-detail">
            <div className="lf-chips">{Object.entries(u.items).filter(([, n]) => n).map(([k, n]) => <span key={k} className="lf-chip">{fa(n)} {ITEM_FA[k] || k}</span>)}{!u.total ? <span className="lf-chip">هنوز داده‌ای ثبت نکرده</span> : null}</div>
            <small>بخش‌ها: {u.modules ? (u.modules.length ? u.modules.map(m => MOD_FA[m] || m).join('، ') : 'فقط بخش‌های پایه') : 'همه (انتخاب نکرده)'} · {fa(u.sessions)} نشست باز · آخرین ورود: {ago(u.lastLoginAt)}</small>
          </div> : null}
        </div>; })}
      </div>
      <p className="lf-note">«آخرین بازدید» از این نسخه به بعد ثبت می‌شود؛ برای کاربرهای قدیمی تا دفعهٔ بعد که سایت را باز کنند «هرگز» نمایش داده می‌شود. مدیر: {d.adminSource === 'env' ? 'ایمیل‌های ADMIN_EMAILS' : 'اولین حساب ساخته‌شده'}.</p>
    </section>
  </Page>;
}
