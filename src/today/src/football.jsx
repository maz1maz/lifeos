import { useEffect, useMemo, useRef, useState } from 'react'
import { Check, ChevronDown, X } from 'lucide-react'
import './football.css'

const api = async (url, options) => {
  const response = await fetch(url, { credentials: 'include', ...options, headers: { 'Content-Type': 'application/json', ...(options?.headers || {}) } })
  const body = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(body.error || 'دریافت اطلاعات ناموفق بود.')
  return body
}

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
  const [standings, setStandings] = useState([])
  const [matches, setMatches] = useState([])
  const [loading, setLoading] = useState(false)
  const [notice, setNotice] = useState('')
  const [selected, setSelected] = useState(null)
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
    if (!menuOpen) return
    const onDown = (e) => { if (!selectorRef.current?.contains(e.target)) setMenuOpen(false) }
    document.addEventListener('pointerdown', onDown)
    return () => document.removeEventListener('pointerdown', onDown)
  }, [menuOpen])

  const grouped = useMemo(() => {
    const map = new Map()
    for (const m of matches) {
      const key = String(m.date || '').slice(0, 10) || '—'
      if (!map.has(key)) map.set(key, [])
      map.get(key).push(m)
    }
    return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0]))
  }, [matches])

  const upcoming = useMemo(
    () => grouped.map(([day, list]) => [day, list.filter((m) => m.status !== 'finished')]).filter(([, list]) => list.length),
    [grouped]
  )
  const finished = useMemo(
    () => grouped.map(([day, list]) => [day, list.filter((m) => m.status === 'finished')]).filter(([, list]) => list.length).reverse(),
    [grouped]
  )

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
            </div>
          </header>

          {notice ? <div className="notice">{notice} <button type="button" onClick={() => setNotice('')}>×</button></div> : null}
          {loading ? <p className="live-empty">در حال دریافت داده…</p> : null}

          <section className="league-body">
            <div className="league-layout">
              <aside className="matches-column">
                <div className="matches-block">
                  <h3>برنامهٔ بازی‌های آینده</h3>
                  {upcoming.length ? upcoming.map(([day, list]) => (
                    <div className="fixture-group" key={day}>
                      <div className="fixture-date"><span>{faNum(day)}</span></div>
                      <ul className="fixture-list">
                        {list.map((item) => {
                          const home = asTeam(item.home, item.homeLogo)
                          const away = asTeam(item.away, item.awayLogo)
                          const score = item.status === 'live' ? parseScore(item.score) : null
                          return (
                            <li key={item.fixtureId || `${item.home}-${item.away}-${item.date}`}>
                              <button type="button" className="fixture-row" onClick={() => openMatch(item)}>
                                <span className="fixture-time">{item.status === 'live' ? 'زنده' : matchTime(item)}</span>
                                <span className="fixture-team fixture-home">
                                  <span className="fixture-team-name">{home.name}</span>
                                  <TeamBadge team={home} small />
                                </span>
                                <span className="fixture-score" dir="ltr">{score ? `${faNum(score[0])} - ${faNum(score[1])}` : <span>-</span>}</span>
                                <span className="fixture-team fixture-away">
                                  <TeamBadge team={away} small />
                                  <span className="fixture-team-name">{away.name}</span>
                                </span>
                              </button>
                            </li>
                          )
                        })}
                      </ul>
                    </div>
                  )) : <p className="live-empty">بازی آینده‌ای برای این لیگ نیامد.</p>}
                </div>

                <div className="matches-block">
                  <h3>بازی‌های قبل</h3>
                  {finished.length ? finished.map(([day, list]) => (
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
                                <span className="fixture-time">پایان</span>
                                <span className={`fixture-team fixture-home${homeLost ? ' team-muted' : ''}`}>
                                  <span className="fixture-team-name">{home.name}</span>
                                  <TeamBadge team={home} small />
                                </span>
                                <span className="fixture-score" dir="ltr">
                                  {score ? <><span className={homeLost ? 'score-muted' : ''}>{faNum(score[0])}</span><span className="score-separator">-</span><span className={awayLost ? 'score-muted' : ''}>{faNum(score[1])}</span></> : <span>-</span>}
                                </span>
                                <span className={`fixture-team fixture-away${awayLost ? ' team-muted' : ''}`}>
                                  <TeamBadge team={away} small />
                                  <span className="fixture-team-name">{away.name}</span>
                                </span>
                              </button>
                            </li>
                          )
                        })}
                      </ul>
                    </div>
                  )) : <p className="live-empty">بازی تمام‌شده‌ای برای این بازه نیامد.</p>}
                </div>
              </aside>

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
            </div>
          </section>
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
