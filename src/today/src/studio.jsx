// Personal-site build (seyfikhani.ir/studio.html): LifeOS's own ProjectsPage and CoursesPage,
// talking to LifeOS through the site's PHP proxy (studio-api.php) instead of the session cookie.
// Build: npm run build:studio  →  integrations/seyfikhani/public_html/
import { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { FolderKanban, GraduationCap, KeyRound, LogOut, Moon, RefreshCw, Sun } from 'lucide-react';
import './today.css';
import './home.css';
import './unify.css';
import { ProjectsPage } from './life';
import { CoursesPage } from './courses';
import './numgroup';
import './mobile.css';
import './studio.css';

const PROXY = 'studio-api.php';
let csrf = '';
const onSignedOut = new Set();

const sleep = ms => new Promise(r => setTimeout(r, ms));
// A save that fails on the way (this host sometimes drops the connection to LifeOS, or the PHP session's CSRF
// token was renewed) is retried instead of silently losing what was typed: 403 → fresh token + one retry;
// network error / 5xx on an edit → up to two retries.
async function call(url, opt = {}, attempt = 0) {
  // only edits/deletes are retried on a dropped connection: re-sending them is harmless, a repeated POST could duplicate a row
  const write = ['PATCH', 'PUT', 'DELETE'].includes((opt.method || 'GET').toUpperCase());
  let r;
  try { r = await fetch(url, { credentials: 'same-origin', cache: 'no-store', ...opt, headers: { 'Content-Type': 'application/json', 'X-CSRF': csrf, ...(opt.headers || {}) } }); }
  catch (e) { if (write && attempt < 2) { await sleep(1200 * (attempt + 1)); return call(url, opt, attempt + 1); } throw new Error('اتصال برقرار نشد؛ اینترنت را چک کن.'); }
  const d = await r.json().catch(() => ({}));
  if (r.status === 401 && url.includes('a=api')) onSignedOut.forEach(f => f());
  if (r.status === 403 && url.includes('a=api') && attempt < 1) {
    try { const s = await fetch(`${PROXY}?a=state`, { credentials: 'same-origin', cache: 'no-store' }).then(x => x.json()); if (s.csrf) csrf = s.csrf; if (!s.signedIn) { onSignedOut.forEach(f => f()); throw new Error('نشست تمام شد؛ دوباره وارد شو.'); } } catch (e) { if (e.message.includes('نشست')) throw e; }
    return call(url, opt, attempt + 1);
  }
  if (write && r.status >= 500 && attempt < 2) { await sleep(1200 * (attempt + 1)); return call(url, opt, attempt + 1); }
  if (!r.ok) throw new Error(d.error || 'دریافت اطلاعات ناموفق بود.');
  return d;
}

// LifeOS paths these two pages use → the token-scoped /api/ext/* paths the proxy forwards.
window.__lifeosApi = async (url, options = {}) => {
  const p = new URL(url, location.href).pathname, method = (options.method || 'GET').toUpperCase();
  let target = null;
  if (/^\/api\/col\/[A-Za-z]+(\/[\w-]+)?$/.test(p)) target = '/api/ext' + p.slice(4);
  else if (/^\/api\/reminders(\/[\w-]+)?$/.test(p)) target = '/api/ext' + p.slice(4);
  else if (/^\/api\/transactions(\/[\w-]+)?$/.test(p) && method !== 'GET') target = '/api/ext' + p.slice(4);
  else if (p === '/api/projects/report-pdf' && method === 'POST') target = '/api/ext/report-pdf';
  else if (p === '/api/report-brand') target = '/api/ext/report-brand';
  else if (p === '/api/me') return { user: {} };
  else throw new Error('این بخش فقط داخل خود LifeOS در دسترس است.');
  return call(`${PROXY}?a=api&p=${encodeURIComponent(target)}`, { method, body: options.body });
};

const readLs = (k, d) => { try { return localStorage.getItem(k) || d; } catch { return d; } };
const writeLs = (k, v) => { try { localStorage.setItem(k, v); } catch {} };

function PasswordDrawer({ onClose }) {
  const [cur, setCur] = useState(''), [next, setNext] = useState(''), [again, setAgain] = useState(''), [msg, setMsg] = useState(''), [done, setDone] = useState(false), [busy, setBusy] = useState(false);
  const submit = async e => {
    e.preventDefault(); setMsg('');
    if (next.length < 10) { setMsg('رمز تازه باید حداقل ۱۰ کاراکتر باشد.'); return; }
    if (next !== again) { setMsg('تکرار رمز تازه یکی نیست.'); return; }
    setBusy(true);
    try { const r = await call(`${PROXY}?a=password`, { method: 'POST', body: JSON.stringify({ current: cur, next }) }); csrf = r.csrf; setDone(true); setCur(''); setNext(''); setAgain(''); }
    catch (x) { setMsg(x.message); }
    setBusy(false);
  };
  return <div className="lf-drawer-bg" onClick={onClose}><form className="lf-drawer" onClick={e => e.stopPropagation()} onSubmit={submit}>
    <header><h2>تغییر رمز ورود</h2><button type="button" onClick={onClose} aria-label="بستن">×</button></header>
    <div className="lf-drawer-body">
      {done ? <p className="lf-note">رمز تازه ذخیره شد ✓ از ورود بعدی همین رمز را بزن.</p> : <>
        <label className="lf-field"><span>رمز فعلی</span><input type="password" dir="ltr" autoComplete="current-password" required value={cur} onChange={e => setCur(e.target.value)} /></label>
        <label className="lf-field"><span>رمز تازه (حداقل ۱۰ کاراکتر)</span><input type="password" dir="ltr" autoComplete="new-password" required minLength={10} value={next} onChange={e => setNext(e.target.value)} /></label>
        <label className="lf-field"><span>تکرار رمز تازه</span><input type="password" dir="ltr" autoComplete="new-password" required value={again} onChange={e => setAgain(e.target.value)} /></label>
      </>}
      {msg ? <p className="lf-err" role="alert">{msg}</p> : null}
    </div>
    <footer>{done ? <button type="button" className="lf-btn" onClick={onClose}>بستن</button> : <><button className="lf-btn" disabled={busy}>{busy ? '…' : 'ذخیرهٔ رمز'}</button><button type="button" className="lf-btn ghost" onClick={onClose}>انصراف</button></>}</footer>
  </form></div>;
}

function StudioNav({ tab, setTab, onRefresh, onOut }) {
  const [pw, setPw] = useState(false);
  const [mode, setMode] = useState(() => document.documentElement.dataset.mode || 'dark');
  const flip = () => { const m = mode === 'dark' ? 'light' : 'dark'; document.documentElement.dataset.mode = m; writeLs('lifeos-mode', m); setMode(m); };
  return <nav className="topbar studio-bar">
    <a className="brand" href="index.html" aria-label="ملینا صیفی‌خانی"><i className="brand-logo" aria-hidden="true" /><span>ملینا صیفی‌خانی</span></a>
    <div className="studio-tabs" role="tablist">
      <button type="button" role="tab" aria-selected={tab === 'projects'} className={tab === 'projects' ? 'on' : ''} onClick={() => setTab('projects')}><FolderKanban size={17} /><span>پروژه‌ها</span></button>
      <button type="button" role="tab" aria-selected={tab === 'courses'} className={tab === 'courses' ? 'on' : ''} onClick={() => setTab('courses')}><GraduationCap size={17} /><span>دوره‌ها و دانشجوها</span></button>
    </div>
    <span className="nav-spacer" />
    <button type="button" className="studio-icon" onClick={onRefresh} title="به‌روزرسانی از LifeOS" aria-label="به‌روزرسانی"><RefreshCw size={17} /></button>
    <button type="button" className="studio-icon" onClick={flip} title={mode === 'dark' ? 'حالت روشن' : 'حالت تیره'} aria-label="تغییر تم">{mode === 'dark' ? <Sun size={17} /> : <Moon size={17} />}</button>
    <button type="button" className="studio-icon" onClick={() => setPw(true)} title="تغییر رمز" aria-label="تغییر رمز"><KeyRound size={17} /></button>
    <button type="button" className="studio-icon" onClick={onOut} title="خروج" aria-label="خروج"><LogOut size={17} /></button>
    {pw ? <PasswordDrawer onClose={() => setPw(false)} /> : null}
  </nav>;
}

function Login({ onIn, note }) {
  const [email, setEmail] = useState(''), [pw, setPw] = useState(''), [err, setErr] = useState(note || ''), [busy, setBusy] = useState(false);
  const submit = async e => {
    e.preventDefault(); setBusy(true); setErr('');
    try { const r = await call(`${PROXY}?a=login`, { method: 'POST', body: JSON.stringify({ email, password: pw }) }); csrf = r.csrf; setPw(''); onIn(); }
    catch (x) { setErr(x.message); }
    setBusy(false);
  };
  return <main className="lf studio-login" dir="rtl"><form className="lf-card" onSubmit={submit}>
    <h1>ورود به پنل</h1>
    <p className="muted">پروژه‌ها، دوره‌ها و دانشجوها — همگام با LifeOS</p>
    <label className="lf-field"><span>ایمیل</span><input type="email" dir="ltr" autoComplete="username" required value={email} onChange={e => setEmail(e.target.value)} /></label>
    <label className="lf-field"><span>رمز</span><input type="password" dir="ltr" autoComplete="current-password" required value={pw} onChange={e => setPw(e.target.value)} /></label>
    <button className="lf-btn" disabled={busy}>{busy ? '…' : 'ورود'}</button>
    {err ? <p className="lf-err" role="alert">{err}</p> : null}
  </form></main>;
}

function App() {
  const [state, setState] = useState(null), [note, setNote] = useState(''), [tab, setTabRaw] = useState(() => readLs('studio-tab', 'projects')), [rev, setRev] = useState(0);
  const setTab = t => { writeLs('studio-tab', t); setTabRaw(t); };
  useEffect(() => {
    call(`${PROXY}?a=state`).then(s => { csrf = s.csrf; setState(s.signedIn ? 'in' : 'out'); }).catch(e => { setNote(e.message); setState('out'); });
    const out = () => { setNote('نشست تمام شد؛ دوباره وارد شو.'); setState('out'); };
    onSignedOut.add(out); return () => onSignedOut.delete(out);
  }, []);
  // LifeOS → site: re-read when the tab becomes visible again (the pages load their data on mount)
  useEffect(() => { const f = () => { if (!document.hidden && !document.querySelector('.lf-drawer')) setRev(r => r + 1); }; document.addEventListener('visibilitychange', f); return () => document.removeEventListener('visibilitychange', f); }, []);
  const logout = async () => { try { const r = await call(`${PROXY}?a=logout`, { method: 'POST' }); csrf = r.csrf; } catch {} setNote(''); setState('out'); };
  if (state === null) return <main className="lf studio-login" dir="rtl"><p className="lf-empty">در حال اتصال…</p></main>;
  if (state === 'out') return <Login note={note} onIn={() => { setNote(''); setState('in'); }} />;
  const Nav = () => <StudioNav tab={tab} setTab={setTab} onRefresh={() => setRev(r => r + 1)} onOut={logout} />;
  return tab === 'courses' ? <CoursesPage key={'c' + rev} Nav={Nav} /> : <ProjectsPage key={'p' + rev} Nav={Nav} />;
}

createRoot(document.getElementById('root')).render(<App />);
