import { COMMUNITIES, JOBS, SHIFT_END, SHIFT_START, TECHS, travel } from './data.js'

// A simple rule-based planner. It reads only the requests and the crew (never the answer key).
// Rules, in order:
//  1. Urgent jobs first, then tighter entry windows, then earlier opening windows.
//  2. Only technicians with the right skill who work in that region.
//  3. Among those, pick the one who can start soonest while staying inside the entry window and the shift.
//  4. Break ties by the shorter drive, then by whoever has fewer jobs. This groups jobs by community.
//  5. Every stop carries the resident's notes.
export function livePlan(jobs = JOBS, { prioritize = true } = {}) {
  const state = Object.fromEntries(TECHS.map((t) => [t.id, { time: SHIFT_START, loc: t.base, list: [] }]))
  const byRules = (a, b) => b.urgency - a.urgency || a.win[1] - a.win[0] - (b.win[1] - b.win[0]) || a.win[0] - b.win[0] || a.id.localeCompare(b.id)
  const order = [...jobs].sort(prioritize ? byRules : (a, b) => a.id.localeCompare(b.id, undefined, { numeric: true }))
  for (const job of order) {
    const options = TECHS.filter(
      (t) => t.skills.includes(job.skill) && COMMUNITIES[t.base].region === COMMUNITIES[job.comm].region,
    ).map((t) => {
      const s = state[t.id]
      const drive = travel(s.loc, job.comm)
      const start = Math.max(s.time + drive, job.win[0])
      const end = start + job.dur
      return { t, drive, start, end, fits: end <= job.win[1] && end <= SHIFT_END, jobs: s.list.length }
    })
    options.sort((a, b) => Number(b.fits) - Number(a.fits) || a.start - b.start || a.drive - b.drive || a.jobs - b.jobs)
    const pick = options[0]
    if (!pick) continue // nobody can do this job; the plan check reports it as missing
    const s = state[pick.t.id]
    s.time = pick.end
    s.loc = job.comm
    s.list.push({ id: job.id, note: job.note })
  }
  return Object.fromEntries(TECHS.map((t) => [t.id, state[t.id].list]))
}

export const LIVE_SCENARIO = {
  id: 'live',
  label: 'Live planner (generated)',
  blurb: 'A rule-based planner builds the plan from the spreadsheet data when you run it. Nothing is typed in.',
  selfReport: 'No self-reported score given',
  urgency: {},
  rules: [
    'Urgent jobs first, then jobs with the tightest entry windows.',
    'Only technicians with the right skill who work in that region.',
    'Pick whoever can start soonest inside the resident’s entry window and the shift.',
    'On a tie, prefer the shorter drive (grouping jobs by community), then whoever has fewer jobs.',
    'Pass the resident’s notes to the technician on every stop.',
  ],
  plan: livePlan(),
}
