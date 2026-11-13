import { useState } from 'react'
import { pinOf } from './pins.js'
import { MANAGERS, hashPass, passHashOf } from '../auth.js'

// The staff app's front door. Residents use the separate resident app (/resident/).
export function RoleChooser({ techs, sups, onPick, email, pmHashes }) {
  const [kind, setKind] = useState('supervisor')
  const [who, setWho] = useState('')
  const [pin, setPin] = useState('')
  const [err, setErr] = useState('')
  const [fails, setFails] = useState(0)
  const people = kind === 'tech' ? techs : sups
  const chosen = who || (kind === 'tech' ? techs[0]?.id : sups[0]?.id) || ''
  const [pass, setPass] = useState('')
  const submit = async (e) => {
    e.preventDefault()
    if (fails >= 5) return setErr('Too many tries. Ask your property manager to reset your PIN.')
    if (kind === 'manager') {
      const h = await hashPass(pass)
      const m = MANAGERS.find((x) => passHashOf(x, pmHashes) === h)
      if (!m) {
        setFails(fails + 1)
        return setErr('That passcode is not right.')
      }
      return onPick('supervisor', `pm:${m.id}`, h)
    }
    const ok = pinOf(people.find((x) => x.id === chosen)) === pin
    if (!ok) {
      setFails(fails + 1)
      setErr('That PIN is not right.')
      return
    }
    onPick(kind, chosen, pin)
  }
  return (
    <main className="app">
      <header className="hero">
        <span className="wordmark">mckinley</span>
        <h1>Staff sign-in</h1>
        <p>For McKinley property managers, supervisors and technicians.</p>
      </header>
      {email && <p className="notice small">Signed in as <b>{email}</b>, but that email isn't on a team or lease yet.</p>}

      {(
        <form className="card rolecard sel" onSubmit={submit}>
          <div className="seg">
            <button type="button" className={kind === 'supervisor' ? 'on' : ''} onClick={() => { setKind('supervisor'); setWho(''); setErr('') }}>🗂️ Supervisor</button>
            <button type="button" className={kind === 'tech' ? 'on' : ''} onClick={() => { setKind('tech'); setWho(''); setErr('') }}>🔧 Technician</button>
            <button type="button" className={kind === 'manager' ? 'on' : ''} onClick={() => { setKind('manager'); setErr('') }}>🏢 Manager</button>
          </div>
          {kind === 'manager' ? (
            <label>Property manager passcode
              <input type="password" value={pass} onChange={(e) => setPass(e.target.value)} autoComplete="current-password" required />
            </label>
          ) : (<>
          <label>Your name
            <select value={chosen} onChange={(e) => setWho(e.target.value)}>
              {people.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
            </select>
          </label>
          <label>PIN
            <input type="password" inputMode="numeric" autoComplete="off" value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 4))} placeholder="4 digits" required />
          </label>
          </>)}
          {err && <p className="small warn">{err}</p>}
          <button className="primary" type="submit">Sign in</button>
          <p className="small">Forgot your PIN? Ask your property manager to reset it.</p>
        </form>
      )}

      <a className="link staffswitch" href="/resident/">Resident? Go to the resident app →</a>
      <p className="small notice">Each person only sees their own view: residents their own requests, technicians their own jobs, supervisors their own properties.</p>
    </main>
  )
}
