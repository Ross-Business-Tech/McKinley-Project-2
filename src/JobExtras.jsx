import { useState } from 'react'

// Parts used on a job. Suggestions come from the job type's "bring" list.
export function PartsList({ id, parts, setParts, suggestions = [], label = 'Parts used', addLabel = 'Add' }) {
  const [name, setName] = useState('')
  const [qty, setQty] = useState(1)
  const list = parts[id] || []
  const add = (e) => {
    e.preventDefault()
    if (!name.trim()) return
    setParts({ ...parts, [id]: [...list, { name: name.trim().slice(0, 60), qty: Math.max(1, Math.min(99, Number(qty) || 1)) }] })
    setName('')
    setQty(1)
  }
  return (
    <div className="parts">
      <p className="small"><b>{label}</b></p>
      {list.length > 0 && (
        <div className="chips">
          {list.map((p, i) => (
            <button key={i} className="chip chipbtn" title="Tap to remove" onClick={() => setParts({ ...parts, [id]: list.filter((_, j) => j !== i) })}>
              {p.qty} × {p.name} ✕
            </button>
          ))}
        </div>
      )}
      <form className="row partform" onSubmit={add}>
        <input list={`parts-${id}`} value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Flapper kit" aria-label="Part name" />
        <datalist id={`parts-${id}`}>{suggestions.map((s) => <option key={s} value={s} />)}</datalist>
        <input type="number" min="1" max="99" value={qty} onChange={(e) => setQty(e.target.value)} aria-label="Quantity" className="qty" />
        <button type="submit">{addLabel}</button>
      </form>
    </div>
  )
}

// After a job is done: tell the resident, in their language.
export function ResidentUpdate({ order, siteName }) {
  const r = order.resident
  const phone = r?.phone || order.phone
  const email = r?.email || order.email
  if (!phone && !email) return null
  const first = r ? r.name.split(' ')[0] : ''
  const spanish = r?.lang === 'Spanish'
  const body = spanish
    ? `Hola ${first}, su reparación (${order.label}) ya está terminada. Si algo sigue sin funcionar, responda a este mensaje. Gracias, equipo de mantenimiento de ${siteName || 'su comunidad'}.`
    : `Hi ${first}, your repair (${order.label}) is finished. If anything still isn't right, just reply to this message. Thank you! Your ${siteName || ''} maintenance team`
  return (
    <div className="row resupdate">
      <span className="small">Tell the resident it's fixed{spanish ? ' (Spanish)' : ''}:</span>
      {phone && <a className="btn mini" href={`sms:${phone}?&body=${encodeURIComponent(body)}`}>Text</a>}
      {email && <a className="btn mini" href={`mailto:${email}?subject=${encodeURIComponent(spanish ? 'Su reparación está terminada' : 'Your repair is finished')}&body=${encodeURIComponent(body)}`}>Email</a>}
    </div>
  )
}
