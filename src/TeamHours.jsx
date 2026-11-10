import { useState } from 'react'
import { DAYS, isWorking, isOnCall, ON_CALL_HOURS } from './triage/engine.js'

const h = (x) => {
  const v = ((x + 11) % 12) + 1
  return `${v}${x % 24 >= 12 ? 'p' : 'a'}`
}

// Weekly hours for every technician at the supervisor's properties.
// Filled square = regular shift that day, 📟 = on call that evening.
export default function TeamHours({ techs, siteNames, day, afterHours }) {
  const [open, setOpen] = useState(() => {
    try {
      return window.innerWidth >= 1000
    } catch {
      return true
    }
  })
  const bySite = siteNames
    .map((n) => ({ n, people: techs.filter((t) => t.home === n) }))
    .filter((g) => g.people.length)
  const status = (t) => {
    if (afterHours) return isOnCall(t, day) ? { c: 'oc', txt: `On call ${h(ON_CALL_HOURS[0])}–12a` } : { c: 'off', txt: 'Off tonight' }
    return isWorking(t, day) ? { c: 'on', txt: `Working ${h(t.shift[0])}–${h(t.shift[1])}` } : { c: 'off', txt: 'Off today' }
  }
  return (
    <section className="hours card">
      <button className="hours-toggle" onClick={() => setOpen(!open)} aria-expanded={open}>
        <b>Team hours</b>
        <span className="small">{techs.length} technicians · {open ? 'hide' : 'show'}</span>
      </button>
      {open && (
        <>
          <table>
            <thead>
              <tr>
                <th />
                {DAYS.map((d) => <th key={d} className={d === day ? 'today' : ''}>{d[0]}</th>)}
              </tr>
            </thead>
            {bySite.map((g) => (
              <tbody key={g.n}>
                <tr><td colSpan={8} className="hsite">{g.n}</td></tr>
                {g.people.map((t) => {
                  const st = status(t)
                  return (
                    <tr key={t.id}>
                      <td className="hname">
                        <b>{t.name}</b>
                        <span className={`hstat ${st.c}`}>{st.txt}</span>
                      </td>
                      {DAYS.map((d) => (
                        <td key={d} className={`hcell ${d === day ? 'today' : ''}`} title={`${d}: ${isWorking(t, d) ? `${h(t.shift[0])}–${h(t.shift[1])}` : 'off'}${isOnCall(t, d) ? ', on call 5p–12a' : ''}`}>
                          {isWorking(t, d) && <i className="work" />}
                          {isOnCall(t, d) && <span className="pager">📟</span>}
                        </td>
                      ))}
                    </tr>
                  )
                })}
              </tbody>
            ))}
          </table>
          {bySite.length === 0 && <p className="small">No technicians set up yet. Add them on the Teams tab.</p>}
          <p className="small hlegend"><i className="work" /> regular shift · 📟 on call 5 PM–midnight · highlighted column = {day}</p>
        </>
      )}
    </section>
  )
}
