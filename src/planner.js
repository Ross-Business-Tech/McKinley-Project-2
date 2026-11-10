// A simple rule-based planner. It reads only the requests and the crew in the day it is given.
// Rules, in order:
//  1. Urgent jobs first, then tighter entry windows, then earlier opening windows.
//  2. Only technicians with the right skill who work in that region.
//  3. Among those, pick the one who can start soonest while staying inside the entry window and the shift.
//  4. Break ties by the shorter drive, then by whoever has fewer jobs. This groups jobs by community.
//  5. Every stop carries the resident's notes.
export function livePlan(ctx) {
  const state = Object.fromEntries(ctx.crew.map((t) => [t.id, { time: ctx.shift[0], loc: t.base, list: [] }]))
  const order = [...ctx.jobs].sort(
    (a, b) => (b.urgency ?? 0) - (a.urgency ?? 0) || a.win[1] - a.win[0] - (b.win[1] - b.win[0]) || a.win[0] - b.win[0] || a.id.localeCompare(b.id),
  )
  for (const job of order) {
    const region = ctx.comms[job.comm].region
    const options = ctx.crew
      .filter((t) => t.skills.includes(job.skill) && ctx.comms[t.base].region === region)
      .map((t) => {
        const s = state[t.id]
        const drive = ctx.travel(s.loc, job.comm)
        const start = Math.max(s.time + drive, job.win[0])
        const end = start + job.dur
        return { t, drive, start, end, fits: end <= job.win[1] && end <= ctx.shift[1], jobs: s.list.length }
      })
    if (!options.length) continue // nobody can do it: the plan will honestly show it uncovered
    options.sort((a, b) => Number(b.fits) - Number(a.fits) || a.start - b.start || a.drive - b.drive || a.jobs - b.jobs)
    const pick = options[0]
    const s = state[pick.t.id]
    s.time = pick.end
    s.loc = job.comm
    s.list.push({ id: job.id, note: job.note })
  }
  return Object.fromEntries(ctx.crew.map((t) => [t.id, state[t.id].list]))
}

export function liveScenario(ctx) {
  return {
    id: 'live',
    label: 'Rule-based planner',
    blurb: 'A rule-based planner builds the plan from this day’s data when you run it. Nothing is typed in.',
    selfReport: 'No self-reported score given',
    urgency: {},
    rules: [
      'Urgent jobs first, then jobs with the tightest entry windows.',
      'Only technicians with the right skill who work in that region.',
      'Pick whoever can start soonest inside the resident’s entry window and the shift.',
      'On a tie, prefer the shorter drive (grouping jobs by community), then whoever has fewer jobs.',
      'Pass the resident’s notes to the technician on every stop.',
    ],
    plan: livePlan(ctx),
  }
}
