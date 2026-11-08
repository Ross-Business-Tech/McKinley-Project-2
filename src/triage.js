import residents from './data/residents.json'
import interactions from './data/interactions.json'

// "Today" in the sample spreadsheet
export const TODAY = '2026-10-30'
const DAY = 86400000
const daysBetween = (a, b) => Math.round((new Date(b) - new Date(a)) / DAY)

export const residentById = Object.fromEntries(residents.map((r) => [r.resident_id, r]))
export { residents, interactions }

const TYPES = [
  ['pest', /roach|\bants?\b|hormiga|pest|\bbugs?\b/i],
  ['hvac', /\bac\b|a\/c|heat|furnace|airflow|hvac|cool|air handler/i],
  ['plumbing', /leak|sink|drain|toilet|faucet|tub|water heater|gurgl|ceiling|drywall|stain/i],
  ['appliance', /dishwasher|dryer|washer|fridge|oven|horno|disposal|refrigerator/i],
  ['electrical', /outlet|fan|smoke|light|breaker|spark/i],
  ['doors & locks', /lock|key|door|puerta|closet|balcon/i],
]
export const typeOf = (i) => {
  const text = `${i.subject} ${i.full_text.split('\n')[0]}`
  const hit = TYPES.find(([, re]) => re.test(text))
  return hit ? hit[0] : 'general'
}

const URGENT_WORDS = /no heat|furnace blowing cold|leaking|lockout|smoke|spark|flood|gas|out again|not cooling/i

export const maintenance = interactions
  .filter((i) => i.category === 'maintenance' && !/move-in/i.test(i.subject))
  .map((i) => ({ ...i, type: typeOf(i) }))

const NO_VISIT = /^(is |when |callback)|follow-up/i

// Score one request and say why, in plain words.
export function scoreRequest(req, allRequests = maintenance) {
  const r = residentById[req.resident_id]
  const reasons = []
  const flags = []
  let score = 0
  const text = `${req.subject} ${req.full_text.split('\n')[0]}`

  if (URGENT_WORDS.test(text)) { score += 40; reasons.push('Possible damage or loss of comfort or safety') }
  if (req.type === 'hvac') {
    const hotOrCold = r.region === 'Orlando' ? /ac|cool/i.test(text) : /heat|furnace/i.test(text)
    if (hotOrCold) { score += 20; reasons.push(r.region === 'Orlando' ? 'AC problems matter more in Orlando heat' : 'Heating problems matter more in Michigan fall') }
  }
  const prior = allRequests.filter(
    (o) => o.resident_id === req.resident_id && o.type === req.type && o.timestamp < req.timestamp,
  ).length
  if (prior >= 1) { score += 10 * Math.min(prior, 4); flags.push(`Repeat #${prior + 1}`); reasons.push(`${prior + 1}${ord(prior + 1)} ${req.type} request from this resident`) }
  if (req.status === 'open') { score += 15; reasons.push('Still open') }
  if (req.follow_up_needed === 'Y') { score += 10; flags.push('Follow-up owed'); reasons.push('Someone still owes this resident an update') }
  const age = daysBetween(req.timestamp.slice(0, 10), TODAY)
  if (req.status === 'open' && age >= 3) { score += Math.min(age, 10); reasons.push(`Open for ${age} days`) }
  const noVisit = NO_VISIT.test(req.subject) || /pending per mgr/i.test(req.full_text)
  if (noVisit) { score -= 10; flags.push('May not need a visit'); reasons.push('Waiting on a manager decision or callback, not a technician') }

  const tier = score >= 55 ? 'urgent' : score >= 25 ? 'soon' : 'routine'
  return { ...req, score, tier, reasons, flags, noVisit, prior, resident: r, age }
}
const ord = (n) => (n % 10 === 1 && n !== 11 ? 'st' : n % 10 === 2 && n !== 12 ? 'nd' : n % 10 === 3 && n !== 13 ? 'rd' : 'th')

// Queue = open requests, plus anything from the last 14 days
export function buildQueue(extra = []) {
  const base = maintenance.filter((i) => i.status === 'open' || daysBetween(i.timestamp.slice(0, 10), TODAY) <= 14)
  const all = [...maintenance, ...extra]
  return [...base, ...extra].map((i) => scoreRequest(i, all)).sort((a, b) => b.score - a.score)
}

// Example crew (made up)
export const CREW = [
  { name: 'Tech A', trade: 'Plumbing', types: ['plumbing', 'appliance'], start: 9 },
  { name: 'Tech B', trade: 'HVAC', types: ['hvac', 'electrical'], start: 8.5 },
  { name: 'Tech C', trade: 'General', types: ['doors & locks', 'general', 'electrical'], start: 8 },
  { name: 'Pest vendor', trade: 'Pest control', types: ['pest'], start: 10 },
]
export function assign(queue) {
  const next = {}
  return queue.map((q) => {
    if (q.noVisit) return { ...q, crew: null }
    const tech = CREW.find((c) => c.types.includes(q.type)) || CREW[2]
    const slot = (next[tech.name] ?? tech.start)
    next[tech.name] = slot + 1.5
    return { ...q, crew: tech, slot }
  })
}
export const fmtSlot = (h) => {
  const hr = Math.floor(h), m = h % 1 ? '30' : '00'
  return `${((hr + 11) % 12) + 1}:${m} ${hr >= 12 ? 'PM' : 'AM'}`
}

export function repeatProblems() {
  const map = {}
  maintenance.forEach((m) => {
    const k = `${m.resident_id}|${m.type}`
    ;(map[k] ||= []).push(m)
  })
  return Object.values(map)
    .filter((l) => l.length >= 2)
    .map((l) => ({ resident: residentById[l[0].resident_id], type: l[0].type, items: l.sort((a, b) => a.timestamp.localeCompare(b.timestamp)) }))
    .sort((a, b) => b.items.length - a.items.length)
}
