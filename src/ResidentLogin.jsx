import { useState } from 'react'
import { RESIDENTS } from './triage/engine.js'

// Residents sign in with their property, unit number and a code (for this prototype: the last
// 4 digits of the phone number on their lease). No list of names or apartments is ever shown.
// After 5 wrong tries, this device has to wait 5 minutes.
const LOCK_KEY = 'mk-res-lock'
const digits = (s) => String(s || '').replace(/\D/g, '')
const sameUnit = (a, b) => String(a).replace(/^0+(?=.)/, '').toUpperCase() === String(b).trim().replace(/^0+(?=.)/, '').toUpperCase()

function lockState() {
  try {
    return JSON.parse(localStorage.getItem(LOCK_KEY) || '{"fails":0,"until":0}')
  } catch {
    return { fails: 0, until: 0 }
  }
}
function saveLock(v) {
  try {
    localStorage.setItem(LOCK_KEY, JSON.stringify(v))
  } catch {
    /* ignore */
  }
}

export default function ResidentLogin({ siteNames, onSuccess }) {
  const [site, setSite] = useState('')
  const [unit, setUnit] = useState('')
  const [code, setCode] = useState('')
  const [err, setErr] = useState('')

  const submit = (e) => {
    e.preventDefault()
    const lock = lockState()
    if (lock.until > Date.now()) {
      setErr(`Too many tries. Please wait ${Math.ceil((lock.until - Date.now()) / 60000)} minutes, or call your leasing office.`)
      return
    }
    const r = RESIDENTS.find((x) => x.community === site && sameUnit(x.unit, unit) && digits(x.phone).slice(-4) === digits(code))
    if (!r) {
      const fails = lock.fails + 1
      saveLock(fails >= 5 ? { fails: 0, until: Date.now() + 5 * 60000 } : { fails, until: 0 })
      setErr("We couldn't match that. Check your property, unit number and code.")
      return
    }
    saveLock({ fails: 0, until: 0 })
    onSuccess(r.id)
  }

  return (
    <form className="rolepick" onSubmit={submit}>
      <label>Your property
        <select value={site} onChange={(e) => setSite(e.target.value)} required>
          <option value="">Choose…</option>
          {siteNames.map((n) => <option key={n} value={n}>{n}</option>)}
        </select>
      </label>
      <div className="two">
        <label>Unit number
          <input value={unit} onChange={(e) => setUnit(e.target.value.slice(0, 8))} inputMode="numeric" autoComplete="off" required />
        </label>
        <label>Code
          <input value={code} onChange={(e) => setCode(digits(e.target.value).slice(0, 4))} inputMode="numeric" type="password" autoComplete="off" placeholder="4 digits" required />
        </label>
      </div>
      <p className="small">Your code is the last 4 digits of the phone number on your lease.</p>
      {err && <p className="small warn">{err}</p>}
      <button className="primary" type="submit">Sign in</button>
      <p className="small demo">Demo: Bella Casa · unit 150 · code 0108</p>
    </form>
  )
}
