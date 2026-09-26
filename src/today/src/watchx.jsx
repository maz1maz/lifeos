import { useEffect, useMemo, useState } from 'react';
import { isoToJ, MONTHS } from './jdate';
import './watchx.css';

const api = async (url, options) => {
  const r = await fetch(url, { credentials: 'include', ...options, headers: { 'Content-Type': 'application/json', ...(options?.headers || {}) } });
  const b = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(b.error || 'دریافت اطلاعات ناموفق بود.');
  return b;
};
const todayIso = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Tehran', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
const faD = v => String(v ?? '').replace(/[0-9]/g, d => '۰۱۲۳۴۵۶۷۸۹'[d]);
const WDAY = ['یکشنبه', 'دوشنبه', 'سه‌شنبه', 'چهارشنبه', 'پنجشنبه', 'جمعه', 'شنبه'];
const dayDiff = iso => Math.round((Date.parse(iso + 'T00:00:00Z') - Date.parse(todayIso() + 'T00:00:00Z')) / 864e5);
const dayTitle = iso => {
  const d = dayDiff(iso), j = isoToJ(iso), wd = WDAY[new Date(iso + 'T12:00:00Z').getUTCDay()];
  const lab = `${wd} ${faD(j.jd)} ${MONTHS[j.jm - 1]}`;
  return d === 0 ? `امروز · ${lab}` : d === 1 ? `فردا · ${lab}` : d === -1 ? `دیروز · ${lab}` : lab;
};
// TVMaze airstamp is UTC — show it in Tehran time; many shows air overnight, so the Tehran date can differ
const tehranDate = ep => ep.airstamp ? new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Tehran', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(ep.airstamp)) : ep.airdate;
const tehranTime = ep => ep.airstamp ? new Intl.DateTimeFormat('fa-IR', { timeZone: 'Asia/Tehran', hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date(ep.airstamp)) : '';
const code = ep => `فصل ${faD(ep.season)} · قسمت ${faD(ep.number)}`;

function Poster({ src }) { return src ? <img className="wx-poster" src={src} alt="" loading="lazy" onError={e => { e.currentTarget.style.visibility = 'hidden'; }} /> : <span className="wx-poster wx-nopo">🎬</span>; }

export function UpcomingPage({ Nav }) {
  const [data, setData] = useState(null), [busy, setBusy] = useState(false);
  const load = async (refresh = false) => { setBusy(true); try { setData(await api(`/api/movies/upcoming${refresh ? '?refresh=1' : ''}`)); } catch (e) { setData({ error: e.message }); } setBusy(false); };
  useEffect(() => { load(); }, []);
  const groups = useMemo(() => {
    const m = new Map();
    for (const it of data?.upcoming || []) { const d = tehranDate(it.ep); if (!m.has(d)) m.set(d, []); m.get(d).push(it); }
    return [...m.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [data]);
  const week = (data?.upcoming || []).filter(x => dayDiff(tehranDate(x.ep)) <= 7).length;
  return <main className="wx" dir="rtl">
    <Nav />
    <div className="wx-page">
      <header className="wx-hero">
        <div><p>تقویم پخش</p><h1>قسمت‌های تازه</h1><small>{data?.upcoming ? `${faD(week)} قسمت در ۷ روز آینده · از ${faD(data.total || 0)} سریال شما` : ''}</small></div>
        <button type="button" className="wx-btn ghost" onClick={() => load(true)} disabled={busy}>{busy ? 'در حال به‌روزرسانی…' : '↻ به‌روزرسانی'}</button>
      </header>
      {!data ? <p className="wx-empty">در حال دریافت برنامهٔ پخش…</p> : data.error ? <p className="wx-empty">{data.error}</p> : <>
        {data.recent?.length ? <section className="wx-sec">
          <h2>🆕 تازه پخش شده</h2>
          <div className="wx-recent">{data.recent.map(it => <a key={it.id + 'r'} className={`wx-rc ${it.seen ? 'seen' : ''}`} href="/?page=series">
            <Poster src={it.posterUrl} />
            <div><b>{it.title}</b><small>{code(it.ep)}{it.ep.name ? ` — ${it.ep.name}` : ''}</small><em>{dayTitle(tehranDate(it.ep))}{it.seen ? ' · دیده‌شده ✓' : it.status === 'watching' ? ' · هنوز ندیده‌ای' : ''}</em></div>
          </a>)}</div>
        </section> : null}
        <section className="wx-sec">
          <h2>📅 به‌زودی</h2>
          {!groups.length ? <p className="wx-empty">در ۴ ماه آینده قسمت تازه‌ای برای سریال‌های شما اعلام نشده.</p> : groups.map(([d, items]) => (
            <div key={d} className={`wx-day ${dayDiff(d) <= 1 ? 'soon' : ''}`}>
              <div className="wx-date"><b>{dayTitle(d)}</b><span>{dayDiff(d) > 1 ? `${faD(dayDiff(d))} روز دیگر` : ''}</span></div>
              <div className="wx-items">{items.map(it => <div key={it.id} className="wx-it">
                <Poster src={it.posterUrl} />
                <div className="wx-it-main"><b>{it.title}</b><small>{code(it.ep)}{it.ep.name && !/^Episode \d+$/i.test(it.ep.name) ? ` — ${it.ep.name}` : ''}</small>{it.network ? <em>{it.network}</em> : null}</div>
                <span className="wx-time">{tehranTime(it.ep) || '—'}</span>
              </div>)}</div>
            </div>
          ))}
        </section>
        <p className="wx-note">ساعت‌ها به وقت تهران است. سریال‌های «در حال تماشا»، «بعداً» و تمام‌شده‌هایی که هنوز پخش می‌شوند بررسی می‌شوند.</p>
      </>}
    </div>
  </main>;
}

export function DiscoverPage({ Nav }) {
  const [kind, setKind] = useState('series');
  const [data, setData] = useState(null), [busy, setBusy] = useState(false), [added, setAdded] = useState({}), [msg, setMsg] = useState('');
  const load = async (refresh = false) => { setBusy(true); setData(null); try { setData(await api(`/api/movies/recommendations?type=${kind}${refresh ? '&refresh=1' : ''}`)); } catch (e) { setData({ error: e.message }); } setBusy(false); };
  useEffect(() => { load(); }, [kind]);
  const add = async it => {
    const k = it.tmdbId || it.tvmazeId || it.name;
    setAdded(a => ({ ...a, [k]: 'busy' }));
    try {
      if (kind === 'series') await api('/api/movies/from-tvmaze', { method: 'POST', body: JSON.stringify({ tvmazeId: it.tvmazeId || undefined, name: it.name, posterUrl: it.posterUrl, status: 'watchlist' }) });
      else if (it.tmdbId) await api('/api/movies/from-tmdb', { method: 'POST', body: JSON.stringify({ tmdbId: it.tmdbId, mediaType: 'movie', status: 'watchlist' }) });
      else await api('/api/movies', { method: 'POST', body: JSON.stringify({ title: it.name, type: 'movie', status: 'watchlist', year: it.year, posterUrl: it.posterUrl }) });
      setAdded(a => ({ ...a, [k]: 'ok' }));
    } catch (e) { setAdded(a => ({ ...a, [k]: null })); setMsg(e.message); }
  };
  return <main className="wx" dir="rtl">
    <Nav />
    <div className="wx-page">
      <header className="wx-hero">
        <div><p>بر اساس سلیقهٔ شما</p><h1>پیشنهاد برای تماشا</h1><small>{data?.source === 'tmdb' ? 'از روی فهرست‌های «مشابه» TMDB برای بهترین‌های شما' : data?.source === 'ai' ? 'انتخاب هوش مصنوعی از روی بهترین‌های شما' : ''}</small></div>
        <div className="wx-hero-ops">
          <span className="wx-seg">{[['series', 'سریال'], ['movie', 'فیلم']].map(([k, l]) => <button key={k} type="button" className={kind === k ? 'on' : ''} onClick={() => setKind(k)}>{l}</button>)}</span>
          <button type="button" className="wx-btn ghost" onClick={() => load(true)} disabled={busy}>↻ پیشنهاد تازه</button>
        </div>
      </header>
      {msg && <div className="notice">{msg}<button onClick={() => setMsg('')}>×</button></div>}
      {!data ? <p className="wx-empty">در حال پیدا کردن پیشنهادها…</p> : data.error ? <p className="wx-empty">{data.error}</p> : !data.items?.length ? <p className="wx-empty">{data.message || 'پیشنهادی پیدا نشد.'}</p> :
        <div className="wx-grid">{data.items.map(it => {
          const k = it.tmdbId || it.tvmazeId || it.name, st = added[k];
          return <article key={k} className="wx-card">
            <Poster src={it.posterUrl} />
            <div className="wx-card-body">
              <b dir="auto">{it.name}</b>
              <small>{[it.year && faD(it.year), it.rating ? `★ ${faD(Math.round(it.rating * 10) / 10)}` : ''].filter(Boolean).join(' · ')}</small>
              {it.why ? <p className="wx-why">{it.why}</p> : it.because?.length ? <p className="wx-why">چون «{it.because.join('»، «')}» را دوست داشتی</p> : null}
              {it.overview ? <p className="wx-ov" dir="auto">{it.overview}</p> : null}
              <button type="button" className={`wx-btn ${st === 'ok' ? 'done' : ''}`} disabled={!!st} onClick={() => add(it)}>{st === 'ok' ? '✓ به «بعداً» اضافه شد' : st === 'busy' ? '…' : '+ بعداً می‌بینم'}</button>
            </div>
          </article>;
        })}</div>}
    </div>
  </main>;
}
