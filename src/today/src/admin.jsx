// Site admin: users, activity and database size. Read-only; only the admin account gets data (server enforces 403).
import { useEffect, useMemo, useState } from 'react';
import { Page, api, fa, jShort } from './life';

// Messages the site admin sent to this user — shown once on any page until dismissed.
export function MsgBar({ load }) {
  const [msgs, setMsgs] = useState([]);
  useEffect(() => { load().then(u => setMsgs(u?.msgs || [])); }, []);
  if (!msgs.length) return null;
  const m = msgs[0];
  const close = () => { setMsgs(x => x.slice(1)); api(`/api/messages/${m.id}/read`, { method: 'POST', body: '{}' }).catch(() => {}); };
  return <div className="adm-inbox" role="status" dir="rtl"><b>📣 پیام از مدیر</b><p>{m.text}</p><div><small>{ago(m.at)}{msgs.length > 1 ? ` · ${fa(msgs.length - 1)} پیام دیگر` : ''}</small><button type="button" onClick={close}>{msgs.length > 1 ? 'بعدی' : 'باشه'}</button></div></div>;
}

function MsgDrawer({ to, onClose, onSent }) {
  const [text, setText] = useState(''), [tg, setTg] = useState(true), [push, setPush] = useState(true), [busy, setBusy] = useState(false), [err, setErr] = useState('');
  const all = to === 'all';
  const send = async () => {
    if (!text.trim()) return; setBusy(true); setErr('');
    try { const r = await api('/api/admin/message', { method: 'POST', body: JSON.stringify({ to: all ? 'all' : [to.id], text, telegram: tg, push }) }); onSent(r); }
    catch (e) { setErr(e.message); }
    setBusy(false);
  };
  return <div className="adm-modal" onClick={onClose}><div className="adm-mbox" onClick={e => e.stopPropagation()} role="dialog" aria-modal="true">
    <h3>{all ? '📣 پیام به همهٔ کاربرها' : `✉️ پیام به ${to.displayName || to.name || to.email}`}</h3>
    <textarea autoFocus rows={5} value={text} onChange={e => setText(e.target.value)} placeholder="متن پیام…" maxLength={2000} />
    <div className="adm-chan"><label><input type="checkbox" checked disabled /> داخل سایت</label><label><input type="checkbox" checked={tg} onChange={e => setTg(e.target.checked)} /> تلگرام{!all && !to.telegram ? ' (وصل نیست)' : ''}</label><label><input type="checkbox" checked={push} onChange={e => setPush(e.target.checked)} /> اعلان گوشی{!all && !to.push ? ' (فعال نیست)' : ''}</label></div>
    {err ? <p className="adm-err">{err}</p> : null}
    <div className="adm-macts"><button className="lf-btn ghost" onClick={onClose}>انصراف</button><button className="lf-btn" disabled={busy || !text.trim()} onClick={send}>{busy ? 'در حال ارسال…' : 'ارسال'}</button></div>
  </div></div>;
}
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
  return <div className="adm-weeks">{weeks.map((w, i) => <div key={w.from} title={`هفتهٔ ${jShort(w.from)}: ${fa(w.signups)} عضو جدید · ${fa(w.active)} فعال`}>
    <div className="adm-wbars"><i className="a" style={{ height: `${(w.active / max) * 100}%` }} /><i className="s" style={{ height: `${(w.signups / max) * 100}%` }} /></div>
    <small>{i === weeks.length - 1 ? 'این هفته' : jShort(w.from)}</small>
  </div>)}</div>;
}

export function AdminPage({ Nav }) {
  const [d, setD] = useState(null), [err, setErr] = useState(''), [q, setQ] = useState(''), [open, setOpen] = useState(null), [sort, setSort] = useState('seen');
  const [busy, setBusy] = useState(''), [msg, setMsg] = useState(''), [compose, setCompose] = useState(null);
  const sentMsg = r => { setCompose(null); setMsg(`پیام برای ${fa(r.n)} کاربر ثبت شد · تلگرام ${fa(r.sent.telegram)} · اعلان ${fa(r.sent.push)}`); load(); };
  const act = async (u, kind) => {
    const name = u.displayName || u.name || u.email;
    const q = kind === 'logout' ? `همهٔ نشست‌های «${name}» بسته شود؟ باید دوباره وارد شود.` : u.disabled ? `حساب «${name}» دوباره فعال شود؟` : `حساب «${name}» غیرفعال شود؟\nنمی‌تواند وارد شود، تلگرام و اعلان‌هایش قطع می‌شود؛ داده‌هایش پاک نمی‌شود.`;
    if (!window.confirm(q)) return;
    setBusy(u.id + kind);
    try {
      const r = await api(`/api/admin/users/${u.id}/${kind}`, { method: 'POST', body: JSON.stringify(kind === 'disable' ? { disabled: !u.disabled } : {}) });
      setMsg(kind === 'logout' ? `${fa(r.closed || 0)} نشست بسته شد.` : r.disabled ? `«${name}» غیرفعال شد.` : `«${name}» دوباره فعال شد.`);
      await load();
    } catch (e) { setMsg(e.message); }
    setBusy('');
  };
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
  return <Page Nav={Nav} kicker="مدیریت" title="کاربران سایت" sub={`به‌روزرسانی ${ago(d.generatedAt)} · فقط تو این صفحه را می‌بینی`} actions={<><button className="lf-btn" onClick={() => setCompose('all')}>📣 پیام به همه</button><button className="lf-btn ghost" onClick={load}>تازه‌سازی</button></>}>
    <div className="lf-kpis adm-kpis">
      <div><small>کل کاربرها</small><b>{fa(T.users)}</b><em>{fa(T.new30)} عضو جدید در ۳۰ روز</em></div>
      <div><small>فعال امروز</small><b className="pos">{fa(T.active1)}</b><em>۲۴ ساعت اخیر</em></div>
      <div><small>فعال هفته / ماه</small><b>{fa(T.active7)} / {fa(T.active30)}</b><em>۷ و ۳۰ روز اخیر</em></div>
      <div><small>وصل به تلگرام</small><b>{fa(T.telegram)}</b><em>{fa(T.push)} با اعلان گوشی · {fa(T.sessions)} نشست باز</em></div>
    </div>
    <div className="adm-grid">
      <section className="lf-card"><h3>عضو جدید و کاربران فعال · ۱۲ هفته</h3><Weeks weeks={d.weeks} /><div className="adm-legend"><span><i className="s" />عضو جدید</span><span><i className="a" />فعال</span></div></section>
      <section className="lf-card"><h3>بخش‌های فعال کاربرها</h3>{mods.map(([k, n]) => <div className="adm-mod" key={k}><span>{MOD_FA[k] || k}</span><i style={{ width: `${(n / modMax) * 100}%` }} /><b>{fa(n)}</b></div>)}</section>
      <section className={`lf-card adm-db ${dbPct > 80 ? 'warn' : ''}`}><h3>{T.storageMode === 'sharded' ? 'بزرگ‌ترین ردیف داده' : 'حجم دیتابیس'}</h3><b>{kb(T.dbBytes)}</b><div className="adm-dbbar"><i style={{ width: `${dbPct}%` }} /></div><small>{fa(dbPct, 1)}٪ از سقف ۲ مگابایتی هر ردیف D1. {T.storageMode === 'sharded' ? `${fa(T.dbShards || 0)} ردیف مستقل ذخیره شده؛ حجم کل داده ${kb(T.dbLogicalBytes || 0)} است.` : (dbPct > 80 ? 'نزدیک سقف است — مهاجرت به ذخیره‌سازی چندردیفی در اولین درخواست انجام می‌شود.' : 'جای کافی هست.')}</small></section>
    </div>
    {msg ? <p className="lf-note adm-msg">{msg}<button className="lf-link" onClick={() => setMsg('')}>×</button></p> : null}
    <section className="lf-card adm-users">
      <div className="adm-uhead"><h3>کاربرها ({fa(users.length)})</h3><input className="lf-search" value={q} onChange={e => setQ(e.target.value)} placeholder="جستجوی نام یا ایمیل…" />
        <div className="adm-sort">{[['seen', 'آخرین بازدید'], ['joined', 'تاریخ عضویت'], ['items', 'حجم داده']].map(([k, l]) => <button key={k} className={sort === k ? 'on' : ''} onClick={() => setSort(k)}>{l}</button>)}</div></div>
      <div className="adm-table">
        <div className="adm-row adm-th"><span>کاربر</span><span>عضویت</span><span>آخرین بازدید</span><span>اتصال‌ها</span><span>داده</span></div>
        {users.map(u => { const on = u.lastSeenAt && Date.now() - u.lastSeenAt < 864e5; return <div key={u.id} className={`adm-urow ${open === u.id ? 'open' : ''} ${u.disabled ? 'disabled' : ''}`}>
          <button className="adm-row" onClick={() => setOpen(open === u.id ? null : u.id)}>
            <span className="adm-name"><i className={on ? 'on' : ''} /><b>{u.displayName || u.name || '—'}{u.admin ? <em className="adm-tag">مدیر</em> : null}{u.disabled ? <em className="adm-tag off">غیرفعال</em> : null}</b><small dir="ltr">{u.email}</small></span>
            <span>{u.createdAt ? jShort(isoOf(u.createdAt)) : '—'}</span>
            <span>{ago(u.lastSeenAt || u.lastLoginAt)}</span>
            <span className="adm-conn">{u.telegram ? <em title="تلگرام">✈️</em> : null}{u.push ? <em title="اعلان گوشی">🔔</em> : null}{u.google ? <em title="ورود با گوگل">G</em> : null}{u.calendar ? <em title="تقویم گوگل">📅</em> : null}{!u.telegram && !u.push && !u.google && !u.calendar ? '—' : null}</span>
            <span>{fa(u.total)} ردیف</span>
          </button>
          {open === u.id ? <div className="adm-detail">
            <div className="lf-chips">{Object.entries(u.items).filter(([, n]) => n).map(([k, n]) => <span key={k} className="lf-chip">{fa(n)} {ITEM_FA[k] || k}</span>)}{!u.total ? <span className="lf-chip">هنوز داده‌ای ثبت نکرده</span> : null}</div>
            <div className="adm-acts">
              {u.admin ? null : <button className="lf-btn" disabled={u.disabled} onClick={() => setCompose(u)}>✉️ پیام</button>}
              <button className="lf-btn ghost" disabled={!!busy || !u.sessions} onClick={() => act(u, 'logout')}>{busy === u.id + 'logout' ? '…' : u.admin ? 'خروج از دستگاه‌های دیگر' : 'خروج اجباری'}</button>
              {u.admin ? null : <button className={`lf-btn ${u.disabled ? '' : 'danger'}`} disabled={!!busy} onClick={() => act(u, 'disable')}>{busy === u.id + 'disable' ? '…' : u.disabled ? 'فعال‌کردن دوباره' : 'غیرفعال‌کردن'}</button>}
              {u.disabled ? <small className="adm-off">غیرفعال از {ago(u.disabledAt)}</small> : null}
            </div>
            <small>بخش‌ها: {u.modules ? (u.modules.length ? u.modules.map(m => MOD_FA[m] || m).join('، ') : 'فقط بخش‌های پایه') : 'همه (انتخاب نکرده)'} · {fa(u.sessions)} نشست باز · آخرین ورود: {ago(u.lastLoginAt)}</small>
          </div> : null}
        </div>; })}
      </div>
      <p className="lf-note">«آخرین بازدید» از این نسخه به بعد ثبت می‌شود؛ برای کاربرهای قدیمی تا دفعهٔ بعد که سایت را باز کنند «هرگز» نمایش داده می‌شود. مدیر: {d.adminSource === 'env' ? 'ایمیل‌های ADMIN_EMAILS' : 'اولین حساب ساخته‌شده'}.</p>
    </section>
    {(d.sentMsgs || []).length ? <section className="lf-card adm-sent"><h3>پیام‌های فرستاده‌شده</h3>{d.sentMsgs.map(m => <div key={m.id} className="adm-srow"><p>{m.text}</p><small>{ago(m.at)} · {m.to === 'all' ? `همه (${fa(m.n)} نفر)` : m.to.join('، ')} · تلگرام {fa(m.sent?.telegram)} · اعلان {fa(m.sent?.push)}</small></div>)}</section> : null}
    {compose ? <MsgDrawer to={compose} onClose={() => setCompose(null)} onSent={sentMsg} /> : null}
  </Page>;
}
