import { useEffect, useMemo, useState } from 'react';
import { Bookmark, BookmarkCheck, ExternalLink, Languages, RefreshCw, Sparkles, Trash2 } from 'lucide-react';
import { Page, api, fa } from './life-core';
import { jLabel } from './jdate';

// «خبر و خواندنی»: RSS news (sources you add, synced by the Worker; AI summary/translation when a key is set)
// and bookmarks with a read-later list. Backend: /api/news(+sources, sync, :id/summarize, :id/translate), /api/bookmarks.
const host = u => { try { return new URL(u).hostname.replace(/^www\./, ''); } catch { return ''; } };
const safeUrl = u => /^https?:\/\//i.test(u || '') ? u : '';
// One-tap sources; the server checks each feed when it's added (an unreachable one just shows an error).
// A site address (no feed path) works too: the server finds its feed. Ecoiran was dropped: it refuses requests from Cloudflare.
const PRESETS = [
  ['بی‌بی‌سی فارسی', 'https://feeds.bbci.co.uk/persian/rss.xml', 'عمومی'], ['ایندیپندنت فارسی', 'https://www.independentpersian.com/rss.xml', 'عمومی'],
  ['ایسنا', 'https://www.isna.ir/rss', 'عمومی'], ['خبرآنلاین', 'https://www.khabaronline.ir/rss', 'عمومی'],
  ['زومیت', 'https://www.zoomit.ir/feed/', 'تکنولوژی'], ['دیجیاتو', 'https://digiato.com/feed', 'تکنولوژی'],
  ['دنیای اقتصاد', 'https://donya-e-eqtesad.com', 'اقتصاد'], ['ورزش سه', 'https://www.varzesh3.com/news', 'ورزشی'], ['The Verge', 'https://www.theverge.com/rss/index.xml', 'تکنولوژی'],
];

function WeeklySummary({ onClose }) {
  const [d, setD] = useState(null), [err, setErr] = useState('');
  useEffect(() => { api('/api/news/weekly-summary').then(setD).catch(e => setErr(e.message)); }, []);
  const top = o => Object.entries(o || {}).sort((a, b) => b[1] - a[1]).slice(0, 5);
  return <div className="rd-week" role="region" aria-label="خلاصهٔ هفتهٔ اخبار">
    <header><b>📊 خلاصهٔ ۷ روز اخیر</b><button type="button" className="rd-x" onClick={onClose} aria-label="بستن خلاصه">✕</button></header>
    {err ? <p className="rd-msg">⚠ {err}</p> : !d ? <p className="rd-muted">در حال آماده‌سازی…</p> : <>
      {d.narrative ? <p className="rd-ai">✨ {d.narrative}</p> : null}
      <div className="rd-wstats"><span><b>{fa(d.stats.total)}</b> خبر</span><span><b>{fa(d.stats.savedCount)}</b> ذخیره‌شده</span></div>
      {d.stats.total ? <div className="rd-wcols">
        <div><small>دسته‌ها</small>{top(d.stats.byCategory).map(([k, n]) => <p key={k}>{k} <em>{fa(n)}</em></p>)}</div>
        <div><small>منابع</small>{top(d.stats.bySource).map(([k, n]) => <p key={k}>{k} <em>{fa(n)}</em></p>)}</div>
      </div> : <p className="rd-muted">این هفته خبری نیامده.</p>}
      {(d.savedItems || []).length ? <><small className="rd-wsub">ذخیره‌های این هفته</small><ul className="rd-wsaved">{d.savedItems.slice(0, 8).map(x => <li key={x.id}>{safeUrl(x.url) ? <a href={safeUrl(x.url)} target="_blank" rel="noopener noreferrer">{x.title}</a> : x.title}</li>)}</ul></> : null}
    </>}
  </div>;
}

function News() {
  const [items, setItems] = useState(null), [sources, setSources] = useState([]), [cat, setCat] = useState(''), [savedOnly, setSavedOnly] = useState(false);
  const [busy, setBusy] = useState(''), [msg, setMsg] = useState(''), [showSrc, setShowSrc] = useState(false), [src, setSrc] = useState({ url: '', category: '' }), [week, setWeek] = useState(false);
  const load = () => Promise.all([api('/api/news').then(d => setItems(d.items || [])), api('/api/news/sources').then(d => setSources(d.items || []))]).catch(e => setMsg(e.message));
  useEffect(() => { load(); }, []);
  const cats = useMemo(() => [...new Set((items || []).map(x => x.category).filter(Boolean))], [items]);
  const list = (items || []).filter(x => (!cat || x.category === cat) && (!savedOnly || x.saved));
  const sync = async () => { setBusy('sync'); setMsg(''); try { const r = await api('/api/news/sync', { method: 'POST' }); setMsg(r.added ? `${fa(r.added)} خبر تازه آمد.` : 'خبر تازه‌ای نبود.'); await load(); } catch (e) { setMsg(e.message); } setBusy(''); };
  const patch = async (x, body) => { setItems(xs => xs.map(y => y.id === x.id ? { ...y, ...body } : y)); await api(`/api/news/${x.id}`, { method: 'PATCH', body: JSON.stringify(body) }).catch(() => load()); };
  const del = async x => { setItems(xs => xs.filter(y => y.id !== x.id)); await api(`/api/news/${x.id}`, { method: 'DELETE' }).catch(() => load()); };
  const ai = async (x, kind) => { setBusy(kind + x.id); try { const r = await api(`/api/news/${x.id}/${kind}`, { method: 'POST' }); setItems(xs => xs.map(y => y.id !== x.id ? y : kind === 'summarize' ? { ...y, aiSummary: r.summary } : { ...y, title: r.title || y.title, summary: r.summary || y.summary })); } catch (e) { setMsg(e.message); } setBusy(''); };
  const addFrom = async (body, done) => {
    setBusy('add'); setMsg('در حال پیدا کردن فید…');
    try { const r = await api('/api/news/sources', { method: 'POST', body: JSON.stringify(body) }); setMsg(`«${r.name}» اضافه شد${r.added ? ` و ${fa(r.added)} خبر آمد` : ''}.`); done?.(); await load(); }
    catch (x) { setMsg(x.message); }
    setBusy('');
  };
  // every suggested source in one go (one request each, so a site that can't be reached doesn't block the rest)
  const addAll = async () => {
    const todo = PRESETS.filter(([n, u]) => !sources.some(x => x.url === u || x.name === n)); if (!todo.length) return;
    setBusy('add'); let ok = 0, got = 0; const bad = [];
    for (const [i, [n, u, c]] of todo.entries()) {
      setMsg(`در حال افزودن ${fa(i + 1)} از ${fa(todo.length)}: ${n}…`);
      try { const r = await api('/api/news/sources', { method: 'POST', body: JSON.stringify({ name: n, url: u, category: c }) }); ok++; got += r.added || 0; }
      catch (x) { if (!/قبلاً/.test(x.message)) bad.push(n); }
    }
    setMsg(`${fa(ok)} منبع اضافه شد و ${fa(got)} خبر آمد.${bad.length ? ` در دسترس نبود: ${bad.join('، ')}` : ''}`);
    setBusy(''); await load();
  };
  const addSrc = e => { e.preventDefault(); if (!src.url.trim()) { setMsg('آدرس سایت را بنویس، مثلاً zoomit.ir'); return; } addFrom({ url: src.url.trim(), category: src.category || 'عمومی' }, () => setSrc({ url: '', category: '' })); };
  const delSrc = async s => { if (!window.confirm(`منبع «${s.name}» حذف شود؟`)) return; await api(`/api/news/sources/${s.id}`, { method: 'DELETE' }).catch(() => {}); load(); };
  return <section className="rd-card">
    <header>
      <h2>📰 اخبار</h2>
      <div className="rd-ops">
        <button type="button" className="rd-btn" onClick={sync} disabled={busy === 'sync' || !sources.length}><RefreshCw size={15} className={busy === 'sync' ? 'spin' : ''} />به‌روزرسانی</button>
        <button type="button" className="rd-btn ghost" onClick={() => setWeek(v => !v)} aria-expanded={week}>خلاصهٔ هفته</button>
        <button type="button" className="rd-btn ghost" onClick={() => setShowSrc(v => !v)} aria-expanded={showSrc}>منابع ({fa(sources.length)})</button>
      </div>
    </header>
    {week ? <WeeklySummary onClose={() => setWeek(false)} /> : null}
    {showSrc || (sources !== null && !sources.length && items !== null && !items.length) ? <div className="rd-src">
      <form className="rd-add rd-srcadd" onSubmit={addSrc}>
        <input value={src.url} onChange={e => setSrc(o => ({ ...o, url: e.target.value }))} placeholder="آدرس سایت یا فید — مثلاً zoomit.ir" aria-label="آدرس سایت یا فید" dir="ltr" />
        <input value={src.category} onChange={e => setSrc(o => ({ ...o, category: e.target.value }))} placeholder="دسته (اختیاری)" aria-label="دستهٔ منبع" />
        <button type="submit" className="rd-btn" disabled={busy === 'add'}>{busy === 'add' ? '…' : 'افزودن'}</button>
      </form>
      <p className="rd-muted rd-hint">لازم نیست RSS را بدانی؛ آدرس خود سایت کافی است. اگر سایت فید نداشته باشد، تیترها از خود صفحه خوانده می‌شوند (مثل ورزش سه).</p>
      {PRESETS.filter(([n, u]) => !sources.some(x => x.url === u || x.name === n)).length ? <div className="rd-presets"><small>پیشنهادی (یک کلیک):</small><button type="button" className="rd-all" disabled={busy === 'add'} onClick={addAll}>＋ همه را اضافه کن</button>{PRESETS.filter(([n, u]) => !sources.some(x => x.url === u || x.name === n)).map(([n, u, c]) => <button type="button" key={u} disabled={busy === 'add'} onClick={() => addFrom({ name: n, url: u, category: c })}>+ {n}</button>)}</div> : null}
      {sources.length ? <ul className="rd-srclist">{sources.map(s => <li key={s.id}><span><b>{s.name}</b><small dir="ltr">{host(s.url)}</small>{s.lastError ? <small className="bad">⚠ {s.lastError}</small> : null}</span><button type="button" className="rd-x" onClick={() => delSrc(s)} aria-label={`حذف منبع ${s.name}`}><Trash2 size={15} /></button></li>)}</ul> : <p className="rd-muted">هنوز منبعی نداری. از پیشنهادها انتخاب کن یا آدرس یک سایت خبری را بنویس.</p>}
    </div> : null}
    <div className="rd-filters" role="group" aria-label="فیلتر اخبار">
      <button type="button" className={!cat && !savedOnly ? 'on' : ''} onClick={() => { setCat(''); setSavedOnly(false); }}>همه</button>
      <button type="button" className={savedOnly ? 'on' : ''} onClick={() => setSavedOnly(v => !v)}>ذخیره‌شده</button>
      {cats.map(c => <button type="button" key={c} className={cat === c ? 'on' : ''} onClick={() => setCat(cat === c ? '' : c)}>{c}</button>)}
    </div>
    {msg ? <p className="rd-msg" role="status">{msg}</p> : null}
    {items === null ? <p className="rd-muted">در حال بارگذاری…</p> : !list.length ? <p className="rd-muted">{items.length ? 'با این فیلتر خبری نیست.' : sources.length ? 'خبری نیست؛ «به‌روزرسانی» را بزن.' : 'برای دیدن اخبار، بالا یک منبع انتخاب کن.'}</p>
      : <ul className="rd-news">{list.slice(0, 60).map(x => <li key={x.id}>
        <div className="rd-news-head">
          {safeUrl(x.url) ? <a href={safeUrl(x.url)} target="_blank" rel="noopener noreferrer"><b>{x.title}</b><ExternalLink size={13} /></a> : <b>{x.title}</b>}
        </div>
        <small className="rd-meta">{[x.source, x.category, jLabel(x.date)].filter(Boolean).join(' · ')}</small>
        {x.summary ? <p className="rd-sum">{x.summary.length > 320 ? x.summary.slice(0, 320) + '…' : x.summary}</p> : null}
        {x.aiSummary ? <p className="rd-ai">✨ {x.aiSummary}</p> : null}
        <div className="rd-actions">
          <button type="button" onClick={() => patch(x, { saved: !x.saved })} aria-pressed={!!x.saved} aria-label={x.saved ? 'برداشتن از ذخیره‌شده‌ها' : 'ذخیره'}>{x.saved ? <BookmarkCheck size={15} /> : <Bookmark size={15} />}{x.saved ? 'ذخیره شد' : 'ذخیره'}</button>
          {x.summary && x.summary.length >= 300 ? <button type="button" onClick={() => ai(x, 'summarize')} disabled={busy === 'summarize' + x.id}><Sparkles size={15} />خلاصه</button> : null}
          {/[a-z]{4,}/i.test(x.title) ? <button type="button" onClick={() => ai(x, 'translate')} disabled={busy === 'translate' + x.id}><Languages size={15} />ترجمه</button> : null}
          <button type="button" className="rd-del" onClick={() => del(x)} aria-label="حذف خبر"><Trash2 size={15} /></button>
        </div>
      </li>)}</ul>}
  </section>;
}

function Bookmarks() {
  const [items, setItems] = useState(null), [f, setF] = useState({ url: '', title: '', tags: '' }), [tab, setTab] = useState('later'), [err, setErr] = useState('');
  const load = () => api('/api/bookmarks').then(d => setItems(d.items || [])).catch(e => setErr(e.message));
  useEffect(() => { load(); }, []);
  const add = async e => { e.preventDefault(); if (!safeUrl(f.url.trim())) { setErr('لینک باید با https:// یا http:// شروع شود.'); return; } try { await api('/api/bookmarks', { method: 'POST', body: JSON.stringify({ ...f, url: f.url.trim(), readLater: true }) }); setF({ url: '', title: '', tags: '' }); setErr(''); load(); } catch (x) { setErr(x.message); } };
  const toggle = async b => { setItems(xs => xs.map(y => y.id === b.id ? { ...y, readLater: !b.readLater } : y)); await api(`/api/bookmarks/${b.id}`, { method: 'PATCH', body: JSON.stringify({ readLater: !b.readLater }) }).catch(() => load()); };
  const del = async b => { if (!window.confirm('این لینک حذف شود؟')) return; setItems(xs => xs.filter(y => y.id !== b.id)); await api(`/api/bookmarks/${b.id}`, { method: 'DELETE' }).catch(() => load()); };
  const list = (items || []).filter(b => tab === 'later' ? b.readLater : !b.readLater);
  return <section className="rd-card">
    <header><h2>🔖 بوکمارک‌ها</h2></header>
    <form className="rd-add rd-bmadd" onSubmit={add}>
      <input value={f.url} onChange={e => setF(o => ({ ...o, url: e.target.value }))} placeholder="لینک (https://…)" aria-label="لینک" dir="ltr" />
      <input value={f.title} onChange={e => setF(o => ({ ...o, title: e.target.value }))} placeholder="عنوان (اختیاری)" aria-label="عنوان لینک" />
      <input value={f.tags} onChange={e => setF(o => ({ ...o, tags: e.target.value }))} placeholder="برچسب‌ها (اختیاری)" aria-label="برچسب‌ها" />
      <button type="submit" className="rd-btn">ذخیره</button>
    </form>
    {err ? <p className="rd-msg" role="status">⚠ {err}</p> : null}
    <div className="rd-filters" role="tablist" aria-label="بوکمارک‌ها">
      <button type="button" role="tab" aria-selected={tab === 'later'} className={tab === 'later' ? 'on' : ''} onClick={() => setTab('later')}>بعداً می‌خوانم ({fa((items || []).filter(b => b.readLater).length)})</button>
      <button type="button" role="tab" aria-selected={tab === 'done'} className={tab === 'done' ? 'on' : ''} onClick={() => setTab('done')}>خوانده‌شده</button>
    </div>
    {items === null ? <p className="rd-muted">در حال بارگذاری…</p> : !list.length ? <p className="rd-muted">{tab === 'later' ? 'فهرست «بعداً می‌خوانم» خالی است.' : 'هنوز لینکی را خوانده‌شده علامت نزده‌ای.'}</p>
      : <ul className="rd-bm">{list.map(b => <li key={b.id}>
        <span>{safeUrl(b.url) ? <a href={safeUrl(b.url)} target="_blank" rel="noopener noreferrer"><b>{b.title || b.url}</b></a> : <b>{b.title}</b>}<small dir="ltr">{host(b.url)}</small>{b.tags ? <small>🏷 {b.tags}</small> : null}</span>
        <button type="button" className="rd-btn ghost sm" onClick={() => toggle(b)}>{b.readLater ? 'خواندم' : 'برگردان'}</button>
        <button type="button" className="rd-x" onClick={() => del(b)} aria-label="حذف لینک"><Trash2 size={15} /></button>
      </li>)}</ul>}
  </section>;
}

export function ReadingPage({ Nav }) {
  return <Page Nav={Nav} className="rd" kicker="خبر و خواندنی" title="خواندنی‌ها" sub="اخبار منابع دلخواهت و لینک‌هایی که می‌خواهی بعداً بخوانی">
    <div className="rd-grid"><News /><Bookmarks /></div>
  </Page>;
}
