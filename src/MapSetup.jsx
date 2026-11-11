import { useState } from 'react'

// Adding a property now requires its site map, so routes and the Map tab work from day one.
// The image is shrunk in the browser, then saved in small pieces so it fits here.now Site Data
// (each saved record is limited in size) and reaches the whole team.

import { readMapImage } from './mapStore.js'

function MapPicker({ img, setImg, required }) {
  const [err, setErr] = useState('')
  return (
    <div className="mappick">
      <label className={`btn photobtn ${img ? '' : 'primary'}`}>
        🗺️ {img ? 'Choose a different site map' : 'Upload site map (required)'}
        <input type="file" accept="image/*" required={required && !img}
          onChange={async (e) => {
            setErr('')
            try {
              setImg(await readMapImage(e.target.files?.[0]))
            } catch (x) {
              setErr(x.message)
            }
            e.target.value = ''
          }} />
      </label>
      {err && <p className="small warn">{err}</p>}
      {img && <img className="mapthumb" src={img.src} alt="Site map preview" />}
    </div>
  )
}

export function AddSite({ onAdd, existing, markets }) {
  const [name, setName] = useState('')
  const [market, setMarket] = useState(markets[0] || '')
  const [address, setAddress] = useState('')
  const [img, setImg] = useState(null)
  const dup = existing.some((s) => s.name.toLowerCase() === name.trim().toLowerCase())
  const ready = name.trim() && !dup && img
  return (
    <form className="card" onSubmit={(e) => {
      e.preventDefault()
      if (!ready) return
      onAdd({ name: name.trim(), market, city: market, address: address.trim(), phone: '', email: '' }, img)
      setName('')
      setAddress('')
      setImg(null)
    }}>
      <h2>Add a property not on the list</h2>
      <p className="small">A site map is required. After adding, tap the map to mark each building and the leasing office, so jobs there get routed building by building.</p>
      <div className="two">
        <label>Property name<input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Maple Grove" required /></label>
        <label>Area
          <select value={market} onChange={(e) => setMarket(e.target.value)}>
            {markets.map((m) => <option key={m} value={m}>{m}</option>)}
          </select>
        </label>
      </div>
      <label>Street address (for directions)<input value={address} onChange={(e) => setAddress(e.target.value)} placeholder="e.g. 100 Main St, Ann Arbor, MI 48104" /></label>
      <MapPicker img={img} setImg={setImg} required />
      {dup && <p className="small warn">That property is already on the list.</p>}
      {!img && name.trim() && <p className="small warn">Upload the property's site map to continue.</p>}
      <button className="primary" type="submit" disabled={!ready}>Add property</button>
    </form>
  )
}

// For a property without a map: upload one. For one with an uploaded map: mark buildings.
const KINDS = [
  ['building', 'Building'],
  ['leasing_office', 'Leasing office'],
  ['maintenance_shop', 'Maintenance shop'],
]

export function MapEditor({ siteName, map, builtIn, onUpload, onSave }) {
  const [img, setImg] = useState(null)
  const [kind, setKind] = useState('building')
  const [bid, setBid] = useState('')
  const [msg, setMsg] = useState('')
  if (builtIn) return <p className="small">🗺️ Site map on file ({builtIn} buildings mapped).</p>
  if (!map || (!map.file && !map.loading)) {
    return (
      <div className="mapsetup">
        <p className="small warn">🗺️ No site map yet. Upload one so jobs here can be routed and shown on the Map tab.</p>
        <MapPicker img={img} setImg={setImg} />
        {img && <button className="primary" onClick={() => { onUpload(img); setImg(null) }}>Save site map</button>}
      </div>
    )
  }
  if (map.loading) return <p className="small">🗺️ Site map loading…</p>
  const r = Math.max(map.w, map.h) * 0.018
  const place = (e) => {
    const svg = e.currentTarget
    const pt = svg.createSVGPoint()
    pt.x = e.clientX
    pt.y = e.clientY
    const p = pt.matrixTransform(svg.getScreenCTM().inverse())
    const x = Math.round(p.x)
    const y = Math.round(p.y)
    if (kind === 'building') {
      const id = bid.trim()
      if (!id) return setMsg('Type the building number first, then tap where it is on the map.')
      onSave({ b: [...map.b.filter((b) => b.id !== id), { p: siteName, id, u: 0, z: 'all', x, y, c: 'h', note: '' }], n: map.n })
      setMsg(`Building ${id} placed.`)
      setBid(/^\d+$/.test(id) ? String(Number(id) + 1).padStart(id.length, '0') : '')
    } else {
      onSave({ b: map.b, n: [...map.n.filter((n) => n.t !== kind), { t: kind, name: kind === 'leasing_office' ? 'Leasing office' : 'Maintenance shop', x, y }] })
      setMsg(`${kind === 'leasing_office' ? 'Leasing office' : 'Maintenance shop'} placed.`)
    }
  }
  return (
    <div className="mapsetup">
      <p className="small"><b>Mark the map</b> · {map.b.length} buildings{map.n.some((n) => n.t === 'leasing_office') ? ' · leasing office ✓' : ' · leasing office not marked yet'}</p>
      <div className="seg">
        {KINDS.map(([k, l]) => <button key={k} type="button" className={kind === k ? 'on' : ''} onClick={() => setKind(k)}>{l}</button>)}
      </div>
      {kind === 'building' && (
        <label>Building number, then tap its spot on the map
          <input value={bid} onChange={(e) => setBid(e.target.value)} placeholder="e.g. 11" />
        </label>
      )}
      <div className="mapwrap">
        <svg viewBox={`0 0 ${map.w} ${map.h}`} onClick={place} role="img" aria-label={`Site map of ${siteName}: tap to place`}>
          <image href={map.file} width={map.w} height={map.h} />
          {map.n.map((n) => (
            <g key={n.t}>
              <rect x={n.x - r * 0.7} y={n.y - r * 0.7} width={r * 1.4} height={r * 1.4} rx={r * 0.3} fill="#0f2742" stroke="#fff" strokeWidth={r * 0.15} />
              <text x={n.x} y={n.y + r * 0.35} fontSize={r} textAnchor="middle" fill="#fff" fontWeight="700">{n.t === 'maintenance_shop' ? 'M' : 'L'}</text>
            </g>
          ))}
          {map.b.map((b) => (
            <g key={b.id}>
              <circle cx={b.x} cy={b.y} r={r} fill="#0b5fd1" stroke="#fff" strokeWidth={r * 0.15} />
              <text x={b.x} y={b.y + r * 0.35} fontSize={r * 0.85} textAnchor="middle" fill="#fff" fontWeight="700">{b.id}</text>
            </g>
          ))}
        </svg>
      </div>
      {msg && <p className="small">{msg}</p>}
      {map.b.length > 0 && (
        <div className="chips">
          {map.b.map((b) => <button key={b.id} type="button" className="chip chipbtn" onClick={() => onSave({ b: map.b.filter((x) => x.id !== b.id), n: map.n })}>Bldg {b.id} ✕</button>)}
        </div>
      )}
    </div>
  )
}
