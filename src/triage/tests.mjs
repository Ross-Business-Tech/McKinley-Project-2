import { TEST_ORDERS } from './testOrders.js'
import { buildOrder } from './engine.js'
let pass = 0
for (const t of TEST_ORDERS) {
  const o = buildOrder(t)
  const e = t.expect
  const ok =
    (e.sev === undefined || o.sev === e.sev) && (e.sevMin === undefined || o.sev >= e.sevMin) &&
    (!e.vendor || o.vendor) && (!e.hold || o.entry.status === 'hold') &&
    (!e.noEntry || o.entry.status === 'none') &&
    (!e.notFound || (!o.resident && o.flags.some((f) => f.includes('NOT FOUND') || f.includes("doesn't match")))) &&
    (!e.resident || o.resident?.id === e.resident) && (!e.readAs || o.flags.some((f) => f.includes(e.readAs)))
  if (ok) pass++
  else console.log('FAIL', t.id, o.type, 'sev', o.sev, o.entry.status, !!o.vendor, !!o.resident)
}
console.log(`${pass}/${TEST_ORDERS.length} test orders correct`)
import { normalizeNumbers } from './location.js'
const words = [
  ['building eleven unit four', 'building 11 unit 4'],
  ['apartment two hundred five', 'apartment 205'],
  ['unit one oh eight', 'unit 108'],
  ['bldg twenty-one unit four twenty', 'bldg 21 unit 420'],
  ['my unit is broken', 'my unit is broken'],
]
const wordsOk = words.filter(([a, b]) => normalizeNumbers(a) === b).length
console.log(`${wordsOk}/${words.length} spoken-number checks correct`)
const risky = TEST_ORDERS.filter((t) => /gas|no heat|flood|burning|freezing/i.test(t.text)).map((t) => buildOrder(t))
console.log('gas/flood/no-heat all emergencies:', risky.every((o) => o.sev === 5), `(${risky.length} orders)`)
