import { fmt } from './evaluate.js'
import { livePlan } from './planner.js'
import { normalizePlan } from './casefile.js'

// ---------- A tiny seeded random generator, so a batch of runs can be repeated exactly ----------
export function rng(seed) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

// ---------- Simulated models ----------
// These are NOT real AI models. Real models give a slightly different plan each time and sometimes slip.
// Each simulated planner starts from the sound rule-based plan and, for every request, may make one of
// the mistakes people have seen from AI planners. The chance of each mistake is its "profile".
const PROFILES = {
  steady: { drop: 0.003, noNote: 0.01, wrongSkill: 0.005, ignoreWindow: 0.008, downgrade: 0.003, reverse: 0.01 },
  rushed: { drop: 0.015, noNote: 0.06, wrongSkill: 0.03, ignoreWindow: 0.05, downgrade: 0.02, reverse: 0.1 },
  erratic: { drop: 0.1, noNote: 0.3, wrongSkill: 0.15, ignoreWindow: 0.25, downgrade: 0.14, reverse: 0.4 },
}

const clonePlan = (plan) => Object.fromEntries(Object.entries(plan).map(([k, v]) => [k, v.map((s) => ({ ...s }))]))

function mutate(ctx, base, p, rand) {
  const plan = clonePlan(base)
  const urgency = {}
  for (const job of ctx.jobs) {
    const owner = Object.keys(plan).find((t) => plan[t].some((s) => s.id === job.id))
    if (!owner) continue // the rule-based plan could not cover it either
    const idx = plan[owner].findIndex((s) => s.id === job.id)
    if (rand() < p.drop) {
      plan[owner].splice(idx, 1)
      continue
    }
    const stop = plan[owner][idx]
    if (rand() < p.noNote) stop.note = ''
    if (rand() < p.ignoreWindow) stop.at = Math.max(ctx.shift[0], job.win[0] - 90)
    if (job.urgency === 3 && rand() < p.downgrade) urgency[job.id] = 1
    if (rand() < p.wrongSkill) {
      const others = ctx.crew.filter((t) => t.id !== owner && !t.skills.includes(job.skill) && ctx.canServe(t, job))
      if (others.length) {
        plan[owner].splice(idx, 1)
        plan[others[Math.floor(rand() * others.length)].id].push(stop)
      }
    }
  }
  for (const id of Object.keys(plan)) if (rand() < p.reverse) plan[id].reverse()
  return { plan, urgency }
}

export const PLANNERS = [
  {
    id: 'rules',
    label: 'Rule-based planner',
    kind: 'deterministic',
    blurb: 'Fixed rules, so it gives the same plan every time. One run is enough.',
    generate: (ctx) => ({ plan: livePlan(ctx), urgency: {} }),
  },
  ...Object.entries(PROFILES).map(([key, profile]) => ({
    id: `sim-${key}`,
    label: `Simulated model: ${key}`,
    kind: 'simulated',
    blurb: {
      steady: 'Rarely slips. Stands in for a careful model.',
      rushed: 'Slips now and then: forgets notes, ignores some entry windows, sometimes plays an emergency down.',
      erratic: 'Slips often. Stands in for a model that is not well suited to this job.',
    }[key],
    generate: (ctx, rand) => mutate(ctx, livePlan(ctx), profile, rand),
  })),
]

// ---------- Any real planner: copy the day out as a prompt, paste the answer back ----------
export function buildPrompt(ctx) {
  const jobs = ctx.jobs
    .map(
      (j) =>
        `- ${j.id}: ${j.trade} job at ${ctx.comms[j.comm].name}. Takes ${j.dur} min. Resident may only be visited ${fmt(j.win[0])}-${fmt(j.win[1])}.\n  Request: "${j.text}"\n  Staff note to pass on to the technician: ${j.note}`,
    )
    .join('\n')
  const crew = ctx.crew
    .map((t) => `- ${t.id}: ${t.name}, ${t.trade}, starts at ${ctx.comms[t.base].name}${t.vendor ? ` (outside vendor, $${t.flat} per visit)` : ''}`)
    .join('\n')
  const drives = ctx.travelPairs.map((p) => `${ctx.comms[p.a].name} to ${ctx.comms[p.b].name} ${p.minutes} min`).join('; ')
  const first = ctx.jobs[0]
  return `You are planning one day of maintenance visits for an apartment company. Everything below is made-up sample data.

Crew (shift ${fmt(ctx.shift[0])} to ${fmt(ctx.shift[1])}):
${crew}

Drive times: ${drives || 'none listed'}; within one community ${ctx.within} min. Any pair not listed cannot be driven in a day.

Requests:
${jobs}

${ctx.held.length ? `On hold, do NOT schedule these: ${ctx.held.map((h) => h.id).join(', ')}.\n\n` : ''}Rules: cover every request exactly once, only use a technician with the right skill, no one can be in two places at once, stay inside shift hours and each resident's entry window, group jobs by community to save driving, and never treat an emergency as less urgent than it is. Pass each staff note to the technician on that stop.

Answer with JSON only, in this shape:
{"plan": {"${ctx.crew[0].id}": [{"id": "${first.id}", "note": "<the staff note for ${first.id}>"}]${ctx.crew.slice(1).map((t) => `, "${t.id}": []`).join('')}},
 "urgency": {"${first.id}": 3}}
Use the technician ids above as plan keys, listed in visiting order. In "urgency", give your own rating for every request: 3 = Urgent, 2 = Soon, 1 = Routine.`
}

// Turns whatever a model sent back into a plan the evaluator can grade, or says in plain words what is wrong.
export function parsePasted(text, ctx) {
  const start = text.indexOf('{')
  const end = text.lastIndexOf('}')
  if (start < 0 || end < start) return { error: 'I could not find any JSON in that text. Paste the model’s whole answer.' }
  let data
  try {
    data = JSON.parse(text.slice(start, end + 1))
  } catch {
    return { error: 'That looks like JSON, but it is cut off or has a typo. Ask the model to answer with JSON only.' }
  }
  return normalizePlan(data, ctx)
}
