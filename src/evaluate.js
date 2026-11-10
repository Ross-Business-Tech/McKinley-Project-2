import { URGENCY } from './urg.js'

// Everything here works from `ctx`, the day read from a case file (see casefile.js). Nothing is built in.

export function fmt(m) {
  const h = Math.floor(m / 60)
  const mm = String(Math.round(m % 60)).padStart(2, '0')
  return `${h % 12 || 12}:${mm} ${h < 12 ? 'AM' : 'PM'}`
}

const regionOf = (ctx, comm) => ctx.comms[comm].region

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

// The "by hand" plan: urgent first, first eligible tech, no grouping, no waiting for windows.
export function handPlan(ctx) {
  const state = Object.fromEntries(ctx.crew.map((t) => [t.id, { time: ctx.shift[0], loc: t.base, list: [] }]))
  const order = [...ctx.jobs].sort((a, b) => (b.urgency ?? 0) - (a.urgency ?? 0) || a.id.localeCompare(b.id))
  for (const job of order) {
    const options = ctx.crew.filter((t) => t.skills.includes(job.skill) && regionOf(ctx, t.base) === regionOf(ctx, job.comm))
    let best = null
    for (const t of options) {
      const s = state[t.id]
      const finish = s.time + ctx.travel(s.loc, job.comm) + job.dur
      if (!best || finish < best.finish) best = { t, finish }
    }
    if (!best) continue // nobody could do it by hand either
    const s = state[best.t.id]
    s.time = best.finish
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
  let cost = wasted * 25
  for (const tl of timelines) {
    const mine = tl.stops
    if (tl.tech.vendor) cost += mine.length * (tl.tech.flat ?? 0)
    else cost += ((tl.tech.rate ?? 38) * mine.reduce((n, s) => n + s.job.dur + (Number.isFinite(s.drive) ? s.drive : 0), 0)) / 60
  }
  const downgraded = ctx.jobs.filter((j) => j.urgency !== null && (urgencyMap[j.id] ?? j.urgency) < j.urgency)
  return { driveMin, wasted, finished, response, notes, notesTotal, skill, cost: Math.round(cost), total: ctx.jobs.length, downgraded }
}

export function gates(ctx, planScore, handScore) {
  const down = planScore.downgraded
  const worse = []
  if (planScore.finished < handScore.finished) worse.push('finishes fewer jobs')
  if (planScore.wasted > handScore.wasted) worse.push('wastes more trips')
  if (planScore.cost > handScore.cost) worse.push('costs more')
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
      detail: worse.length ? `The plan ${worse.join(' and ')} than the by-hand plan.` : 'Jobs finished, wasted trips and cost are all as good as or better than by hand.',
    },
  ]
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
  return { planTl, handTl, check, planScore, handScore, gateList, pass }
}
