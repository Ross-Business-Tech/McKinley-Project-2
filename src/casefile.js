import { COMMUNITIES, JOBS, SHEET_NAME, SHIFT_END, SHIFT_START, TECHS, travel as sampleTravel } from './data.js'

// A "case file" is one self-contained JSON file: a day of requests, the crew, drive times and (optionally) a plan.
// Any planner can write one, and this evaluator reads it. See CASE-FILE.md for the format.

const NAMED = { urgent: 3, soon: 2, routine: 1 }
let nextId = 1

export function toMin(v) {
  if (typeof v === 'number') return Number.isFinite(v) && v >= 0 && v <= 1440 ? v : NaN
  const m = String(v ?? '').trim().match(/^(\d{1,2})(?::(\d{2}))?\s*(am|pm)?$/i)
  if (!m) return NaN
  let h = Number(m[1])
  const mm = Number(m[2] || 0)
  const ap = m[3]?.toLowerCase()
  if (mm > 59) return NaN
  if (ap) {
    if (h < 1 || h > 12) return NaN
    h = (h % 12) + (ap === 'pm' ? 12 : 0)
  } else if (h > 24) return NaN
  return h * 60 + mm
}
export const toClock = (m) => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(Math.round(m % 60)).padStart(2, '0')}`

export function urgencyOf(v) {
  if (v === undefined || v === null || v === '') return null
  const n = typeof v === 'string' ? (NAMED[v.toLowerCase()] ?? Number(v)) : Number(v)
  return n >= 1 && n <= 3 ? n : NaN
}

function findJson(text) {
  const a = text.indexOf('{')
  const b = text.lastIndexOf('}')
  if (a < 0 || b < a) return { error: 'I could not find any JSON in that text.' }
  try {
    return { data: JSON.parse(text.slice(a, b + 1)) }
  } catch {
    return { error: 'That looks like JSON, but it is cut off or has a typo.' }
  }
}

const bad = (error) => ({ error })

// Reads a plan from a model's answer or from a case file's "plan" section, checked against a day.
export function normalizePlan(data, ctx) {
  if (!data || typeof data !== 'object') return bad('The plan should be a JSON object.')
  let raw
  let urg
  if (data.plan?.assignments) [raw, urg] = [data.plan.assignments, data.plan.urgency ?? data.urgency]
  else if (data.assignments) [raw, urg] = [data.assignments, data.urgency]
  else if (data.plan && typeof data.plan === 'object') [raw, urg] = [data.plan, data.urgency]
  else [raw, urg] = [data, data.urgency]
  const plan = Object.fromEntries(ctx.crew.map((t) => [t.id, []]))
  const crewIds = ctx.crew.map((t) => t.id).join(', ')
  const jobIds = ctx.jobs.map((j) => j.id).join(', ')
  for (const [tid, list] of Object.entries(raw || {})) {
    if (tid === 'urgency' || tid === 'planner') continue
    if (!plan[tid]) return bad(`The plan names a technician "${tid}" who is not on this day's crew (use ${crewIds}).`)
    if (!Array.isArray(list)) return bad(`Technician ${tid} should have a list of requests.`)
    for (const item of list) {
      const id = typeof item === 'string' ? item : item?.id
      if (ctx.heldById[id]) return bad(`The plan schedules request "${id}", but it is on hold (${ctx.heldById[id].reason}).`)
      if (!ctx.jobById[id]) return bad(`The plan includes a request "${id}" that is not in this day (use ${jobIds}).`)
      const at = toMin(item?.start ?? item?.at)
      plan[tid].push({ id, note: typeof item?.note === 'string' ? item.note : '', ...(Number.isFinite(at) ? { at } : {}) })
    }
  }
  const urgency = {}
  for (const [id, v] of Object.entries(urg || {})) {
    const n = urgencyOf(v)
    if (ctx.jobById[id] && n >= 1) urgency[id] = n
  }
  return { plan, urgency, gaveUrgency: Object.keys(urgency).length > 0 }
}

// Turns a case file (object) into the day the evaluator works on, or says in plain words what is wrong.
export function normalizeCase(d) {
  if (!d || typeof d !== 'object') return bad('A case file should be a JSON object.')
  const comms = {}
  for (const [code, c] of Object.entries(d.communities || {})) comms[code] = { name: c?.name || code, region: c?.region || 'Region' }
  if (!Object.keys(comms).length) return bad('The case file needs a "communities" section, for example {"HL": {"name": "Heron Lake", "region": "Orlando"}}.')
  const shift = [toMin(d.shift?.start ?? '08:00'), toMin(d.shift?.end ?? '16:00')]
  if (!(shift[0] < shift[1])) return bad('The "shift" start must be earlier than its end, for example "08:00" to "16:00".')

  const tr = d.travel || {}
  const within = Number.isFinite(tr.within) ? tr.within : 5
  const otherMinutes = Number.isFinite(tr.otherMinutes) ? tr.otherMinutes : null
  const pairMap = new Map()
  const pk = (a, b) => [a, b].sort().join('|')
  const travelPairs = []
  for (const p of tr.pairs || []) {
    if (!comms[p?.a] || !comms[p?.b]) return bad(`A drive time names a community that is not listed: ${p?.a} to ${p?.b}.`)
    if (!(p.minutes >= 0)) return bad(`The drive time from ${p.a} to ${p.b} should be a number of minutes.`)
    pairMap.set(pk(p.a, p.b), p.minutes)
    travelPairs.push({ a: p.a, b: p.b, minutes: p.minutes })
  }
  const travel = (a, b) => (a === b ? within : pairMap.has(pk(a, b)) ? pairMap.get(pk(a, b)) : (otherMinutes ?? Infinity))

  if (!Array.isArray(d.crew) || !d.crew.length) return bad('The case file needs a "crew" list with at least one technician.')
  const crew = []
  for (const t of d.crew) {
    if (!t?.id || !Array.isArray(t.skills) || !t.skills.length) return bad('Every crew member needs an "id" and a list of "skills".')
    if (crew.some((c) => c.id === t.id)) return bad(`Two crew members share the id "${t.id}".`)
    if (!comms[t.base]) return bad(`Crew member ${t.id} starts at "${t.base}", which is not a listed community.`)
    if (t.serves !== undefined && (!Array.isArray(t.serves) || t.serves.some((c) => !comms[c]))) return bad(`Crew member ${t.id} has a "serves" list with a community that is not listed.`)
    crew.push({ id: t.id, name: t.name || t.id, trade: t.trade || t.skills.join(' + '), skills: t.skills.map((s) => String(s).toLowerCase()), base: t.base, serves: t.serves || null, rate: t.rate, vendor: !!t.vendor, flat: t.flat })
  }

  if (!Array.isArray(d.requests) || !d.requests.length) return bad('The case file needs a "requests" list with at least one request.')
  const jobs = []
  const held = []
  for (const r of d.requests) {
    if (!r?.id) return bad('Every request needs an "id".')
    if (jobs.some((j) => j.id === r.id) || held.some((j) => j.id === r.id)) return bad(`Two requests share the id "${r.id}".`)
    if (r.hold) {
      // On hold: listed and shown, but not scheduled or scored (for example, waiting on the resident's OK to enter).
      if (r.community && !comms[r.community]) return bad(`Request ${r.id} is at "${r.community}", which is not a listed community.`)
      const hu = urgencyOf(r.urgency)
      if (Number.isNaN(hu)) return bad(`Request ${r.id} has an urgency that is not 1, 2 or 3 (or routine, soon, urgent).`)
      held.push({ id: r.id, rid: r.resident || r.id, comm: r.community || null, trade: r.trade || r.skill || '', text: r.text || '', reason: String(r.hold), urgency: hu })
      continue
    }
    if (!comms[r.community]) return bad(`Request ${r.id} is at "${r.community}", which is not a listed community.`)
    const skill = String(r.skill || r.trade || '').toLowerCase()
    if (!skill) return bad(`Request ${r.id} needs a "skill" (the trade it needs).`)
    if (!(r.durationMin > 0)) return bad(`Request ${r.id} needs a "durationMin" (minutes the job takes).`)
    const win = [toMin(r.window?.[0] ?? r.window?.start ?? '08:00'), toMin(r.window?.[1] ?? r.window?.end ?? '16:00')]
    if (!(win[0] < win[1])) return bad(`Request ${r.id} has an entry "window" that does not make sense. Use two times such as ["09:00", "15:00"].`)
    const urgency = urgencyOf(r.urgency)
    if (Number.isNaN(urgency)) return bad(`Request ${r.id} has an urgency that is not 1, 2 or 3 (or routine, soon, urgent).`)
    jobs.push({
      id: r.id, rid: r.resident || r.id, comm: r.community, trade: r.trade || r.skill, skill, dur: r.durationMin, win, urgency,
      key: r.mustTell ? String(r.mustTell) : null, text: r.text || '', note: r.note || '', hidden: Array.isArray(r.facts) ? r.facts : [], iid: r.source || '',
    })
  }

  if (!jobs.length) return bad('Every request in this file is on hold, so there is nothing to schedule.')
  const canServe = (t, j) => (t.serves ? t.serves.includes(j.comm) : comms[t.base].region === comms[j.comm].region)
  const warnings = []
  for (const j of jobs) {
    if (!crew.some((t) => t.skills.includes(j.skill) && canServe(t, j))) {
      warnings.push(`${j.id}: nobody on the crew has the "${j.skill}" skill for ${comms[j.comm].name}, so no plan can cover it.`)
    }
  }
  const ctx = {
    id: nextId++, title: d.title || 'Untitled day', source: d.source || '', isSample: false,
    shift, comms, within, otherMinutes, travelPairs, travel, crew, canServe, jobs, held, heldById: Object.fromEntries(held.map((h) => [h.id, h])), jobById: Object.fromEntries(jobs.map((j) => [j.id, j])),
    hasUrgency: jobs.some((j) => j.urgency !== null), warnings,
  }
  let loaded = null
  if (d.plan) {
    const p = normalizePlan({ plan: d.plan }, ctx)
    if (p.error) return bad(p.error)
    loaded = { planner: d.plan.planner || 'Plan from file', plan: p.plan, urgency: p.urgency, gaveUrgency: p.gaveUrgency }
  }
  return { ctx, loaded }
}

export function parseCase(text) {
  const j = findJson(text)
  return j.error ? bad(`${j.error} Choose or paste a whole case file.`) : normalizeCase(j.data)
}

// Writes a day (and optionally a plan) back out as a case file.
export function exportCase(ctx, out) {
  const file = {
    format: 'plan-case/v1',
    title: ctx.title,
    source: ctx.source,
    shift: { start: toClock(ctx.shift[0]), end: toClock(ctx.shift[1]) },
    communities: ctx.comms,
    travel: { within: ctx.within, pairs: ctx.travelPairs, ...(ctx.otherMinutes !== null ? { otherMinutes: ctx.otherMinutes } : {}) },
    crew: ctx.crew.map((t) => ({ id: t.id, name: t.name, trade: t.trade, skills: t.skills, base: t.base, ...(t.serves ? { serves: t.serves } : {}), ...(t.vendor ? { vendor: true, flat: t.flat } : { rate: t.rate }) })),
    requests: ctx.jobs.map((j) => ({
      id: j.id, resident: j.rid, community: j.comm, trade: j.trade, skill: j.skill, durationMin: j.dur,
      window: [toClock(j.win[0]), toClock(j.win[1])], ...(j.urgency !== null ? { urgency: j.urgency } : {}),
      ...(j.key ? { mustTell: j.key } : {}), text: j.text, note: j.note, ...(j.hidden.length ? { facts: j.hidden } : {}), ...(j.iid ? { source: j.iid } : {}),
    })),
  }
  for (const h of ctx.held) {
    file.requests.push({ id: h.id, resident: h.rid, ...(h.comm ? { community: h.comm } : {}), trade: h.trade, ...(h.urgency !== null ? { urgency: h.urgency } : {}), text: h.text, hold: h.reason })
  }
  if (out) {
    file.plan = {
      planner: out.planner || 'Unnamed planner',
      assignments: Object.fromEntries(Object.entries(out.plan).map(([t, l]) => [t, l.map((s) => ({ id: s.id, ...(s.at !== undefined ? { start: toClock(s.at) } : {}), note: s.note || '' }))])),
      urgency: out.urgency || {},
    }
  }
  return file
}

// The built-in sample day (from the sprint spreadsheet), expressed as a normal case file.
export function sampleDay() {
  const codes = Object.keys(COMMUNITIES)
  const pairs = []
  for (let i = 0; i < codes.length; i++)
    for (let j = i + 1; j < codes.length; j++) {
      const m = sampleTravel(codes[i], codes[j])
      if (Number.isFinite(m)) pairs.push({ a: codes[i], b: codes[j], minutes: m })
    }
  const res = normalizeCase({
    title: 'Sample day (from the sprint spreadsheet)',
    source: SHEET_NAME,
    shift: { start: toClock(SHIFT_START), end: toClock(SHIFT_END) },
    communities: COMMUNITIES,
    travel: { within: 5, pairs },
    crew: TECHS.map((t) => ({ id: t.id, name: t.name, trade: t.trade, skills: t.skills, base: t.base, rate: t.rate, vendor: t.vendor, flat: t.flat })),
    requests: JOBS.map((j) => ({
      id: j.id, resident: j.rid, community: j.comm, trade: j.trade, skill: j.skill, durationMin: j.dur, window: j.win, urgency: j.urgency,
      mustTell: j.key, text: j.text, note: j.note, facts: j.hidden, source: `Row ${j.iid}`,
    })),
  })
  res.ctx.isSample = true
  return res.ctx
}
