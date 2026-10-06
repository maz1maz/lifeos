// Series & movies pages (tracker, detail drawers, TVmaze/TMDB search), split out of main.jsx so they load on demand.
import { useEffect, useMemo, useState } from 'react';
import { Check, ChevronDown, Search, Star, Trash2, X } from 'lucide-react';
import { api, isoToday, fa, faDigits, JALALI_MONTHS, iso, fromIso, toJalali, seasonAiredCount, seasonTotalCount, seriesHasFresh, watchLabel, waitingNewSeason, episodesWatchedCount, seriesAiredTotal, SERIES_TABS, seriesInTab, SHOW_STATUS_FA, readDataUrl, jalaliDayLabel } from './main-util';

function ShowPreview({ show, added, busy, onAdd, onOpen, onClose }) {
  const [eps, setEps] = useState(null), [openS, setOpenS] = useState(null);
  useEffect(() => {
    let dead = false; setEps(null);
    api(`/api/movies/tvmaze/episodes?tvmazeId=${encodeURIComponent(show.tvmazeId)}`).then(d => !dead && setEps(d.items || [])).catch(() => !dead && setEps([]));
    const k = e => e.key === 'Escape' && onClose(); window.addEventListener('keydown', k);
    return () => { dead = true; window.removeEventListener('keydown', k); };
  }, [show.tvmazeId]);
  const seasons = useMemo(() => {
    const m = new Map(); (eps || []).forEach(e => { const s = m.get(e.season) || { n: e.season, total: 0, aired: 0, first: e.airdate, last: e.airdate, eps: [] }; s.total++; if (e.aired) s.aired++; if (e.airdate && (!s.first || e.airdate < s.first)) s.first = e.airdate; if (e.airdate > s.last) s.last = e.airdate; s.eps.push(e); m.set(e.season, s); });
    return [...m.values()].sort((a, b) => a.n - b.n);
  }, [eps]);
  const total = (eps || []).length, aired = (eps || []).filter(e => e.aired).length;
  const rts = (eps || []).map(e => Number(e.runtime)).filter(Boolean), runtime = rts.length ? Math.round(rts.reduce((a, b) => a + b, 0) / rts.length) : null;
  const next = (eps || []).filter(e => !e.aired && e.airdate).sort((a, b) => a.airdate.localeCompare(b.airdate))[0];
  const jd = iso => { if (!iso) return ''; const j = toJalali(fromIso(iso)); return `${faDigits(j.jd)} ${JALALI_MONTHS[j.jm - 1]} ${faDigits(j.jy)}`; };
  const yr = iso => iso ? faDigits(toJalali(fromIso(iso)).jy) : '';
  return (
    <div className="strk-modal-backdrop" onClick={onClose}>
      <div className="strk-modal shp" onClick={e => e.stopPropagation()}>
        <button className="strk-modal-close" onClick={onClose} aria-label="بستن"><X size={18} /></button>
        <div className="strk-modal-head">
          {show.posterUrl ? <img src={show.posterUrl} alt="" /> : <span className="strk-modal-poster-fallback">🎬</span>}
          <div className="strk-modal-info">
            <h2><bdi>{show.name}</bdi></h2>
            <p className="strk-modal-meta">{[show.year && faDigits(show.year), show.network, (show.genres || []).join('، ')].filter(Boolean).join(' · ')}</p>
            <div className="shp-facts">
              {show.status && <span className={show.status === 'Running' ? 'ok' : ''}>{SHOW_STATUS_FA[show.status] || show.status}</span>}
              {show.rating ? <span>★ {faDigits(show.rating)}</span> : null}
              {eps === null ? <span>…</span> : <>
                <span><b>{fa(seasons.length)}</b> فصل</span>
                <span><b>{fa(total)}</b> قسمت{aired < total ? ` (${fa(aired)} پخش‌شده)` : ''}</span>
                {runtime && <span>~<b>{fa(runtime)}</b> دقیقه</span>}
                {runtime && aired ? <span>کل: <b>{fa(Math.round(runtime * aired / 60))}</b> ساعت</span> : null}
              </>}
            </div>
            {next && <p className="shp-next">قسمت بعد: فصل {fa(next.season)} قسمت {fa(next.number)} · {jd(next.airdate)}</p>}
            <div className="shp-actions">
              {added ? <><span className="strk-added">✓ در فهرست شماست</span><button type="button" className="strk-more-btn" onClick={onOpen}>باز کردن</button></>
                : <><button type="button" className="strk-add-btn" disabled={busy} onClick={() => onAdd('watchlist')}>{busy ? 'در حال افزودن…' : '+ افزودن به «بعداً»'}</button>
                  <button type="button" className="strk-more-btn" disabled={busy} onClick={() => onAdd('watching')}>▶ دارم می‌بینم</button></>}
            </div>
          </div>
        </div>
        {show.summary && <p className="strk-modal-note shp-sum" dir="auto">{show.summary}</p>}
        <div className="strk-seasons-body">
          {eps === null ? <p className="empty">در حال دریافت فصل‌ها…</p> : !seasons.length ? <p className="empty">اطلاعات فصل‌ها در دسترس نیست.</p> : seasons.map(se => (
            <div className="strk-season" key={se.n}>
              <button className="strk-season-head" onClick={() => setOpenS(openS === se.n ? null : se.n)}>
                <ChevronDown size={16} className={openS === se.n ? 'open' : ''} />
                <span className="strk-season-count">{fa(se.total)} قسمت</span>
                <b>فصل {fa(se.n)}</b>
                <small className="muted shp-yr">{yr(se.first)}{se.aired < se.total ? ` · ${fa(se.aired)} پخش‌شده` : ''}</small>
              </button>
              {openS === se.n && <ul className="strk-ep-list">{se.eps.map(ep => <li key={ep.id} className={!ep.aired ? 'strk-ep-unaired' : ''} style={{ cursor: 'default' }}><span className="strk-ep-info"><b><bdi>{ep.name || `قسمت ${fa(ep.number)}`}</bdi></b><small>{jd(ep.airdate)}</small></span><span className="strk-ep-num">E{faDigits(ep.number)}</span></li>)}</ul>}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
function StatusSeg({ value, options, onChange }) {
  return <div className="strk-seg" role="radiogroup">{options.map(([k, l]) => <button type="button" key={k} role="radio" aria-checked={value === k} className={value === k ? 'on' : ''} onClick={() => value !== k && onChange(k)}>{l}</button>)}</div>;
}
// rating stored 1..10 (legacy); shown as 5 stars, each star = 2 points
function Stars5({ value, onChange }) {
  const cur = Math.round((Number(value) || 0) / 2);
  return <div className="strk-stars" title={cur ? `${fa(cur)} از ۵` : 'امتیاز'}>{[1, 2, 3, 4, 5].map(n => <button type="button" key={n} aria-label={`${fa(n)} ستاره`} className={n <= cur ? 'on' : ''} onClick={() => onChange(n === cur ? null : n * 2)}><Star size={18} fill={n <= cur ? 'currentColor' : 'none'} /></button>)}</div>;
}
const SERIES_STATUS_OPTIONS = [['watchlist', 'بعداً'], ['watching', 'در حال تماشا'], ['completed', 'تمام‌شده'], ['dropped', 'رها‌شده']];

export function SeriesReact({ Nav }) {
  const [items, setItems] = useState([]);
  const [tab, setTab] = useState('watching');
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [open, setOpen] = useState(null);
  const [busyId, setBusyId] = useState(null);
  const [notice, setNotice] = useState('');
  const [toast, setToast] = useState('');
  const [bingersOpen, setBingersOpen] = useState(false);
  const [bingersLib, setBingersLib] = useState(null);
  const [bingersWatches, setBingersWatches] = useState(null);
  const [bingersPreview, setBingersPreview] = useState(null);
  const [bingersSelected, setBingersSelected] = useState(new Set());
  const [bingersBusy, setBingersBusy] = useState(false);

  const flash = (msg, ms = 2400) => { setToast(msg); setTimeout(() => setToast(''), ms); };
  const load = () => api('/api/movies').then(data => setItems((data.items || []).filter(x => x.type === 'series'))).catch(e => setNotice(e.message));
  useEffect(() => { load(); }, []);

  const readDataUrl = file => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });

  const previewBingers = async () => {
    if (!bingersLib) return flash('فایل library.csv را انتخاب کن.');
    setBingersBusy(true);
    try {
      const libraryCsvBase64 = await readDataUrl(bingersLib);
      const watchesCsvBase64 = bingersWatches ? await readDataUrl(bingersWatches) : undefined;
      const data = await api('/api/movies/import-bingers/preview', { method: 'POST', body: JSON.stringify({ libraryCsvBase64, watchesCsvBase64 }) });
      setBingersPreview(data);
      setBingersSelected(new Set((data.items || []).filter(x => !x.duplicate).map((x, i) => i)));
    } catch (e) { flash(e.message); }
    setBingersBusy(false);
  };

  const commitBingers = async () => {
    if (!bingersPreview) return;
    const items = (bingersPreview.items || []).filter((x, i) => bingersSelected.has(i));
    if (!items.length) return flash('چیزی برای درون‌ریزی انتخاب نشده.');
    setBingersBusy(true);
    try {
      const res = await api('/api/movies/import-bingers/commit', { method: 'POST', body: JSON.stringify({ items }) });
      flash(`${fa(res.imported)} سریال اضافه شد${res.skipped ? ` · ${fa(res.skipped)} تکراری رد شد` : ''} ✓`);
      setBingersOpen(false); setBingersPreview(null); setBingersLib(null); setBingersWatches(null); setBingersSelected(new Set());
      load();
    } catch (e) { flash(e.message); }
    setBingersBusy(false);
  };

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

  const [addingId, setAddingId] = useState(null);
  const [preview, setPreview] = useState(null);
  const addShow = async (show, status = 'watchlist') => {
    if (!show || addingId) return;
    setAddingId(show.tvmazeId);
    try {
      const r = await api('/api/movies/from-tvmaze', { method: 'POST', body: JSON.stringify({ tvmazeId: show.tvmazeId, name: show.name, posterUrl: show.posterUrl, status, ...(status === 'watching' ? { currentSeason: 1, currentEpisode: 0 } : {}) }) });
      setQuery(''); setResults([]); setPreview(null);
      if (r.already) { setTab('all'); flash(`«${show.name}» از قبل در فهرست هست`); }
      else { setTab('all'); flash(`«${show.name}» اضافه شد ✓`); }
      load();
    } catch (e) { flash('افزودن نشد — ' + e.message, 5000); }
    setAddingId(null);
  };

  const quickWatch = async item => {
    setBusyId(item.id);
    const cur = Number(item.currentSeason) || 1, ep0 = Number(item.currentEpisode) || 0, aired = seasonAiredCount(item, cur) || Number(item.airedInSeason) || 0;
    const roll = aired && ep0 >= aired && (Number((item.seasonEpisodes || {})[cur + 1]?.aired) || 0) > 0;
    const nextSeason = item.status === 'watchlist' ? 1 : roll ? cur + 1 : cur, nextEp = item.status === 'watchlist' ? 1 : roll ? 1 : ep0 + 1;
    try {
      await api(`/api/movies/${item.id}`, { method: 'PATCH', body: JSON.stringify({ currentEpisode: nextEp, currentSeason: nextSeason, status: item.status === 'watchlist' ? 'watching' : item.status }) });
      flash(`«${item.title}» فصل ${fa(nextSeason)} قسمت ${fa(nextEp)} ✓`);
      load();
    } catch (e) { flash(e.message); }
    setBusyId(null);
  };

  const stats = useMemo(() => {
    const eps = items.reduce((n, x) => n + episodesWatchedCount(x), 0);
    const mins = items.reduce((n, x) => n + episodesWatchedCount(x) * (x.durationMinutes || 45), 0);
    return { count: items.length, eps, hours: Math.round(mins / 60), completed: items.filter(x => x.status === 'completed').length };
  }, [items]);

  const unseenOf = x => { const c = Number(x.currentSeason) || 1; return Math.max(0, (seasonAiredCount(x, c) || Number(x.airedInSeason) || 0) - (Number(x.currentEpisode) || 0)); };
  const shown = items.filter(x => seriesInTab(x, tab)).slice().sort((a, b) => (seriesHasFresh(b) - seriesHasFresh(a)) || (b.lastTouchedAt || b.createdAt || 0) - (a.lastTouchedAt || a.createdAt || 0));

  return (
    <main className="strk" dir="rtl">
      <Nav active="series" />
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
          <input value={query} onChange={e => setQuery(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') { const f = results.find(x => !addedIds.has(String(x.tvmazeId))); if (f) addShow(f); } if (e.key === 'Escape') { setQuery(''); setResults([]); } }} placeholder="نام سریال (انگلیسی، با سال اختیاری مثل Monster 2022) یا لینک TVMaze / IMDb" />
          {searching && <span className="strk-spinner" />}
          {results.length > 0 && (
            <div className="strk-results">
              {results.map(show => (
                <div className="strk-result-row is-click" key={show.tvmazeId} onClick={() => setPreview(show)} title="جزئیات سریال">
                  {show.posterUrl ? <img src={show.posterUrl} alt="" /> : <span className="strk-result-fallback">🎬</span>}
                  <div className="strk-result-info"><b>{show.name}</b><small>{show.year}{show.genres?.length ? ' · ' + show.genres.join('، ') : ''}</small></div>
                  {addedIds.has(String(show.tvmazeId)) ? <span className="strk-added">اضافه شده</span> : <button type="button" className="strk-add-btn" disabled={!!addingId} onClick={e => { e.stopPropagation(); addShow(show); }}>{addingId === show.tvmazeId ? 'در حال افزودن…' : '+ افزودن'}</button>}
                </div>
              ))}
            </div>
          )}
        </div>

        <button type="button" className="strk-more-btn" style={{ marginBottom: 14 }} onClick={() => setBingersOpen(v => !v)}>📥 ایمپورت از Bingers</button>
        {bingersOpen && (
          <section className="strk-upnext" style={{ marginBottom: 16 }}>
            <div className="strk-upnext-head"><h2>ایمپورت از Bingers</h2><span>library.csv الزامی · watches.csv اختیاری</span></div>
            {!bingersPreview ? (
              <div className="strk-upnext-list">
                <label className="strk-result-row" style={{ cursor: 'pointer' }}>
                  <span className="strk-result-info"><b>library.csv</b><small>{bingersLib ? bingersLib.name : 'فایلی انتخاب نشده'}</small></span>
                  <input type="file" accept=".csv,text/csv" hidden onChange={e => setBingersLib(e.target.files?.[0] || null)} />
                  <span className="strk-add-btn">انتخاب</span>
                </label>
                <label className="strk-result-row" style={{ cursor: 'pointer' }}>
                  <span className="strk-result-info"><b>watches.csv</b><small>{bingersWatches ? bingersWatches.name : 'اختیاری — برای تشخیص قسمت جاری'}</small></span>
                  <input type="file" accept=".csv,text/csv" hidden onChange={e => setBingersWatches(e.target.files?.[0] || null)} />
                  <span className="strk-add-btn">انتخاب</span>
                </label>
                <button type="button" className="strk-watch-btn-full" disabled={bingersBusy} onClick={previewBingers}>{bingersBusy ? '...' : 'پیش‌نمایش'}</button>
              </div>
            ) : (
              <div className="strk-upnext-list">
                <div className="strk-upnext-head"><span>{fa(bingersPreview.items.length)} سریال · {fa(bingersPreview.duplicateCount)} تکراری</span></div>
                {bingersPreview.items.map((it, i) => (
                  <label className="strk-upnext-row" key={i} style={{ opacity: it.duplicate ? .55 : 1 }}>
                    <input type="checkbox" checked={bingersSelected.has(i)} onChange={e => setBingersSelected(prev => { const n = new Set(prev); if (e.target.checked) n.add(i); else n.delete(i); return n; })} />
                    <div className="strk-upnext-info"><b>{it.title}</b><small>{it.year || ''}{it.duplicate ? ' · قبلاً اضافه شده' : ''}{it.episodesWatched ? ` · ${fa(it.episodesWatched)} قسمت دیده‌شده` : ''}</small></div>
                  </label>
                ))}
                <div style={{ display: 'flex', gap: 8 }}>
                  <button type="button" className="strk-watch-btn-full" disabled={bingersBusy} onClick={commitBingers}>{bingersBusy ? '...' : `درون‌ریزی ${fa(bingersSelected.size)} مورد`}</button>
                  <button type="button" className="strk-more-btn" onClick={() => { setBingersPreview(null); setBingersSelected(new Set()); }}>بازگشت</button>
                </div>
              </div>
            )}
          </section>
        )}

        {notice && <div className="notice">{notice}<button onClick={() => setNotice('')}>×</button></div>}

        <div className="strk-tabs">
          {SERIES_TABS.map(([key, label]) => (
            <button key={key} className={tab === key ? 'active' : ''} onClick={() => setTab(key)}>
              {label} ({fa(items.filter(x => seriesInTab(x, key)).length)})
            </button>
          ))}
        </div>

        {shown.length === 0 && <p className="empty">چیزی اینجا نیست — از جستجوی بالا سریال اضافه کن.</p>}

        <div className="sr-grid sr-page">
          {shown.map(item => {
            const cur = Number(item.currentSeason) || 1, ep = Number(item.currentEpisode) || 0;
            const aired = seasonAiredCount(item, cur) || Number(item.airedInSeason) || 0, total = seasonTotalCount(item, cur) || aired;
            const airedTotal = seriesAiredTotal(item), watched = episodesWatchedCount(item);
            const pct = airedTotal ? Math.min(100, watched / airedTotal * 100) : 0, left = unseenOf(item), fresh = seriesHasFresh(item);
            const seasons = Object.keys(item.seasonEpisodes || {}).length;
            const canWatch = item.status === 'watchlist' || (item.status === 'watching' && fresh);
            return <div className={`sr-item ${fresh && item.status === 'watching' ? 'has-new' : ''}`} key={item.id}>
              <button type="button" className="sr-poster" onClick={() => setOpen(item)} aria-label={`جزئیات ${item.title}`}>{item.posterUrl ? <img src={item.posterUrl} alt="" loading="lazy" onError={e => e.target.remove()} /> : null}<span>🎬</span>{item.tmdbRating != null && <em>★ {fa(Math.round(item.tmdbRating * 10) / 10)}</em>}</button>
              <div className="sr-info">
                <b title={item.title}>{item.title}</b>
                <small>{item.status === 'watchlist' ? `${seasons ? fa(seasons) + ' فصل' : 'سریال'}${item.network ? ' · ' + item.network : ''}` : `فصل ${fa(cur)} · قسمت ${fa(ep)}${total ? ` از ${fa(total)}` : ''}`}</small>
                <i className="sr-bar"><u style={{ width: `${pct}%`, background: pct >= 100 ? 'var(--g-good)' : undefined }} /></i>
                <small className="sr-total">{airedTotal ? `${fa(watched)} از ${fa(airedTotal)} قسمت کل سریال` : ''}</small>
                <div className="sr-foot">
                  {item.status === 'watchlist' ? <span className="muted">هنوز شروع نشده</span> : item.status === 'completed' ? <span className="sr-ok">✓ تمام شد</span> : left > 0 ? <span className="sr-new">{fa(left)} قسمت ندیده</span> : fresh ? <span className="sr-new">فصل تازه</span> : waitingNewSeason(item) ? <span className="muted">منتظر فصل جدید</span> : <span className="muted">منتظر قسمت بعد</span>}
                  <span className="sr-actions">
                    <button type="button" className="ghost" onClick={() => setOpen(item)}>قسمت‌ها</button>
                    {canWatch && <button type="button" disabled={busyId === item.id} onClick={() => quickWatch(item)}><Check size={14} /><span dir="rtl">{watchLabel(item)}</span></button>}
                  </span>
                </div>
              </div>
            </div>;
          })}
        </div>
      </div>
      {preview && <ShowPreview show={preview} added={addedIds.has(String(preview.tvmazeId))} busy={addingId === preview.tvmazeId} onAdd={st => addShow(preview, st)} onOpen={() => { const it = items.find(x => String(x.tvmazeId) === String(preview.tvmazeId)); setPreview(null); if (it) setOpen(it); }} onClose={() => setPreview(null)} />}
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
              <StatusSeg value={row.status} options={SERIES_STATUS_OPTIONS} onChange={v => patch({ status: v })} />
              <Stars5 value={row.rating} onChange={v => patch({ rating: v })} />
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

export function MoviesReact({ Nav }) {
  const [items, setItems] = useState([]);
  const [tab, setTab] = useState('watchlist');
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

  const shown = (tab === 'all' ? items : items.filter(x => x.status === tab)).slice().sort((a, b) => tab === 'completed' ? String(b.date || '').localeCompare(String(a.date || '')) : (b.createdAt || 0) - (a.createdAt || 0));

  return (
    <main className="strk" dir="rtl">
      <Nav active="series" />
      <div className="strk-page">
        <header className="strk-hero">
          <div><p>ردیاب فیلم‌ها</p><h1>فیلم‌های من</h1></div>
          <div className="strk-stats">
            <div><b>{fa(stats.count)}</b><small>فیلم</small></div>
            <div><b>{fa(stats.done)}</b><small>دیده‌شده</small></div>
            <div><b>{fa(stats.hours)}</b><small>ساعت تماشا</small></div>
            <div><b>{stats.avg ? fa(Math.round(stats.avg / 2 * 10) / 10) + ' ★' : '—'}</b><small>میانگین امتیاز از ۵</small></div>
          </div>
        </header>

        <div className="strk-search">
          <Search size={16} className="strk-search-ic" />
          <input value={query} onChange={e => setQuery(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') { const f = results.find(x => !addedIds.has(String(x.tmdbId))); if (f) addMovie(f); } if (e.key === 'Escape') { setQuery(''); setResults([]); } }} placeholder="جستجوی فیلم برای افزودن…" />
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

        <div className="sr-grid sr-page mv-page">
          {shown.map(item => {
            const meta = [item.director, item.genre, item.durationMinutes ? `${fa(item.durationMinutes)} دقیقه` : ''].filter(Boolean).join(' · ');
            return <div className="sr-item" key={item.id}>
              <button type="button" className="sr-poster" onClick={() => setOpen(item)} aria-label={`جزئیات ${item.title}`}>{item.posterUrl ? <img src={item.posterUrl} alt="" loading="lazy" onError={e => e.target.remove()} /> : null}<span>🎬</span>{item.tmdbRating != null && <em>★ {fa(Math.round(item.tmdbRating * 10) / 10)}</em>}</button>
              <div className="sr-info">
                <b title={item.title}>{item.title}</b>
                {meta && <small>{meta}</small>}
                {item.status === 'completed'
                  ? <small className="mv-seen">✓ دیده‌شده{item.date ? ` · ${jalaliDayLabel(String(item.date).slice(0, 10))} ${faDigits(toJalali(fromIso(String(item.date).slice(0, 10))).jy)}` : ''}{item.rating ? ` · ${'★'.repeat(Math.round(item.rating / 2))}` : ''}</small>
                  : <small className="muted">{item.status === 'watchlist' ? 'توی فهرست تماشا' : ''}</small>}
                <div className="sr-foot">
                  <span />
                  <span className="sr-actions">
                    <button type="button" className="ghost" onClick={() => setOpen(item)}>جزئیات</button>
                    {item.status !== 'completed' && <button type="button" disabled={busyId === item.id} onClick={() => markWatched(item)}><Check size={14} />دیدمش</button>}
                  </span>
                </div>
              </div>
            </div>;
          })}
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
              <StatusSeg value={row.status} options={MOVIE_STATUS_OPTIONS} onChange={v => patch({ status: v })} />
              <Stars5 value={row.rating} onChange={v => patch({ rating: v })} />
              <button className="strk-del-btn" onClick={del}><Trash2 size={14} /> حذف</button>
            </div>
          </div>
        </div>
        {row.note && <p className="strk-modal-note">{row.note}</p>}
      </div>
    </div>
  );
}

