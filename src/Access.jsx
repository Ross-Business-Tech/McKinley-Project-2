import { useState } from 'react'
import { hashPass, randomPin } from './auth.js'

// Property manager's Access tab: set or reset everyone's sign-in PIN, residents' codes,
// and the manager passcode itself.
function PinRow({ name, detail, current, onSet }) {
  const [show, setShow] = useState(false)
  const [val, setVal] = useState('')
  const [msg, setMsg] = useState('')
  return (
    <div className="accrow">
      <div className="accwho">
        <b>{name}</b>
        <span className="small">{detail}</span>
      </div>
      <span className="pin">{show ? current || '—' : current ? '••••' : 'not set'}</span>
      <button type="button" className="link" onClick={() => setShow(!show)}>{show ? 'Hide' : 'Show'}</button>
      <form className="row accset" onSubmit={(e) => {
        e.preventDefault()
        if (!/^\d{4}$/.test(val)) return setMsg('Use exactly 4 digits.')
        onSet(val)
        setMsg(`PIN set to ${val}.`)
        setVal('')
      }}>
        <input value={val} onChange={(e) => setVal(e.target.value.replace(/\D/g, '').slice(0, 4))} inputMode="numeric" placeholder="New PIN" aria-label={`New PIN for ${name}`} />
        <button type="submit">Set</button>
        <button type="button" onClick={() => { const p = randomPin(); onSet(p); setShow(true); setMsg(`New PIN: ${p}. Give it to ${name} privately.`) }}>Reset</button>
      </form>
      {msg && <p className="small accmsg">{msg}</p>}
    </div>
  )
}

export default function Access({ techs, setTechs, sups, setSups, residents, rescodes, setRescodes, pinOf, pmHash, setPmHash }) {
  const [q, setQ] = useState('')
  const [cur, setCur] = useState('')
  const [n1, setN1] = useState('')
  const [n2, setN2] = useState('')
  const [pmMsg, setPmMsg] = useState('')
  const res = residents.filter((r) => !q || `${r.community} ${r.unit}`.toLowerCase().includes(q.toLowerCase()))

  return (
    <>
      <p className="small notice">Only the property manager sees this tab. Set a PIN, or tap Reset to make a random one and give it to the person privately. Everyone can also change their own PIN from their screen.</p>
      <div className="cardgrid">
        <section className="card">
          <h2>Supervisors</h2>
          {sups.map((x) => (
            <PinRow key={x.id} name={x.name} detail={`${x.sites.length} properties`} current={pinOf(x)}
              onSet={(p) => setSups(sups.map((y) => (y.id === x.id ? { ...y, pin: p } : y)))} />
          ))}
        </section>
        <section className="card">
          <h2>Technicians</h2>
          {techs.map((t) => (
            <PinRow key={t.id} name={t.name} detail={t.sites.join(', ')} current={pinOf(t)}
              onSet={(p) => setTechs(techs.map((y) => (y.id === t.id ? { ...y, pin: p } : y)))} />
          ))}
        </section>
        <section className="card">
          <h2>Residents</h2>
          <p className="small">A resident's code is the last 4 digits of their lease phone unless you set a different one here. Find them by property or unit.</p>
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search property or unit, e.g. Bella Casa 150" aria-label="Search residents" />
          {res.slice(0, 30).map((r) => (
            <PinRow key={r.id} name={`${r.community} · Unit ${r.unit}`} detail={rescodes[r.id] ? 'custom code' : 'phone code'}
              current={rescodes[r.id] || String(r.phone || '').replace(/\D/g, '').slice(-4)}
              onSet={(p) => setRescodes({ ...rescodes, [r.id]: p })} />
          ))}
        </section>
        <section className="card">
          <h2>Property manager passcode</h2>
          <p className="small">At least 8 characters. Only a fingerprint (hash) of it is saved. IT can also set it when the site is built.</p>
          <form onSubmit={async (e) => {
            e.preventDefault()
            if ((await hashPass(cur)) !== pmHash) return setPmMsg('Current passcode is not right.')
            if (n1.length < 8) return setPmMsg('New passcode must be at least 8 characters.')
            if (n1 !== n2) return setPmMsg("New passcodes don't match.")
            setPmHash(await hashPass(n1))
            setPmMsg('Passcode changed. Other manager sign-ins will need the new one.')
            setCur('')
            setN1('')
            setN2('')
          }}>
            <label>Current passcode<input type="password" value={cur} onChange={(e) => setCur(e.target.value)} autoComplete="current-password" /></label>
            <div className="two">
              <label>New passcode<input type="password" value={n1} onChange={(e) => setN1(e.target.value)} autoComplete="new-password" /></label>
              <label>Repeat new passcode<input type="password" value={n2} onChange={(e) => setN2(e.target.value)} autoComplete="new-password" /></label>
            </div>
            {pmMsg && <p className="small">{pmMsg}</p>}
            <button className="primary" type="submit">Change passcode</button>
          </form>
        </section>
      </div>
    </>
  )
}

// "Change my PIN" for supervisors and technicians.
export function MyPin({ current, onSet, labels = {} }) {
  const [open, setOpen] = useState(false)
  const [a, setA] = useState('')
  const [b, setB] = useState('')
  const [c, setC] = useState('')
  const [msg, setMsg] = useState('')
  const L = { title: 'Change my PIN', cur: 'Current PIN', new1: 'New PIN', new2: 'Repeat new PIN', save: 'Save', ...labels }
  return (
    <section className="card mypin">
      <button className="link" onClick={() => setOpen(!open)}>🔒 {L.title}</button>
      {open && (
        <form onSubmit={(e) => {
          e.preventDefault()
          if (a !== current) return setMsg('✕')
          if (!/^\d{4}$/.test(b) || b !== c) return setMsg('✕ 4 digits, twice')
          onSet(b)
          setMsg('✓')
          setA('')
          setB('')
          setC('')
        }}>
          <div className="two">
            {[[L.cur, a, setA], [L.new1, b, setB], [L.new2, c, setC]].map(([l, v, set]) => (
              <label key={l}>{l}<input type="password" inputMode="numeric" value={v} onChange={(e) => set(e.target.value.replace(/\D/g, '').slice(0, 4))} autoComplete="off" /></label>
            ))}
          </div>
          {msg && <p className="small">{msg}</p>}
          <button className="primary" type="submit">{L.save}</button>
        </form>
      )}
    </section>
  )
}
