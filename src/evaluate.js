import { URGENCY } from './urg.js'

// Everything here works from `ctx`, the day read from a case file (see casefile.js). Nothing is built in.

export function fmt(m) {
  const h = Math.floor(m / 60)
  const mm = String(Math.round(m % 60)).padStart(2, '0')
  return `${h % 12 || 12}:${mm} ${h < 12 ? 'AM' : 'PM'}`
}

// Turn a plan ({techId: [{id, at?, note}]}) into timelines with real times.
export function simulate(ctx, plan, { ignoreWindows = false } = {}) {
  return ctx.crew.map((tech) => {
    let time = ctx.shift[0]
    let loc = tech.base
    let prevEnd = -1
    const stops = (plan[tech.id] || []).map((s) => {
      const job = ctx.jobById[s.id]
      const drive = ctx.travel(loc, job.comm)
      const arrive = time + drive
      const start = s.at ?? (ignoreWindows ? arrive : Math.max(arrive, job.win[0]))
      const end = start + job.dur
      const stop = {
        job,
        note: s.note || '',
        drive,
        start,
        end,
        overlap: start < prevEnd,
        outsideShift: start < ctx.shift[0] || end > ctx.shift[1],
        wasted: start < job.win[0] || end > job.win[1],
        skillMismatch: !tech.skills.includes(job.skill),
      }
      time = end
      prevEnd = end
      loc = job.comm
      return stop
    })
    return { tech, stops }
  })
}

// The "by hand" plan: a naive manager. Requests are worked in the order they came in (the order in the file),
// each goes to the first technician who has the right skill and works that site, with no balancing,
// no grouping and no waiting for entry windows. If nobody at that site has the skill, the naive manager still
// sends the first person who works there (the wrong skill), as the board does, rather than skipping the job.
// Urgency is not used to reorder anything.
export function handPlan(ctx) {
  const state = Object.fromEntries(ctx.crew.map((t) => [t.id, { time: ctx.shift[0], loc: t.base, list: [] }]))
  for (const job of ctx.jobs) {
    const tech = ctx.crew.find((t) => t.skills.includes(job.skill) && ctx.canServe(t, job)) || ctx.crew.find((t) => ctx.canServe(t, job))
    if (!tech) continue // nobody works at that site, so nobody could do it by hand either
    const s = state[tech.id]
    s.time += ctx.travel(s.loc, job.comm) + job.dur
    s.loc = job.comm
    s.list.push({ id: job.id, note: job.urgency === 3 ? job.note : '' })
  }
  return Object.fromEntries(ctx.crew.map((t) => [t.id, state[t.id].list]))
}

export function checkPlan(ctx, timelines) {
  const seen = {}
  timelines.forEach((tl) => tl.stops.forEach((s) => (seen[s.job.id] = (seen[s.job.id] || 0) + 1)))
  const missing = ctx.jobs.filter((j) => !seen[j.id]).map((j) => j.id)
  const dupes = Object.keys(seen).filter((id) => seen[id] > 1)
  const overlaps = timelines.flatMap((tl) => tl.stops.filter((s) => s.overlap).map((s) => `${tl.tech.name} is in two places at ${fmt(s.start)} (${s.job.id})`))
  const outside = timelines.flatMap((tl) => tl.stops.filter((s) => s.outsideShift).map((s) => `${s.job.id} falls outside ${tl.tech.name}'s hours`))
  const checks = [
    { label: 'Every request is covered once', ok: !missing.length && !dupes.length,
      detail: missing.length ? `Missing: ${missing.join(', ')}` : dupes.length ? `Duplicated: ${dupes.join(', ')}` : '' },
    { label: 'Nobody is in two places at once', ok: !overlaps.length, detail: overlaps.join('; ') },
    { label: `No job falls outside working hours (${fmt(ctx.shift[0])}–${fmt(ctx.shift[1])})`, ok: !outside.length, detail: outside.join('; ') },
  ]
  return { ok: checks.every((c) => c.ok), checks }
}

export function score(ctx, timelines, urgencyMap) {
  const stops = timelines.flatMap((tl) => tl.stops.map((s) => ({ ...s, tech: tl.tech })))
  const driveMin = stops.reduce((n, s) => n + (Number.isFinite(s.drive) ? s.drive : 0), 0)
  const wasted = stops.filter((s) => s.wasted).length
  const finished = stops.filter((s) => !s.wasted && !s.outsideShift).length
  const urgent = stops.filter((s) => s.job.urgency === 3)
  const response = urgent.length
    ? urgent.reduce((n, s) => n + (s.start - ctx.shift[0]) + (s.wasted ? 480 : 0), 0) / urgent.length
    : 0
  const keyed = stops.filter((s) => s.job.key)
  const notes = keyed.filter((s) => s.note.toLowerCase().includes(s.job.key.toLowerCase())).length
  const notesTotal = ctx.jobs.filter((j) => j.key).length
  const skill = stops.filter((s) => !s.skillMismatch).length
  const scheduled = stops.length
  const work = stops.reduce((n, s) => n + s.job.dur, 0)
  let cost = wasted * 25
  for (const tl of timelines) {
    const mine = tl.stops
    if (tl.tech.vendor) cost += mine.length * (tl.tech.flat ?? 0)
    else cost += ((tl.tech.rate ?? 38) * mine.reduce((n, s) => n + s.job.dur + (Number.isFinite(s.drive) ? s.drive : 0), 0)) / 60
  }
  const downgraded = ctx.jobs.filter((j) => j.urgency !== null && (urgencyMap[j.id] ?? j.urgency) < j.urgency)
  return { driveMin, work, scheduled, urgentCount: urgent.length, wasted, finished, response, notes, notesTotal, skill, cost: Math.round(cost), total: ctx.jobs.length, downgraded }
}

export function gates(ctx, planScore, handScore) {
  const down = planScore.downgraded
  const worse = []
  if (planScore.finished < handScore.finished) worse.push('finishes fewer jobs')
  if (planScore.wasted > handScore.wasted) worse.push('wastes more trips')
  // Costing more only counts against a plan that does not get more jobs finished for the extra money.
  if (planScore.cost > handScore.cost && planScore.finished <= handScore.finished) worse.push('costs more')
  return [
    {
      label: 'No emergency treated as less urgent than it is',
      ok: !down.length,
      skipped: !ctx.hasUrgency,
      detail: !ctx.hasUrgency
        ? 'Not checked: this case file gave no reference urgency for the requests.'
        : down.length ? down.map((j) => `${j.id} (${j.rid}) is ${URGENCY[j.urgency]} but was marked less urgent`).join('; ') : 'Every request kept at least its true urgency.',
    },
    {
      label: 'Plan is not worse than the by-hand plan',
      ok: !worse.length,
      detail: worse.length ? `The plan ${worse.join(' and ')} than the by-hand plan.` : 'Jobs finished, wasted trips and cost are all as good as or better than by hand (or cost more only because more jobs got done).',
    },
  ]
}

// ---------- Side-by-side measures: plan against by hand. cmp: 1 = plan better, 0 = same or not comparable, -1 = plan worse. ----------
const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`
export function measureRows(p, h) {
  const sign = (x) => (x > 0 ? 1 : x < 0 ? -1 : 0)
  const moreDone = p.finished > h.finished
  const perVisit = (s) => (s.scheduled ? s.driveMin / s.scheduled : 0)
  const left = (s) => s.total - s.scheduled
  const rows = []
  rows.push({ key: 'finished', label: 'Jobs finished', plan: `${p.finished} of ${p.total}`, hand: `${h.finished} of ${h.total}`, cmp: sign(p.finished - h.finished),
    say: (c) => (c > 0 ? `${plural(p.finished - h.finished, 'more job', 'more jobs')} finished` : `${plural(h.finished - p.finished, 'fewer job', 'fewer jobs')} finished`) })
  rows.push({ key: 'wasted', label: 'Wasted trips', plan: p.wasted, hand: h.wasted, cmp: sign(h.wasted - p.wasted),
    say: (c) => (c > 0 ? plural(h.wasted - p.wasted, 'fewer wasted trip', 'fewer wasted trips') : plural(p.wasted - h.wasted, 'more wasted trip', 'more wasted trips')) })
  const both = p.urgentCount > 0 && h.urgentCount > 0
  rows.push({ key: 'wait', label: 'Avg. wait for an urgent job', plan: both ? `${Math.round(p.response)} min` : '–', hand: both ? `${Math.round(h.response)} min` : '–', cmp: both ? sign(Math.round(h.response) - Math.round(p.response)) : 0,
    say: (c) => (c > 0 ? `urgent jobs reached ${Math.round(h.response - p.response)} min sooner` : `urgent jobs reached ${Math.round(p.response - h.response)} min later`) })
  rows.push({ key: 'notes', label: 'Important notes reached the tech', plan: p.notesTotal ? `${p.notes} of ${p.notesTotal}` : '–', hand: h.notesTotal ? `${h.notes} of ${h.notesTotal}` : '–', cmp: p.notesTotal ? sign(p.notes - h.notes) : 0,
    say: (c) => (c > 0 ? `${plural(p.notes - h.notes, 'more note', 'more notes')} reached the technician` : `${plural(h.notes - p.notes, 'fewer note', 'fewer notes')} reached the technician`) })
  rows.push({ key: 'skill', label: 'Right skill for the job', plan: `${p.skill} of ${p.scheduled} visits`, hand: `${h.skill} of ${h.scheduled} visits`, cmp: sign(p.skill - h.skill),
    say: (c) => (c > 0 ? `${plural(p.skill - h.skill, 'more visit', 'more visits')} by the right skill` : `${plural(h.skill - p.skill, 'fewer visit', 'fewer visits')} by the right skill`) })
  rows.push({ key: 'unplanned', label: 'Jobs nobody was sent to', plan: left(p), hand: left(h), cmp: sign(left(h) - left(p)),
    say: (c) => (c > 0 ? `${plural(left(h) - left(p), 'job', 'jobs')} the by-hand plan left with nobody` : `${plural(left(p) - left(h), 'more job', 'more jobs')} left with nobody`) })
  // More driving or cost is not "worse" when it comes with more jobs done, so those cases show as neutral.
  const driveCmp = p.driveMin < h.driveMin ? 1 : p.driveMin === h.driveMin ? 0 : moreDone || perVisit(p) <= perVisit(h) ? 0 : -1
  rows.push({ key: 'drive', label: 'Drive time', plan: `${p.driveMin} min`, hand: `${h.driveMin} min`, cmp: driveCmp,
    note: p.driveMin > h.driveMin && driveCmp === 0 ? 'More driving, but more jobs done' : '',
    say: (c) => (c > 0 ? `${h.driveMin - p.driveMin} min less driving` : `${p.driveMin - h.driveMin} min more driving`) })
  const costCmp = p.cost < h.cost ? 1 : p.cost === h.cost ? 0 : moreDone ? 0 : -1
  rows.push({ key: 'cost', label: 'Estimated cost (not in the score)', plan: '$' + p.cost, hand: '$' + h.cost, cmp: costCmp,
    note: p.cost > h.cost && costCmp === 0 ? 'Costs more, but more jobs done' : '',
    say: (c) => (c > 0 ? '$' + (h.cost - p.cost) + ' cheaper' : '$' + (p.cost - h.cost) + ' more expensive') })
  return rows
}

// ---------- The 0-100 score. Plan and by-hand plan are scored on the same rubric. ----------
export const GATE_CAP = 40
const clamp = (x) => Math.max(0, Math.min(1, x))

export function points(s) {
  const pct = (a, b) => (b ? a / b : 0)
  const parts = [
    { key: 'done', label: 'Jobs done on time, inside entry windows and hours', weight: 35, frac: pct(s.finished, s.total), detail: `${s.finished} of ${s.total}` },
    { key: 'skill', label: 'Right skill sent to each job', weight: 15, frac: pct(s.skill, s.total), detail: `${s.skill} of ${s.scheduled} visits had the right skill${s.scheduled < s.total ? `; ${s.total - s.scheduled} jobs got nobody` : ''}` },
    { key: 'urgent', label: 'Urgent jobs reached quickly', weight: 20, frac: clamp(1 - (s.response - 60) / 300), detail: `${Math.round(s.response)} min average wait`, na: s.urgentCount === 0 },
    { key: 'notes', label: 'Resident notes reached the technician', weight: 15, frac: pct(s.notes, s.notesTotal), detail: `${s.notes} of ${s.notesTotal}`, na: s.notesTotal === 0 },
    { key: 'drive', label: 'Time spent working, not driving', weight: 15, frac: s.work + s.driveMin ? s.work / (s.work + s.driveMin) : 0, detail: `${Math.round((s.work / Math.max(1, s.work + s.driveMin)) * 100)}% of on-the-clock time` },
  ]
  const live = parts.filter((p) => !p.na)
  const total = Math.round((live.reduce((n, p) => n + p.weight * p.frac, 0) / live.reduce((n, p) => n + p.weight, 0)) * 100)
  const wsum = live.reduce((n, p) => n + p.weight, 0)
  return { parts: parts.map((p) => ({ ...p, max: p.na ? 0 : Math.round((p.weight / wsum) * 100), got: p.na ? 0 : Math.round(((p.weight * p.frac) / wsum) * 100 * 10) / 10 })), total }
}

export function verdictFor(score) {
  return score >= 85 ? 'Strong' : score >= 70 ? 'Good' : score >= 50 ? 'Fair' : 'Weak'
}

// Grades one plan on one day. `entry` is {plan, urgency}: the planner's plan and its own urgency ratings.
export function runEvaluation(ctx, entry) {
  const planTl = simulate(ctx, entry.plan)
  const check = checkPlan(ctx, planTl)
  const handTl = simulate(ctx, handPlan(ctx), { ignoreWindows: true })
  const planScore = check.ok ? score(ctx, planTl, entry.urgency || {}) : null
  const handScore = score(ctx, handTl, {})
  const gateList = check.ok ? gates(ctx, planScore, handScore) : []
  const pass = check.ok && gateList.every((g) => g.ok)
  const planPts = planScore ? points(planScore) : null
  const handPts = points(handScore)
  const capped = !!planPts && !pass
  const final = planPts ? (capped ? Math.min(planPts.total, GATE_CAP) : planPts.total) : null
  return { planTl, handTl, check, planScore, handScore, gateList, pass, planPts, handPts, capped, final }
}
