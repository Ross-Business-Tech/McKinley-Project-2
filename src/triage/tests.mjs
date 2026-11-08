import { TEST_ORDERS } from './testOrders.js'
import { buildOrder } from './engine.js'
let pass = 0
for (const t of TEST_ORDERS) {
  const o = buildOrder(t)
  const e = t.expect
  const ok =
    (e.sev === undefined || o.sev === e.sev) && (e.sevMin === undefined || o.sev >= e.sevMin) &&
    (!e.vendor || o.vendor) && (!e.hold || o.entry.status === 'hold') &&
    (!e.noEntry || o.entry.status === 'none') && (!e.notFound || (!o.resident && o.flags.some((f) => f.includes('NOT FOUND'))))
  if (ok) pass++
  else console.log('FAIL', t.id, o.type, 'sev', o.sev, o.entry.status, !!o.vendor, !!o.resident)
}
console.log(`${pass}/${TEST_ORDERS.length} test orders correct`)
const risky = TEST_ORDERS.filter((t) => /gas|no heat|flood|burning|freezing/i.test(t.text)).map((t) => buildOrder(t))
console.log('gas/flood/no-heat all emergencies:', risky.every((o) => o.sev === 5), `(${risky.length} orders)`)
