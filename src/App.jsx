import { useMemo, useState } from 'react'
import './App.css'
import { TEST_ORDERS } from './triage/testOrders.js'
import { RESIDENTS, buildOrder, buildPlan, fmt } from './triage/engine.js'
import { SEVERITY, TECHS, COMMUNITIES } from './triage/config.js'

const tag = (sev) => SEVERITY[sev]

function App() {
  const [raw, setRaw] = useState(TEST_ORDERS)
  const [state, setState] = useState({}) // per-order manager changes: sevOverride, okReceived
  const [tech, setTech] = useState({}) // per-order reassign
  const [approved, setApproved] = useState({})
  const [tab, setTab] = useState('queue')
  const [msg, setMsg] = useState('')
  const [resId, setResId] = useState('')
  const [showScale, setShowScale] = useState(false)
  const [open, setOpen] = useState({})
  const [site, setSite] = useState('all')

  const allOrders = useMemo(() => raw.map((r) => buildOrder(r, state[r.id])), [raw, state])
  const orders = useMemo(() => allOrders.filter((o) => site === 'all' || (site === 'unassigned' ? !o.community : o.community === site)), [allOrders, site])
  const team = useMemo(() => TECHS.filter((t) => site === 'all' || t.site === site), [site])
  const plan = useMemo(() => buildPlan(orders, tech, team.length ? team : TECHS), [orders, tech, team])
  const countFor = (k) => allOrders.filter((o) => (k === 'unassigned' ? !o.community : o.community === k)).length
  const ranked = [...orders].sort((a, b) => b.sev - a.sev || a.received.localeCompare(b.received))

  const stats = {
    action: orders.filter((o) => o.sev >= 4).length,
    repeat: orders.filter((o) => (o.repeats || 0) >= 3).length,
    vendor: orders.filter((o) => o.vendor).length,
    hold: orders.filter((o) => o.entry.status === 'hold').length,
  }

  const patch = (id, p) => setState((s) => ({ ...s, [id]: { ...s[id], ...p } }))

  function addOrder(e) {
    e.preventDefault()
    if (!msg.trim()) return
    const n = raw.length + 1
    setRaw([...raw, { id: `W${String(n).padStart(2, '0')}`, residentId: resId || null, received: '10:30', text: msg.trim() }])
    setMsg('')
    setResId('')
    setTab('queue')
  }

  const assignedTo = (id) => plan.techs.find((t) => t.jobs.some((j) => j.id === id))?.tech

  return (
    <main className="app">
      <header className="hero">
        <span className="chip">Sample data</span>
        <h1>Maintenance Triage Board</h1>
        <p>What to fix first, who should go, and the smartest route for the day.</p>
        <section className="stats">
          <div className="s-red"><b>{stats.action}</b><span>Do today</span></div>
          <div className="s-amber"><b>{stats.repeat}</b><span>Repeat problems</span></div>
          <div className="s-blue"><b>{stats.vendor}</b><span>May need a vendor</span></div>
          <div className="s-gray"><b>{stats.hold}</b><span>Waiting on OK</span></div>
        </section>
      </header>

      <nav className="sites" aria-label="Site team">
        {[['all', 'All sites', allOrders.length], ...Object.keys(COMMUNITIES).map((k) => [k, k, countFor(k)]), ['unassigned', 'Unit not found', countFor('unassigned')]].map(([k, l, n]) => (
          <button key={k} className={site === k ? 'on' : ''} onClick={() => setSite(k)}>{l} <span>{n}</span></button>
        ))}
      </nav>
      {site !== 'all' && site !== 'unassigned' && (
        <p className="small team">{site} team: {team.map((t) => `${t.name} (${t.skills.filter((x) => x !== 'general').join(', ')})`).join(' · ')}</p>
      )}

      <nav className="tabs">
        {[['queue', 'Priority list'], ['routes', 'Technician routes'], ['new', 'Add request']].map(([k, l]) => (
          <button key={k} className={tab === k ? 'on' : ''} onClick={() => setTab(k)}>{l}</button>
        ))}
      </nav>

      {tab === 'new' && (
        <form className="card" onSubmit={addOrder}>
          <h2>Add a maintenance request</h2>
          <label>Paste the message
            <textarea value={msg} onChange={(e) => setMsg(e.target.value)} rows={4}
              placeholder="e.g. Unit 143: the toilet is overflowing and water is on the floor" />
          </label>
          <label>Resident (optional; if blank we look for a unit number in the message)
            <select value={resId} onChange={(e) => setResId(e.target.value)}>
              <option value="">Find it from the message</option>
              {RESIDENTS.map((r) => <option key={r.id} value={r.id}>{r.community} · Unit {r.unit} · {r.name}</option>)}
            </select>
          </label>
          <button className="primary" type="submit">Triage it</button>
        </form>
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
          {ranked.map((o) => {
            const t = assignedTo(o.id)
            return (
              <article key={o.id} className={`card order ${tag(o.sev).color}`}>
                <div className="row">
                  <span className={`pill ${tag(o.sev).color}`}>{o.sev} · {tag(o.sev).label}</span>
                  <span className="small">{tag(o.sev).sla} · {o.label}</span>
                </div>
                <p className="text">“{o.text}”</p>
                <p className="unit">
                  {o.resident ? <>Unit <b>{o.resident.unit}</b> · {o.resident.name} · {o.community}</> : <b className="warn">Unit NOT FOUND</b>}
                </p>
                <div className="chips">
                  <span className={`chip e-${o.entry.status}`}>
                    {{ emergency: 'Enter now', hold: 'Needs resident OK', ok: 'OK to enter', none: 'No entry needed', unknown: 'Unit unknown' }[o.entry.status]}
                  </span>
                  {o.vendor && <span className="chip c-vendor">Vendor: {o.vendor.vendor}</span>}
                  {(o.repeats || 0) >= 3 && <span className="chip c-repeat">Repeat ×{o.repeats}</span>}
                  {o.resident?.pets && <span className="chip">🐾 {o.resident.pets.split(' - ')[0]}</span>}
                  {t && <span className="chip c-tech">{t.name}</span>}
                </div>
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
                <div className="row actions">
                  <select aria-label="Change priority" value={state[o.id]?.sevOverride || o.sev}
                    onChange={(e) => patch(o.id, { sevOverride: Number(e.target.value) })}>
                    {[5, 4, 3, 2, 1].map((n) => <option key={n} value={n}>Priority {n}: {tag(n).label}</option>)}
                  </select>
                  <select aria-label="Reassign" value={tech[o.id] || ''} onChange={(e) => setTech({ ...tech, [o.id]: e.target.value || undefined })}>
                    <option value="">{t ? `Auto: ${t.name}` : 'Auto-assign'}</option>
                    {team.map((x) => <option key={x.id} value={x.id}>{x.name} ({x.site})</option>)}
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
        </>
      )}

      {tab === 'routes' && (
        <>
          {site !== 'unassigned' && <p className="small">Plan saves about <b>{Math.round(plan.saved)} minutes</b> of driving compared with working requests in the order they came in, while handling emergencies first. The manager has the final say.</p>}
          {(site === 'unassigned' ? [] : plan.techs).map(({ tech: t, plan: p, byHand }) => (
            <section key={t.id} className="card">
              <h2>{t.name} <span className="small">· {t.site} · {t.skills.join(', ')}</span></h2>
              <p className="small">{p.stops.length} jobs · {Math.round(p.drive)} min driving (by hand: {Math.round(byHand.drive)}) · done around {fmt(p.finish)}</p>
              <ol className="route">
                {p.stops.map(({ job, arrive, done, travel, wait, late }) => (
                  <li key={job.id} className={tag(job.sev).color}>
                    <span className={`pill ${tag(job.sev).color}`}>{job.sev}</span>
                    <b>{fmt(arrive)}</b> Unit {job.resident?.unit || '?'} · {job.label}
                    <div className="small">{job.community || 'Unknown community'} · {travel} min drive{wait > 1 ? ` + ${Math.round(wait)} min wait for resident window` : ''} · until {fmt(done)}</div>
                    {late && <div className="small warn">Runs past end of shift: carry to tomorrow unless the manager says otherwise</div>}
                    {job.vendor && <div className="small">Needs {job.vendor.vendor}: schedule the vendor, tech does the first look only</div>}
                  </li>
                ))}
                {p.stops.length === 0 && <li className="small">No jobs assigned.</li>}
              </ol>
            </section>
          ))}
          {plan.unknown.length > 0 && (
            <section className="card">
              <h2>Unit not found ({plan.unknown.length})</h2>
              <p className="small">No site team yet. The manager confirms the unit with the resident, then re-adds the request with the unit number.</p>
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
      <footer className="small">Made-up technicians, vendors, travel times and requests. Entry-notice rules are assumptions to confirm with McKinley and the lease. This is not legal advice.</footer>
    </main>
  )
}

export default App
