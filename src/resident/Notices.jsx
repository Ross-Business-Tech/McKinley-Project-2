import { niceDate, daysUntil, VENDOR_STATUS } from '../planning.js'

// ---------- Resident: what's planned for my home ----------
const RT = {
  en: { title: 'Coming up for your home', pm: (t, d) => `Scheduled maintenance: ${t} around ${d}. We'll text you before entering.`, walk: (d) => `Move-out walkthrough: ${d}. A technician will check the apartment with you.`, keys: (d) => `Final walkthrough and key return: ${d}.`, vendor: (s, d) => `Specialist visit: ${s}${d ? `, ${d}` : ''}.` },
  es: { title: 'Próximamente en su casa', pm: (t, d) => `Mantenimiento programado: ${t}, alrededor del ${d}. Le enviaremos un mensaje antes de entrar.`, walk: (d) => `Inspección antes de la mudanza: ${d}. Un técnico revisará el apartamento con usted.`, keys: (d) => `Inspección final y entrega de llaves: ${d}.`, vendor: (s, d) => `Visita del especialista: ${s}${d ? `, ${d}` : ''}.` },
}
export function ResidentNotices({ me, turns, pm, vendorjobs, myOrderIds }) {
  const L = me.lang === 'Spanish' ? RT.es : RT.en
  const items = []
  for (const p of Object.values(pm)) if (p && p.units.includes(me.id) && !p.done?.[me.id] && daysUntil(p.due) >= -3) items.push(L.pm(p.title, niceDate(p.due)))
  const t = Object.values(turns).find((x) => x && x.residentId === me.id)
  if (t) {
    const pre = t.tasks.find((x) => x.k === 'pre')
    const keys = t.tasks.find((x) => x.k === 'keys')
    if (pre && !pre.done) items.push(L.walk(niceDate(pre.due)))
    if (keys && !keys.done) items.push(L.keys(niceDate(keys.due)))
  }
  for (const id of myOrderIds) {
    const v = vendorjobs[id]
    if (v && v.status !== 'done') items.push(L.vendor(VENDOR_STATUS[v.status]?.toLowerCase() || v.status, v.date ? niceDate(v.date) : ''))
  }
  if (!items.length) return null
  return (
    <section className="card notices">
      <h2>📅 {L.title}</h2>
      <ul>{items.map((x, i) => <li key={i}>{x}</li>)}</ul>
    </section>
  )
}
