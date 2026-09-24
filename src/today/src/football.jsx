import { useEffect, useMemo, useRef, useState } from 'react'
import { ArrowLeft, Check, ChevronDown, Heart, Minus, Plus, X } from 'lucide-react'
import './football.css'

const api = async (url, options) => {
  const response = await fetch(url, { credentials: 'include', ...options, headers: { 'Content-Type': 'application/json', ...(options?.headers || {}) } })
  const body = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(body.error || 'دریافت اطلاعات ناموفق بود.')
  return body
}

const FOLLOW_KEY = 'lifeos-followed-leagues'
const TABS = [
  { id: 'table', label: 'جدول' },
  { id: 'matches', label: 'بازی‌ها' },
  { id: 'statistics', label: 'آمار' },
  { id: 'history', label: 'بازی‌های تمام‌شده' },
]
const LIVE_DAYS = [
  { id: -1, label: 'دیروز' },
  { id: 0, label: 'امروز' },
  { id: 1, label: 'فردا' },
]
const LEAGUE_META = {
  'irn.1': { mark: 'ایران', color: '#41b7e5' },
  'eng.1': { mark: 'PL', color: '#ad6cbd' },
  'esp.1': { mark: 'LL', color: '#ef4a4a' },
  'ita.1': { mark: 'A', color: '#33a2e2' },
  'ger.1': { mark: 'BL', color: '#e23142' },
  'fra.1': { mark: 'L1', color: '#aab4c8' },
  'tur.1': { mark: 'TR', color: '#e23142' },
  'por.1': { mark: 'PT', color: '#3d8f4a' },
  'uefa.champions': { mark: 'UCL', color: '#4c61c7' },
  'uefa.europa': { mark: 'UEL', color: '#dc9e3d' },
  'afc.champions': { mark: 'AFC', color: '#9f7cca' },
  'ksa.1': { mark: 'KSA', color: '#2f9e5f' },
}

const faNum = (v) => String(v ?? '').replace(/[0-9]/g, (d) => '۰۱۲۳۴۵۶۷۸۹'[d])
const isoShift = (n) => {
  const d = new Date()
  d.setDate(d.getDate() + n)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
const loadFollow = () => {
  try { return JSON.parse(localStorage.getItem(FOLLOW_KEY) || '{}') } catch { return {} }
}
const accentOf = (name) => {
  let h = 0
  for (const ch of String(name || '')) h = (h * 31 + ch.charCodeAt(0)) >>> 0
  return `hsl(${h % 360} 42% 48%)`
}
const shortOf = (name) => (String(name || '?').trim().charAt(0) || '?')
const parseScore = (raw) => {
  const m = String(raw || '').match(/(-?\d+)\s*[-–:]\s*(-?\d+)/)
  if (!m) return null
  return [Number(m[1]), Number(m[2])]
}
const matchTime = (item) => {
  if (item.time) return item.time
  const d = item.date ? new Date(item.date) : null
  if (!d || Number.isNaN(d.getTime())) return '—'
  return d.toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit' })
}
const matchDateLabel = (item) => {
  const raw = String(item.date || '').slice(0, 10)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) return item.date || '—'
  return new Date(`${raw}T12:00:00`).toLocaleDateString('fa-IR')
}
const asTeam = (name, logo) => ({ name: name || 'نامشخص', logo, accent: accentOf(name), short: shortOf(name) })

function TeamBadge({ team, small }) {
  const [failed, setFailed] = useState(false)
  return (
    <span className={`team-badge${small ? ' team-badge-small' : ''}`} style={{ '--badge-accent': team.accent }} aria-hidden="true">
      {team.logo && !failed ? <img src={team.logo} alt="" loading="lazy" onError={() => setFailed(true)} /> : <span className="team-badge-fallback">{team.short}</span>}
    </span>
  )
}

function LeagueBadge({ league, large }) {
  return (
    <span className={`league-badge${large ? ' league-badge-large' : ''}`} style={{ '--league-accent': league.color }} aria-hidden="true">
      <span>{league.mark}</span>
    </span>
  )
}

export function FootballReact({ Nav }) {
  const [leagues, setLeagues] = useState([])
  const [leagueId, setLeagueId] = useState('irn.1')
  const [tab, setTab] = useState('table')
  const [standings, setStandings] = useState([])
  const [matches, setMatches] = useState([])
  const [liveDay, setLiveDay] = useState(0)
  const [liveLeagues, setLiveLeagues] = useState([])
  const [liveOnly, setLiveOnly] = useState(false)
  const [showPast, setShowPast] = useState(false)
  const [loading, setLoading] = useState(false)
  const [notice, setNotice] = useState('')
  const [selected, setSelected] = useState(null)
  const [followed, setFollowed] = useState(loadFollow)
  const [menuOpen, setMenuOpen] = useState(false)
  const selectorRef = useRef(null)

  const league = useMemo(() => {
    const found = leagues.find((l) => l.id === leagueId) || leagues[0] || { id: leagueId, name: 'فوتبال', country: '' }
    const meta = LEAGUE_META[found.id] || { mark: (found.country || found.name || '?').slice(0, 2), color: '#41b7e5' }
    return { ...found, ...meta }
  }, [leagues, leagueId])

  useEffect(() => {
    api('/api/football/remote/free/leagues').then((d) => {
      const items = (d.items || []).map((l) => ({ ...l, ...(LEAGUE_META[l.id] || { mark: (l.country || l.name || '?').slice(0, 2), color: '#6b8aa0' }) }))
      setLeagues(items)
      if (!items.some((l) => l.id === leagueId) && items[0]) setLeagueId(items[0].id)
    }).catch((e) => setNotice(e.message))
  }, [])

  useEffect(() => {
    if (!league.id) return
    let live = true
    setLoading(true)
    Promise.all([
      api(`/api/football/remote/free/standings?league=${encodeURIComponent(league.id)}`).catch((e) => ({ items: [], error: e.message })),
      api(`/api/football/remote/free/matches?league=${encodeURIComponent(league.id)}`).catch((e) => ({ items: [], error: e.message })),
    ]).then(([st, mt]) => {
      if (!live) return
      setStandings(st.items || [])
      setMatches(mt.items || [])
      if (st.error || mt.error) setNotice(st.error || mt.error)
    }).finally(() => live && setLoading(false))
    return () => { live = false }
  }, [league.id])

  useEffect(() => {
    let live = true
    api(`/api/football/remote/free/day?date=${isoShift(liveDay)}`).then((d) => {
      if (live) setLiveLeagues(d.leagues || [])
    }).catch(() => live && setLiveLeagues([]))
    return () => { live = false }
  }, [liveDay])

  useEffect(() => {
    if (!menuOpen) return
    const onDown = (e) => { if (!selectorRef.current?.contains(e.target)) setMenuOpen(false) }
    document.addEventListener('pointerdown', onDown)
    return () => document.removeEventListener('pointerdown', onDown)
  }, [menuOpen])

  const toggleFollow = () => {
    setFollowed((cur) => {
      const next = { ...cur, [league.id]: !cur[league.id] }
      localStorage.setItem(FOLLOW_KEY, JSON.stringify(next))
      return next
    })
  }

  const following = Boolean(followed[league.id])
  const stats = useMemo(() => {
    const rows = standings
    const played = rows.reduce((s, r) => s + Number(r.played || 0), 0) / 2
    const goals = rows.reduce((s, r) => s + Number(r.gf || 0), 0)
    return {
      goals,
      matches: Math.round(played) || rows.length,
      avg: played ? (goals / played).toFixed(2) : '—',
    }
  }, [standings])

  const grouped = useMemo(() => {
    const map = new Map()
    for (const m of matches) {
      const key = String(m.date || '').slice(0, 10) || '—'
      if (!map.has(key)) map.set(key, [])
      map.get(key).push(m)
    }
    return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0]))
  }, [matches])

  const upcoming = grouped.filter(([, list]) => list.some((m) => m.status !== 'finished'))
  const finished = grouped.filter(([, list]) => list.some((m) => m.status === 'finished'))
  const fixtureGroups = showPast ? grouped : (upcoming.length ? upcoming : grouped)

  const openMatch = (item) => setSelected({
    home: asTeam(item.home, item.homeLogo),
    away: asTeam(item.away, item.awayLogo),
    score: parseScore(item.score),
    time: matchTime(item),
    date: matchDateLabel(item),
    competition: item.league || league.name,
    status: item.status || 'upcoming',
  })

  return (
    <div className="fb" dir="rtl">
      {Nav ? <Nav active="football" /> : null}
      <main className="app-shell">
        <div className="page-container">
          <header className="league-hero" id="top">
            <div className="hero-topline">
              <div className="league-selector" ref={selectorRef}>
                <div className="league-identity">
                  <LeagueBadge league={league} large />
                  <button type="button" className="league-trigger" aria-expanded={menuOpen} onClick={() => setMenuOpen((o) => !o)}>
                    <span>{league.name}</span>
                    <ChevronDown className={menuOpen ? 'chevron-open' : ''} size={22} />
                  </button>
                </div>
                {menuOpen ? (
                  <div className="league-menu" role="menu">
                    {leagues.map((option) => (
                      <button
                        key={option.id}
                        type="button"
                        className={`league-menu-option${league.id === option.id ? ' is-selected' : ''}`}
                        onClick={() => { setLeagueId(option.id); setMenuOpen(false) }}
                      >
                        <LeagueBadge league={option} />
                        <span>{option.name}</span>
                        {league.id === option.id ? <Check size={15} className="selected-check" /> : null}
                      </button>
                    ))}
                  </div>
                ) : null}
              </div>
              <button type="button" className={`follow-button${following ? ' is-following' : ''}`} aria-pressed={following} onClick={toggleFollow}>
                <Heart size={18} fill={following ? 'currentColor' : 'none'} />
                <span>{following ? 'دنبال می‌کنید' : 'دنبال کنید'}</span>
              </button>
            </div>
            <nav className="league-tabs" role="tablist">
              {TABS.map((item) => (
                <button key={item.id} type="button" className={`league-tab${tab === item.id ? ' is-active' : ''}`} onClick={() => setTab(item.id)}>{item.label}</button>
              ))}
            </nav>
          </header>

          {notice ? <div className="notice">{notice} <button type="button" onClick={() => setNotice('')}>×</button></div> : null}
          {loading ? <p className="live-empty">در حال دریافت دادهٔ زنده…</p> : null}

          {tab === 'table' ? (
            <section className="standings-section">
              <h2 className="section-heading">جدول {league.name}</h2>
              <div className="standings-layout">
                <div className="standings-scroll">
                  {standings.length ? (
                    <table className="standings-table">
                      <thead>
                        <tr>
                          <th>#</th>
                          <th className="team-heading">تیم</th>
                          <th>بازی</th>
                          <th className="hide-small">برد</th>
                          <th className="hide-small">مساوی</th>
                          <th className="hide-small">باخت</th>
                          <th className="hide-medium">گل +/-</th>
                          <th>تفاضل</th>
                          <th>امتیاز</th>
                        </tr>
                      </thead>
                      <tbody>
                        {standings.map((row, index) => {
                          const team = asTeam(row.team || row.name, row.logo)
                          const gd = row.gd != null ? row.gd : (Number(row.gf || 0) - Number(row.ga || 0))
                          return (
                            <tr key={row.team || row.name || index}>
                              <td className={`rank-cell${index < 4 ? ' rank-top' : ''}${index > standings.length - 4 ? ' rank-bottom' : ''}`}>{faNum(row.rank || index + 1)}</td>
                              <th className="team-column"><span className="table-team"><TeamBadge team={team} /><span>{team.name}</span></span></th>
                              <td>{faNum(row.played || 0)}</td>
                              <td className="hide-small">{faNum(row.win || row.won || 0)}</td>
                              <td className="hide-small">{faNum(row.draw || row.drawn || 0)}</td>
                              <td className="hide-small">{faNum(row.loss || row.lost || 0)}</td>
                              <td className="hide-medium"><bdi dir="ltr">{faNum(`${row.gf || 0}-${row.ga || 0}`)}</bdi></td>
                              <td><bdi dir="ltr">{faNum(gd)}</bdi></td>
                              <td className="points-cell">{faNum(row.pts || row.points || 0)}</td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  ) : <p className="live-empty">جدول این لیگ از سرویس LifeOS نیامد.</p>}
                </div>
                <aside className="stats-panel">
                  <h3>آمار از جدول زنده</h3>
                  <dl className="stats-list">
                    <div className="stat-line stat-line-shaded"><dt>گل‌های ثبت‌شده در جدول</dt><dd>{faNum(stats.goals)}</dd></div>
                    <div className="stat-line"><dt>تیم‌ها</dt><dd>{faNum(standings.length)}</dd></div>
                    <div className="stat-line stat-line-shaded"><dt>متوسط گل در هر بازی</dt><dd>{faNum(stats.avg)}</dd></div>
                  </dl>
                  <div className="stats-panel-bottom">منبع: /api/football — بدون دادهٔ نمایشی</div>
                </aside>
              </div>
            </section>
          ) : null}

          {tab === 'matches' ? (
            <section className="fixtures-section">
              <div className="fixtures-intro">
                <h2>بازی‌های {league.name}</h2>
                <p>بازهٔ حدود ۱۰ روز قبل تا ۲۱ روز بعد از سرویس رایگان LifeOS.</p>
              </div>
              <button type="button" className="previous-toggle" onClick={() => setShowPast((v) => !v)}>
                {showPast ? <Minus size={18} /> : <Plus size={18} />}
                <span>{showPast ? 'پنهان کردن بازی‌های تمام‌شده در لیست' : 'نمایش همهٔ بازی‌های بازه'}</span>
              </button>
              <div className="fixture-groups">
                {fixtureGroups.length ? fixtureGroups.map(([day, list]) => (
                  <div className="fixture-group" key={day}>
                    <div className="fixture-date"><span>{faNum(day)}</span></div>
                    <ul className="fixture-list">
                      {list.map((item) => {
                        const home = asTeam(item.home, item.homeLogo)
                        const away = asTeam(item.away, item.awayLogo)
                        const score = parseScore(item.score)
                        const homeLost = score && score[0] < score[1]
                        const awayLost = score && score[1] < score[0]
                        return (
                          <li key={item.fixtureId || `${item.home}-${item.away}-${item.date}`}>
                            <button type="button" className="fixture-row" onClick={() => openMatch(item)}>
                              <span className="fixture-time">{item.status === 'live' ? 'زنده' : matchTime(item)}</span>
                              <span className={`fixture-team fixture-home${homeLost ? ' team-muted' : ''}`}>
                                <span className="fixture-team-name">{home.name}</span>
                                <TeamBadge team={home} />
                              </span>
                              <span className="fixture-score" dir="ltr">
                                {score ? <><span className={homeLost ? 'score-muted' : ''}>{faNum(score[0])}</span><span className="score-separator">-</span><span className={awayLost ? 'score-muted' : ''}>{faNum(score[1])}</span></> : <span>-</span>}
                              </span>
                              <span className={`fixture-team fixture-away${awayLost ? ' team-muted' : ''}`}>
                                <TeamBadge team={away} />
                                <span className="fixture-team-name">{away.name}</span>
                              </span>
                            </button>
                          </li>
                        )
                      })}
                    </ul>
                  </div>
                )) : <p className="live-empty">بازی‌ای برای این لیگ دریافت نشد.</p>}
              </div>
            </section>
          ) : null}

          {tab === 'statistics' ? (
            <section className="secondary-section">
              <h2 className="section-heading">آمار {league.name}</h2>
              <div className="secondary-layout">
                <div className="leaderboard">
                  <h3>بالای جدول</h3>
                  {standings.length ? (
                    <ol>
                      {standings.slice(0, 6).map((row, index) => {
                        const team = asTeam(row.team || row.name, row.logo)
                        return (
                          <li key={team.name}>
                            <span className="leader-position">{faNum(index + 1)}</span>
                            <TeamBadge team={team} />
                            <span className="leader-name">{team.name}<small>{faNum(row.played || 0)} بازی</small></span>
                            <strong>{faNum(row.pts || row.points || 0)} امتیاز</strong>
                          </li>
                        )
                      })}
                    </ol>
                  ) : <p className="live-empty">آمار گلزن از API نمی‌آید؛ این فهرست از جدول زنده است.</p>}
                </div>
                <aside className="stats-panel">
                  <h3>خلاصه</h3>
                  <dl className="stats-list">
                    <div className="stat-line stat-line-shaded"><dt>گل‌ها</dt><dd>{faNum(stats.goals)}</dd></div>
                    <div className="stat-line"><dt>متوسط گل</dt><dd>{faNum(stats.avg)}</dd></div>
                  </dl>
                </aside>
              </div>
            </section>
          ) : null}

          {tab === 'history' ? (
            <section className="secondary-section history-section">
              <h2 className="section-heading">بازی‌های تمام‌شدهٔ این بازه</h2>
              {finished.length ? finished.map(([day, list]) => (
                <div className="fixture-group" key={day} style={{ marginTop: 12 }}>
                  <div className="fixture-date"><span>{faNum(day)}</span></div>
                  <ul className="fixture-list">
                    {list.filter((m) => m.status === 'finished').map((item) => (
                      <li key={item.fixtureId || `${item.home}-${item.away}`}>
                        <button type="button" className="fixture-row" onClick={() => openMatch(item)}>
                          <span className="fixture-time">پایان</span>
                          <span className="fixture-team fixture-home"><span className="fixture-team-name">{item.home}</span><TeamBadge team={asTeam(item.home, item.homeLogo)} /></span>
                          <span className="fixture-score" dir="ltr">{item.score && item.score !== '- - -' ? faNum(String(item.score).replace(/\s/g, '')) : '-'}</span>
                          <span className="fixture-team fixture-away"><TeamBadge team={asTeam(item.away, item.awayLogo)} /><span className="fixture-team-name">{item.away}</span></span>
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              )) : <p className="live-empty">در این بازه بازی تمام‌شده‌ای نیامد.</p>}
            </section>
          ) : null}

          <section className="live-section" id="live-results">
            <div className="live-controls">
              <div className="live-controls-top">
                <h2>نتایج زنده</h2>
                <span>همهٔ لیگ‌های رایگان LifeOS · {faNum(isoShift(liveDay))}</span>
              </div>
              <div className="live-controls-bottom">
                <nav className="live-day-tabs">
                  {LIVE_DAYS.map((d) => (
                    <button key={d.id} type="button" className={`live-day${liveDay === d.id ? ' is-active' : ''}`} onClick={() => setLiveDay(d.id)}>{d.label}</button>
                  ))}
                </nav>
                <div className="live-options">
                  <div className="live-option">
                    <span>فقط زنده</span>
                    <button type="button" role="switch" aria-checked={liveOnly} className={`toggle-switch${liveOnly ? ' is-on' : ''}`} onClick={() => setLiveOnly((v) => !v)}><span /></button>
                  </div>
                </div>
              </div>
            </div>
            <div className="live-groups">
              {(() => {
                const groups = liveLeagues.map((g) => ({
                  ...g,
                  items: (g.items || []).filter((m) => !liveOnly || m.status === 'live'),
                })).filter((g) => g.items.length)
                if (!groups.length) return <div className="live-empty">{liveOnly ? 'در این روز مسابقهٔ زنده‌ای نیست.' : 'برای این روز بازی‌ای از سرویس نیامد.'}</div>
                return groups.map((group) => (
                  <div className="live-competition" key={group.id}>
                    <div className="live-competition-heading">
                      <span className="live-competition-name"><span>{group.name}</span></span>
                      <span className="live-competition-date">{faNum(isoShift(liveDay))}</span>
                    </div>
                    <ul className="live-match-list">
                      {group.items.map((item, index) => {
                        const home = asTeam(item.home, item.homeLogo)
                        const away = asTeam(item.away, item.awayLogo)
                        const score = parseScore(item.score)
                        return (
                          <li key={item.fixtureId || index}>
                            <button type="button" className="live-match-row" onClick={() => openMatch({ ...item, league: group.name })}>
                              <span className="live-match-time">{item.status === 'live' ? 'زنده' : matchTime(item)}</span>
                              <span className="live-match-team live-match-home"><span>{home.name}</span><TeamBadge team={home} small /></span>
                              <span className="live-match-score" dir="ltr">{score ? `${faNum(score[0])} - ${faNum(score[1])}` : '-'}</span>
                              <span className="live-match-team live-match-away"><TeamBadge team={away} small /><span>{away.name}</span></span>
                            </button>
                          </li>
                        )
                      })}
                    </ul>
                  </div>
                ))
              })()}
            </div>
          </section>

          <footer className="page-footer">
            <span>{league.name}</span>
            <a href="#top">بازگشت به بالا <ArrowLeft size={16} /></a>
          </footer>
        </div>

        {selected ? (
          <div className="dialog-backdrop" onClick={(e) => { if (e.target === e.currentTarget) setSelected(null) }}>
            <div className="match-dialog" role="dialog" aria-modal="true">
              <button type="button" className="dialog-close" onClick={() => setSelected(null)} aria-label="بستن"><X size={21} /></button>
              <p className="dialog-competition">{selected.competition}</p>
              <h2>جزئیات مسابقه</h2>
              <div className="dialog-teams">
                <div><TeamBadge team={selected.home} /><strong>{selected.home.name}</strong></div>
                <span className="dialog-score" dir="ltr">{selected.score ? `${faNum(selected.score[0])} - ${faNum(selected.score[1])}` : '-'}</span>
                <div><TeamBadge team={selected.away} /><strong>{selected.away.name}</strong></div>
              </div>
              <dl className="dialog-details">
                <div><dt>تاریخ</dt><dd>{selected.date}</dd></div>
                <div><dt>زمان</dt><dd>{selected.status === 'finished' ? 'پایان بازی' : selected.status === 'live' ? 'زنده' : selected.time}</dd></div>
              </dl>
            </div>
          </div>
        ) : null}
      </main>
    </div>
  )
}
