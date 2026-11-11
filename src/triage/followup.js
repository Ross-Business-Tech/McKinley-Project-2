// Finds what is missing from a work order and writes ready-to-send messages.
// NOTHING is sent automatically. The buttons open the manager's own text / email / phone
// app with the message filled in. Sending automatically would need a messaging service.

export const SKILLS = ['hvac', 'plumbing', 'electrical', 'appliance', 'locks', 'general']

export function missingInfo(o) {
  const items = []
  if (!o.resident) {
    items.push({ key: 'unit', label: 'Unit number / who is asking', ask: 'which apartment (unit number and community) this is for' })
  }
  if (o.type === 'other') {
    items.push({ key: 'problem', label: 'What is actually wrong', ask: 'what exactly is wrong (and a photo if you can)' })
  } else if (o.text.trim().length < 25) {
    items.push({ key: 'detail', label: 'Not enough detail', ask: 'a few more details about the problem (and a photo if you can)' })
  }
  if (o.entry.status === 'hold') {
    items.push({ key: 'entry', label: 'Permission to enter', ask: 'permission for our maintenance team to enter, and a good time window' })
  }
  return items
}

export function officeFor(site, sites) {
  const s = sites.find((x) => x.name === site)
  return { phone: s?.phone || '', email: s?.email || '', name: s ? `${s.name} leasing office` : 'Leasing office' }
}

// Best way to reach the requester, honoring what we know about them.
export function bestChannel(o) {
  const r = o.resident
  if (!r) return null
  const pref = r.contact
  if (pref === 'email') return 'email'
  if (pref === 'call') return 'call'
  return 'text' // text, chat, portal
}

export function drafts(o, items, sites) {
  const r = o.resident
  const asks = items.map((i) => i.ask).join('; ')
  const first = r ? r.name.split(' ')[0] : 'there'
  const community = o.community || 'McKinley'
  const spanish = r && r.lang === 'Spanish'
  const en = `Hi ${first}, this is your ${community} maintenance team following up on your request (“${o.text}”). When you have a moment, could you reply with ${asks}? We'll get this taken care of. Thank you!`
  const es = `Hola ${first}, somos el equipo de mantenimiento de ${community} sobre su solicitud. ¿Puede responder con la información que falta (${items.map((i) => i.label.toLowerCase()).join(', ')})? ¡Gracias!`
  const body = spanish ? es : en
  const office = officeFor(o.community, sites)
  const urgent = o.sev >= 4
  const officeMsg = `[${urgent ? 'URGENT ' : ''}Maintenance request ${o.id}] Missing: ${items.map((i) => i.label).join(', ')}. Request: “${o.text}”. ${r ? `Resident: ${r.name}, unit ${r.unit}.` : 'We could not match a unit, please look up who sent this and reach out.'} Please get in touch with the requester.`
  const out = { body, office, officeMsg, urgent, spanish }
  const phone = r?.phone || o.phone
  const email = r?.email || o.email
  const subject = encodeURIComponent('Your maintenance request: we need a bit more info')
  if (phone) out.text = `sms:${phone}?&body=${encodeURIComponent(body)}`
  if (email) out.email = `mailto:${email}?subject=${subject}&body=${encodeURIComponent(body)}`
  if (phone) out.call = `tel:${phone}`
  out.channel = r ? bestChannel(o) : phone ? 'text' : email ? 'email' : null
  if (phone || email) {
    out.callScript = `Call ${r ? r.name : 'the requester'} (${phone || email}).${r?.noCallBefore ? ` Do NOT call before ${r.noCallBefore} AM, text first.` : ''} Ask for: ${asks}.${spanish ? ' Resident prefers Spanish.' : ''}`
  }
  out.alertIsCall = !office.email && !!office.phone
  out.alertMissing = !office.email && !office.phone
  out.alert = out.alertIsCall ? `tel:${office.phone}` : !office.email ? null : `mailto:${office.email}?subject=${encodeURIComponent(`${urgent ? 'URGENT: ' : ''}Please contact requester: request ${o.id}`)}&body=${encodeURIComponent(officeMsg)}`
  return out
}
