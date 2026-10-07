import { useEffect, useMemo, useState } from 'react';
import { Bookmark, BookmarkCheck, ChevronDown, ChevronUp, ExternalLink, Languages, Pencil, RefreshCw, Sparkles, Trash2, X } from 'lucide-react';
import { Page, api, fa } from './life-core';
import { jLabel } from './jdate';

// «خبر و خواندنی»: RSS news (sources you add, synced by the Worker; AI summary/translation when a key is set)
// and bookmarks with a read-later list. Backend: /api/news(+sources, sync, :id/summarize, :id/translate), /api/bookmarks.
const host = u => { try { return new URL(u).hostname.replace(/^www\./, ''); } catch { return ''; } };
// Feed/page titles make clumsy names ("مرجع فوتبال و ورزش | ورزش سه", "Al Jazeera &#8211; Breaking News…"):
// decode entities and keep the shortest meaningful part. Display only; the stored name stays the filter key.
const cleanName = n => { const t = String(n || '').replace(/&#(\d+);/g, (_, c) => String.fromCharCode(c)).replace(/&amp;/g, '&').trim(); const parts = t.split(/\s+[|–—-]\s+/).map(x => x.trim()).filter(x => x.length >= 2 && !/^(world news|news|latest news|latest|home|homepage|اخبار)$/i.test(x)); return parts.length ? parts.reduce((a, b) => b.length < a.length ? b : a) : t; };
// Automatic tags from the headline (+summary): first matching topic wins, else the source's own tag.
const TOPICS = [
  ['ورزش', /فوتبال|والیبال|کشتی|ورزش|لیگ|جام جهانی|بازیکن|سرمربی|استقلال|پرسپولیس|سپاهان|المپیک|تیم ملی|گل |football|soccer|nba|tennis|olympic|league|champions|fifa|premier/i],
  ['اقتصاد', /اقتصاد|بورس|دلار|ارز|طلا|سکه|تورم|بانک|نفت|بنزین|قیمت|بازار|یارانه|مالیات|بودجه|کالابرگ|economy|inflation|stocks?|market|oil|bank|dollar|tariff|trade|gdp/i],
  ['فناوری', /فناوری|هوش مصنوعی|اپل|گوگل|سامسونگ|گوشی|موبایل|اینترنت|نرم‌افزار|استارتاپ|ربات|تراشه|فیلترینگ|technology|tech|ai\b|apple|google|microsoft|iphone|android|software|chip|startup|openai|nvidia/i],
  ['سیاست', /مجلس|دولت|وزیر|رئیس‌جمهور|انتخابات|سیاست|پارلمان|نماینده|دیپلمات|مذاکره|تحریم|سفیر|president|election|minister|parliament|senate|congress|sanction|diplomat|government|white house/i],
  ['جهان', /آمریکا|اروپا|روسیه|اوکراین|چین|اسرائیل|غزه|لبنان|سوریه|عراق|افغانستان|ترکیه|سازمان ملل|ناتو|ukraine|russia|china|israel|gaza|europe|nato|united nations/i],
  ['سلامت', /سلامت|بیمار|پزشک|درمان|دارو|بیمارستان|کرونا|ویروس|واکسن|سرطان|تغذیه|health|hospital|virus|vaccine|cancer|disease|medical/i],
  ['علم', /علم|دانشمند|پژوهش|فضا|ناسا|ستاره|سیاره|اقلیم|زمین‌لرزه|science|research|space|nasa|planet|climate|scientists?/i],
  ['فرهنگ', /سینما|فیلم|سریال|کتاب|موسیقی|هنر|جشنواره|بازیگر|خواننده|تئاتر|movie|film|music|book|art|festival|actor/i],
  ['حوادث', /حادثه|تصادف|آتش‌سوزی|سیل|زلزله|قتل|دستگیر|انفجار|کشته|زخمی|accident|fire|flood|earthquake|killed|crash|shooting/i],
];
const autoTag = x => { const t = `${x.title || ''} ${x.summary || ''}`; for (const [tag, re] of TOPICS) if (re.test(t)) return tag; return x.category || 'عمومی'; };
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
        <div><small>دسته‌ها</small>{top(d.stats.byCategory).map(([k, n]) => <p key={k}>{cleanName(k)} <em>{fa(n)}</em></p>)}</div>
        <div><small>منابع</small>{top(d.stats.bySource).map(([k, n]) => <p key={k}>{cleanName(k)} <em>{fa(n)}</em></p>)}</div>
      </div> : <p className="rd-muted">این هفته خبری نیامده.</p>}
      {(d.savedItems || []).length ? <><small className="rd-wsub">ذخیره‌های این هفته</small><ul className="rd-wsaved">{d.savedItems.slice(0, 8).map(x => <li key={x.id}>{safeUrl(x.url) ? <a href={safeUrl(x.url)} target="_blank" rel="noopener noreferrer">{x.title}</a> : x.title}</li>)}</ul></> : null}
    </>}
  </div>;
}

// In-app reader: the article's own text (fetched and cleaned by the Worker), large type, RTL/LTR by content.
function Reader({ x, onClose, onSave }) {
  const [d, setD] = useState(null), [err, setErr] = useState('');
  useEffect(() => { setD(null); setErr(''); api(`/api/news/${x.id}/read`).then(setD).catch(e => setErr(e.message)); }, [x.id]);
  useEffect(() => { const k = e => { if (e.key === 'Escape') onClose(); }; window.addEventListener('keydown', k); document.body.classList.add('nav-lock'); return () => { window.removeEventListener('keydown', k); document.body.classList.remove('nav-lock'); }; }, []);
  const lat = /[a-z]{4,}/i.test(x.title) && !/[\u0600-\u06FF]/.test(x.title);
  return <div className="rd-reader-bg" onMouseDown={onClose}>
    <article className="rd-reader" dir={lat ? 'ltr' : 'rtl'} role="dialog" aria-label={x.title} onMouseDown={e => e.stopPropagation()}>
      <header className="rd-rhead" dir="rtl">
        <small>{[cleanName(x.source), x.tag, jLabel(x.date)].filter(Boolean).join(' · ')}</small>
        <span className="rd-rops">
          <button type="button" className={`rd-ic${x.saved ? ' on' : ''}`} onClick={onSave} aria-pressed={!!x.saved} aria-label="ذخیره">{x.saved ? <BookmarkCheck size={17} /> : <Bookmark size={17} />}</button>
          {safeUrl(x.url) ? <a className="rd-ic" href={safeUrl(x.url)} target="_blank" rel="noopener noreferrer" aria-label="باز کردن در سایت اصلی" title="سایت اصلی"><ExternalLink size={17} /></a> : null}
          <button type="button" className="rd-ic" onClick={onClose} aria-label="بستن"><X size={18} /></button>
        </span>
      </header>
      <h1>{x.title}</h1>
      {d?.image ? <img className="rd-rimg" src={d.image} alt="" loading="lazy" referrerPolicy="no-referrer" onError={e => { e.currentTarget.style.display = 'none'; }} /> : null}
      {x.aiSummary ? <p className="rd-ai" dir="rtl">✨ {x.aiSummary}</p> : null}
      {d ? d.paras.map((t, i) => t.startsWith('## ') ? <h2 key={i}>{t.slice(3)}</h2> : <p key={i}>{t}</p>)
        : err ? <>{x.summary ? <p>{x.summary}</p> : null}<div className="rd-rerr" dir="rtl">⚠ {err}{safeUrl(x.url) ? <> — <a href={safeUrl(x.url)} target="_blank" rel="noopener noreferrer">خواندن در سایت اصلی</a></> : null}</div></>
        : <><p className="rd-skel" /><p className="rd-skel" /><p className="rd-skel short" /></>}
    </article>
  </div>;
}

function News() {
  const [items, setItems] = useState(null), [sources, setSources] = useState([]), [cat, setCat] = useState(''), [savedOnly, setSavedOnly] = useState(false);
  const [busy, setBusy] = useState(''), [msg, setMsg] = useState(''), [showSrc, setShowSrc] = useState(false), [src, setSrc] = useState({ url: '', category: '' }), [week, setWeek] = useState(false);
  const [reading, setReading] = useState(null), [srcF, setSrcF] = useState(''), [open, setOpen] = useState(null), [limit, setLimit] = useState(25), [edit, setEdit] = useState(null);
  const load = () => Promise.all([api('/api/news').then(d => setItems(d.items || [])), api('/api/news/sources').then(d => setSources(d.items || []))]).catch(e => setMsg(e.message));
  useEffect(() => { load(); }, []);
  const tagged = useMemo(() => (items || []).map(x => ({ ...x, tag: autoTag(x) })), [items]);
  const cats = useMemo(() => { const n = {}; for (const x of tagged) n[x.tag] = (n[x.tag] || 0) + 1; return Object.keys(n).sort((a, b) => n[b] - n[a]); }, [tagged]);
  const list = tagged.filter(x => (!cat || x.tag === cat) && (!savedOnly || x.saved) && (!srcF || x.source === srcF));
  useEffect(() => { setLimit(25); setOpen(null); }, [cat, savedOnly, srcF]);
  const saveSrc = async e => {
    e.preventDefault();
    try { const r = await api(`/api/news/sources/${edit.id}`, { method: 'PATCH', body: JSON.stringify({ name: edit.name, category: edit.category }) }); setMsg(`«${cleanName(r.name)}» ذخیره شد${r.moved ? ` (${fa(r.moved)} خبر به‌روز شد)` : ''}.`); if (srcF && srcF !== r.name) setSrcF(r.name); setEdit(null); await load(); }
    catch (x) { setMsg(x.message); }
  };
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
      {sources.length ? <ul className="rd-srclist">{sources.map(s => edit?.id === s.id ? <li key={s.id}><form className="rd-srcedit" onSubmit={saveSrc}>
        <input value={edit.name} onChange={e => setEdit(o => ({ ...o, name: e.target.value }))} aria-label="نام منبع" maxLength={60} />
        <input value={edit.category} onChange={e => setEdit(o => ({ ...o, category: e.target.value }))} aria-label="تگ / دسته" placeholder="تگ" maxLength={30} list="rd-cats" />
        <button type="submit" className="rd-btn sm">ذخیره</button><button type="button" className="rd-btn ghost sm" onClick={() => setEdit(null)}>انصراف</button>
      </form></li> : <li key={s.id}><span><b title={s.name}>{cleanName(s.name)}</b><small><em className="rd-tag">{s.category || 'عمومی'}</em> <i className="rd-host" dir="ltr">{host(s.url)}</i></small>{s.lastError ? <small className="bad">⚠ {s.lastError}</small> : null}</span><button type="button" className="rd-x" onClick={() => setEdit({ id: s.id, name: cleanName(s.name), category: s.category || '' })} aria-label={`ویرایش ${cleanName(s.name)}`}><Pencil size={15} /></button><button type="button" className="rd-x" onClick={() => delSrc(s)} aria-label={`حذف منبع ${s.name}`}><Trash2 size={15} /></button></li>)}</ul> : <p className="rd-muted">هنوز منبعی نداری. از پیشنهادها انتخاب کن یا آدرس یک سایت خبری را بنویس.</p>}
      <datalist id="rd-cats">{cats.map(c => <option key={c} value={c} />)}</datalist>
    </div> : null}
    <div className="rd-filters" role="group" aria-label="فیلتر اخبار">
      <button type="button" className={!cat && !savedOnly ? 'on' : ''} onClick={() => { setCat(''); setSavedOnly(false); }}>همه</button>
      <button type="button" className={savedOnly ? 'on' : ''} onClick={() => setSavedOnly(v => !v)}>ذخیره‌شده</button>
      {cats.map(c => <button type="button" key={c} className={cat === c ? 'on' : ''} onClick={() => setCat(cat === c ? '' : c)}>{c}</button>)}
      {sources.length > 1 ? <select className="rd-srcsel" value={srcF} onChange={e => setSrcF(e.target.value)} aria-label="فیلتر منبع"><option value="">همهٔ منابع</option>{sources.map(s => <option key={s.id} value={s.name}>{cleanName(s.name)}</option>)}</select> : null}
    </div>
    {msg ? <p className="rd-msg" role="status">{msg}</p> : null}
    {items === null ? <p className="rd-muted">در حال بارگذاری…</p> : !list.length ? <p className="rd-muted">{items.length ? 'با این فیلتر خبری نیست.' : sources.length ? 'خبری نیست؛ «به‌روزرسانی» را بزن.' : 'برای دیدن اخبار، بالا یک منبع انتخاب کن.'}</p>
      : <><ul className="rd-news rd-compact">{list.slice(0, limit).map(x => { const on = open === x.id; return <li key={x.id} className={on ? 'open' : ''}>
        <div className="rd-row">
          <button type="button" className="rd-t" dir="auto" onClick={() => setReading(x)}>{x.title}</button>
          <small className="rd-sname">{cleanName(x.source)}</small>
          <button type="button" className={`rd-ic${x.saved ? ' on' : ''}`} onClick={() => patch(x, { saved: !x.saved })} aria-pressed={!!x.saved} aria-label={x.saved ? 'برداشتن از ذخیره‌شده‌ها' : 'ذخیره'}>{x.saved ? <BookmarkCheck size={15} /> : <Bookmark size={15} />}</button>
          <button type="button" className="rd-ic" onClick={() => setOpen(on ? null : x.id)} aria-expanded={on} aria-label={on ? 'بستن جزئیات' : 'جزئیات'}>{on ? <ChevronUp size={16} /> : <ChevronDown size={16} />}</button>
        </div>
        {on ? <div className="rd-more">
          <small className="rd-meta">{[cleanName(x.source), x.tag, jLabel(x.date)].filter(Boolean).join(' · ')}</small>
          {x.summary ? <p className="rd-sum" dir="auto">{x.summary.length > 400 ? x.summary.slice(0, 400) + '…' : x.summary}</p> : null}
          {x.aiSummary ? <p className="rd-ai">✨ {x.aiSummary}</p> : null}
          <div className="rd-actions">
            {x.summary && x.summary.length >= 300 ? <button type="button" onClick={() => ai(x, 'summarize')} disabled={busy === 'summarize' + x.id}><Sparkles size={15} />خلاصه</button> : null}
            {/[a-z]{4,}/i.test(x.title) ? <button type="button" onClick={() => ai(x, 'translate')} disabled={busy === 'translate' + x.id}><Languages size={15} />ترجمه</button> : null}
            {safeUrl(x.url) ? <a className="rd-open" href={safeUrl(x.url)} target="_blank" rel="noopener noreferrer"><ExternalLink size={14} />خبر کامل</a> : null}
            <button type="button" className="rd-del" onClick={() => del(x)} aria-label="حذف خبر"><Trash2 size={15} /></button>
          </div>
        </div> : null}
      </li>; })}</ul>
      {list.length > limit ? <button type="button" className="rd-btn ghost rd-moreall" onClick={() => setLimit(l => l + 25)}>نمایش بیشتر ({fa(list.length - limit)} خبر دیگر)</button> : null}</>}
    {reading ? <Reader x={reading} onClose={() => setReading(null)} onSave={() => { patch(reading, { saved: !reading.saved }); setReading(r => ({ ...r, saved: !r.saved })); }} /> : null}
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
  return <Page Nav={Nav} className="rd" kicker="خبر و خواندنی" title="اخبار" sub="تیتر منابع دلخواهت؛ روی هر تیتر بزن تا متن کاملش همین‌جا باز شود">
    <div className="rd-solo"><News /></div>
  </Page>;
}

export function BookmarksPage({ Nav }) {
  return <Page Nav={Nav} className="rd" kicker="یادداشت‌ها" title="لینک‌ها" sub="لینک‌هایی که می‌خواهی بعداً بخوانی">
    <div className="rd-solo"><Bookmarks /></div>
  </Page>;
}
