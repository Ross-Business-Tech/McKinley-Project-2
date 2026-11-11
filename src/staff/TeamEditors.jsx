import { useState } from 'react'
import { LANGS } from '../triage/translate.js'
import { DAYS, isWorking, isOnCall, fmt } from '../triage/engine.js'
import { SKILLS } from '../triage/followup.js'
import { formatPhone } from '../util.js'

export function TechEditor({ t, sites, update, toggle, remove }) {
  return (
    <div className="tech">
      <div className="row between">
        <input className="name" value={t.name} onChange={(e) => update({ name: e.target.value })} aria-label="Technician name" />
        <button className="link" onClick={remove}>Remove</button>
      </div>
      <div className="two">
        <label className={t.lang ? '' : 'ask'}>{t.lang ? 'Primary language' : 'Ask them: what is your primary language?'}
          <select value={t.lang || ''} onChange={(e) => update({ lang: e.target.value })}>
            <option value="">Choose…</option>
            {LANGS.map((l) => <option key={l.code} value={l.code}>{l.native === l.name ? l.name : `${l.native} (${l.name})`}</option>)}
          </select>
        </label>
        <label>Email (for signing in)
          <input type="email" value={t.email || ''} onChange={(e) => update({ email: e.target.value.trim() })} placeholder="name@mckinley.com" />
        </label>

        <label>Mobile number (to text work orders)
          <input value={t.phone || ''} onChange={(e) => update({ phone: formatPhone(e.target.value) })} placeholder="067-550-2161"
            inputMode="numeric" pattern="[0-9]{3}-[0-9]{3}-[0-9]{4}" maxLength={12} title="Enter a 10-digit phone number, like 067-550-2161" />
          {t.phone && t.phone.replace(/\D/g, '').length < 10 && <span className="small warn">Enter all 10 digits</span>}
        </label>
      </div>
      <p className="small">Works on</p>
      <div className="chips">
        {DAYS.map((d) => (
          <button key={d} className={`chip chipbtn ${isWorking(t, d) ? 'sel' : ''}`} onClick={() => update({ workDays: toggle(t.workDays || ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'], d) })}>{d}</button>
        ))}
      </div>
      <p className="small">📟 On call (after hours, 5 PM to midnight)</p>
      <div className="chips">
        {DAYS.map((d) => (
          <button key={d} className={`chip chipbtn ${isOnCall(t, d) ? 'sel oncallchip' : ''}`} onClick={() => update({ onCallDays: toggle(t.onCallDays || [], d) })}>{d}</button>
        ))}
      </div>
      <p className="small">Strengths</p>
      <div className="chips">
        {SKILLS.map((k) => (
          <button key={k} className={`chip chipbtn ${t.skills.includes(k) ? 'sel' : ''}`} onClick={() => update({ skills: toggle(t.skills, k) })}>{k}</button>
        ))}
      </div>
      <p className="small">Works at</p>
      <div className="chips">
        {t.sites.map((n) => (
          <button key={n} className="chip chipbtn sel" title="Tap to remove" onClick={() => update({ sites: t.sites.filter((x) => x !== n) })}>{n} ✕</button>
        ))}
      </div>
      <select aria-label="Add a site" value="" onChange={(e) => e.target.value && update({ sites: [...t.sites, e.target.value] })}>
        <option value="">+ Also covers another site…</option>
        {sites.filter((x) => !t.sites.includes(x.name)).map((x) => <option key={x.name} value={x.name}>{x.name} ({x.city})</option>)}
      </select>
      <div className="two">
        <label>Shift starts
          <select value={t.shift[0]} onChange={(e) => update({ shift: [Number(e.target.value), t.shift[1]] })}>
            {[6, 7, 8, 9, 10].map((h) => <option key={h} value={h}>{fmt(h)}</option>)}
          </select>
        </label>
        <label>Shift ends
          <select value={t.shift[1]} onChange={(e) => update({ shift: [t.shift[0], Number(e.target.value)] })}>
            {[14, 15, 16, 17, 18, 19, 20].map((h) => <option key={h} value={h}>{fmt(h)}</option>)}
          </select>
        </label>
      </div>
    </div>
  )
}

export function SupervisorsEditor({ sups, setSups, sites, onlySites }) {
  const [open, setOpen] = useState(null)
  const markets = [...new Set(sites.map((x) => x.market || x.city))]
  const upd = (id, p) => setSups(sups.map((x) => (x.id === id ? { ...x, ...p } : x)))
  return (
    <section className="card">
      <h2>Supervisors</h2>
      <p className="small">Each supervisor sees only the properties they oversee. Technicians see their supervisor's name and number.</p>
      {sups.filter((x) => !onlySites || !x.sites.length || x.sites.some((n) => onlySites.includes(n))).map((x) => (
        <div key={x.id} className="tech">
          <div className="row between">
            <b>{x.name}</b>
            <span className="small">{x.sites.length} properties</span>
            <button className="link" onClick={() => setOpen(open === x.id ? null : x.id)}>{open === x.id ? 'Close' : 'Edit'}</button>
          </div>
          {open === x.id && (
            <>
              <div className="two">
                <label>Name<input value={x.name} onChange={(e) => upd(x.id, { name: e.target.value })} /></label>
                <label>Phone
                  <input value={x.phone || ''} onChange={(e) => upd(x.id, { phone: formatPhone(e.target.value) })} inputMode="numeric" placeholder="067-550-2161" maxLength={12} />
                </label>
              </div>
              <label>Email<input type="email" value={x.email || ''} onChange={(e) => upd(x.id, { email: e.target.value })} /></label>
              <p className="small">Oversees (tap ✕ to remove)</p>
              <div className="chips">
                {x.sites.map((n) => <button key={n} className="chip chipbtn sel" onClick={() => upd(x.id, { sites: x.sites.filter((y) => y !== n) })}>{n} ✕</button>)}
              </div>
              <div className="two">
                <select aria-label="Add a property" value="" onChange={(e) => e.target.value && upd(x.id, { sites: [...x.sites, e.target.value] })}>
                  <option value="">+ Add one property…</option>
                  {sites.filter((y) => !x.sites.includes(y.name)).map((y) => <option key={y.name} value={y.name}>{y.name} ({y.city})</option>)}
                </select>
                <select aria-label="Add a whole area" value="" onChange={(e) => e.target.value && upd(x.id, { sites: [...new Set([...x.sites, ...sites.filter((y) => (y.market || y.city) === e.target.value).map((y) => y.name)])] })}>
                  <option value="">+ Add a whole area…</option>
                  {markets.map((m) => <option key={m} value={m}>{m}</option>)}
                </select>
              </div>
              <button className="link" onClick={() => setSups(sups.filter((y) => y.id !== x.id))}>Remove supervisor</button>
            </>
          )}
        </div>
      ))}
      <button onClick={() => { const id = `SUP-${Date.now()}`; setSups([...sups, { id, name: 'New supervisor', phone: '', email: '', sites: [] }]); setOpen(id) }}>+ Add supervisor</button>
      {(() => {
        const covered = new Set(sups.flatMap((x) => x.sites))
        const gap = sites.filter((y) => !covered.has(y.name))
        return gap.length ? <p className="small warn">No supervisor yet for: {gap.map((y) => y.name).join(', ')}</p> : null
      })()}
    </section>
  )
}
