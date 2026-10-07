import React, { useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import './today.css';
import './calendar.css';
import './planner.css';
// Page modules load on demand (React.lazy below); their CSS stays here so the cascade order is unchanged
// and mobile.css (imported last) still overrides it.
import './notes.css';
import './contacts.css';
import './documents.css';
import { PlannerReact, TaskDrawer, createPlannerItem, savePlannerItem } from './planner';
import './media.css';
import './market.css';
import './finance.css';
import './fun.css';
import './xcards.css';
import { photoOfDay } from './season-photos.mjs';
import { MarketLogo } from './market-logos';
import { PriceChart } from './pricechart';
import './home.css';
import './unify.css';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './vibefarsi-table';
import {
  House, CalendarDays, ListChecks, Wallet, LineChart, Trophy, Clapperboard, Film,
  Music, StickyNote, FolderOpen, Users, Settings, Bell, CheckSquare2, MapPin, Sparkles,
  Search, Star, X, Check, Moon, LayoutGrid, GripVertical, RotateCcw, Cake, ChevronDown, ChevronLeft, ChevronRight, CheckCircle2, ChevronsLeft, ChevronsRight, Trash2, Plus, Menu,
  Pencil, Repeat, CircleAlert, Hash, Clock, Sun, CircleDot, Flame, Compass, ClipboardCheck, Command, Download, Upload, Sparkle, Briefcase, HeartPulse, Car, Plane, BookOpen, GraduationCap, Languages, Library, Target, BookMarked, Newspaper, Timer, BarChart3, ShoppingCart, Receipt, ShieldCheck, LogOut, Dumbbell
} from 'lucide-react';
import { JalaliDateInput } from './jdate';
import './numgroup';
import './habits.css';
import './watchx.css';
import './insights.css';
import './logbook.css';
import './reading.css';
import './assistant.css';
import './exercise.css';
import './timelog.css';
import './admin.css';
import './courses.css';
import { InsightsHomeCard } from './insights-card';
import { CommandPalette, flushOutbox } from './palette';
import { api, isoToday, fa, faDigits, JALALI_MONTHS, WEEKDAYS, iso, fromIso, jdiv, jmod, jalCal, g2d, d2g, j2d, d2j, toJalali, toGregorian, jalaliMonthLength, addDays, sameDate, weekdayIndex, eventOnDate, eventLabel, seasonAiredCount, seasonTotalCount, seriesHasFresh, nextToWatch, watchLabel, waitingNewSeason, episodesWatchedCount, seriesAiredTotal, SERIES_TABS, seriesInTab, SHOW_STATUS_FA, readDataUrl, jalaliDayLabel } from './main-util';
import { MsgBar } from './msgbar';
import { VocabPage, VocabHomeCard } from './vocab';
import { useProjectDue, cardHref, PChip } from './pcards';
import './life.css';
import { FocusCard, ShoppingPanel, BillsWeekCard } from './life-cards';
import './mobile.css'; // phone/iPhone pass — keep last so it overrides page CSS

// Pages the Today screen doesn't need are split into their own chunks, so the first load stays small.
const PAGE_CHUNKS = {
  notes: () => import('./notes'), contacts: () => import('./contacts'), documents: () => import('./documents'),
  media: () => import('./media'), market: () => import('./market'), calendar: () => import('./calendar'),
  finance: () => import('./finance'), habits: () => import('./habits'), watchx: () => import('./watchx'), watch: () => import('./watch-pages'), exercise: () => import('./exercise'), timelog: () => import('./timelog'), admin: () => import('./admin'), courses: () => import('./courses'), insights: () => import('./insights'), life: () => import('./life'), logbook: () => import('./logbook'), reading: () => import('./reading')
};
const lazyPage = (chunk, name) => React.lazy(() => PAGE_CHUNKS[chunk]().then(m => ({ default: m[name] })));
const AdminPage = lazyPage('admin', 'AdminPage'), CoursesPage = lazyPage('courses', 'CoursesPage'), ClassTodayCardLazy = lazyPage('courses', 'ClassTodayCard');
const ExercisePage = lazyPage('exercise', 'ExercisePage'), TimeLogPage = lazyPage('timelog', 'TimeLogPage');
const SeriesReact = lazyPage('watch', 'SeriesReact'), MoviesReact = lazyPage('watch', 'MoviesReact');
const NotesReact = lazyPage('notes', 'NotesReact'), ContactsReact = lazyPage('contacts', 'ContactsReact'), DocumentsReact = lazyPage('documents', 'DocumentsReact');
const MediaReact = lazyPage('media', 'MediaReact'), MarketReact = lazyPage('market', 'MarketReact'), CalendarReact = lazyPage('calendar', 'CalendarReact');
const FinanceReact = lazyPage('finance', 'FinanceReact'), HabitsPage = lazyPage('habits', 'HabitsPage'), WeeklyPage = lazyPage('habits', 'WeeklyPage');
const [HealthPage, CarPage, TravelPage, ProjectsPage, CrmPage, LearningPage, JournalPage, GoalsPage, FocusPage, LifeStatsPage] =
  ['HealthPage', 'CarPage', 'TravelPage', 'ProjectsPage', 'CrmPage', 'LearningPage', 'JournalPage', 'GoalsPage', 'FocusPage', 'LifeStatsPage'].map(n => lazyPage('life', n));
const UpcomingPage = lazyPage('watchx', 'UpcomingPage'), DiscoverPage = lazyPage('watchx', 'DiscoverPage'), InsightsPage = lazyPage('insights', 'InsightsPage'), LogbookPage = lazyPage('logbook', 'LogbookPage'), ReadingPage = lazyPage('reading', 'ReadingPage');
// Warm the most-used chunks once the current page is idle (also fills the service-worker cache for offline use).
const prefetchPages = () => { for (const k of ['finance', 'calendar', 'notes', 'habits']) PAGE_CHUNKS[k]().catch(() => {}); };
function PageLoading() { return <div className="page-loading" role="status" aria-label="در حال بارگذاری"><i /></div>; }

const shortRial = n => { const a = Math.abs(Number(n) || 0), f = v => v.toLocaleString('fa-IR', { maximumFractionDigits: v >= 100 ? 0 : 1 }); return a >= 1e9 ? `${f(a / 1e9)} میلیارد ریال` : a >= 1e6 ? `${f(a / 1e6)} میلیون ریال` : `${fa(a)} ریال`; };
const jalali = date => { const p = Object.fromEntries(new Intl.DateTimeFormat('fa-IR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Asia/Tehran' }).formatToParts(date).map(x => [x.type, x.value])); return `${p.weekday} ${p.day} ${p.month} ${p.year}`; };
const TGJU_LABELS = {
  price_dollar_rl: 'دلار آزاد', price_eur: 'یورو', price_gbp: 'پوند', price_aed: 'درهم', price_try: 'لیر',
  geram18: 'گرم ۱۸ عیار', geram24: 'گرم ۲۴ عیار', sekee: 'سکه امامی', sekeb: 'سکه بهار آزادی',
  rob: 'ربع سکه', nim: 'نیم سکه', mesghal: 'مثقال', oil_brent: 'نفت برنت', oil: 'نفت',
  nickel: 'نیکل', platinum: 'پلاتین', copper: 'مس', silver: 'نقره', aluminium: 'آلومینیوم', aluminum: 'آلومینیوم'
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
    dp: value.dp != null ? Number(value.dp) : null,
    change: String(value.change ?? value.percent ?? '')
  }));
}
const nextDays = (date, count) => [...Array(count)].map((_, i) => new Date(date.getFullYear(), date.getMonth(), date.getDate() + i));

function Card({ title, icon: Icon, action, className = '', children }) { return <section className={`card ${className}`}><header>{Icon && <span className="card-icon"><Icon size={16} strokeWidth={2.2} /></span>}<h2>{title}</h2>{action}</header>{children}</section>; }
function TeamBadge({ logo, name }) { return logo ? <img className="team-logo" src={logo} alt="" loading="lazy" onError={e => { e.target.style.display = 'none'; }} /> : <span className="team-logo team-logo-fallback">{(name || '?').trim().charAt(0)}</span>; }
function Sparkline({ data, up, width = 72, height = 28, uid = 'sp', color: forced }) {
  if (!data || data.length < 2) return <svg width={width} height={height} />;
  const max = Math.max(...data), min = Math.min(...data), span = max - min || 1;
  const coords = data.map((v, i) => [(i / (data.length - 1)) * width, height - ((v - min) / span) * (height - 4) - 2]);
  const line = coords.map(([x, y]) => `${x},${y}`).join(' ');
  const area = `0,${height} ${line} ${width},${height}`;
  const color = forced || (up ? '#34d399' : '#fb7185'), gid = `fill-${uid}-${up ? 'u' : 'd'}`;
  return <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} className={up ? 'spark-up' : 'spark-down'} preserveAspectRatio="none">
    <defs><linearGradient id={gid} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={color} stopOpacity="0.35" /><stop offset="100%" stopColor={color} stopOpacity="0" /></linearGradient></defs>
    <polygon points={area} fill={`url(#${gid})`} />
    <polyline points={line} fill="none" stroke={color} strokeWidth="1.8" strokeLinejoin="round" strokeLinecap="round" />
  </svg>;
}

const NAV_GROUPS = [
  ['روزانه', [['', 'امروز', House], ['planner', 'برنامه‌ریز و تقویم', CalendarDays], ['insights', 'بینش', Sparkles], ['review', 'مرور و اهداف', Target]]],
  ['کار', [['projects', 'پروژه‌ها', LayoutGrid], ['courses', 'دوره‌ها و دانشجوها', GraduationCap], ['crm', 'مشتری و فروش', Briefcase]]],
  ['مالی', [['finance', 'مالی', Wallet], ['market', 'بازار', LineChart]]],
  ['زندگی', [['health', 'سلامت', HeartPulse], ['car', 'خودرو', Car], ['travel', 'سفر', Plane]]],
  ['سرگرمی', [['series', 'فیلم و سریال', Clapperboard], ['media', 'موسیقی و یوتیوب', Music], ['football', 'فوتبال', Trophy]]],
  ['یادگیری و آرشیو', [['learning', 'یادگیری و زبان', Library], ['notes', 'یادداشت و روزنگار', StickyNote], ['reading', 'خبر و خواندنی', Newspaper], ['documents', 'مدارک', FolderOpen], ['contacts', 'مخاطبین', Users]]]
];
// Phone-only bar at the bottom: the everyday pages within thumb reach; «همه» opens the full drawer.
const BOTTOM_TABS = [['', 'امروز', House], ['planner', 'برنامه', CalendarDays], ['finance', 'مالی', Wallet], ['notes', 'یادداشت', StickyNote], ['series', 'تماشا', Clapperboard]];
const NAV_PAGES = [...NAV_GROUPS.flatMap(([, items]) => items), ['settings', 'تنظیمات', Settings], ['admin', 'مدیریت', ShieldCheck]];
let ME_ONCE = null;
const meOnce = () => (ME_ONCE ||= api('/api/me').then(d => d.user || null).catch(() => null));
// Light/dark switch in the top bar of every page. Watches data-mode so the Ctrl+K «تغییر حالت» command updates the icon too.
function ThemeToggle() {
  const [, tick] = useState(0);
  useEffect(() => { const mo = new MutationObserver(() => tick(t => t + 1)); mo.observe(document.documentElement, { attributes: true, attributeFilter: ['data-mode'] }); return () => mo.disconnect(); }, []);
  const light = document.documentElement.dataset.mode === 'light';
  const flip = () => { const next = light ? 'dark' : 'light'; document.documentElement.dataset.mode = next; try { localStorage.setItem('lifeos-mode', next); } catch {} };
  return <button type="button" className="nav-theme" onClick={flip} aria-label={light ? 'حالت تاریک' : 'حالت روشن'} title={light ? 'حالت تاریک' : 'حالت روشن'}>{light ? <Moon size={17} /> : <Sun size={17} />}</button>;
}
function TopNav({ active, right }) {
  const [open, setOpen] = useState(false);
  const mods = useModules();
  const [admin, setAdmin] = useState(() => readLs('lifeos-is-admin', false));
  useEffect(() => { meOnce().then(u => { const a = !!u?.isAdmin; setAdmin(a); writeLs('lifeos-is-admin', a); }); }, []);
  const groups = NAV_GROUPS.map(([t, items]) => [t, items.filter(([pg]) => navOn(mods, pg))]).filter(([, items]) => items.length);
  useEffect(() => {
    document.body.classList.toggle('nav-lock', open);
    const onKey = e => { if (e.key === 'Escape') setOpen(false); };
    // While the drawer is open nothing may be text-selected: a stray selection (e.g. focus coming back from the
    // vocab iframe) painted every menu label with the gold ::selection colour.
    const clearSel = () => { try { window.getSelection()?.removeAllRanges(); } catch {} };
    const noSelect = e => e.preventDefault();
    if (open) { clearSel(); document.addEventListener('selectstart', noSelect); }
    window.addEventListener('keydown', onKey);
    return () => { document.body.classList.remove('nav-lock'); window.removeEventListener('keydown', onKey); document.removeEventListener('selectstart', noSelect); };
  }, [open]);
  const current = NAV_PAGES.find(([page]) => page === (active || '')) || NAV_PAGES[0];
  // Close the drawer (and its blurred scrim) first, then navigate on the next frames, so the page never
  // sits frozen behind an open, blurred menu while the next page loads. Same page = just close.
  const navFromDrawer = (e, page) => {
    if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    e.preventDefault();
    try { window.getSelection()?.removeAllRanges(); } catch {}
    setOpen(false);
    if (page === (active || '') && !location.search.includes('pid=')) return;
    const href = e.currentTarget.getAttribute('href');
    requestAnimationFrame(() => requestAnimationFrame(() => { location.href = href; }));
  };
  const link = ([page, label, Icon]) => <a className={page === (active || '') ? 'active' : ''} href={page ? `/?page=${page}` : '/'} key={page || 'home'} onClick={e => navFromDrawer(e, page)}><Icon size={17} strokeWidth={2.1} /><span>{label}</span></a>;
  const tabs = BOTTOM_TABS.filter(([pg]) => navOn(mods, pg)).slice(0, 4);
  return (<>
    <a className="skip-link" href="#main" onClick={e => { e.preventDefault(); const m = document.querySelector('main .planner-page, main, .lf-page, [role=main]'); if (m) { m.setAttribute('tabindex', '-1'); m.focus(); } }}>رفتن به محتوای اصلی</a>
    <nav className={`topbar${open ? ' menu-open' : ''}`}>
      <button type="button" className="nav-toggle" aria-label={open ? 'بستن منو' : 'بازکردن منو'} aria-expanded={open} onClick={() => setOpen(v => !v)}>
        {open ? <X size={20} /> : <Menu size={20} />}
      </button>
      <a className="brand" href="/" aria-label="LifeOS"><i className="brand-logo" aria-hidden="true" /><span>LifeOS</span></a>
      <span className="nav-current">{current[1]}</span>
      <span className="nav-spacer" />
      <button type="button" className="nav-search" onClick={() => window.dispatchEvent(new Event('lifeos:search'))} aria-label="جستجو (Ctrl+K)" title="جستجو — Ctrl+K"><Search size={17} /><span>جستجو</span><kbd>Ctrl K</kbd></button>
      <FocusChip />
      <ThemeToggle />
      {right}
      <CommandPalette pages={[...NAV_PAGES.filter(x => x[0] !== 'admin' || admin), ['habits', 'عادت‌ها'], ['exercise', 'ورزش'], ['time', 'زمان کار و تایمر'], ['week', 'مرور هفته'], ['goals', 'اهداف سالانه'], ['focus', 'تایمر تمرکز'], ['stats', 'آمار زندگی'], ['vocab', 'زبان'], ['journal', 'روزنگار'], ['logbook', 'دفتر و مرور (پیروزی‌ها، تصمیم‌ها)'], ['shopping', 'لیست خرید'], ['finance&tab=bills', 'قبض‌ها و اشتراک‌ها'], ['upcoming', 'تقویم پخش سریال‌ها'], ['discover', 'پیشنهاد تماشا']].filter(([pg]) => navOn(mods, pg))} />
      {open ? <button type="button" className="nav-scrim" aria-label="بستن منو" onClick={() => setOpen(false)} /> : null}
      <aside className={`drawer${open ? ' open' : ''}`} aria-hidden={!open}>
        <div className="drawer-head"><i className="brand-logo" aria-hidden="true" /><b>LifeOS</b></div>
        {groups.map(([title, items]) => <div className="drawer-group" key={title}><small>{title}</small>{items.map(link)}</div>)}
        <div className="drawer-foot">{admin ? link(['admin', 'مدیریت کاربران', ShieldCheck]) : null}{link(['settings', 'تنظیمات', Settings])}<button type="button" className="drawer-out" onClick={() => { if (window.confirm('از حساب خارج شوی؟')) signOut(); }}><LogOut size={17} strokeWidth={2.1} /><span>خروج از حساب</span></button></div>
      </aside>
    </nav>
    <nav className="bnav" aria-label="ناوبری سریع">
      {tabs.map(([page, label, Icon]) => <a key={page || 'home'} href={page ? `/?page=${page}` : '/'} className={page === (active || '') ? 'on' : ''} aria-current={page === (active || '') ? 'page' : undefined}><Icon size={21} strokeWidth={2} /><span>{label}</span></a>)}
      <button type="button" className={open ? 'on' : ''} onClick={() => setOpen(v => !v)} aria-expanded={open}><Menu size={21} strokeWidth={2} /><span>همه</span></button>
    </nav>
  </>);
}

// Planner + Calendar live in one place: same data, two ways of looking at it.
// Series + Movies in one place (like Planner + Calendar).
function WatchHub({ initial }) {
  const [view, setView] = useState(['movies', 'upcoming', 'discover'].includes(initial) ? initial : 'series');
  const go = v => { setView(v); try { history.replaceState(null, '', `/?page=${v}`); } catch {} window.scrollTo(0, 0); };
  const HubNav = () => <>
    <TopNav active="series" />
    <div className="hub-switch" role="tablist" aria-label="فیلم و سریال">
      <button type="button" role="tab" aria-selected={view === 'series'} className={view === 'series' ? 'on' : ''} onClick={() => go('series')}><Clapperboard size={16} />سریال‌ها</button>
      <button type="button" role="tab" aria-selected={view === 'movies'} className={view === 'movies' ? 'on' : ''} onClick={() => go('movies')}><Film size={16} />فیلم‌ها</button>
      <button type="button" role="tab" aria-selected={view === 'upcoming'} className={view === 'upcoming' ? 'on' : ''} onClick={() => go('upcoming')}><CalendarDays size={16} />تقویم پخش</button>
      <button type="button" role="tab" aria-selected={view === 'discover'} className={view === 'discover' ? 'on' : ''} onClick={() => go('discover')}><Sparkles size={16} />پیشنهاد</button>
    </div>
  </>;
  return view === 'movies' ? <MoviesReact Nav={HubNav} /> : view === 'upcoming' ? <UpcomingPage Nav={HubNav} /> : view === 'discover' ? <DiscoverPage Nav={HubNav} /> : <SeriesReact Nav={HubNav} />;
}

// One menu entry, several views of the same area: a tab strip under the top bar; the URL follows the tab.
// Tabs whose module is switched off are hidden; `url` maps a tab id to its ?page= value.
function TabHub({ active, label, tabs, initial, url = v => v }) {
  const mods = useModules();
  const shown = tabs.filter(([id]) => pageOn(mods, id));
  const [view, setView] = useState(() => (shown.find(([id]) => id === initial) || shown[0] || tabs[0])[0]);
  const go = v => { setView(v); try { history.replaceState(null, '', `/?page=${url(v)}`); } catch {} window.scrollTo(0, 0); };
  const HubNav = () => <>
    <TopNav active={active} />
    {shown.length > 1 ? <div className="hub-switch" role="tablist" aria-label={label}>
      {shown.map(([id, title, Icon]) => <button key={id} type="button" role="tab" aria-selected={view === id} className={view === id ? 'on' : ''} onClick={() => go(id)}><Icon size={16} />{title}</button>)}
    </div> : null}
  </>;
  const Page = (tabs.find(([id]) => id === view) || tabs[0])[3];
  return <Page Nav={HubNav} />;
}
const ShopView = ({ Nav }) => <main className="lf" dir="rtl"><Nav /><div className="lf-page"><ShoppingPanel /></div></main>;
const PLAN_TABS = [['list', 'لیست کارها', ListChecks, PlannerReact], ['calendar', 'تقویم', CalendarDays, CalendarReact], ['habits', 'عادت‌ها', Flame, HabitsPage], ['focus', 'تمرکز', Timer, FocusPage], ['time', 'زمان کار', Clock, TimeLogPage]];
const REVIEW_TABS = [['goals', 'اهداف سالانه', Target, GoalsPage], ['week', 'مرور هفته', ClipboardCheck, WeeklyPage], ['stats', 'آمار زندگی', BarChart3, LifeStatsPage], ['logbook', 'دفتر و مرور', BookMarked, LogbookPage]];
const HEALTH_TABS = [['health', 'سلامت', HeartPulse, HealthPage], ['exercise', 'ورزش', Dumbbell, ExercisePage]];
const LEARN_TABS = [['learning', 'کتاب و دوره', BookOpen, LearningPage], ['vocab', 'زبان', Languages, VocabPage]];
const NOTES_TABS = [['notes', 'یادداشت‌ها', StickyNote, NotesReact], ['journal', 'روزنگار', BookOpen, JournalPage], ['shopping', 'لیست خرید', ShoppingCart, ShopView]];

// Something was saved from Ctrl+K: re-mount the current page so it fetches its data again (lazy chunks are
// already loaded, so this is quick) — no full reload, the URL and tab stay as they are.
function App() {
  const [tick, setTick] = useState(0);
  useEffect(() => { const f = () => setTick(t => t + 1); window.addEventListener('lifeos:captured', f); return () => window.removeEventListener('lifeos:captured', f); }, []);
  return <Routes key={tick} />;
}

// Router first: other pages must not pay for the Today page's data fetching.
function Routes() {
  const page = new URLSearchParams(location.search).get('page');
  if (pageLocked(page)) return <><TopNav /><main className="locked-page" dir="rtl"><h1>🔒 این بخش بسته است</h1><p>مدیر سایت دسترسی حساب تو به این بخش را بسته است.</p><a href="/">بازگشت به امروز</a></main></>;
  if (['calendar', 'planner', 'habits', 'focus', 'time'].includes(page)) return <TabHub active="planner" label="نمای برنامه‌ریز" tabs={PLAN_TABS} initial={page === 'planner' ? 'list' : page} url={v => v === 'list' ? 'planner' : v} />;
  if (page === 'reading' || page === 'news' || page === 'bookmarks') return <ReadingPage Nav={() => <TopNav active="reading" />} />;
  if (page === 'insights') return <InsightsPage Nav={() => <TopNav active="insights" />} />;
  if (['review', 'goals', 'week', 'stats', 'logbook'].includes(page)) return <TabHub active="review" label="مرور و اهداف" tabs={REVIEW_TABS} initial={page} />;
  if (['health', 'exercise'].includes(page)) return <TabHub active="health" label="سلامت" tabs={HEALTH_TABS} initial={page} />;
  if (['learning', 'vocab'].includes(page)) return <TabHub active="learning" label="یادگیری" tabs={LEARN_TABS} initial={page} />;
  if (['notes', 'journal', 'shopping'].includes(page)) return <TabHub active="notes" label="یادداشت‌ها" tabs={NOTES_TABS} initial={page} />;
  const LIFE = { courses: CoursesPage, health: HealthPage, car: CarPage, travel: TravelPage, projects: ProjectsPage, crm: CrmPage };
  if (LIFE[page]) { const P = LIFE[page]; return <P Nav={() => <TopNav active={page} />} />; }
  if (page === 'finance') return <FinanceReact Nav={TopNav} />;
  if (page === 'market') return <MarketReact Nav={TopNav} />;
  if (page === 'football') return <FootballPage />;
  if (['movies', 'series', 'upcoming', 'discover'].includes(page)) return <WatchHub initial={page} />;
  if (page === 'media' || page === 'music' || page === 'youtube') return <MediaReact Nav={TopNav} initialTab={page === 'youtube' ? 'youtube' : page === 'music' ? 'spotify' : 'desk'} />;
  if (page === 'documents') return <DocumentsReact Nav={TopNav} />;
  if (page === 'contacts') return <ContactsReact Nav={TopNav} />;
  if (page === 'settings') return <SettingsReact />;
  if (page === 'admin') return <AdminPage Nav={() => <TopNav active="admin" />} />;
  return <HomePage />;
}
function HomePage() {
  const mods = useModules();
  const today = useMemo(isoToday, []);
  const [data, setData] = useState({ tasks: [], reminders: [], transactions: [], daily: null, user: null, watchingSeries: [] });
  const [weather, setWeather] = useState(null);
  const [quick, setQuick] = useState({ type: 'task', title: '', amount: '', when: 'today', date: '', time: '' });
  const [pickerOpen, setPickerOpen] = useState(false);
  const whenRef = React.useRef(null);
  const heroRef = React.useRef(null);
  useEffect(() => {
    const fit = () => { const bar = document.querySelector('.topbar'), el = heroRef.current; if (!bar || !el) return; const zoom = parseFloat(getComputedStyle(document.body).zoom) || 1; el.style.top = `${Math.round(bar.getBoundingClientRect().height / zoom)}px`; };
    fit(); window.addEventListener('resize', fit); const t = setTimeout(fit, 300);
    return () => { window.removeEventListener('resize', fit); clearTimeout(t); };
  }, []);
  const [usd, setUsd] = useState(null);
  const [holidayNext, setHolidayNext] = useState(null);
  useEffect(() => {
    api('/api/tgju').then(d => { const v = (d.items || {}).price_dollar_rl; if (v) setUsd({ p: v.p, dp: v.dp }); }).catch(() => {});
    loadIranEvents().then(ev => {
      for (let i = 1; i <= 200; i++) { const dt = addDays(fromIso(today), i), j = toJalali(dt), h = (ev[jKey(j.jy, j.jm, j.jd)] || []).find(e => e.h); if (h) { setHolidayNext({ days: i, title: h.t.replace(/\[.*?\]/g, '').trim(), label: `${faDigits(j.jd)} ${JALALI_MONTHS[j.jm - 1]}` }); break; } }
    });
  }, []);
  const [drawerKind, setDrawerKind] = useState(null);
  const [editItem, setEditItem] = useState(null);
  const [layoutEdit, setLayoutEdit] = useState(false);
  const [notice, setNotice] = useState('');
  const [streak, setStreak] = useState(0);
  const [aqi, setAqi] = useState(null);
  const [feed, setFeed] = useState([]);
  const [scheduleNote, setScheduleNote] = useState('');

  const load = async () => {
    try {
      const [me, dashboard, tasks, reminders] = await Promise.all([
        api('/api/me'), api(`/api/dashboard?date=${today}`), api('/api/tasks'), api(`/api/reminders?from=${addDaysIso(today, -30)}&to=${addDaysIso(today, 7)}`)
      ]);
      setData({ ...dashboard, tasks: tasks.items || [], reminders: reminders.items || [], user: me.user || null });
    } catch (error) { setNotice(error.message); }
  };
  useEffect(() => { load(); }, []);
  const loadStreak = () => {
    const from = new Date(); from.setDate(from.getDate() - 60);
    api(`/api/daily?from=${from.toISOString().slice(0, 10)}&to=${today}`).then(d => {
      const dates = new Set((d.items || []).map(x => x.date));
      let n = 0, cur = new Date(today + 'T12:00:00');
      while (dates.has(cur.toISOString().slice(0, 10))) { n++; cur.setDate(cur.getDate() - 1); }
      setStreak(n);
    }).catch(() => {});
  };
  useEffect(loadStreak, [today]);
  const [city, setCity] = useState(() => readLs('lifeos-weather-city', DEFAULT_CITY));
  useEffect(() => {
    setWeather(null); setAqi(null);
    const q = `latitude=${city.lat}&longitude=${city.lon}&timezone=auto`;
    fetch(`https://api.open-meteo.com/v1/forecast?${q}&current=temperature_2m,apparent_temperature,relative_humidity_2m,weather_code,wind_speed_10m,is_day,uv_index&hourly=temperature_2m,weather_code,is_day&daily=temperature_2m_max,temperature_2m_min,weather_code,sunrise,sunset,uv_index_max,precipitation_probability_max&forecast_days=6`)
      .then(r => r.json()).then(w => { if (w?.current) setWeather(w); }).catch(() => {});
    fetch(`https://air-quality-api.open-meteo.com/v1/air-quality?${q}&current=us_aqi,pm2_5`)
      .then(r => r.json()).then(a => { if (a?.current) setAqi(a.current); }).catch(() => {});
  }, [city.lat, city.lon]);
  const changeCity = c => { writeLs('lifeos-weather-city', c); setCity(c); };
  useEffect(() => {
    api(`/api/calendar/feed?from=${today}&to=${today}`).then(d => { setFeed(d.items || []); if (d.googleError) setScheduleNote(d.googleError); }).catch(() => {});
  }, []);
  const [dueDebts, setDueDebts] = useState([]);
  useEffect(() => { api('/api/debts').then(d => { const lim = addDaysIso(isoToday(), 7); setDueDebts((d.items || []).filter(x => x.dueDate && x.dueDate <= lim)); }).catch(() => {}); }, []);
  const [dueFees, setDueFees] = useState([]);
  useEffect(() => { if (modOn(mods, 'courses')) api('/api/courses/due?days=7').then(d => setDueFees(d.items || [])).catch(() => {}); }, []);
  const pDue = useProjectDue(modOn(mods, 'projects'));
  const [ticked, setTicked] = useState(() => { const t = readLs('lifeos-ticked', null); return t && t.date === isoToday() ? t.ids : []; });
  const markTicked = id => setTicked(ids => { const next = ids.includes(id) ? ids : [...ids, id]; writeLs('lifeos-ticked', { date: isoToday(), ids: next }); return next; });
  const toggleTask = async task => { markTicked('t' + task.id); await api(`/api/tasks/${task.id}`, { method: 'PATCH', body: JSON.stringify({ done: !task.done }) }); load(); };
  const toggleReminder = async reminder => { markTicked('r' + reminder.id); await api(`/api/reminders/${reminder.id}`, { method: 'PATCH', body: JSON.stringify({ done: !reminder.done }) }); load(); };
  const quickDate = () => quick.when === 'tomorrow' ? addDaysIso(today, 1) : quick.when === 'pick' && quick.date ? quick.date : today;
  const submitQuick = async event => {
    event.preventDefault(); if (!quick.title.trim()) return;
    let title = quick.title.trim(), date = quickDate();
    const m = title.match(/^(پس[\s\u200c]?فردا|فردا|امروز)[\s،,:]+(.+)$/);
    if (m) { date = m[1] === 'امروز' ? today : addDaysIso(today, m[1] === 'فردا' ? 1 : 2); title = m[2].trim(); }
    const time = quick.time || null;
    const payload = quick.type === 'transaction'
      ? { title, amount: Number(String(quick.amount).replace(/[۰-۹]/g, d => '۰۱۲۳۴۵۶۷۸۹'.indexOf(d)).replace(/[^\d]/g, '')), kind: 'expense', category: 'متفرقه', account: 'بدون حساب', date }
      : quick.type === 'reminder' ? { title, date, time, whenLabel: date } : { title, date, startTime: time, priority: 'medium' };
    const endpoint = quick.type === 'transaction' ? '/api/transactions' : quick.type === 'reminder' ? '/api/reminders' : '/api/tasks';
    try {
      await api(endpoint, { method: 'POST', body: JSON.stringify(payload) });
      setQuick(q => ({ ...q, title: '', amount: '', time: '' }));
      setNotice(date === today ? 'با موفقیت ثبت شد.' : `برای ${jalaliDayLabel(date)} ثبت شد.`); load();
    } catch (error) { setNotice(error.message); }
  };
  const openEdit = item => {
    const r = item.raw;
    if (item.kind === 'task') { setEditItem({ kind: 'task', initial: { task: r, reminder: (data.reminders || []).find(x => x.taskId === r.id) || null } }); return; }
    const linked = r.taskId && (allTasks || []).find(t => t.id === r.taskId);
    if (linked) { setEditItem({ kind: 'task', initial: { task: linked, reminder: r } }); return; }
    setEditItem({ kind: 'reminder', initial: { task: { id: r.id, title: r.title, notes: '', date: r.date, startTime: r.time || '', priority: 'medium', recurrence: r.recurrence || null, leadMinutes: r.leadMinutes || 0, tags: [], done: !!r.done, _reminder: true }, reminder: null } });
  };
  const toggleMit = async task => {
    const on = task.mit === today;
    if (!on && mitList.length >= 3) { setNotice('فقط سه کار مهم برای هر روز — اول یکی را بردار.'); return; }
    try { await api(`/api/tasks/${task.id}`, { method: 'PATCH', body: JSON.stringify({ mit: on ? '' : today }) }); load(); } catch (error) { setNotice(error.message); }
  };
  const saveEdit = async body => { try { await savePlannerItem(editItem.kind, body, editItem.initial); setEditItem(null); setNotice('تغییرات ذخیره شد ✓'); load(); } catch (error) { setNotice(error.message); } };
  const saveDrawer = async body => { try { await createPlannerItem(drawerKind, body); setDrawerKind(null); setNotice('ثبت شد ✓'); load(); } catch (error) { setNotice(error.message); } };
  const saveDaily = async event => { event.preventDefault(); const form = new FormData(event.currentTarget); try { await api('/api/daily', { method: 'PUT', body: JSON.stringify({ date: today, mood: Number(form.get('mood')), sleep: form.get('sleep'), note: form.get('note'), bestMoment: form.get('bestMoment'), gratitude: form.get('gratitude'), tomorrowPlan: data.daily?.tomorrowPlan || '' }) }); setNotice('ثبت روزانه ذخیره شد.'); loadStreak(); load(); } catch (error) { setNotice(error.message); } };
  const allTasks = data.tasks.filter(t => !t.isReminder);
  const mitList = allTasks.filter(t => t.mit === today);
  const tasks = allTasks
    .filter(t => t.date === today || !t.done || ticked.includes('t' + t.id))
    .sort((a, b) => (a.done - b.done) || String(a.date).localeCompare(String(b.date)) || String(a.startTime || '').localeCompare(String(b.startTime || '')));
  const overdueTasks = [...allTasks.filter(t => !t.done && t.deadline && t.deadline < today), ...pDue.items.filter(c => !c._done && c.due < today)];
  const tomorrowIso = useMemo(() => { const d = new Date(today + 'T12:00:00'); d.setDate(d.getDate() + 1); return d.toISOString().slice(0, 10); }, [today]);
  const dueTomorrowTasks = allTasks.filter(t => !t.done && t.deadline === tomorrowIso);
  const todaySpend = data.transactions.filter(t => t.kind === 'expense').reduce((n, t) => n + (Number(t.amount) || 0), 0);
  const done = tasks.filter(t => t.done).length;
  const nowHm = new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Asia/Tehran' }).format(new Date());
  const agenda = [
    ...tasks.map(t => ({ kind: 'task', id: t.id, title: t.title, done: !!t.done, time: t.startTime || '', date: (t.deadline && t.deadline < (t.date || today)) ? t.deadline : (t.date || ''), raw: t })),
    ...data.reminders.filter((r, index, rows) => {
      if (!(r.date === today || !r.done || ticked.includes('r' + r.id))) return false;
      // Older versions could create the same automatic project reminder more
      // than once before its id was saved on the project step.
      if (!String(r.title || '').startsWith('یادآوری پروژهٔ ')) return true;
      const key = `${r.title}|${r.date || ''}|${r.time || ''}`;
      return rows.findIndex(x => `${x.title}|${x.date || ''}|${x.time || ''}` === key) === index;
    }).map(r => ({ kind: 'reminder', id: r.id, title: r.title, done: !!r.done, time: r.time || '', date: r.date || today, raw: r })),
    ...pDue.items.map(c => ({ kind: 'task', pcard: true, id: 'pc' + c.id, title: c.title, done: !!c._done, time: '', date: c.due, raw: c })),
    ...dueFees.map(x => ({ kind: 'reminder', debt: true, href: '/?page=courses', id: 'fee' + x.id, title: `🎓 شهریهٔ ${x.name}${x.course ? ' · ' + x.course : ''} · ${shortRial(x.remaining)}`, done: false, time: '', date: x.dueDate, raw: x })),
    ...dueDebts.map(x => ({ kind: 'reminder', debt: true, id: 'debt' + x.id, title: `${x.type === 'payable' ? 'سررسید بدهی به' : 'سررسید طلب از'} ${x.person} · ${x.currency === 'USD' ? fa(x.amount) + ' دلار' : shortRial(x.amount)}`, done: false, time: '', date: x.dueDate, raw: x }))
  ].map(x => ({ ...x, late: !x.done && !!x.date && x.date < today }))
    .map(x => ({ ...x, rank: x.late ? 0 : x.date === today ? 1 : x.date ? 2 : 3 }))
    .sort((a, b) => (a.done - b.done) || (a.rank - b.rank) || String(a.date || '').localeCompare(String(b.date || '')) || String(a.time || '99').localeCompare(String(b.time || '99')));
  const agendaTasks = agenda.filter(x => x.kind === 'task'), agendaRems = agenda.filter(x => x.kind === 'reminder');
  const nextRem = agendaRems.find(x => !x.done && x.date === today && x.time && x.time >= nowHm);
  const lateLabel = date => { const days = Math.round((fromIso(today) - fromIso(date)) / 86400000); return days === 1 ? 'دیروز' : `${fa(days)} روز عقب`; };
  const schedule = feed.filter(ev => eventOnDate(ev, fromIso(today)) && (ev.source !== 'lifeos' || ev.time)).sort((a, b) => String(a.time || '').localeCompare(String(b.time || '')));
  void scheduleNote;
  const weatherIcon = code => code === 0 ? '☀️' : code < 4 ? '⛅' : code < 70 ? '☁️' : '🌧️';
  const nowHour = Number(new Intl.DateTimeFormat('en-GB', { hour: 'numeric', hour12: false, timeZone: 'Asia/Tehran' }).format(new Date()));
  const greeting = nowHour < 5 ? 'شب بخیر' : nowHour < 12 ? 'صبح بخیر' : nowHour < 16 ? 'ظهر بخیر' : nowHour < 19 ? 'عصر بخیر' : 'شب بخیر';
  const firstName = (data.user?.displayName || '').trim() || (data.user?.name || '').trim().split(/\s+/)[0];
  const todayJ = toJalali(fromIso(today));
  const todayAgenda = agenda.filter(x => x.date === today || x.late);
  const openCount = todayAgenda.filter(x => !x.done).length;
  const nextEvent = schedule.find(x => x.time && x.time >= nowHm);
  const nextAny = [nextRem, nextEvent].filter(Boolean).sort((a, b) => a.time.localeCompare(b.time))[0];
  const summary = [
    todayAgenda.length ? `امروز ${fa(todayAgenda.length)} کار و یادآوری داری و ${fa(todayAgenda.length - openCount)} تا رو انجام دادی.` : 'برای امروز هنوز کاری ثبت نکردی.',
    overdueTasks.length ? `${fa(overdueTasks.length)} کار عقب‌افتاده منتظرته.` : '',
    nextAny ? `بعدی: ${nextAny.title}، ساعت ${faDigits(nextAny.time)}.` : ''
  ].filter(Boolean).join(' ');
  return <main>
    <TopNav active="" right={<div className="profile"><b>{data.user?.displayName || data.user?.name || 'سلام'}</b></div>} />
    <div className="page home">
      <section className="hero bar" ref={heroRef}>
        <DigitalClock compact />
        <form className="quick" onSubmit={submitQuick}>
          <button type="submit" className="save">＋ ثبت</button>
          <input className="quick-title" value={quick.title} onChange={e => setQuick({ ...quick, title: e.target.value })} placeholder={quick.type === 'transaction' ? 'برای چی خرج کردی؟' : quick.type === 'reminder' ? 'چی رو یادت بندازم؟' : 'چه کاری باید انجام بدی؟'} />
          {quick.type === 'transaction' && <label className="amount-wrap"><input className="amount" value={quick.amount ? Number(String(quick.amount).replace(/[^\d]/g, '') || 0).toLocaleString('fa-IR') : ''} onChange={e => setQuick({ ...quick, amount: e.target.value.replace(/[۰-۹]/g, x => '۰۱۲۳۴۵۶۷۸۹'.indexOf(x)).replace(/[^\d]/g, '') })} inputMode="numeric" placeholder="مبلغ" aria-label="مبلغ به ریال" /><span>ریال</span></label>}
          {quick.type !== 'transaction' && <TimePicker value={quick.time} onChange={t => setQuick(q => ({ ...q, time: t }))} />}
          <div className="quick-when" ref={whenRef}>
            {[['today', 'امروز'], ['tomorrow', 'فردا']].map(([w, label]) => <button type="button" key={w} className={quick.when === w ? 'selected' : ''} onClick={() => { setQuick({ ...quick, when: w }); setPickerOpen(false); }}>{label}</button>)}
            <button type="button" className={quick.when === 'pick' ? 'selected' : ''} onClick={() => setPickerOpen(o => !o)}><CalendarDays size={14} />{quick.when === 'pick' && quick.date ? jalaliDayLabel(quick.date) : 'روز دیگر'}</button>
            {pickerOpen && <JalaliPicker anchor={whenRef} value={quick.date || today} today={today} onPick={d => { setQuick({ ...quick, when: 'pick', date: d }); setPickerOpen(false); }} onClose={() => setPickerOpen(false)} />}
          </div>
          <div className="quick-tabs">{[['task','کار',CheckSquare2],['reminder','یادآوری',Bell],['transaction','هزینه',Wallet]].map(([type, label, Icon]) => <button type="button" className={quick.type === type ? 'selected' : ''} onClick={() => setQuick({ ...quick, type })} key={type}><Icon size={14} />{label}</button>)}</div>
        </form>
      </section>
      {notice && <div className="notice">{notice}<button onClick={() => setNotice('')}>×</button></div>}
      <Layout id="top" className="grid home-top" editing={layoutEdit} cards={{
        day: (<DayCard today={today} greeting={`${greeting}${firstName ? `، ${firstName}` : ''}`} summary={summary} streak={streak} />),
        weather: (<WeatherCard weather={weather} aqi={aqi} city={city} onCity={changeCity} />),
        calendar: (<LiveCalendar today={today} />),
        ...(modOn(mods, 'market') ? { market: (<Market />) } : modOn(mods, 'finance') ? { goals: (<GoalsMini />) } : modOn(mods, 'habits') ? { habits: (<HabitsMini />) } : {})
      }} />
      {modOn(mods, 'courses') ? <React.Suspense fallback={null}><ClassTodayCardLazy /></React.Suspense> : null}
      <Layout id="grid" className="grid home-grid" editing={layoutEdit} cards={{
        agenda: (<Card className="agenda" icon={CheckSquare2} title="کارها و یادآوری‌ها" action={<a href="/?page=planner">برنامه‌ریز ←</a>}>
          <div className={`ag-mit ${mitList.length ? '' : 'empty'}`}>
            <div className="ag-mit-head"><b>⭐ سه کار مهم امروز</b><span className="muted">{mitList.length ? `${fa(mitList.filter(t => t.done).length)} از ${fa(mitList.length)} انجام شد` : 'روی ☆ کنار هر کار بزن'}</span></div>
            {mitList.length ? <div className="ag-mit-list">{mitList.map(t => <button type="button" key={t.id} className={t.done ? 'done' : ''} onClick={() => toggleTask(t)}><i>{t.done ? '✓' : ''}</i><span>{t.title}</span></button>)}</div> : null}
          </div>
          {[['task', 'کارها', agendaTasks, CheckSquare2], ['reminder', 'یادآوری‌ها', agendaRems, Bell]].map(([kind, label, items, Icon]) => {
            const doneN = items.filter(x => x.done).length;
            return <div className={`ag-sec ag-${kind}`} key={kind}>
              <div className="ag-head"><Icon size={14} /><b>{label}</b><span className="muted">{fa(doneN)} از {fa(items.length)}</span><button type="button" className="ag-add" onClick={() => setDrawerKind(kind)} aria-label={`افزودن ${label}`}><Plus size={14} /></button></div>
              <div className="progress"><i style={{ width: `${items.length ? doneN / items.length * 100 : 0}%` }} /></div>
              <div className="list">{items.map(item => {
                const late = !item.done && item.late;
                const later = item.date && item.date > today, tmr = item.date === addDaysIso(today, 1);
                const when = late ? `⛔ ${lateLabel(item.date)}` : later ? `${tmr ? 'فردا' : jalaliDayLabel(item.date)}${item.time ? ' · ' + faDigits(item.time) : ''}` : item.time ? faDigits(item.time) : !item.date ? 'بی‌تاریخ' : 'امروز';
                return <div className="ag-row" key={item.kind + item.id}><button className={`line ${item.debt ? 'debt' : ''} ${item.done ? 'done' : ''} ${late ? 'overdue' : ''} ${later ? 'later' : ''} ${item.kind}`} onClick={() => item.debt ? (location.href = item.href || '/?page=finance&tab=wealth') : item.pcard ? pDue.done(item.raw) : item.kind === 'task' ? toggleTask(item.raw) : toggleReminder(item.raw)}>
                  <i>{item.debt ? '⏰' : item.done ? '✓' : ''}</i><span>{item.pcard ? <><PChip c={item.raw} />{item.raw.prio === 'h' ? <em className="pc-hi">!</em> : null}</> : null}{item.title}</span><small>{when}</small>
                </button>{item.kind === 'task' && !item.debt && !item.pcard ? <button type="button" className={`ag-star ${item.raw.mit === today ? 'on' : ''}`} onClick={() => toggleMit(item.raw)} aria-label={item.raw.mit === today ? 'حذف از سه کار مهم' : 'افزودن به سه کار مهم'} title="سه کار مهم امروز">{item.raw.mit === today ? '★' : '☆'}</button> : null}{item.debt ? null : <button type="button" className="ag-edit" onClick={() => item.pcard ? (location.href = cardHref(item.raw)) : openEdit(item)} aria-label={`ویرایش ${item.title}`} title="ویرایش"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 20h9" /><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" /></svg></button>}</div>;
              })}{!items.length && <p className="empty">{kind === 'task' ? 'کاری برای امروز نداری.' : 'یادآوری‌ای برای امروز نداری.'}</p>}</div>
            </div>;
          })}
        </Card>),
        ...(modOn(mods, 'football') ? { football: (<Football />) } : (!modOn(mods, 'market') && !modOn(mods, 'finance')) ? {} : modOn(mods, 'habits') ? { habits: (<HabitsMini />) } : {}),
        ...(modOn(mods, 'watch') ? { series: (<SeriesCard />) } : modOn(mods, 'notes') ? { notes: (<NotesMini />) } : {}),
        focus: (<FocusCard Card={Card} Icon={Timer} />),
        ...(modOn(mods, 'vocab') ? { vocab: (<VocabHomeCard Card={Card} Icon={Languages} />) } : {}),
        ...(modOn(mods, 'finance') ? { bills: (<BillsWeekCard Card={Card} Icon={Receipt} />) } : {}),
        insights: (<InsightsHomeCard Card={Card} Icon={Sparkles} />),
      }} />
      <div className={`home-layout-bar ${layoutEdit ? 'on' : ''}`}>
        {layoutEdit ? <><span>کارت‌ها را با موس بکش و جای دیگری رها کن (یا با فلش‌ها جابه‌جا کن) — ترتیب ذخیره می‌شود.</span><button type="button" className="outline" onClick={() => { resetLayouts(); }}>پیش‌فرض</button><button type="button" className="save" onClick={() => setLayoutEdit(false)}>تمام</button></>
          : <button type="button" className="home-layout-btn" onClick={() => { setLayoutEdit(true); window.scrollTo({ top: 0, behavior: 'smooth' }); }}>✥ چیدمان کارت‌ها</button>}
      </div>
    </div>
    <TaskDrawer open={!!drawerKind} kind={drawerKind || 'task'} initial={null} onClose={() => setDrawerKind(null)} onSubmit={saveDrawer} />
    <TaskDrawer open={!!editItem} kind={editItem?.kind || 'task'} initial={editItem?.initial || null} onClose={() => setEditItem(null)} onSubmit={saveEdit} />
    <ModulesOnboarding />
  </main>;
}
function Calendar() {
  const now = new Date(), j = toJalali(now), first = toGregorian(j.jy, j.jm, 1), len = jalaliMonthLength(j.jy, j.jm);
  const days = [...Array(len)].map((_, i) => addDays(first, i));
  return <Card className="calendar" icon={CalendarDays} title={`${JALALI_MONTHS[j.jm - 1]} ${faDigits(j.jy)}`} action={<a href="/?page=calendar">امروز</a>}><div className="weekdays">{WEEKDAYS.map(x => <span key={x}>{x}</span>)}</div><div className="calendar-days">{[...Array(weekdayIndex(first))].map((_, i) => <span key={`blank${i}`} />)}{days.map((day, i) => <b className={sameDate(day, now) ? 'today' : weekdayIndex(day) === 6 ? 'holiday' : ''} key={i}>{faDigits(i + 1)}</b>)}</div></Card>;
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
  return <main className="planner-react records-react" dir="rtl"><TopNav active={kind} /><div className="planner-page"><header><div><p>داده‌های واقعی LifeOS</p><h1>{config.title}</h1></div>{kind === 'notes' && <button className="finance-action" onClick={() => setShowArchived(x => !x)}>{showArchived ? 'فقط فعال‌ها' : 'نمایش بایگانی'}</button>}</header>{notice && <div className="notice">{notice}<button onClick={() => setNotice('')}>×</button></div>}<div className="planner-layout"><form className="planner-form" onSubmit={save}><h2>{editing ? 'ویرایش' : 'افزودن'}</h2><input name="title" required placeholder={kind === 'contacts' ? 'نام مخاطب' : 'عنوان'} defaultValue={editing ? titleValue(editing) : ''} key={`title-${editing?.id || 'new'}`} />{kind === 'contacts' && <><div><select name="relationship" defaultValue={editing?.relationship || 'friend'}><option value="family">خانواده</option><option value="friend">دوست</option><option value="work">کاری</option><option value="other">سایر</option></select><input name="phone" placeholder="تلفن" defaultValue={editing?.phone || ''} /></div><input name="email" type="email" placeholder="ایمیل" defaultValue={editing?.email || ''} /><div><JalaliDateInput name="birthday" defaultValue={editing?.birthday || ''} /><JalaliDateInput name="followUpDate" defaultValue={editing?.followUpDate || ''} /></div></>}{kind === 'documents' && <><input name="type" placeholder="نوع سند" defaultValue={editing?.type || ''} /><JalaliDateInput name="expiryDate" defaultValue={editing?.expiryDate || ''} /></>}{kind === 'notes' && <><input name="tags" placeholder="تگ‌ها، با ویرگول جدا" defaultValue={(editing?.tags || []).join(', ')} /><select name="color" defaultValue={editing?.color || 'cyan'}><option value="cyan">آبی</option><option value="violet">بنفش</option><option value="rose">صورتی</option><option value="amber">کهربایی</option><option value="green">سبز</option></select><label><input name="pinned" type="checkbox" defaultChecked={editing?.pinned} /> سنجاق شود</label></>}<textarea name="text" placeholder="توضیحات" defaultValue={editing?.text || editing?.notes || ''} key={`text-${editing?.id || 'new'}`} /><button className="save">{editing ? 'ذخیرهٔ تغییرات' : 'ذخیره'}</button>{editing && <button type="button" className="finance-action" onClick={() => setEditing(null)}>انصراف</button>}</form><section className="planner-list"><h2>فهرست</h2>{items.length ? items.map(item => <article key={item.id}><div><b>{titleValue(item)}</b><small>{kind === 'contacts' ? [item.relationship, item.phone, item.email, item.followUpDate && `پیگیری ${item.followUpDate}`].filter(Boolean).join(' · ') : kind === 'documents' ? [item.type, item.expiryDate && `انقضا ${item.expiryDate}`].filter(Boolean).join(' · ') : [item.noteDate?.slice(0, 10), ...(item.tags || []).map(tag => `#${tag}`)].filter(Boolean).join(' · ')}</small>{(item.text || item.notes) && <p>{item.text || item.notes}</p>}{kind === 'documents' && item.fileUrl && <a href={item.fileUrl} target="_blank" rel="noreferrer">بازکردن پیوست</a>}</div><div className="record-actions"><button className="finance-action" onClick={() => setEditing(item)}>ویرایش</button>{kind === 'notes' && <><button className="finance-action" onClick={() => convert(item, 'task')}>کار</button><button className="finance-action" onClick={() => convert(item, 'reminder')}>یادآور</button></>}<button className="planner-delete" onClick={() => remove(item)} aria-label={`حذف ${titleValue(item)}`}>×</button></div></article>) : <p className="empty">موردی برای نمایش نیست.</p>}</section></div></div></main>;
}

const DIGEST_HOURS = Array.from({ length: 24 }, (_, h) => h);

// ---- appearance: font family + text size (saved per browser) ----
const APP_FONTS = [['vazirmatn', 'وزیرمتن', "'Vazirmatn'"], ['estedad', 'استعداد', "'Estedad'"], ['shabnam', 'شبنم', "'Shabnam'"], ['samim', 'صمیم', "'Samim'"]];
const APP_SIZES = [['s', 'کوچک', 0.94], ['m', 'متوسط', 1], ['l', 'بزرگ', 1.1], ['xl', 'خیلی بزرگ', 1.2]];
const APPEARANCE_DEFAULT = { font: 'vazirmatn', size: 'l' };
function applyAppearance(a) {
  const font = APP_FONTS.find(f => f[0] === a?.font) || APP_FONTS[0], size = APP_SIZES.find(x => x[0] === a?.size) || APP_SIZES[2];
  const root = document.documentElement;
  root.style.setProperty('--app-font', `${font[2]}, 'Vazirmatn', Tahoma, sans-serif`);
  root.style.setProperty('--app-zoom', String(size[2]));
  root.dataset.font = font[0];
}
function AppearanceSettings({ flash }) {
  const [a, setA] = useState(() => ({ ...APPEARANCE_DEFAULT, ...readLs('lifeos-appearance', {}) }));
  const set = patch => { const next = { ...a, ...patch }; setA(next); writeLs('lifeos-appearance', next); applyAppearance(next); flash('ظاهر ذخیره شد ✓'); };
  return <>
    <article>
      <div><b>فونت</b><small>روی همهٔ صفحه‌ها اعمال می‌شه. پیش‌فرض: وزیرمتن.</small></div>
      <div className="hs-choices">{APP_FONTS.map(([id, label, fam]) => <button type="button" key={id} className={a.font === id ? 'on' : ''} style={{ fontFamily: fam }} onClick={() => set({ font: id })}>{label}<small>۱۲۳ امروز</small></button>)}</div>
    </article>
    <article>
      <div><b>اندازهٔ متن</b><small>پیش‌فرض: بزرگ.</small></div>
      <div className="hs-choices">{APP_SIZES.map(([id, label, z]) => <button type="button" key={id} className={a.size === id ? 'on' : ''} onClick={() => set({ size: id })}><span style={{ fontSize: `${Math.round(15 * z)}px` }}>{label}</span></button>)}</div>
    </article>
    <article>
      <div><b>ساعت کشورهای دیگه</b><small>هر شهر یا کشوری را جستجو کن — حداکثر سه ساعت کنار ساعت تهران. روی ساعت انتخاب‌شده بزن تا حذف شود.</small></div>
      <WorldClockPicker flash={flash} />
    </article>
  </>;
}
const clockName = e => { const [tz, label] = String(e).split('|'); return label || (WORLD_ZONES.find(([, z]) => z === tz) || [])[0] || tz.split('/').pop().replace(/_/g, ' '); };
const zoneOk = tz => { try { new Intl.DateTimeFormat('en', { timeZone: tz }).format(); return true; } catch { return false; } };
const ALL_ZONES = (() => { try { return Intl.supportedValuesOf('timeZone'); } catch { return WORLD_ZONES.map(([, z]) => z); } })();
function WorldClockPicker({ flash }) {
  const [sel, setSel] = useState(() => readLs('lifeos-world-clocks', []));
  const [q, setQ] = useState(''), [found, setFound] = useState([]), [busy, setBusy] = useState(false);
  const save = next => { if (next.length > 3) next = next.slice(-3); setSel(next); writeLs('lifeos-world-clocks', next); flash(next.length ? 'ساعت‌ها ذخیره شد ✓' : 'ساعت‌های دیگر حذف شد'); };
  const has = e => sel.some(x => x.split('|')[0] === e.split('|')[0] && clockName(x) === clockName(e));
  const add = e => { if (!has(e)) save([...sel, e]); setQ(''); setFound([]); };
  useEffect(() => {
    const t = q.trim(); if (t.length < 2) { setFound([]); return; }
    const low = t.toLowerCase();
    const local = [...WORLD_ZONES.filter(([n, z]) => n.includes(t) || z.toLowerCase().includes(low)).map(([n, z]) => ({ e: z, name: n, sub: z })), ...ALL_ZONES.filter(z => z.toLowerCase().replace(/_/g, ' ').includes(low) && !WORLD_ZONES.some(([, w]) => w === z)).slice(0, 6).map(z => ({ e: z, name: z.split('/').pop().replace(/_/g, ' '), sub: z }))];
    setFound(local);
    const h = setTimeout(() => { setBusy(true); fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(t)}&count=8&language=fa&format=json`).then(r => r.json()).then(d => {
      const geo = (d.results || []).filter(r => r.timezone && zoneOk(r.timezone)).map(r => ({ e: `${r.timezone}|${r.name}`, name: r.name, sub: [r.admin1, r.country].filter(Boolean).join('، ') }));
      setFound(f => { const seen = new Set(); return [...geo, ...f].filter(x => { const k = clockName(x.e) + x.e.split('|')[0]; if (seen.has(k)) return false; seen.add(k); return true; }).slice(0, 12); });
    }).catch(() => {}).finally(() => setBusy(false)); }, 350);
    return () => clearTimeout(h);
  }, [q]);
  const now = new Date();
  return <div className="wcp">
    {sel.length ? <div className="hs-choices wrap wcp-sel">{sel.map(e => <button type="button" key={e} className="on" onClick={() => save(sel.filter(x => x !== e))} title="حذف">{clockName(e)} <span aria-hidden="true">×</span></button>)}</div> : null}
    <div className="wcp-search"><Search size={15} /><input value={q} onChange={e => setQ(e.target.value)} placeholder="جستجوی هر شهر یا کشور… (فارسی یا انگلیسی)" />{busy ? <i className="strk-spinner" /> : null}</div>
    {found.length ? <div className="wcp-results">{found.map(x => <button type="button" key={x.e} onClick={() => add(x.e)} disabled={has(x.e)}><b>{x.name}</b><small>{x.sub}</small><em dir="ltr">{new Intl.DateTimeFormat('fa-IR', { timeZone: x.e.split('|')[0], hour: '2-digit', minute: '2-digit', hour12: false }).format(now)}</em></button>)}</div> : null}
  </div>;
}
function WorldClockPickerOld({ flash }) {
  const [sel, setSel] = useState(() => readLs('lifeos-world-clocks', []));
  const toggle = tz => { let next = sel.includes(tz) ? sel.filter(x => x !== tz) : [...sel, tz]; if (next.length > 2) next = next.slice(-2); setSel(next); writeLs('lifeos-world-clocks', next); flash(next.length ? 'ساعت‌ها ذخیره شد ✓' : 'ساعت‌های دیگه حذف شدن.'); };
  return <div className="hs-choices wrap">{WORLD_ZONES.map(([name, tz]) => <button type="button" key={tz} className={sel.includes(tz) ? 'on' : ''} onClick={() => toggle(tz)}>{name}</button>)}</div>;
}

const LAYOUT_DEFAULTS = { top: ['day', 'weather', 'calendar', 'market'], grid: ['agenda', 'football', 'series'] };
function HomeSettings({ me, onSaved, flash }) {
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [city, setCity] = useState(() => readLs('lifeos-weather-city', DEFAULT_CITY));
  const readOrder = id => { const saved = readLs(LAYOUT_KEY(id), []), keys = LAYOUT_DEFAULTS[id]; const valid = saved.filter(k => keys.includes(k)); return [...valid, ...keys.filter(k => !valid.includes(k))]; };
  const [orders, setOrders] = useState(() => ({ top: readOrder('top'), grid: readOrder('grid') }));
  useEffect(() => { setName(me?.displayName || ''); }, [me?.displayName]);
  const saveName = async e => { e.preventDefault(); setBusy(true); try { await api('/api/me', { method: 'PATCH', body: JSON.stringify({ displayName: name.trim() }) }); flash('اسم ذخیره شد ✓'); onSaved(); } catch (error) { flash(error.message); } finally { setBusy(false); } };
  const move = (id, i, d) => setOrders(o => { const list = [...o[id]], j = i + d; if (j < 0 || j >= list.length) return o; [list[i], list[j]] = [list[j], list[i]]; writeLs(LAYOUT_KEY(id), list); return { ...o, [id]: list }; });
  const reset = () => { resetLayouts(); setOrders({ top: [...LAYOUT_DEFAULTS.top], grid: [...LAYOUT_DEFAULTS.grid] }); flash('چیدمان به حالت پیش‌فرض برگشت.'); };
  const pickCity = e => { const c = IR_CITIES.find(([n]) => n === e.target.value); if (!c) return; const v = { name: c[0], lat: c[1], lon: c[2] }; writeLs('lifeos-weather-city', v); setCity(v); flash(`شهر هواشناسی: ${v.name}`); };
  return <section className="planner-list home-settings" id="homeSettings">
    <h2>صفحهٔ امروز</h2>
    <article>
      <div><b>اسم نمایشی</b><small>توی خوشامد «ظهر بخیر، …» نشون داده می‌شه.</small></div>
      <form className="hs-name" onSubmit={saveName}><input value={name} onChange={e => setName(e.target.value)} placeholder={me?.name || 'اسمت به فارسی'} maxLength={40} /><button className="save" disabled={busy}>ذخیره</button></form>
    </article>
    <article>
      <div><b>شهر هواشناسی</b><small>از روی کارت هوا هم می‌شه عوضش کرد (با جستجو).</small></div>
      <select aria-label="شهر" value={IR_CITIES.some(([n]) => n === city.name) ? city.name : ''} onChange={pickCity}>{!IR_CITIES.some(([n]) => n === city.name) && <option value="">{city.name}</option>}{IR_CITIES.map(([n]) => <option key={n} value={n}>{n}</option>)}</select>
    </article>
    <AppearanceSettings flash={flash} />
    <article className="hs-layout">
      <div><b>چیدمان کارت‌ها</b><small>ترتیب کارت‌ها در هر ردیف (از راست به چپ). روی همین مرورگر ذخیره می‌شه.</small></div>
      <div className="hs-rows">
        {[['top', 'ردیف بالا'], ['grid', 'ردیف پایین']].map(([id, label]) => <div key={id} className="hs-row"><small>{label}</small><ol>{orders[id].map((k, i) => <li key={k}><span>{fa(i + 1)}. {LAYOUT_LABELS[k]}</span><button type="button" onClick={() => move(id, i, -1)} disabled={i === 0} aria-label="بالاتر">▲</button><button type="button" onClick={() => move(id, i, 1)} disabled={i === orders[id].length - 1} aria-label="پایین‌تر">▼</button></li>)}</ol></div>)}
        <button type="button" className="outline" onClick={reset}>بازگشت به پیش‌فرض</button>
      </div>
    </article>
  </section>;
}

const loadImage = src => new Promise((resolve, reject) => { const image = new Image(); image.onerror = () => reject(new Error('تصویر لوگو قابل استفاده نیست.')); image.onload = () => resolve(image); image.src = src; });
async function compactReportLogo(file) {
  if (!file || !/^image\/(png|jpe?g|webp)$/i.test(file.type)) throw new Error('لوگو باید PNG، JPG یا WebP باشد.');
  if (file.size > 5 * 1024 * 1024) throw new Error('حجم فایل لوگو حداکثر ۵ مگابایت است.');
  const image = await loadImage(await readDataUrl(file));
  for (const [edge, quality] of [[520, .86], [400, .8], [300, .72]]) {
    const ratio = Math.min(1, edge / Math.max(image.naturalWidth || image.width, image.naturalHeight || image.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round((image.naturalWidth || image.width) * ratio));
    canvas.height = Math.max(1, Math.round((image.naturalHeight || image.height) * ratio));
    const ctx = canvas.getContext('2d'); ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high'; ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
    const value = canvas.toDataURL('image/webp', quality);
    if (value.length <= 210000) return value;
  }
  throw new Error('فایل لوگو بعد از کوچک‌سازی هم بزرگ است؛ یک لوگوی ساده‌تر انتخاب کن.');
}
function ReportPrintSettings({ flash }) {
  const [config, setConfig] = useState({ headerText: '', footerText: '', logo: '' });
  const [busy, setBusy] = useState(false), [logoBusy, setLogoBusy] = useState(false);
  useEffect(() => { api('/api/report-brand').then(data => setConfig({ headerText: data.headerText || '', footerText: data.footerText || '', logo: data.logo || '' })).catch(error => flash(error.message)); }, []);
  const set = (key, value) => setConfig(current => ({ ...current, [key]: value }));
  const save = async () => {
    setBusy(true);
    try { await api('/api/report-brand', { method: 'PATCH', body: JSON.stringify(config) }); flash('قالب گزارش ذخیره شد ✓'); }
    catch (error) { flash(error.message); }
    finally { setBusy(false); }
  };
  const chooseLogo = async event => {
    const file = event.target.files?.[0]; event.target.value = '';
    if (!file) return;
    setLogoBusy(true);
    try { set('logo', await compactReportLogo(file)); flash('لوگو آمادهٔ ذخیره است.'); }
    catch (error) { flash(error.message); }
    finally { setLogoBusy(false); }
  };
  return <section className="planner-list report-print-settings" id="reportPrintSettings">
    <h2>قالب گزارش PDF پروژه‌ها</h2>
    <p>متن و لوگوی این بخش در چاپ و «ذخیره به صورت PDF» همهٔ گزارش‌های پروژه استفاده می‌شود. شمارهٔ صفحه خودکار است. همین لوگو و متن سربرگ، لوگو و نام «پیمانکار» روی روکش صورت وضعیت‌های همهٔ پروژه‌هاست (کارفرما برای هر پروژه جداست).</p>
    <div className="report-print-grid">
      <label><span>متن سربرگ (بالا، سمت چپ)</span><input value={config.headerText} maxLength={140} onChange={e => set('headerText', e.target.value)} placeholder="مثال: شرکت نمای مدرن" /></label>
      <label><span>متن پابرگ</span><input value={config.footerText} maxLength={220} onChange={e => set('footerText', e.target.value)} placeholder="مثال: تلفن، آدرس یا متن محرمانه" /></label>
    </div>
    <div className="report-logo-row"><div>{config.logo ? <img src={config.logo} alt="پیش‌نمایش لوگوی گزارش" /> : <i>بدون لوگو</i>}<small>PNG، JPG یا WebP؛ پیش از ذخیره کوچک می‌شود.</small></div><div><label className="outline report-logo-picker">{logoBusy ? 'آماده‌سازی…' : 'انتخاب لوگو'}<input type="file" accept="image/png,image/jpeg,image/webp" onChange={chooseLogo} disabled={logoBusy} /></label>{config.logo ? <button type="button" className="finance-action" onClick={() => set('logo', '')}>حذف لوگو</button> : null}</div></div>
    <button type="button" className="save report-print-save" disabled={busy || logoBusy} onClick={save}>{busy ? 'در حال ذخیره…' : 'ذخیرهٔ قالب گزارش'}</button>
  </section>;
}

function SettingsReact() {
  const mods = useModules();
  const [integrations, setIntegrations] = useState({}), [notice, setNotice] = useState('');
  const [me, setMe] = useState(null);
  const [pinNew, setPinNew] = useState(''), [pinCur, setPinCur] = useState('');
  const [tgLink, setTgLink] = useState(null);
  const [tgBackupBusy, setTgBackupBusy] = useState(false);
  const [digest, setDigest] = useState({ tgMorningHour: 9, tgEveningHour: 23, tgMorningOn: true, tgEveningOn: true, tgMonthlyOn: true, tgWeeklyOn: true, tgReports: true, tgAiOn: true, aiConfigured: false });
  const [chatLog, setChatLog] = useState([]), [chatInput, setChatInput] = useState(''), [chatBusy, setChatBusy] = useState(false);

  const load = () => api('/api/integrations').then(setIntegrations).catch(error => setNotice(error.message));
  const loadMe = () => api('/api/me').then(data => {
    setMe(data.user || null);
    if (data.user) setDigest(prev => ({ ...prev, tgMorningHour: data.user.tgMorningHour ?? 9, tgEveningHour: data.user.tgEveningHour ?? 23, tgReports: data.user.tgReports !== false, tgMorningOn: data.user.tgMorningOn !== false, tgEveningOn: data.user.tgEveningOn !== false, tgAiOn: data.user.tgAiOn !== false, aiConfigured: !!data.user.aiConfigured, tgMonthlyOn: data.user.tgMonthlyOn !== false, tgWeeklyOn: data.user.tgWeeklyOn !== false, tgProjectsOn: data.user.tgProjectsOn !== false, tgFeeRemindOn: data.user.tgFeeRemindOn !== false, tgCoursesMonthlyOn: data.user.tgCoursesMonthlyOn !== false, backupFreq: data.user.backupFreq || 'weekly', tgLastBackup: data.user.tgLastBackup || null }));
  }).catch(error => setNotice(error.message));
  useEffect(() => { load(); loadMe(); }, []);

  const disconnect = async name => { try { await api(`/api/integrations/${name}/disconnect`, { method: 'POST', body: JSON.stringify({}) }); setNotice('اتصال قطع شد.'); load(); } catch (error) { setNotice(error.message); } };
  const syncCalendar = async () => { try { await api('/api/integrations/google-calendar/sync', { method: 'POST', body: JSON.stringify({}) }); setNotice('همگام‌سازی شد.'); load(); } catch (error) { setNotice(error.message); } };
  const cards = [['spotify','Spotify','music'], ['youtube','YouTube','youtube'], ['google-calendar','Google Calendar','calendar']];

  const savePin = async event => {
    event.preventDefault();
    const pin = pinNew.replace(/\D/g, '');
    if (pin.length < 4 || pin.length > 8) { setNotice('PIN باید ۴ تا ۸ رقم باشد.'); return; }
    try {
      await api('/api/security/pin', { method: 'PUT', body: JSON.stringify({ pin, currentPin: pinCur.replace(/\D/g, '') || undefined }) });
      setNotice('PIN ذخیره شد.'); setPinNew(''); setPinCur(''); loadMe();
    } catch (error) { setNotice(error.message); }
  };
  const clearPin = async () => {
    const cur = pinCur.replace(/\D/g, '');
    if (!cur) { setNotice('برای خاموش‌کردن قفل، PIN فعلی را در فیلد «PIN فعلی» بنویس.'); return; }
    try {
      await api('/api/security/pin', { method: 'DELETE', body: JSON.stringify({ pin: cur }) });
      setNotice('قفل PIN خاموش شد.'); setPinCur(''); loadMe();
    } catch (error) { setNotice(error.message); }
  };

  const tgLinkCode = async () => { try { setTgLink(await api('/api/telegram/link-code', { method: 'POST', body: JSON.stringify({}) })); } catch (error) { setNotice(error.message); } };
  const tgUnlink = async () => { try { await api('/api/telegram/unlink', { method: 'POST', body: JSON.stringify({}) }); setNotice('اتصال تلگرام قطع شد.'); setTgLink(null); load(); } catch (error) { setNotice(error.message); } };
  const tgBackupNow = async () => {
    setTgBackupBusy(true);
    try { await api('/api/backup/telegram', { method: 'POST', body: JSON.stringify({}) }); setNotice('بکاپ در تلگرامت ارسال شد.'); }
    catch (error) { setNotice(error.message); }
    finally { setTgBackupBusy(false); }
  };

  const saveDigest = async patch => {
    setDigest(prev => ({ ...prev, ...patch }));
    try { await api('/api/me', { method: 'PATCH', body: JSON.stringify(patch) }); } catch (error) { setNotice(error.message); }
  };

  const sendChat = async () => {
    const msg = chatInput.trim();
    if (!msg || chatBusy) return;
    const history = chatLog.map(m => ({ role: m.role, content: m.content }));
    setChatLog(log => [...log, { role: 'user', content: msg }]);
    setChatInput(''); setChatBusy(true);
    try {
      const data = await api('/api/ai/chat', { method: 'POST', body: JSON.stringify({ message: msg, history }) });
      setChatLog(log => [...log, { role: 'assistant', content: data.reply }]);
    } catch (error) {
      setChatLog(log => [...log, { role: 'assistant', content: 'خطا: ' + error.message }]);
    } finally { setChatBusy(false); }
  };

  return (
    <main className="planner-react" dir="rtl">
      <TopNav active="settings" />
      <div className="planner-page">
        <header><div><p>اتصال‌های حساب</p><h1>تنظیمات</h1></div></header>
        {notice && <div className="notice">{notice}<button onClick={() => setNotice('')}>×</button></div>}

        <HomeSettings me={me} onSaved={loadMe} flash={setNotice} />
        <ReportPrintSettings flash={setNotice} />

        <section className="planner-list integration-list" id="googleCalendarCard">
          <h2>اتصال‌ها</h2>
          {cards.map(([id, title, page]) => {
            const state = integrations[id] || integrations[id.replace(/-(\w)/g, (_, c) => c.toUpperCase())] || {};
            const connected = Boolean(state.connected);
            return (
              <article key={id}>
                <div>
                  <b>{title}</b>
                  <small>{connected ? `متصل است${state.email ? ` · ${state.email}` : ''}${state.lastSyncAt ? ` · آخرین همگام‌سازی ${new Intl.DateTimeFormat('fa-IR', { timeZone: 'Asia/Tehran', dateStyle: 'short', timeStyle: 'short' }).format(new Date(state.lastSyncAt))}` : ''}${state.lastError ? ` · ⚠ ${state.lastError}` : ''}` : state.configured === false ? 'روی سرور تنظیم نشده' : 'متصل نیست'}</small>
                  {id === 'google-calendar' && <p>تقویم اختصاصی LifeOS داخل حساب گوگلت ساخته می‌شود؛ حذف آن در گوگل دادهٔ هسته را پاک نمی‌کند.</p>}
                </div>
                {connected ? <>
                  <button className="finance-action" onClick={() => disconnect(id)}>قطع اتصال</button>
                  {id === 'google-calendar' && <button className="finance-action" onClick={syncCalendar}>همگام‌سازی</button>}
                </> : <a className="save" href={`/api/integrations/${id}/connect`}>اتصال</a>}
                <a className="finance-action" href={`/?page=${page}`}>بازکردن</a>
              </article>
            );
          })}
        </section>

        <section className="planner-list" id="telegramCard">
          <h2>اتصال تلگرام</h2>
          <article>
            <div>
              <b>بات شخصی تلگرام</b>
              <small>{integrations.telegram?.connected ? 'متصل است' : 'متصل نیست'}</small>
              <p>با یک کد یک‌بارمصرف (۱۵ دقیقه اعتبار) وصل شو؛ گزارش صبح/شب، ثبت سریع تراکنش و کارها و بکاپ روزانهٔ اطلاعات از همین بات فعال می‌شود.</p>
              {tgLink && <p>کد: <b dir="ltr">{tgLink.code}</b> — در بات بفرست: <code dir="ltr">/start {tgLink.code}</code></p>}
            </div>
            {integrations.telegram?.connected ? <>
              <button type="button" className="finance-action" onClick={tgUnlink}>قطع اتصال</button>
              <button type="button" className="finance-action" onClick={tgBackupNow} disabled={tgBackupBusy}>{tgBackupBusy ? 'در حال ارسال…' : '🗄 دریافت بکاپ الان'}</button>
            </> : <button type="button" className="save" onClick={tgLinkCode}>ساخت کد اتصال</button>}
          </article>
        </section>

        <SiteTokensCard />

        <form className="planner-form" id="pinCard" onSubmit={savePin}>
          <h2>PIN امنیتی</h2>
          <p>بعد از ورود، برای دیدن داشبورد PIN می‌خواهد — مناسب موبایل مشترک. برای خاموش‌کردن، فیلد PIN جدید را خالی بگذار و روی «خاموش‌کردن قفل» بزن.</p>
          <div>
            <div><label>PIN جدید (۴ تا ۸ رقم)</label><input type="password" inputMode="numeric" maxLength={8} value={pinNew} onChange={e => setPinNew(e.target.value)} placeholder="••••" /></div>
            <div><label>PIN فعلی (اگر داری)</label><input type="password" inputMode="numeric" maxLength={8} value={pinCur} onChange={e => setPinCur(e.target.value)} placeholder="اختیاری" /></div>
          </div>
          <div>
            <button type="submit" className="save">ذخیرهٔ PIN</button>
            <button type="button" className="finance-action" onClick={clearPin}>خاموش‌کردن قفل</button>
          </div>
          <small>وضعیت فعلی: {me?.pinEnabled ? 'فعال ✓' : 'خاموش'}</small>
        </form>

        <section className="planner-list" id="digestCard">
          <h2>دایجست صبح/عصر</h2>
          <article>
            <div><b>🌅 گزارش صبح</b><small>سررسید اشتراک‌ها و بدهی‌ها + بازی‌های امروز + برنامهٔ امروز</small></div>
            <div className="digest-controls">
              <select aria-label="ساعت گزارش صبح" value={digest.tgMorningHour} onChange={e => saveDigest({ tgMorningHour: Number(e.target.value) })}>{DIGEST_HOURS.map(h => <option key={h} value={h}>{String(h).padStart(2, '0')}:۰۰</option>)}</select>
              <button type="button" className={`plnr-switch ${digest.tgMorningOn ? 'on' : ''}`} role="switch" aria-label="گزارش صبح" aria-checked={digest.tgMorningOn} onClick={() => saveDigest({ tgMorningOn: !digest.tgMorningOn })}><i /></button>
            </div>
          </article>
          <article>
            <div><b>🌙 گزارش عصر</b><small>جمع کارهای امروز + هزینهٔ روز + حال و خواب + یادآوری ثبت روزنگار</small></div>
            <div className="digest-controls">
              <select aria-label="ساعت گزارش شب" value={digest.tgEveningHour} onChange={e => saveDigest({ tgEveningHour: Number(e.target.value) })}>{DIGEST_HOURS.map(h => <option key={h} value={h}>{String(h).padStart(2, '0')}:۰۰</option>)}</select>
              <button type="button" className={`plnr-switch ${digest.tgEveningOn ? 'on' : ''}`} role="switch" aria-label="گزارش شب" aria-checked={digest.tgEveningOn} onClick={() => saveDigest({ tgEveningOn: !digest.tgEveningOn })}><i /></button>
            </div>
          </article>
          <article>
            <div><b>✨ یادداشت هوشمند</b><small>{digest.aiConfigured ? 'زیر گزارش صبح و عصر، دو جملهٔ کوتاه از دستیار: تمرکز امروز و جمع‌بندی روز.' : 'برای فعال شدن، کلید AI باید روی سرور تنظیم باشد.'}</small></div>
            <button type="button" className={`plnr-switch ${digest.tgAiOn && digest.aiConfigured ? 'on' : ''}`} role="switch" aria-label="یادداشت هوشمند در گزارش‌ها" aria-checked={digest.tgAiOn && digest.aiConfigured} disabled={!digest.aiConfigured} onClick={() => saveDigest({ tgAiOn: !digest.tgAiOn })}><i /></button>
          </article>
          <article>
            <div><b>📊 گزارش ماهانهٔ مالی</b><small>روز اول هر ماه شمسی، ساعت گزارش صبح: درآمد، هزینه، مقایسه با ماه قبل، سقف‌های ردشده و سررسیدها</small></div>
            <button type="button" className={`plnr-switch ${digest.tgMonthlyOn ? 'on' : ''}`} role="switch" aria-label="گزارش ماهانه" aria-checked={digest.tgMonthlyOn} onClick={() => saveDigest({ tgMonthlyOn: !digest.tgMonthlyOn })}><i /></button>
          </article>
          <article>
            <div><b>🗓 مرور هفته</b><small>جمعه‌ها ساعت گزارش عصر: کارهای انجام‌شده، عادت‌ها، هزینهٔ هفته و سررسیدهای هفتهٔ بعد</small></div>
            <button type="button" className={`plnr-switch ${digest.tgWeeklyOn ? 'on' : ''}`} role="switch" aria-label="گزارش هفتگی" aria-checked={digest.tgWeeklyOn} onClick={() => saveDigest({ tgWeeklyOn: !digest.tgWeeklyOn })}><i /></button>
          </article>
          <article>
            <div><b>📁 گزارش هفتگی پروژه‌ها</b><small>جمعه‌ها ساعت گزارش عصر: پیشرفت هر پروژه، کارت‌های انجام‌شدهٔ هفته، عقب‌افتاده‌ها، مهلت‌ها و کارهای هفتهٔ بعد · <button type="button" className="linkish" onClick={async () => { try { await api('/api/projects/report', { method: 'POST' }); setNotice('گزارش پروژه‌ها به تلگرام فرستاده شد ✓'); } catch (e) { setNotice(e.message); } }}>الان بفرست</button></small></div>
            <button type="button" className={`plnr-switch ${digest.tgProjectsOn ? 'on' : ''}`} role="switch" aria-label="گزارش هفتگی پروژه‌ها" aria-checked={digest.tgProjectsOn} onClick={() => saveDigest({ tgProjectsOn: !digest.tgProjectsOn })}><i /></button>
          </article>
          {modOn(mods, 'courses') ? <><article>
            <div><b>🎓 یادآوری سررسید شهریه</b><small>دو روز مانده به سررسید هر دانشجو، ساعت گزارش صبح: نام، مانده و دکمهٔ «پیام واتساپ» با متن آماده</small></div>
            <button type="button" className={`plnr-switch ${digest.tgFeeRemindOn ? 'on' : ''}`} role="switch" aria-label="یادآوری شهریه" aria-checked={digest.tgFeeRemindOn} onClick={() => saveDigest({ tgFeeRemindOn: !digest.tgFeeRemindOn })}><i /></button>
          </article>
          <article>
            <div><b>📚 گزارش ماهانهٔ دوره‌ها</b><small>اول هر ماه: دریافتی ماه، مانده، بدهکارها و درصد حضور هر دوره · <button type="button" className="linkish" onClick={async () => { try { await api('/api/courses/report?prev=0', { method: 'POST' }); setNotice('گزارش این ماه دوره‌ها به تلگرام فرستاده شد ✓'); } catch (e) { setNotice(e.message); } }}>الان بفرست (این ماه)</button></small></div>
            <button type="button" className={`plnr-switch ${digest.tgCoursesMonthlyOn ? 'on' : ''}`} role="switch" aria-label="گزارش ماهانهٔ دوره‌ها" aria-checked={digest.tgCoursesMonthlyOn} onClick={() => saveDigest({ tgCoursesMonthlyOn: !digest.tgCoursesMonthlyOn })}><i /></button>
          </article></> : null}
          <article>
            <div><b>ارسال گزارش‌ها در تلگرام</b><small>خاموش‌کردن یعنی هیچ دایجستی فرستاده نشود</small></div>
            <button type="button" className={`plnr-switch ${digest.tgReports ? 'on' : ''}`} role="switch" aria-label="گزارش‌های تلگرام" aria-checked={digest.tgReports} onClick={() => saveDigest({ tgReports: !digest.tgReports })}><i /></button>
          </article>
        </section>

        <NotifyCard />

        <ModulesCard />

        <BackupInstallCard lastBackup={digest.tgLastBackup} freq={digest.backupFreq} onFreq={v => saveDigest({ backupFreq: v })} />

        <section className="planner-list ai-chat-card" id="aiChatCard">
          <h2>چت با دستیار هوش مصنوعی</h2>
          <div className="ai-chat-log">
            {chatLog.length ? chatLog.map((m, index) => <p key={index} className={`ai-chat-msg ${m.role}`}><b>{m.role === 'user' ? 'تو' : 'دستیار'}:</b> {m.content}</p>)
              : <p className="empty">بر اساس دادهٔ واقعیِ این ماهت (مالی، خواب/مود ۷ روز اخیر، کارهای پیش‌رو، عادت‌ها) جواب می‌دهد؛ مثلاً بپرس «این ماه چرا بیشتر خرج کردم؟»</p>}
          </div>
          <div className="ai-chat-row">
            <input value={chatInput} onChange={e => setChatInput(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') sendChat(); }} placeholder="سوالت را بنویس…" disabled={chatBusy} />
            <button type="button" className="save" onClick={sendChat} disabled={chatBusy}>{chatBusy ? '…' : 'ارسال'}</button>
          </div>
        </section>
      </div>
    </main>
  );
}

const HOME_MARKET_DEFAULT = ['price_dollar_rl', 'price_eur', 'price_gbp', 'price_aed', 'sekee', 'nim', 'rob', 'geram18'];
// Items shown on Today = the ones starred (★) on the Market page; falls back to a default set.
// Tehran items are kept as bare TGJU keys, crypto as «c:<coingecko id>» (same ids as the Market page's crypto list)
const homeMarketKeys = () => { const f = readLs('lifeos-market-favs', null); const keys = Array.isArray(f) ? f.filter(x => /^[tc]:/.test(String(x))).map(x => String(x).startsWith('t:') ? x.slice(2) : x) : []; return keys.length ? keys : HOME_MARKET_DEFAULT; };
const HOME_CRYPTO_IDS = 'bitcoin,ethereum,solana,binancecoin,ripple,dogecoin,the-open-network,tron,tether';
const HOME_CRYPTO_FA = { bitcoin: 'بیت‌کوین', ethereum: 'اتریوم', solana: 'سولانا', binancecoin: 'بایننس کوین', ripple: 'ریپل', dogecoin: 'دوج‌کوین', 'the-open-network': 'تون‌کوین', tron: 'ترون', tether: 'تتر' };
let HOME_CRYPTO = null;
const loadHomeCrypto = () => (HOME_CRYPTO ||= fetch(`https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&ids=${HOME_CRYPTO_IDS}&sparkline=true`).then(r => r.ok ? r.json() : []).then(d => (d || []).map(c => ({ key: 'c:' + c.id, name: HOME_CRYPTO_FA[c.id] || c.name, p: c.current_price, dp: c.price_change_percentage_24h || 0, spark: (c.sparkline_in_7d?.price || []).filter((_, i, a) => i % 6 === 0 || i === a.length - 1), image: c.image, crypto: true }))).catch(() => { HOME_CRYPTO = null; return []; }));
function Market() {
  const [all, setAll] = useState([]), [keys, setKeys] = useState(homeMarketKeys), [hist, setHist] = useState({}), [notice, setNotice] = useState(''), [chart, setChart] = useState(null);
  const [pick, setPick] = useState(false), [q, setQ] = useState('');
  const [coins, setCoins] = useState([]);
  useEffect(() => { api('/api/tgju').then(data => setAll(tgjuRows(data))).catch(error => setNotice(error.message)); loadHomeCrypto().then(setCoins); }, []);
  const pool = useMemo(() => [...all, ...coins], [all, coins]);
  const rows = useMemo(() => keys.map(k => pool.find(r => r.key === k)).filter(Boolean).slice(0, 12), [pool, keys]);
  // sparklines: two requests at a time (TGJU refuses bursts), and a failed one is retried twice instead of
  // leaving that item without a chart for the whole visit
  useEffect(() => {
    const need = rows.filter(r => !r.crypto && !(r.key in hist)); if (!need.length) return;
    let live = true;
    const one = async (key, tries = 0) => { try { const d = await api(`/api/tgju/history?key=${encodeURIComponent(key)}&days=30`); return (d.items || []).map(x => x.price); } catch { if (tries >= 2 || !live) return null; await new Promise(r => setTimeout(r, 2500 * (tries + 1))); return one(key, tries + 1); } };
    (async () => { const queue = need.map(r => r.key); await Promise.all([0, 1].map(async () => { while (queue.length && live) { const key = queue.shift(); const prices = await one(key); if (live && prices) setHist(h => ({ ...h, [key]: prices })); } })); })();
    return () => { live = false; };
  }, [rows]);
  // Home items are the market page's starred "t:" favourites (same storage), so both stay in sync.
  const save = next => { setKeys(next); const f = readLs('lifeos-market-favs', []); writeLs('lifeos-market-favs', [...(Array.isArray(f) ? f.filter(x => !/^[tc]:/.test(String(x))) : []), ...next.map(k => k.startsWith('c:') ? k : 't:' + k)]); };
  const toggle = k => save(keys.includes(k) ? keys.filter(x => x !== k) : [...keys, k].slice(0, 12));
  const move = (k, d) => { const i = keys.indexOf(k), j = i + d; if (j < 0 || j >= keys.length) return; const n = [...keys]; [n[i], n[j]] = [n[j], n[i]]; save(n); };
  const found = useMemo(() => { const t = q.trim().toLowerCase(); return pool.filter(r => !t || `${r.name} ${r.key} ${r.crypto ? 'رمزارز کریپتو crypto' : ''}`.toLowerCase().includes(t)).slice(0, 50); }, [pool, q]);
  const priceTxt = r => r.crypto ? `$${Number(r.p || 0).toLocaleString('en-US', { maximumFractionDigits: r.p < 10 ? 4 : 2 })}` : fa(r.p);
  const logo = r => r.crypto ? <img className="mkh-coin" src={r.image} alt="" loading="lazy" /> : <MarketLogo k={r.key} fallback={marketIcon(r.key)} />;
  const isGlobal = k => ['oil_brent', 'oil', 'nickel', 'platinum', 'copper', 'silver', 'aluminium', 'aluminum'].includes(k);
  return <Card className="market" icon={LineChart} title="بازارها" action={<span className="mkh-acts"><button type="button" className={`mkh-add ${pick ? 'on' : ''}`} onClick={() => setPick(p => !p)} title="افزودن یا حذف آیتم">{pick ? 'تمام' : '＋ آیتم'}</button><a href="/?page=market">همه ←</a></span>}>
    {pick ? <div className="mkh-pick">
      <input autoFocus value={q} onChange={e => setQ(e.target.value)} placeholder="جستجو: دلار، سکه، بیت‌کوین، طلا…" />
      <small>{keys.length} از ۱۲ · برای افزودن یا حذف روی هر مورد بزن</small>
      <div className="mkh-pick-list">{found.map(r => <button type="button" key={r.key} className={keys.includes(r.key) ? 'on' : ''} onClick={() => toggle(r.key)}>
        {logo(r)}<span>{r.name}</span><b>{priceTxt(r)}</b><i>{keys.includes(r.key) ? '✓' : '＋'}</i>
      </button>)}{!found.length ? <p className="empty">{all.length ? 'چیزی پیدا نشد.' : 'در حال دریافت…'}</p> : null}</div>
    </div> : null}
    <small className="unit-note">قیمت‌ها به ریال (رمزارز به دلار) · روی هر ردیف بزن تا نمودارش باز بشه</small>
    {rows.length ? <div className="mkh-list">{rows.map((item, i) => {
      const h = item.crypto ? item.spark : hist[item.key] || [], prev = !item.crypto && h.length > 1 ? h[h.length - 2] : 0; let dp = item.dp;
      if (!dp && prev && item.p) { dp = (item.p - prev) / prev * 100; if (Math.abs(dp) > 25) dp = 0; }
      const change = dp ? `${dp > 0 ? '▲' : '▼'}${Math.abs(dp).toLocaleString('fa-IR', { maximumFractionDigits: 2 })}٪` : '۰٪'; const up = !change.includes('▼');
      return <div className="mkh-wrap" key={item.key}><button type="button" className="market-row mkh-row" onClick={() => item.crypto ? (location.href = '/?page=market') : setChart(item)}>
        {logo(item)}
        <span className="mkh-name">{item.name}</span>
        <span className="mkh-spark">{h.length > 1 ? <Sparkline data={h} up={up} uid={item.key} width={64} height={24} /> : null}</span>
        <b className="mkh-price">{priceTxt(item)}</b>
        <small className={`mkh-chg ${change.includes('▼') ? 'negative' : dp ? 'positive' : ''}`}>{change}</small>
      </button>{pick ? <span className="mkh-edit"><button type="button" onClick={() => move(item.key, -1)} disabled={!i} aria-label="بالاتر">▲</button><button type="button" onClick={() => move(item.key, 1)} disabled={i === rows.length - 1} aria-label="پایین‌تر">▼</button><button type="button" className="x" onClick={() => toggle(item.key)} aria-label="حذف">×</button></span> : null}</div>;
    })}</div> : <p className="empty">{notice || (all.length ? 'آیتمی انتخاب نشده — «＋ آیتم» را بزن.' : 'در حال دریافت بازار…')}</p>}
    {chart && <PriceChart symbol={chart.key} name={chart.name} unit={isGlobal(chart.key) ? 'دلار' : 'ریال'} onClose={() => setChart(null)} />}
  </Card>;
}
const FOOT_LEAGUES = [['eng.1', 'لیگ برتر انگلیس', 'PL', '#a855f7'], ['esp.1', 'لالیگا', 'LL', '#ef4444'], ['ita.1', 'سری آ', 'A', '#3b82f6'], ['ger.1', 'بوندس‌لیگا', 'BL', '#dc2626'], ['fra.1', 'لیگ ۱', 'L1', '#94a3b8'], ['tur.1', 'سوپر لیگ ترکیه', 'TR', '#e11d48'], ['por.1', 'پریمیرا لیگا پرتغال', 'PT', '#16a34a'], ['uefa.champions', 'لیگ قهرمانان اروپا', 'UCL', '#6366f1'], ['uefa.europa', 'لیگ اروپا', 'UEL', '#f97316'], ['uefa.nations', 'لیگ ملت‌های اروپا', 'UNL', '#0ea5e9'], ['afc.champions', 'لیگ نخبگان آسیا', 'AFC', '#8b5cf6'], ['ksa.1', 'لیگ حرفه‌ای عربستان', 'KSA', '#22c55e'], ['irn.1', 'لیگ برتر خلیج فارس', 'ایران', '#0ea5e9']];
const LEAGUE_CACHE = {};
const fetchLeague = id => (LEAGUE_CACHE[id] ||= api(`/api/football/remote/free/matches?league=${id}`).then(d => d.items || []).catch(e => { delete LEAGUE_CACHE[id]; throw e; }));
// The league whose next (or live) match is soonest within the coming week.
async function pickNearestLeague() {
  const cached = readLs('lifeos-home-league-auto2', null);
  if (cached && Date.now() - cached.at < 3 * 3600000) return cached.league;
  const now = Date.now(), week = now + 7 * 86400000;
  // a league that hasn't answered within 10 s doesn't hold the card back (it keeps loading into LEAGUE_CACHE)
  const timeout = new Promise(r => setTimeout(r, 10000));
  const res = await Promise.all(FOOT_LEAGUES.map(([id]) => Promise.race([fetchLeague(id).then(items => {
    if (items.some(m => m.status === 'live')) return [id, 0];
    const next = items.filter(m => m.status === 'upcoming').map(m => Date.parse(m.date)).filter(t => t >= now - 3 * 3600000 && t <= week).sort((a, b) => a - b)[0];
    return [id, next ?? Infinity];
  }).catch(() => [id, Infinity]), timeout.then(() => [id, Infinity])])));
  const best = res.sort((a, b) => a[1] - b[1])[0];
  if (!best || best[1] === Infinity) return 'eng.1'; // nothing known yet: show the Premier League but don't remember it as the pick
  writeLs('lifeos-home-league-auto2', { at: Date.now(), league: best[0] });
  return best[0];
}
function LeaguePicker({ value, onChange }) {
  const [open, setOpen] = useState(false);
  const wrap = React.useRef(null);
  const cur = FOOT_LEAGUES.find(l => l[0] === value) || FOOT_LEAGUES[0];
  return <div className="lgpick" ref={wrap}>
    <button type="button" className="lg-btn" onClick={() => setOpen(o => !o)}><i style={{ color: cur[3] }}>{cur[2]}</i>{cur[1]}<ChevronDown size={15} /></button>
    {open && <LeagueMenu anchor={wrap} value={value} onClose={() => setOpen(false)} onPick={id => { onChange(id); setOpen(false); }} />}
  </div>;
}
function LeagueMenu({ anchor, value, onClose, onPick }) {
  useDismiss(anchor, onClose);
  return <div className="lg-menu" role="listbox">{FOOT_LEAGUES.map(([id, name, code, color]) => <button type="button" key={id} className={id === value ? 'on' : ''} onClick={() => onPick(id)}><i style={{ color }}>{code}</i><span>{name}</span>{id === value && <Check size={15} />}</button>)}</div>;
}
const readLs = (k, f) => { try { const v = JSON.parse(localStorage.getItem(k) || 'null'); return v ?? f; } catch { return f; } };
const writeLs = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} };

// ── per-user sections ("بخش‌های من"): hide what a user doesn't use, everywhere ──
const MODULES = [['projects', 'پروژه‌ها', '🗂', 'تابلوی کانبان برای پروژه‌ها'], ['courses', 'دوره‌ها و دانشجوها', '🎓', 'شهریه، پرداخت‌ها و حضور و غیاب'], ['vocab', 'زبان', '📘', '۷۰۰۰ واژهٔ آیلتس با مرور فاصله‌دار'], ['crmOn', 'مشتری و فروش', '💼', 'مشتری، پیش‌فاکتور و پیگیری (پیش‌فرض خاموش)'], ['health', 'سلامت', '💪', 'وزن، خواب، ورزش و آب'], ['car', 'خودرو', '🚗', 'بیمه، معاینه، سرویس و هزینه‌ها'], ['travel', 'سفر', '✈️', 'برنامه، بودجه و لیست وسایل'], ['journal', 'روزنگار', '📔', 'نوشته و عکس روزانه'], ['habits', 'عادت‌ها', '🔥', 'عادت روزانه و زنجیرهٔ روزها'], ['learning', 'یادگیری', '🎓', 'کتاب‌ها و دوره‌ها'], ['finance', 'مالی', '💰', 'تراکنش، بودجه، بدهی و سرمایه'], ['market', 'بازار ارز و طلا', '📈', 'دلار، سکه، طلا و رمزارز'], ['football', 'فوتبال', '⚽', 'بازی‌ها، جدول و تیم‌های محبوب'], ['watch', 'فیلم و سریال', '🎬', 'ردیاب سریال، تقویم پخش و پیشنهاد'], ['media', 'رسانه', '🎵', 'موسیقی و یوتیوب'], ['notes', 'یادداشت‌ها', '📝', 'یادداشت و چک‌لیست'], ['documents', 'مدارک', '📄', 'آرشیو مدارک با تاریخ انقضا'], ['contacts', 'مخاطبین', '👥', 'مخاطب، تولد و پیگیری']];
const PAGE_MODULE = { projects: 'projects', courses: 'courses', vocab: 'vocab', crm: 'crmOn', health: 'health', exercise: 'health', car: 'car', travel: 'travel', journal: 'journal', learning: 'learning', habits: 'habits', shopping: 'notes', finance: 'finance', market: 'market', football: 'football', series: 'watch', movies: 'watch', upcoming: 'watch', discover: 'watch', media: 'media', notes: 'notes', documents: 'documents', contacts: 'contacts' };
let MODS_CACHE = readLs('lifeos-modules', null);
let LOCKS_CACHE = readLs('lifeos-locks', []); // sections the site admin closed for this account (server answers 403 too)
const pageLocked = page => !!PAGE_MODULE[page] && LOCKS_CACHE.includes(PAGE_MODULE[page]);
const OPT_IN = new Set(['crmOn']); // off unless explicitly turned on
const modOn = (m, k) => OPT_IN.has(k) ? !!(m && m[k] === true) : (!m || m[k] !== false);
const pageOn = (m, page) => !PAGE_MODULE[page] || modOn(m, PAGE_MODULE[page]);
// A menu entry that opens a hub stays visible while any of its tabs is on.
const NAV_HUB = { learning: ['learning', 'vocab'], notes: ['notes', 'journal'] };
const navOn = (m, page) => (NAV_HUB[page] || [page]).some(pg => pageOn(m, pg));
function setModules(m, needsOnboard = false) { MODS_CACHE = m; writeLs('lifeos-modules', m); window.__needsOnboard = needsOnboard; window.dispatchEvent(new Event('lifeos:modules')); }
// ── focus mode: during work hours (or when switched on) the leisure sections disappear from menu and Today ──
const FOCUS_DEF = { mode: 'off', from: 9, to: 17, days: [6, 0, 1, 2, 3], hide: ['football', 'watch', 'media', 'market'], snooze: '' };
const readFocus = () => ({ ...FOCUS_DEF, ...readLs('lifeos-focus', {}) });
const tehranNow = () => { const p = Object.fromEntries(new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Tehran', hour: 'numeric', hourCycle: 'h23', weekday: 'short', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date()).map(x => [x.type, x.value])); return { h: Number(p.hour), wd: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(p.weekday), day: `${p.year}-${p.month}-${p.day}` }; };
function focusActive(f = readFocus()) {
  if (f.mode === 'on') return true;
  if (f.mode !== 'auto') return false;
  const t = tehranNow();
  return f.snooze !== t.day && f.days.includes(t.wd) && t.h >= f.from && t.h < f.to;
}
function saveFocus(f) { writeLs('lifeos-focus', f); FOCUS_ON = focusActive(f); window.dispatchEvent(new Event('lifeos:modules')); }
let FOCUS_ON = focusActive();
if (typeof window !== 'undefined') window.addEventListener('lifeos:focus-toggle', () => { const f = readFocus(); saveFocus(FOCUS_ON ? (f.mode === 'auto' ? { ...f, snooze: tehranNow().day } : { ...f, mode: 'off' }) : { ...f, mode: 'on' }); });
if (typeof window !== 'undefined') setInterval(() => { const on = focusActive(); if (on !== FOCUS_ON) { FOCUS_ON = on; window.dispatchEvent(new Event('lifeos:modules')); } }, 60e3);
const withFocus = m => { if (!FOCUS_ON) return m; const f = readFocus(), out = { ...(m || {}) }; for (const k of f.hide) out[k] = false; return out; };
function useFocusOn() { const [on, setOn] = useState(FOCUS_ON); useEffect(() => { const f = () => setOn(FOCUS_ON); window.addEventListener('lifeos:modules', f); return () => window.removeEventListener('lifeos:modules', f); }, []); return on; }
function FocusChip() {
  const on = useFocusOn();
  if (!on) return null;
  const off = () => { const f = readFocus(); saveFocus(f.mode === 'auto' ? { ...f, snooze: tehranNow().day } : { ...f, mode: 'off' }); };
  return <button type="button" className="focus-chip" onClick={off} title="حالت تمرکز روشن است — بزن تا خاموش شود" aria-label="حالت تمرکز روشن است؛ خاموش کن"><Target size={15} /><span>تمرکز</span></button>;
}
function useModules(raw = false) {
  const [m0, setM] = useState(MODS_CACHE), focusOn = useFocusOn();
  const m = raw || !focusOn ? m0 : withFocus(m0);
  useEffect(() => {
    const f = () => setM(MODS_CACHE);
    window.addEventListener('lifeos:modules', f);
    if (!window.__modsFetched) { window.__modsFetched = true; api('/api/me').then(d => { if (d.user) { const lk = d.user.lockedModules || []; if (lk.join() !== LOCKS_CACHE.join()) { LOCKS_CACHE = lk; writeLs('lifeos-locks', lk); } setModules(d.user.modules || null, !d.user.modules); } }).catch(() => {}); }
    return () => window.removeEventListener('lifeos:modules', f);
  }, []);
  return m;
}
async function saveModules(m) { setModules(m); try { await api('/api/me', { method: 'PATCH', body: JSON.stringify({ modules: m }) }); } catch {} }
function ModulesPicker({ value, onChange }) {
  const cur = { ...Object.fromEntries(MODULES.map(([k]) => [k, modOn(value, k)])), ...(value || {}) };
  return <div className="mods-grid">{MODULES.map(([k, label, icon, sub]) => {
    const locked = LOCKS_CACHE.includes(k), on = !locked && (OPT_IN.has(k) ? cur[k] === true : cur[k] !== false);
    return <button type="button" key={k} className={`mods-item ${on ? 'on' : ''} ${locked ? 'locked' : ''}`} aria-pressed={on} disabled={locked} title={locked ? 'مدیر سایت این بخش را بسته است' : undefined} onClick={() => onChange({ ...cur, [k]: !on })}>
      <span className="mods-ic">{icon}</span><span className="mods-txt"><b>{label}</b><small>{sub}</small></span><i className="mods-check">{locked ? '🔒' : on ? '✓' : ''}</i>
    </button>;
  })}</div>;
}
function ModulesOnboarding() {
  const [open, setOpen] = useState(!!window.__needsOnboard);
  const [val, setVal] = useState(null);
  useEffect(() => { const f = () => setOpen(!!window.__needsOnboard); window.addEventListener('lifeos:modules', f); return () => window.removeEventListener('lifeos:modules', f); }, []);
  if (!open) return null;
  return <div className="mods-bg"><div className="mods-modal" dir="rtl">
    <h2>به چه چیزهایی علاقه داری؟</h2>
    <p>بخش‌هایی که استفاده نمی‌کنی را خاموش کن تا از منو، صفحهٔ اصلی و گزارش‌ها حذف شوند. بعداً از تنظیمات عوضش کن.</p>
    <ModulesPicker value={val} onChange={setVal} />
    <div className="mods-ops"><button type="button" className="save" onClick={() => { saveModules(val || Object.fromEntries(MODULES.map(([k]) => [k, true]))); setOpen(false); }}>شروع کن</button></div>
  </div></div>;
}
function HabitsMini() {
  const [items, setItems] = useState(null);
  const load = () => api(`/api/habits?date=${isoToday()}`).then(d => setItems(d.items || [])).catch(() => setItems([]));
  useEffect(() => { load(); }, []);
  const toggle = async h => { setItems(xs => xs.map(x => x.id === h.id ? { ...x, done: !x.done, streak: Math.max(0, (x.streak || 0) + (x.done ? -1 : 1)) } : x)); try { await api(`/api/habits/${h.id}/toggle`, { method: 'POST', body: JSON.stringify({ date: isoToday(), done: !h.done }) }); } catch { load(); } };
  const done = (items || []).filter(x => x.done).length;
  return <Card className="mini-card" icon={Flame} title="عادت‌های امروز" action={<a href="/?page=habits">همه ←</a>}>
    {items === null ? <p className="empty">در حال دریافت…</p> : !items.length ? <p className="empty">هنوز عادتی نساختی. <a href="/?page=habits">یکی بساز</a></p> : <>
      <div className="progress"><i style={{ width: `${items.length ? done / items.length * 100 : 0}%` }} /></div>
      <div className="mini-list">{items.map(h => <button type="button" key={h.id} className={`mini-habit ${h.done ? 'on' : ''}`} onClick={() => toggle(h)}><i>{h.done ? '✓' : h.icon || '○'}</i><span>{h.name}</span><small>🔥 {fa(h.streak || 0)}</small></button>)}</div>
    </>}
  </Card>;
}
function NotesMini() {
  const [items, setItems] = useState(null);
  useEffect(() => { api('/api/inbox').then(d => setItems((d.items || []).filter(x => !x.archived).sort((a, b) => (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0) || (b.updatedAt || b.createdAt || 0) - (a.updatedAt || a.createdAt || 0)).slice(0, 8))).catch(() => setItems([])); }, []);
  return <Card className="mini-card" icon={StickyNote} title="یادداشت‌ها" action={<a href="/?page=notes">همه ←</a>}>
    {items === null ? <p className="empty">در حال دریافت…</p> : !items.length ? <p className="empty">یادداشتی نیست.</p> :
      <div className="mini-list">{items.map(n => <a key={n.id} className="mini-note" href="/?page=notes"><b>{n.pinned ? '📌 ' : ''}{n.title || String(n.text || '').slice(0, 40)}</b>{n.title && n.text ? <small>{String(n.text).replace(/- \[[ x]\] /g, '• ').slice(0, 90)}</small> : null}</a>)}</div>}
  </Card>;
}
function GoalsMini() {
  const [items, setItems] = useState(null);
  useEffect(() => { api('/api/savings-goals').then(d => setItems(d.items || [])).catch(() => setItems([])); }, []);
  return <Card className="mini-card" icon={Wallet} title="اهداف پس‌انداز" action={<a href="/?page=finance&tab=wealth">همه ←</a>}>
    {items === null ? <p className="empty">در حال دریافت…</p> : !items.length ? <p className="empty">هدفی ثبت نشده. <a href="/?page=finance&tab=wealth">یکی بساز</a></p> :
      <div className="mini-list">{items.slice(0, 5).map(g => { const pct = g.target ? Math.min(100, Math.round(g.saved / g.target * 100)) : 0; return <div key={g.id} className="mini-goal"><div><span>{g.icon} {g.title}</span><b>{fa(pct)}٪</b></div><div className="progress"><i style={{ width: `${pct}%` }} /></div></div>; })}</div>}
  </Card>;
}
const dayTitle = isoD => { const t = isoToday(); const rel = isoD === t ? 'امروز · ' : isoD === addDaysIso(t, 1) ? 'فردا · ' : isoD === addDaysIso(t, -1) ? 'دیروز · ' : ''; return `${rel}${new Intl.DateTimeFormat('fa-IR', { weekday: 'long' }).format(fromIso(isoD))} ${jalaliDayLabel(isoD)}`; };
// `only` = 'fixtures' | 'results' shows just that list (the football page has one column each); `league` given = the
// parent owns the league (both columns follow one picker)
function Football({ full = false, onLeague, only, league: ownerLeague, favOnly }) {
  const controlled = ownerLeague !== undefined;
  const [ownLeague, setOwnLeague] = useState(null);
  const league = controlled ? ownerLeague : ownLeague, setLeague = controlled ? (v => onLeague?.(v)) : setOwnLeague;
  useEffect(() => { if (!controlled) pickNearestLeague().then(setOwnLeague); }, []);
  useEffect(() => { if (!controlled && league && onLeague) onLeague(league); }, [league]);
  const [favs, setFavs] = useState(() => readLs('lifeos-fav-teams', []));
  const [onlyFavState, setOnlyFav] = useState(false);
  const onlyFav = favOnly !== undefined ? favOnly : onlyFavState;
  const [tabState, setTab] = useState('fixtures');
  const tab = only || tabState;
  const [matches, setMatches] = useState([]), [notice, setNotice] = useState(''), [loading, setLoading] = useState(true);
  const fetchMatches = (fresh = false) => { if (!league) return; if (fresh) delete LEAGUE_CACHE[league]; return fetchLeague(league).then(items => { setMatches(items); setNotice(items.length ? '' : 'مسابقه‌ای دریافت نشد.'); }).catch(error => setNotice(error.message)).finally(() => setLoading(false)); };
  useEffect(() => { if (!league) return; setMatches([]); setLoading(true); fetchMatches(); }, [league]);
  const hasLive = matches.some(m => m.status === 'live');
  useEffect(() => { if (!hasLive) return; const t = setInterval(() => fetchMatches(true), 60000); return () => clearInterval(t); }, [hasLive, league]);
  const toggleFav = name => setFavs(f => { const n = f.includes(name) ? f.filter(x => x !== name) : [...f, name]; writeLs('lifeos-fav-teams', n); return n; });
  const isFav = m => favs.includes(m.home) || favs.includes(m.away);
  const ts = m => Date.parse(m.date) || 0;
  // the football page's columns show every match the server returns (≈60 days back, ≈3 weeks ahead)
  const weekAgo = only ? -Infinity : Date.now() - (full ? 14 : 7) * 86400000;
  const pool = matches.filter(m => !onlyFav || isFav(m));
  const span = (full ? 14 : 7) * 86400000;
  const weekAhead = only ? Infinity : Date.now() + span;
  const fixtures = [...pool.filter(m => m.status === 'live'), ...pool.filter(m => m.status === 'upcoming' && ts(m) <= weekAhead).sort((a, b) => ts(a) - ts(b))];
  const results = pool.filter(m => m.status === 'finished' && ts(m) >= weekAgo).sort((a, b) => ts(b) - ts(a));
  const list = tab === 'fixtures' ? fixtures : results;
  const when = m => { const d = new Date(m.date); if (isNaN(d)) return ''; const isoT = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Tehran', year: 'numeric', month: '2-digit', day: '2-digit' }).format(d); const t = isoToday(); const hmT = new Intl.DateTimeFormat('fa-IR', { timeZone: 'Asia/Tehran', hour: '2-digit', minute: '2-digit', hour12: false }).format(d); const dayL = isoT === t ? 'امروز' : isoT === addDaysIso(t, 1) ? 'فردا' : isoT === addDaysIso(t, -1) ? 'دیروز' : `${new Intl.DateTimeFormat('fa-IR', { weekday: 'short' }).format(fromIso(isoT))} ${jalaliDayLabel(isoT)}`; return m.status === 'finished' ? dayL : `${dayL} · ${hmT}`; };
  // long names (e.g. «استقلال خوزستان») stay on one line: a bit smaller font, then … with the full name on hover
  const team = (name, logo, side) => <span className={`team ${favs.includes(name) ? 'fav' : ''} ${String(name || '').length > 17 ? 'xlong' : String(name || '').length > 12 ? 'long' : ''}`} title={name}>{side === 'home' && <TeamBadge logo={logo} name={name} />}<button type="button" onClick={() => toggleFav(name)} title={favs.includes(name) ? 'حذف از تیم‌های من' : 'افزودن به تیم‌های من'}>{name}{favs.includes(name) && <Star size={11} fill="currentColor" />}</button>{side === 'away' && <TeamBadge logo={logo} name={name} />}</span>;
  return <Card className={`football ${full ? 'football-full' : ''} ${only ? 'fb-only-' + only : ''}`} icon={only === 'results' ? CheckCircle2 : Trophy} title={only === 'fixtures' ? 'برنامهٔ بازی‌ها' : only === 'results' ? 'نتایج' : full ? 'مسابقات' : 'فوتبال'} action={only ? null : full ? <small className="muted">۱۴ روز اخیر و پیش رو</small> : <a href="/?page=football">همه مسابقات ←</a>}>
    {only ? null : <div className="fb-tabs">
      <button type="button" className={tab === 'fixtures' ? 'on' : ''} onClick={() => setTab('fixtures')}>برنامهٔ بازی‌ها{hasLive && <i className="live-dot" title="بازی زنده" />}</button>
      <button type="button" className={tab === 'results' ? 'on' : ''} onClick={() => setTab('results')}>{full ? 'نتایج' : 'نتایج هفتهٔ قبل'}</button>
      {favs.length > 0 && <button type="button" className={`fav-toggle ${onlyFav ? 'on' : ''}`} onClick={() => setOnlyFav(v => !v)}><Star size={12} fill={onlyFav ? 'currentColor' : 'none'} />تیم‌های من</button>}
    </div>}
    {!only && <LeaguePicker value={league} onChange={setLeague} />}
    <div className="fb-list">{list.length ? (() => { let lastDay = null, lastGrp = null; return list.map((m, index) => {
      // results rebuilt from a table's last-5 have no real date: grouped by «آخرین بازی / بازی قبلی / …»
      const dayKey = m.status === 'live' ? 'live' : m.approx ? 'r:' + m.round : new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Tehran' }).format(new Date(m.date));
      const newDay = dayKey !== lastDay, head = newDay ? <div className="fb-day">{dayKey === 'live' ? '● در حال بازی' : m.approx ? `${m.round} هر تیم` : dayTitle(dayKey)}</div> : null; lastDay = dayKey;
      const grpHead = m.group && (newDay || m.group !== lastGrp) ? <div className="fb-grp">{m.group}</div> : null; lastGrp = m.group || null;
      const hmT = new Intl.DateTimeFormat('fa-IR', { timeZone: 'Asia/Tehran', hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date(m.date));
      return <React.Fragment key={m.fixtureId || m.id || index}>{head}{grpHead}<div className={`score-row ${isFav(m) ? 'is-fav' : ''} ${m.status === 'live' ? 'is-live' : ''}`}>
        <small className={m.status === 'live' ? 'live' : ''}>{m.status === 'live' ? 'زنده' : m.status === 'finished' ? 'پایان' : hmT}</small>
        {team(m.home, m.homeLogo, 'home')}
        <b>{m.status === 'upcoming' || !/\d/.test(m.score || '') ? '—' : faDigits(m.score)}</b>
        {team(m.away, m.awayLogo, 'away')}
      </div></React.Fragment>;
    }); })() : <p className="empty">{loading ? 'در حال دریافت…' : notice || (only ? (onlyFav ? (tab === 'fixtures' ? 'تیم‌هات بازی پیش رو ندارن.' : 'از تیم‌هات نتیجه‌ای نیست.') : tab === 'fixtures' ? 'بازی پیش رویی در دسترس نیست.' : 'نتیجه‌ای در دسترس نیست.') : onlyFav ? (tab === 'fixtures' ? 'تیم‌هات این هفته بازی ندارن.' : 'تیم‌هات هفتهٔ قبل بازی نداشتن.') : tab === 'fixtures' ? 'این هفته بازی‌ای نیست.' : 'نتیجه‌ای برای هفتهٔ قبل نیست.')}</p>}</div>
    {!favs.length && list.length > 0 && <small className="hint">روی اسم هر تیم بزن تا به «تیم‌های من» اضافه بشه.</small>}
  </Card>;
}

const WEATHER_TEXT = code => code === 0 ? 'صاف' : code <= 2 ? 'کمی ابری' : code === 3 ? 'ابری' : code <= 48 ? 'مه' : code <= 57 ? 'نم‌نم باران' : code <= 67 ? 'بارانی' : code <= 77 ? 'برفی' : code <= 82 ? 'رگبار' : code <= 86 ? 'بارش برف' : 'رعد و برق';
const WEATHER_ICON = (code, day = 1) => code === 0 ? (day ? '☀️' : '🌙') : code <= 2 ? (day ? '🌤️' : '☁️') : code === 3 ? '☁️' : code <= 48 ? '🌫️' : code <= 67 ? '🌧️' : code <= 77 ? '❄️' : code <= 82 ? '🌦️' : code <= 86 ? '🌨️' : '⛈️';
const AQI_LEVEL = v => v == null ? null : v <= 50 ? ['پاک', 'good'] : v <= 100 ? ['قابل قبول', 'ok'] : v <= 150 ? ['ناسالم برای حساس‌ها', 'warn'] : v <= 200 ? ['ناسالم', 'bad'] : v <= 300 ? ['بسیار ناسالم', 'bad'] : ['خطرناک', 'bad'];
const hm = iso => faDigits(String(iso || '').slice(11, 16));

const addDaysIso = (isoDate, n) => iso(addDays(fromIso(isoDate), n));
let IRAN_EVENTS_PROMISE = null;
const loadIranEvents = () => (IRAN_EVENTS_PROMISE ||= fetch('/data/iran-events.json').then(r => r.json()).catch(() => ({})));
const jKey = (jy, jm, jd) => `${jy}${String(jm).padStart(2, '0')}${String(jd).padStart(2, '0')}`;

function monthCells(jy, jm) {
  const first = toGregorian(jy, jm, 1), len = jalaliMonthLength(jy, jm);
  return { first, lead: weekdayIndex(first), days: [...Array(len)].map((_, i) => addDays(first, i)) };
}

// Closes a popover when the user clicks/taps outside it or presses Escape.
function useDismiss(ref, onClose) {
  useEffect(() => {
    const down = e => { if (ref.current && !ref.current.contains(e.target)) onClose(); };
    const key = e => { if (e.key === 'Escape') onClose(); };
    const t = setTimeout(() => { document.addEventListener('pointerdown', down); }, 0);
    window.addEventListener('keydown', key);
    return () => { clearTimeout(t); document.removeEventListener('pointerdown', down); window.removeEventListener('keydown', key); };
  }, []);
}

function JalaliPicker({ value, today, onPick, onClose, anchor }) {
  const start = toJalali(fromIso(value || today));
  const [ym, setYm] = useState({ jy: start.jy, jm: start.jm });
  const [events, setEvents] = useState({});
  const ref = React.useRef(null);
  useDismiss(anchor || ref, onClose);
  useEffect(() => { loadIranEvents().then(setEvents); }, []);
  const { lead, days } = monthCells(ym.jy, ym.jm);
  const shift = n => setYm(({ jy, jm }) => { const m = jm + n; return m < 1 ? { jy: jy - 1, jm: 12 } : m > 12 ? { jy: jy + 1, jm: 1 } : { jy, jm: m }; });
  return <div className="jpicker" role="dialog" aria-label="انتخاب تاریخ" ref={ref}>
    <div className="jp-head"><button type="button" onClick={() => shift(-1)} aria-label="ماه قبل"><ChevronRight size={16} /></button><b>{JALALI_MONTHS[ym.jm - 1]} {faDigits(ym.jy)}</b><button type="button" onClick={() => shift(1)} aria-label="ماه بعد"><ChevronLeft size={16} /></button></div>
    <div className="jp-grid">{WEEKDAYS.map((w, i) => <small key={w} className={i === 6 ? 'is-fri' : ''}>{w}</small>)}{[...Array(lead)].map((_, i) => <span key={'b' + i} />)}{days.map((d, i) => {
      const v = iso(d), occ = events[jKey(ym.jy, ym.jm, i + 1)] || [], off = weekdayIndex(d) === 6 || occ.some(e => e.h);
      return <button type="button" key={v} disabled={v < today} title={occ.map(e => e.t.replace(/\[.*?\]/g, '').trim()).join('\n')} className={`jp-day ${v === today ? 'is-today' : ''} ${v === value ? 'is-sel' : ''} ${off ? 'is-off' : ''}`} onClick={() => onPick(v)}>{faDigits(i + 1)}</button>;
    })}</div>
    <div className="jp-foot"><button type="button" onClick={() => onPick(today)}>امروز</button><button type="button" onClick={() => onPick(addDaysIso(today, 1))}>فردا</button><button type="button" onClick={() => onPick(addDaysIso(today, 7))}>هفتهٔ بعد</button></div>
  </div>;
}

const HOURS = [...Array(24)].map((_, i) => String(i).padStart(2, '0'));
const MINUTES = ['00', '05', '10', '15', '20', '25', '30', '35', '40', '45', '50', '55'];
function TimePicker({ value, onChange }) {
  const [open, setOpen] = useState(false);
  const [h, m] = (value || '').split(':');
  const wrap = React.useRef(null);
  const set = (hh, mm) => onChange(`${hh}:${mm}`);
  return <div className="tpick" ref={wrap}>
    <button type="button" className={`tpick-btn ${value ? 'has' : ''}`} onClick={() => setOpen(o => !o)} aria-label="انتخاب ساعت"><Clock size={15} /><span>{value ? faDigits(value) : 'ساعت'}</span></button>
    {value && <button type="button" className="tpick-clear" onClick={() => onChange('')} aria-label="حذف ساعت"><X size={13} /></button>}
    {open && <TimePopover h={h} m={m} set={set} onClose={() => setOpen(false)} anchor={wrap} />}
  </div>;
}
function TimePopover({ h, m, set, onClose, anchor }) {
  useDismiss(anchor, onClose);
  const presets = ['08:00', '09:00', '12:00', '14:00', '17:00', '20:00'];
  return <div className="tpop" role="dialog" aria-label="انتخاب ساعت">
    <div className="tpop-presets">{presets.map(p => <button type="button" key={p} className={`${h}:${m}` === p ? 'on' : ''} onClick={() => { set(...p.split(':')); onClose(); }}>{faDigits(p)}</button>)}</div>
    <small>ساعت</small>
    <div className="tpop-hours">{HOURS.map(x => <button type="button" key={x} className={x === h ? 'on' : ''} onClick={() => set(x, m || '00')}>{faDigits(x)}</button>)}</div>
    <small>دقیقه</small>
    <div className="tpop-mins">{MINUTES.map(x => <button type="button" key={x} className={x === m ? 'on' : ''} onClick={() => { set(h || '09', x); onClose(); }}>{faDigits(x)}</button>)}</div>
  </div>;
}

const WORLD_ZONES = [['استانبول', 'Europe/Istanbul'], ['دبی', 'Asia/Dubai'], ['استکهلم', 'Europe/Stockholm'], ['لندن', 'Europe/London'], ['پاریس', 'Europe/Paris'], ['برلین', 'Europe/Berlin'], ['مسکو', 'Europe/Moscow'], ['کابل', 'Asia/Kabul'], ['دهلی', 'Asia/Kolkata'], ['پکن', 'Asia/Shanghai'], ['توکیو', 'Asia/Tokyo'], ['سیدنی', 'Australia/Sydney'], ['نیویورک', 'America/New_York'], ['تورنتو', 'America/Toronto'], ['لس‌آنجلس', 'America/Los_Angeles']];
const zoneParts = (d, tz) => Object.fromEntries(new Intl.DateTimeFormat('en-GB', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }).formatToParts(d).map(p => [p.type, p.value]));
const zoneMinutes = (d, tz) => { const p = zoneParts(d, tz); return Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour % 24, +p.minute) / 60000; };
function DigitalClock() {
  const [now, setNow] = useState(() => new Date());
  const [zones] = useState(() => readLs('lifeos-world-clocks', []).filter(e => zoneOk(String(e).split('|')[0])).slice(0, 3));
  useEffect(() => { const t = setInterval(() => setNow(new Date()), 1000); return () => clearInterval(t); }, []);
  const parts = zoneParts(now, 'Asia/Tehran');
  const tehranMin = zoneMinutes(now, 'Asia/Tehran');
  return <div className="clock-row">
    <div className="dclock" aria-label="ساعت تهران" dir="ltr">
      <b>{faDigits(parts.hour)}</b><i className={Number(parts.second) % 2 ? 'blink' : ''}>:</i><b>{faDigits(parts.minute)}</b><small>{faDigits(parts.second)}</small>
      <span>به وقت تهران</span>
    </div>
    {zones.map(entry => {
      const tz = String(entry).split('|')[0], p = zoneParts(now, tz), diff = zoneMinutes(now, tz) - tehranMin, h = +p.hour % 24, night = h < 6 || h >= 19;
      const dh = Math.trunc(Math.abs(diff) / 60), dm = Math.abs(diff) % 60;
      const name = clockName(entry);
      return <div className="wclock" key={entry}>
        <small>{name} {night ? '🌙' : '☀️'}</small>
        <b dir="ltr">{faDigits(`${p.hour}:${p.minute}`)}</b>
        <span>{diff === 0 ? 'هم‌ساعت تهران' : `${[dh ? `${fa(dh)} ساعت` : '', dm ? `${fa(dm)} دقیقه` : ''].filter(Boolean).join(' و ')} ${diff > 0 ? 'جلوتر' : 'عقب‌تر'}`}</span>
      </div>;
    })}
  </div>;
}

const DEFAULT_CITY = { name: 'تهران', lat: 35.69, lon: 51.39 };
const IR_CITIES = [['تهران', 35.69, 51.39], ['مشهد', 36.30, 59.61], ['اصفهان', 32.65, 51.67], ['کرج', 35.84, 50.94], ['شیراز', 29.59, 52.58], ['تبریز', 38.08, 46.29], ['قم', 34.64, 50.88], ['اهواز', 31.32, 48.67], ['کرمانشاه', 34.31, 47.07], ['رشت', 37.28, 49.58], ['یزد', 31.90, 54.37], ['کرمان', 30.28, 57.08], ['همدان', 34.80, 48.51], ['ارومیه', 37.55, 45.08], ['بندرعباس', 27.18, 56.27], ['ساری', 36.56, 53.06], ['کیش', 26.53, 53.98]];
function CityPicker({ city, onPick }) {
  const [open, setOpen] = useState(false);
  const wrap = React.useRef(null);
  return <span className="citypick" ref={wrap}>
    <button type="button" className="city-btn" onClick={() => setOpen(o => !o)}>{city.name}<ChevronDown size={15} /></button>
    {open && <CityPopover anchor={wrap} onClose={() => setOpen(false)} onPick={c => { onPick(c); setOpen(false); }} current={city} />}
  </span>;
}
function CityPopover({ anchor, onClose, onPick, current }) {
  useDismiss(anchor, onClose);
  const [q, setQ] = useState(''), [found, setFound] = useState([]), [busy, setBusy] = useState(false);
  useEffect(() => {
    const term = q.trim(); if (term.length < 2) { setFound([]); return; }
    const t = setTimeout(() => { setBusy(true); fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(term)}&count=6&language=fa&format=json`).then(r => r.json()).then(d => setFound((d.results || []).map(r => ({ name: r.name, sub: [r.admin1, r.country].filter(Boolean).join('، '), lat: r.latitude, lon: r.longitude })))).catch(() => setFound([])).finally(() => setBusy(false)); }, 350);
    return () => clearTimeout(t);
  }, [q]);
  const local = IR_CITIES.filter(([n]) => !q.trim() || n.includes(q.trim())).map(([name, lat, lon]) => ({ name, lat, lon }));
  return <div className="citypop" role="dialog" aria-label="انتخاب شهر">
    <input autoFocus value={q} onChange={e => setQ(e.target.value)} placeholder="جستجوی شهر (فارسی یا انگلیسی)" />
    <div className="citylist">
      {local.map(c => <button type="button" key={c.name} className={c.name === current.name ? 'on' : ''} onClick={() => onPick(c)}>{c.name}</button>)}
      {found.filter(f => !local.some(l => l.name === f.name)).map((c, i) => <button type="button" key={'g' + i} className="wide" onClick={() => onPick({ name: c.name, lat: c.lat, lon: c.lon })}>{c.name}<small>{c.sub}</small></button>)}
      {busy && <small className="muted">در حال جستجو…</small>}
    </div>
  </div>;
}

function LiveCalendar({ today }) {
  const t = toJalali(fromIso(today));
  const [ym, setYm] = useState({ jy: t.jy, jm: t.jm });
  const [items, setItems] = useState([]);
  const [events, setEvents] = useState({});
  const [note, setNote] = useState('');
  const { lead, days } = monthCells(ym.jy, ym.jm);
  const from = iso(days[0]), to = iso(days[days.length - 1]);
  useEffect(() => { loadIranEvents().then(setEvents); }, []);
  useEffect(() => {
    let live = true;
    api(`/api/calendar/feed?from=${from}&to=${to}`).then(d => { if (!live) return; setItems(d.items || []); setNote(d.googleError || ''); }).catch(() => live && setItems([]));
    return () => { live = false; };
  }, [from, to]);
  const shift = n => setYm(({ jy, jm }) => { const m = jm + n; return m < 1 ? { jy: jy - 1, jm: 12 } : m > 12 ? { jy: jy + 1, jm: 1 } : { jy, jm: m }; });
  const goToday = () => setYm({ jy: t.jy, jm: t.jm });
  // Untimed tasks/reminders live in the tasks card — the calendar marks timed items and external events only.
  const dayItems = d => items.filter(ev => (ev.source !== 'lifeos' || ev.time) && eventOnDate(ev, d));
  const todayCount = dayItems(fromIso(today)).length;
  const nowHm = new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Asia/Tehran' }).format(new Date());
  return <Card className="calendar live-cal" icon={CalendarDays} title={`${JALALI_MONTHS[ym.jm - 1]} ${faDigits(ym.jy)}`} action={<div className="lc-nav"><button type="button" onClick={() => setYm(({ jy, jm }) => ({ jy: jy - 1, jm }))} aria-label="سال قبل"><ChevronsRight size={15} /></button><button type="button" onClick={() => shift(-1)} aria-label="ماه قبل"><ChevronRight size={15} /></button>{(ym.jy !== t.jy || ym.jm !== t.jm) && <button type="button" className="lc-today" onClick={goToday}>امروز</button>}<button type="button" onClick={() => shift(1)} aria-label="ماه بعد"><ChevronLeft size={15} /></button><button type="button" onClick={() => setYm(({ jy, jm }) => ({ jy: jy + 1, jm }))} aria-label="سال بعد"><ChevronsLeft size={15} /></button></div>}>
    <div className="weekdays">{WEEKDAYS.map(x => <span key={x}>{x}</span>)}</div>
    <div className="calendar-days">{[...Array(lead)].map((_, i) => <span key={`blank${i}`} />)}{days.map((day, i) => {
      const v = iso(day), evs = events[jKey(ym.jy, ym.jm, i + 1)] || [], holiday = weekdayIndex(day) === 6 || evs.some(e => e.h), n = dayItems(day).length;
      const tip = [...evs.map(e => e.t.replace(/\[.*?\]/g, '').trim()), ...dayItems(day).map(ev => `${ev.time ? faDigits(ev.time) + ' · ' : ''}${ev.title}`)].join('\n');
      return <button type="button" key={v} title={tip} className={`${v === today ? 'today' : ''} ${holiday ? 'holiday' : ''}`} onClick={() => { location.href = '/?page=calendar'; }}>{faDigits(i + 1)}{n > 0 && <i className="dot" />}</button>;
    })}</div>
    <div className="lc-foot"><span>{todayCount ? `امروز ${fa(todayCount)} برنامهٔ ساعت‌دار` : 'امروز برنامهٔ ساعت‌داری نداری'}</span><a href="/?page=calendar">تقویم کامل ←</a></div>
  </Card>;
}

// ---- draggable card layout (order saved per browser) ----
const LAYOUT_KEY = id => `lifeos-home-layout-${id}`;
const LAYOUT_LABELS = { day: 'تاریخ', weather: 'هوا', calendar: 'تقویم', market: 'بازارها', agenda: 'کارها و یادآوری‌ها', finance: 'مالی', football: 'فوتبال', series: 'سریال‌ها', daily: 'ثبت روزانه', focus: 'تمرکز', bills: 'قبض‌ها', habits: 'عادت‌ها', notes: 'یادداشت‌ها', goals: 'اهداف', insights: 'بینش' };
const resetLayouts = () => { ['top', 'grid'].forEach(id => { try { localStorage.removeItem(LAYOUT_KEY(id)); } catch {} }); window.dispatchEvent(new Event('lifeos-layout-reset')); };
function Layout({ id, className, cards, editing }) {
  const keys = Object.keys(cards);
  const read = () => { const saved = readLs(LAYOUT_KEY(id), []); const valid = saved.filter(k => keys.includes(k)); return [...valid, ...keys.filter(k => !valid.includes(k))]; };
  const [order, setOrder] = useState(read);
  const keySig = keys.join('|');
  useEffect(() => { setOrder(read()); }, [keySig]);
  const [drag, setDrag] = useState(null), [over, setOver] = useState(null);
  useEffect(() => { const r = () => setOrder(keys); window.addEventListener('lifeos-layout-reset', r); return () => window.removeEventListener('lifeos-layout-reset', r); }, []);
  const save = next => { setOrder(next); writeLs(LAYOUT_KEY(id), next); };
  const move = (from, to) => { if (from === to || to < 0 || to >= order.length) return; const next = [...order]; const [k] = next.splice(from, 1); next.splice(to, 0, k); save(next); };
  return <div className={`${className} ${editing ? 'layout-editing' : ''}`}>
    {order.map((k, i) => <div key={k} className={`slot slot-${k} ${drag === k ? 'dragging' : ''} ${over === k && drag && drag !== k ? 'drop-target' : ''}`}
      draggable={editing}
      onDragStart={e => { if (!editing) return; setDrag(k); e.dataTransfer.effectAllowed = 'move'; try { e.dataTransfer.setData('text/plain', k); } catch {} }}
      onDragOver={e => { if (!editing || !drag) return; e.preventDefault(); setOver(k); }}
      onDragLeave={() => setOver(o => o === k ? null : o)}
      onDrop={e => { e.preventDefault(); if (drag) move(order.indexOf(drag), i); setDrag(null); setOver(null); }}
      onDragEnd={() => { setDrag(null); setOver(null); }}>
      {editing && <div className="slot-bar"><GripVertical size={16} /><b>{LAYOUT_LABELS[k] || k}</b><button type="button" onClick={() => move(i, i - 1)} disabled={i === 0} aria-label="جابه‌جایی به عقب"><ChevronRight size={16} /></button><button type="button" onClick={() => move(i, i + 1)} disabled={i === order.length - 1} aria-label="جابه‌جایی به جلو"><ChevronLeft size={16} /></button></div>}
      {cards[k]}
    </div>)}
  </div>;
}

const SEASONS = [['بهار', 1], ['تابستان', 4], ['پاییز', 7], ['زمستان', 10]];
function DayCard({ today, greeting, summary, streak }) {
  const d = fromIso(today), j = toJalali(d);
  const dayIndex = Math.floor(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / 86400000);
  const photo = photoOfDay(j.jm, dayIndex);
  const [src, setSrc] = useState(photo.local);
  const [events, setEvents] = useState({});
  const [bdays, setBdays] = useState([]);
  useEffect(() => {
    api('/api/contacts').then(r => {
      setBdays((r.items || []).map(c => {
        const m = String(c.birthday || '').match(/^(\d{4})-(\d{2})-(\d{2})/); if (!m) return null;
        let next = new Date(d.getFullYear(), Number(m[2]) - 1, Number(m[3])); if (next < d) next = new Date(d.getFullYear() + 1, Number(m[2]) - 1, Number(m[3]));
        return { name: c.name, days: Math.round((next - d) / 86400000) };
      }).filter(x => x && x.days <= 7).sort((a, b) => a.days - b.days));
    }).catch(() => {});
  }, [today]);
  useEffect(() => { loadIranEvents().then(setEvents); }, []);
  const todayEvents = (events[jKey(j.jy, j.jm, j.jd)] || []).map(e => ({ ...e, t: e.t.replace(/\[.*?\]/g, '').trim() }));
  const isFri = weekdayIndex(d) === 6, offEvent = todayEvents.find(e => e.h);
  const holidayReason = offEvent ? offEvent.t : isFri ? 'جمعه' : '';
  // next official holiday (for the empty state)
  let nextOff = null;
  if (!todayEvents.length) for (let i = 1; i <= 200; i++) { const dt = addDays(d, i), jj = toJalali(dt), h = (events[jKey(jj.jy, jj.jm, jj.jd)] || []).find(e => e.h); if (h) { nextOff = { days: i, t: h.t.replace(/\[.*?\]/g, '').trim() }; break; } }
  // year / season progress
  const yearStart = toGregorian(j.jy, 1, 1), yearLen = jalaliMonthLength(j.jy, 12) === 30 ? 366 : 365;
  const dayOfYear = Math.round((d - yearStart) / 86400000) + 1;
  const week = Math.ceil((dayOfYear + weekdayIndex(yearStart)) / 7);
  const sIdx = Math.floor((j.jm - 1) / 3), sStart = toGregorian(j.jy, SEASONS[sIdx][1], 1);
  const sEnd = sIdx === 3 ? toGregorian(j.jy + 1, 1, 1) : toGregorian(j.jy, SEASONS[sIdx + 1][1], 1);
  const sLen = Math.round((sEnd - sStart) / 86400000), sDay = Math.round((d - sStart) / 86400000) + 1;
  const greg = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }).format(d);
  const onError = () => setSrc(cur => cur === photo.local ? photo.remote : '/assets/img/mountains-dusk.jpg');
  return <Card className={`day-card dc2 season-${photo.season}`} title={new Intl.DateTimeFormat('fa-IR', { weekday: 'long' }).format(d)} action={holidayReason ? <span className="holiday-tag">تعطیل · {holidayReason.length > 22 ? holidayReason.slice(0, 22) + '…' : holidayReason}</span> : null}>
    <img className="hero-bg-img" src={src} onError={onError} alt="" />
    <div className="hero-bg-fade" />
    <div className="dc-hello">
      <h2>{greeting}</h2>
      {summary && <p>{summary}</p>}
      {streak > 0 && <span className="dc-streak"><Flame size={13} />{fa(streak)} روز پیوسته ثبت روزانه</span>}
    </div>
    <div className="dc-panel">
      <div className="dc-main">
        <div className="dc-num">{faDigits(j.jd)}</div>
        <div className="dc-dates">
          <b>{JALALI_MONTHS[j.jm - 1]} {faDigits(j.jy)}</b>
          <span dir="ltr" className="dc-greg">{greg}</span>
        </div>
      </div>
      <div className="dc-progress">
        <div><span>{SEASONS[sIdx][0]} · روز {fa(sDay)} از {fa(sLen)}</span><i><em style={{ width: `${sDay / sLen * 100}%` }} /></i></div>
        <div><span>روز {fa(dayOfYear)} سال · هفتهٔ {fa(week)}</span><i><em style={{ width: `${dayOfYear / yearLen * 100}%` }} /></i></div>
      </div>
      <div className="dc-chips">
        {bdays.slice(0, 2).map((b, i) => <a key={'b' + i} href="/?page=contacts" className="dc-chip bday"><Cake size={13} />{b.days === 0 ? `تولد ${b.name} · امروز 🎉` : b.days === 1 ? `تولد ${b.name} · فردا` : `تولد ${b.name} · ${fa(b.days)} روز دیگه`}</a>)}
        {todayEvents.slice(0, 3).map((e, i) => <span key={i} className={`dc-chip ${e.h ? 'off' : ''}`}>{e.t}</span>)}
        {!todayEvents.length && !bdays.length && nextOff && <span className="dc-chip muted">تعطیلی بعدی: {nextOff.days === 1 ? 'فردا' : `${fa(nextOff.days)} روز دیگه`} · {nextOff.t}</span>}
      </div>
    </div>
  </Card>;
}

// Picks a background scene from the current weather code, day/night and closeness to sunrise/sunset.
function sceneOf(c, dl) {
  const code = c.weather_code, t = String(c.time || '');
  const near = iso => { if (!iso) return false; const d = Math.abs(Date.parse(iso) - Date.parse(t)); return d < 50 * 60000; };
  if (code >= 95) return 'storm';
  if ((code >= 71 && code <= 77) || code === 85 || code === 86) return 'snow';
  if ((code >= 51 && code <= 67) || (code >= 80 && code <= 82)) return 'rain';
  if (code === 45 || code === 48) return 'fog';
  if (code === 3) return c.is_day ? 'cloudy' : 'cloudy-night';
  if (near(dl.sunset?.[0]) || near(dl.sunrise?.[0])) return 'golden';
  if (!c.is_day) return code === 0 ? 'clear-night' : 'partly-night';
  return code === 0 ? 'clear-day' : 'partly-day';
}
function WeatherScene({ kind }) {
  const night = /night/.test(kind), cloudy = /partly|cloudy|rain|storm|snow|fog/.test(kind);
  const drops = kind === 'rain' || kind === 'storm' ? 70 : kind === 'snow' ? 55 : 0;
  return <div className={`wx-scene wx-${kind}`} aria-hidden="true">
    {(kind === 'clear-day' || kind === 'partly-day' || kind === 'golden') && <i className="wx-sun" />}
    {night && <><i className="wx-stars" /><i className="wx-moon" /></>}
    {cloudy && <><i className="wx-cloud c1" /><i className="wx-cloud c2" /><i className="wx-cloud c3" /></>}
    {kind === 'fog' && <><i className="wx-fog f1" /><i className="wx-fog f2" /></>}
    {kind === 'storm' && <i className="wx-flash" />}
    {drops > 0 && <div className={kind === 'snow' ? 'wx-snow' : 'wx-rain'}>{[...Array(drops)].map((_, i) => <b key={i} style={{ left: `${(i * 37) % 100}%`, animationDelay: `${((i * 53) % 100) / 50}s`, animationDuration: `${kind === 'snow' ? 4 + (i % 5) : 0.6 + (i % 4) * 0.12}s` }} />)}</div>}
    <i className="wx-fade" />
  </div>;
}

const UV_LEVEL = v => v < 3 ? 'کم' : v < 6 ? 'متوسط' : v < 8 ? 'زیاد' : v < 11 ? 'خیلی زیاد' : 'شدید';
function WeatherCard({ weather, aqi, city, onCity }) {
  const cityTitle = <CityPicker city={city} onPick={onCity} />;
  if (!weather) return <Card className="weather wx2" icon={MapPin} title={cityTitle}><WeatherScene kind="clear-day" /><p className="empty weather-loading">در حال دریافت وضعیت هوا…</p></Card>;
  const c = weather.current, dl = weather.daily, hr = weather.hourly || {}, lvl = AQI_LEVEL(aqi?.us_aqi);
  const nowIdx = Math.max(0, (hr.time || []).findIndex(t => t >= c.time.slice(0, 13)));
  const hours = (hr.time || []).slice(nowIdx, nowIdx + 13).map((t, i) => ({ t, temp: hr.temperature_2m[nowIdx + i], code: hr.weather_code?.[nowIdx + i], day: hr.is_day?.[nowIdx + i] ?? 1 }));
  const feels = Math.round(c.apparent_temperature), temp = Math.round(c.temperature_2m), fd = feels - temp;
  const feelsNote = fd >= 2 ? 'به‌خاطر رطوبت گرم‌تر حس می‌شه' : fd <= -2 ? (c.wind_speed_10m > 15 ? 'باد باعث می‌شه خنک‌تر حس بشه' : 'خنک‌تر از دمای واقعی') : 'نزدیک به دمای واقعی';
  const uv = Math.round(c.uv_index ?? dl.uv_index_max?.[0] ?? 0);
  const days = dl.time.slice(0, 6).map((d, i) => ({ d, i, lo: dl.temperature_2m_min[i], hi: dl.temperature_2m_max[i], code: dl.weather_code[i] }));
  const wLo = Math.min(...days.map(x => x.lo)), wHi = Math.max(...days.map(x => x.hi)), span = wHi - wLo || 1;
  return <Card className="weather wx2" icon={MapPin} title={cityTitle} action={<small>{WEATHER_TEXT(c.weather_code)}</small>}>
    <WeatherScene kind={sceneOf(c, dl)} />
    <div className="wx-body">
      <div className="wx-hero">
        <strong>{fa(temp)}°</strong>
        <div className="wx-hero-meta">
          <b>حس‌شده {fa(feels)}°</b>
          <span>بیشینه {fa(Math.round(dl.temperature_2m_max[0]))}° · کمینه {fa(Math.round(dl.temperature_2m_min[0]))}°</span>
        </div>
      </div>
      <div className="wx-panel wx-hours" tabIndex={0} role="region" aria-label="پیش‌بینی ساعتی">{hours.map((h, i) => <div key={h.t}><small>{i === 0 ? 'اکنون' : faDigits(h.t.slice(11, 13))}</small><span>{h.code != null ? WEATHER_ICON(h.code, h.day) : ''}</span><b>{fa(Math.round(h.temp))}°</b></div>)}</div>
      <div className="wx-tiles">
        <div className="wx-tile"><small>🌡️ حس‌شده</small><b>{fa(feels)}°</b><span>{feelsNote}</span></div>
        <div className="wx-tile"><small>☀️ شاخص UV</small><b>{fa(uv)} <em>{UV_LEVEL(uv)}</em></b><i className="wx-meter uv"><u style={{ insetInlineStart: `${Math.min(100, uv / 11 * 100)}%` }} /></i></div>
        {lvl ? <div className="wx-tile"><small>😷 کیفیت هوا</small><b>{fa(Math.round(aqi.us_aqi))}</b><span>{lvl[0]}</span><i className="wx-meter aqim"><u style={{ insetInlineStart: `${Math.min(100, aqi.us_aqi / 300 * 100)}%` }} /></i></div>
          : <div className="wx-tile"><small>💧 رطوبت</small><b>{fa(c.relative_humidity_2m)}٪</b></div>}
        <div className="wx-tile"><small>💨 باد</small><b>{fa(Math.round(c.wind_speed_10m))} <em>km/h</em></b><span>رطوبت {fa(c.relative_humidity_2m)}٪</span></div>
        <div className="wx-tile"><small>🌅 طلوع / غروب</small><b>{hm(dl.sunset?.[0])}</b><span>طلوع {hm(dl.sunrise?.[0])}</span></div>
        <div className="wx-tile"><small>☔ بارش</small><b>{fa(dl.precipitation_probability_max?.[0] ?? 0)}٪</b><span>احتمال امروز</span></div>
      </div>
      <div className="wx-panel wx-days">{days.map(x => <div key={x.d}>
        <span className="wd">{x.i === 0 ? 'امروز' : new Intl.DateTimeFormat('fa-IR', { weekday: 'long' }).format(new Date(`${x.d}T12:00`))}</span>
        <span className="wi">{WEATHER_ICON(x.code)}</span>
        <small>{fa(Math.round(x.lo))}°</small>
        <i className="wx-range"><u style={{ insetInlineStart: `${(x.lo - wLo) / span * 100}%`, insetInlineEnd: `${(wHi - x.hi) / span * 100}%` }} />{x.i === 0 && <em style={{ insetInlineStart: `${Math.min(100, Math.max(0, (temp - wLo) / span * 100))}%` }} />}</i>
        <b>{fa(Math.round(x.hi))}°</b>
      </div>)}</div>
    </div>
  </Card>;
}

// Team names come from different sources per league (e.g. UNL: matches from Varzesh3 in Persian, the table in
// English), so names are compared through a key: English country names → Persian via the browser's region names
// (plus the UK nations), then spacing / Arabic letters normalized.
const TEAM_EN_FA = (() => {
  const out = { 'england': 'انگلیس', 'scotland': 'اسکاتلند', 'wales': 'ولز', 'northern ireland': 'ایرلند شمالی', 'turkey': 'ترکیه', 'bosnia and herzegovina': 'بوسنی و هرزگوین', 'czech republic': 'جمهوری چک', 'republic of ireland': 'ایرلند', 'kosovo': 'کوزوو' };
  try {
    const en = new Intl.DisplayNames(['en'], { type: 'region' }), faN = new Intl.DisplayNames(['fa'], { type: 'region' }), A = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    for (const x of A) for (const y of A) { const c = x + y, e = en.of(c), f = faN.of(c); if (e && f && e !== c && !out[e.toLowerCase()]) out[e.toLowerCase().replace(/&/g, 'and')] = f; }
  } catch { /* old browsers: only the manual names */ }
  return out;
})();
const teamKey = name => { const n = String(name || '').trim(), fa = TEAM_EN_FA[n.toLowerCase().replace(/&/g, 'and')] || n; return fa.replace(/[\s\u200c\-.]+/g, '').replace(/ي/g, 'ی').replace(/ك/g, 'ک').toLowerCase(); };
const sameTeam = (a, b) => teamKey(a) === teamKey(b);
// Result of a finished match from one team's point of view: 'W' | 'D' | 'L' | null
const resultFor = (m, team) => { const sc = String(m.score || '').match(/(\d+)\s*-\s*(\d+)/); if (!sc) return null; const h = +sc[1], a = +sc[2], home = sameTeam(m.home, team); const mine = home ? h : a, theirs = home ? a : h; return mine > theirs ? 'W' : mine < theirs ? 'L' : 'D'; };
const formOf = (matches, team, n = 5) => matches.filter(m => m.status === 'finished' && (sameTeam(m.home, team) || sameTeam(m.away, team))).sort((a, b) => Date.parse(b.date) - Date.parse(a.date)).slice(0, n).map(m => ({ r: resultFor(m, team), m })).filter(x => x.r).reverse();
const FORM_FA = { W: 'W', D: 'D', L: 'L' };
// prefer the source's own last-5 form (standings.form) when it is at least as complete as what our match window gives
const formFor = (row, matches, team) => {
  const mine = formOf(matches, team);
  const raw = String(row?.form || '').toUpperCase().replace(/[^WDL]/g, '').slice(-5).split('');
  if (raw.length >= mine.length && raw.length) { const tips = (row.formTips || []).slice(-raw.length); return raw.map((r, i) => ({ r, tip: tips[i] || '', m: { home: '', away: '', score: '' } })); }
  return mine;
};
function FormDots({ items }) {
  const slots = [...Array(Math.max(0, 5 - items.length)).fill(null), ...items.slice(-5)];
  return <span className="form-dots">{slots.map((x, i) => x ? <i key={i} className={`f-${x.r}`} title={x.tip ? faDigits(x.tip) : x.m.home ? `${x.m.home} ${faDigits(x.m.score)} ${x.m.away}` : ''}>{FORM_FA[x.r]}</i> : <i key={i} className="f-none" title="نتیجه در دسترس نیست" />)}</span>;
}
function MyTeams({ league }) {
  const [favs, setFavs] = useState(() => readLs('lifeos-fav-teams', []));
  const [matches, setMatches] = useState([]), [rows, setRows] = useState([]);
  useEffect(() => { const t = setInterval(() => setFavs(readLs('lifeos-fav-teams', [])), 1500); return () => clearInterval(t); }, []);
  useEffect(() => { if (!league) return; fetchLeague(league).then(setMatches).catch(() => setMatches([])); api(`/api/football/remote/free/standings?league=${league}`).then(d => setRows(d.items || [])).catch(() => setRows([])); }, [league]);
  const inLeague = favs.filter(t => rows.some(r => (r.team || r.name) === t) || matches.some(m => m.home === t || m.away === t));
  const now = Date.now();
  return <Card className="my-teams" icon={Star} title="تیم‌های من" action={<small className="muted">{(FOOT_LEAGUES.find(l => l[0] === league) || [])[1] || ''}</small>}>
    {!favs.length ? <p className="empty">هنوز تیمی انتخاب نکردی. توی لیست مسابقات روی اسم تیم بزن تا ستاره بخوره و اینجا بیاد.</p>
      : !inLeague.length ? <p className="empty">تیم‌هات توی این لیگ نیستن. لیگ دیگه‌ای رو انتخاب کن.</p>
      : <div className="mt-list">{inLeague.map(t => {
        const row = rows.find(r => (r.team || r.name) === t), idx = row ? rows.indexOf(row) : -1;
        const next = matches.filter(m => m.status !== 'finished' && (m.home === t || m.away === t) && Date.parse(m.date) >= now - 3 * 3600000).sort((a, b) => Date.parse(a.date) - Date.parse(b.date))[0];
        const last = matches.filter(m => m.status === 'finished' && (m.home === t || m.away === t)).sort((a, b) => Date.parse(b.date) - Date.parse(a.date))[0];
        const logo = (next || last) ? ((next || last).home === t ? (next || last).homeLogo : (next || last).awayLogo) : row?.logo;
        const opp = m => m.home === t ? m.away : m.home;
        return <div className="mt-item" key={t}>
          <div className="mt-head"><TeamBadge logo={logo} name={t} /><b>{t}</b>{row && <span className="mt-rank">رتبهٔ {fa(row.rank || idx + 1)} · {fa(row.pts ?? row.points ?? 0)} امتیاز</span>}</div>
          <div className="mt-form"><small>فرم:</small><FormDots items={formFor(row, matches, t)} /></div>
          <div className="mt-games">
            {last && <div><small>بازی قبل</small><span>{last.home === t ? 'مقابل' : 'در زمین'} {opp(last)} <b className={`f-${resultFor(last, t)}`}>{faDigits(last.score)}</b></span></div>}
            {next && <div><small>بازی بعد</small><span>{next.home === t ? 'مقابل' : 'در زمین'} {opp(next)} · {next.status === 'live' ? <b className="f-L">زنده</b> : dayTitle(new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Tehran' }).format(new Date(next.date)))} {next.status !== 'live' && new Intl.DateTimeFormat('fa-IR', { timeZone: 'Asia/Tehran', hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date(next.date))}</span></div>}
          </div>
        </div>;
      })}</div>}
  </Card>;
}

function Standings({ league }) {
  const [rows, setRows] = useState(null), [err, setErr] = useState('');
  const [favs] = useState(() => readLs('lifeos-fav-teams', []));
  const [lm, setLm] = useState([]);
  useEffect(() => { if (!league) return; fetchLeague(league).then(setLm).catch(() => setLm([])); }, [league]);
  useEffect(() => { if (!league) return; setRows(null); setErr(''); api(`/api/football/remote/free/standings?league=${league}`).then(d => setRows(d.items || [])).catch(e => { setErr(e.message); setRows([]); }); }, [league]);
  const n = rows?.length || 0;
  return <Card className="standings" icon={LineChart} title="جدول رده‌بندی" action={<small className="muted">{(FOOT_LEAGUES.find(l => l[0] === league) || [])[1] || ''}</small>}>
    {rows === null ? <p className="empty">در حال دریافت…</p> : !n ? <p className="empty">{err || 'جدول این رقابت در دسترس نیست (مثلاً برای مسابقات حذفی).'}</p> :
      <div className="st-wrap"><table className="st-table">
        <thead><tr><th>#</th><th className="st-team">تیم</th><th>بازی</th><th>برد</th><th>مساوی</th><th>باخت</th><th>تفاضل</th><th>امتیاز</th><th className="st-form">فرم</th></tr></thead>
        <tbody>{rows.map((r, i) => { const name = r.team || r.name, gd = r.gd != null ? r.gd : (Number(r.gf || 0) - Number(r.ga || 0));
          const grouped = rows.some(x => x.group), head = grouped && (i === 0 || rows[i - 1].group !== r.group);
          const gRows = grouped ? rows.filter(x => x.group === r.group) : rows, gi = grouped ? gRows.indexOf(r) : i, gn = gRows.length;
          return <React.Fragment key={(r.group || '') + (name || i)}>{head ? <tr className="st-group"><td colSpan={9}>{r.group}</td></tr> : null}<tr className={`${grouped ? (gi === 0 ? 'top' : '') : (gi < 4 ? 'top' : '')} ${!grouped && gi >= gn - 3 ? 'bottom' : ''} ${grouped && gi === gn - 1 && gn > 3 ? 'bottom' : ''} ${favs.includes(name) ? 'fav' : ''}`}>
            <td className="st-rank">{fa(r.rank || i + 1)}</td>
            <td className="st-team"><TeamBadge logo={r.logo} name={name} /><span>{name}</span>{favs.includes(name) && <Star size={11} fill="currentColor" />}</td>
            <td>{fa(r.played || 0)}</td><td>{fa(r.win ?? r.won ?? 0)}</td><td>{fa(r.draw ?? r.drawn ?? 0)}</td><td>{fa(r.loss ?? r.lost ?? 0)}</td>
            <td><bdi dir="ltr">{faDigits(gd > 0 ? "+" + gd : gd)}</bdi></td><td className="st-pts">{fa(r.pts ?? r.points ?? 0)}</td><td className="st-form"><FormDots items={formFor(r, lm, name)} /></td>
          </tr></React.Fragment>; })}</tbody>
      </table></div>}
  </Card>;
}
function FootballPage() {
  const [league, setLeague] = useState(null), [favOnly, setFavOnly] = useState(false);
  const [favCount, setFavCount] = useState(() => readLs('lifeos-fav-teams', []).length);
  useEffect(() => { pickNearestLeague().then(setLeague); }, []);
  useEffect(() => { const t = setInterval(() => setFavCount(readLs('lifeos-fav-teams', []).length), 1500); return () => clearInterval(t); }, []);
  return <main>
    <TopNav active="football" />
    <div className="page fb-page">
      {/* league picker + «تیم‌های من» live in the page header and drive all three columns */}
      <header className="page-head fb-head"><div><h1>فوتبال</h1><p>برنامه، نتایج و جدول لیگ‌ها. روی اسم هر تیم بزن تا به «تیم‌های من» اضافه بشه.</p></div>
        <div className="fb-head-tools"><LeaguePicker value={league} onChange={setLeague} />{favCount > 0 && <button type="button" className={`fav-toggle ${favOnly ? 'on' : ''}`} onClick={() => setFavOnly(v => !v)}><Star size={12} fill={favOnly ? 'currentColor' : 'none'} />تیم‌های من</button>}</div>
      </header>
      {/* three columns: fixtures (with the league picker) · results · table */}
      <div className="fb-page-grid fb-three">
        <div className="fb-side"><Football full only="fixtures" league={league} onLeague={setLeague} favOnly={favOnly} /><MyTeams league={league} /></div>
        <div className="fb-side"><Football full only="results" league={league} favOnly={favOnly} /></div>
        <Standings league={league} />
      </div>
    </div>
  </main>;
}

function SeriesCard() {
  const [all, setAll] = useState(null);
  const load = () => api('/api/movies').then(d => setAll((d.items || []).filter(x => x.type === 'series'))).catch(() => setAll([]));
  useEffect(() => { load(); }, []);
  const onChange = load;
  const unseen = x => { const cur = Number(x.currentSeason) || 1, ep = Number(x.currentEpisode) || 0; return Math.max(0, (seasonAiredCount(x, cur) || Number(x.airedInSeason) || 0) - ep) + (seriesHasFresh(x) ? 1 : 0); };
  const watching = (all || []).filter(x => x.status === 'watching' && !waitingNewSeason(x)).sort((a, b) => (unseen(b) > 0) - (unseen(a) > 0) || (b.lastTouchedAt || b.createdAt || 0) - (a.lastTouchedAt || a.createdAt || 0));
  const [busy, setBusy] = useState(null), [msg, setMsg] = useState('');
  const watchNext = async item => {
    const cur = Number(item.currentSeason) || 1, ep = Number(item.currentEpisode) || 0;
    const aired = seasonAiredCount(item, cur) || Number(item.airedInSeason) || 0;
    const by = item.seasonEpisodes || {};
    // finished the season and the next one has aired episodes → move to S+1 E1
    const next = aired && ep >= aired && (Number(by[cur + 1]?.aired) || 0) > 0 ? { currentSeason: cur + 1, currentEpisode: 1 } : { currentSeason: cur, currentEpisode: ep + 1 };
    setBusy(item.id);
    try { await api(`/api/movies/${item.id}`, { method: 'PATCH', body: JSON.stringify(next) }); setMsg(`«${item.title}» فصل ${fa(next.currentSeason)} قسمت ${fa(next.currentEpisode)} ✓`); onChange(); }
    catch (e) { setMsg(e.message); }
    setBusy(null); setTimeout(() => setMsg(''), 3000);
  };
  return <Card title="سریال‌های من" icon={Clapperboard} className="series series2" action={<a href="/?page=series">همهٔ سریال‌ها ←</a>}>
    {all === null ? <p className="empty">در حال دریافت…</p> : watching.length ? <div className="sr-grid">{watching.map(item => {
      const cur = Number(item.currentSeason) || 1, ep = Number(item.currentEpisode) || 0;
      const aired = seasonAiredCount(item, cur) || Number(item.airedInSeason) || 0, total = seasonTotalCount(item, cur) || Number(item.totalEpisodes) || aired;
      const left = Math.max(0, aired - ep), pct = aired ? Math.min(100, ep / aired * 100) : 0;
      return <div className="sr-item" key={item.id}>
        <a className="sr-poster" href="/?page=series">{item.posterUrl ? <img src={item.posterUrl} alt="" loading="lazy" onError={e => { e.target.remove(); }} /> : null}<span>🎬</span></a>
        <div className="sr-info">
          <b title={item.title}>{item.title}</b>
          <small>فصل {fa(cur)} · قسمت {fa(ep)}{total ? ` از ${fa(total)}` : ''}</small>
          <i className="sr-bar"><u style={{ width: `${pct}%` }} /></i>
          <div className="sr-foot">
            {left > 0 ? <span className="sr-new">{fa(left)} قسمت ندیده</span> : seriesHasFresh(item) ? <span className="sr-new">فصل تازه</span> : <span className="muted">منتظر قسمت بعد</span>}
            {(left > 0 || seriesHasFresh(item)) && <button type="button" disabled={busy === item.id} onClick={() => watchNext(item)}><Check size={14} /><span dir="rtl">{watchLabel(item)}</span></button>}
          </div>
        </div>
      </div>;
    })}</div> : <p className="empty">سریالی در حال تماشا نیست.</p>}
    {msg && <small className="sr-msg">{msg}</small>}
  </Card>;
}

function FinanceMini({ todaySpend }) {
  const [fin, setFin] = useState(null), [bud, setBud] = useState(null), [week, setWeek] = useState(null);
  useEffect(() => {
    const month = isoToday().slice(0, 7);
    api(`/api/finance?month=${month}`).then(setFin).catch(() => setFin({ income: 0, expense: 0, categories: {} }));
    api(`/api/budgets?month=${month}`).then(setBud).catch(() => {});
    const t = isoToday(), from = addDaysIso(t, -6);
    api(`/api/transactions?from=${from}&to=${t}`).then(d => {
      const sums = Object.fromEntries([...Array(7)].map((_, i) => [addDaysIso(from, i), 0]));
      (d.items || []).forEach(x => { if (x.kind === 'expense' && x.date in sums) sums[x.date] += Number(x.amount) || 0; });
      setWeek(Object.entries(sums));
    }).catch(() => setWeek([]));
  }, []);
  const income = fin?.income || 0, expense = fin?.expense || 0;
  const hasBudget = !!bud?.totalBudget;
  const used = hasBudget ? (bud.totalSpent || 0) / bud.totalBudget : income ? expense / income : 0;
  const left = Math.max(0, 1 - used), pct = Math.round((hasBudget || income ? left : 0) * 100);
  const top = Object.entries(fin?.categories || {}).sort((a, b) => b[1] - a[1])[0];
  const R = 42, C = 2 * Math.PI * R;
  return <Card className="finance-mini" icon={Wallet} title="مالی · این ماه" action={<a href="/?page=finance">دفتر ←</a>}>
    {!fin ? <p className="empty">در حال دریافت…</p> : <div className="fm-body">
      <div className="fm-rows">
        <div><span>درآمد</span><b className="pos">{fa(income)}</b></div>
        <div><span>هزینه</span><b className="neg">{fa(expense)}</b></div>
        <div><span>خرج امروز</span><b>{fa(todaySpend)}</b></div>
        {top && <div><span>بیشترین خرج</span><b>{top[0]}</b></div>}
      </div>
      <div className={`ring ${used > 1 ? 'over' : used > .8 ? 'warn' : ''}`}>
        <svg viewBox="0 0 100 100"><circle cx="50" cy="50" r={R} className="ring-bg" /><circle cx="50" cy="50" r={R} className="ring-fg" strokeDasharray={C} strokeDashoffset={used > 1 ? 0 : C * (1 - pct / 100)} /></svg>
        <div>{used > 1 ? <><b>{fa(Math.round(used * 100))}٪</b><small>{hasBudget ? 'بودجه خرج شده' : 'درآمد خرج شده'}</small></> : <><b>{fa(pct)}٪</b><small>{hasBudget ? 'بودجه مانده' : 'از درآمد مانده'}</small></>}</div>
      </div>
    </div>}
    {week?.length > 0 && (() => { const max = Math.max(1, ...week.map(([, v]) => v)), total = week.reduce((n, [, v]) => n + v, 0), today = isoToday(); return <div className="fm-week">
      <div className="fm-week-head"><span>خرج ۷ روز اخیر</span><b>{fa(total)}</b></div>
      <div className="fm-bars">{week.map(([d, v]) => <div key={d} className={d === today ? 'is-today' : ''} title={`${jalaliDayLabel(d)}: ${fa(v)} ریال`}><i style={{ height: `${Math.max(v ? 6 : 2, v / max * 100)}%` }} /><small>{new Intl.DateTimeFormat('fa-IR', { weekday: 'narrow' }).format(fromIso(d))}</small></div>)}</div>
    </div>; })()}
    <small className="fm-unit">ارقام به ریال</small>
  </Card>;
}

applyAppearance(readLs('lifeos-appearance', APPEARANCE_DEFAULT));
function NotifyCard() {
  const [me, setMe] = useState(null), [msg, setMsg] = useState(''), [busy, setBusy] = useState(false);
  const [perm, setPerm] = useState(typeof Notification !== 'undefined' ? Notification.permission : 'unsupported');
  const [subscribed, setSubscribed] = useState(false);
  const supported = 'serviceWorker' in navigator && 'PushManager' in window && typeof Notification !== 'undefined';
  useEffect(() => {
    api('/api/me').then(d => setMe(d.user || {})).catch(() => setMe({}));
    if (supported) navigator.serviceWorker.getRegistration().then(r => r && r.pushManager.getSubscription()).then(sub => setSubscribed(!!sub)).catch(() => {});
  }, []);
  const tgOn = me ? me.tgRemindersOn !== false : true;
  const toggleTg = async () => { const v = !tgOn; setMe(m => ({ ...m, tgRemindersOn: v })); try { await api('/api/me', { method: 'PATCH', body: JSON.stringify({ tgRemindersOn: v }) }); } catch (e) { setMsg(e.message); } };
  const b64ToU8 = s => { const p = '='.repeat((4 - s.length % 4) % 4), b = atob((s + p).replace(/-/g, '+').replace(/_/g, '/')); return Uint8Array.from(b, c => c.charCodeAt(0)); };
  const enable = async () => {
    setBusy(true); setMsg('');
    try {
      const p = await Notification.requestPermission(); setPerm(p);
      if (p !== 'granted') throw new Error('اجازهٔ اعلان داده نشد. از تنظیمات مرورگر اجازه بده.');
      let reg = await navigator.serviceWorker.getRegistration(); if (!reg) reg = await navigator.serviceWorker.register('/sw.js');
      await navigator.serviceWorker.ready;
      const { publicKey } = await api('/api/push/key');
      let sub = await reg.pushManager.getSubscription();
      if (!sub) sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64ToU8(publicKey) });
      await api('/api/push/subscribe', { method: 'POST', body: JSON.stringify({ subscription: sub.toJSON() }) });
      setSubscribed(true); setMsg('اعلان روی این دستگاه فعال شد ✓');
    } catch (e) { setMsg(e.message || 'فعال‌سازی نشد.'); }
    setBusy(false);
  };
  const disable = async () => { setBusy(true); try { const reg = await navigator.serviceWorker.getRegistration(), sub = reg && await reg.pushManager.getSubscription(); if (sub) { await api('/api/push/subscribe', { method: 'DELETE', body: JSON.stringify({ endpoint: sub.endpoint }) }).catch(() => {}); await sub.unsubscribe(); } setSubscribed(false); setMsg('اعلان این دستگاه خاموش شد.'); } catch (e) { setMsg(e.message); } setBusy(false); };
  const test = async () => { try { await api('/api/push/test', { method: 'POST' }); setMsg('اعلان آزمایشی فرستاده شد — چند ثانیه صبر کن.'); } catch (e) { setMsg(e.message); } };
  const ios = /iphone|ipad|ipod/i.test(navigator.userAgent), standalone = window.matchMedia?.('(display-mode: standalone)').matches || navigator.standalone;
  return <section className="planner-list digest-card" id="notify">
    <h2>🔔 اعلان یادآوری‌ها</h2>
    <article>
      <div><b>تلگرام — سر ساعت هر یادآوری</b><small>با دکمه‌های «✓ انجام شد»، «⏰ ۱۵ دقیقه بعد» و «📅 فردا»؛ هشدار زودتر را در فرم هر یادآوری انتخاب کن. {me && !me.telegramUserId ? '— اول بات تلگرام را وصل کن.' : ''}</small></div>
      <button type="button" className={`plnr-switch ${tgOn ? 'on' : ''}`} role="switch" aria-label="ارسال به تلگرام" aria-checked={tgOn} onClick={toggleTg}><i /></button>
    </article>
    <article>
      <div><b>اعلان روی همین دستگاه</b><small>{!supported ? (ios && !standalone ? 'در آیفون اول سایت را «Add to Home Screen» کن و از همان آیکن باز کن.' : 'این مرورگر اعلان وب را پشتیبانی نمی‌کند.') : perm === 'denied' ? 'اجازهٔ اعلان در مرورگر بسته است؛ از تنظیمات سایت در مرورگر بازش کن.' : subscribed ? 'فعال است ✓ — یادآوری‌ها مثل پیام برنامه‌ها روی صفحه می‌آیند، حتی وقتی سایت بسته است.' : 'یادآوری‌ها مثل پیام برنامه‌ها روی گوشی یا کامپیوتر می‌آیند، حتی بدون تلگرام.'}</small></div>
      {supported && perm !== 'denied' ? <div className="digest-controls">{subscribed ? <><button type="button" className="finance-action" onClick={test}>آزمایش</button><button type="button" className="finance-action" onClick={disable} disabled={busy}>خاموش</button></> : <button type="button" className="save" onClick={enable} disabled={busy}>{busy ? '…' : 'فعال‌سازی'}</button>}</div> : null}
    </article>
    {msg ? <p className="muted">{msg}</p> : null}
  </section>;
}

// Scoped tokens for a personal website's server-side proxy (e.g. seyfikhani.ir/studio.html).
// The token is shown once; LifeOS stores only its hash. Finance/contract data needs an explicit extra scope.
const SITE_SCOPES = [['projects', 'پروژه‌ها (کارت‌ها، مراحل، یادآوری‌ها)'], ['courses', 'دوره‌ها و دانشجوها (پرداخت‌ها، حضور و غیاب)'], ['projectFiles', 'قرارداد، مالی و تأمین پروژه'], ['bankSms', 'پیامک بانک → تراکنش (Shortcut آیفون، فقط POST /api/ext/bank-sms)']];
function SiteTokensCard() {
  const [items, setItems] = useState(null), [label, setLabel] = useState(''), [scopes, setScopes] = useState({ projects: true, courses: true, projectFiles: true }), [made, setMade] = useState(null), [msg, setMsg] = useState('');
  const load = () => api('/api/site-tokens').then(d => setItems(d.items || [])).catch(e => { setItems([]); setMsg(e.message); });
  useEffect(() => { load(); }, []);
  const create = async () => { try { const r = await api('/api/site-tokens', { method: 'POST', body: JSON.stringify({ label, scopes: Object.keys(scopes).filter(k => scopes[k]) }) }); setMade(r.token); setMsg(''); load(); } catch (e) { setMsg(e.message); } };
  const revoke = async t => { if (!window.confirm(`اتصال «${t.label}» لغو شود؟ سایت دیگر به LifeOS دسترسی نخواهد داشت.`)) return; try { await api(`/api/site-tokens/${t.id}`, { method: 'DELETE' }); load(); } catch (e) { setMsg(e.message); } };
  const copy = async () => { try { await navigator.clipboard.writeText(made); setMsg('توکن کپی شد ✓'); } catch { setMsg('کپی نشد؛ دستی انتخاب و کپی کن.'); } };
  const label0 = k => (SITE_SCOPES.find(x => x[0] === k) || [k, k])[1];
  return <section className="planner-list digest-card" id="siteTokens">
    <h2>🌐 اتصال سایت شخصی</h2>
    <p className="muted" style={{ margin: '0 0 10px' }}>برای سایت شخصی یا Shortcut آیفون. توکن فقط در فایل تنظیمات سرور سایت گذاشته می‌شود، نه در مرورگر؛ هر تغییری آن‌جا همین‌جا ذخیره می‌شود و برعکس.</p>
    {(items || []).map(t => <article key={t.id}><div><b>{t.label}</b><small>{t.scopes.map(label0).join(' · ')} · <span dir="ltr">{t.prefix}…</span>{t.lastUsedAt ? ` · آخرین استفاده ${new Intl.DateTimeFormat('fa-IR', { timeZone: 'Asia/Tehran', dateStyle: 'short', timeStyle: 'short' }).format(new Date(t.lastUsedAt))}` : ' · هنوز استفاده نشده'}</small></div><button type="button" className="finance-action" onClick={() => revoke(t)}>لغو</button></article>)}
    <article style={{ flexWrap: 'wrap' }}>
      <div style={{ flex: '1 1 220px', minWidth: 0 }}><b>توکن تازه</b>
        <input value={label} onChange={e => setLabel(e.target.value)} placeholder="نام (مثلاً آیفون)" style={{ margin: '6px 0', width: '100%', boxSizing: 'border-box' }} />
        {SITE_SCOPES.map(([k, l]) => <label key={k} style={{ display: 'block', overflowWrap: 'anywhere' }}><input type="checkbox" checked={!!scopes[k]} onChange={e => setScopes(o => ({ ...o, [k]: e.target.checked }))} /> {l}</label>)}
      </div>
      <button type="button" className="save" onClick={create}>ساخت توکن</button>
    </article>
    {made ? <p className="muted">فقط همین یک بار نشان داده می‌شود: <code dir="ltr" style={{ wordBreak: 'break-all' }}>{made}</code> <button type="button" className="finance-action" onClick={copy}>کپی</button></p> : null}
    {msg ? <p className="muted">{msg}</p> : null}
  </section>;
}

function FocusSettings() {
  const [f, setF] = useState(readFocus);
  const set = patch => { const n = { ...f, ...patch, snooze: '' }; setF(n); saveFocus(n); };
  const DAYS = [[6, 'شنبه'], [0, 'یکشنبه'], [1, 'دوشنبه'], [2, 'سه‌شنبه'], [3, 'چهارشنبه'], [4, 'پنجشنبه'], [5, 'جمعه']];
  const hour = (v, on) => <select value={v} onChange={e => on(Number(e.target.value))}>{Array.from({ length: 24 }, (_, h) => <option key={h} value={h}>{fa(h)}:۰۰</option>)}</select>;
  return <div className="focus-set">
    <h3>🎯 حالت تمرکز</h3>
    <p className="muted">وقتی روشن است، بخش‌های سرگرمی از منو و صفحهٔ امروز پنهان می‌شوند (داده‌ها سر جایشان می‌مانند).</p>
    <div className="focus-modes" role="radiogroup" aria-label="حالت تمرکز">{[['off', 'خاموش'], ['auto', 'خودکار در ساعت کاری'], ['on', 'همیشه روشن']].map(([k, l]) => <button type="button" key={k} role="radio" aria-checked={f.mode === k} className={f.mode === k ? 'on' : ''} onClick={() => set({ mode: k })}>{l}</button>)}</div>
    {f.mode === 'auto' ? <div className="focus-row">
      <label>از {hour(f.from, v => set({ from: v }))}</label><label>تا {hour(f.to, v => set({ to: v }))}</label>
      <div className="focus-days" role="group" aria-label="روزهای کاری">{DAYS.map(([d, l]) => { const on = f.days.includes(d); return <button type="button" key={d} aria-pressed={on} className={on ? 'on' : ''} onClick={() => set({ days: on ? f.days.filter(x => x !== d) : [...f.days, d] })}>{l}</button>; })}</div>
    </div> : null}
    <div className="focus-row"><span className="muted">پنهان در تمرکز:</span><div className="focus-days" role="group" aria-label="بخش‌های پنهان در تمرکز">{MODULES.map(([k, l, ic]) => { const on = f.hide.includes(k); return <button type="button" key={k} aria-pressed={on} className={on ? 'on' : ''} onClick={() => set({ hide: on ? f.hide.filter(x => x !== k) : [...f.hide, k] })}>{ic} {l}</button>; })}</div></div>
  </div>;
}

function ModulesCard() {
  const mods = useModules(true);
  return <section className="planner-list digest-card" id="modules">
    <h2>🧩 بخش‌های من</h2>
    <p className="muted" style={{ margin: '0 0 10px' }}>بخش‌های خاموش از منو، صفحهٔ اصلی، جستجو و گزارش‌های تلگرام حذف می‌شوند؛ داده‌هایشان پاک نمی‌شود.</p>
    <ModulesPicker value={mods} onChange={saveModules} />
    <FocusSettings />
  </section>;
}

function BackupInstallCard({ lastBackup, freq = 'weekly', onFreq }) {
  const [msg, setMsg] = useState(''), [busy, setBusy] = useState(false), [last, setLast] = useState(lastBackup), [canInstall, setCanInstall] = useState(!!window.__lifeosInstall);
  useEffect(() => setLast(lastBackup), [lastBackup]);
  useEffect(() => { const f = () => setCanInstall(!!window.__lifeosInstall); window.addEventListener('lifeos:installable', f); return () => window.removeEventListener('lifeos:installable', f); }, []);
  const standalone = window.matchMedia?.('(display-mode: standalone)').matches || navigator.standalone;
  const ios = /iphone|ipad|ipod/i.test(navigator.userAgent);
  const backupNow = async () => { setBusy(true); try { const r = await api('/api/backup/now', { method: 'POST' }); setLast(r.date); setMsg('بکاپ به تلگرام فرستاده شد ✓'); } catch (e) { setMsg(e.message); } setBusy(false); };
  const install = async () => { const p = window.__lifeosInstall; if (!p) return; p.prompt(); try { await p.userChoice; } catch {} window.__lifeosInstall = null; setCanInstall(false); };
  const lastLabel = last ? (last === isoToday() ? 'امروز' : jalaliDayLabel(last)) : 'هنوز نه';
  return <section className="planner-list digest-card">
    <h2>📦 بکاپ و نصب اپ</h2>
    <article>
      <div><b>🗄 بکاپ خودکار در تلگرام</b><small>{freq === 'off' ? 'بکاپ خودکار خاموش است' : `${freq === 'daily' ? 'هر روز' : 'هر هفته'} یک فایل JSON فقط از داده‌های خودت به تلگرامت فرستاده می‌شود`} · آخرین بکاپ: {lastLabel}</small></div>
      <div className="digest-controls"><select value={freq} onChange={e => onFreq && onFreq(e.target.value)} aria-label="دورهٔ بکاپ"><option value="weekly">هفتگی</option><option value="daily">روزانه</option><option value="off">خاموش</option></select><button type="button" className="finance-action" onClick={backupNow} disabled={busy}>{busy ? '…' : 'بکاپ الان'}</button><a className="finance-action" href="/api/export" download="lifeos-export.json">دانلود فایل</a></div>
    </article>
    <article>
      <div><b>📱 نصب روی گوشی / دسکتاپ</b><small>{standalone ? 'اپ نصب شده است ✓ — بدون اینترنت هم آخرین داده‌ها قابل مشاهده‌اند.' : ios ? 'در سافاری دکمهٔ Share و بعد «Add to Home Screen» را بزن.' : canInstall ? 'مثل یک اپ جدا باز می‌شود و بدون اینترنت هم آخرین داده‌ها را نشان می‌دهد.' : 'از منوی مرورگر گزینهٔ «Install app» یا «Add to Home screen» را بزن.'}</small></div>
      {canInstall && !standalone ? <button type="button" className="save" onClick={install}>نصب</button> : null}
    </article>
    {msg ? <p className="muted">{msg}</p> : null}
  </section>;
}

// AI assistant on every page: a floating button (only when the server has an AI key); the panel loads on demand.
const AssistantPanel = React.lazy(() => import('./assistant'));
function AssistantDock() {
  const [ok, setOk] = useState(false), [open, setOpen] = useState(false);
  useEffect(() => { meOnce().then(u => setOk(!!u?.aiConfigured)); const f = () => setOpen(true); window.addEventListener('lifeos:assistant', f); return () => window.removeEventListener('lifeos:assistant', f); }, []);
  if (!ok || new URLSearchParams(location.search).get('page') === 'vocab') return null;
  return open ? <React.Suspense fallback={null}><AssistantPanel onClose={() => setOpen(false)} /></React.Suspense>
    : <button type="button" className="as-fab" onClick={() => setOpen(true)} aria-label="دستیار هوشمند" title="دستیار هوشمند"><Sparkles size={22} /></button>;
}

function OfflineBar() {
  const [off, setOff] = useState(!navigator.onLine);
  useEffect(() => { const a = () => { setOff(false); flushOutbox(); }, b = () => setOff(true); window.addEventListener('online', a); window.addEventListener('offline', b); return () => { window.removeEventListener('online', a); window.removeEventListener('offline', b); }; }, []);
  return off ? <div className="offline-bar" role="status">⚡ آفلاین هستی — آخرین داده‌های ذخیره‌شده نمایش داده می‌شود؛ ثبت و ویرایش بعد از وصل شدن.</div> : null;
}

setTimeout(() => flushOutbox(), 1500); // captures queued offline in an earlier visit

// Sign out: end the session, then drop this device's cached API data and per-account preferences.
async function signOut() {
  try { await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' }); } catch {}
  try { const keys = await caches.keys(); await Promise.all(keys.filter(k => k.endsWith('-data')).map(k => caches.delete(k))); } catch {}
  try { ['lifeos-modules', 'lifeos-locks', 'lifeos-is-admin', 'lifeos-outbox'].forEach(k => localStorage.removeItem(k)); sessionStorage.clear(); } catch {}
  location.href = '/design/login-page.html';
}

window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); window.__lifeosInstall = e; window.dispatchEvent(new Event('lifeos:installable')); });
if ('serviceWorker' in navigator && !navigator.webdriver && (location.protocol === 'https:' || location.hostname === 'localhost')) {
  window.addEventListener('load', () => { navigator.serviceWorker.register('/sw.js').catch(() => {}); });
}

createRoot(document.getElementById('root')).render(<><React.Suspense fallback={<PageLoading />}><App /></React.Suspense><OfflineBar /><MsgBar load={meOnce} /><AssistantDock /></>);
window.addEventListener('load', () => { const idle = window.requestIdleCallback || (f => setTimeout(f, 2500)); idle(prefetchPages, { timeout: 6000 }); });
