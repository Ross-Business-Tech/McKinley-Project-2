import { useState } from 'react'
import { mapFor, placeOf, startPlace } from './triage/geo.js'
import { SEVERITY } from './triage/config.js'
import { fmt } from './triage/engine.js'

const TECH_COLORS = ['#0b5fd1', '#e8710a', '#1f8f5f', '#8e44ad', '#c2185b', '#00838f']
const SEV_FILL = { red: '#d7373f', orange: '#e8710a', amber: '#c98a00', green: '#1f8f5f', gray: '#7b8ca3' }
const LANDMARKS = { leasing_office: 'Leasing office', maintenance_shop: 'Maintenance shop', mail_center: 'Mail center' }

export default function SiteMap({ site, plan, orders }) {
  const [picked, setPicked] = useState(null)
  const m = mapFor(site)
  if (!m) {
    return (
      <section className="card">
        <h2>No site map yet</h2>
        <p className="small">We don't have a site plan for {site}. Routes here use the property address only.</p>
      </section>
    )
  }

  const r = Math.max(m.w, m.h) * 0.022
  const routes = plan.techs
    .filter((t) => t.tech.sites.includes(site))
    .map((t, i) => {
      const start = startPlace(site)
      const pts = [start, ...t.plan.stops.filter((s) => s.job.community === site).map((s) => placeOf(s.job))].filter((p) => p.x != null)
      return { ...t, color: TECH_COLORS[i % TECH_COLORS.length], pts }
    })

  const stopInfo = {}
  routes.forEach((rt) =>
    rt.plan.stops.forEach((s, i) => {
      stopInfo[s.job.id] = { n: i + 1, tech: rt.tech.name, color: rt.color, arrive: s.arrive }
    }),
  )

  const jobs = orders.filter((o) => o.community === site)
  const placed = jobs.map((o) => ({ o, p: placeOf(o) })).filter(({ p }) => p.x != null)
  const unplaced = jobs.filter((o) => placeOf(o).x == null)
  const pick = placed.find(({ o }) => o.id === picked)

  return (
    <>
      <section className="card mapcard">
        <div className="mapwrap">
          <svg viewBox={`0 0 ${m.w} ${m.h}`} role="img" aria-label={`Site map of ${site} with open work orders`}>
            <image href={m.file} width={m.w} height={m.h} />
            {m.n
              .filter((n) => LANDMARKS[n.t])
              .map((n) => (
                <g key={`${n.t}${n.x}${n.y}`}>
                  <rect x={n.x - r * 0.6} y={n.y - r * 0.6} width={r * 1.2} height={r * 1.2} rx={r * 0.25} fill="#0f2742" stroke="#fff" strokeWidth={r * 0.18} />
                  <text x={n.x} y={n.y + r * 0.3} fontSize={r * 0.85} textAnchor="middle" fill="#fff" fontWeight="700">
                    {n.t === 'maintenance_shop' ? 'M' : n.t === 'mail_center' ? '✉' : 'L'}
                  </text>
                </g>
              ))}
            {routes.map((rt) =>
              rt.pts.length > 1 ? (
                <polyline key={rt.tech.id} points={rt.pts.map((p) => `${p.x},${p.y}`).join(' ')} fill="none" stroke={rt.color}
                  strokeWidth={r * 0.35} strokeDasharray={`${r * 0.9} ${r * 0.5}`} strokeLinecap="round" strokeLinejoin="round" opacity="0.9" />
              ) : null,
            )}
            {placed.map(({ o, p }) => {
              const info = stopInfo[o.id]
              const fill = SEV_FILL[SEVERITY[o.sev].color]
              return (
                <g key={o.id} onClick={() => setPicked(o.id)} style={{ cursor: 'pointer' }}>
                  <circle cx={p.x} cy={p.y} r={r * 1.5} fill="transparent" />
                  <circle cx={p.x} cy={p.y} r={r} fill={info ? fill : '#fff'} stroke={info ? '#fff' : fill} strokeWidth={r * 0.25}
                    strokeDasharray={info ? undefined : `${r * 0.4} ${r * 0.3}`} />
                  <text x={p.x} y={p.y + r * 0.38} fontSize={r * 1.05} textAnchor="middle" fill={info ? '#fff' : fill} fontWeight="800">
                    {info ? info.n : '•'}
                  </text>
                  {picked === o.id && <circle cx={p.x} cy={p.y} r={r * 1.6} fill="none" stroke="#0f2742" strokeWidth={r * 0.2} />}
                </g>
              )
            })}
          </svg>
        </div>
        <div className="legend">
          {routes.map((rt) => (
            <span key={rt.tech.id}><i style={{ background: rt.color }} />{rt.tech.name} ({rt.plan.stops.length})</span>
          ))}
          <span><i className="sq" />L = leasing office, M = maintenance shop</span>
          <span><i className="hollow" />Not on a route yet</span>
        </div>
        <p className="small">Tap a numbered dot to see the job. The number is the stop order for that technician.</p>
        {m.low > 0 && <p className="small">{m.low} buildings on this map have rough (low-confidence) positions.</p>}
      </section>

      {pick && (
        <section className={`card order ${SEVERITY[pick.o.sev].color}`}>
          <div className="row">
            <span className={`pill ${SEVERITY[pick.o.sev].color}`}>{pick.o.sev} · {SEVERITY[pick.o.sev].label}</span>
            <span className="small">{pick.o.label}</span>
          </div>
          <p className="text">“{pick.o.text}”</p>
          <p className="unit">Building {pick.o.resident?.building || pick.o.loc?.building} · Unit {pick.o.resident?.unit || pick.o.loc?.unit || '?'}{pick.o.resident ? ` · ${pick.o.resident.name}` : ' · not in our records'}</p>
          <p className="small">
            {stopInfo[pick.o.id]
              ? `Stop ${stopInfo[pick.o.id].n} for ${stopInfo[pick.o.id].tech}, arriving about ${fmt(stopInfo[pick.o.id].arrive)}`
              : pick.o.entry.status === 'hold' ? 'Waiting on the resident’s OK before it goes on a route.' : 'Not on a route yet.'}
          </p>
          {pick.p.note && <p className="small">Where: {pick.p.note}</p>}
        </section>
      )}

      {unplaced.length > 0 && (
        <section className="card">
          <h2>Not on the map ({unplaced.length})</h2>
          <p className="small">We couldn't match these to a building yet.</p>
          <ul>{unplaced.map((o) => <li key={o.id}>{o.label}: “{o.text.slice(0, 50)}…”</li>)}</ul>
        </section>
      )}
    </>
  )
}
