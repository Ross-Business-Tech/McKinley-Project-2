import residents from './residents.json' with { type: 'json' }
import { JOB_TYPES, VENDOR_RULES, REPEAT_THRESHOLD, ENTRY_RULES, TECHS, travelMinutes } from './config.js'

export const RESIDENTS = residents

// ---------- 1. Find the unit ----------
export function findResident(text, chosenId) {
  if (chosenId) return RESIDENTS.find((r) => r.id === chosenId) || null
  const m = text.match(/(?:unit|apt\.?|apartment|#)\s*(\d{3})\b/i)
  if (m) return RESIDENTS.find((r) => r.unit === m[1]) || null
  return null
}

// ---------- 2. Classify the problem (fixed keyword rules) ----------
const PATTERNS = [
  ['gas', /gas|smell(s)? like (rotten )?eggs|propane/i],
  ['fire', /smoke|fire|burning smell|burnt smell|smoldering/i],
  ['sparks', /spark|shock(ed)?|exposed wire|outlet (is )?(hot|melted)|sizzl/i],
  ['flood', /flood|burst pipe|water (is )?(pouring|gushing|everywhere)|pipe burst|inches of water/i],
  ['sewage', /sewage|sewer|raw waste|toilets? (is |are )?(overflow|backing)/i],
  ['noheat', /no heat|heat (is )?(not|n't) working|furnace|heater (is )?(out|broken|not)|freezing (in|inside)|heat (is )?out|heat stopped/i],
  ['noac', /\bac\b|a\/c|air condition|not cooling|no cool|blowing warm/i],
  ['lockout', /locked out|lockout|lost (my )?key|key (is )?stuck|broken lock|can'?t (get|unlock)/i],
  ['nohotwater', /no hot water|hot water (is )?(out|not|gone)|cold shower|water heater/i],
  ['fridge', /fridge|refrigerator|freezer/i],
  ['leak', /leak|drip|under the (sink|cabinet)|water stain/i],
  ['toilet', /toilet|clog|plunger/i],
  ['appliance', /dishwasher|stove|oven|burner|washer|dryer|microwave|disposal|range hood/i],
  ['pest', /roach|cockroach|bed ?bug|mice|mouse|rodent|\brats?\b|ants?\b|pest|termite|wasp/i],
  ['electrical', /outlet|light(s)?\b|breaker|switch|bulb|ceiling fan|doorbell/i],
  ['other', /mold|mildew/i],
  ['amenity', /gate|pool|gym|fitness|clubhouse|mailbox|dumpster|parking|hallway|laundry room|elevator/i],
  ['cosmetic', /paint|caulk|scuff|stain on (the )?wall|nail hole/i],
  ['door', /door|window|cabinet|screen|blind|closet|drawer/i],
]

export function classify(text) {
  for (const [type, re] of PATTERNS) if (re.test(text)) return type
  return 'other'
}

// ---------- 3. Severity (my own 1-5 scale; see config.js) ----------
// Hard rules decide the floor. The text "reader" below can only RAISE a score, never lower it.
export function scoreSeverity(type, text, region, repeats = 0) {
  const reasons = []
  let sev = JOB_TYPES[type].base
  reasons.push(`${JOB_TYPES[type].label}: base level ${sev}`)

  if (type === 'noheat' && region === 'Michigan') {
    sev = 5
    reasons.push('No heat in Michigan is always an emergency')
  }
  if (type === 'noac' && region === 'Orlando') {
    sev = Math.max(sev, 4)
    reasons.push('No AC in Orlando heat is at least urgent')
  }
  if (type === 'noheat' && region === 'Orlando') {
    sev = 3
    reasons.push('No heat in Orlando: soon, but lower risk than Michigan')
  }

  // "Reader" step: stands in for the AI step. Can only raise.
  let raise = 0
  if (/baby|infant|newborn|elderly|oxygen|medical|disab|pregnan|insulin/i.test(text)) {
    raise = 1
    reasons.push('Vulnerable person mentioned (+1)')
  }
  if (/flood|ceiling|electrical|water.*(outlet|light)/i.test(text) && type === 'leak') {
    raise = Math.max(raise, 1)
    reasons.push('Water near electrical or ceiling (+1)')
  }
  if (/pouring|gushing|everywhere|can'?t (shut|turn)/i.test(text) && ['leak', 'toilet'].includes(type)) {
    raise = Math.max(raise, 2)
    reasons.push('Water that will not stop (+2)')
  }
  if (repeats >= REPEAT_THRESHOLD) {
    reasons.push(`Repeat problem (${repeats} repairs this year): flagged for manager review`)
    if (sev < 4) sev += 1
  }
  sev = Math.min(5, sev + raise)
  return { sev, reasons }
}

// ---------- 4. Vendor / parts flags ----------
export function vendorFlag(text, repeats) {
  for (const rule of VENDOR_RULES) {
    if (rule.words.test(text)) return { vendor: rule.vendor, why: rule.why }
  }
  if (repeats >= REPEAT_THRESHOLD) {
    return { vendor: 'Vendor evaluation', why: `${repeats} repairs for the same issue. A permanent fix may need a specialist.` }
  }
  return null
}

// ---------- 5. Entry rules ----------
export function parseWindow(win) {
  const w = (win || '').toLowerCase()
  let m
  if ((m = w.match(/\((\d+)-(\d+) ?pm\)/))) return [Number(m[1]) + 12, Number(m[2]) + 12]
  if ((m = w.match(/\((\d+)-(\d+) ?am\)/))) return [Number(m[1]), Number(m[2])]
  if ((m = w.match(/(\d+) am - (\d+) pm/))) return [Number(m[1]), Number(m[2]) + 12]
  if (w.includes('after 11')) return [11, 17]
  if (w.includes('after 5')) return [17, 19]
  if (w.includes('late morning')) return [10, 12]
  if (w.includes('afternoon')) return [12, 17]
  if (w.includes('evening')) return [17, 20]
  return [8, 17]
}

export function entryInfo(resident, sev, noEntry, okReceived, type) {
  if (noEntry) return { status: 'none', text: 'Common area: no apartment entry needed.' }
  if (!resident) return { status: 'unknown', text: 'Unit unknown: cannot check entry rules.' }
  const rule = ENTRY_RULES[resident.region]
  if (sev >= 5) {
    return { status: 'emergency', text: `Emergency: staff may enter without advance notice (call/text first, leave a note after). ${rule.source}` }
  }
  if (type === 'lockout') {
    return { status: 'ok', text: 'Lockout: the resident is present and lets you in. Verify ID before opening the door.' }
  }
  if (!resident.consent && !okReceived) {
    const urgent = sev >= 4 ? ' This is urgent, so call the resident now to ask for the OK.' : ''
    return { status: 'hold', text: `No standing permission to enter.${urgent} Send ${rule.hours}-hour written notice or get the resident's OK first.` }
  }
  return {
    status: 'ok',
    text: okReceived
      ? 'Resident said OK. Enter during their window.'
      : `Standing permission on file. Still text a ${rule.hours}-hour heads-up. ${rule.source}`,
  }
}

// ---------- 6. Build one finished work order ----------
export function buildOrder(raw, state = {}) {
  const resident = findResident(raw.text, raw.residentId)
  const type = classify(raw.text)
  const jt = JOB_TYPES[type]
  const repeats = raw.repeats || 0
  const region = resident?.region
  const scored = scoreSeverity(type, raw.text, region || 'Michigan', repeats)
  const sev = state.sevOverride || scored.sev
  const vendor = vendorFlag(raw.text, repeats)
  const entry = entryInfo(resident, sev, jt.noEntry, state.okReceived, type)

  const flags = []
  if (!resident) flags.push('Unit NOT FOUND: call or message the resident to confirm the unit')
  if (repeats >= REPEAT_THRESHOLD) flags.push(`Repeat issue (${repeats}x)`)
  if (resident?.pets && entry.status !== 'none') flags.push(`Pet: ${resident.pets}. Ask resident to secure before entry`)
  if (resident?.lang && resident.lang !== 'English') flags.push(`Speaks ${resident.lang}`)
  if (!resident) flags.push('Priority set from the message only; manager should check')

  return {
    ...raw,
    resident,
    type,
    label: jt.label,
    skill: jt.skill,
    mins: jt.mins,
    bring: jt.bring,
    sev,
    autoSev: scored.sev,
    reasons: scored.reasons,
    vendor,
    entry,
    flags,
    okReceived: !!state.okReceived,
    window: resident ? parseWindow(resident.window) : [8, 17],
    community: resident?.community || null,
  }
}

// ---------- 7. Scheduler ----------
export const fmt = (t) => {
  const h = Math.floor(t)
  const m = Math.round((t - h) * 60)
  const hh = ((h + 11) % 12) + 1
  return `${hh}:${String(m).padStart(2, '0')} ${h >= 12 ? 'PM' : 'AM'}`
}

function candidateTechs(job) {
  const region = job.resident?.region
  return TECHS.filter((t) => (!region || t.region === region))
}

// Assign every job to the best-fit technician: right skill first, then lightest load.
function assign(jobs, overrides) {
  const load = Object.fromEntries(TECHS.map((t) => [t.id, 0]))
  const assigned = Object.fromEntries(TECHS.map((t) => [t.id, []]))
  const ordered = [...jobs].sort((a, b) => b.sev - a.sev || a.received.localeCompare(b.received))
  for (const job of ordered) {
    let tech
    if (overrides[job.id]) tech = TECHS.find((t) => t.id === overrides[job.id])
    if (!tech) {
      const cands = candidateTechs(job)
      const pool = cands.length ? cands : TECHS
      tech = [...pool].sort((a, b) => {
        const sa = a.skills.includes(job.skill) ? 0 : 1
        const sb = b.skills.includes(job.skill) ? 0 : 1
        const homeA = a.home === job.community ? -5 : 0
        const homeB = b.home === job.community ? -5 : 0
        return sa * 1000 + load[a.id] + homeA - (sb * 1000 + load[b.id] + homeB)
      })[0]
    }
    assigned[tech.id].push(job)
    load[tech.id] += job.mins
  }
  return assigned
}

function simulate(tech, sequence) {
  let t = tech.shift[0]
  let place = tech.home
  let drive = 0
  const stops = []
  for (const job of sequence) {
    const travel = job.community ? travelMinutes(place, job.community) : 10
    drive += travel
    let arrive = t + travel / 60
    const wStart = job.entry.status === 'emergency' || job.entry.status === 'none' ? tech.shift[0] : job.window[0]
    const wait = Math.max(0, wStart - arrive)
    arrive += wait
    const done = arrive + job.mins / 60
    stops.push({ job, arrive, done, travel, wait: wait * 60, late: done > tech.shift[1] })
    t = done
    if (job.community) place = job.community
  }
  return { stops, drive, finish: t }
}

// Smart order: emergencies and urgent first, then group by community and fit entry windows.
function smartOrder(tech, jobs) {
  const remaining = [...jobs]
  const seq = []
  let t = tech.shift[0]
  let place = tech.home
  while (remaining.length) {
    const topTier = Math.max(...remaining.map((j) => j.sev))
    const pool = topTier >= 4 ? remaining.filter((j) => j.sev >= 4) : remaining
    let best = null
    for (const j of pool) {
      const travel = j.community ? travelMinutes(place, j.community) : 10
      const arrive = t + travel / 60
      const w0 = ['emergency', 'none'].includes(j.entry.status) ? 0 : j.window[0]
      const wait = Math.max(0, w0 - arrive) * 60
      const pastWindow = !['emergency', 'none'].includes(j.entry.status) && arrive > j.window[1] ? 200 : 0
      const cost = travel + wait * 0.6 + pastWindow - j.sev * 25
      if (!best || cost < best.cost) best = { j, cost, travel, wait }
    }
    remaining.splice(remaining.indexOf(best.j), 1)
    seq.push(best.j)
    t += best.travel / 60 + best.wait / 60 + best.j.mins / 60
    if (best.j.community) place = best.j.community
  }
  return seq
}

export function buildPlan(orders, overrides = {}) {
  const ready = orders.filter((o) => o.entry.status !== 'hold')
  const held = orders.filter((o) => o.entry.status === 'hold')
  const assigned = assign(ready, overrides)
  const techs = TECHS.map((tech) => {
    const jobs = assigned[tech.id]
    const smart = simulate(tech, smartOrder(tech, jobs))
    const hand = simulate(tech, [...jobs].sort((a, b) => a.received.localeCompare(b.received)))
    // Show our plan only if it is at least as good at the things that matter.
    // Only fall back to the by-hand order if it is faster AND already puts the most severe job first.
    const topSev = Math.max(0, ...jobs.map((j) => j.sev))
    const handSafe = hand.stops.length === 0 || hand.stops[0].job.sev === topSev
    const useSmart = !(handSafe && hand.drive < smart.drive)
    return { tech, plan: useSmart ? smart : hand, byHand: hand, jobs }
  })
  const saved = techs.reduce((n, t) => n + Math.max(0, t.byHand.drive - t.plan.drive), 0)
  return { techs, held, saved }
}
