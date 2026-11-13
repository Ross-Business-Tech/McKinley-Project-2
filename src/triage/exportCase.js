// Writes the day as a "case file" so a separate app (the Plan Evaluator) can grade this board's plan.
// Nothing here changes how the board decides anything: it only reads what the board already produced.
// File format: see CASE-FILE.md in the Plan Evaluator project (format "plan-case/v1").
import { JOB_TYPES, travelMinutes } from './config.js'

const clock = (hours) => {
  const m = Math.round(hours * 60)
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`
}

// The board scores 1-5; the evaluator uses 1-3 (Routine / Soon / Urgent).
const toUrgency = (sev) => (sev >= 4 ? 3 : sev === 3 ? 2 : 1)

// The answer key: what a careful person decided for the test orders ("expect" in testOrders.js).
// It must NOT be the board's own score, or the evaluator would be grading the board against itself.
// Requests added by hand have no answer key, so they get none and that check is skipped for them.
const referenceSeverity = (o) => o.expect?.sev ?? o.expect?.sevMin ?? null

// Short note the technician should receive on the stop.
const noteFor = (o) => [...o.flags, `Bring: ${o.bring.join(', ')}`].join('. ')

// `plan` is the board's plan for the day, `orders` every work order it was built from, `schedule` the day/after-hours choice.
// `approved` (optional, {orderId: true}): export only what the supervisor approved, i.e. each technician's "My day".
// Suggested jobs that are not approved yet are listed as on hold, so an urgent one shows up as a warning.
// The crew is whoever the plan actually used that day (so days off and after-hours shifts are respected).
// `scopeLabel` (optional) names whose day this is, for example the signed-in supervisor.
export function buildCaseFile({ plan, orders, schedule, sites, approved = null, scopeLabel = '' }) {
  const crewIn = plan.techs.map((x) => x.tech).filter((t) => t.sites?.length)
  const used = new Set()
  crewIn.forEach((t) => t.sites.forEach((s) => used.add(s)))
  orders.forEach((o) => o.community && used.add(o.community))

  const communities = {}
  for (const name of used) {
    const s = sites.find((x) => x.name === name)
    communities[name] = { name, region: s?.market || s?.city || 'Region' }
  }
  const names = [...used]
  const pairs = []
  for (let i = 0; i < names.length; i++) {
    for (let j = i + 1; j < names.length; j++) {
      const m = travelMinutes(names[i], names[j])
      if (m < 999) pairs.push({ a: names[i], b: names[j], minutes: m })
    }
  }

  const unknownIds = new Set(plan.unknown.map((o) => o.id))
  const heldIds = new Set(plan.held.map((o) => o.id))
  const deferredIds = new Set((plan.deferred || []).map((o) => o.id))
  const isApproved = (id) => !approved || !!approved[id]
  const pendingIds = new Set()
  if (approved) plan.techs.forEach(({ plan: p }) => p.stops.forEach(({ job }) => !approved[job.id] && pendingIds.add(job.id)))
  const startHour = crewIn.length ? Math.min(...crewIn.map((t) => t.shift[0])) : 8
  const endHour = crewIn.length ? Math.max(...crewIn.map((t) => t.shift[1])) : 17

  const requests = orders.map((o) => {
    // After hours the board sends urgent jobs without waiting for the resident's usual daytime window.
    const wholeShift = ['emergency', 'none'].includes(o.entry.status) || (plan.afterHours && o.sev >= 4)
    const [w0, w1] = wholeShift ? [startHour, endHour] : o.window
    const ref = referenceSeverity(o)
    return {
      id: o.id,
      resident: o.resident?.id || 'unknown',
      ...(o.community ? { community: o.community } : {}),
      trade: JOB_TYPES[o.type].label,
      skill: o.skill,
      durationMin: o.mins,
      window: [clock(w0), clock(w1)],
      ...(ref !== null ? { urgency: toUrgency(ref) } : {}),
      text: o.text,
      note: noteFor(o),
      ...(o.flags.length ? { facts: o.flags } : {}),
      ...(unknownIds.has(o.id) ? { hold: 'Unit not found: the board cannot route it until someone confirms the unit' } : {}),
      ...(heldIds.has(o.id) ? { hold: 'Waiting on the resident’s OK to enter' } : {}),
      ...(deferredIds.has(o.id) ? { hold: 'After hours: routine work waits for the regular shift' } : {}),
      ...(pendingIds.has(o.id) ? { hold: 'Suggested by the board, but the supervisor has not approved it yet' } : {}),
    }
  })

  const assignments = Object.fromEntries(
    plan.techs.map(({ tech, plan: p }) => [tech.id, p.stops.filter(({ job }) => isApproved(job.id)).map(({ job, arrive }) => ({ id: job.id, start: clock(arrive), note: noteFor(job) }))]),
  )

  return {
    format: 'plan-case/v1',
    title: `Maintenance Hub ${schedule?.day ? `${schedule.day}${plan.afterHours ? ', after hours' : ''}` : 'day'}${approved ? ', approved technician days' : ''}${scopeLabel ? ` for ${scopeLabel}` : ''} (${orders.length} requests)`,
    source: `Exported from the Maintenance Hub triage board${scopeLabel ? ` for ${scopeLabel}` : ''}. Made-up sample data.`,
    shift: { start: clock(startHour), end: clock(endHour) },
    communities,
    travel: { within: 4, pairs },
    crew: crewIn.map((t) => ({ id: t.id, name: t.name, trade: t.skills.join(' + '), skills: t.skills, base: t.sites[0], serves: t.sites })),
    requests,
    plan: {
      planner: approved ? 'Maintenance Hub: supervisor-approved technician days' : 'Maintenance Hub triage board (suggestions)',
      assignments,
      urgency: Object.fromEntries(orders.map((o) => [o.id, toUrgency(o.sev)])),
    },
  }
}

export function downloadCaseFile(file, name = 'maintenance-day-for-evaluation.json') {
  const url = URL.createObjectURL(new Blob([JSON.stringify(file, null, 2)], { type: 'application/json' }))
  const a = document.createElement('a')
  a.href = url
  a.download = name
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
