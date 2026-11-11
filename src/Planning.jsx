import { useState } from 'react'
import { RESIDENTS } from './triage/engine.js'
import { moveOutCandidates, makeTurn, pmSuggestions, niceDate, daysUntil, todayISO, VENDOR_STATUS, pickTechFor } from './planning.js'

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
export function PlanningTab({ siteNames, sites, techs, turns, setTurns, pm, setPm, supervisorName }) {
  const [open, setOpen] = useState({})
  const pick = pickTechFor(techs)
  const cands = moveOutCandidates(siteNames)
  const myTurns = Object.entries(turns).filter(([, t]) => t && siteNames.includes(t.site)).sort((a, b) => a[1].moveOut.localeCompare(b[1].moveOut))
  const sugg = pmSuggestions(siteNames, sites).filter((s) => !pm[s.key])
  const myPm = Object.entries(pm).filter(([, p]) => p && siteNames.includes(p.site)).sort((a, b) => a[1].due.localeCompare(b[1].due))
  const updTask = (id, k, patch) => setTurns({ ...turns, [id]: { ...turns[id], tasks: turns[id].tasks.map((x) => (x.k === k ? { ...x, ...patch } : x)) } })

  return (
    <>
      <section className="card">
        <h2>Move-outs and make-ready turns</h2>
        <p className="small">Residents who gave notice or whose lease ends soon without a renewal. Planning a turn creates the whole checklist, assigned to the right technicians, so the unit is ready for the next move-in.</p>
        {cands.filter((c) => !turns[`T-${c.r.id}`]).map((c) => (
          <div key={c.r.id} className="row planrow">
            <span><b>{c.r.community} · Unit {c.r.unit}</b><br /><span className="small">{c.why}{c.sure ? '' : ' (possible)'}</span></span>
            <button className="primary" onClick={() => setTurns({ ...turns, [`T-${c.r.id}`]: makeTurn(c.r, c.date, pick) })}>Plan turn</button>
          </div>
        ))}
        {cands.length === 0 && <p className="small">No move-outs coming up at your properties.</p>}
      </section>

      <div className="cardgrid">
        {myTurns.map(([id, t]) => {
          const done = t.tasks.filter((x) => x.done).length
          return (
            <section key={id} className="card turn">
              <div className="row between">
                <h2>{t.site} · Unit {t.unit}</h2>
                <button className="link" onClick={() => setTurns({ ...turns, [id]: undefined })}>Remove</button>
              </div>
              <p className="small">Move-out {niceDate(t.moveOut)} → ready for move-in {niceDate(t.moveIn)} · Bldg {t.building}</p>
              <div className="pbar"><span style={{ width: `${(done / t.tasks.length) * 100}%` }} /></div>
              <p className="small"><b>{done} of {t.tasks.length}</b> done{done === t.tasks.length ? ' · ✓ Ready for move-in' : ''}</p>
              <button className="link" onClick={() => setOpen({ ...open, [id]: !open[id] })}>{open[id] ? 'Hide checklist' : 'Show checklist'}</button>
              {open[id] && (
                <ul className="checklist">
                  {t.tasks.map((x) => (
                    <li key={x.k} className={x.done ? 'done' : ''}>
                      <label className="chk">
                        <input type="checkbox" checked={!!x.done} onChange={(e) => updTask(id, x.k, { done: e.target.checked ? { by: supervisorName, at: new Date().toISOString() } : null })} />
                        <span>{x.label}{x.vendor ? ' · vendor' : ''}</span>
                      </label>
                      <span className="row">
                        {!x.done && dueTag(x.due)}
                        {x.supervisor ? <span className="small">Supervisor</span> : <TechSelect techs={techs} site={t.site} value={x.tech} onChange={(v) => updTask(id, x.k, { tech: v })} />}
                      </span>
                      {x.done && <span className="small">✓ {x.done.by}</span>}
                    </li>
                  ))}
                </ul>
              )}
            </section>
          )
        })}
      </div>

      <section className="card">
        <h2>Preventive maintenance</h2>
        <p className="small">Suggested from each property's region and repair history. Scheduling one puts it on the technician's day and tells the affected residents when to expect a visit.</p>
        {sugg.map((s) => (
          <div key={s.key} className="row planrow">
            <span><b>{s.site}: {s.title}</b><br /><span className="small">{s.units.length} unit(s) · due {niceDate(s.due)} · {s.why}</span></span>
            <button className="primary" onClick={() => setPm({ ...pm, [s.key]: { ...s, tech: pick(s.site, s.skill), done: {} } })}>Schedule</button>
          </div>
        ))}
        {sugg.length === 0 && <p className="small">All suggestions are scheduled.</p>}
      </section>
      <div className="cardgrid">
        {myPm.map(([id, p]) => {
          const n = Object.keys(p.done || {}).length
          return (
            <section key={id} className="card turn">
              <div className="row between">
                <h2>{p.title}</h2>
                <button className="link" onClick={() => setPm({ ...pm, [id]: undefined })}>Remove</button>
              </div>
              <p className="small">{p.site} · due {niceDate(p.due)}</p>
              <div className="pbar"><span style={{ width: `${(n / p.units.length) * 100}%` }} /></div>
              <div className="row"><span className="small"><b>{n} of {p.units.length}</b> units done</span>
                <TechSelect techs={techs} site={p.site} value={p.tech} onChange={(v) => setPm({ ...pm, [id]: { ...p, tech: v } })} />
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
  const t = turns[`T-${me.id}`]
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
