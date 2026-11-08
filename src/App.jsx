import { useMemo, useState } from 'react'
import './App.css'
import {
  TODAY, residents, residentById, interactions, maintenance, buildQueue, assign, fmtSlot,
  repeatProblems, typeOf, CREW,
} from './triage'

const TIER = { urgent: 'Urgent', soon: 'Soon', routine: 'Routine' }
const money = (n) => `$${Number(n).toLocaleString()}`
const day = (ts) => new Date(ts.slice(0, 10) + 'T12:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })

function ResidentChips({ r }) {
  return (
    <div className="chips">
      <span className="chip">{r.community} · {r.unit_type}</span>
      <span className="chip">Entry: {r.preferred_entry_window}{r.permission_to_enter_default === 'N' ? ' · ask first' : ''}</span>
      <span className="chip">Prefers {r.preferred_contact}{r.preferred_language !== 'English' ? ` (${r.preferred_language})` : ''}</span>
      {r.pets !== 'none' && <span className="chip flag">{r.pets}</span>}
    </div>
  )
}

function Job({ job, onDecide, decision }) {
  const [open, setOpen] = useState(false)
  const r = job.resident
  return (
    <article className={`job ${job.tier}`}>
      <div className="head">
        <span className="title">{job.subject}</span>
        <span className={`pill ${job.tier}`}>{TIER[job.tier]}</span>
      </div>
      <p className="meta">{r.first_name} {r.last_name} · {r.resident_id} · {job.type} · {day(job.timestamp)}</p>
      <p className="why"><b>Why here:</b> {job.reasons.length ? job.reasons.join('. ') + '.' : 'Standard request with no repeat history.'}</p>
      <div className="chips">
        {job.flags.map((f) => <span key={f} className="chip flag">{f}</span>)}
        <span className="chip">Score {job.score}</span>
      </div>
      <ResidentChips r={r} />
      {r.notes_for_staff && <p className="note">Staff note: {r.notes_for_staff}</p>}
      <p className="suggest">
        {job.crew ? <>Suggested: <b>{job.crew.name}</b> ({job.crew.trade}), {fmtSlot(job.slot)}</> : <>Suggested: <b>No visit.</b> Reply or call the resident, and get a manager decision.</>}
      </p>
      {open && <pre className="text">{job.full_text}</pre>}
      <div className="actions">
        {decision ? <span className="pill ok">{decision}</span> : (
          <>
            <button className="primary" onClick={() => onDecide(job.interaction_id, job.crew ? `Assigned to ${job.crew.name}` : 'Sent to manager')}>
              {job.crew ? 'Approve and assign' : 'Send to manager'}
            </button>
            <button onClick={() => onDecide(job.interaction_id, 'Priority changed by manager')}>Override</button>
          </>
        )}
        <button className="link" onClick={() => setOpen(!open)}>{open ? 'Hide conversation' : 'Show conversation'}</button>
      </div>
    </article>
  )
}

function Board() {
  const [extra, setExtra] = useState([])
  const [decisions, setDecisions] = useState({})
  const [form, setForm] = useState({ resident_id: 'R001', text: '' })
  const queue = useMemo(() => assign(buildQueue(extra)), [extra])
  const counts = { urgent: 0, soon: 0, routine: 0 }
  queue.forEach((q) => counts[q.tier]++)
  const repeats = queue.filter((q) => q.prior >= 1).length
  const noVisit = queue.filter((q) => q.noVisit).length

  const add = (e) => {
    e.preventDefault()
    if (!form.text.trim()) return
    const n = extra.length + 1
    const req = {
      interaction_id: `NEW${n}`, resident_id: form.resident_id, timestamp: `${TODAY} 12:00`, channel: 'portal maintenance request',
      category: 'maintenance', subject: form.text.trim().slice(0, 60), full_text: `Resident: ${form.text.trim()}`, status: 'open', follow_up_needed: 'N',
    }
    req.type = typeOf(req)
    setExtra([...extra, req])
    setForm({ ...form, text: '' })
  }

  return (
    <>
      <section className="strip">
        <div className="stat crit"><b>{counts.urgent}</b><span>Urgent</span></div>
        <div className="stat warn"><b>{counts.soon}</b><span>Soon</span></div>
        <div className="stat"><b>{repeats}</b><span>Repeat problems</span></div>
        <div className="stat"><b>{noVisit}</b><span>May not need a visit</span></div>
      </section>

      <form className="panel add" onSubmit={add}>
        <h2>Try a new request</h2>
        <div className="formrow">
          <label htmlFor="who">Resident</label>
          <select id="who" value={form.resident_id} onChange={(e) => setForm({ ...form, resident_id: e.target.value })}>
            {residents.map((r) => <option key={r.resident_id} value={r.resident_id}>{r.first_name} {r.last_name} ({r.resident_id})</option>)}
          </select>
        </div>
        <div className="formrow">
          <label htmlFor="what">What happened</label>
          <input id="what" value={form.text} placeholder="e.g. Water leaking from the ceiling" onChange={(e) => setForm({ ...form, text: e.target.value })} />
        </div>
        <button className="primary" type="submit">Rank it</button>
      </form>

      <div className="cols">
        <section className="stack">
          <div><h2>Ranked queue</h2><p className="note">Open requests plus anything from the last 14 days. Suggestions only, the manager decides.</p></div>
          {queue.map((j) => <Job key={j.interaction_id} job={j} decision={decisions[j.interaction_id]} onDecide={(id, d) => setDecisions({ ...decisions, [id]: d })} />)}
        </section>
        <aside className="stack">
          <div><h2>Suggested crew split</h2><p className="note">Example crew (made up). Times follow each resident's entry window.</p></div>
          <div className="panel">
            {CREW.map((c) => {
              const jobs = queue.filter((q) => q.crew?.name === c.name)
              return (
                <div className="crewrow" key={c.name}>
                  <div><b>{c.name}</b> <span className="note">{c.trade}</span></div>
                  {jobs.length ? jobs.map((j) => <div className="note" key={j.interaction_id}>{fmtSlot(j.slot)} · {j.subject} ({j.resident.resident_id})</div>) : <div className="note">Nothing assigned</div>}
                </div>
              )
            })}
          </div>
        </aside>
      </div>
    </>
  )
}

function Repeats() {
  const list = useMemo(() => repeatProblems(), [])
  const max = list[0].items.length
  return (
    <div className="stack">
      <div><h2>Repeat problems</h2><p className="note">Same resident, same kind of problem, two or more times. Only maintenance rows in the sample are counted, so real counts are higher.</p></div>
      {list.map((p) => (
        <article className="panel" key={p.resident.resident_id + p.type}>
          <div className="head"><span className="title">{p.resident.first_name} {p.resident.last_name} · {p.type}</span><span className="pill warn">{p.items.length} requests</span></div>
          <div className="bar"><i style={{ width: `${(p.items.length / max) * 100}%` }} /></div>
          <p className="note">{p.resident.community} · {p.resident.work_orders_last_12mo} work orders in the last 12 months</p>
          <ul className="timeline">
            {p.items.map((i) => <li key={i.interaction_id}><span className="note">{day(i.timestamp)}</span> {i.subject} {i.status === 'open' && <span className="pill crit">open</span>}</li>)}
          </ul>
        </article>
      ))}
    </div>
  )
}

function Residents() {
  const [q, setQ] = useState('')
  const [sel, setSel] = useState('R001')
  const list = residents.filter((r) => `${r.first_name} ${r.last_name} ${r.community} ${r.resident_id}`.toLowerCase().includes(q.toLowerCase()))
  const r = residentById[sel]
  const hist = interactions.filter((i) => i.resident_id === sel).sort((a, b) => b.timestamp.localeCompare(a.timestamp))
  return (
    <div className="cols">
      <section className="stack">
        <label className="note" htmlFor="search">Search residents</label>
        <input id="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Name, community, or ID" />
        <div className="list">
          {list.map((x) => (
            <button key={x.resident_id} className={`rrow ${x.resident_id === sel ? 'on' : ''}`} onClick={() => setSel(x.resident_id)}>
              <span><b>{x.first_name} {x.last_name}</b><br /><span className="note">{x.community} · {x.unit_type}</span></span>
              {x.open_work_orders > 0 && <span className="pill crit">{x.open_work_orders} open</span>}
            </button>
          ))}
        </div>
      </section>
      <aside className="stack">
        <div className="panel">
          <h2>{r.first_name} {r.last_name}</h2>
          <p className="note">{r.resident_id} · {r.community}, {r.region} · {r.unit_type} · household of {r.household_size}</p>
          <ResidentChips r={r} />
          <div className="facts">
            <div><span className="note">Rent</span><b>{money(r.monthly_rent)}</b></div>
            <div><span className="note">Balance</span><b>{money(r.current_balance)}</b></div>
            <div><span className="note">Lease ends</span><b>{String(r.lease_end).slice(0, 10)}</b></div>
            <div><span className="note">Renewal</span><b>{r.renewal_status}</b></div>
            <div><span className="note">Work orders (12 mo)</span><b>{r.work_orders_last_12mo}</b></div>
            <div><span className="note">Open</span><b>{r.open_work_orders}</b></div>
          </div>
          <p className="note">Staff note: {r.notes_for_staff}</p>
        </div>
        <h2>History</h2>
        {hist.map((i) => (
          <details className="panel" key={i.interaction_id}>
            <summary><span className="note">{day(i.timestamp)} · {i.channel} · {i.category}</span><br /><b>{i.subject}</b> {i.status === 'open' && <span className="pill crit">open</span>} {i.follow_up_needed === 'Y' && <span className="pill warn">follow-up</span>}</summary>
            <pre className="text">{i.full_text}</pre>
          </details>
        ))}
      </aside>
    </div>
  )
}

const VIEWS = { Board, Repeats, Residents }

export default function App() {
  const [view, setView] = useState('Board')
  const View = VIEWS[view]
  return (
    <div className="app">
      <header className="top">
        <div>
          <span className="tag">Example data · {TODAY} · {maintenance.length} maintenance requests</span>
          <h1>Work Order Triage Board</h1>
        </div>
        <nav aria-label="Views">
          {Object.keys(VIEWS).map((v) => <button key={v} className={v === view ? 'on' : ''} onClick={() => setView(v)}>{v}</button>)}
        </nav>
      </header>
      <main><View /></main>
    </div>
  )
}
