import { runEvaluation } from './evaluate.js'
import { rng } from './planners.js'

// 95% Wilson interval for "k of n runs passed". Honest about small samples: 10 of 10 is not "100% for sure".
export function wilson(k, n) {
  if (!n) return [0, 0]
  const z = 1.96
  const p = k / n
  const d = 1 + (z * z) / n
  const c = p + (z * z) / (2 * n)
  const m = z * Math.sqrt((p * (1 - p)) / n + (z * z) / (4 * n * n))
  return [Math.max(0, (c - m) / d), Math.min(1, (c + m) / d)]
}

export const jobName = (ctx, id) => {
  const j = ctx.jobById[id]
  return j ? `${j.id} (${j.rid}, ${j.trade})` : id
}

// Everything that went wrong in one graded run. "hard" problems make the run fail; "soft" ones only cost points.
function issuesOf(ctx, result, urgency) {
  const out = []
  const add = (code, label, hard, jobs = []) => out.push({ code, label, hard, jobs })
  const seen = {}
  result.planTl.forEach((tl) => tl.stops.forEach((s) => (seen[s.job.id] = (seen[s.job.id] || 0) + 1)))
  const missing = ctx.jobs.filter((j) => !seen[j.id]).map((j) => j.id)
  const dupes = Object.keys(seen).filter((id) => seen[id] > 1)
  if (missing.length || dupes.length) add('coverage', 'A request was left out or planned twice', true, [...missing, ...dupes])
  const stops = result.planTl.flatMap((tl) => tl.stops)
  const pick = (fn) => stops.filter(fn).map((s) => s.job.id)
  if (pick((s) => s.overlap).length) add('overlap', 'A technician was in two places at once', true, pick((s) => s.overlap))
  if (pick((s) => s.outsideShift).length) add('hours', 'A job fell outside working hours', true, pick((s) => s.outsideShift))
  const down = ctx.jobs.filter((j) => j.urgency !== null && (urgency[j.id] ?? j.urgency) < j.urgency)
  if (down.length) add('downgrade', 'An emergency was marked less urgent than it is', true, down.map((j) => j.id))
  if (result.check.ok && result.gateList.some((g) => g.label.startsWith('Plan is not worse') && !g.ok)) {
    add('worse', 'The plan was worse than the by-hand plan', true)
  }
  if (pick((s) => s.skillMismatch).length) add('skill', 'A technician without the right skill was sent', false, pick((s) => s.skillMismatch))
  if (pick((s) => s.wasted).length) add('window', 'A trip fell outside the resident’s entry window', false, pick((s) => s.wasted))
  const noNote = stops.filter((s) => s.job.key && !s.note.toLowerCase().includes(s.job.key.toLowerCase())).map((s) => s.job.id)
  if (noNote.length) add('note', 'An important resident note did not reach the technician', false, noNote)
  return out
}

// Runs one planner `n` times and summarises the spread. A deterministic planner is run once: repeating changes nothing.
export function runBatch(planner, ctx, n, seed = 2026) {
  const count = planner.kind === 'deterministic' ? 1 : n
  const rand = rng(seed)
  const runs = []
  for (let i = 0; i < count; i++) {
    const { plan, urgency } = planner.generate(ctx, rand)
    const result = runEvaluation(ctx, { plan, urgency })
    const issues = issuesOf(ctx, result, urgency)
    runs.push({ i, pass: result.pass, issues, result, urgency, scored: !!result.planScore })
  }
  return summarise(planner, ctx, runs)
}

export function summarise(planner, ctx, runs) {
  const n = runs.length
  const passes = runs.filter((r) => r.pass).length
  const [lo, hi] = wilson(passes, n)
  const tally = {}
  const perJob = {}
  for (const r of runs) {
    const codes = new Set()
    for (const is of r.issues) {
      codes.add(is.code)
      tally[is.code] = tally[is.code] || { label: is.label, hard: is.hard, runs: 0 }
      is.jobs.forEach((id) => {
        perJob[id] = perJob[id] || new Set()
        perJob[id].add(r.i)
      })
    }
    codes.forEach((c) => tally[c].runs++)
  }
  const patterns = Object.values(tally).sort((a, b) => Number(b.hard) - Number(a.hard) || b.runs - a.runs)
  const problemJobs = Object.entries(perJob)
    .map(([id, set]) => ({ id, runs: set.size }))
    .sort((a, b) => b.runs - a.runs)
    .slice(0, 3)
  const scored = runs.filter((r) => r.scored)
  const spread = (fn) => {
    const v = scored.map((r) => fn(r.result.planScore))
    return v.length ? { min: Math.min(...v), max: Math.max(...v), mean: v.reduce((a, b) => a + b, 0) / v.length } : null
  }
  const unsafeRuns = runs.filter((r) => r.issues.some((x) => x.code === 'downgrade')).length
  const worst =
    runs.filter((r) => !r.pass).sort((a, b) => b.issues.filter((x) => x.hard).length - a.issues.filter((x) => x.hard).length || b.issues.length - a.issues.length)[0] ||
    [...runs].sort((a, b) => b.issues.length - a.issues.length)[0]
  let verdict
  if (unsafeRuns) verdict = { level: 'unsafe', text: `Not safe to rely on: an emergency was played down in ${unsafeRuns} of ${n} runs.` }
  else if (planner.kind === 'pasted') verdict = passes ? { level: 'promising', text: 'This one plan passed. One plan cannot show how consistent the model is: ask it again and paste a few more.' } : { level: 'weak', text: 'This plan failed. See what went wrong below.' }
  else if (planner.kind === 'deterministic') verdict = passes ? { level: 'reliable', text: 'Passes, and always will: the same rules give the same plan.' } : { level: 'weak', text: 'Fails, and will fail every time.' }
  else if (passes === n && n >= 10) verdict = { level: 'reliable', text: `Passed all ${n} runs. Looks dependable, though a few more runs would firm that up.` }
  else if (passes === n) verdict = { level: 'promising', text: `Passed all ${n} runs, but that is too few to trust. Run more.` }
  else if (passes / n >= 0.9) verdict = { level: 'mostly', text: 'Usually passes, but not every time. A person should check its plans.' }
  else verdict = { level: 'weak', text: 'Fails too often to use without close review.' }
  return {
    planner, ctx, runs, n, passes, rate: passes / n, lo, hi, patterns, problemJobs, unsafeRuns, worst, verdict,
    drive: spread((s) => s.driveMin), cost: spread((s) => s.cost), wasted: spread((s) => s.wasted),
  }
}

// Grade a single pasted plan (a real model's answer): a sample of one, labelled as such.
export function gradeSingle(label, ctx, plan, urgency) {
  const planner = { id: 'pasted', label, kind: 'pasted', blurb: 'One plan you pasted in. One plan is only one sample of what that model can do.' }
  const result = runEvaluation(ctx, { plan, urgency })
  return summarise(planner, ctx, [{ i: 0, pass: result.pass, issues: issuesOf(ctx, result, urgency), result, urgency, scored: !!result.planScore }])
}
