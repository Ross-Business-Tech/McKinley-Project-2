import { useEffect, useMemo, useRef, useState } from 'react'
import './App.css'
import SiteMap from './SiteMap.jsx'
import TechDay from './TechDay.jsx'
import TeamHours from './TeamHours.jsx'
import { readPhotos, photoRecords, assemblePhotos } from './photos.js'
import { statusOf, STATUS_LABEL, timeOf } from './progress.js'
import { useShared, useSyncMode, setWho, signedInEmail } from './shared.js'
import './store.js'
import { formatPhone, load, save } from './util.js'
import { TechEditor, SupervisorsEditor } from './staff/TeamEditors.jsx'
import { RoleChooser } from './staff/StaffSignIn.jsx'
import { pinOf } from './staff/pins.js'
import { SyncChip, TimeOffPanel, SitePicker } from './staff/Bits.jsx'
import { aiRead } from './ai.js'
import Stats from './Stats.jsx'
import { VendorsEditor, VendorRequest } from './Vendors.jsx'
import { PartsList, ResidentUpdate } from './JobExtras.jsx'
import { mapFor, setCustomMaps, buildingsFor, SITE_GEO } from './triage/geo.js'
import { AddSite, MapEditor } from './MapSetup.jsx'
import { mapRecords, assembleMaps } from './mapStore.js'
import { parseLocation } from './triage/location.js'
import { langInfo, workTicket, uiText } from './triage/translate.js'
import { RESIDENTS, buildOrder, buildPlan, fmt, DAYS, isOnCall, isWorking } from './triage/engine.js'
import { SEVERITY, TECHS, DEFAULT_SITES } from './triage/config.js'
import { MANAGERS, hashEmail, passHashOf } from './auth.js'
import Access, { MyPin } from './Access.jsx'
import { PlanningTab, TechPlanned, VendorTracker, Scoreboard } from './Planning.jsx'
import { scoreboard, VENDOR_STATUS, niceDate } from './planning.js'
import { missingInfo, drafts } from './triage/followup.js'
import { buildCaseFile, downloadCaseFile } from './triage/exportCase.js'

const tag = (sev) => SEVERITY[sev]

function App() {
  const syncMode = useSyncMode()
  const [raw, setRaw] = useShared('orders')
  const [state, setState] = useShared('state')
  const [tech, setTech] = useShared('assign')
  const [approved, setApproved] = useShared('approved')
  const [contacted, setContacted] = useShared('contacted')
  const [aiRes, setAiRes] = useShared('ai')
  const [parts, setParts] = useShared('parts')
  const [timeoff, setTimeoff] = useShared('timeoff')
  const [vendors, setVendors] = useShared('vendors')
  const [sitemaps, setSitemaps] = useShared('sitemaps')
  const [feedback] = useShared('feedback')
  const [replies] = useShared('replies')
  const [mapchunks, setMapchunks] = useShared('mapchunks')
  // Site maps uploaded in the app for new properties, rebuilt from their saved pieces.
  const customMaps = useMemo(() => assembleMaps(sitemaps, mapchunks), [sitemaps, mapchunks])
  setCustomMaps(customMaps)
  const saveMap = (name, img) => {
    const { meta, chunkEntries } = mapRecords(name, img, sitemaps[name])
    setMapchunks((c) => ({ ...c, ...chunkEntries }))
    setSitemaps((m) => ({ ...m, [name]: meta }))
  }
  const [email, setEmail] = useState(null)
  const [tab, setTab] = useState('queue')
  const [msg, setMsg] = useState('')
  const [resId, setResId] = useState('')
  const [chatSite, setChatSite] = useState('')
  const [chatUnit, setChatUnit] = useState('')
  const matchUnit = (site, unit) =>
    RESIDENTS.find((r) => r.community === site && String(r.unit).replace(/^0+/, '') === String(unit).trim().replace(/^0+/, ''))?.id || ''
  const [reqPhone, setReqPhone] = useState('')
  const [reqEmail, setReqEmail] = useState('')
  const [showScale, setShowScale] = useState(false)
  const [open, setOpen] = useState({})
  const [handled, setHandled] = useShared('handled')
  const [photometa, setPhotometa] = useShared('photometa')
  const [photochunks, setPhotochunks] = useShared('photochunks')
  const [progress, setProgress] = useShared('progress')
  const [pmHashes, setPmHashes] = useShared('pmHashes')
  const [emailHash, setEmailHash] = useState(null)
  const [rescodes, setRescodes] = useShared('rescodes')
  const [turns, setTurns] = useShared('turns')
  const [pm, setPm] = useShared('pm')
  const [vendorjobs, setVendorjobs] = useShared('vendorjobs')
  // Photos are shared with the team (in pieces, see photos.js) on the team's site.
  const photos = useMemo(() => assemblePhotos(photometa, photochunks), [photometa, photochunks])
  const [newPhotos, setNewPhotos] = useState([])
  const [techDone, setTechDone] = useShared('techDone')
  const [role, setRole] = useState(() => load('mk-role', null))
  const [staffPin, setStaffPin] = useState(() => load('mk-staff-pin', null))
  const [techId, setTechId] = useState(() => load('mk-tech', null))
  const [supId, setSupId] = useState(() => load('mk-sup', null))
  const [sups, setSups] = useShared('sups')
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
  const [sites, setSites] = useShared('sites')
  const [teamsRaw, setTeamsRaw] = useShared('teams')

  // Sign-in: on a members-only or invite-only here.now site, the access gate knows who you are.
  useEffect(() => {
    signedInEmail().then(setEmail)
  }, [])
  useEffect(() => save('mk-role', role), [role])
  useEffect(() => save('mk-staff-pin', staffPin), [staffPin])
  useEffect(() => save('mk-tech', techId), [techId])
  useEffect(() => save('mk-sup', supId), [supId])

  // Days off (requested by technicians) take that weekday out of their shifts and on-call days.
  const allTeams = useMemo(
    () =>
      teamsRaw.map((t) => {
        const off = DAYS.filter((d) => timeoff[`${t.id}|${d}`])
        const wd = t.workDays || ['Mon', 'Tue', 'Wed', 'Thu', 'Fri']
        return { ...t, home: t.sites[0] || '', daysOff: off, workDays: wd.filter((d) => !off.includes(d)), onCallDays: (t.onCallDays || []).filter((d) => !off.includes(d)), usualWorkDays: wd }
      }),
    [teamsRaw, timeoff],
  )

  // Signed in through the here.now gate with an email that's on a team? Open their view directly.
  useEffect(() => {
    if (!email || role) return
    const t = allTeams.find((x) => (x.email || '').toLowerCase() === email)
    const b = sups.find((x) => (x.email || '').toLowerCase() === email)
    if (t) {
      setRole('tech')
      setTechId(t.id)
    } else if (b) {
      setRole('supervisor')
      setSupId(b.id)
    } else {
      const m = emailHash && MANAGERS.find((x) => x.emailHash === emailHash)
      if (m) {
        setRole('supervisor')
        setSupId(`pm:${m.id}`)
      }
    }
  }, [email, emailHash, role, allTeams, sups])
  useEffect(() => {
    if (email) hashEmail(email).then(setEmailHash)
  }, [email])
  const everyOrder = useMemo(() => raw.map((r) => buildOrder(r, state[r.id], aiRes[r.id])), [raw, state, aiRes])

  // AI step: read each request once and save the result for everyone. If the AI connection
  // isn't set up (test links, no key yet), stop after the first failure and use the rules.
  const aiTried = useRef(new Set())
  const aiOff = useRef(false)
  useEffect(() => {
    if (aiOff.current || syncMode === 'starting') return
    const todo = everyOrder.filter((o) => !aiRes[o.id] && !aiTried.current.has(o.id))
    if (!todo.length) return
    let cancelled = false
    ;(async () => {
      for (const o of todo.slice(0, 5)) {
        if (cancelled || aiOff.current) return
        aiTried.current.add(o.id)
        try {
          const r = await aiRead(o)
          if (r) setAiRes((m) => ({ ...m, [o.id]: r }))
        } catch {
          aiOff.current = true
        }
      }
    })()
    return () => {
      cancelled = true
    }
  }, [everyOrder, aiRes, syncMode, setAiRes])
  // Each supervisor sees only their own properties; each property manager only the properties IT gave them.
  // Requests we couldn't match to a property show for everyone, so none get lost.
  const sup = sups.find((x) => x.id === supId) || null
  const mgr = String(supId || '').startsWith('pm:') ? MANAGERS.find((m) => m.id === supId.slice(3)) || null : null
  const mySiteNames = useMemo(() => (sup ? sup.sites : mgr ? mgr.properties : []), [sup, mgr])
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
  // customMaps is read inside buildPlan (through geo.js), so a new or re-marked map re-plans the routes.
  // oxlint-disable-next-line react-hooks/exhaustive-deps
  const plan = useMemo(() => buildPlan(orders, tech, team, schedule), [orders, tech, team, schedule, customMaps])
  // customMaps is read inside buildPlan (through geo.js), so a new or re-marked map re-plans the routes.
  // oxlint-disable-next-line react-hooks/exhaustive-deps
  const fullPlan = useMemo(() => buildPlan(everyOrder, tech, allTeams, schedule), [everyOrder, tech, allTeams, schedule, customMaps])
  const approvedOnRoutes = fullPlan.techs.reduce((n, x) => n + x.plan.stops.filter((st) => approved[st.job.id]).length, 0)
  const addPhotos = (id, list) => {
    if (!list.filter(Boolean).length) return
    const { meta, chunks } = photoRecords(id, list, photometa[id], role === 'tech' ? 'technician' : 'supervisor')
    setPhotochunks((c) => ({ ...c, ...chunks }))
    setPhotometa((m) => ({ ...m, [id]: meta }))
  }
  const statusFor = (o) => statusOf(o.id, { approved, techDone, progress, scheduled: fullPlan.techs.some((t) => t.plan.stops.some((st) => st.job.id === o.id)) })
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
    const newId = `W${Date.now().toString(36).toUpperCase()}`
    if (newPhotos.length) addPhotos(newId, newPhotos)
    setNewPhotos([])
    setRaw([
      ...raw,
      { id: newId, residentId: resId || null, received: '10:30', text: resId || !chatSite ? msg.trim() : `${chatSite} unit ${chatUnit}: ${msg.trim()}`, phone: reqPhone.trim(), email: reqEmail.trim() },
    ])
    setMsg('')
    setResId('')
    setChatSite('')
    setChatUnit('')
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
    ['planning', 'Planning'],
    ['stats', 'Stats'],
    ['teams', 'Teams'],
    ['new', 'Add'],
    ...(role === 'supervisor' && mgr ? [['access', 'Access']] : []),
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
  setWho(role === 'tech' ? allTeams.find((t) => t.id === techId)?.name : sup?.name || (mgr ? `${mgr.area} property manager` : null))
  const isManager = role === 'supervisor' && !!mgr

  // Staff views need a staff sign-in: a verified here.now email on the team, or the person's PIN.
  const meTech = allTeams.find((t) => t.id === techId)
  const emailIs = (x) => !!email && (x?.email || '').toLowerCase() === email
  const staffOk =
    role === 'tech' ? !!meTech && (emailIs(meTech) || pinOf(meTech) === staffPin)
      : role === 'supervisor' ? (mgr ? staffPin === passHashOf(mgr, pmHashes) || (!!emailHash && emailHash === mgr.emailHash) : !!sup && (emailIs(sup) || pinOf(sup) === staffPin))
        : true
  const signOut = () => {
    setRole(null)
    setStaffPin(null)
  }

  if (!role || role === 'resident' || !staffOk || (role === 'tech' && !allTeams.some((t) => t.id === techId)) || (role === 'supervisor' && !sup && !mgr)) {
    return (
      <RoleChooser techs={allTeams} sups={sups} email={email} pmHashes={pmHashes}
        onPick={(r, id, pin) => {
          setRole(r)
          setStaffPin(pin || null)
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
            <button className="switch" onClick={signOut}>Sign out</button>
          </div>
          <SyncChip mode={syncMode} email={email} />
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
        {techTab === 'day' && <TechPlanned tech={me} turns={turns} setTurns={setTurns} pm={pm} setPm={setPm} L={L} />}
        {techTab === 'day' && (
          <TechDay myPin={pinOf(me)} onPin={(p) => { setTeamsRaw(teamsRaw.map((x) => (x.id === me.id ? { ...x, pin: p } : x))); setStaffPin(p) }} me={me.id} techs={allTeams} plan={fullPlan} approved={approved} techDone={techDone} setTechDone={markTechDone}
            addressOf={addressOf} photos={photos} addPhotos={addPhotos} progress={progress} setProgress={setProgress} parts={parts} setParts={setParts} timeoff={timeoff} setTimeoff={setTimeoff} />
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
          <button className="switch" onClick={signOut}>Sign out</button>
        </div>
        <span className="chip">{sup ? `Supervisor · ${sup.name}` : `Property manager · ${mgr?.area}`} · {mySites.length} properties · sample data</span>
        <SyncChip mode={syncMode} email={email} />
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
      <TimeOffPanel team={team} allTeams={allTeams} day={schedule.day} timeoff={timeoff} setTimeoff={setTimeoff} />
      {site === 'all' && <TeamHours techs={team} siteNames={mySiteNames} day={schedule.day} afterHours={schedule.afterHours} />}

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
            <div className="two">
              <label>Property
                <select value={chatSite} onChange={(e) => { setChatSite(e.target.value); setResId(matchUnit(e.target.value, chatUnit)) }} required>
                  <option value="">Choose…</option>
                  {mySites.map((x) => <option key={x.name} value={x.name}>{x.name}</option>)}
                </select>
              </label>
              <label>Unit number
                <input value={chatUnit} onChange={(e) => { setChatUnit(e.target.value.slice(0, 8)); setResId(matchUnit(chatSite, e.target.value)) }} inputMode="numeric" required />
              </label>
            </div>
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
          {isManager && <Scoreboard s={scoreboard({ orders: allOrders, approved, progress, techDone, feedback, vendorjobs, plan })} />}
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
                      {schedule.afterHours && assignedTo(o.id)?.phone && (
                        <a className="btn mini" href={`sms:${assignedTo(o.id).phone}?&body=${encodeURIComponent(`📟 EMERGENCY ${o.id}: ${o.label} at ${addressOf(o) || o.community}${o.resident ? `, Bldg ${o.resident.building} Unit ${o.resident.unit}` : ''}. Open your Maintenance Hub "My day" for details.`)}`}>📟 Page {assignedTo(o.id).name}</a>
                      )}
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
                {(replies[o.id] || []).map((r, i) => <p key={i} className="small reply">💬 Resident: “{r.text}”</p>)}
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
                  {vendorjobs[o.id]?.status && <span className="chip c-vendor">Vendor {VENDOR_STATUS[vendorjobs[o.id].status]?.toLowerCase()}{vendorjobs[o.id].date ? ` · ${niceDate(vendorjobs[o.id].date)}` : ''}</span>}
                  {o.ai && <span className="chip c-ai" title={o.ai.reason}>🤖 AI read{o.ai.visit_needed === 'maybe_not' ? ': may not need a visit' : ''}</span>}
                  {(parts[o.id] || []).length > 0 && <span className="chip">🔩 {parts[o.id].length} part{parts[o.id].length > 1 ? 's' : ''}</span>}
                  {(o.repeats || 0) >= 3 && <span className="chip c-repeat">Repeat ×{o.repeats}</span>}
                  {o.resident?.pets && <span className="chip">🐾 {o.resident.pets.split(' - ')[0]}</span>}
                  {t && <span className="chip c-tech">{t.name}</span>}
                  {techDone[o.id] && <span className="chip e-ok">✓ Done by {techDone[o.id].by}{techDone[o.id].at ? ` · ${timeOf(techDone[o.id].at)}` : ''}</span>}
                  {!techDone[o.id] && approved[o.id] && (() => {
                    const st = statusFor(o)
                    return <span className={`chip status-${st.key}`}>{STATUS_LABEL[st.key]}{st.at ? ` · ${timeOf(st.at)}` : ''}</span>
                  })()}
                  {feedback[o.id] && (feedback[o.id].ok
                    ? <span className="chip e-ok">Resident: fixed ✓</span>
                    : <span className="chip e-emergency">Resident: still a problem</span>)}
                  {(replies[o.id] || []).length > 0 && <span className="chip c-missing">💬 {replies[o.id].length} resident repl{replies[o.id].length > 1 ? 'ies' : 'y'}</span>}
                  {o.from === 'resident' && <span className="chip">From resident app</span>}
                  {plan.deferred.some((x) => x.id === o.id) && <span className="chip">Waits for regular hours</span>}
                  {plan.unstaffed.some((x) => x.id === o.id) && <span className="chip e-emergency">No one scheduled{o.sev >= 4 && supervisorOf(o.community) ? `: ${supervisorOf(o.community).name} decides` : ''}</span>}
                  {approved[o.id] && t && !techDone[o.id] && <span className="chip">Sent to {t.name}'s day</span>}
                </div>
                {(photos[o.id] || []).length > 0 && (
                  <div className="thumbs">{photos[o.id].map((p, i) => <a key={i} href={p.src} target="_blank" rel="noreferrer" title={p.by ? `Added by ${p.by}` : ''}><img src={p.src} alt={`Photo ${i + 1}${p.by ? ` from ${p.by}` : ''}`} /></a>)}</div>
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
                    {o.vendor && <VendorRequest order={o} vendors={vendors} sites={sites} />}
                    {o.vendor && <VendorTracker orderId={o.id} vendorjobs={vendorjobs} setVendorjobs={setVendorjobs} vendors={vendors} />}
                    {o.ai && (
                      <p className="aibox">🤖 <b>AI reading</b>: likely cause: {o.ai.likely_cause}
                        {o.ai.visit_needed === 'maybe_not' && <> · <b>may not need a visit</b>{o.ai.resident_tip ? `: try "${o.ai.resident_tip}"` : ''}</>}
                        {o.ai.hidden_risks?.length > 0 && <> · watch for: {o.ai.hidden_risks.join(', ')}</>}
                        {o.ai.english_translation && <><br />In English: “{o.ai.english_translation}”</>}
                      </p>
                    )}
                    {o.flags.map((f) => <p key={f}>⚑ {f}</p>)}
                    <p>Bring: {o.bring.join(', ')} · about {o.mins} min</p>
                    <PartsList id={o.id} parts={parts} setParts={setParts} suggestions={o.bring} />
                  </div>
                )}
                {techDone[o.id] && <ResidentUpdate order={o} siteName={o.community} />}
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
                    {[5, 4, 3, 2, 1].map((n) => <option key={n} value={n}>{n} · {tag(n).label}</option>)}
                  </select>
                  <select aria-label="Reassign" value={tech[o.id] || ''} onChange={(e) => setTech({ ...tech, [o.id]: e.target.value || undefined })}>
                    <option value="">{t ? `Auto: ${t.name}` : 'Auto-assign'}</option>
                    {team.map((x) => <option key={x.id} value={x.id}>{x.name} ({x.sites.join(', ')})</option>)}
                  </select>
                  {o.entry.status === 'hold' && (
                    <button onClick={() => patch(o.id, { okReceived: !o.okReceived })}>{o.okReceived ? 'OK received ✓' : 'Resident said OK'}</button>
                  )}
                  <button className={approved[o.id] ? 'done' : 'primary'} onClick={() => setApproved({ ...approved, [o.id]: approved[o.id] ? undefined : new Date().toISOString() })}>
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

      {tab === 'access' && isManager && (
        <Access techs={teamsRaw} setTechs={setTeamsRaw} sups={sups} setSups={setSups} residents={RESIDENTS}
          rescodes={rescodes} setRescodes={setRescodes} pinOf={pinOf} siteNames={mySiteNames} pmHash={passHashOf(mgr, pmHashes)}
          setPmHash={(h) => { setPmHashes({ ...pmHashes, [mgr.id]: h }); setStaffPin(h) }} />
      )}
      {tab === 'access' && !isManager && <p className="notice">Only the property manager can manage PINs.</p>}

      {tab === 'planning' && (
        <PlanningTab siteNames={mySiteNames} sites={sites} techs={allTeams} turns={turns} setTurns={setTurns} pm={pm} setPm={setPm} supervisorName={sup?.name || `${mgr?.area} property manager`} />
      )}

      {tab === 'stats' && <Scoreboard s={scoreboard({ orders: allOrders, approved, progress, techDone, feedback, vendorjobs, plan })} />}
      {tab === 'stats' && <Stats orders={allOrders} siteNames={mySiteNames} techDone={techDone} parts={parts} />}

      {tab === 'routes' && (
        <>
          {plan.afterHours && <p className="notice small">📟 After-hours plan for {schedule.day}: on-call technicians only, from 5 PM.</p>}
          <div className="card">
            <h2>Evaluate this day</h2>
            <p className="small">Saves a file the separate Plan Evaluator can grade. It does not change anything here.</p>
            {fullPlan.techs.length === 0 ? (
              <p className="small">Nobody is on duty for this day and shift, so there is no plan to export.</p>
            ) : (
              <div className="row">
                <button className="primary" disabled={approvedOnRoutes === 0}
                  onClick={() => downloadCaseFile(buildCaseFile({ plan: fullPlan, orders: everyOrder, schedule, sites, approved }), 'technician-days-for-evaluation.json')}>
                  Export approved technician days ({approvedOnRoutes} {approvedOnRoutes === 1 ? 'job' : 'jobs'})
                </button>
                <button onClick={() => downloadCaseFile(buildCaseFile({ plan: fullPlan, orders: everyOrder, schedule, sites }), 'board-suggestions-for-evaluation.json')}>
                  Export the board's suggestions
                </button>
              </div>
            )}
            <p className="small">“Approved technician days” is what every technician sees in My day after the supervisor approves, including any reassignments. Jobs not approved yet are listed as on hold. Approve jobs in the Priority tab first.</p>
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
                    <b>{fmt(arrive)}</b> {approved[job.id] && <span className={`chip status-${statusFor(job).key}`}>{STATUS_LABEL[statusFor(job).key]}</span>} {job.resident?.building ? `Bldg ${job.resident.building} · ` : ''}Unit {job.resident?.unit || '?'} · {job.label}
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
              <ul>{plan.unknown.map((o) => <li key={o.id}>{o.label}: “{o.text}”</li>)}</ul>
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
          {sup && <MyPin current={pinOf(sup)} onSet={(p) => { setSups(sups.map((x) => (x.id === sup.id ? { ...x, pin: p } : x))); setStaffPin(p) }} />}
          <SupervisorsEditor sups={sups} setSups={setSups} sites={sites} onlySites={mySiteNames} />
          <VendorsEditor vendors={vendors} setVendors={setVendors} areas={[...new Set(sites.map((x) => x.market).filter(Boolean))]} formatPhone={formatPhone} />
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
              {s.address && <p className="small">{s.address}, {s.city} {s.zip || ''}{s.beds ? ` · ${s.beds}` : ''}</p>}
              <MapEditor siteName={s.name} map={customMaps[s.name]} builtIn={SITE_GEO[s.name]?.map ? buildingsFor(s.name).length : 0}
                onUpload={(img) => saveMap(s.name, img)}
                onSave={(p) => setSitemaps({ ...sitemaps, [s.name]: { ...sitemaps[s.name], ...p } })} />
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
          <AddSite existing={sites} markets={[...new Set(sites.map((x) => x.market).filter(Boolean))]}
            onAdd={(s, img) => {
              setSites([...sites, s])
              saveMap(s.name, img)
              if (sup) setSups(sups.map((x) => (x.id === sup.id ? { ...x, sites: [...x.sites, s.name] } : x)))
              setTeamSite(s.name)
            }} />
          <button className="link" onClick={() => { setSites(DEFAULT_SITES); setTeamsRaw(TECHS) }}>Reset sites and teams to the sample setup</button>
        </>
      )}
      <footer className="small">Made-up technicians, vendors, travel times and requests. Entry-notice rules are assumptions to confirm with McKinley and the lease. This is not legal advice.</footer>
      </div>
      </div>
    </main>
  )
}

export default App
