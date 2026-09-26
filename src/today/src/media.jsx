import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import './media.css'

const MEDIA_KIND_LABELS = { all: 'همه', spotify: 'اسپاتیفای', youtube: 'یوتیوب' }

function fa(n) {
  try { return Number(n || 0).toLocaleString('fa-IR') } catch { return String(n) }
}

function fmtWhen(iso) {
  if (!iso && iso !== 0) return ''
  try { return new Date(iso).toLocaleString('fa-IR') } catch { return String(iso) }
}

function clock(ms) {
  const s = Math.max(0, Math.floor((ms || 0) / 1000))
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}

function asArtist(raw) {
  if (!raw) return ''
  if (typeof raw === 'string') return raw
  if (Array.isArray(raw)) return raw.map((a) => (typeof a === 'string' ? a : a?.name || '')).filter(Boolean).join('، ')
  return raw.name || ''
}

function youtubeVideoId(item) {
  if (!item) return ''
  const u = String(item.url || '')
  const id = String(item.id || '')
  const m = u.match(/[?&]v=([A-Za-z0-9_-]{11})/) || u.match(/youtu\.be\/([A-Za-z0-9_-]{11})/) || u.match(/embed\/([A-Za-z0-9_-]{11})/)
  if (m) return m[1]
  if (/^[A-Za-z0-9_-]{11}$/.test(id)) return id
  return ''
}

function spotifyTrackId(item) {
  if (!item) return ''
  const u = String(item.url || item.uri || '')
  const id = String(item.id || '')
  const m = u.match(/track[/:]([A-Za-z0-9]{22})/)
  if (m) return m[1]
  if (/^[A-Za-z0-9]{22}$/.test(id)) return id
  return ''
}

function spotifyPlaylistId(pl) {
  if (!pl) return ''
  const u = String(pl.url || pl.uri || '')
  const id = String(pl.id || '')
  const m = u.match(/playlist[/:]([A-Za-z0-9]{22})/)
  if (m) return m[1]
  if (/^[A-Za-z0-9]{22}$/.test(id)) return id
  return ''
}

function normMediaItem(raw, source) {
  if (!raw || typeof raw !== 'object') return null
  const title = raw.title || raw.name || raw.track || ''
  if (!title) return null
  const item = {
    id: String(raw.id || raw.videoId || raw.uri || title),
    title,
    artist: asArtist(raw.artist || raw.artists || raw.channel || raw.channelTitle),
    cover: raw.cover || raw.image || raw.thumb || raw.thumbnail || raw.albumArt || '',
    url: raw.url || raw.externalUrl || raw.link || '',
    uri: raw.uri || '',
    playedAt: raw.playedAt || raw.watchedAt || raw.publishedAt || '',
    durationMs: Number(raw.durationMs || raw.duration || 0) || 0,
    progressMs: Number(raw.progressMs || 0) || 0,
    source: raw.source || source,
  }
  return item
}

function parseMeta(meta) {
  if (!meta) return {}
  if (typeof meta === 'object') return meta
  try { return JSON.parse(meta) } catch { return {} }
}

function Reel({ spin, reverse, size = 54 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 60 60" aria-hidden="true" className={`md-reel${spin ? (reverse ? ' spin-rev' : ' spin') : ''}`}>
      <circle cx="30" cy="30" r="28" fill="#0A1A25" stroke="#37596D" strokeWidth="1.2" />
      <circle cx="30" cy="30" r="23" fill="none" stroke="#2A4A5C" strokeWidth="1" />
      <g fill="#173243" stroke="#4B728A" strokeWidth="0.8">
        <path d="M30 10c3.4 0 6.5 1.6 8.4 4.2L30 26l-8.4-11.8A10.5 10.5 0 0 1 30 10Z" />
        <path d="M47.3 40a10.5 10.5 0 0 1-11.6 4.9L38 31.6l11-2.9A10.5 10.5 0 0 1 47.3 40Z" />
        <path d="M12.7 40a10.5 10.5 0 0 0 1.7 12.1A10.5 10.5 0 0 0 26 44.9l-2.3-13.3-11 2.9Z" />
      </g>
      <circle cx="30" cy="30" r="7" fill="#0A1A25" stroke="#E8A33D" strokeWidth="1" />
      <circle cx="30" cy="30" r="2.4" fill="#E8A33D" opacity="0.85" />
    </svg>
  )
}

function VuMeter({ active }) {
  const ref = useRef(null)
  useEffect(() => {
    const canvas = ref.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    const w = 132
    const h = 52
    canvas.width = w * dpr
    canvas.height = h * dpr
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    let raf = 0
    let level = 0
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const draw = (t) => {
      const target = active
        ? 0.42 + 0.3 * Math.abs(Math.sin(t / 420)) + 0.22 * Math.abs(Math.sin(t / 137)) + 0.08 * Math.random()
        : 0.03
      level += (Math.min(target, 1) - level) * (active ? 0.18 : 0.06)
      ctx.clearRect(0, 0, w, h)
      ctx.fillStyle = '#0A1A25'
      ctx.fillRect(0, 0, w, h)
      ctx.strokeStyle = 'rgba(232,163,61,0.18)'
      ctx.lineWidth = 1
      ctx.strokeRect(0.5, 0.5, w - 1, h - 1)
      const cx = w / 2
      const cy = h + 8
      const r = 44
      ctx.beginPath()
      ctx.arc(cx, cy, r, Math.PI * 1.15, Math.PI * 1.85)
      ctx.strokeStyle = 'rgba(237,228,210,0.35)'
      ctx.lineWidth = 1
      ctx.stroke()
      ctx.beginPath()
      ctx.arc(cx, cy, r, Math.PI * 1.72, Math.PI * 1.85)
      ctx.strokeStyle = 'rgba(232,90,61,0.85)'
      ctx.lineWidth = 2
      ctx.stroke()
      for (let i = 0; i <= 8; i++) {
        const a = Math.PI * (1.15 + (0.7 * i) / 8)
        ctx.beginPath()
        ctx.moveTo(cx + Math.cos(a) * (r - 5), cy + Math.sin(a) * (r - 5))
        ctx.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r)
        ctx.strokeStyle = i > 6 ? 'rgba(232,90,61,0.7)' : 'rgba(143,168,182,0.55)'
        ctx.lineWidth = 1
        ctx.stroke()
      }
      const ang = Math.PI * (1.15 + 0.7 * level)
      ctx.beginPath()
      ctx.moveTo(cx, cy)
      ctx.lineTo(cx + Math.cos(ang) * (r - 3), cy + Math.sin(ang) * (r - 3))
      ctx.strokeStyle = '#E8A33D'
      ctx.lineWidth = 1.6
      ctx.stroke()
      ctx.font = '600 8px ui-monospace, monospace'
      ctx.fillStyle = 'rgba(237,228,210,0.5)'
      ctx.fillText('VU', w / 2 - 6, h - 6)
      if (!reduce) raf = requestAnimationFrame(draw)
    }
    raf = requestAnimationFrame(draw)
    return () => cancelAnimationFrame(raf)
  }, [active])
  return <canvas ref={ref} aria-hidden="true" className="md-vu" style={{ width: 132, height: 52 }} />
}

function loadYouTubeApi() {
  const w = window
  if (w.YT?.Player) return Promise.resolve(w.YT)
  if (w.__loYtPromise) return w.__loYtPromise
  w.__loYtPromise = new Promise((resolve, reject) => {
    const timer = window.setTimeout(() => reject(new Error('yt timeout')), 8000)
    const prev = w.onYouTubeIframeAPIReady
    w.onYouTubeIframeAPIReady = () => {
      window.clearTimeout(timer)
      if (typeof prev === 'function') prev()
      resolve(w.YT)
    }
    const s = document.createElement('script')
    s.src = 'https://www.youtube.com/iframe_api'
    s.async = true
    s.onerror = () => { window.clearTimeout(timer); reject(new Error('yt load failed')) }
    document.head.appendChild(s)
  })
  return w.__loYtPromise
}

function TransportBar({ item, playing, setPlaying, position, setPosition, onSave, saving }) {
  const hostRef = useRef(null)
  const playerRef = useRef(null)
  const lastLen = useRef(0)
  const [liveDuration, setLiveDuration] = useState(0)
  const ytId = item?.source === 'youtube' ? youtubeVideoId(item) : ''
  const spId = item?.source === 'spotify' ? spotifyTrackId(item) : ''
  const duration = liveDuration || item?.durationMs || 210000
  const pct = duration ? Math.min(100, (position / duration) * 100) : 0

  useEffect(() => {
    setPosition(item?.progressMs || 0)
    setLiveDuration(0)
    lastLen.current = 0
    if (item) setPlaying(true)
  }, [item?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!ytId) return undefined
    let cancelled = false
    loadYouTubeApi().then((YT) => {
      if (cancelled || !hostRef.current) return
      try { playerRef.current?.destroy?.() } catch { /* ignore */ }
      playerRef.current = new YT.Player(hostRef.current, {
        videoId: ytId,
        width: '220',
        height: '124',
        playerVars: { rel: 0, modestbranding: 1, playsinline: 1, autoplay: 1 },
        events: {
          onReady: (e) => { e.target.playVideo() },
          onStateChange: (e) => setPlaying(e.data === 1),
        },
      })
    }).catch(() => {})
    return () => {
      cancelled = true
      try { playerRef.current?.destroy?.() } catch { /* ignore */ }
      playerRef.current = null
    }
  }, [ytId, setPlaying])

  useEffect(() => {
    if (!item || !playing || ytId) return undefined
    const id = window.setInterval(() => {
      setPosition((p) => {
        if (p + 250 >= duration) { setPlaying(false); return duration }
        return p + 250
      })
    }, 250)
    return () => window.clearInterval(id)
  }, [item, playing, duration, ytId, setPlaying, setPosition])

  useEffect(() => {
    if (!ytId || !playing) return undefined
    const id = window.setInterval(() => {
      const p = playerRef.current
      if (!p?.getCurrentTime) return
      setPosition(p.getCurrentTime() * 1000)
      const d = (p.getDuration?.() ?? 0) * 1000
      if (d && d !== lastLen.current) { lastLen.current = d; setLiveDuration(d) }
    }, 400)
    return () => window.clearInterval(id)
  }, [ytId, playing, setPosition])

  const toggle = () => {
    if (!item) return
    if (ytId && playerRef.current?.playVideo) {
      if (playing) playerRef.current.pauseVideo()
      else playerRef.current.playVideo()
      return
    }
    setPlaying((p) => !p)
  }

  const seek = (value) => {
    if (ytId && playerRef.current?.seekTo) playerRef.current.seekTo(value / 1000, true)
    setPosition(value)
  }

  return (
    <div className="md-transport">
      <div className="md-tg" aria-hidden="true" />
      <div className="md-tinner">
        {ytId ? (
          <div className="md-yt"><div ref={hostRef} /></div>
        ) : (
          <div className="md-reels" aria-hidden="true">
            <Reel spin={playing && !!item} />
            <div className="md-tape" />
            <Reel spin={playing && !!item} reverse />
          </div>
        )}
        {spId && !ytId ? (
          <iframe
            key={spId}
            title="Spotify"
            className="md-spembed"
            src={`https://open.spotify.com/embed/track/${spId}?utm_source=generator&theme=0`}
            allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
            loading="lazy"
          />
        ) : null}

        <div className="md-tmeta">
          <div style={{ display: 'flex', gap: 10, alignItems: 'baseline' }}>
            <span className="md-label">{item ? (item.source === 'youtube' ? 'یوتیوب' : 'اسپاتیفای') : 'آماده'}</span>
            <span className="md-label" style={{ opacity: 0.6 }}>{item ? (ytId ? 'ویدیو' : 'آهنگ') : 'چیزی پخش نمی‌شه'}</span>
          </div>
          <h3>{item?.title || 'دستگاه آماده‌به‌کار است'}</h3>
          <p>{item?.artist || 'یک قطعه را برای پخش انتخاب کنید'}</p>
          <div className="md-scrub">
            <span className="md-tnum" style={{ color: 'var(--signal)', fontFamily: 'ui-monospace, monospace', fontSize: 12 }}>{clock(position)}</span>
            <input
              type="range"
              min={0}
              max={Math.max(duration, 1000)}
              value={Math.min(position, duration)}
              aria-label="محل پخش"
              onChange={(e) => seek(Number(e.target.value))}
              style={{ background: `linear-gradient(to left, #34D3EE ${pct}%, #24485C ${pct}%)` }}
            />
            <span className="md-tnum" style={{ color: 'var(--mute)', fontFamily: 'ui-monospace, monospace', fontSize: 12 }}>{clock(duration)}</span>
          </div>
        </div>

        <div className="md-tops">
          <VuMeter active={playing && !!item} />
          <button type="button" className="md-play" disabled={!item} onClick={toggle} aria-label={playing ? 'توقف' : 'پخش'}>
            {playing && item ? (
              <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true"><rect x="3" y="2" width="4" height="14" fill="currentColor" /><rect x="11" y="2" width="4" height="14" fill="currentColor" /></svg>
            ) : (
              <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true"><path d="M4 2 16 9 4 16V2Z" fill="currentColor" /></svg>
            )}
          </button>
          <div className="md-tops-ops">
            {item?.url ? <a className="md-link" href={item.url} target="_blank" rel="noreferrer">باز کردن</a> : null}
            <button type="button" className={`md-btn${saving ? ' on' : ''}`} disabled={!item || saving} onClick={() => item && onSave(item)}>
              {saving ? 'در حال ثبت…' : 'ثبت در LifeOS'}
            </button>
            <span className="md-label" style={{ textAlign: 'center', opacity: 0.7 }}>{item ? `${fa(Math.round(pct))}٪` : '—'}</span>
          </div>
        </div>
      </div>
    </div>
  )
}

function Panel({ code, title, hint, children, tone }) {
  return (
    <section className="md-panel">
      <span className="md-screw l" aria-hidden="true" />
      <span className="md-screw r" aria-hidden="true" />
      <header>
        <div>
          <div className="md-label" style={{ color: tone === 'amber' ? 'var(--amber)' : 'var(--signal)' }}>{code}</div>
          <h2>{title}</h2>
        </div>
        {hint ? <small>{hint}</small> : null}
      </header>
      {children}
    </section>
  )
}

function MediaCard({ item, onCue, onSave, saving, active }) {
  if (!item) return null
  return (
    <article className={`md-row${active ? ' on' : ''}`}>
      {item.cover ? <img className="md-art" src={item.cover} alt="" /> : <div className="md-art">♪</div>}
      <div>
        <h3>{item.title}</h3>
        <p>{[item.artist, item.playedAt && fmtWhen(item.playedAt), item.durationMs ? clock(item.durationMs) : ''].filter(Boolean).join(' · ')}</p>
      </div>
      <div className="md-row-ops">
        <button type="button" className="md-btn" onClick={() => onCue(item)}>پخش</button>
        {onSave ? <button type="button" className="md-btn" disabled={saving} onClick={() => onSave(item)}>ثبت در LifeOS</button> : null}
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
  const [youtube, setYoutube] = useState({ items: [], playlists: [], subscriptions: [] })
  const [plView, setPlView] = useState(null)
  const [hits, setHits] = useState([])
  const [life, setLife] = useState([])
  const [lifeKind, setLifeKind] = useState('all')
  const lifeShown = useMemo(() => (lifeKind === 'all' ? life : life.filter((x) => x.source === lifeKind)), [life, lifeKind])
  const [cue, setCue] = useState(null)
  const [playing, setPlaying] = useState(false)
  const [position, setPosition] = useState(0)
  const [log, setLog] = useState([])
  const [saving, setSaving] = useState(false)

  const note = (level, t) => setLog((xs) => [{ level, t, at: new Date().toLocaleTimeString('fa-IR') }, ...xs].slice(0, 8))

  const loadInteg = useCallback(async () => {
    try {
      const r = await fetch('/api/integrations', { credentials: 'include' })
      setInteg(await r.json().catch(() => ({})))
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
    } catch { /* keep */ }
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
        subscriptions: pj.subscriptions || [],
      })
    } catch { /* keep */ }
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
      await fetch(`/api/integrations/${kind}/disconnect`, { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: '{}' })
      await loadInteg()
      note('info', `${kind === 'spotify' ? 'اسپاتیفای' : 'یوتیوب'} قطع شد`)
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
      note(list.length ? 'ok' : 'info', `جستجو: ${query} — ${fa(list.length)} نتیجه`)
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
      if (!r.ok) { setNotice(j.error || 'ثبت نشد'); note('err', 'ثبت نشد'); return }
      note('ok', `ثبت شد: ${item.title}`)
      await loadLife()
    } finally { setSaving(false) }
  }

  async function dropLife(id) {
    await fetch(`/api/media-log/${id}`, { method: 'DELETE', credentials: 'include' })
    await loadLife()
  }

  const cueItem = (item) => { setCue(item); setPlaying(true); setPosition(0) }

  const openPlaylist = useCallback(async (pl, source) => {
    setPlView({ pl, source, items: [], loading: source === 'youtube', error: '' })
    if (source !== 'youtube') return
    try {
      const r = await fetch(`/api/integrations/youtube/playlist-items?playlistId=${encodeURIComponent(pl.id)}`, { credentials: 'include' })
      const j = await r.json().catch(() => ({}))
      if (!r.ok) {
        setPlView((v) => (v && v.pl === pl ? { ...v, loading: false, error: j.error || 'دریافت ویدیوها ناموفق بود' } : v))
        return
      }
      const items = (j.items || []).map((x) => normMediaItem(x, 'youtube')).filter(Boolean)
      setPlView((v) => (v && v.pl === pl ? { ...v, loading: false, items } : v))
    } catch {
      setPlView((v) => (v && v.pl === pl ? { ...v, loading: false, error: 'دریافت ویدیوها ناموفق بود' } : v))
    }
  }, [])

  const closePlaylist = useCallback(() => setPlView(null), [])

  const playWholePlaylist = useCallback((pl, source) => {
    const item = normMediaItem({ ...pl, title: pl.title || pl.name }, source)
    if (item) cueItem(item)
  }, [])

  useEffect(() => {
    if (!plView) return undefined
    const onKey = (e) => { if (e.key === 'Escape') closePlaylist() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [plView, closePlaylist])

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
    const artists = {}
    for (const x of last30) {
      titles[x.title] = (titles[x.title] || 0) + 1
      const a = parseMeta(x.meta).artist
      if (a) artists[a] = (artists[a] || 0) + 1
    }
    const top = Object.entries(titles).sort((a, b) => b[1] - a[1]).slice(0, 6)
    const topArtist = Object.entries(artists).sort((a, b) => b[1] - a[1])[0]
    const days = new Set(life.map((x) => new Date(x.createdAt).toISOString().slice(0, 10)))
    let streak = 0
    const d = new Date()
    for (let i = 0; i < 60; i++) {
      const key = d.toISOString().slice(0, 10)
      if (days.has(key)) { streak += 1; d.setDate(d.getDate() - 1) } else break
    }
    return {
      n30: last30.length,
      nSp: last30.filter((x) => x.source === 'spotify').length,
      nYt: last30.filter((x) => x.source === 'youtube').length,
      nAll: life.length,
      minutes: last30.length * 3,
      hours,
      maxH,
      top,
      topArtist: topArtist ? topArtist[0] : '—',
      topShare: last30.length && topArtist ? Math.round((topArtist[1] / last30.length) * 100) : 0,
      streak,
    }
  }, [life])

  const feed = unit === 'youtube' ? youtube.items : spotify.items
  const playlists = unit === 'youtube' ? youtube.playlists : spotify.playlists
  const list = hits.length ? hits : feed

  return (
    <div className="md" dir="rtl">
      {Nav && <Nav active="media" />}
      <div className="md-page">
        <header className="md-hero">
          <div>
            
            <h1>رسانه</h1>
            <p>پخش، تاریخچه، پلی‌لیست‌ها و آمارِ اسپاتیفای و یوتیوب در یک دستگاه — از دفتر واقعی LifeOS، بدون کاتالوگ نمایشی.</p>
          </div>
          <div className="md-units">
            {[
              { id: 'desk', title: 'میز', sub: 'نمای کلی', code: '' },
              { id: 'spotify', title: 'اسپاتیفای', sub: spOn ? 'متصل' : (integ?.spotify?.configured ? 'آمادهٔ اتصال' : 'پیکربندی نشده'), code: '' },
              { id: 'youtube', title: 'یوتیوب', sub: ytOn ? 'متصل' : (integ?.youtube?.configured ? 'آمادهٔ اتصال' : 'پیکربندی نشده'), code: '' },
              { id: 'life', title: 'تاریخچهٔ زندگی', sub: `${fa(life.length)} ثبت`, code: '' },
            ].map((u) => (
              <button key={u.id} type="button" className={`md-unit${unit === u.id ? ' on' : ''}`} onClick={() => setUnit(u.id)}>
                <div className="md-label">
                  {u.code} <span className={`md-led${(u.id === 'spotify' && spOn) || (u.id === 'youtube' && ytOn) || u.id === 'desk' || u.id === 'life' ? ' on' : ''}`} />
                </div>
                <b>{u.title}</b>
                <small>{u.sub}</small>
              </button>
            ))}
          </div>
        </header>

        {notice ? (
          <div className="md-strip bad">
            <button type="button" className="md-btn" onClick={() => setNotice('')}>×</button>
            <strong style={{ flex: 1 }}>{notice}</strong>
            <span className="md-label">خطا</span>
          </div>
        ) : (
          <div className="md-strip">
            <span className="md-led on" />
            <p style={{ flex: 1, margin: 0, fontFamily: 'ui-monospace, monospace', fontSize: 12, color: 'var(--mute)' }}>
              {log[0] ? `${log[0].t}  —  ${log[0].at}` : 'آماده: پخش روی نوار پایین، ثبت در دفتر با دکمهٔ LifeOS.'}
            </p>
            <span className="md-label">گزارش</span>
          </div>
        )}

        {unit !== 'life' ? (
          <form className="md-search" onSubmit={search}>
            <span className="md-screw l" aria-hidden="true" />
            <span className="md-screw r" aria-hidden="true" />
            <button type="submit" className="md-btn md-signal" disabled={busy === 'search'}>{busy === 'search' ? '…' : 'جستجو'}</button>
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={unit === 'youtube' ? 'ویدیو یا کانال…' : 'آهنگ، آلبوم، هنرمند…'} />
            <span className={`md-chip${unit === 'youtube' ? '' : ' on'}`}>اسپاتیفای</span>
            <span className={`md-chip${unit === 'youtube' ? ' on' : ''}`}>یوتیوب</span>
          </form>
        ) : null}

        {unit === 'spotify' || unit === 'desk' ? (
          <div className={`md-strip${spOn ? ' ok' : ' bad'}`}>
            <span className={`md-led${spOn ? ' on' : ''}`} />
            <strong>{spOn ? 'اسپاتیفای متصل است' : (integ?.spotify?.configured ? 'اسپاتیفای متصل نیست' : 'کلید اسپاتیفای روی سرور تنظیم نشده')}</strong>
            <span style={{ flex: 1 }} />
            {spOn
              ? <button type="button" className="md-btn" disabled={!!busy} onClick={() => disconnect('spotify')}>قطع اتصال</button>
              : <button type="button" className="md-btn md-signal" disabled={!!busy || !integ?.spotify?.configured} onClick={() => connect('spotify')}>اتصال</button>}
            <button type="button" className="md-btn" onClick={() => { loadSpotify(); loadInteg(); note('info', 'اسپاتیفای تازه شد') }}>تازه‌سازی</button>
          </div>
        ) : null}

        {unit === 'youtube' || unit === 'desk' ? (
          <div className={`md-strip${ytOn ? ' ok' : ' bad'}`}>
            <span className={`md-led${ytOn ? ' on' : ''}`} />
            <strong>{ytOn ? 'یوتیوب متصل است' : (integ?.youtube?.configured ? 'یوتیوب متصل نیست' : 'کلید یوتیوب روی سرور تنظیم نشده')}</strong>
            <span style={{ flex: 1 }} />
            {ytOn
              ? <button type="button" className="md-btn" disabled={!!busy} onClick={() => disconnect('youtube')}>قطع اتصال</button>
              : <button type="button" className="md-btn md-signal" disabled={!!busy || !integ?.youtube?.configured} onClick={() => connect('youtube')}>اتصال</button>}
            <button type="button" className="md-btn" onClick={() => { loadYoutube(); loadInteg(); note('info', 'یوتیوب تازه شد') }}>تازه‌سازی</button>
          </div>
        ) : null}

        {unit === 'life' ? (
          <Panel code="" title="تاریخچهٔ زندگی" hint={`${fa(lifeShown.length)} مورد`}>
            <div style={{ display: 'flex', gap: 6, padding: '10px 14px' }}>
              {Object.entries(MEDIA_KIND_LABELS).map(([k, lab]) => (
                <button key={k} type="button" className={`md-btn${lifeKind === k ? ' on' : ''}`} onClick={() => setLifeKind(k)}>{lab}</button>
              ))}
            </div>
            {!lifeShown.length ? (
              <div className="md-empty"><b>قفسه خالی است</b>هنوز چیزی در دفتر رسانه ثبت نشده.</div>
            ) : lifeShown.map((row) => {
              const meta = parseMeta(row.meta)
              return (
                <article key={row.id} className="md-row">
                  {meta.cover ? <img className="md-art" src={meta.cover} alt="" /> : <div className="md-art">♪</div>}
                  <div>
                    <h3>{row.title}</h3>
                    <p>{[MEDIA_KIND_LABELS[row.source] || row.source, meta.artist, fmtWhen(row.createdAt)].filter(Boolean).join(' · ')}</p>
                  </div>
                  <div className="md-row-ops">
                    {meta.url ? <button type="button" className="md-btn" onClick={() => cueItem({ ...row, ...meta, source: row.source })}>پخش</button> : null}
                    {meta.url ? <a className="md-link" href={meta.url} target="_blank" rel="noreferrer">باز کردن</a> : null}
                    <button type="button" className="md-btn" onClick={() => dropLife(row.id)}>حذف</button>
                  </div>
                </article>
              )
            })}
          </Panel>
        ) : (
          <div className="md-grid">
            <Panel
              code={unit === 'youtube' ? '' : ''}
              title={hits.length ? 'نتیجهٔ جستجو' : (unit === 'youtube' ? 'آخرها دیده‌شده' : 'آخرها پخش‌شده')}
              hint={`${fa(list.length)} مورد · ${unit === 'youtube' ? (ytOn ? 'همگام از حساب' : 'اتصال لازم است') : (spOn ? 'همگام از حساب' : 'اتصال یا جستجو')}`}
            >
              {unit !== 'youtube' && spotify.nowPlaying ? (
                <div className="md-now">
                  <div className="cover" style={spotify.nowPlaying.cover ? { backgroundImage: `url(${spotify.nowPlaying.cover})` } : undefined} />
                  <div>
                    <div className="md-label">در حال پخش</div>
                    <b>{spotify.nowPlaying.title}</b>
                    <p style={{ margin: '4px 0 0', color: 'var(--mute)', fontFamily: 'ui-monospace, monospace', fontSize: 11 }}>{spotify.nowPlaying.artist}</p>
                  </div>
                  <span style={{ flex: 1 }} />
                  <button type="button" className="md-btn" onClick={() => cueItem(spotify.nowPlaying)}>پخش</button>
                  <button type="button" className="md-btn" disabled={saving} onClick={() => saveItem(spotify.nowPlaying)}>ثبت</button>
                </div>
              ) : null}
              {!list.length ? (
                <div className="md-empty">
                  <b>{unit === 'youtube' ? 'هنوز چیزی دیده نشده' : 'هنوز چیزی پخش نشده'}</b>
                  {unit === 'youtube' ? (ytOn ? 'تاریخچه‌ای نیامد.' : 'یوتیوب را وصل کنید یا جستجو کنید.') : (spOn ? 'اخیراً چیزی پخش نشده.' : 'اسپاتیفای را وصل کنید یا جستجو کنید.')}
                </div>
              ) : list.map((it) => (
                <MediaCard key={it.id + it.title} item={it} onCue={cueItem} onSave={saveItem} saving={saving} active={cue?.id === it.id} />
              ))}
            </Panel>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {unit !== 'youtube' && spotify.artists.length ? (
                <Panel code="" title="بالاترین‌ها">
                  <div className="md-artists">
                    {spotify.artists.map((a) => (
                      <a key={a.id || a.name} className="md-artist" href={a.url || '#'} target="_blank" rel="noreferrer">
                        <span style={a.image || a.cover ? { backgroundImage: `url(${a.image || a.cover})` } : undefined} />
                        <small>{a.name}</small>
                      </a>
                    ))}
                  </div>
                </Panel>
              ) : null}

              <Panel code="" title="لیست‌های پخش" hint={fa(playlists.length)}>
                {!playlists.length ? (
                  <div className="md-empty"><b>قفسه خالی است</b>لیستی از حساب متصل نیامد.</div>
                ) : (
                  <div className="md-pls">
                    {playlists.map((pl) => (
                      <button key={pl.id || pl.title || pl.name} type="button" className="md-pl" onClick={() => openPlaylist(pl, unit === 'youtube' ? 'youtube' : 'spotify')}>
                        <div className="md-label">{pl.owner || pl.channel || 'پلی‌لیست'}</div>
                        <b>{pl.title || pl.name}</b>
                        <small>{pl.count || pl.tracks || pl.itemCount ? `${fa(pl.count || pl.tracks || pl.itemCount)} مورد` : ''}</small>
                      </button>
                    ))}
                  </div>
                )}
              </Panel>

              {unit === 'youtube' ? (
                <Panel code="" title="اشتراک‌ها" hint={fa(youtube.subscriptions.length)}>
                  {!youtube.subscriptions.length ? (
                    <div className="md-empty"><b>قفسه خالی است</b>اشتراکی از حساب متصل نیامد.</div>
                  ) : (
                    <div className="md-pls">
                      {youtube.subscriptions.map((s) => (
                        <a key={s.id || s.title || s.name} className="md-pl md-sub" href={s.url || undefined} target={s.url ? '_blank' : undefined} rel="noreferrer">
                          {s.cover || s.thumb ? <img className="md-subimg" src={s.cover || s.thumb} alt="" /> : <div className="md-subimg">▶</div>}
                          <div>
                            <b>{s.title || s.name}</b>
                            {s.description ? <small>{s.description}</small> : null}
                          </div>
                        </a>
                      ))}
                    </div>
                  )}
                </Panel>
              ) : null}
            </div>
          </div>
        )}

        <div style={{ marginTop: 16 }}>
          <Panel code="" title="آمارِ سی‌روزِ اخیر" hint="محاسبه‌شده از تاریخچهٔ LifeOS" tone="amber">
            <div className="md-stats">
              <div className="md-stat"><div className="md-label">پخش</div><b>{fa(stats.n30)}</b><small>در سی روز اخیر</small></div>
              <div className="md-stat"><div className="md-label">دقیقه</div><b className="amber">{fa(stats.minutes)}</b><small>برآورد از ثبت‌ها</small></div>
              <div className="md-stat"><div className="md-label">یوتیوب</div><b>{fa(stats.nYt)}</b><small>اسپاتیفای {fa(stats.nSp)}</small></div>
              <div className="md-stat"><div className="md-label">پیاپی</div><b className="signal">{fa(stats.streak)}</b><small>کل دفتر: {fa(stats.nAll)}</small></div>
            </div>
            <div style={{ borderTop: '1px solid rgba(36,72,92,.6)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 18px 0', alignItems: 'baseline' }}>
                <p className="md-label" style={{ margin: 0 }}>پراکندگی ساعت ثبت</p>
                <p style={{ margin: 0, fontFamily: 'ui-monospace, monospace', fontSize: 11, color: 'var(--mute)' }}>
                  پرتکرارترین صدا: <span style={{ color: 'var(--amber)' }}>{stats.topArtist}</span> — {fa(stats.topShare)}٪
                </p>
              </div>
              <div className="md-hours">
                {stats.hours.map((n, i) => (
                  <span key={i} title={`${i}:00 — ${n}`}>
                    <i style={{ height: `${Math.max(3, (n / stats.maxH) * 88)}px` }} />
                    {i % 6 === 0 ? <em>{fa(i)}</em> : null}
                  </span>
                ))}
              </div>
            </div>
            {stats.top.length ? (
              <div style={{ padding: '4px 8px 12px' }}>
                <div className="md-label" style={{ padding: '0 10px 6px' }}>از تاریخچهٔ خودتان</div>
                <div className="md-pls">
                  {stats.top.map(([title, n]) => (
                    <button key={title} type="button" className="md-pl" onClick={() => { setQ(title); cueItem({ title, source: 'spotify', artist: '', url: '', cover: '', id: title }) }}>
                      <b>{title}</b>
                      <small>{fa(n)} بار در دفتر</small>
                    </button>
                  ))}
                </div>
              </div>
            ) : <div className="md-empty"><b>هنوز نموداری نیست</b>با ثبت پخش‌ها، پیشنهاد و آمار اینجا پر می‌شود.</div>}
          </Panel>
        </div>

        <footer className="md-foot">
          <ul className="md-log">
            {log.map((l, i) => (
              <li key={i}><span className={l.level}>{l.level === 'err' ? 'ERR' : l.level === 'ok' ? 'OK' : 'INFO'}</span> {l.t} — {l.at}</li>
            ))}
          </ul>
          <div className="md-label">Spotify: recently-played · YouTube: readonly · توکن فقط روی سرور</div>
        </footer>
      </div>

      <TransportBar item={cue} playing={playing} setPlaying={setPlaying} position={position} setPosition={setPosition} onSave={saveItem} saving={saving} />

      {plView ? (
        <div className="md-modal-backdrop" onClick={closePlaylist}>
          <div className="md-modal" onClick={(e) => e.stopPropagation()}>
            <span className="md-screw l" aria-hidden="true" />
            <span className="md-screw r" aria-hidden="true" />
            <header className="md-modal-head">
              <div>
                <div className="md-label">{plView.source === 'youtube' ? 'یوتیوب' : 'اسپاتیفای'}</div>
                <h2>{plView.pl.title || plView.pl.name}</h2>
                <p className="md-modal-sub">
                  {[
                    plView.pl.owner || plView.pl.channel || plView.pl.channelTitle,
                    (plView.pl.count || plView.pl.tracks || plView.pl.itemCount) ? `${fa(plView.pl.count || plView.pl.tracks || plView.pl.itemCount)} مورد` : '',
                  ].filter(Boolean).join(' · ')}
                </p>
              </div>
              <button type="button" className="md-btn" onClick={closePlaylist}>بستن ×</button>
            </header>
            <div className="md-modal-ops">
              <button type="button" className="md-btn md-signal" onClick={() => playWholePlaylist(plView.pl, plView.source)}>پخش کل پلی‌لیست</button>
              {plView.pl.url ? <a className="md-link" href={plView.pl.url} target="_blank" rel="noreferrer">باز کردن در {plView.source === 'youtube' ? 'یوتیوب' : 'اسپاتیفای'}</a> : null}
            </div>
            <div className="md-modal-body">
              {plView.source === 'spotify' ? (
                spotifyPlaylistId(plView.pl) ? (
                  <iframe
                    title="Spotify playlist"
                    className="md-spplembed"
                    src={`https://open.spotify.com/embed/playlist/${spotifyPlaylistId(plView.pl)}?utm_source=generator&theme=0`}
                    allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
                    loading="lazy"
                  />
                ) : (
                  <div className="md-empty"><b>مشاهدهٔ محتوا ممکن نیست</b>شناسهٔ این پلی‌لیست از اسپاتیفای دریافت نشد.</div>
                )
              ) : plView.loading ? (
                <div className="md-empty"><b>در حال دریافت…</b>ویدیوهای این پلی‌لیست در حال بارگذاری است.</div>
              ) : plView.error ? (
                <div className="md-empty"><b>ناموفق</b>{plView.error}</div>
              ) : !plView.items.length ? (
                <div className="md-empty"><b>خالی است</b>ویدیویی در این پلی‌لیست نیست.</div>
              ) : plView.items.map((it) => (
                <MediaCard key={it.id + it.title} item={it} onCue={cueItem} onSave={saveItem} saving={saving} active={cue?.id === it.id} />
              ))}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
