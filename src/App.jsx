import { useEffect, useMemo, useState } from 'react'
import './App.css'
import SiteMap from './SiteMap.jsx'
import TechDay from './TechDay.jsx'
import { readPhotos } from './photos.js'
import { mapFor } from './triage/geo.js'
import { parseLocation } from './triage/location.js'
import { LANGS, langInfo, workTicket, uiText } from './triage/translate.js'
import { TEST_ORDERS } from './triage/testOrders.js'
import { RESIDENTS, buildOrder, buildPlan, fmt, DAYS, isOnCall, isWorking } from './triage/engine.js'
import { SEVERITY, TECHS, DEFAULT_SITES, DEFAULT_SUPERVISORS } from './triage/config.js'
import { SKILLS, missingInfo, drafts } from './triage/followup.js'
import { buildCaseFile, downloadCaseFile } from './triage/exportCase.js'

const tag = (sev) => SEVERITY[sev]
// Phone numbers: digits only, 10 of them, dashes added as you type (123-456-7890).
const formatPhone = (v) => {
  const d = v.replace(/\D/g, '').slice(0, 10)
  return [d.slice(0, 3), d.slice(3, 6), d.slice(6)].filter(Boolean).join('-')
}

function load(key, fallback) {
  try {
    const v = JSON.parse(localStorage.getItem(key))
    return v || fallback
  } catch {
    return fallback
  }
}
function save(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch {
    /* private mode: fine, just don't remember */
  }
}

function App() {
  const [raw, setRaw] = useState(TEST_ORDERS)
  const [state, setState] = useState({})
  const [tech, setTech] = useState({})
  const [approved, setApproved] = useState({})
  const [contacted, setContacted] = useState({})
  const [tab, setTab] = useState('queue')
  const [msg, setMsg] = useState('')
  const [resId, setResId] = useState('')
  const [reqPhone, setReqPhone] = useState('')
  const [reqEmail, setReqEmail] = useState('')
  const [showScale, setShowScale] = useState(false)
  const [open, setOpen] = useState({})
  const [handled, setHandled] = useState({})
  const [photos, setPhotos] = useState({})
  const [newPhotos, setNewPhotos] = useState([])
  const [techDone, setTechDone] = useState({})
  const [role, setRole] = useState(() => load('mk-role', null))
  const [techId, setTechId] = useState(() => load('mk-tech', null))
  const [supId, setSupId] = useState(() => load('mk-sup', null))
  const [sups, setSups] = useState(() => load('mk-sups-v1', DEFAULT_SUPERVISORS))
  const [techTab, setTechTab] = useState('day')
  const [techSite, setTechSite] = useState(null)
  // Which day and shift we're planning for. Starts from the real clock: evenings and weekends are on-call time.
  const [schedule, setSchedule] = useState(() => {
    const now = new Date()
    const day = DAYS[now.getDay()]
    const h = now.getHours()
    return { day, afterHours: h < 8 || h >= 17 || day === 'Sat' || day === 'Sun' }
  })
  const [site, setSite] = useState('all')
  const [teamSite, setTeamSite] = useState('Evergreen')
  const [sites, setSites] = useState(() => load('mk-sites-v2', DEFAULT_SITES))
  const [teamsRaw, setTeamsRaw] = useState(() => load('mk-teams-v5', TECHS))

  useEffect(() => save('mk-sites-v2', sites), [sites])
  useEffect(() => save('mk-teams-v5', teamsRaw), [teamsRaw])
  useEffect(() => save('mk-role', role), [role])
  useEffect(() => save('mk-tech', techId), [techId])
  useEffect(() => save('mk-sup', supId), [supId])
  useEffect(() => save('mk-sups-v1', sups), [sups])

  const allTeams = useMemo(() => teamsRaw.map((t) => ({ ...t, home: t.sites[0] || '' })), [teamsRaw])
  const everyOrder = useMemo(() => raw.map((r) => buildOrder(r, state[r.id])), [raw, state])
  // Each supervisor sees only their own properties. "Regional view" sees all of them.
  // Requests we couldn't match to a property show for everyone, so none get lost.
  const sup = sups.find((x) => x.id === supId) || null
  const mySiteNames = useMemo(() => (sup ? sup.sites : sites.map((x) => x.name)), [sup, sites])
  const mySites = sites.filter((x) => mySiteNames.includes(x.name))
  const allOrders = useMemo(() => everyOrder.filter((o) => !o.community || mySiteNames.includes(o.community)), [everyOrder, mySiteNames])
  // Teams tab opens on: the site you picked, else the one you last edited, else your first site that has a team.
  const teamSiteEff = mySiteNames.includes(teamSite) ? teamSite
    : (mySiteNames.find((n) => teamsRaw.some((t) => t.sites.includes(n))) || mySiteNames[0])
  const supervisorOf = (siteName) => sups.find((x) => x.sites.includes(siteName))
  const orders = useMemo(
    () => allOrders.filter((o) => site === 'all' || (site === 'unassigned' ? !o.community : o.community === site)),
    [allOrders, site],
  )
  const team = useMemo(() => allTeams.filter((t) => (site === 'all' ? t.sites.some((x) => mySiteNames.includes(x)) : t.sites.includes(site))), [allTeams, site, mySiteNames])
  const plan = useMemo(() => buildPlan(orders, tech, team, schedule), [orders, tech, team, schedule])
  const fullPlan = useMemo(() => buildPlan(everyOrder, tech, allTeams, schedule), [everyOrder, tech, allTeams, schedule])
  const addPhotos = (id, list) => list.length && setPhotos((p) => ({ ...p, [id]: [...(p[id] || []), ...list] }))
  const siteInfo = sites.find((x) => x.name === site)
  const countFor = (k) => allOrders.filter((o) => (k === 'unassigned' ? !o.community : o.community === k)).length
  const ranked = [...orders].sort((a, b) => (handled[a.id] ? 1 : 0) - (handled[b.id] ? 1 : 0) || b.sev - a.sev || a.received.localeCompare(b.received))

  const followups = useMemo(
    () =>
      orders
        .map((o) => ({ o, items: missingInfo(o) }))
        .filter((f) => f.items.length)
        .sort((a, b) => b.o.sev - a.o.sev),
    [orders],
  )
  const addressOf = (o) => {
    const st = sites.find((x) => x.name === o.community)
    return st?.address ? `${st.name}, ${st.address}, ${st.city} ${st.zip || ''}`.trim() : null
  }
  const openFollowups = followups.filter((f) => !contacted[f.o.id])

  const stats = {
    action: orders.filter((o) => o.sev >= 4).length,
    missing: openFollowups.length,
    vendor: orders.filter((o) => o.vendor).length,
    hold: orders.filter((o) => o.entry.status === 'hold').length,
  }

  const patch = (id, p) => setState((s) => ({ ...s, [id]: { ...s[id], ...p } }))

  function addOrder(e) {
    e.preventDefault()
    if (!msg.trim()) return
    const n = raw.length + 1
    const newId = `W${String(n).padStart(2, '0')}`
    if (newPhotos.length) setPhotos((p) => ({ ...p, [newId]: newPhotos }))
    setNewPhotos([])
    setRaw([
      ...raw,
      { id: newId, residentId: resId || null, received: '10:30', text: msg.trim(), phone: reqPhone.trim(), email: reqEmail.trim() },
    ])
    setMsg('')
    setResId('')
    setReqPhone('')
    setReqEmail('')
    setTab('followups')
  }

  const assignedTo = (id) => plan.techs.find((t) => t.jobs.some((j) => j.id === id))?.tech

  const updateTech = (id, p) => setTeamsRaw((ts) => ts.map((t) => (t.id === id ? { ...t, ...p } : t)))
  const toggle = (arr, v) => (arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v])

  const TABS = [
    ['queue', 'Priority'],
    ['followups', `Follow-ups${stats.missing ? ` (${stats.missing})` : ''}`],
    ['routes', 'Routes'],
    ['map', 'Map'],
    ['teams', 'Teams'],
    ['new', 'Add'],
  ]

  const markTechDone = (v) => {
    setTechDone(v)
    setHandled((h) => {
      const n = { ...h }
      for (const [k, x] of Object.entries(v)) if (x) n[k] = true
      return n
    })
  }

  // ---------- Who is using the app? ----------
  if (!role || (role === 'tech' && !allTeams.some((t) => t.id === techId)) || (role === 'supervisor' && supId !== 'all' && !sup)) {
    return (
      <RoleChooser techs={allTeams} sups={sups} initialRole={role}
        onPick={(r, id) => {
          setRole(r)
          if (r === 'tech') setTechId(id)
          else setSupId(id)
          setSite('all')
          setTab('queue')
          setTechTab('day')
        }} />
    )
  }

  // ---------- Technician layer: only their own approved jobs ----------
  if (role === 'tech') {
    const me = allTeams.find((t) => t.id === techId)
    const L = uiText(me.lang)
    const mine = fullPlan.techs.find((x) => x.tech.id === me.id)
    const myStops = mine ? mine.plan.stops.filter((st) => approved[st.job.id]) : []
    const mySite = techSite && me.sites.includes(techSite) ? techSite : me.sites[0]
    const myPlan = mine ? { techs: [{ ...mine, plan: { ...mine.plan, stops: myStops } }] } : { techs: [] }
    return (
      <main className="app">
        <header className="hero hero-tech">
          <div className="row between">
            <span className="wordmark">mckinley</span>
            <button className="switch" onClick={() => setRole(null)}>Switch user</button>
          </div>
          <h1>{L.myDay} · {me.name}</h1>
          <p>{me.sites.join(', ')} · {langInfo(me.lang)?.native || 'English'} · {fmt(me.shift[0])}–{fmt(me.shift[1])}</p>
          {supervisorOf(me.home) && (
            <p className="supline">{L.supervisor}: <b>{supervisorOf(me.home).name}</b>{supervisorOf(me.home).phone && <> · <a href={`tel:${supervisorOf(me.home).phone}`}>📞 {supervisorOf(me.home).phone}</a></>}</p>
          )}
          <section className="stats stats3">
            <div><b>{myStops.length}</b><span>{L.jobsToday}</span></div>
            <div><b>{myStops.filter((st) => st.job.sev >= 5).length}</b><span>{L.emergencies}</span></div>
            <div><b>{myStops.filter((st) => techDone[st.job.id]).length}</b><span>{L.done}</span></div>
          </section>
        </header>
        {isOnCall(me, schedule.day) && schedule.afterHours && <p className="notice oncallbanner">{L.onCall}</p>}
        {!(schedule.afterHours ? isOnCall(me, schedule.day) : isWorking(me, schedule.day)) && <p className="notice">{L.offToday}</p>}
        <nav className="tabs">
          {[['day', L.myDay], ['map', L.map]].map(([k, l]) => (
            <button key={k} className={techTab === k ? 'on' : ''} onClick={() => setTechTab(k)}>{l}</button>
          ))}
        </nav>
        {techTab === 'day' && (
          <TechDay me={me.id} techs={allTeams} plan={fullPlan} approved={approved} techDone={techDone} setTechDone={markTechDone}
            addressOf={addressOf} photos={photos} addPhotos={addPhotos} />
        )}
        {techTab === 'map' && (
          <>
            {me.sites.length > 1 && (
              <div className="chips">
                {me.sites.map((x) => <button key={x} className={`chip chipbtn ${x === mySite ? 'sel' : ''}`} onClick={() => setTechSite(x)}>{x}</button>)}
              </div>
            )}
            <SiteMap key={mySite} site={mySite} plan={myPlan} orders={myStops.map((st) => st.job)} />
          </>
        )}
      </main>
    )
  }

  // ---------- Supervisor layer: everything ----------
  return (
    <main className="app">
      <header className="hero">
        <div className="row between">
          <span className="wordmark">mckinley</span>
          <button className="switch" onClick={() => setRole(null)}>Switch user</button>
        </div>
        <span className="chip">Supervisor · {sup ? `${sup.name} · ${mySites.length} properties` : 'Regional view · all properties'} · sample data</span>
        <h1>Maintenance Hub</h1>
        <p>Across McKinley's 49 communities: what to fix first, who should go, and the smartest route for the day.</p>
        <section className="stats">
          <div><b>{stats.action}</b><span>Do today</span></div>
          <div><b>{stats.missing}</b><span>Need follow-up</span></div>
          <div><b>{stats.vendor}</b><span>May need a vendor</span></div>
          <div><b>{stats.hold}</b><span>Waiting on OK</span></div>
        </section>
      </header>

      <div className="layout">
      <aside className="side">
      <div className="sitepick">
        <label>Site team
          <SitePicker value={site} onChange={(v) => { setSite(v); if (v !== "all" && v !== "unassigned") setTeamSite(v) }} sites={mySites} countFor={countFor} extra={[['all', `All sites (${allOrders.length} requests)`], ['unassigned', `Unit not found (${countFor('unassigned')})`]]} />
        </label>
        {siteInfo && <p className="small">{siteInfo.address}, {siteInfo.city} {siteInfo.zip} · Leasing office {siteInfo.phone || 'phone not listed'}</p>}
      </div>
      {site !== 'all' && site !== 'unassigned' && (
        <p className="small team">
          {site} team: {team.length ? team.map((t) => `${t.name} (${t.skills.filter((x) => x !== 'general').join(', ') || 'general'}${t.lang && t.lang !== 'en' ? `; ${langInfo(t.lang)?.name}` : ''})`).join(' · ') : 'no technicians yet. Add them on the Teams tab.'}
        </p>
      )}

      <div className="schedbar">
        <select aria-label="Day" value={schedule.day} onChange={(e) => setSchedule({ ...schedule, day: e.target.value })}>
          {DAYS.map((d) => <option key={d} value={d}>{d}</option>)}
        </select>
        <div className="seg">
          <button className={!schedule.afterHours ? 'on' : ''} onClick={() => setSchedule({ ...schedule, afterHours: false })}>Regular hours</button>
          <button className={schedule.afterHours ? 'on' : ''} onClick={() => setSchedule({ ...schedule, afterHours: true })}>📟 After hours</button>
        </div>
      </div>
      <p className="small oncall">
        {schedule.afterHours ? 'On call' : 'Working'} {schedule.day}{site !== 'all' && site !== 'unassigned' ? ` at ${site}` : ''}:{' '}
        {(() => {
          const who = team.filter((t) => (schedule.afterHours ? isOnCall(t, schedule.day) : isWorking(t, schedule.day)))
          return who.length ? who.map((t) => t.name).join(', ') : <b className="warn">nobody scheduled</b>
        })()}
        {schedule.afterHours && ' · only priority 4–5 jobs go out; the rest wait for regular hours'}
      </p>

      <nav className="tabs">
        {TABS.map(([k, l]) => (
          <button key={k} className={tab === k ? 'on' : ''} onClick={() => setTab(k)}>{l}</button>
        ))}
      </nav>
      </aside>
      <div className="content">

      {tab === 'new' && (
        <form className="card chat" onSubmit={addOrder}>
          <div className="chat-head">
            <span className="avatar">m</span>
            <div><b>McKinley Maintenance</b><span>Here to help, usually within the hour</span></div>
          </div>
          <div className="chat-body">
            <p className="bubble them">Hi there, thanks for reaching out. Tell us what's going on and where, and we'll take it from here.</p>
            {msg.trim() && <p className="bubble me">{msg.trim()}</p>}
            {newPhotos.length > 0 && (
              <div className="bubble me thumbs">{newPhotos.map((p, i) => <img key={i} src={p.src} alt={`Photo ${i + 1}`} />)}</div>
            )}
            {msg.trim() && !resId && (() => {
              const l = parseLocation(msg)
              return (
                <p className="bubble them">
                  {l.building || l.unit || l.site
                    ? <>Got it, that's <b>{[l.site, l.building && `Building ${l.building}`, l.unit && `Unit ${l.unit}`].filter(Boolean).join(', ')}</b>. Is that right?</>
                    : 'Which building and apartment is this for? For example, "Building 11, Unit 4".'}
                </p>
              )
            })()}
          </div>
          <div className="chat-form">
            <label>Your name and apartment
              <select value={resId} onChange={(e) => setResId(e.target.value)} required>
                <option value="">Choose your name and apartment</option>
                {RESIDENTS.map((r) => <option key={r.id} value={r.id}>{r.community} · Unit {r.unit} · {r.name}</option>)}
              </select>
            </label>
            <div className="two">
              <label>Best phone number
                <input value={reqPhone} onChange={(e) => setReqPhone(formatPhone(e.target.value))} placeholder="067-550-2161" inputMode="numeric" pattern="[0-9]{3}-[0-9]{3}-[0-9]{4}" maxLength={12} title="Enter a 10-digit phone number, like 067-550-2161" required />
              </label>
              <label>Email
                <input type="email" value={reqEmail} onChange={(e) => setReqEmail(e.target.value)} placeholder="name@example.com" inputMode="email" required />
              </label>
            </div>
            <label>What can we help you with?
              <textarea value={msg} onChange={(e) => setMsg(e.target.value)} rows={3} required
                placeholder="e.g. Evergreen building eleven unit four: the toilet is overflowing" />
            </label>
            <div className="row photorow">
              <label className="btn photobtn">📷 Add photos (optional)
                <input type="file" accept="image/*" multiple onChange={async (e) => { const list = await readPhotos(e.target.files); setNewPhotos((p) => [...p, ...list].slice(0, 6)); e.target.value = '' }} />
              </label>
              {newPhotos.length > 0 && <button type="button" className="link" onClick={() => setNewPhotos([])}>Remove {newPhotos.length} photo{newPhotos.length > 1 ? 's' : ''}</button>}
            </div>
            <p className="small">A photo helps us bring the right tools, and sometimes fix it without a visit.</p>
            <button className="primary send" type="submit">Send to our team</button>
          </div>
        </form>
      )}

      {tab === 'followups' && (
        <>
          <p className="small notice">
            When a request is missing something, it shows up here with a message already written. Tap Text, Email or Call and it opens that app on your phone with the words filled in. Nothing is sent automatically. Sending on its own would need a texting/email service set up by McKinley IT.
          </p>
          {followups.length === 0 && <section className="card"><p>Nothing missing. Every request has what we need.</p></section>}
          <div className="cardgrid">
          {followups.map(({ o, items }) => {
            const d = drafts(o, items, sites)
            const done = contacted[o.id]
            return (
              <article key={o.id} className={`card order ${tag(o.sev).color} ${done ? 'faded' : ''}`}>
                <div className="row">
                  <span className={`pill ${tag(o.sev).color}`}>{o.sev} · {tag(o.sev).label}</span>
                  <span className="small">{o.label}</span>
                  {d.urgent && !done && <span className="chip e-emergency">Urgent: don't wait for a reply</span>}
                </div>
                <p className="text">“{o.text}”</p>
                <p className="unit">{o.resident ? `Unit ${o.resident.unit} · ${o.resident.name} · ${o.community}` : 'Unit NOT FOUND'}</p>
                <div className="chips">
                  {items.map((i) => <span key={i.key} className="chip c-missing">Missing: {i.label}</span>)}
                </div>
                <div className="draft">
                  <b>Message ready to send{d.spanish ? ' (in Spanish)' : ''}</b>
                  <p>{d.body}</p>
                </div>
                {!d.text && !d.email && <p className="small warn">No phone or email on file for this requester. Alert the leasing office to track them down.</p>}
                <div className="row actions">
                  {d.text && <a className={`btn ${d.channel === 'text' ? 'primary' : ''}`} href={d.text}>Text{d.channel === 'text' ? ' (preferred)' : ''}</a>}
                  {d.email && <a className={`btn ${d.channel === 'email' ? 'primary' : ''}`} href={d.email}>Email{d.channel === 'email' ? ' (preferred)' : ''}</a>}
                  {d.call && <a className={`btn ${d.channel === 'call' ? 'primary' : ''}`} href={d.call}>Call{d.channel === 'call' ? ' (preferred)' : ''}</a>}
                  {d.alert && <a className={`btn ${!d.text && !d.email ? 'primary' : ''}`} href={d.alert}>{d.alertIsCall ? `Call ${d.office.name} to alert them` : `Alert ${d.office.name}`}</a>}
                  {d.alertMissing && <span className="small warn">No leasing office phone or email listed for this site. Add one on the Teams tab.</span>}
                </div>
                {d.callScript && <p className="small">Call notes: {d.callScript}</p>}
                <button className={done ? 'done' : ''} onClick={() => setContacted({ ...contacted, [o.id]: !done })}>
                  {done ? 'Marked as contacted ✓' : 'Mark as contacted'}
                </button>
              </article>
            )
          })}
          </div>
        </>
      )}

      {tab === 'queue' && (
        <>
          <button className="link" onClick={() => setShowScale(!showScale)}>{showScale ? 'Hide' : 'Show'} severity scale</button>
          {showScale && (
            <ul className="scale">
              {[5, 4, 3, 2, 1].map((n) => (
                <li key={n}><span className={`pill ${tag(n).color}`}>{n} · {tag(n).label}</span> <b>{tag(n).sla}.</b> {tag(n).desc}</li>
              ))}
            </ul>
          )}
          <div className="cardgrid">
          {ranked.map((o) => {
            const t = assignedTo(o.id)
            const miss = missingInfo(o)
            return (
              <article key={o.id} className={`card order ${tag(o.sev).color} ${handled[o.id] || techDone[o.id] ? 'faded' : ''}`}>
                <div className="row">
                  <span className={`pill ${tag(o.sev).color}`}>{o.sev} · {tag(o.sev).label}</span>
                  {o.sev >= 5 && !handled[o.id] ? (
                    <>
                      {addressOf(o)
                        ? <a className="btn go" href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(addressOf(o))}&travelmode=driving`} target="_blank" rel="noreferrer">📍 Go now</a>
                        : <span className="go-missing">Address unknown</span>}
                      {(o.resident?.phone || o.phone) && <a className="btn mini" href={`tel:${o.resident?.phone || o.phone}`}>Call</a>}
                      <button className="btn mini" onClick={() => setHandled({ ...handled, [o.id]: true })}>✓ Done</button>
                    </>
                  ) : o.sev >= 5 ? (
                    <button className="chip chipbtn e-ok" onClick={() => setHandled({ ...handled, [o.id]: false })} title="Tap to undo">Handled ✓</button>
                  ) : (
                    <span className="small">{tag(o.sev).sla}</span>
                  )}
                </div>
                <p className="small label">{o.label}{o.sev >= 5 && addressOf(o) && !handled[o.id] ? ` · ${addressOf(o)}` : ''}</p>
                <p className="text">“{o.text}”</p>
                <p className="unit">
                  {o.resident ? <>{o.resident.building && <>Bldg <b>{o.resident.building}</b> · </>}Unit <b>{o.resident.unit}</b> · {o.resident.name} · {o.community}</> : o.loc?.building || o.loc?.unit
                    ? <><b className="warn">Not in our records</b> · read as {[o.loc.site, o.loc.building && `Building ${o.loc.building}`, o.loc.unit && `Unit ${o.loc.unit}`].filter(Boolean).join(', ')}</>
                    : <b className="warn">Unit NOT FOUND</b>}
                </p>
                <div className="chips">
                  <span className={`chip e-${o.entry.status}`}>
                    {{ emergency: 'Enter now', hold: 'Needs resident OK', ok: 'OK to enter', none: 'No entry needed', unknown: 'Unit unknown' }[o.entry.status]}
                  </span>
                  {miss.length > 0 && !contacted[o.id] && <button className="chip c-missing chipbtn" onClick={() => setTab('followups')}>Missing info: follow up</button>}
                  {o.vendor && <span className="chip c-vendor">Vendor: {o.vendor.vendor}</span>}
                  {(o.repeats || 0) >= 3 && <span className="chip c-repeat">Repeat ×{o.repeats}</span>}
                  {o.resident?.pets && <span className="chip">🐾 {o.resident.pets.split(' - ')[0]}</span>}
                  {t && <span className="chip c-tech">{t.name}</span>}
                  {techDone[o.id] && <span className="chip e-ok">✓ Done by {techDone[o.id].by}</span>}
                  {plan.deferred.some((x) => x.id === o.id) && <span className="chip">Waits for regular hours</span>}
                  {plan.unstaffed.some((x) => x.id === o.id) && <span className="chip e-emergency">No one scheduled{o.sev >= 4 && supervisorOf(o.community) ? `: ${supervisorOf(o.community).name} decides` : ''}</span>}
                  {approved[o.id] && t && !techDone[o.id] && <span className="chip">Sent to {t.name}'s day</span>}
                </div>
                {(photos[o.id] || []).length > 0 && (
                  <div className="thumbs">{photos[o.id].map((p, i) => <a key={i} href={p.src} target="_blank" rel="noreferrer"><img src={p.src} alt={`Photo ${i + 1}`} /></a>)}</div>
                )}
                <label className="link photolink">📷 Add photo
                  <input type="file" accept="image/*" multiple onChange={async (e) => { addPhotos(o.id, await readPhotos(e.target.files)); e.target.value = '' }} />
                </label>
                <button className="link" onClick={() => setOpen({ ...open, [o.id]: !open[o.id] })}>{open[o.id] ? 'Hide details' : 'Why this rank & details'}</button>
                {open[o.id] && (
                  <div className="details">
                    <p className="why">Why: {o.reasons.join('. ')}.</p>
                    <p><b>Entry:</b> {o.entry.text}</p>
                    {o.vendor && <p>Likely outside vendor: {o.vendor.vendor}. {o.vendor.why}. (Assumption. Confirm with McKinley.)</p>}
                    {o.flags.map((f) => <p key={f}>⚑ {f}</p>)}
                    <p>Bring: {o.bring.join(', ')} · about {o.mins} min</p>
                  </div>
                )}
                {approved[o.id] && t && (() => {
                  const wt = workTicket(o, t, addressOf(o))
                  const other = wt.lang.code !== 'en'
                  return (
                    <div className="ticket">
                      <p className="ticket-head">
                        Work order for <b>{t.name}</b> · {wt.lang.native}
                        {other && !wt.lang.full && <span className="small"> (shown in English: use Translate below)</span>}
                      </p>
                      {other && (
                        <dl>
                          {wt.lines.map(([k, v], i) => (
                            <div key={i} dir={wt.lang.code === 'ar' ? 'auto' : undefined}><dt>{k}</dt><dd>{v}</dd></div>
                          ))}
                        </dl>
                      )}
                      {!other && <p className="small">{t.name} reads English, so the work order goes as is.</p>}
                      <div className="row">
                        {t.phone && <a className="btn mini" href={`sms:${t.phone}?&body=${encodeURIComponent(wt.text)}`}>Text it to {t.name}</a>}
                        {wt.translateUrl && (
                          <a className="btn mini" href={wt.translateUrl} target="_blank" rel="noreferrer">
                            {wt.lang.full ? 'Translate the resident’s message' : `Translate to ${wt.lang.name}`}
                          </a>
                        )}
                      </div>
                    </div>
                  )
                })()}
                <div className="row actions">
                  <select aria-label="Change priority" value={state[o.id]?.sevOverride || o.sev}
                    onChange={(e) => patch(o.id, { sevOverride: Number(e.target.value) })}>
                    {[5, 4, 3, 2, 1].map((n) => <option key={n} value={n}>Priority {n}: {tag(n).label}</option>)}
                  </select>
                  <select aria-label="Reassign" value={tech[o.id] || ''} onChange={(e) => setTech({ ...tech, [o.id]: e.target.value || undefined })}>
                    <option value="">{t ? `Auto: ${t.name}` : 'Auto-assign'}</option>
                    {team.map((x) => <option key={x.id} value={x.id}>{x.name} ({x.sites.join(', ')})</option>)}
                  </select>
                  {o.entry.status === 'hold' && (
                    <button onClick={() => patch(o.id, { okReceived: !o.okReceived })}>{o.okReceived ? 'OK received ✓' : 'Resident said OK'}</button>
                  )}
                  <button className={approved[o.id] ? 'done' : 'primary'} onClick={() => setApproved({ ...approved, [o.id]: !approved[o.id] })}>
                    {approved[o.id] ? 'Approved ✓' : 'Approve'}
                  </button>
                </div>
              </article>
            )
          })}
          </div>
        </>
      )}

      {tab === 'map' && (site === 'all' || site === 'unassigned') && (
        <section className="card">
          <h2>Pick a site to see its map</h2>
          <p className="small">Sites with open requests:</p>
          <div className="chips">
            {mySites.filter((x) => countFor(x.name) > 0).map((x) => (
              <button key={x.name} className="chip chipbtn" onClick={() => setSite(x.name)}>{x.name} ({countFor(x.name)}){mapFor(x.name) ? '' : ' · no map'}</button>
            ))}
          </div>
        </section>
      )}
      {tab === 'map' && site !== 'all' && site !== 'unassigned' && <SiteMap key={site} site={site} plan={plan} orders={orders} />}

      {tab === 'routes' && (
        <>
          {plan.afterHours && <p className="notice small">📟 After-hours plan for {schedule.day}: on-call technicians only, from 5 PM.</p>}
          <div className="card">
            <button disabled={!fullPlan.techs.length} onClick={() => downloadCaseFile(buildCaseFile({ plan: fullPlan, orders: everyOrder, schedule, sites }))}>Export day for evaluation</button>
            <p className="small">{fullPlan.techs.length ? `Saves ${schedule.day}'s requests and this board's plan (all sites${fullPlan.afterHours ? ', after hours' : ''}) as a file the separate Plan Evaluator can grade. It does not change anything here.` : 'Nobody is on duty for this day and shift, so there is no plan to export.'}</p>
          </div>
          {site !== 'unassigned' && <p className="small">Plan saves about <b>{Math.round(plan.saved)} minutes</b> of driving compared with working requests in the order they came in, while handling emergencies first. The manager has the final say.</p>}
          <div className="cardgrid">
          {(site === 'unassigned' ? [] : plan.techs).map(({ tech: t, plan: p, byHand }) => (
            <section key={t.id} className="card">
              <h2>{t.name} <span className="small">· {langInfo(t.lang)?.native || 'language not set'} · {t.sites.join(', ')} · {t.skills.join(', ')}</span></h2>
              <p className="small">{p.stops.length} jobs · {Math.round(p.drive)} min driving (by hand: {Math.round(byHand.drive)}) · done around {fmt(p.finish)}</p>
              <ol className="route">
                {p.stops.map(({ job, arrive, done, travel, wait, late }) => (
                  <li key={job.id} className={tag(job.sev).color}>
                    <span className={`pill ${tag(job.sev).color}`}>{job.sev}</span>
                    <b>{fmt(arrive)}</b> {job.resident?.building ? `Bldg ${job.resident.building} · ` : ''}Unit {job.resident?.unit || '?'} · {job.label}
                    <div className="small">{job.community || 'Unknown community'} · {travel} min {travel <= 12 ? 'walk' : 'drive'}{wait > 1 ? ` + ${Math.round(wait)} min wait for resident window` : ''} · until {fmt(done)}</div>
                    {late && <div className="small warn">Runs past end of shift: carry to tomorrow unless the manager says otherwise</div>}
                    {job.vendor && <div className="small">Needs {job.vendor.vendor}: schedule the vendor, tech does the first look only</div>}
                  </li>
                ))}
                {p.stops.length === 0 && <li className="small">No jobs assigned.</li>}
              </ol>
            </section>
          ))}
          </div>
          {plan.unstaffed.length > 0 && (
            <section className="card">
              <h2 className="warn">No one scheduled ({plan.unstaffed.length})</h2>
              <p className="small">Nobody is {plan.afterHours ? 'on call' : 'working'} at these properties (or in the same city) on {schedule.day}. Assign someone on the Teams tab or reassign by hand.</p>
              <ul>{plan.unstaffed.map((o) => <li key={o.id}>{o.sev} · {o.label} · {o.community}</li>)}</ul>
            </section>
          )}
          {plan.deferred.length > 0 && (
            <section className="card">
              <h2>Waiting for regular hours ({plan.deferred.length})</h2>
              <p className="small">Not urgent enough to call out the on-call technician. These go on the next regular-hours plan.</p>
              <ul>{plan.deferred.map((o) => <li key={o.id}>{o.sev} · {o.label} · {o.community}</li>)}</ul>
            </section>
          )}
          {plan.unknown.length > 0 && (
            <section className="card">
              <h2>Unit not found ({plan.unknown.length})</h2>
              <p className="small">No site team yet. Use the Follow-ups tab to reach the requester or alert the leasing office.</p>
              <ul>{plan.unknown.map((o) => <li key={o.id}>{o.label}: “{o.text.slice(0, 60)}…”</li>)}</ul>
            </section>
          )}
          {plan.held.length > 0 && (
            <section className="card">
              <h2>Waiting on resident OK ({plan.held.length})</h2>
              <p className="small">Not on anyone's route until the resident gives permission or the notice period has passed.</p>
              <ul>{plan.held.map((o) => <li key={o.id}>Unit {o.resident?.unit} · {o.label}</li>)}</ul>
            </section>
          )}
        </>
      )}

      {tab === 'teams' && (
        <>
          <SupervisorsEditor sups={sups} setSups={setSups} sites={sites} />
          <p className="small notice">Set up each site, who is on its maintenance team, what they are best at, and where they work. Changes are saved on this device and update the routes right away.</p>
          <label>Site
            <SitePicker value={teamSiteEff} onChange={setTeamSite} sites={mySites} countFor={(k) => allTeams.filter((t) => t.sites.includes(k)).length} suffix="technicians" />
          </label>
          {sites.filter((s) => s.name === teamSiteEff).map((s) => (
            <section key={s.name} className="card">
              <div className="row between">
                <h2>{s.name} <span className="small">· {s.city}</span></h2>
                {!DEFAULT_SITES.some((d) => d.name === s.name) && (
                  <button className="link" onClick={() => { setSites(sites.filter((x) => x.name !== s.name)); setTeamsRaw(teamsRaw.map((t) => ({ ...t, sites: t.sites.filter((x) => x !== s.name) }))); setTeamSite('Evergreen') }}>Remove site</button>
                )}
              </div>
              {s.address && <p className="small">{s.address}, {s.city} {s.zip}{s.beds ? ` · ${s.beds}` : ''}</p>}
              <div className="two">
                <label>Leasing office phone
                  <input value={s.phone || ''} onChange={(e) => setSites(sites.map((x) => (x.name === s.name ? { ...x, phone: e.target.value } : x)))} inputMode="tel" />
                </label>
                <label>Leasing office email
                  <input value={s.email || ''} placeholder="add when you have it" onChange={(e) => setSites(sites.map((x) => (x.name === s.name ? { ...x, email: e.target.value } : x)))} inputMode="email" />
                </label>
              </div>
              <h3>Team</h3>
              {allTeams.filter((t) => t.sites.includes(s.name)).length === 0 && <p className="small">No technicians yet for this site.</p>}
              {allTeams.filter((t) => t.sites.includes(s.name)).map((t) => (
                <TechEditor key={t.id} t={teamsRaw.find((x) => x.id === t.id)} sites={sites} update={(p) => updateTech(t.id, p)} toggle={toggle}
                  remove={() => setTeamsRaw(teamsRaw.filter((x) => x.id !== t.id))} />
              ))}
              <button onClick={() => setTeamsRaw([...teamsRaw, { id: `N${Date.now()}`, name: 'New technician', lang: '', phone: '', workDays: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'], onCallDays: [], sites: [s.name], skills: ['general'], shift: [8, 17] }])}>+ Add technician to {s.name}</button>
            </section>
          ))}
          <AddSite onAdd={(s) => { setSites([...sites, s]); setTeamSite(s.name) }} existing={sites} />
          <button className="link" onClick={() => { setSites(DEFAULT_SITES); setTeamsRaw(TECHS) }}>Reset sites and teams to the sample setup</button>
        </>
      )}
      <footer className="small">Made-up technicians, vendors, travel times and requests. Entry-notice rules are assumptions to confirm with McKinley and the lease. This is not legal advice.</footer>
      </div>
      </div>
    </main>
  )
}

function TechEditor({ t, sites, update, toggle, remove }) {
  return (
    <div className="tech">
      <div className="row between">
        <input className="name" value={t.name} onChange={(e) => update({ name: e.target.value })} aria-label="Technician name" />
        <button className="link" onClick={remove}>Remove</button>
      </div>
      <div className="two">
        <label className={t.lang ? '' : 'ask'}>{t.lang ? 'Primary language' : 'Ask them: what is your primary language?'}
          <select value={t.lang || ''} onChange={(e) => update({ lang: e.target.value })}>
            <option value="">Choose…</option>
            {LANGS.map((l) => <option key={l.code} value={l.code}>{l.native === l.name ? l.name : `${l.native} (${l.name})`}</option>)}
          </select>
        </label>
        <label>Mobile number (to text work orders)
          <input value={t.phone || ''} onChange={(e) => update({ phone: formatPhone(e.target.value) })} placeholder="067-550-2161"
            inputMode="numeric" pattern="[0-9]{3}-[0-9]{3}-[0-9]{4}" maxLength={12} title="Enter a 10-digit phone number, like 067-550-2161" />
          {t.phone && t.phone.replace(/\D/g, '').length < 10 && <span className="small warn">Enter all 10 digits</span>}
        </label>
      </div>
      <p className="small">Works on</p>
      <div className="chips">
        {DAYS.map((d) => (
          <button key={d} className={`chip chipbtn ${isWorking(t, d) ? 'sel' : ''}`} onClick={() => update({ workDays: toggle(t.workDays || ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'], d) })}>{d}</button>
        ))}
      </div>
      <p className="small">📟 On call (after hours, 5 PM to midnight)</p>
      <div className="chips">
        {DAYS.map((d) => (
          <button key={d} className={`chip chipbtn ${isOnCall(t, d) ? 'sel oncallchip' : ''}`} onClick={() => update({ onCallDays: toggle(t.onCallDays || [], d) })}>{d}</button>
        ))}
      </div>
      <p className="small">Strengths</p>
      <div className="chips">
        {SKILLS.map((k) => (
          <button key={k} className={`chip chipbtn ${t.skills.includes(k) ? 'sel' : ''}`} onClick={() => update({ skills: toggle(t.skills, k) })}>{k}</button>
        ))}
      </div>
      <p className="small">Works at</p>
      <div className="chips">
        {t.sites.map((n) => (
          <button key={n} className="chip chipbtn sel" title="Tap to remove" onClick={() => update({ sites: t.sites.filter((x) => x !== n) })}>{n} ✕</button>
        ))}
      </div>
      <select aria-label="Add a site" value="" onChange={(e) => e.target.value && update({ sites: [...t.sites, e.target.value] })}>
        <option value="">+ Also covers another site…</option>
        {sites.filter((x) => !t.sites.includes(x.name)).map((x) => <option key={x.name} value={x.name}>{x.name} ({x.city})</option>)}
      </select>
      <div className="two">
        <label>Shift starts
          <select value={t.shift[0]} onChange={(e) => update({ shift: [Number(e.target.value), t.shift[1]] })}>
            {[6, 7, 8, 9, 10].map((h) => <option key={h} value={h}>{fmt(h)}</option>)}
          </select>
        </label>
        <label>Shift ends
          <select value={t.shift[1]} onChange={(e) => update({ shift: [t.shift[0], Number(e.target.value)] })}>
            {[14, 15, 16, 17, 18, 19, 20].map((h) => <option key={h} value={h}>{fmt(h)}</option>)}
          </select>
        </label>
      </div>
    </div>
  )
}

function RoleChooser({ techs, sups, initialRole, onPick }) {
  const [pick, setPick] = useState(initialRole)
  const [who, setWho] = useState(techs[0]?.id || '')
  const [boss, setBoss] = useState(sups[0]?.id || 'all')
  return (
    <main className="app">
      <header className="hero">
        <span className="wordmark">mckinley</span>
        <h1>Maintenance Hub</h1>
        <p>Who's using the app?</p>
      </header>
      <div className={`card rolecard ${pick === 'supervisor' ? 'sel' : ''}`}>
        <button className="rolebtn" onClick={() => setPick('supervisor')}>
          <b>🗂️ Maintenance supervisor</b>
          <span>Every request at the properties you oversee: priorities, follow-ups, routes, site maps, approvals and teams.</span>
        </button>
        {pick === 'supervisor' && (
          <div className="rolepick">
            <label>Your name
              <select value={boss} onChange={(e) => setBoss(e.target.value)}>
                {sups.map((x) => <option key={x.id} value={x.id}>{x.name} · {x.sites.length} properties</option>)}
                <option value="all">Regional view (all properties)</option>
              </select>
            </label>
            <button className="primary" onClick={() => onPick('supervisor', boss)}>Open my sites</button>
          </div>
        )}
      </div>
      <div className={`card rolecard ${pick === 'tech' ? 'sel' : ''}`}>
        <button className="rolebtn" onClick={() => setPick('tech')}>
          <b>🔧 Maintenance technician</b>
          <span>Just your approved jobs for today, in order and in your language.</span>
        </button>
        {pick === 'tech' && (
          <div className="rolepick">
            <label>Your name
              <select value={who} onChange={(e) => setWho(e.target.value)}>
                {techs.map((t) => <option key={t.id} value={t.id}>{t.name} · {t.sites.join(', ')}</option>)}
              </select>
            </label>
            <button className="primary" onClick={() => onPick('tech', who)}>Start my day</button>
          </div>
        )}
      </div>
      <p className="small notice">Prototype: anyone can pick either view. A real version would have each person sign in, so technicians only ever see their own work.</p>
    </main>
  )
}

function SupervisorsEditor({ sups, setSups, sites }) {
  const [open, setOpen] = useState(null)
  const markets = [...new Set(sites.map((x) => x.market || x.city))]
  const upd = (id, p) => setSups(sups.map((x) => (x.id === id ? { ...x, ...p } : x)))
  return (
    <section className="card">
      <h2>Supervisors</h2>
      <p className="small">Each supervisor sees only the properties they oversee. Technicians see their supervisor's name and number.</p>
      {sups.map((x) => (
        <div key={x.id} className="tech">
          <div className="row between">
            <b>{x.name}</b>
            <span className="small">{x.sites.length} properties</span>
            <button className="link" onClick={() => setOpen(open === x.id ? null : x.id)}>{open === x.id ? 'Close' : 'Edit'}</button>
          </div>
          {open === x.id && (
            <>
              <div className="two">
                <label>Name<input value={x.name} onChange={(e) => upd(x.id, { name: e.target.value })} /></label>
                <label>Phone
                  <input value={x.phone || ''} onChange={(e) => upd(x.id, { phone: formatPhone(e.target.value) })} inputMode="numeric" placeholder="067-550-2161" maxLength={12} />
                </label>
              </div>
              <label>Email<input type="email" value={x.email || ''} onChange={(e) => upd(x.id, { email: e.target.value })} /></label>
              <p className="small">Oversees (tap ✕ to remove)</p>
              <div className="chips">
                {x.sites.map((n) => <button key={n} className="chip chipbtn sel" onClick={() => upd(x.id, { sites: x.sites.filter((y) => y !== n) })}>{n} ✕</button>)}
              </div>
              <div className="two">
                <select aria-label="Add a property" value="" onChange={(e) => e.target.value && upd(x.id, { sites: [...x.sites, e.target.value] })}>
                  <option value="">+ Add one property…</option>
                  {sites.filter((y) => !x.sites.includes(y.name)).map((y) => <option key={y.name} value={y.name}>{y.name} ({y.city})</option>)}
                </select>
                <select aria-label="Add a whole area" value="" onChange={(e) => e.target.value && upd(x.id, { sites: [...new Set([...x.sites, ...sites.filter((y) => (y.market || y.city) === e.target.value).map((y) => y.name)])] })}>
                  <option value="">+ Add a whole area…</option>
                  {markets.map((m) => <option key={m} value={m}>{m}</option>)}
                </select>
              </div>
              <button className="link" onClick={() => setSups(sups.filter((y) => y.id !== x.id))}>Remove supervisor</button>
            </>
          )}
        </div>
      ))}
      <button onClick={() => { const id = `SUP-${Date.now()}`; setSups([...sups, { id, name: 'New supervisor', phone: '', email: '', sites: [] }]); setOpen(id) }}>+ Add supervisor</button>
      {(() => {
        const covered = new Set(sups.flatMap((x) => x.sites))
        const gap = sites.filter((y) => !covered.has(y.name))
        return gap.length ? <p className="small warn">No supervisor yet for: {gap.map((y) => y.name).join(', ')}</p> : null
      })()}
    </section>
  )
}

function SitePicker({ value, onChange, sites, countFor, extra = [], suffix = 'requests' }) {
  const markets = [...new Set(sites.map((s) => s.market || s.city))]
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)}>
      {extra.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
      {markets.map((m) => (
        <optgroup key={m} label={m}>
          {sites.filter((s) => (s.market || s.city) === m).map((s) => <option key={s.name} value={s.name}>{s.name} ({countFor(s.name)} {suffix})</option>)}
        </optgroup>
      ))}
    </select>
  )
}

function AddSite({ onAdd, existing }) {
  const [name, setName] = useState('')
  const [city, setCity] = useState('')
  const dup = existing.some((s) => s.name.toLowerCase() === name.trim().toLowerCase())
  return (
    <form className="card" onSubmit={(e) => { e.preventDefault(); if (name.trim() && !dup) { onAdd({ name: name.trim(), market: city.trim(), city: city.trim(), phone: '', email: '' }); setName(''); setCity('') } }}>
      <h2>Add a property not on the list</h2>
      <div className="two">
        <label>Property name<input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Heron Lake" /></label>
        <label>City<input value={city} onChange={(e) => setCity(e.target.value)} placeholder="e.g. Ann Arbor, MI" /></label>
      </div>
      {dup && <p className="small warn">That property is already on the list.</p>}
      <button className="primary" type="submit">Add property</button>
    </form>
  )
}

export default App
