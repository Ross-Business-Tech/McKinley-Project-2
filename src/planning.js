// Planned work: move-out "turns" (make-ready), preventive maintenance, and vendor job tracking.
// Pure helpers here; screens are in Planning.jsx.
import history from './triage/history.json' with { type: 'json' }
import { RESIDENTS, classify } from './triage/engine.js'

export const todayISO = () => new Date().toISOString().slice(0, 10)
export const addDays = (iso, n) => {
  const d = new Date(`${iso}T12:00:00`)
  d.setDate(d.getDate() + n)
  return d.toISOString().slice(0, 10)
}
export const daysUntil = (iso) => Math.round((new Date(`${iso}T12:00:00`) - new Date(`${todayISO()}T12:00:00`)) / 86400000)
export const niceDate = (iso) => {
  try {
    return new Date(`${iso}T12:00:00`).toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' })
  } catch {
    return iso
  }
}

// ---------- Move-out turns ----------
// Offsets are days from the move-out date. "vendor" marks tasks usually sent to an outside company.
export const TURN_TEMPLATE = [
  { k: 'pre', label: 'Pre-move-out walkthrough with resident', skill: 'general', d: -7 },
  { k: 'keys', label: 'Final walkthrough and key collection', skill: 'general', d: 0 },
  { k: 'repairs', label: 'Repairs found on walkthrough', skill: 'general', d: 1 },
  { k: 'paint', label: 'Paint and patch walls', skill: 'general', d: 2 },
  { k: 'appl', label: 'Appliance check (fridge, stove, dishwasher)', skill: 'appliance', d: 2 },
  { k: 'hvac', label: 'HVAC filter change and system check', skill: 'hvac', d: 2 },
  { k: 'carpet', label: 'Carpet clean or replace', skill: 'general', d: 3, vendor: 'flooring' },
  { k: 'clean', label: 'Deep clean', skill: 'general', d: 4 },
  { k: 'final', label: 'Make-ready sign-off (supervisor)', skill: 'general', d: 5, supervisor: true },
]

// Who is moving out: residents who gave notice, plus leases ending in the next 75 days without a renewal.
export function moveOutCandidates(siteNames) {
  const out = []
  for (const r of RESIDENTS) {
    if (!siteNames.includes(r.community)) continue
    if (r.moveOut) out.push({ r, date: r.moveOut, sure: true, why: `Notice given · moving out ${niceDate(r.moveOut)}` })
    else if (!/renewed/.test(r.renewal || '') && r.leaseEnd && daysUntil(r.leaseEnd) <= 75 && daysUntil(r.leaseEnd) >= -5) {
      out.push({ r, date: r.leaseEnd, sure: false, why: `Lease ends ${niceDate(r.leaseEnd)} · renewal: ${r.renewal}` })
    }
  }
  return out.sort((a, b) => a.date.localeCompare(b.date))
}

export function makeTurn(r, moveOut, pickTech) {
  return {
    residentId: r.id,
    site: r.community,
    unit: r.unit,
    building: r.building,
    moveOut,
    moveIn: addDays(moveOut, 7),
    createdAt: new Date().toISOString(),
    tasks: TURN_TEMPLATE.map((t) => ({ k: t.k, label: t.label, skill: t.skill, due: addDays(moveOut, t.d), vendor: t.vendor || null, supervisor: !!t.supervisor, tech: t.supervisor ? null : pickTech(r.community, t.skill), done: null })),
  }
}

// ---------- Preventive maintenance ----------
// Suggestions built from the property's region and its repair history.
export function pmSuggestions(siteNames, sites) {
  const out = []
  const today = todayISO()
  for (const name of siteNames) {
    const units = RESIDENTS.filter((r) => r.community === name)
    if (!units.length) continue
    const st = sites.find((x) => x.name === name)
    const fl = st?.state === 'FL' || /FL/.test(st?.city || '')
    const hist = history.filter((h) => units.some((u) => u.id === h.res))
    const byUnit = (type) => {
      const c = {}
      for (const h of hist) if (classify(`${h.subject} ${h.text}`) === type) c[h.res] = (c[h.res] || 0) + 1
      return units.filter((u) => (c[u.id] || 0) >= 2)
    }
    const ac = byUnit('noac')
    const leaks = byUnit('leak')
    out.push(
      fl
        ? { key: `${name}|ac`, site: name, title: 'AC tune-up before summer (filters, coils, drain lines)', skill: 'hvac', due: addDays(today, 120), units: units.map((u) => u.id), why: 'Florida heat: fewer no-AC emergencies in summer.' }
        : { key: `${name}|heat`, site: name, title: 'Furnace check before winter (filters, igniter, CO test)', skill: 'hvac', due: addDays(today, 9), units: units.map((u) => u.id), why: 'Michigan winter: no heat is an emergency.' },
      { key: `${name}|smoke`, site: name, title: 'Smoke and CO alarm test', skill: 'electrical', due: addDays(today, 30), units: units.map((u) => u.id), why: 'Yearly safety check for every unit.' },
    )
    if (ac.length) out.push({ key: `${name}|acrepeat`, site: name, title: 'HVAC inspection for repeat-AC units', skill: 'hvac', due: addDays(today, 14), units: ac.map((u) => u.id), why: `${ac.length} unit(s) with repeat AC calls in their history.` })
    if (leaks.length) out.push({ key: `${name}|leakrepeat`, site: name, title: 'Plumbing check for repeat-leak units', skill: 'plumbing', due: addDays(today, 14), units: leaks.map((u) => u.id), why: `${leaks.length} unit(s) with repeat leaks in their history.` })
  }
  return out
}

// ---------- Vendor jobs ----------
export const VENDOR_STATUS = { requested: 'Requested', scheduled: 'Scheduled', onsite: 'On site', done: 'Done' }

// ---------- Scoreboard ----------
const mins = (a, b) => (new Date(b) - new Date(a)) / 60000
export function scoreboard({ orders, approved, progress, techDone, feedback, vendorjobs, plan }) {
  const ids = new Set(orders.map((o) => o.id))
  const resp = orders
    .filter((o) => o.sev >= 4 && typeof approved[o.id] === 'string' && progress[o.id]?.onway)
    .map((o) => Math.max(0, mins(approved[o.id], progress[o.id].onway)))
  const done = orders.filter((o) => techDone[o.id])
  const firstVisit = done.filter((o) => !progress[o.id]?.parts && feedback[o.id]?.ok !== false)
  const fb = Object.entries(feedback).filter(([k]) => ids.has(k)).map(([, v]) => v)
  const spend = Object.entries(vendorjobs).filter(([k]) => ids.has(k)).reduce((n, [, v]) => n + (Number(v.cost) || 0), 0)
  const avg = (a) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : null)
  return {
    response: avg(resp),
    responseN: resp.length,
    doneToday: done.length,
    firstVisit: done.length ? Math.round((firstVisit.length / done.length) * 100) : null,
    satisfaction: fb.length ? Math.round((fb.filter((x) => x.ok).length / fb.length) * 100) : null,
    satisfactionN: fb.length,
    saved: Math.round(plan.saved || 0),
    waiting: orders.filter((o) => !approved[o.id] && !techDone[o.id]).length,
    spend,
  }
}

// Default technician for a planned task: someone at that property with the right skill.
export function pickTechFor(techs) {
  return (site, skill) => {
    const here = techs.filter((t) => t.sites.includes(site))
    return (here.find((t) => t.skills.includes(skill)) || here[0])?.id || null
  }
}

