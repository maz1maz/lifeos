import { useEffect, useMemo, useState } from 'react';
import { Bookmark, BookmarkCheck, ExternalLink, Languages, RefreshCw, Sparkles, Trash2 } from 'lucide-react';
import { Page, api, fa } from './life-core';
import { jLabel } from './jdate';

// «خبر و خواندنی»: RSS news (sources you add, synced by the Worker; AI summary/translation when a key is set)
// and bookmarks with a read-later list. Backend: /api/news(+sources, sync, :id/summarize, :id/translate), /api/bookmarks.
const host = u => { try { return new URL(u).hostname.replace(/^www\./, ''); } catch { return ''; } };
const safeUrl = u => /^https?:\/\//i.test(u || '') ? u : '';

function News() {
  const [items, setItems] = useState(null), [sources, setSources] = useState([]), [cat, setCat] = useState(''), [savedOnly, setSavedOnly] = useState(false);
  const [busy, setBusy] = useState(''), [msg, setMsg] = useState(''), [showSrc, setShowSrc] = useState(false), [src, setSrc] = useState({ name: '', url: '', category: '' });
  const load = () => Promise.all([api('/api/news').then(d => setItems(d.items || [])), api('/api/news/sources').then(d => setSources(d.items || []))]).catch(e => setMsg(e.message));
  useEffect(() => { load(); }, []);
  const cats = useMemo(() => [...new Set((items || []).map(x => x.category).filter(Boolean))], [items]);
  const list = (items || []).filter(x => (!cat || x.category === cat) && (!savedOnly || x.saved));
  const sync = async () => { setBusy('sync'); setMsg(''); try { const r = await api('/api/news/sync', { method: 'POST' }); setMsg(r.added ? `${fa(r.added)} خبر تازه آمد.` : 'خبر تازه‌ای نبود.'); await load(); } catch (e) { setMsg(e.message); } setBusy(''); };
  const patch = async (x, body) => { setItems(xs => xs.map(y => y.id === x.id ? { ...y, ...body } : y)); await api(`/api/news/${x.id}`, { method: 'PATCH', body: JSON.stringify(body) }).catch(() => load()); };
  const del = async x => { setItems(xs => xs.filter(y => y.id !== x.id)); await api(`/api/news/${x.id}`, { method: 'DELETE' }).catch(() => load()); };
  const ai = async (x, kind) => { setBusy(kind + x.id); try { const r = await api(`/api/news/${x.id}/${kind}`, { method: 'POST' }); setItems(xs => xs.map(y => y.id !== x.id ? y : kind === 'summarize' ? { ...y, aiSummary: r.summary } : { ...y, title: r.title || y.title, summary: r.summary || y.summary })); } catch (e) { setMsg(e.message); } setBusy(''); };
  const addSrc = async e => { e.preventDefault(); if (!src.name.trim() || !safeUrl(src.url)) { setMsg('نام و آدرس فید (https://…) لازم است.'); return; } try { await api('/api/news/sources', { method: 'POST', body: JSON.stringify({ ...src, category: src.category || 'عمومی' }) }); setSrc({ name: '', url: '', category: '' }); setMsg('منبع اضافه شد؛ «به‌روزرسانی» را بزن.'); load(); } catch (x) { setMsg(x.message); } };
  const delSrc = async s => { if (!window.confirm(`منبع «${s.name}» حذف شود؟`)) return; await api(`/api/news/sources/${s.id}`, { method: 'DELETE' }).catch(() => {}); load(); };
  return <section className="rd-card">
    <header>
      <h2>📰 اخبار</h2>
      <div className="rd-ops">
        <button type="button" className="rd-btn" onClick={sync} disabled={busy === 'sync' || !sources.length}><RefreshCw size={15} className={busy === 'sync' ? 'spin' : ''} />به‌روزرسانی</button>
        <button type="button" className="rd-btn ghost" onClick={() => setShowSrc(v => !v)} aria-expanded={showSrc}>منابع ({fa(sources.length)})</button>
      </div>
    </header>
    {showSrc ? <div className="rd-src">
      <form className="rd-add" onSubmit={addSrc}>
        <input value={src.name} onChange={e => setSrc(o => ({ ...o, name: e.target.value }))} placeholder="نام منبع" aria-label="نام منبع" />
        <input value={src.url} onChange={e => setSrc(o => ({ ...o, url: e.target.value }))} placeholder="آدرس فید RSS (https://…)" aria-label="آدرس فید" dir="ltr" />
        <input value={src.category} onChange={e => setSrc(o => ({ ...o, category: e.target.value }))} placeholder="دسته (اختیاری)" aria-label="دستهٔ منبع" />
        <button type="submit" className="rd-btn">افزودن</button>
      </form>
      {sources.length ? <ul className="rd-srclist">{sources.map(s => <li key={s.id}><span><b>{s.name}</b><small dir="ltr">{host(s.url)}</small>{s.lastError ? <small className="bad">⚠ {s.lastError}</small> : null}</span><button type="button" className="rd-x" onClick={() => delSrc(s)} aria-label={`حذف منبع ${s.name}`}><Trash2 size={15} /></button></li>)}</ul> : <p className="rd-muted">هنوز منبعی نداری. آدرس RSS یک سایت خبری را اضافه کن.</p>}
    </div> : null}
    <div className="rd-filters" role="group" aria-label="فیلتر اخبار">
      <button type="button" className={!cat && !savedOnly ? 'on' : ''} onClick={() => { setCat(''); setSavedOnly(false); }}>همه</button>
      <button type="button" className={savedOnly ? 'on' : ''} onClick={() => setSavedOnly(v => !v)}>ذخیره‌شده</button>
      {cats.map(c => <button type="button" key={c} className={cat === c ? 'on' : ''} onClick={() => setCat(cat === c ? '' : c)}>{c}</button>)}
    </div>
    {msg ? <p className="rd-msg" role="status">{msg}</p> : null}
    {items === null ? <p className="rd-muted">در حال بارگذاری…</p> : !list.length ? <p className="rd-muted">{items.length ? 'با این فیلتر خبری نیست.' : sources.length ? 'خبری نیست؛ «به‌روزرسانی» را بزن.' : 'برای دیدن اخبار، اول یک منبع RSS اضافه کن.'}</p>
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
