// The shipped experiment: compare maintenance planners over many generated days.
// A "day" is a seeded variation of Shivaji's 11-job day: a random subset of jobs with jittered durations.
import { JOBS } from '../data.js'
import { checkPlan, handPlan, runEvaluation, simulate } from '../evaluate.js'
import { livePlan } from '../planner.js'
import { mulberry32 } from './stats.js'
import { sha } from './runner.js'

export function makeDays(count, seed = 1) {
  return Array.from({ length: count }, (_, i) => {
    const rand = mulberry32(seed * 100003 + i)
    const keep = JOBS.filter(() => rand() < 0.8)
    const jobs = (keep.length >= 3 ? keep : JOBS.slice(0, 3)).map((j) => ({ ...j, dur: Math.max(10, j.dur + Math.round((rand() - 0.5) * 20)) }))
    const urgent = jobs.filter((j) => j.urgency === 3).length
    const day = { id: `day-${String(i).padStart(4, '0')}`, jobs, tags: { size: jobs.length >= 9 ? 'busy' : 'light', urgent: urgent >= 2 ? 'two-plus' : 'few' } }
    return { ...day, hash: sha(day) }
  })
}

// Turn one plan into the numbers we compare. Invalid plans count as unfinished work, never as success.
export function planMetrics(plan, day, { ignoreWindows = false } = {}) {
  const tl = simulate(plan, { jobs: day.jobs, ignoreWindows })
  const check = checkPlan(tl, day.jobs)
  const total = day.jobs.length
  if (!check.ok) return { valid: 0, finishedRate: 0, wasted: total, driveMin: 0, cost: 0, response: 480 }
  const s = runEvaluation({ plan, urgency: {} }, day.jobs).planScore
  return { valid: 1, finishedRate: s.finished / total, wasted: s.wasted, driveMin: s.driveMin, cost: s.cost, response: s.response }
}

const planner = (id, make, params, opts) => ({
  id,
  params,
  version: 1,
  run: async (day) => {
    const plan = make(day.jobs)
    return { metrics: planMetrics(plan, day, opts), output: Object.fromEntries(Object.entries(plan).map(([t, l]) => [t, l.map((s) => s.id)])) }
  },
})

export const defaultVariants = () => [
  // The by-hand plan is the baseline; like the original evaluator it ignores entry windows when it simulates.
  planner('hand', handPlan, { kind: 'by-hand' }, { ignoreWindows: true }),
  planner('live', (jobs) => livePlan(jobs), { kind: 'rules', prioritize: true }),
  planner('live-no-priority', (jobs) => livePlan(jobs, { prioritize: false }), { kind: 'rules', prioritize: false }),
]

export const defaultConfig = {
  baseline: 'hand',
  metrics: {
    finishedRate: { higherIsBetter: true, minEffect: 0.02 },
    wasted: { higherIsBetter: false, minEffect: 0.25 },
    driveMin: { higherIsBetter: false, minEffect: 5 },
    cost: { higherIsBetter: false, minEffect: 10 },
    response: { higherIsBetter: false, minEffect: 10 },
  },
  slices: (day) => day ? [`size:${day.tags.size}`, `urgent:${day.tags.urgent}`] : [],
  pareto: { quality: 'finishedRate', cost: 'cost' },
  alpha: 0.05,
  correction: 'holm',
  minCoverage: 0.8,
}
