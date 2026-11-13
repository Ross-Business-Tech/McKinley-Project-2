import history from './triage/history.json' with { type: 'json' }
import { RESIDENTS, classify } from './triage/engine.js'
import { JOB_TYPES } from './triage/config.js'

// Job history and repeat-problem stats (worksheet requirement 5).
// Past requests come from the sample spreadsheet's maintenance history; today's come from the app.
const byRes = Object.fromEntries(RESIDENTS.map((r) => [r.id, r]))
const days = (a, b) => (new Date(b) - new Date(a)) / 86400000

function Bars({ title, rows, unit = '', note }) {
  const max = Math.max(1, ...rows.map((r) => r.n))
  return (
    <section className="card statcard">
      <h2>{title}</h2>
      {note && <p className="small">{note}</p>}
      {rows.length === 0 && <p className="small">Nothing yet.</p>}
      <ul className="bars">
        {rows.map((r) => (
          <li key={r.label} title={`${r.label}: ${r.n}${unit}`}>
            <span className="blabel">{r.label}</span>
            <span className="btrack"><span className="bfill" style={{ width: `${(r.n / max) * 100}%` }} /></span>
            <span className="bval">{r.n}{unit}</span>
          </li>
        ))}
      </ul>
    </section>
  )
}

const top = (counts, n = 8) =>
  Object.entries(counts)
    .map(([label, v]) => ({ label, n: v }))
    .sort((a, b) => b.n - a.n)
    .slice(0, n)

export default function Stats({ orders, siteNames, techDone, parts }) {
  const past = history
    .map((h) => ({ ...h, r: byRes[h.res] }))
    .filter((h) => h.r && siteNames.includes(h.r.community))
  const all = [
    ...past.map((h) => ({ type: classify(`${h.subject} ${h.text}`), r: h.r })),
    ...orders.filter((o) => o.resident).map((o) => ({ type: o.type, r: o.resident })),
  ]

  const typeCounts = {}
  for (const x of all) typeCounts[JOB_TYPES[x.type].label] = (typeCounts[JOB_TYPES[x.type].label] || 0) + 1
  const unitCounts = {}
  for (const x of all) {
    const k = `${x.r.community} · Bldg ${x.r.building} · Unit ${x.r.unit}`
    unitCounts[k] = (unitCounts[k] || 0) + 1
  }
  const repeats = top(unitCounts, 20).filter((r) => r.n >= 3)
  const propCounts = {}
  for (const x of all) propCounts[x.r.community] = (propCounts[x.r.community] || 0) + 1

  const resolved = past.filter((h) => h.resolved)
  const avg = resolved.length ? resolved.reduce((n, h) => n + Math.max(0, days(h.at.slice(0, 10), h.resolved)), 0) / resolved.length : null
  const slowByType = {}
  const cnt = {}
  for (const h of resolved) {
    const l = JOB_TYPES[classify(`${h.subject} ${h.text}`)].label
    slowByType[l] = (slowByType[l] || 0) + Math.max(0, days(h.at.slice(0, 10), h.resolved))
    cnt[l] = (cnt[l] || 0) + 1
  }
  const slow = top(Object.fromEntries(Object.entries(slowByType).map(([k, v]) => [k, Math.round((v / cnt[k]) * 10) / 10])), 6)

  const partCounts = {}
  for (const [id, list] of Object.entries(parts || {})) {
    if (!orders.some((o) => o.id === id)) continue
    for (const p of list || []) partCounts[p.name] = (partCounts[p.name] || 0) + (Number(p.qty) || 1)
  }
  const doneCount = orders.filter((o) => techDone[o.id]).length

  return (
    <>
      <section className="stattiles">
        <div><b>{all.length}</b><span>Requests (history + today)</span></div>
        <div><b>{repeats.length}</b><span>Units with 3+ requests</span></div>
        <div><b>{avg == null ? '–' : avg.toFixed(1)}</b><span>Avg days to fix</span></div>
        <div><b>{doneCount}</b><span>Finished today</span></div>
      </section>
      <div className="cardgrid">
        <Bars title="Repeat problems by unit" rows={repeats} note="Units with 3 or more requests. Good candidates for a permanent fix or a vendor visit." />
        <Bars title="Requests by problem type" rows={top(typeCounts)} />
        <Bars title="Requests by property" rows={top(propCounts)} />
        <Bars title="Average days to fix, by problem type" rows={slow} unit=" d" note="From past requests that were closed." />
        <Bars title="Parts used today" rows={top(partCounts)} note="Logged by technicians on each job." />
      </div>
      <p className="small">History is the sample spreadsheet's maintenance records (made-up data). Real numbers will come from Yardi or Databricks once connected.</p>
    </>
  )
}
