import { useState } from 'react'

import { TRADES, tradeFor } from './vendorsData.js'

export function VendorRequest({ order, vendors, sites }) {
  const trade = tradeFor(order)
  const site = sites.find((x) => x.name === order.community)
  const area = site?.market || site?.city
  const match = vendors.filter((v) => v.trade === trade && (!area || v.areas.includes(area)))
  if (!trade) return null
  if (!match.length) return <p className="small">No {TRADES[trade] || trade} vendor saved for this area yet. Add one on the Teams tab.</p>
  const where = [order.community, order.resident && `Bldg ${order.resident.building}`, order.resident && `Unit ${order.resident.unit}`, site?.address].filter(Boolean).join(', ')
  const body = `Hello, McKinley maintenance would like to schedule service.\n\nWhere: ${where}\nProblem: ${order.label}\nDetails: ${order.text}\n${order.vendor?.why ? `Why we're calling you: ${order.vendor.why}\n` : ''}\nPlease reply with your earliest availability. Thank you.`
  return (
    <div className="vendorreq">
      {match.map((v) => (
        <div key={v.id} className="row">
          <span className="small"><b>{v.name}</b> · {TRADES[v.trade]}</span>
          {v.email && <a className="btn mini" href={`mailto:${v.email}?subject=${encodeURIComponent(`Service request: ${order.label} at ${order.community}`)}&body=${encodeURIComponent(body)}`}>Email request</a>}
          {v.phone && <a className="btn mini" href={`tel:${v.phone}`}>Call</a>}
        </div>
      ))}
    </div>
  )
}

export function VendorsEditor({ vendors, setVendors, areas, formatPhone }) {
  const [open, setOpen] = useState(null)
  const upd = (id, p) => setVendors(vendors.map((v) => (v.id === id ? { ...v, ...p } : v)))
  return (
    <section className="card">
      <h2>Outside vendors</h2>
      <p className="small">Sample vendors until McKinley shares its real list. Work orders that need a vendor offer a one-tap request to the right trade in the right area.</p>
      {vendors.map((v) => (
        <div key={v.id} className="tech">
          <div className="row between">
            <b>{v.name}</b>
            <span className="small">{TRADES[v.trade]} · {v.areas.join(', ')}</span>
            <button className="link" onClick={() => setOpen(open === v.id ? null : v.id)}>{open === v.id ? 'Close' : 'Edit'}</button>
          </div>
          {open === v.id && (
            <>
              <div className="two">
                <label>Name<input value={v.name} onChange={(e) => upd(v.id, { name: e.target.value })} /></label>
                <label>Trade
                  <select value={v.trade} onChange={(e) => upd(v.id, { trade: e.target.value })}>
                    {Object.entries(TRADES).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
                  </select>
                </label>
                <label>Phone<input value={v.phone || ''} onChange={(e) => upd(v.id, { phone: formatPhone(e.target.value) })} inputMode="numeric" maxLength={12} /></label>
                <label>Email<input type="email" value={v.email || ''} onChange={(e) => upd(v.id, { email: e.target.value })} /></label>
              </div>
              <p className="small">Serves</p>
              <div className="chips">
                {areas.map((a) => (
                  <button key={a} className={`chip chipbtn ${v.areas.includes(a) ? 'sel' : ''}`}
                    onClick={() => upd(v.id, { areas: v.areas.includes(a) ? v.areas.filter((x) => x !== a) : [...v.areas, a] })}>{a}</button>
                ))}
              </div>
              <button className="link" onClick={() => setVendors(vendors.filter((x) => x.id !== v.id))}>Remove vendor</button>
            </>
          )}
        </div>
      ))}
      <button onClick={() => { const id = `V${Date.now()}`; setVendors([...vendors, { id, name: 'New vendor', trade: 'hvac', areas: [], phone: '', email: '' }]); setOpen(id) }}>+ Add vendor</button>
    </section>
  )
}
