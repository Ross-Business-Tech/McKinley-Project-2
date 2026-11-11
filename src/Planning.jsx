import { useState } from 'react'
import { RESIDENTS } from './triage/engine.js'
import { moveOutCandidates, makeTurn, pmSuggestions, niceDate, daysUntil, todayISO, addDays, VENDOR_STATUS, pickTechFor } from './planning.js'

const resById = Object.fromEntries(RESIDENTS.map((r) => [r.id, r]))
const dueTag = (iso) => {
  const d = daysUntil(iso)
  return d < 0 ? <span className="chip e-emergency">Overdue {-d}d</span> : d === 0 ? <span className="chip e-hold">Today</span> : <span className="chip">{niceDate(iso)}</span>
}

function TechSelect({ techs, site, value, onChange }) {
  const here = techs.filter((t) => t.sites.includes(site))
  return (
    <select className="mini" value={value || ''} onChange={(e) => onChange(e.target.value || null)} aria-label="Assign technician">
      <option value="">Unassigned</option>
      {here.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
    </select>
  )
}

// ---------- Supervisor: Planning tab ----------
const SKILL_LABEL = { general: 'General', hvac: 'HVAC', plumbing: 'Plumbing', electrical: 'Electrical', appliance: 'Appliances', locks: 'Locks' }
const shiftISO = (iso, days) => addDays(iso, days)

// Add a move-out turn by hand (any unit, even one without a resident on file).
function NewTurnForm({ siteNames, onAdd }) {
  const [site, setSite] = useState(siteNames[0] || '')
  const [unit, setUnit] = useState('')
  const [bldg, setBldg] = useState('')
  const [out, setOut] = useState(addDays(todayISO(), 14))
  const [inn, setInn] = useState('')
  const match = RESIDENTS.find((r) => r.community === site && String(r.unit) === unit.trim())
  return (
    <form className="planform" onSubmit={(e) => {
      e.preventDefault()
      if (!site || !unit.trim() || !out) return
      onAdd({ id: match?.id || null, community: site, unit: unit.trim(), building: match?.building || bldg.trim() || '?' }, out, inn || addDays(out, 7))
      setUnit('')
      setBldg('')
    }}>
      <p className="small"><b>Add a move-out</b></p>
      <div className="two">
        <label>Property<select value={site} onChange={(e) => setSite(e.target.value)}>{siteNames.map((n) => <option key={n}>{n}</option>)}</select></label>
        <label>Unit<input value={unit} onChange={(e) => setUnit(e.target.value.slice(0, 8))} required /></label>
        {!match && <label>Building<input value={bldg} onChange={(e) => setBldg(e.target.value.slice(0, 8))} placeholder="if known" /></label>}
        <label>Move-out date<input type="date" value={out} onChange={(e) => setOut(e.target.value)} required /></label>
        <label>Next move-in (optional)<input type="date" value={inn} min={out} onChange={(e) => setInn(e.target.value)} /></label>
      </div>
      {match && <p className="small">Resident on file for this unit; they'll see their walkthrough dates.</p>}
      <button className="primary" type="submit">Create turn checklist</button>
    </form>
  )
}

// Add a preventive maintenance task by hand.
function NewPmForm({ siteNames, techs, onAdd }) {
  const [site, setSite] = useState(siteNames[0] || '')
  const [title, setTitle] = useState('')
  const [skill, setSkill] = useState('general')
  const [due, setDue] = useState(addDays(todayISO(), 14))
  const [tech, setTech] = useState('')
  const units = RESIDENTS.filter((r) => r.community === site)
  const [picked, setPicked] = useState(null) // null = all units
  const chosen = picked || units.map((u) => u.id)
  return (
    <form className="planform" onSubmit={(e) => {
      e.preventDefault()
      if (!title.trim() || !site || !due) return
      onAdd({ site, title: title.trim().slice(0, 120), skill, due, tech: tech || pickTechFor(techs)(site, skill), units: chosen, why: 'Added by hand.' })
      setTitle('')
      setPicked(null)
    }}>
      <p className="small"><b>Add preventive maintenance</b></p>
      <div className="two">
        <label>Property<select value={site} onChange={(e) => { setSite(e.target.value); setPicked(null) }}>{siteNames.map((n) => <option key={n}>{n}</option>)}</select></label>
        <label>Task<input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Dryer vent cleaning" required /></label>
        <label>Skill<select value={skill} onChange={(e) => setSkill(e.target.value)}>{Object.entries(SKILL_LABEL).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></label>
        <label>Due date<input type="date" value={due} onChange={(e) => setDue(e.target.value)} required /></label>
        <label>Technician<TechSelect techs={techs} site={site} value={tech} onChange={(v) => setTech(v || '')} /></label>
      </div>
      <p className="small">Units ({chosen.length} of {units.length}) · tap to include or leave out</p>
      <div className="chips">
        {units.map((u) => (
          <button key={u.id} type="button" className={`chip chipbtn ${chosen.includes(u.id) ? 'sel' : ''}`}
            onClick={() => setPicked(chosen.includes(u.id) ? chosen.filter((x) => x !== u.id) : [...chosen, u.id])}>Bldg {u.building} · {u.unit}</button>
        ))}
        {units.length === 0 && <span className="small">No units on file for this property yet.</span>}
      </div>
      <button className="primary" type="submit" disabled={!chosen.length}>Schedule</button>
    </form>
  )
}

// ---------- Supervisor & property manager: Planning tab ----------
export function PlanningTab({ siteNames, sites, techs, turns, setTurns, pm, setPm, supervisorName }) {
  const [open, setOpen] = useState({})
  const [edit, setEdit] = useState({})
  const [adding, setAdding] = useState(null)
  const [newTask, setNewTask] = useState({})
  const pick = pickTechFor(techs)
  const cands = moveOutCandidates(siteNames)
  const hasTurn = (rid) => Object.values(turns).some((t) => t && t.residentId === rid)
  const myTurns = Object.entries(turns).filter(([, t]) => t && siteNames.includes(t.site)).sort((a, b) => a[1].moveOut.localeCompare(b[1].moveOut))
  const sugg = pmSuggestions(siteNames, sites).filter((s) => !pm[s.key])
  const myPm = Object.entries(pm).filter(([, p]) => p && siteNames.includes(p.site)).sort((a, b) => a[1].due.localeCompare(b[1].due))
  const setTurn = (id, patch) => setTurns({ ...turns, [id]: { ...turns[id], ...patch } })
  const updTask = (id, k, patch) => setTurn(id, { tasks: turns[id].tasks.map((x) => (x.k === k ? { ...x, ...patch } : x)) })
  const addTurn = (r, out, inn) => {
    const t = makeTurn(r, out, pick)
    setTurns({ ...turns, [`T-${r.id || `${r.community}|${r.unit}`}|${out}`]: { ...t, moveIn: inn || t.moveIn } })
  }

  return (
    <>
      <section className="card">
        <div className="row between">
          <h2>Move-outs and make-ready turns</h2>
          <button className="link" onClick={() => setAdding(adding === 'turn' ? null : 'turn')}>{adding === 'turn' ? 'Close' : '+ Add a move-out'}</button>
        </div>
        <p className="small">Residents who gave notice or whose lease ends soon without a renewal. Planning a turn creates the whole checklist, assigned to the right technicians. Everything can be edited afterwards.</p>
        {adding === 'turn' && <NewTurnForm siteNames={siteNames} onAdd={(r, o, i) => { addTurn(r, o, i); setAdding(null) }} />}
        {cands.filter((c) => !hasTurn(c.r.id)).map((c) => (
          <div key={c.r.id} className="row planrow">
            <span><b>{c.r.community} · Unit {c.r.unit}</b><br /><span className="small">{c.why}{c.sure ? '' : ' (possible)'}</span></span>
            <button className="primary" onClick={() => addTurn(c.r, c.date)}>Plan turn</button>
          </div>
        ))}
        {cands.length === 0 && adding !== 'turn' && <p className="small">No move-outs coming up at your properties.</p>}
      </section>

      <div className="cardgrid">
        {myTurns.map(([id, t]) => {
          const done = t.tasks.filter((x) => x.done).length
          const ed = !!edit[id]
          return (
            <section key={id} className="card turn">
              <div className="row between">
                <h2>{t.site} · Unit {t.unit}</h2>
                <span className="row">
                  <button className="link" onClick={() => { setEdit({ ...edit, [id]: !ed }); setOpen({ ...open, [id]: true }) }}>{ed ? 'Finish editing' : 'Edit'}</button>
                  <button className="link" onClick={() => { if (window.confirm(`Remove the turn for ${t.site} unit ${t.unit}?`)) setTurns({ ...turns, [id]: undefined }) }}>Remove</button>
                </span>
              </div>
              {ed ? (
                <div className="two">
                  <label>Move-out date
                    <input type="date" value={t.moveOut} onChange={(e) => {
                      const v = e.target.value
                      if (!v) return
                      const diff = daysUntil(v) - daysUntil(t.moveOut)
                      setTurn(id, { moveOut: v, moveIn: shiftISO(t.moveIn, diff), tasks: t.tasks.map((x) => (x.done ? x : { ...x, due: shiftISO(x.due, diff) })) })
                    }} />
                  </label>
                  <label>Ready for move-in<input type="date" value={t.moveIn} min={t.moveOut} onChange={(e) => e.target.value && setTurn(id, { moveIn: e.target.value })} /></label>
                  <p className="small">Changing the move-out date moves every unfinished task by the same number of days.</p>
                </div>
              ) : (
                <p className="small">Move-out {niceDate(t.moveOut)} → ready for move-in {niceDate(t.moveIn)} · Bldg {t.building}</p>
              )}
              <div className="pbar"><span style={{ width: `${t.tasks.length ? (done / t.tasks.length) * 100 : 0}%` }} /></div>
              <p className="small"><b>{done} of {t.tasks.length}</b> done{done === t.tasks.length && done > 0 ? ' · ✓ Ready for move-in' : ''}</p>
              <button className="link" onClick={() => setOpen({ ...open, [id]: !open[id] })}>{open[id] ? 'Hide checklist' : 'Show checklist'}</button>
              {open[id] && (
                <ul className="checklist">
                  {t.tasks.map((x) => (
                    <li key={x.k} className={x.done ? 'done' : ''}>
                      {ed ? (
                        <input className="tasklabel" value={x.label} onChange={(e) => updTask(id, x.k, { label: e.target.value.slice(0, 120) })} aria-label="Task" />
                      ) : (
                        <label className="chk">
                          <input type="checkbox" checked={!!x.done} onChange={(e) => updTask(id, x.k, { done: e.target.checked ? { by: supervisorName, at: new Date().toISOString() } : null })} />
                          <span>{x.label}{x.vendor ? ' · vendor' : ''}</span>
                        </label>
                      )}
                      <span className="row">
                        {ed ? <input type="date" className="mini" value={x.due} onChange={(e) => e.target.value && updTask(id, x.k, { due: e.target.value })} aria-label="Due date" />
                          : !x.done && dueTag(x.due)}
                        {x.supervisor ? <span className="small">Supervisor</span> : <TechSelect techs={techs} site={t.site} value={x.tech} onChange={(v) => updTask(id, x.k, { tech: v })} />}
                        {ed && <button className="link" onClick={() => setTurn(id, { tasks: t.tasks.filter((y) => y.k !== x.k) })} aria-label="Remove task">✕</button>}
                      </span>
                      {x.done && <span className="small">✓ {x.done.by}</span>}
                    </li>
                  ))}
                  {ed && (
                    <li>
                      <form className="row addtask" onSubmit={(e) => {
                        e.preventDefault()
                        const n = newTask[id] || {}
                        if (!n.label?.trim()) return
                        setTurn(id, { tasks: [...t.tasks, { k: `c${Date.now().toString(36)}`, label: n.label.trim().slice(0, 120), skill: 'general', due: n.due || t.moveOut, tech: n.tech || pick(t.site, 'general'), done: null }] })
                        setNewTask({ ...newTask, [id]: {} })
                      }}>
                        <input value={newTask[id]?.label || ''} onChange={(e) => setNewTask({ ...newTask, [id]: { ...newTask[id], label: e.target.value } })} placeholder="Add a task, e.g. Replace blinds" aria-label="New task" />
                        <input type="date" className="mini" value={newTask[id]?.due || t.moveOut} onChange={(e) => setNewTask({ ...newTask, [id]: { ...newTask[id], due: e.target.value } })} aria-label="Due date" />
                        <button type="submit">Add</button>
                      </form>
                    </li>
                  )}
                </ul>
              )}
            </section>
          )
        })}
      </div>

      <section className="card">
        <div className="row between">
          <h2>Preventive maintenance</h2>
          <button className="link" onClick={() => setAdding(adding === 'pm' ? null : 'pm')}>{adding === 'pm' ? 'Close' : '+ Add a task'}</button>
        </div>
        <p className="small">Suggested from each property's region and repair history, or add your own. Scheduling one puts it on the technician's day and tells the affected residents when to expect a visit.</p>
        {adding === 'pm' && <NewPmForm siteNames={siteNames} techs={techs} onAdd={(t) => { setPm({ ...pm, [`P-${Date.now().toString(36)}`]: { ...t, done: {} } }); setAdding(null) }} />}
        {sugg.map((s) => (
          <div key={s.key} className="row planrow">
            <span><b>{s.site}: {s.title}</b><br /><span className="small">{s.units.length} unit(s) · due {niceDate(s.due)} · {s.why}</span></span>
            <button className="primary" onClick={() => setPm({ ...pm, [s.key]: { ...s, tech: pick(s.site, s.skill), done: {} } })}>Schedule</button>
          </div>
        ))}
        {sugg.length === 0 && adding !== 'pm' && <p className="small">All suggestions are scheduled.</p>}
      </section>
      <div className="cardgrid">
        {myPm.map(([id, p]) => {
          const n = Object.keys(p.done || {}).filter((k) => p.units.includes(k)).length
          const ed = !!edit[id]
          const units = RESIDENTS.filter((r) => r.community === p.site)
          const upd = (patch) => setPm({ ...pm, [id]: { ...p, ...patch } })
          return (
            <section key={id} className="card turn">
              <div className="row between">
                {ed ? <input className="tasklabel" value={p.title} onChange={(e) => upd({ title: e.target.value.slice(0, 120) })} aria-label="Task" /> : <h2>{p.title}</h2>}
                <span className="row">
                  <button className="link" onClick={() => setEdit({ ...edit, [id]: !ed })}>{ed ? 'Done' : 'Edit'}</button>
                  <button className="link" onClick={() => { if (window.confirm(`Remove "${p.title}"?`)) setPm({ ...pm, [id]: undefined }) }}>Remove</button>
                </span>
              </div>
              {ed ? (
                <div className="two">
                  <label>Due date<input type="date" value={p.due} onChange={(e) => e.target.value && upd({ due: e.target.value })} /></label>
                  <label>Skill<select value={p.skill} onChange={(e) => upd({ skill: e.target.value })}>{Object.entries(SKILL_LABEL).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></label>
                </div>
              ) : (
                <p className="small">{p.site} · due {niceDate(p.due)}{daysUntil(p.due) < 0 && n < p.units.length ? ' · overdue' : ''}</p>
              )}
              {ed && (
                <>
                  <p className="small">Units · tap to include or leave out</p>
                  <div className="chips">
                    {units.map((u) => (
                      <button key={u.id} type="button" className={`chip chipbtn ${p.units.includes(u.id) ? 'sel' : ''}`}
                        onClick={() => upd({ units: p.units.includes(u.id) ? p.units.filter((x) => x !== u.id) : [...p.units, u.id] })}>Bldg {u.building} · {u.unit}{p.done?.[u.id] ? ' ✓' : ''}</button>
                    ))}
                  </div>
                </>
              )}
              <div className="pbar"><span style={{ width: `${p.units.length ? (n / p.units.length) * 100 : 0}%` }} /></div>
              <div className="row"><span className="small"><b>{n} of {p.units.length}</b> units done</span>
                <TechSelect techs={techs} site={p.site} value={p.tech} onChange={(v) => upd({ tech: v })} />
              </div>
            </section>
          )
        })}
      </div>
    </>
  )
}

// ---------- Technician: planned work assigned to me (next 14 days or overdue) ----------
export function TechPlanned({ tech, turns, setTurns, pm, setPm, L }) {
  const soon = (iso) => daysUntil(iso) <= 14
  const turnTasks = Object.entries(turns).flatMap(([id, t]) => (t ? t.tasks.filter((x) => x.tech === tech.id && !x.done && soon(x.due)).map((x) => ({ id, t, x })) : []))
  const pmTasks = Object.entries(pm).filter(([, p]) => p && p.tech === tech.id && soon(p.due) && Object.keys(p.done || {}).length < p.units.length)
  if (!turnTasks.length && !pmTasks.length) return null
  return (
    <section className="card">
      <h2>{L.planned || 'Planned work'}</h2>
      {turnTasks.map(({ id, t, x }) => (
        <div key={`${id}${x.k}`} className="row planrow">
          <span><b>{x.label}</b><br /><span className="small">{L.turnFor || 'Move-out turn'} · {t.site} · Bldg {t.building} · Unit {t.unit} · {niceDate(x.due)}</span></span>
          <button className="primary" onClick={() => setTurns({ ...turns, [id]: { ...t, tasks: t.tasks.map((y) => (y.k === x.k ? { ...y, done: { by: tech.name, at: new Date().toISOString() } } : y)) } })}>{L.done}</button>
        </div>
      ))}
      {pmTasks.map(([id, p]) => (
        <div key={id} className="planpm">
          <p><b>{p.title}</b><br /><span className="small">{p.site} · {niceDate(p.due)} · {L.tapUnit || 'tap each unit when finished'}</span></p>
          <div className="chips">
            {p.units.map((rid) => {
              const r = resById[rid]
              const d = p.done?.[rid]
              return (
                <button key={rid} className={`chip chipbtn ${d ? 'sel' : ''}`} onClick={() => setPm({ ...pm, [id]: { ...p, done: { ...p.done, [rid]: d ? undefined : { by: tech.name, at: new Date().toISOString() } } } })}>
                  {d ? '✓ ' : ''}Bldg {r?.building} · {r?.unit}
                </button>
              )
            })}
          </div>
        </div>
      ))}
    </section>
  )
}

// ---------- Resident: what's planned for my home ----------
const RT = {
  en: { title: 'Coming up for your home', pm: (t, d) => `Scheduled maintenance: ${t} around ${d}. We'll text you before entering.`, walk: (d) => `Move-out walkthrough: ${d}. A technician will check the apartment with you.`, keys: (d) => `Final walkthrough and key return: ${d}.`, vendor: (s, d) => `Specialist visit: ${s}${d ? `, ${d}` : ''}.` },
  es: { title: 'Próximamente en su casa', pm: (t, d) => `Mantenimiento programado: ${t}, alrededor del ${d}. Le enviaremos un mensaje antes de entrar.`, walk: (d) => `Inspección antes de la mudanza: ${d}. Un técnico revisará el apartamento con usted.`, keys: (d) => `Inspección final y entrega de llaves: ${d}.`, vendor: (s, d) => `Visita del especialista: ${s}${d ? `, ${d}` : ''}.` },
}
export function ResidentNotices({ me, turns, pm, vendorjobs, myOrderIds }) {
  const L = me.lang === 'Spanish' ? RT.es : RT.en
  const items = []
  for (const p of Object.values(pm)) if (p && p.units.includes(me.id) && !p.done?.[me.id] && daysUntil(p.due) >= -3) items.push(L.pm(p.title, niceDate(p.due)))
  const t = Object.values(turns).find((x) => x && x.residentId === me.id)
  if (t) {
    const pre = t.tasks.find((x) => x.k === 'pre')
    const keys = t.tasks.find((x) => x.k === 'keys')
    if (pre && !pre.done) items.push(L.walk(niceDate(pre.due)))
    if (keys && !keys.done) items.push(L.keys(niceDate(keys.due)))
  }
  for (const id of myOrderIds) {
    const v = vendorjobs[id]
    if (v && v.status !== 'done') items.push(L.vendor(VENDOR_STATUS[v.status]?.toLowerCase() || v.status, v.date ? niceDate(v.date) : ''))
  }
  if (!items.length) return null
  return (
    <section className="card notices">
      <h2>📅 {L.title}</h2>
      <ul>{items.map((x, i) => <li key={i}>{x}</li>)}</ul>
    </section>
  )
}

// ---------- Supervisor card: vendor job tracking ----------
export function VendorTracker({ orderId, vendorjobs, setVendorjobs, vendors }) {
  const v = vendorjobs[orderId] || {}
  const upd = (p) => setVendorjobs({ ...vendorjobs, [orderId]: { status: 'requested', ...v, ...p } })
  return (
    <div className="vtrack">
      <p className="small"><b>Vendor job</b></p>
      <div className="two">
        <label>Vendor
          <select value={v.vendorId || ''} onChange={(e) => upd({ vendorId: e.target.value })}>
            <option value="">Choose…</option>
            {vendors.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
          </select>
        </label>
        <label>Status
          <select value={v.status || ''} onChange={(e) => upd({ status: e.target.value })}>
            <option value="">Not requested</option>
            {Object.entries(VENDOR_STATUS).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
          </select>
        </label>
        <label>Visit date<input type="date" value={v.date || ''} min={todayISO()} onChange={(e) => upd({ date: e.target.value })} /></label>
        <label>Quote ($)<input inputMode="decimal" value={v.quote || ''} onChange={(e) => upd({ quote: e.target.value.replace(/[^\d.]/g, '').slice(0, 9) })} /></label>
        <label>Final cost ($)<input inputMode="decimal" value={v.cost || ''} onChange={(e) => upd({ cost: e.target.value.replace(/[^\d.]/g, '').slice(0, 9) })} /></label>
      </div>
    </div>
  )
}

// ---------- Scoreboard ----------
export function Scoreboard({ s }) {
  const tiles = [
    [s.response == null ? '–' : `${Math.round(s.response)} min`, 'Approval → tech on the way (urgent jobs)', s.responseN ? `${s.responseN} jobs` : 'no data yet'],
    [s.doneToday, 'Jobs finished'],
    [s.firstVisit == null ? '–' : `${s.firstVisit}%`, 'Fixed on the first visit'],
    [s.satisfaction == null ? '–' : `${s.satisfaction}%`, 'Residents say "fixed"', s.satisfactionN ? `${s.satisfactionN} replies` : 'no replies yet'],
    [`${s.saved} min`, 'Driving saved by smart routes'],
    [s.waiting, 'Waiting for approval'],
    [`$${s.spend.toLocaleString()}`, 'Vendor spend'],
  ]
  return (
    <section className="card scoreboard">
      <h2>🏆 Scoreboard</h2>
      <div className="scoretiles">
        {tiles.map(([v, l, sub]) => (
          <div key={l}><b>{v}</b><span>{l}</span>{sub && <em>{sub}</em>}</div>
        ))}
      </div>
    </section>
  )
}
