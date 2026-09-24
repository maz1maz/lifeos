import React, { useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import './today.css';
import './calendar.css';
import './planner.css';
import { NotesReact } from './notes';
import { ContactsReact } from './contacts';
import { DocumentsReact } from './documents';
import { PlannerReact } from './planner';
import { MediaReact } from './media';
import { MarketReact } from './market';
import { CalendarReact } from './calendar';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './vibefarsi-table';
import {
  House, CalendarDays, ListChecks, Wallet, LineChart, Trophy, Clapperboard, Film,
  Music, StickyNote, FolderOpen, Users, Settings, Bell, CheckSquare2, MapPin, Sparkles,
  Search, Star, X, Check, ChevronDown, Trash2, Plus,
  Pencil, Repeat, CircleAlert, Hash, Clock, Sun, CircleDot
} from 'lucide-react';

const api = async (url, options) => {
  const response = await fetch(url, { credentials: 'include', ...options, headers: { 'Content-Type': 'application/json', ...(options?.headers || {}) } });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.error || 'دریافت اطلاعات ناموفق بود.');
  return body;
};
const isoToday = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Tehran', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
const fa = value => Number(value || 0).toLocaleString('fa-IR');
const faDigits = value => String(value ?? '').replace(/[0-9]/g, d => '۰۱۲۳۴۵۶۷۸۹'[d]);
const jalali = date => new Intl.DateTimeFormat('fa-IR', { dateStyle: 'full', timeZone: 'Asia/Tehran' }).format(date);
const TGJU_LABELS = {
  price_dollar_rl: 'دلار آزاد', price_eur: 'یورو', price_gbp: 'پوند', price_aed: 'درهم', price_try: 'لیر',
  geram18: 'گرم ۱۸ عیار', geram24: 'گرم ۲۴ عیار', sekee: 'سکه امامی', sekeb: 'سکه بهار آزادی',
  rob: 'ربع سکه', nim: 'نیم سکه', mesghal: 'مثقال', oil_brent: 'نفت برنت', oil: 'نفت',
  nickel: 'نیکل', platinum: 'پلاتین', copper: 'مس', silver: 'نقره'
};
const TGJU_ICONS = {
  price_dollar_rl: '💵', price_eur: '💶', price_gbp: '💷', price_aed: '💴', price_try: '💴',
  geram18: '🟡', geram24: '🟡', sekee: '🪙', sekeb: '🪙', rob: '🪙', nim: '🪙', mesghal: '🟡',
  oil_brent: '🛢️', oil: '🛢️', nickel: '⚙️', platinum: '⚪', copper: '🟠', silver: '⚪'
};
const marketIcon = key => TGJU_ICONS[key] || (/^BTC/i.test(key) ? '₿' : /^ETH/i.test(key) ? 'Ξ' : '📈');
// /api/tgju آبجکتیه با کلیدهای کدی (مثل price_dollar_rl) — این تابع هم آرایه‌ی
// خام هم آبجکت رو به یه شکل یکسان با اسم فارسی خوانا تبدیل می‌کنه.
function tgjuRows(data) {
  const raw = data.items || data.data || data || {};
  const entries = Array.isArray(raw) ? raw.map((v, i) => [v.key || v.title || v.name || i, v]) : Object.entries(raw);
  return entries.map(([key, value]) => ({
    key,
    name: TGJU_LABELS[key] || value.title || value.name || key,
    p: value.p ?? value.price ?? value.value ?? 0,
    change: value.dp != null ? `${value.dp > 0 ? '▲' : value.dp < 0 ? '▼' : ''}${Math.abs(value.dp)}٪` : String(value.change ?? value.percent ?? '')
  }));
}
const nextDays = (date, count) => [...Array(count)].map((_, i) => new Date(date.getFullYear(), date.getMonth(), date.getDate() + i));

function Card({ title, icon: Icon, action, className = '', children }) { return <section className={`card ${className}`}><header>{Icon && <span className="card-icon"><Icon size={16} strokeWidth={2.2} /></span>}<h2>{title}</h2>{action}</header>{children}</section>; }
function TeamBadge({ logo, name }) { return logo ? <img className="team-logo" src={logo} alt="" loading="lazy" onError={e => { e.target.style.display = 'none'; }} /> : <span className="team-logo team-logo-fallback">{(name || '?').trim().charAt(0)}</span>; }
function Sparkline({ data, up, width = 72, height = 28, uid = 'sp' }) {
  if (!data || data.length < 2) return <svg width={width} height={height} />;
  const max = Math.max(...data), min = Math.min(...data), span = max - min || 1;
  const coords = data.map((v, i) => [(i / (data.length - 1)) * width, height - ((v - min) / span) * (height - 4) - 2]);
  const line = coords.map(([x, y]) => `${x},${y}`).join(' ');
  const area = `0,${height} ${line} ${width},${height}`;
  const color = up ? '#34d399' : '#fb7185', gid = `fill-${uid}-${up ? 'u' : 'd'}`;
  return <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} className={up ? 'spark-up' : 'spark-down'} preserveAspectRatio="none">
    <defs><linearGradient id={gid} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={color} stopOpacity="0.35" /><stop offset="100%" stopColor={color} stopOpacity="0" /></linearGradient></defs>
    <polygon points={area} fill={`url(#${gid})`} />
    <polyline points={line} fill="none" stroke={color} strokeWidth="1.8" strokeLinejoin="round" strokeLinecap="round" />
  </svg>;
}

const NAV_PAGES = [
  ['', 'امروز', House], ['calendar', 'تقویم', CalendarDays], ['planner', 'برنامه‌ریز', ListChecks], ['finance', 'مالی', Wallet],
  ['market', 'بازار', LineChart], ['football', 'فوتبال', Trophy], ['series', 'سریال‌ها', Clapperboard], ['movies', 'فیلم‌ها', Film],
  ['media', 'رسانه', Music], ['notes', 'یادداشت‌ها', StickyNote], ['documents', 'مدارک', FolderOpen],
  ['contacts', 'مخاطبین', Users], ['settings', 'تنظیمات', Settings]
];
function TopNav({ active, right }) {
  return <nav className="topbar"><a className="brand" href="/"><Sparkles size={20} /><span>LifeOS</span></a><div className="links">{NAV_PAGES.map(([page, label, Icon]) => <a className={page === active ? 'active' : ''} href={page ? `/?page=${page}` : '/'} key={page || 'home'}><Icon size={16} strokeWidth={2.2} /><span>{label}</span></a>)}</div>{right}</nav>;
}

function App() {
  const today = useMemo(isoToday, []);
  const [data, setData] = useState({ tasks: [], reminders: [], transactions: [], daily: null, user: null, watchingSeries: [] });
  const [weather, setWeather] = useState(null);
  const [quick, setQuick] = useState({ type: 'task', title: '', amount: '' });
  const [notice, setNotice] = useState('');

  const load = async () => {
    try {
      const [me, dashboard, tasks, reminders] = await Promise.all([
        api('/api/me'), api(`/api/dashboard?date=${today}`), api('/api/tasks'), api(`/api/reminders?from=${today}&to=${today}`)
      ]);
      setData({ ...dashboard, tasks: tasks.items || [], reminders: reminders.items || [], user: me.user || null });
    } catch (error) { setNotice(error.message); }
  };
  useEffect(() => { load(); }, []);
  useEffect(() => {
    fetch('https://api.open-meteo.com/v1/forecast?latitude=35.69&longitude=51.39&current=temperature_2m,weather_code,wind_speed_10m&daily=temperature_2m_max,temperature_2m_min,weather_code&timezone=Asia%2FTehran')
      .then(r => r.json()).then(setWeather).catch(() => {});
  }, []);
  const toggleTask = async task => { await api(`/api/tasks/${task.id}`, { method: 'PATCH', body: JSON.stringify({ done: !task.done }) }); load(); };
  const toggleReminder = async reminder => { await api(`/api/reminders/${reminder.id}`, { method: 'PATCH', body: JSON.stringify({ done: !reminder.done }) }); load(); };
  const submitQuick = async event => {
    event.preventDefault(); if (!quick.title.trim()) return;
    const payload = quick.type === 'transaction'
      ? { title: quick.title, amount: Number(quick.amount), kind: 'expense', category: 'متفرقه', account: 'بدون حساب', date: today }
      : quick.type === 'reminder' ? { title: quick.title, date: today, whenLabel: today } : { title: quick.title, date: today, priority: 'medium' };
    const endpoint = quick.type === 'transaction' ? '/api/transactions' : quick.type === 'reminder' ? '/api/reminders' : '/api/tasks';
    try { await api(endpoint, { method: 'POST', body: JSON.stringify(payload) }); setQuick({ type: 'task', title: '', amount: '' }); setNotice('با موفقیت ثبت شد.'); load(); } catch (error) { setNotice(error.message); }
  };
  const saveDaily = async event => { event.preventDefault(); const form = new FormData(event.currentTarget); try { await api('/api/daily', { method: 'PUT', body: JSON.stringify({ date: today, mood: Number(form.get('mood')), sleep: form.get('sleep'), note: form.get('note') }) }); setNotice('ثبت روزانه ذخیره شد.'); load(); } catch (error) { setNotice(error.message); } };
  const tasks = data.tasks.filter(t => !t.isReminder).sort((a, b) => String(a.date).localeCompare(String(b.date)));
  const done = tasks.filter(t => t.done).length;
  const weatherIcon = code => code === 0 ? '☀️' : code < 4 ? '⛅' : code < 70 ? '☁️' : '🌧️';
  const page = new URLSearchParams(location.search).get('page');
  if (page === 'calendar') return <CalendarReact Nav={TopNav} />;
  if (page === 'planner') return <PlannerReact Nav={TopNav} />;
  if (page === 'finance') return <FinanceReact />;
  if (page === 'market') return <MarketReact Nav={TopNav} />;
  if (page === 'football') return <FootballReact />;
  if (page === 'movies') return <MoviesReact />;
  if (page === 'series') return <SeriesReact />;
  if (page === 'media' || page === 'music' || page === 'youtube') return <MediaReact Nav={TopNav} initialTab={page === 'youtube' ? 'youtube' : page === 'music' ? 'spotify' : 'desk'} />;
  if (page === 'notes') return <NotesReact Nav={TopNav} />;
  if (page === 'documents') return <DocumentsReact Nav={TopNav} />;
  if (page === 'contacts') return <ContactsReact Nav={TopNav} />;
  if (page === 'settings') return <SettingsReact />;
  return <main>
    <TopNav active="" right={<div className="profile"><button onClick={() => { const next = document.documentElement.dataset.mode === 'dark' ? 'light' : 'dark'; document.documentElement.dataset.mode = next; localStorage.setItem('lifeos-mode', next); }}>◐</button><b>{data.user?.name || 'سلام'}</b></div>} />
    <div className="page">
      <form className="quick" onSubmit={submitQuick}><button type="submit" className="save">＋ ثبت</button><input value={quick.title} onChange={e => setQuick({ ...quick, title: e.target.value })} placeholder="برایت چه ثبت کنم؟" />{quick.type === 'transaction' && <input className="amount" value={quick.amount} onChange={e => setQuick({ ...quick, amount: e.target.value })} inputMode="numeric" placeholder="مبلغ ریال" />}<div className="quick-tabs">{[['task','کار',CheckSquare2],['reminder','یادآوری',Bell],['transaction','هزینه',Wallet]].map(([type, label, Icon]) => <button type="button" className={quick.type === type ? 'selected' : ''} onClick={() => setQuick({ ...quick, type })} key={type}><Icon size={14} />{label}</button>)}</div></form>
      {notice && <div className="notice">{notice}<button onClick={() => setNotice('')}>×</button></div>}
      <div className="grid top-grid">
        <Card className="weather" icon={MapPin} title="تهران" action={<small>اکنون</small>}><img className="hero-bg-img" src="/assets/img/weather-aurora.jpg" alt="" /><div className="hero-bg-fade" /><div className="stars" />{weather ? <><div className="weather-now"><span className="weather-icon-badge">{weatherIcon(weather.current.weather_code)}</span><strong>{fa(Math.round(weather.current.temperature_2m))}<em>°C</em></strong><b>هوای امروز</b></div><div className="weather-stats"><span>باد {fa(weather.current.wind_speed_10m)} km/h</span><span>پیش‌بینی Open-Meteo</span></div><div className="forecast">{weather.daily.time.slice(0, 5).map((day, index) => <div key={day}><small>{index === 0 ? 'اکنون' : new Intl.DateTimeFormat('fa-IR', { weekday: 'short' }).format(new Date(`${day}T12:00`))}</small><b className="weather-icon-badge small">{weatherIcon(weather.daily.weather_code[index])}</b><strong>{fa(Math.round(weather.daily.temperature_2m_max[index]))}°</strong></div>)}</div></> : <p>در حال دریافت وضعیت هوا…</p>}</Card>
        <Calendar />
        <Card className="day-card" title={new Intl.DateTimeFormat('fa-IR', { weekday: 'long' }).format(new Date())}><img className="hero-bg-img" src="/assets/img/mountains-dusk.jpg" alt="" /><div className="hero-bg-fade" /><div className="date-number">{new Intl.DateTimeFormat('fa-IR', { day: 'numeric' }).format(new Date())}</div><h3>{jalali(new Date())}</h3><small>{new Intl.DateTimeFormat('en-GB', { dateStyle: 'long' }).format(new Date())}</small><div className="occasion">▣ رویدادی برای امروز ثبت نشده</div></Card>
      </div>
      <div className="grid content-grid">
        <Card className="tasks" icon={CheckSquare2} title="کارهای امروز" action={<span className="muted">{fa(done)} از {fa(tasks.length)} انجام شده</span>}><div className="progress"><i style={{ width: `${tasks.length ? done / tasks.length * 100 : 0}%` }} /></div><button className="outline" onClick={() => setQuick({ ...quick, type: 'task' })}>＋ افزودن کار</button><div className="list">{tasks.slice(0, 6).map(task => <button className={`line ${task.done ? 'done' : ''}`} key={task.id} onClick={() => toggleTask(task)}><i>{task.done ? '✓' : ''}</i><span>{task.title}</span><small>{task.startTime || task.date === today ? 'امروز' : task.date}</small></button>)}{!tasks.length && <p className="empty">کارت را با نخستین کار امروزت شروع کن.</p>}</div></Card>
        <Market />
        <Football />
        <Card title="یادآوری‌ها" icon={Bell} className="reminders"><div className="list">{data.reminders.slice(0, 5).map(item => <button className={`line ${item.done ? 'done' : ''}`} key={item.id} onClick={() => toggleReminder(item)}><i>{item.done ? '✓' : '•'}</i><span>{item.title}</span><small>{item.time || 'امروز'}</small></button>)}{!data.reminders.length && <p className="empty">یادآوری‌ای برای امروز نداری.</p>}</div></Card>
        <Card title="ثبت روزانه" icon={StickyNote} className="daily"><form onSubmit={saveDaily}><label>امروزت چطور بود؟ <input name="mood" type="range" min="1" max="10" defaultValue={data.daily?.mood || 7} /></label><div className="form-row"><input name="sleep" defaultValue={data.daily?.sleep || ''} placeholder="خواب (ساعت)" /><input name="note" defaultValue={data.daily?.note || ''} placeholder="یک جمله از امروز" /></div><button className="save">ذخیرهٔ روز</button></form></Card>
        <Card title="سریال‌های من" icon={Clapperboard} className="series" action={<a href="/?page=series">ادامه تماشا ←</a>}>{data.watchingSeries?.length ? <div className="series-list">{data.watchingSeries.slice(0, 6).map(item => { const denom = item.airedInSeason || item.totalEpisodes || 0, progress = denom ? Math.min(100, Math.round((item.currentEpisode || 0) / denom * 100)) : 0; return <div className="series-item" key={item.id}><div className="series-poster">{item.posterUrl ? <img src={item.posterUrl} alt={item.title} loading="lazy" onError={e => { e.target.style.display = 'none'; e.target.nextSibling.style.display = 'grid'; }} /> : null}<span className="series-fallback" style={{ display: item.posterUrl ? 'none' : 'grid' }}>🎬</span>{progress > 0 && <div className="series-progress"><i style={{ width: `${progress}%` }} /></div>}</div><b>{item.title}</b><small>{item.currentSeason ? `فصل ${fa(item.currentSeason)} · ` : ''}قسمت {fa(item.currentEpisode || 0)}</small></div>; })}</div> : <p className="empty">سریالی در حال تماشا نیست.</p>}</Card>
      </div>
    </div>
  </main>;
}
function Calendar() { const now = new Date(); const days = nextDays(new Date(now.getFullYear(), now.getMonth(), 1), 31).filter(day => day.getMonth() === now.getMonth()); return <Card className="calendar" icon={CalendarDays} title={new Intl.DateTimeFormat('fa-IR', { month: 'long', year: 'numeric' }).format(now)} action={<a href="/?page=calendar">امروز</a>}><div className="weekdays">{['ش','ی','د','س','چ','پ','ج'].map(x => <span key={x}>{x}</span>)}</div><div className="calendar-days">{[...Array((days[0].getDay() + 1) % 7)].map((_, i) => <span key={`blank${i}`} />)}{days.map(day => <b className={day.toDateString() === now.toDateString() ? 'today' : ''} key={day}>{new Intl.DateTimeFormat('fa-IR', { day: 'numeric' }).format(day)}</b>)}</div></Card>; }
const JALALI_MONTHS = ['فروردین', 'اردیبهشت', 'خرداد', 'تیر', 'مرداد', 'شهریور', 'مهر', 'آبان', 'آذر', 'دی', 'بهمن', 'اسفند'];
const WEEKDAYS = ['ش', 'ی', 'د', 'س', 'چ', 'پ', 'ج'];
const iso = date => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
const fromIso = value => { const [year, month, day] = value.split('-').map(Number); return new Date(year, month - 1, day); };
const jdiv = (a, b) => Math.trunc(a / b);
const jmod = (a, b) => a - Math.trunc(a / b) * b;
function jalCal(jy) { const breaks = [-61,9,38,199,426,686,756,818,1111,1181,1210,1635,2060,2097,2192,2262,2324,2394,2456,3178]; let leapJ = -14, jp = breaks[0], jump, jm, n; for (let i = 1; i < breaks.length; i += 1) { jm = breaks[i]; jump = jm - jp; if (jy < jm) break; leapJ += jdiv(jump, 33) * 8 + jdiv(jmod(jump, 33), 4); jp = jm; } n = jy - jp; leapJ += jdiv(n, 33) * 8 + jdiv(jmod(n, 33) + 3, 4); if (jmod(jump, 33) === 4 && jump - n === 4) leapJ += 1; const gy = jy + 621, leapG = jdiv(gy, 4) - jdiv((jdiv(gy, 100) + 1) * 3, 4) - 150; const march = 20 + leapJ - leapG; if (jump - n < 6) n = n - jump + jdiv(jump + 4, 33) * 33; let leap = jmod(jmod(n + 1, 33) - 1, 4); if (leap === -1) leap = 4; return { leap, gy, march }; }
function g2d(gy, gm, gd) { let d = jdiv((gy + jdiv(gm - 8, 6) + 100100) * 1461, 4) + jdiv(153 * jmod(gm + 9, 12) + 2, 5) + gd - 34840408; return d - jdiv(jdiv(gy + 100100 + jdiv(gm - 8, 6), 100) * 3, 4) + 752; }
function d2g(jdn) { let j = 4 * jdn + 139361631; j += jdiv(jdiv(4 * jdn + 183187720, 146097) * 3, 4) * 4 - 3908; const i = jdiv(jmod(j, 1461), 4) * 5 + 308; return { gd: jdiv(jmod(i, 153), 5) + 1, gm: jmod(jdiv(i, 153), 12) + 1, gy: jdiv(j, 1461) - 100100 + jdiv(8 - jmod(jdiv(i, 153), 12) - 1, 6) }; }
const j2d = (jy, jm, jd) => { const r = jalCal(jy); return g2d(r.gy, 3, r.march) + (jm - 1) * 31 - jdiv(jm, 7) * (jm - 7) + jd - 1; };
function d2j(jdn) { const gy = d2g(jdn).gy; let jy = gy - 621, r = jalCal(jy), k = jdn - g2d(gy, 3, r.march); if (k >= 0) { if (k <= 185) return { jy, jm: 1 + jdiv(k, 31), jd: jmod(k, 31) + 1 }; k -= 186; } else { jy -= 1; k += 179; if (r.leap === 1) k += 1; } return { jy, jm: 7 + jdiv(k, 30), jd: jmod(k, 30) + 1 }; }
const toJalali = date => d2j(g2d(date.getFullYear(), date.getMonth() + 1, date.getDate()));
const toGregorian = (jy, jm, jd) => { const g = d2g(j2d(jy, jm, jd)); return new Date(g.gy, g.gm - 1, g.gd); };
const jalaliMonthLength = (year, month) => month <= 6 ? 31 : month < 12 ? 30 : jalCal(year).leap === 0 ? 30 : 29;
const addDays = (date, amount) => new Date(date.getFullYear(), date.getMonth(), date.getDate() + amount);
const sameDate = (a, b) => iso(a) === iso(b);
const weekdayIndex = date => (date.getDay() + 1) % 7;
const eventOnDate = (event, day) => { const dayIso = iso(day), start = String(event.startDate || event.date || '').slice(0, 10), end = String(event.endDate || start).slice(0, 10); if (!start) return false; if (event.allDay) return dayIso >= start && dayIso < end; return dayIso === start || (end > start && dayIso <= end); };
const eventLabel = event => `${event.time ? `${event.time} · ` : ''}${event.title || 'رویداد'}`;

function FinanceReact() {
  const [month, setMonth] = useState(() => isoToday().slice(0, 7));
  const [holdAssetType, setHoldAssetType] = useState('crypto');
  const [data, setData] = useState({ income: 0, expense: 0, balance: 0, categories: {} });
  const [transactions, setTransactions] = useState([]), [accounts, setAccounts] = useState([]), [budgets, setBudgets] = useState({ budgets: [] });
  const [debts, setDebts] = useState([]), [portfolio, setPortfolio] = useState({ items: [], totals: {} }), [notice, setNotice] = useState('');
  const [kindFilter, setKindFilter] = useState('all'), [editing, setEditing] = useState(null), [importPreview, setImportPreview] = useState(null);
  const load = async () => {
    try {
      const [summary, list, accountData, budgetData, debtData, portfolioData] = await Promise.all([
        api(`/api/finance?month=${month}`), api(`/api/transactions?from=${month}-01&to=${month}-31`), api('/api/accounts'),
        api(`/api/budgets?month=${month}`), api('/api/debts'), api('/api/portfolio')
      ]);
      setData(summary); setTransactions(list.items || []); setAccounts(accountData.accounts || []); setBudgets(budgetData || { budgets: [] }); setDebts(debtData.items || []); setPortfolio(portfolioData || { items: [], totals: {} });
    } catch (error) { setNotice(error.message); }
  };
  useEffect(() => { load(); }, [month]);
  const send = async (path, body, message, method = 'POST') => { try { await api(path, { method, body: JSON.stringify(body) }); setNotice(message); await load(); } catch (error) { setNotice(error.message); } };
  const submitTransaction = async event => { event.preventDefault(); const f = new FormData(event.currentTarget); await send('/api/transactions', { title: f.get('title'), amount: Number(f.get('amount')), kind: f.get('kind'), category: f.get('category') || 'متفرقه', account: f.get('account') || 'بدون حساب', date: f.get('date') || `${month}-01`, tags: f.get('tags') }, 'تراکنش ثبت شد.'); event.currentTarget.reset(); };
  const saveEdit = async event => { event.preventDefault(); const f = new FormData(event.currentTarget); const body = editing.type === 'account' ? { name: f.get('name'), type: f.get('type'), balance: Number(f.get('amount')), archived: f.get('archived') === 'on' } : { title: f.get('title'), amount: Number(f.get('amount')), category: f.get('category'), kind: f.get('kind'), account: f.get('account'), date: f.get('date'), tags: f.get('tags') }; await send(`/api/${editing.type === 'account' ? 'accounts' : 'transactions'}/${editing.item.id}`, body, 'تغییرات ذخیره شد.', 'PATCH'); setEditing(null); };
  const remove = async item => { if (!window.confirm(`تراکنش «${item.title}» حذف شود؟`)) return; await send(`/api/transactions/${item.id}`, {}, 'تراکنش حذف شد.', 'DELETE'); };
  const previewImport = async event => { const file = event.target.files?.[0]; if (!file) return; try { const base64 = await new Promise((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result).split(',')[1]); reader.onerror = reject; reader.readAsDataURL(file); }); const preview = await api('/api/transactions/import-bank/preview', { method: 'POST', body: JSON.stringify({ fileBase64: base64, filename: file.name, fileType: file.name.toLowerCase().endsWith('.csv') ? 'csv' : 'xlsx', amountUnit: 'IRR' }) }); setImportPreview(preview); } catch (error) { setNotice(error.message); } event.target.value = ''; };
  const commitImport = async event => { event.preventDefault(); const f = new FormData(event.currentTarget); const items = (importPreview?.items || []).filter(item => !item.duplicate); await send('/api/transactions/import-bank/commit', { items, account: f.get('account') }, `${fa(items.length)} تراکنش برای ورود ارسال شد.`); setImportPreview(null); };
  const visibleTransactions = transactions.filter(item => kindFilter === 'all' || item.kind === kindFilter);
  const isFaceAsset = holdAssetType === 'dollar' || holdAssetType === 'euro';
  const portfolioTotals = Object.entries(portfolio.totals || {});
  return <main className="planner-react finance-react" dir="rtl">
    <TopNav active="finance" />
    <div className="planner-page"><header><div><p>نمای ماهانه با دادهٔ واقعی</p><h1>مالی</h1></div><div className="finance-month"><button onClick={() => setMonth(value => { const date = new Date(`${value}-01T00:00:00`); date.setMonth(date.getMonth() - 1); return iso(date).slice(0, 7); })}>ماه قبل</button><input aria-label="ماه" type="month" value={month} onChange={event => setMonth(event.target.value)} /><button onClick={() => setMonth(value => { const date = new Date(`${value}-01T00:00:00`); date.setMonth(date.getMonth() + 1); return iso(date).slice(0, 7); })}>ماه بعد</button></div><div className="planner-stats"><b>درآمد {fa(data.income)}</b><b>هزینه {fa(data.expense)}</b><b>مانده {fa(data.balance)}</b></div></header>
      {notice && <div className="notice">{notice}<button onClick={() => setNotice('')}>×</button></div>}
      <div className="finance-summary">{Object.entries(data.categories || {}).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([category, amount]) => <span key={category}><b>{category}</b><small>{fa(amount)} ریال</small></span>)}</div>
      <div className="planner-layout"><form className="planner-form" onSubmit={submitTransaction}><h2>تراکنش تازه</h2><input name="title" required placeholder="شرح" /><input name="amount" required inputMode="numeric" placeholder="مبلغ (ریال)" /><div><select name="kind"><option value="expense">هزینه</option><option value="income">درآمد</option></select><input name="category" placeholder="دسته" /></div><select name="account"><option value="بدون حساب">بدون حساب</option>{accounts.filter(account => !account.archived).map(account => <option key={account.id} value={account.name}>{account.name}</option>)}</select><input name="tags" placeholder="تگ‌ها، با ویرگول جدا" /><input name="date" type="date" defaultValue={isoToday()} /><button className="save">ثبت تراکنش</button></form>
        <section className="planner-list"><div className="finance-section-heading"><h2>تراکنش‌های ماه</h2><div className="planner-filters">{[['all','همه'],['expense','هزینه'],['income','درآمد'],['transfer','انتقال']].map(([key, label]) => <button type="button" className={kindFilter === key ? 'active' : ''} onClick={() => setKindFilter(key)} key={key}>{label}</button>)}</div></div>{visibleTransactions.length ? <Table><TableHeader><TableRow><TableHead>شرح</TableHead><TableHead>دسته</TableHead><TableHead>حساب</TableHead><TableHead>مبلغ</TableHead><TableHead>عملیات</TableHead></TableRow></TableHeader><TableBody>{visibleTransactions.map(item => <TableRow key={item.id}><TableCell><b>{item.title}</b><small>{item.date}{item.tags?.length ? ` · ${item.tags.map(tag => `#${tag}`).join(' ')}` : ''}</small></TableCell><TableCell>{item.category}</TableCell><TableCell>{item.account}{item.toAccount ? ` ← ${item.toAccount}` : ''}</TableCell><TableCell numeric className={item.kind === 'income' ? '' : 'negative'}>{item.kind === 'income' ? '+' : item.kind === 'transfer' ? '↔' : '−'}{fa(item.amount)} ریال</TableCell><TableCell><button className="finance-action" onClick={() => setEditing({ type: 'transaction', item })}>ویرایش</button><button className="planner-delete" onClick={() => remove(item)} aria-label={`حذف ${item.title}`}>×</button></TableCell></TableRow>)}</TableBody></Table> : <p className="empty">تراکنشی در این ماه نیست.</p>}</section></div>
      <div className="finance-grid"><section className="planner-list"><h2>حساب‌ها</h2><div className="finance-account-grid">{accounts.map(account => <div key={account.id} className={account.archived ? 'archived' : ''}><b>{account.name}</b><small>{account.type} · {fa(account.balance ?? account.openingBalance ?? 0)} ریال</small><button className="finance-action" onClick={() => setEditing({ type: 'account', item: account })}>ویرایش</button></div>)}</div><form className="planner-form compact" onSubmit={event => { event.preventDefault(); const f = new FormData(event.currentTarget); send('/api/accounts', { name: f.get('name'), type: f.get('type'), openingBalance: Number(f.get('openingBalance') || 0) }, 'حساب ثبت شد.'); event.currentTarget.reset(); }}><input name="name" required placeholder="نام حساب" /><div><select name="type"><option value="bank">بانک</option><option value="card">کارت</option><option value="cash">نقدی</option></select><input name="openingBalance" inputMode="numeric" placeholder="ماندهٔ اولیه" /></div><button className="save">افزودن حساب</button></form><form className="planner-form compact" onSubmit={event => { event.preventDefault(); const f = new FormData(event.currentTarget); send('/api/transfers', { fromAccount: f.get('fromAccount'), toAccount: f.get('toAccount'), amount: Number(f.get('amount')), date: f.get('date'), title: f.get('title') }, 'انتقال ثبت شد.'); event.currentTarget.reset(); }}><h3>انتقال بین حساب‌ها</h3><input name="title" placeholder="شرح انتقال" /><div><select name="fromAccount" required><option value="">از حساب</option>{accounts.map(account => <option key={account.id} value={account.name}>{account.name}</option>)}</select><select name="toAccount" required><option value="">به حساب</option>{accounts.map(account => <option key={account.id} value={account.name}>{account.name}</option>)}</select></div><div><input name="amount" required inputMode="numeric" placeholder="مبلغ" /><input name="date" type="date" defaultValue={isoToday()} /></div><button className="save">ثبت انتقال</button></form></section>
        <section className="planner-list"><h2>بودجهٔ {month}</h2><div className="budget-total"><b>{budgets.totalBudget ? `${fa(budgets.totalSpent || 0)} از ${fa(budgets.totalBudget)} ریال` : `هزینهٔ ماه: ${fa(budgets.totalSpent || 0)} ریال`}</b></div>{(budgets.budgets || []).map(item => <div className="budget-row" key={item.id}><div><b>{item.category}</b><small>{fa(item.spent)} از {fa(item.limit)} ریال</small></div><progress value={Math.min(item.spent, item.limit)} max={item.limit} /></div>)}<form className="planner-form compact" onSubmit={event => { event.preventDefault(); const f = new FormData(event.currentTarget); send('/api/budgets', { month, category: f.get('category'), limit: Number(f.get('limit')) }, 'بودجه ذخیره شد.'); event.currentTarget.reset(); }}><input name="category" required placeholder="دسته (یا __total__ برای کل)" /><input name="limit" required inputMode="numeric" placeholder="سقف بودجه، ریال" /><button className="save">ذخیرهٔ بودجه</button></form></section></div>
      <div className="finance-grid"><section className="planner-list"><h2>بدهی و طلب</h2>{debts.length ? debts.map(item => <article key={item.id}><div><b>{item.type === 'payable' ? 'بدهی به ' : 'طلب از '}{item.person}</b><small>{fa(item.amount)} {item.currency === 'USD' ? 'دلار' : 'ریال'}{item.dueDate ? ` · سررسید ${item.dueDate}` : ''}{item.note ? ` · ${item.note}` : ''}</small></div><button className="finance-action" onClick={() => send(`/api/debts/${item.id}/settle`, { account: item.currency === 'IRR' ? accounts.find(account => !account.archived)?.name || '' : '' }, 'تسویه ثبت شد.')}>تسویه</button></article>) : <p className="empty">بدهی یا طلب بازی نیست.</p>}<form className="planner-form compact" onSubmit={event => { event.preventDefault(); const f = new FormData(event.currentTarget); send('/api/debts', { person: f.get('person'), amount: Number(f.get('amount')), type: f.get('type'), currency: f.get('currency'), dueDate: f.get('dueDate') || null, note: f.get('note') }, 'ثبت شد.'); event.currentTarget.reset(); }}><input name="person" required placeholder="نام شخص" /><div><select name="type"><option value="payable">بدهی من</option><option value="receivable">طلب من</option></select><select name="currency"><option value="IRR">ریال</option><option value="USD">دلار</option></select></div><input name="amount" required inputMode="numeric" placeholder="مبلغ" /><input name="dueDate" type="date" /><input name="note" placeholder="یادداشت" /><button className="save">افزودن</button></form></section>
        <section className="planner-list"><h2>سبد سرمایه</h2><p className="portfolio-total">ارزش گزارش‌شده: {portfolioTotals.length ? portfolioTotals.map(([currency, total]) => <b key={currency}>{fa(total?.value || 0)} {currency} </b>) : '—'}</p>{portfolio.items?.length ? <Table><TableHeader><TableRow><TableHead>دارایی</TableHead><TableHead>تعداد</TableHead><TableHead>ارزش</TableHead></TableRow></TableHeader><TableBody>{portfolio.items.map(item => <TableRow key={`${item.assetType}-${item.symbol}`}><TableCell>{item.symbol}<small>{item.assetType}</small></TableCell><TableCell numeric>{fa(item.quantity)}</TableCell><TableCell numeric>{fa(item.value || 0)} {item.currency || ''}</TableCell></TableRow>)}</TableBody></Table> : <p className="empty">دارایی ثبت نشده است.</p>}<form className="planner-form compact" onSubmit={event => { event.preventDefault(); const f = new FormData(event.currentTarget); const body = { assetType: holdAssetType, type: f.get('type'), quantity: Number(f.get('quantity')), fee: Number(f.get('fee') || 0), date: f.get('date'), note: f.get('note') }; if (!isFaceAsset) { body.symbol = f.get('symbol'); body.price = Number(f.get('price')); } send('/api/investments/tx', body, 'تراکنش سرمایه‌گذاری ثبت شد.'); event.currentTarget.reset(); setHoldAssetType('crypto'); }}><div><select name="assetType" value={holdAssetType} onChange={e => setHoldAssetType(e.target.value)}><option value="crypto">رمزارز</option><option value="stock">سهام</option><option value="gold">طلا</option><option value="dollar">💵 دلار</option><option value="euro">💶 یورو</option><option value="other">سایر</option></select><select name="type"><option value="buy">خرید</option><option value="sell">فروش</option></select></div><input name="symbol" required={!isFaceAsset} disabled={isFaceAsset} placeholder={isFaceAsset ? 'نماد لازم نیست' : 'نماد / نام دارایی'} /><div><input name="quantity" required inputMode="decimal" placeholder="تعداد" /><input name="price" required={!isFaceAsset} disabled={isFaceAsset} placeholder={isFaceAsset ? 'قیمت لازم نیست' : 'قیمت واحد'} /></div><input name="fee" inputMode="decimal" placeholder="کارمزد" /><input name="date" type="date" defaultValue={isoToday()} /><input name="note" placeholder="یادداشت" /><button className="save">ثبت سرمایه‌گذاری</button></form></section></div>
      <section className="planner-list finance-import"><h2>درون‌ریزی صورت‌حساب بانک</h2><p>فایل CSV، XLS یا XLSX را انتخاب کنید؛ ابتدا فقط پیش‌نمایش تراکنش‌های تازه دریافت می‌شود.</p><input type="file" accept=".csv,.xls,.xlsx" onChange={previewImport} />{importPreview && <form className="planner-form compact" onSubmit={commitImport}><p>{fa(importPreview.newCount || 0)} مورد تازه و {fa(importPreview.duplicateCount || 0)} مورد تکراری پیدا شد.</p><select name="account"><option value="بدون حساب">بدون حساب</option>{accounts.map(account => <option key={account.id} value={account.name}>{account.name}</option>)}</select><button className="save">ورود {fa((importPreview.items || []).filter(item => !item.duplicate).length)} تراکنش تازه</button><button type="button" className="finance-action" onClick={() => setImportPreview(null)}>لغو</button></form>}</section>
    </div>
    {editing && <div className="finance-modal" role="dialog" aria-modal="true"><form className="planner-form" onSubmit={saveEdit}><div className="finance-section-heading"><h2>ویرایش {editing.type === 'account' ? 'حساب' : 'تراکنش'}</h2><button type="button" className="finance-action" onClick={() => setEditing(null)}>بستن</button></div><input name={editing.type === 'account' ? 'name' : 'title'} required defaultValue={editing.type === 'account' ? editing.item.name : editing.item.title} />{editing.type === 'account' ? <><div><select name="type" defaultValue={editing.item.type}><option value="bank">بانک</option><option value="card">کارت</option><option value="cash">نقدی</option></select><input name="amount" inputMode="numeric" defaultValue={editing.item.balance ?? editing.item.openingBalance ?? 0} /></div><label><input name="archived" type="checkbox" defaultChecked={editing.item.archived} /> بایگانی شود</label></> : <><input name="amount" required inputMode="numeric" defaultValue={editing.item.amount} /><div><select name="kind" defaultValue={editing.item.kind}><option value="expense">هزینه</option><option value="income">درآمد</option><option value="transfer">انتقال</option></select><input name="category" defaultValue={editing.item.category} /></div><select name="account" defaultValue={editing.item.account}>{accounts.map(account => <option key={account.id} value={account.name}>{account.name}</option>)}</select><input name="date" type="date" defaultValue={editing.item.date} /><input name="tags" defaultValue={(editing.item.tags || []).join(', ')} /></>}<button className="save">ذخیره</button></form></div>}
  </main>;
}
function FootballReact() { const [league, setLeague] = useState('eng.1'), [matches, setMatches] = useState([]), [standing, setStanding] = useState([]), [notice, setNotice] = useState(''); useEffect(() => { Promise.all([api(`/api/football/remote/free/matches?league=${league}`), api(`/api/football/remote/free/standings?league=${league}`)]).then(([m, s]) => { setMatches(m.items || []); setStanding(s.items || []); }).catch(error => setNotice(error.message)); }, [league]); return <main className="planner-react" dir="rtl"><TopNav active="football" /><div className="planner-page"><header><div><p>دادهٔ زندهٔ سرویس فوتبال فعلی</p><h1>فوتبال</h1></div><select value={league} onChange={e => setLeague(e.target.value)}><option value="eng.1">لیگ برتر انگلیس</option><option value="esp.1">لالیگا</option><option value="ita.1">سری آ</option><option value="ger.1">بوندس‌لیگا</option></select></header>{notice && <div className="notice">{notice}<button onClick={() => setNotice('')}>×</button></div>}<div className="planner-layout"><section className="planner-list"><h2>مسابقات</h2>{matches.length ? matches.map((m,i) => <article key={m.id || i}><div><b>{m.home} — {m.away}</b><small>{m.date} · {m.time || '—'} · {m.status || ''}</small></div><b>{m.score || '—'}</b></article>) : <p className="empty">مسابقه‌ای دریافت نشد.</p>}</section><section className="planner-list"><h2>جدول</h2>{standing.length ? <Table><TableHeader><TableRow><TableHead>#</TableHead><TableHead>تیم</TableHead><TableHead>بازی</TableHead><TableHead>امتیاز</TableHead></TableRow></TableHeader><TableBody>{standing.map((r,i) => <TableRow key={r.name || i}><TableCell>{fa(r.rank || i + 1)}</TableCell><TableCell>{r.name}</TableCell><TableCell numeric>{fa(r.played || 0)}</TableCell><TableCell numeric>{fa(r.points || 0)}</TableCell></TableRow>)}</TableBody></Table> : <p className="empty">جدول دریافت نشد.</p>}</section></div></div></main>; }
function seasonAiredCount(item, season) { const by = item.seasonEpisodes || {}; const s = by[season] || by[String(season)]; return s ? Number(s.aired) || 0 : 0; }
function seasonTotalCount(item, season) { const by = item.seasonEpisodes || {}; const s = by[season] || by[String(season)]; return s ? Number(s.total) || 0 : 0; }
function seriesHasFresh(item) {
  const cur = Number(item.currentSeason) || 1;
  if (seasonAiredCount(item, cur) > (Number(item.currentEpisode) || 0)) return true;
  const by = item.seasonEpisodes || {};
  return Object.keys(by).some(s => Number(s) > cur && (Number(by[s].aired) || 0) > 0);
}
function episodesWatchedCount(item) {
  const by = item.seasonEpisodes || {}, cur = Number(item.currentSeason) || 1;
  let n = 0;
  Object.keys(by).forEach(s => { if (Number(s) < cur) n += Number(by[s].total) || 0; });
  return n + (Number(item.currentEpisode) || 0);
}
function seriesAiredTotal(item) {
  const by = item.seasonEpisodes || {};
  return Object.values(by).reduce((n, s) => n + (Number(s.aired) || 0), 0);
}
const SERIES_TABS = [['all', 'همه'], ['watching', 'در حال تماشا'], ['watchlist', 'بعداً'], ['completed', 'تمام‌شده'], ['dropped', 'رها‌شده']];
const SERIES_STATUS_OPTIONS = [['watchlist', 'بعداً'], ['watching', 'در حال تماشا'], ['completed', 'تمام‌شده'], ['dropped', 'رها‌شده']];

function SeriesReact() {
  const [items, setItems] = useState([]);
  const [tab, setTab] = useState('all');
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [open, setOpen] = useState(null);
  const [busyId, setBusyId] = useState(null);
  const [notice, setNotice] = useState('');
  const [toast, setToast] = useState('');

  const flash = msg => { setToast(msg); setTimeout(() => setToast(''), 2400); };
  const load = () => api('/api/movies').then(data => setItems((data.items || []).filter(x => x.type === 'series'))).catch(e => setNotice(e.message));
  useEffect(() => { load(); }, []);

  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) { setResults([]); setSearching(false); return; }
    setSearching(true);
    const t = setTimeout(() => {
      api(`/api/movies/tvmaze/search?q=${encodeURIComponent(q)}`).then(d => setResults(d.items || [])).catch(() => setResults([])).finally(() => setSearching(false));
    }, 380);
    return () => clearTimeout(t);
  }, [query]);

  const addedIds = new Set(items.map(x => String(x.tvmazeId)));

  const addShow = async show => {
    try {
      await api('/api/movies/from-tvmaze', { method: 'POST', body: JSON.stringify({ tvmazeId: show.tvmazeId, status: 'watchlist' }) });
      setQuery(''); setResults([]); flash(`«${show.name}» اضافه شد ✓`); load();
    } catch (e) { flash(e.message); }
  };

  const quickWatch = async item => {
    setBusyId(item.id);
    const nextEp = (Number(item.currentEpisode) || 0) + 1;
    try {
      await api(`/api/movies/${item.id}`, { method: 'PATCH', body: JSON.stringify({ currentEpisode: nextEp, currentSeason: item.currentSeason || 1, status: item.status === 'watchlist' ? 'watching' : item.status }) });
      flash(`«${item.title}» → قسمت ${fa(nextEp)} دیده شد ✓`);
      load();
    } catch (e) { flash(e.message); }
    setBusyId(null);
  };

  const stats = useMemo(() => {
    const eps = items.reduce((n, x) => n + episodesWatchedCount(x), 0);
    const mins = items.reduce((n, x) => n + episodesWatchedCount(x) * (x.durationMinutes || 45), 0);
    return { count: items.length, eps, hours: Math.round(mins / 60), completed: items.filter(x => x.status === 'completed').length };
  }, [items]);

  const upNext = useMemo(() => items.filter(x => x.status === 'watching' && seriesHasFresh(x)).slice(0, 6), [items]);
  const shown = tab === 'all' ? items : items.filter(x => x.status === tab);

  return (
    <main className="strk" dir="rtl">
      <TopNav active="series" />
      <div className="strk-page">
        <header className="strk-hero">
          <div><p>ردیاب سریال‌ها</p><h1>سریال‌های من</h1></div>
          <div className="strk-stats">
            <div><b>{fa(stats.count)}</b><small>سریال</small></div>
            <div><b>{fa(stats.eps)}</b><small>قسمت دیده‌شده</small></div>
            <div><b>{fa(stats.hours)}</b><small>ساعت تماشا</small></div>
            <div><b>{fa(stats.completed)}</b><small>تمام‌شده</small></div>
          </div>
        </header>

        <div className="strk-search">
          <Search size={16} className="strk-search-ic" />
          <input value={query} onChange={e => setQuery(e.target.value)} placeholder="جستجوی سریال برای افزودن… (انگلیسی)" />
          {searching && <span className="strk-spinner" />}
          {results.length > 0 && (
            <div className="strk-results">
              {results.map(show => (
                <div className="strk-result-row" key={show.tvmazeId}>
                  {show.posterUrl ? <img src={show.posterUrl} alt="" /> : <span className="strk-result-fallback">🎬</span>}
                  <div className="strk-result-info"><b>{show.name}</b><small>{show.year}{show.genres?.length ? ' · ' + show.genres.join('، ') : ''}</small></div>
                  {addedIds.has(String(show.tvmazeId)) ? <span className="strk-added">اضافه شده</span> : <button className="strk-add-btn" onClick={() => addShow(show)}>+ افزودن</button>}
                </div>
              ))}
            </div>
          )}
        </div>

        {notice && <div className="notice">{notice}<button onClick={() => setNotice('')}>×</button></div>}

        {upNext.length > 0 && (
          <section className="strk-upnext">
            <div className="strk-upnext-head"><h2>قسمت‌های بعدی</h2><span>{fa(upNext.length)} سریال</span></div>
            <div className="strk-upnext-list">
              {upNext.map(item => {
                const cur = Number(item.currentSeason) || 1, ep = (Number(item.currentEpisode) || 0) + 1;
                return (
                  <div className="strk-upnext-row" key={item.id}>
                    {item.posterUrl ? <img src={item.posterUrl} alt="" onError={e => { e.target.style.display = 'none'; e.target.nextSibling.style.display = 'flex'; }} /> : null}
                    <span className="strk-upnext-fallback" style={{ display: item.posterUrl ? 'none' : 'flex' }}>🎬</span>
                    <div className="strk-upnext-info"><b>{item.title}</b><small>فصل {fa(cur)} · قسمت {fa(ep)}</small></div>
                    <button disabled={busyId === item.id} className="strk-watch-btn" onClick={() => quickWatch(item)}>{busyId === item.id ? '...' : 'دیدمش ✓'}</button>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        <div className="strk-tabs">
          {SERIES_TABS.map(([key, label]) => (
            <button key={key} className={tab === key ? 'active' : ''} onClick={() => setTab(key)}>
              {label} ({fa(key === 'all' ? items.length : items.filter(x => x.status === key).length)})
            </button>
          ))}
        </div>

        {shown.length === 0 && <p className="empty">چیزی اینجا نیست — از جستجوی بالا سریال اضافه کن.</p>}

        <div className="strk-grid">
          {shown.map(item => {
            const cur = Number(item.currentSeason) || 1, ep = Number(item.currentEpisode) || 0;
            const airedTotal = seriesAiredTotal(item), watched = episodesWatchedCount(item);
            const pct = airedTotal ? Math.min(100, Math.round((watched / airedTotal) * 100)) : 0;
            const fresh = item.status === 'watching' && seriesHasFresh(item);
            const seasonsCount = Object.keys(item.seasonEpisodes || {}).length;
            return (
              <div className="strk-card" key={item.id}>
                <div className="strk-poster" onClick={() => setOpen(item)}>
                  {fresh && <span className="strk-fresh">قسمت جدید!</span>}
                  {item.posterUrl ? <img src={item.posterUrl} alt={item.title} loading="lazy" onError={e => { e.target.style.display = 'none'; e.target.nextSibling.style.display = 'flex'; }} /> : null}
                  <span className="strk-poster-fallback" style={{ display: item.posterUrl ? 'none' : 'flex' }}>🎬</span>
                  {item.tmdbRating != null && <span className="strk-rating">★ {fa(Math.round(item.tmdbRating * 10) / 10)}</span>}
                  {!!seasonsCount && <span className="strk-seasons">{fa(seasonsCount)} فصل</span>}
                  {pct >= 100 && airedTotal > 0 && <span className="strk-done">✓ تمام</span>}
                </div>
                <div className="strk-body">
                  <b className="strk-title">{item.title}</b>
                  {airedTotal > 0 && (
                    <div className="strk-progress-row">
                      <span>{fa(watched)} از {fa(airedTotal)} قسمت</span><span>{fa(pct)}٪</span>
                    </div>
                  )}
                  {airedTotal > 0 && <div className="strk-progress"><i style={{ width: `${pct}%`, background: pct >= 100 ? '#34d399' : undefined }} /></div>}
                  {item.status === 'watching' ? (
                    fresh ? (
                      <button disabled={busyId === item.id} className="strk-watch-btn strk-watch-btn-full" onClick={() => quickWatch(item)}>
                        {busyId === item.id ? '...' : `✓ دیدم فصل ${fa(cur)} قسمت ${fa(ep + 1)}`}
                      </button>
                    ) : <div className="strk-uptodate">همه‌ی قسمت‌های پخش‌شده رو دیدی ✓</div>
                  ) : null}
                  <button className="strk-more-btn" onClick={() => setOpen(item)}>📋 همه فصل‌ها و قسمت‌ها</button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
      {open && <SeriesDetail item={open} onClose={() => { setOpen(null); load(); }} flash={flash} />}
      {toast && <div className="strk-toast">{toast}</div>}
    </main>
  );
}

function SeriesDetail({ item, onClose, flash }) {
  const [row, setRow] = useState(item);
  const [episodes, setEpisodes] = useState(null);
  const [openSeason, setOpenSeason] = useState(Number(item.currentSeason) || 1);
  const [pendingKey, setPendingKey] = useState('');

  useEffect(() => {
    if (!item.tvmazeId) { setEpisodes([]); return; }
    api(`/api/movies/tvmaze/episodes?tvmazeId=${encodeURIComponent(item.tvmazeId)}`).then(d => setEpisodes(d.items || [])).catch(() => setEpisodes([]));
  }, [item.tvmazeId]);

  useEffect(() => {
    const onKey = e => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  const patch = async body => {
    try {
      const updated = await api(`/api/movies/${row.id}`, { method: 'PATCH', body: JSON.stringify(body) });
      setRow(updated);
      return updated;
    } catch (e) { flash(e.message); return null; }
  };

  const seasons = episodes && episodes.length
    ? [...new Set(episodes.map(e => e.season))].sort((a, b) => a - b)
    : Object.keys(row.seasonEpisodes || {}).map(Number).sort((a, b) => a - b);

  const isWatched = (season, number) => {
    const cur = Number(row.currentSeason) || 1;
    if (season < cur) return true;
    if (season > cur) return false;
    return number <= (Number(row.currentEpisode) || 0);
  };

  const toggleEpisode = async ep => {
    if (!ep.aired) return;
    const key = `${ep.season}-${ep.number}`;
    setPendingKey(key);
    if (isWatched(ep.season, ep.number)) await patch({ currentSeason: ep.season, currentEpisode: Math.max(0, ep.number - 1) });
    else await patch({ currentSeason: ep.season, currentEpisode: ep.number });
    setPendingKey('');
  };

  const markSeason = async season => {
    const aired = (episodes || []).filter(e => e.season === season && e.aired);
    const maxNum = aired.length ? Math.max(...aired.map(e => e.number)) : seasonAiredCount(row, season);
    await patch({ currentSeason: season, currentEpisode: maxNum });
    flash(`فصل ${fa(season)} دیده شد ✓`);
  };
  const clearSeason = async season => {
    await patch({ currentSeason: season, currentEpisode: 0 });
    flash(`فصل ${fa(season)} پاک شد`);
  };

  const del = async () => {
    if (!window.confirm(`«${row.title}» حذف شود؟`)) return;
    try { await api(`/api/movies/${row.id}`, { method: 'DELETE' }); onClose(); } catch (e) { flash(e.message); }
  };

  const totalEps = episodes ? episodes.filter(e => e.aired).length : seriesAiredTotal(row);
  const watchedEps = episodesWatchedCount(row);
  const pct = totalEps ? Math.min(100, Math.round((watchedEps / totalEps) * 100)) : 0;

  return (
    <div className="strk-modal-backdrop" onClick={onClose}>
      <div className="strk-modal" onClick={e => e.stopPropagation()}>
        <button className="strk-modal-close" onClick={onClose}><X size={18} /></button>
        <div className="strk-modal-head">
          {row.posterUrl ? <img src={row.posterUrl} alt="" onError={e => { e.target.style.display = 'none'; e.target.nextSibling.style.display = 'flex'; }} /> : null}
          <span className="strk-modal-poster-fallback" style={{ display: row.posterUrl ? 'none' : 'flex' }}>🎬</span>
          <div className="strk-modal-info">
            <h2>{row.title}</h2>
            <p className="strk-modal-meta">{[row.genre, row.network, row.year].filter(Boolean).join(' · ')}</p>
            {totalEps > 0 && (
              <>
                <div className="strk-progress-row"><span>{fa(watchedEps)} از {fa(totalEps)} قسمت دیده شده</span><span>{fa(pct)}٪</span></div>
                <div className="strk-progress"><i style={{ width: `${pct}%` }} /></div>
              </>
            )}
            <div className="strk-modal-controls">
              <select value={row.status} onChange={e => patch({ status: e.target.value })}>
                {SERIES_STATUS_OPTIONS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
              </select>
              <div className="strk-stars" dir="ltr">
                {Array.from({ length: 10 }, (_, i) => i + 1).map(n => (
                  <button key={n} onClick={() => patch({ rating: n })} className={row.rating && n <= row.rating ? 'on' : ''}><Star size={14} fill={row.rating && n <= row.rating ? 'currentColor' : 'none'} /></button>
                ))}
              </div>
              <button className="strk-del-btn" onClick={del}><Trash2 size={14} /> حذف</button>
            </div>
          </div>
        </div>

        {row.note && <p className="strk-modal-note">{row.note}</p>}

        <div className="strk-seasons-body">
          {episodes === null ? (
            <p className="empty">در حال دریافت قسمت‌ها…</p>
          ) : !seasons.length ? (
            <p className="empty">قسمتی یافت نشد.</p>
          ) : seasons.map(season => {
            const seasonEps = (episodes || []).filter(e => e.season === season);
            const aired = seasonEps.filter(e => e.aired);
            const watchedInSeason = aired.filter(e => isWatched(e.season, e.number)).length;
            const isOpen = openSeason === season;
            return (
              <div className="strk-season" key={season}>
                <button className="strk-season-head" onClick={() => setOpenSeason(isOpen ? null : season)}>
                  <ChevronDown size={16} className={isOpen ? 'open' : ''} />
                  <span className="strk-season-count">{fa(watchedInSeason)}/{fa(aired.length || seasonTotalCount(row, season))}</span>
                  <b>فصل {fa(season)}</b>
                  {watchedInSeason < aired.length && <span className="strk-new-badge">{fa(aired.length - watchedInSeason)} جدید</span>}
                </button>
                {isOpen && (
                  <div className="strk-season-body">
                    {seasonEps.length > 0 && (
                      <div className="strk-season-actions">
                        <button onClick={() => markSeason(season)}>همه‌ی قسمت‌های پخش‌شده رو دیدم ✓</button>
                        <button onClick={() => clearSeason(season)}>↺ پاک‌کردن فصل</button>
                      </div>
                    )}
                    <ul className="strk-ep-list">
                      {seasonEps.map(ep => {
                        const watched = isWatched(ep.season, ep.number), key = `${ep.season}-${ep.number}`;
                        return (
                          <li key={ep.id} className={!ep.aired ? 'strk-ep-unaired' : ''} onClick={() => toggleEpisode(ep)}>
                            <span className={`strk-ep-check ${watched ? 'on' : ''}`}>{pendingKey === key ? '…' : watched ? <Check size={12} /> : ''}</span>
                            <span className="strk-ep-info">
                              <b>{ep.name || `قسمت ${fa(ep.number)}`}</b>
                              <small>{ep.airdate || 'به‌زودی'}</small>
                            </span>
                            <span className="strk-ep-num">E{fa(ep.number)}</span>
                          </li>
                        );
                      })}
                      {!seasonEps.length && <li className="strk-ep-unaired"><span className="strk-ep-info"><small>داده‌ی قسمت‌به‌قسمت این فصل موجود نیست.</small></span></li>}
                    </ul>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

const MOVIE_TABS = [['all', 'همه'], ['watchlist', 'فهرست تماشا'], ['completed', 'دیده‌شده']];
const MOVIE_STATUS_OPTIONS = [['watchlist', 'فهرست تماشا'], ['completed', 'دیده‌شده']];

function MoviesReact() {
  const [items, setItems] = useState([]);
  const [tab, setTab] = useState('all');
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [open, setOpen] = useState(null);
  const [busyId, setBusyId] = useState(null);
  const [notice, setNotice] = useState('');
  const [toast, setToast] = useState('');

  const flash = msg => { setToast(msg); setTimeout(() => setToast(''), 2400); };
  const load = () => api('/api/movies').then(data => setItems((data.items || []).filter(x => x.type === 'movie'))).catch(e => setNotice(e.message));
  useEffect(() => { load(); }, []);

  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) { setResults([]); setSearching(false); return; }
    setSearching(true);
    const t = setTimeout(() => {
      api(`/api/movies/tmdb/search?q=${encodeURIComponent(q)}`).then(d => setResults((d.items || []).filter(x => x.mediaType === 'movie'))).catch(e => { setResults([]); flash(e.message); }).finally(() => setSearching(false));
    }, 380);
    return () => clearTimeout(t);
  }, [query]);

  const addedIds = new Set(items.map(x => String(x.tmdbId)));

  const addMovie = async show => {
    try {
      await api('/api/movies/from-tmdb', { method: 'POST', body: JSON.stringify({ tmdbId: show.tmdbId, mediaType: 'movie', status: 'watchlist' }) });
      setQuery(''); setResults([]); flash(`«${show.title}» اضافه شد ✓`); load();
    } catch (e) { flash(e.message); }
  };

  const markWatched = async item => {
    setBusyId(item.id);
    try {
      await api(`/api/movies/${item.id}`, { method: 'PATCH', body: JSON.stringify({ status: 'completed', date: isoToday() }) });
      flash(`«${item.title}» → دیده‌شده ✓`); load();
    } catch (e) { flash(e.message); }
    setBusyId(null);
  };

  const stats = useMemo(() => {
    const done = items.filter(x => x.status === 'completed');
    const mins = done.reduce((n, x) => n + (Number(x.durationMinutes) || 0), 0);
    const rated = done.filter(x => x.rating).map(x => Number(x.rating));
    return { count: items.length, done: done.length, hours: Math.round(mins / 60), avg: rated.length ? rated.reduce((a, b) => a + b, 0) / rated.length : null };
  }, [items]);

  const shown = tab === 'all' ? items : items.filter(x => x.status === tab);

  return (
    <main className="strk" dir="rtl">
      <TopNav active="movies" />
      <div className="strk-page">
        <header className="strk-hero">
          <div><p>ردیاب فیلم‌ها</p><h1>فیلم‌های من</h1></div>
          <div className="strk-stats">
            <div><b>{fa(stats.count)}</b><small>فیلم</small></div>
            <div><b>{fa(stats.done)}</b><small>دیده‌شده</small></div>
            <div><b>{fa(stats.hours)}</b><small>ساعت تماشا</small></div>
            <div><b>{stats.avg ? fa(Math.round(stats.avg * 10) / 10) : '—'}</b><small>میانگین امتیاز</small></div>
          </div>
        </header>

        <div className="strk-search">
          <Search size={16} className="strk-search-ic" />
          <input value={query} onChange={e => setQuery(e.target.value)} placeholder="جستجوی فیلم برای افزودن…" />
          {searching && <span className="strk-spinner" />}
          {results.length > 0 && (
            <div className="strk-results">
              {results.map(show => (
                <div className="strk-result-row" key={show.tmdbId}>
                  {show.posterUrl ? <img src={show.posterUrl} alt="" /> : <span className="strk-result-fallback">🎬</span>}
                  <div className="strk-result-info"><b>{show.title}</b><small>{(show.date || '').slice(0, 4)}</small></div>
                  {addedIds.has(String(show.tmdbId)) ? <span className="strk-added">اضافه شده</span> : <button className="strk-add-btn" onClick={() => addMovie(show)}>+ افزودن</button>}
                </div>
              ))}
            </div>
          )}
        </div>

        {notice && <div className="notice">{notice}<button onClick={() => setNotice('')}>×</button></div>}

        <div className="strk-tabs">
          {MOVIE_TABS.map(([key, label]) => (
            <button key={key} className={tab === key ? 'active' : ''} onClick={() => setTab(key)}>
              {label} ({fa(key === 'all' ? items.length : items.filter(x => x.status === key).length)})
            </button>
          ))}
        </div>

        {shown.length === 0 && <p className="empty">چیزی اینجا نیست — از جستجوی بالا فیلم اضافه کن.</p>}

        <div className="strk-grid">
          {shown.map(item => (
            <div className="strk-card" key={item.id}>
              <div className="strk-poster" onClick={() => setOpen(item)}>
                {item.posterUrl ? <img src={item.posterUrl} alt={item.title} loading="lazy" onError={e => { e.target.style.display = 'none'; e.target.nextSibling.style.display = 'flex'; }} /> : null}
                <span className="strk-poster-fallback" style={{ display: item.posterUrl ? 'none' : 'flex' }}>🎬</span>
                {item.tmdbRating != null && <span className="strk-rating">★ {fa(Math.round(item.tmdbRating * 10) / 10)}</span>}
                {item.durationMinutes ? <span className="strk-seasons">{fa(item.durationMinutes)} د</span> : null}
                {item.status === 'completed' && <span className="strk-done">✓ دیده‌شده</span>}
              </div>
              <div className="strk-body">
                <b className="strk-title">{item.title}</b>
                {item.status !== 'completed' ? (
                  <button disabled={busyId === item.id} className="strk-watch-btn-full" onClick={() => markWatched(item)}>{busyId === item.id ? '...' : '✓ دیدمش'}</button>
                ) : item.rating ? (
                  <div className="strk-progress-row"><span>امتیاز تو</span><span>★ {fa(item.rating)}/۱۰</span></div>
                ) : null}
                <button className="strk-more-btn" onClick={() => setOpen(item)}>جزئیات</button>
              </div>
            </div>
          ))}
        </div>
      </div>
      {open && <MovieDetail item={open} onClose={() => { setOpen(null); load(); }} flash={flash} />}
      {toast && <div className="strk-toast">{toast}</div>}
    </main>
  );
}

function MovieDetail({ item, onClose, flash }) {
  const [row, setRow] = useState(item);

  useEffect(() => {
    const onKey = e => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  const patch = async body => {
    try {
      const updated = await api(`/api/movies/${row.id}`, { method: 'PATCH', body: JSON.stringify(body) });
      setRow(updated);
      return updated;
    } catch (e) { flash(e.message); return null; }
  };

  const del = async () => {
    if (!window.confirm(`«${row.title}» حذف شود؟`)) return;
    try { await api(`/api/movies/${row.id}`, { method: 'DELETE' }); onClose(); } catch (e) { flash(e.message); }
  };

  return (
    <div className="strk-modal-backdrop" onClick={onClose}>
      <div className="strk-modal" onClick={e => e.stopPropagation()}>
        <button className="strk-modal-close" onClick={onClose}><X size={18} /></button>
        <div className="strk-modal-head">
          {row.posterUrl ? <img src={row.posterUrl} alt="" onError={e => { e.target.style.display = 'none'; e.target.nextSibling.style.display = 'flex'; }} /> : null}
          <span className="strk-modal-poster-fallback" style={{ display: row.posterUrl ? 'none' : 'flex' }}>🎬</span>
          <div className="strk-modal-info">
            <h2>{row.title}</h2>
            <p className="strk-modal-meta">{[row.genre, row.director, row.durationMinutes && `${fa(row.durationMinutes)} دقیقه`].filter(Boolean).join(' · ')}</p>
            <div className="strk-modal-controls">
              <select value={row.status} onChange={e => patch({ status: e.target.value })}>
                {MOVIE_STATUS_OPTIONS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
              </select>
              <div className="strk-stars" dir="ltr">
                {Array.from({ length: 10 }, (_, i) => i + 1).map(n => (
                  <button key={n} onClick={() => patch({ rating: n })} className={row.rating && n <= row.rating ? 'on' : ''}><Star size={14} fill={row.rating && n <= row.rating ? 'currentColor' : 'none'} /></button>
                ))}
              </div>
              <button className="strk-del-btn" onClick={del}><Trash2 size={14} /> حذف</button>
            </div>
          </div>
        </div>
        {row.note && <p className="strk-modal-note">{row.note}</p>}
      </div>
    </div>
  );
}

function RecordsReact({ kind }) {
  const config = {
    notes: { title: 'یادداشت‌ها', endpoint: '/api/inbox', create: f => ({ title: f.get('title'), text: f.get('text'), tags: String(f.get('tags') || '').split(/[،,#]/).map(x => x.trim()).filter(Boolean), color: f.get('color'), pinned: f.get('pinned') === 'on' }) },
    documents: { title: 'مدارک', endpoint: '/api/documents', create: f => ({ title: f.get('title'), type: f.get('type'), expiryDate: f.get('expiryDate') || null, notes: f.get('text') }) },
    contacts: { title: 'مخاطبین', endpoint: '/api/contacts', create: f => ({ name: f.get('title'), relationship: f.get('relationship'), phone: f.get('phone'), email: f.get('email'), birthday: f.get('birthday') || null, followUpDate: f.get('followUpDate') || null, notes: f.get('text') }) }
  }[kind];
  const [items, setItems] = useState([]), [notice, setNotice] = useState(''), [editing, setEditing] = useState(null), [showArchived, setShowArchived] = useState(false);
  const load = async () => { try { const data = await api(`${config.endpoint}${kind === 'notes' && showArchived ? '?archived=1' : ''}`); setItems(data.items || []); } catch (error) { setNotice(error.message); } };
  useEffect(() => { load(); }, [kind, showArchived]);
  const save = async event => { event.preventDefault(); const form = new FormData(event.currentTarget); try { const body = config.create(form); const path = editing ? `${config.endpoint}/${editing.id}` : config.endpoint; await api(path, { method: editing ? 'PATCH' : 'POST', body: JSON.stringify(body) }); event.currentTarget.reset(); setEditing(null); setNotice(editing ? 'ویرایش ذخیره شد.' : 'ثبت شد.'); load(); } catch (error) { setNotice(error.message); } };
  const remove = async item => { if (!window.confirm(`«${item.title || item.name}» حذف شود؟`)) return; try { await api(`${config.endpoint}/${item.id}`, { method: 'DELETE' }); setNotice('حذف شد.'); load(); } catch (error) { setNotice(error.message); } };
  const convert = async (item, type) => { try { await api(`/api/inbox/${item.id}/convert`, { method: 'POST', body: JSON.stringify({ type, date: isoToday() }) }); setNotice('یادداشت تبدیل و بایگانی شد.'); load(); } catch (error) { setNotice(error.message); } };
  const titleValue = item => item.title || item.name || '—';
  return <main className="planner-react records-react" dir="rtl"><TopNav active={kind} /><div className="planner-page"><header><div><p>داده‌های واقعی LifeOS</p><h1>{config.title}</h1></div>{kind === 'notes' && <button className="finance-action" onClick={() => setShowArchived(x => !x)}>{showArchived ? 'فقط فعال‌ها' : 'نمایش بایگانی'}</button>}</header>{notice && <div className="notice">{notice}<button onClick={() => setNotice('')}>×</button></div>}<div className="planner-layout"><form className="planner-form" onSubmit={save}><h2>{editing ? 'ویرایش' : 'افزودن'}</h2><input name="title" required placeholder={kind === 'contacts' ? 'نام مخاطب' : 'عنوان'} defaultValue={editing ? titleValue(editing) : ''} key={`title-${editing?.id || 'new'}`} />{kind === 'contacts' && <><div><select name="relationship" defaultValue={editing?.relationship || 'friend'}><option value="family">خانواده</option><option value="friend">دوست</option><option value="work">کاری</option><option value="other">سایر</option></select><input name="phone" placeholder="تلفن" defaultValue={editing?.phone || ''} /></div><input name="email" type="email" placeholder="ایمیل" defaultValue={editing?.email || ''} /><div><input name="birthday" type="date" defaultValue={editing?.birthday || ''} /><input name="followUpDate" type="date" defaultValue={editing?.followUpDate || ''} /></div></>}{kind === 'documents' && <><input name="type" placeholder="نوع سند" defaultValue={editing?.type || ''} /><input name="expiryDate" type="date" defaultValue={editing?.expiryDate || ''} /></>}{kind === 'notes' && <><input name="tags" placeholder="تگ‌ها، با ویرگول جدا" defaultValue={(editing?.tags || []).join(', ')} /><select name="color" defaultValue={editing?.color || 'cyan'}><option value="cyan">آبی</option><option value="violet">بنفش</option><option value="rose">صورتی</option><option value="amber">کهربایی</option><option value="green">سبز</option></select><label><input name="pinned" type="checkbox" defaultChecked={editing?.pinned} /> سنجاق شود</label></>}<textarea name="text" placeholder="توضیحات" defaultValue={editing?.text || editing?.notes || ''} key={`text-${editing?.id || 'new'}`} /><button className="save">{editing ? 'ذخیرهٔ تغییرات' : 'ذخیره'}</button>{editing && <button type="button" className="finance-action" onClick={() => setEditing(null)}>انصراف</button>}</form><section className="planner-list"><h2>فهرست</h2>{items.length ? items.map(item => <article key={item.id}><div><b>{titleValue(item)}</b><small>{kind === 'contacts' ? [item.relationship, item.phone, item.email, item.followUpDate && `پیگیری ${item.followUpDate}`].filter(Boolean).join(' · ') : kind === 'documents' ? [item.type, item.expiryDate && `انقضا ${item.expiryDate}`].filter(Boolean).join(' · ') : [item.noteDate?.slice(0, 10), ...(item.tags || []).map(tag => `#${tag}`)].filter(Boolean).join(' · ')}</small>{(item.text || item.notes) && <p>{item.text || item.notes}</p>}{kind === 'documents' && item.fileUrl && <a href={item.fileUrl} target="_blank" rel="noreferrer">بازکردن پیوست</a>}</div><div className="record-actions"><button className="finance-action" onClick={() => setEditing(item)}>ویرایش</button>{kind === 'notes' && <><button className="finance-action" onClick={() => convert(item, 'task')}>کار</button><button className="finance-action" onClick={() => convert(item, 'reminder')}>یادآور</button></>}<button className="planner-delete" onClick={() => remove(item)} aria-label={`حذف ${titleValue(item)}`}>×</button></div></article>) : <p className="empty">موردی برای نمایش نیست.</p>}</section></div></div></main>;
}

function SettingsReact() {
  const [integrations, setIntegrations] = useState({}), [notice, setNotice] = useState('');
  const load = () => api('/api/integrations').then(setIntegrations).catch(error => setNotice(error.message));
  useEffect(() => { load(); }, []);
  const disconnect = async name => { try { await api(`/api/integrations/${name}/disconnect`, { method: 'POST', body: JSON.stringify({}) }); setNotice('اتصال قطع شد.'); load(); } catch (error) { setNotice(error.message); } };
  const syncCalendar = async () => { try { await api('/api/integrations/google-calendar/sync', { method: 'POST', body: JSON.stringify({}) }); setNotice('همگام‌سازی شد.'); load(); } catch (error) { setNotice(error.message); } };
  const cards = [['spotify','Spotify','music'], ['youtube','YouTube','youtube'], ['google-calendar','Google Calendar','calendar']];
  return <main className="planner-react" dir="rtl"><TopNav active="settings" /><div className="planner-page"><header><div><p>اتصال‌های حساب</p><h1>تنظیمات</h1></div></header>{notice && <div className="notice">{notice}<button onClick={() => setNotice('')}>×</button></div>}<section className="planner-list integration-list" id="googleCalendarCard"><h2>اتصال‌ها</h2>{cards.map(([id, title, page]) => { const state = integrations[id] || integrations[id.replace('-', '')] || {}; const connected = Boolean(state.connected); return <article key={id}><div><b>{title}</b><small>{connected ? 'متصل است' : 'متصل نیست'}</small>{id === 'google-calendar' && <p>تقویم اختصاصی LifeOS داخل حساب گوگلت ساخته می‌شود؛ حذف آن در گوگل دادهٔ هسته را پاک نمی‌کند.</p>}</div>{connected ? <><button className="finance-action" onClick={() => disconnect(id)}>قطع اتصال</button>{id === 'google-calendar' && <button className="finance-action" onClick={syncCalendar}>همگام‌سازی</button>}</> : <a className="save" href={`/api/integrations/${id}/connect`}>اتصال</a>}<a className="finance-action" href={`/?page=${page}`}>بازکردن</a></article>; })}</section></div></main>;
}

function Market() {
  const [rows, setRows] = useState([]), [hist, setHist] = useState({}), [notice, setNotice] = useState('');
  useEffect(() => {
    api('/api/tgju').then(data => {
      const top = tgjuRows(data).slice(0, 5);
      setRows(top);
      Promise.all(top.map(item => api(`/api/tgju/history?key=${encodeURIComponent(item.key)}&days=30`).then(d => [item.key, (d.items || []).map(x => x.price)]).catch(() => [item.key, null])))
        .then(pairs => setHist(Object.fromEntries(pairs)));
    }).catch(error => setNotice(error.message));
  }, []);
  return <Card className="market" icon={LineChart} title="بازارها" action={<a href="/?page=market">همه بازارها ←</a>}>{rows.length ? rows.map(item => { const up = !item.change.includes('▼'); return <div className="market-row" key={item.key}><span className="market-icon">{marketIcon(item.key)}</span><span>{item.name}</span>{hist[item.key]?.length > 1 && <Sparkline data={hist[item.key]} up={up} uid={item.key} />}<b>{fa(item.p)}</b><small className={item.change.includes('▼') ? 'negative' : ''}>{item.change || '—'}</small></div>; }) : <p className="empty">{notice || 'در حال دریافت بازار…'}</p>}</Card>;
}
function Football() {
  const [matches, setMatches] = useState([]), [notice, setNotice] = useState('');
  useEffect(() => { api('/api/football/remote/free/matches?league=eng.1').then(data => setMatches((data.items || []).slice(0, 4))).catch(error => setNotice(error.message)); }, []);
  return <Card className="football" icon={Trophy} title="نتایج زنده فوتبال" action={<a href="/?page=football">همه مسابقات ←</a>}><div className="score-tabs"><b>لیگ برتر انگلیس</b></div>{matches.length ? matches.map((m, index) => <div className="score-row" key={m.id || index}><small className={m.status === 'live' ? 'live' : ''}>{m.status === 'live' ? '● زنده' : '●'}</small><span><TeamBadge logo={m.homeLogo} name={m.home} />{m.home}</span><b>{m.score || '—'}</b><span>{m.away}<TeamBadge logo={m.awayLogo} name={m.away} /></span></div>) : <p className="empty">{notice || 'مسابقه‌ای دریافت نشد.'}</p>}</Card>;
}
createRoot(document.getElementById('root')).render(<App />);
