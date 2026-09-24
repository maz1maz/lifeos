import { useCallback, useEffect, useMemo, useState } from 'react'
import './media.css'

const MEDIA_KIND_LABELS = { all: 'همه', spotify: 'اسپاتیفای', youtube: 'یوتیوب' }

function fmtWhen(iso) {
  if (!iso) return ''
  try { return new Date(iso).toLocaleString('fa-IR') } catch { return iso }
}

function normMediaItem(raw, source) {
  if (!raw || typeof raw !== 'object') return null
  const title = raw.title || raw.name || raw.track || ''
  if (!title) return null
  return {
    id: String(raw.id || raw.videoId || raw.uri || title),
    title,
    artist: raw.artist || raw.artists || raw.channel || raw.channelTitle || '',
    cover: raw.cover || raw.image || raw.thumb || raw.thumbnail || raw.albumArt || '',
    url: raw.url || raw.externalUrl || raw.link || raw.uri || '',
    playedAt: raw.playedAt || raw.watchedAt || raw.publishedAt || '',
    source: raw.source || source,
  }
}

function parseMeta(meta) {
  if (!meta) return {}
  if (typeof meta === 'object') return meta
  try { return JSON.parse(meta) } catch { return {} }
}

function MediaCard({ item, onCue, onSave, saving }) {
  if (!item) return null
  return (
    <article className={`md-row${item._on ? ' on' : ''}`}>
      {item.cover
        ? <img className="md-art" src={item.cover} alt="" />
        : <div className="md-art">♪</div>}
      <div>
        <h3>{item.title}</h3>
        <p>{[item.artist, item.playedAt && fmtWhen(item.playedAt)].filter(Boolean).join(' · ')}</p>
      </div>
      <div className="md-row-ops">
        {item.url ? <a className="md-link" href={item.url} target="_blank" rel="noreferrer">باز کردن</a> : null}
        {onCue ? <button type="button" className="md-btn" onClick={() => onCue(item)}>صف پخش</button> : null}
        {onSave ? <button type="button" className="md-btn md-signal" disabled={saving} onClick={() => onSave(item)}>ثبت در زندگی</button> : null}
      </div>
    </article>
  )
}

export function MediaReact({ Nav, initialTab }) {
  const startTab = initialTab === 'youtube' || initialTab === 'spotify' ? initialTab : 'desk'
  const [unit, setUnit] = useState(startTab)
  const [q, setQ] = useState('')
  const [busy, setBusy] = useState('')
  const [notice, setNotice] = useState('')
  const [integ, setInteg] = useState(null)
  const [spotify, setSpotify] = useState({ nowPlaying: null, items: [], artists: [], playlists: [] })
  const [youtube, setYoutube] = useState({ items: [], playlists: [] })
  const [hits, setHits] = useState([])
  const [life, setLife] = useState([])
  const [lifeKind, setLifeKind] = useState('all')
  const lifeShown = useMemo(() => lifeKind === 'all' ? life : life.filter((x) => x.source === lifeKind), [life, lifeKind])
  const [cue, setCue] = useState(null)
  const [log, setLog] = useState([])
  const [saving, setSaving] = useState(false)

  const note = (t) => setLog((xs) => [`${new Date().toLocaleTimeString('fa-IR')}  ${t}`, ...xs].slice(0, 8))

  const loadInteg = useCallback(async () => {
    try {
      const r = await fetch('/api/integrations', { credentials: 'include' })
      const j = await r.json().catch(() => ({}))
      setInteg(j)
    } catch { setInteg(null) }
  }, [])

  const loadSpotify = useCallback(async () => {
    try {
      const r = await fetch('/api/integrations/spotify/recent', { credentials: 'include' })
      const j = await r.json().catch(() => ({}))
      setSpotify({
        nowPlaying: j.nowPlaying ? normMediaItem(j.nowPlaying, 'spotify') : null,
        items: (j.items || []).map((x) => normMediaItem(x, 'spotify')).filter(Boolean),
        artists: j.artists || [],
        playlists: j.playlists || [],
      })
    } catch { /* keep previous */ }
  }, [])

  const loadYoutube = useCallback(async () => {
    try {
      const [h, p] = await Promise.all([
        fetch('/api/integrations/youtube/history', { credentials: 'include' }),
        fetch('/api/integrations/youtube/playlists', { credentials: 'include' }),
      ])
      const hj = await h.json().catch(() => ({}))
      const pj = await p.json().catch(() => ({}))
      setYoutube({
        items: (hj.items || hj.videos || []).map((x) => normMediaItem(x, 'youtube')).filter(Boolean),
        playlists: pj.items || pj.playlists || [],
      })
    } catch { /* keep previous */ }
  }, [])

  const loadLife = useCallback(async () => {
    try {
      const r = await fetch('/api/media-log', { credentials: 'include' })
      const j = await r.json().catch(() => ({}))
      setLife(j.items || [])
    } catch { setLife([]) }
  }, [])

  useEffect(() => { loadInteg() }, [loadInteg])
  useEffect(() => { loadSpotify() }, [loadSpotify])
  useEffect(() => { loadYoutube() }, [loadYoutube])
  useEffect(() => { loadLife() }, [loadLife])
  useEffect(() => {
    if (spotify.nowPlaying) setCue((c) => c || spotify.nowPlaying)
  }, [spotify.nowPlaying])

  const spOn = !!(integ?.spotify?.connected)
  const ytOn = !!(integ?.youtube?.connected)

  function connect(kind) {
    window.location.href = `/api/integrations/${kind}/connect`
  }

  async function disconnect(kind) {
    setBusy(kind)
    try {
      await fetch(`/api/integrations/${kind}/disconnect`, { method: 'POST', credentials: 'include' })
      await loadInteg()
      note(`${kind} قطع شد`)
    } finally { setBusy('') }
  }

  async function search(e) {
    e?.preventDefault?.()
    const query = q.trim()
    if (!query) return
    setBusy('search')
    setNotice('')
    try {
      const src = unit === 'youtube' ? 'youtube' : 'spotify'
      const r = await fetch(`/api/integrations/${src}/search?q=${encodeURIComponent(query)}`, { credentials: 'include' })
      const j = await r.json().catch(() => ({}))
      const list = (j.items || []).map((x) => normMediaItem(x, src)).filter(Boolean)
      setHits(list)
      note(`جستجو: ${query} — ${list.length} نتیجه`)
      if (!list.length) setNotice(j.error || 'نتیجه‌ای پیدا نشد')
    } finally { setBusy('') }
  }

  async function saveItem(item) {
    if (!item) return
    setSaving(true)
    setNotice('')
    try {
      const r = await fetch('/api/media-log', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          source: item.source || (unit === 'youtube' ? 'youtube' : 'spotify'),
          title: item.title,
          meta: JSON.stringify({ url: item.url || '', artist: item.artist || '', cover: item.cover || '' }),
        }),
      })
      const j = await r.json().catch(() => ({}))
      if (!r.ok) { setNotice(j.error || 'ثبت نشد'); return }
      note(`ثبت شد: ${item.title}`)
      await loadLife()
    } finally { setSaving(false) }
  }

  async function dropLife(id) {
    await fetch(`/api/media-log/${id}`, { method: 'DELETE', credentials: 'include' })
    await loadLife()
  }

  const stats = useMemo(() => {
    const now = Date.now()
    const day = 86400000
    const last30 = life.filter((x) => x.createdAt && now - new Date(x.createdAt).getTime() < 30 * day)
    const hours = Array(24).fill(0)
    for (const x of last30) {
      const h = new Date(x.createdAt).getHours()
      if (h >= 0 && h < 24) hours[h] += 1
    }
    const maxH = Math.max(1, ...hours)
    const titles = {}
    for (const x of last30) titles[x.title] = (titles[x.title] || 0) + 1
    const top = Object.entries(titles).sort((a, b) => b[1] - a[1]).slice(0, 6)
    return {
      n30: last30.length,
      nSp: last30.filter((x) => x.source === 'spotify').length,
      nYt: last30.filter((x) => x.source === 'youtube').length,
      nAll: life.length,
      hours,
      maxH,
      top,
    }
  }, [life])

  const feed = unit === 'youtube' ? youtube.items : spotify.items
  const playlists = unit === 'youtube' ? youtube.playlists : spotify.playlists
  const shelf = (hits.length ? hits : feed).slice(0, 8)

  return (
    <div className="md" dir="rtl">
      {Nav && <Nav active="media" />}
      <div className="md-page">
        <header className="md-hero">
          <div>
            <div className="md-label">میز رسانه · اسپاتیفای / یوتیوب</div>
            <h1>پخش، جستجو، ثبت در زندگی</h1>
            <p>اتصال واقعی حساب‌ها، جستجو و تاریخچه، و ثبت در دفتر LifeOS. کاتالوگ نمایشی نیست.</p>
          </div>
          <div className="md-units">
            {[
              { id: 'desk', title: 'میز', sub: 'نمای کلی' },
              { id: 'spotify', title: 'اسپاتیفای', sub: spOn ? 'متصل' : (integ?.spotify?.configured ? 'آمادهٔ اتصال' : 'پیکربندی نشده') },
              { id: 'youtube', title: 'یوتیوب', sub: ytOn ? 'متصل' : (integ?.youtube?.configured ? 'آمادهٔ اتصال' : 'پیکربندی نشده') },
              { id: 'life', title: 'تاریخچهٔ زندگی', sub: `${life.length} ثبت` },
            ].map((u) => (
              <button key={u.id} type="button" className={`md-unit${unit === u.id ? ' on' : ''}`} onClick={() => setUnit(u.id)}>
                <div className="md-label">
                  واحد <span className={`md-led${(u.id === 'spotify' && spOn) || (u.id === 'youtube' && ytOn) || u.id === 'desk' || u.id === 'life' ? ' on' : ''}`} />
                </div>
                <b>{u.title}</b>
                <small>{u.sub}</small>
              </button>
            ))}
          </div>
        </header>

        {notice ? <div className="notice">{notice} <button type="button" onClick={() => setNotice('')}>بستن</button></div> : null}

        {unit !== 'life' ? (
          <form className="md-search" onSubmit={search}>
            <span className="md-label">جستجو</span>
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={unit === 'youtube' ? 'ویدیو یا کانال…' : 'آهنگ، آلبوم، هنرمند…'} />
            <button type="submit" className="md-btn md-signal" disabled={busy === 'search'}>{busy === 'search' ? '…' : 'جستجو'}</button>
            <span className={`md-chip${unit === 'spotify' || unit === 'desk' ? ' on' : ''}`}>اسپاتیفای</span>
            <span className={`md-chip${unit === 'youtube' ? ' on' : ''}`}>یوتیوب</span>
          </form>
        ) : null}

        {unit === 'spotify' || unit === 'desk' ? (
          <div className={`md-strip${spOn ? ' ok' : ' bad'}`}>
            <span className={`md-led${spOn ? ' on' : ''}`} />
            <strong>{spOn ? 'اسپاتیفای متصل است' : (integ?.spotify?.configured ? 'اسپاتیفای متصل نیست' : 'کلید اسپاتیفای روی سرور تنظیم نشده')}</strong>
            <span style={{ flex: 1 }} />
            {spOn
              ? <button type="button" className="md-btn" disabled={!!busy} onClick={() => disconnect('spotify')}>قطع</button>
              : <button type="button" className="md-btn md-signal" disabled={!!busy || !integ?.spotify?.configured} onClick={() => connect('spotify')}>اتصال</button>}
            <button type="button" className="md-btn" onClick={() => { loadSpotify(); loadInteg(); note('اسپاتیفای تازه شد') }}>تازه‌سازی</button>
          </div>
        ) : null}

        {unit === 'youtube' || unit === 'desk' ? (
          <div className={`md-strip${ytOn ? ' ok' : ' bad'}`}>
            <span className={`md-led${ytOn ? ' on' : ''}`} />
            <strong>{ytOn ? 'یوتیوب متصل است' : (integ?.youtube?.configured ? 'یوتیوب متصل نیست' : 'کلید یوتیوب روی سرور تنظیم نشده')}</strong>
            <span style={{ flex: 1 }} />
            {ytOn
              ? <button type="button" className="md-btn" disabled={!!busy} onClick={() => disconnect('youtube')}>قطع</button>
              : <button type="button" className="md-btn md-signal" disabled={!!busy || !integ?.youtube?.configured} onClick={() => connect('youtube')}>اتصال</button>}
            <button type="button" className="md-btn" onClick={() => { loadYoutube(); loadInteg(); note('یوتیوب تازه شد') }}>تازه‌سازی</button>
          </div>
        ) : null}

        {unit === 'life' ? (
          <section className="md-panel" style={{ marginTop: 14 }}>
            <header>
              <div>
                <div className="md-label">دفتر رسانه</div>
                <h2>تاریخچهٔ زندگی</h2>
              </div>
              <div>
                {Object.entries(MEDIA_KIND_LABELS).map(([k, lab]) => (
                  <button key={k} type="button" className={`md-btn${lifeKind === k ? ' md-signal' : ''}`} onClick={() => setLifeKind(k)}>{lab}</button>
                ))}
              </div>
            </header>
            {!lifeShown.length ? <div className="md-empty">هنوز چیزی در دفتر رسانه ثبت نشده.</div> : lifeShown.map((row) => {
              const meta = parseMeta(row.meta)
              return (
                <article key={row.id} className="md-row">
                  {meta.cover ? <img className="md-art" src={meta.cover} alt="" /> : <div className="md-art">♪</div>}
                  <div>
                    <h3>{row.title}</h3>
                    <p>{[MEDIA_KIND_LABELS[row.source] || row.source, meta.artist, fmtWhen(row.createdAt)].filter(Boolean).join(' · ')}</p>
                  </div>
                  <div className="md-row-ops">
                    {meta.url ? <a className="md-link" href={meta.url} target="_blank" rel="noreferrer">باز کردن</a> : null}
                    <button type="button" className="md-btn" onClick={() => dropLife(row.id)}>حذف</button>
                  </div>
                </article>
              )
            })}
          </section>
        ) : (
          <div className="md-grid">
            <section className="md-panel">
              <header>
                <div>
                  <div className="md-label">{unit === 'youtube' ? 'یوتیوب' : 'اسپاتیفای'}</div>
                  <h2>{hits.length ? 'نتایج جستجو' : (unit === 'youtube' ? 'تاریخچهٔ تماشا' : 'اخیراً پخش‌شده')}</h2>
                </div>
                <small>{(hits.length ? hits : feed).length} مورد</small>
              </header>
              {unit !== 'youtube' && spotify.nowPlaying ? (
                <div className="md-now">
                  <div className="cover" style={spotify.nowPlaying.cover ? { backgroundImage: `url(${spotify.nowPlaying.cover})` } : undefined} />
                  <div>
                    <div className="md-label">در حال پخش</div>
                    <b>{spotify.nowPlaying.title}</b>
                    <p style={{ margin: '4px 0 0', color: 'var(--mute)' }}>{spotify.nowPlaying.artist}</p>
                  </div>
                  <span style={{ flex: 1 }} />
                  <button type="button" className="md-btn" onClick={() => setCue(spotify.nowPlaying)}>صف پخش</button>
                  <button type="button" className="md-btn md-signal" disabled={saving} onClick={() => saveItem(spotify.nowPlaying)}>ثبت</button>
                </div>
              ) : null}
              {!(hits.length ? hits : feed).length ? (
                <div className="md-empty">{unit === 'youtube' ? (ytOn ? 'تاریخچه‌ای نیامد.' : 'یوتیوب را وصل کنید.') : (spOn ? 'اخیراً چیزی پخش نشده.' : 'اسپاتیفای را وصل کنید یا جستجو کنید.')}</div>
              ) : (hits.length ? hits : feed).map((it) => (
                <MediaCard key={it.id + it.title} item={it} onCue={setCue} onSave={saveItem} saving={saving} />
              ))}
            </section>

            <div>
              {unit !== 'youtube' && spotify.artists.length ? (
                <section className="md-panel" style={{ marginBottom: 14 }}>
                  <header><div><div className="md-label">هنرمندان</div><h2>بالاترین‌ها</h2></div></header>
                  <div className="md-artists">
                    {spotify.artists.map((a) => (
                      <a key={a.id || a.name} className="md-artist" href={a.url || '#'} target="_blank" rel="noreferrer">
                        <span style={a.image || a.cover ? { backgroundImage: `url(${a.image || a.cover})` } : undefined} />
                        <small>{a.name}</small>
                      </a>
                    ))}
                  </div>
                </section>
              ) : null}

              <section className="md-panel">
                <header>
                  <div>
                    <div className="md-label">قفسه</div>
                    <h2>لیست‌های پخش</h2>
                  </div>
                  <small>{playlists.length}</small>
                </header>
                {!playlists.length ? <div className="md-empty">لیستی از حساب متصل نیامد.</div> : (
                  <div className="md-pls">
                    {playlists.map((pl) => (
                      <button key={pl.id || pl.title || pl.name} type="button" className="md-pl" onClick={() => {
                        const item = normMediaItem({ ...pl, title: pl.title || pl.name }, unit === 'youtube' ? 'youtube' : 'spotify')
                        if (item) setCue(item)
                      }}>
                        <div className="md-label">{pl.owner || pl.channel || ''}</div>
                        <b>{pl.title || pl.name}</b>
                        <small>{pl.count || pl.tracks || pl.itemCount || ''} مورد</small>
                      </button>
                    ))}
                  </div>
                )}
              </section>
            </div>
          </div>
        )}

        {unit !== 'life' ? (
          <section className="md-panel" style={{ marginTop: 14 }}>
            <header>
              <div>
                <div className="md-label">سی روز گذشته · از دفتر واقعی</div>
                <h2>آمار ثبت‌شده</h2>
              </div>
            </header>
            <div className="md-stats">
              <div className="md-stat"><small>۳۰ روز</small><b>{stats.n30}</b></div>
              <div className="md-stat"><small>اسپاتیفای</small><b>{stats.nSp}</b></div>
              <div className="md-stat"><small>یوتیوب</small><b>{stats.nYt}</b></div>
              <div className="md-stat"><small>کل دفتر</small><b>{stats.nAll}</b></div>
            </div>
            <div className="md-hours" title="ساعت ثبت">
              {stats.hours.map((n, i) => <i key={i} style={{ height: `${Math.max(4, (n / stats.maxH) * 100)}%` }} title={`${i}:00 — ${n}`} />)}
            </div>
            {stats.top.length ? (
              <div style={{ padding: '0 16px 16px' }}>
                <div className="md-label">پیشنهاد از تاریخچهٔ خودتان</div>
                <div className="md-pls">
                  {stats.top.map(([title, n]) => (
                    <button key={title} type="button" className="md-pl" onClick={() => { setQ(title); setCue({ title, source: 'spotify', artist: '', url: '', cover: '' }) }}>
                      <b>{title}</b>
                      <small>{n} بار در دفتر</small>
                    </button>
                  ))}
                </div>
              </div>
            ) : <div className="md-empty">با ثبت پخش‌ها، پیشنهاد و آمار اینجا پر می‌شود.</div>}
          </section>
        ) : null}

        {unit !== 'life' && shelf.length ? (
          <section className="md-panel" style={{ marginTop: 14 }}>
            <header><div><div className="md-label">قفسهٔ سریع</div><h2>انتخاب برای پخش</h2></div></header>
            {shelf.map((it) => <MediaCard key={'sh' + it.id} item={it} onCue={setCue} onSave={saveItem} saving={saving} />)}
          </section>
        ) : null}

        <footer className="md-foot">
          <ul className="md-log">{log.map((l, i) => <li key={i}>{l}</li>)}</ul>
          <div className="md-label">LifeOS · media desk</div>
        </footer>
      </div>

      <div className="md-transport">
        {cue?.cover ? <img src={cue.cover} alt="" /> : <div className="ph">♪</div>}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="md-label">نوار حمل</div>
          <b>{cue?.title || 'چیزی در صف نیست'}</b>
          <small>{cue?.artist || 'یک مورد را صف پخش کنید'}</small>
          <div className="md-bar"><i style={{ width: cue ? '18%' : '0%' }} /></div>
        </div>
        {cue?.url ? <a className="md-link" href={cue.url} target="_blank" rel="noreferrer">پخش</a> : null}
        {cue ? <button type="button" className="md-btn md-signal" disabled={saving} onClick={() => saveItem(cue)}>ثبت پخش</button> : null}
      </div>
    </div>
  )
}
