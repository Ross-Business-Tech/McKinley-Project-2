import { SEVERITY } from './triage/config.js'
import { fmt } from './triage/engine.js'
import { workTicket, uiText, fill } from './triage/translate.js'
import { readPhotos } from './photos.js'
import { useEffect, useRef, useState } from 'react'
import { DAYS } from './triage/engine.js'
import { PartsList, ResidentUpdate } from './JobExtras.jsx'
import { MyPin } from './Access.jsx'

function canNotify() {
  try {
    return 'Notification' in window
  } catch {
    return false
  }
}

// What one technician sees on their phone: only work orders the manager has approved
// for them, in route order and in their own language.
export default function TechDay({ myPin, onPin, me, techs, plan, approved, techDone, setTechDone, addressOf, photos, addPhotos, progress, setProgress, parts, setParts, timeoff, setTimeoff }) {
  const t = techs.find((x) => x.id === me)
  const mine = plan.techs.find((x) => x.tech.id === me)
  const stops = mine ? mine.plan.stops : []
  const ready = stops.filter((s) => approved[s.job.id])
  const waiting = stops.length - ready.length
  const L = uiText(t?.lang)

  // Phone alerts: while this page is open, a newly approved urgent job pops up a notification.
  const [alerts, setAlerts] = useState(() => canNotify() && Notification.permission === 'granted')
  const known = useRef(null)
  useEffect(() => {
    const ids = ready.map((s) => s.job.id)
    if (known.current && alerts) {
      for (const s of ready) {
        if (!known.current.has(s.job.id) && s.job.sev >= 4) {
          try {
            new Notification(`${L.newJob}: ${s.job.label}`, { body: `${s.job.community || ''} ${s.job.resident ? `· Bldg ${s.job.resident.building} · Unit ${s.job.resident.unit}` : ''}`, tag: s.job.id })
          } catch {
            /* some phones only allow alerts from an installed app */
          }
        }
      }
    }
    known.current = new Set(ids)
  }, [ready, alerts, L.newJob])

  return (
    <>
      {canNotify() && (
        <button className={`btn alertbtn ${alerts ? 'done' : ''}`} onClick={async () => {
          try {
            setAlerts((await Notification.requestPermission()) === 'granted')
          } catch {
            setAlerts(false)
          }
        }}>{alerts ? L.alertsActive : L.alertsOn}</button>
      )}
      {ready.length === 0 && <section className="card"><p>{L.none}</p></section>}
      {ready.map(({ job: o, arrive }, i) => {
        const wt = workTicket(o, t, addressOf(o))
        const addr = addressOf(o)
        const phone = o.resident?.phone || o.phone
        const done = techDone[o.id]
        const pics = photos[o.id] || []
        return (
          <article key={o.id} className={`card order ${SEVERITY[o.sev].color} ${done ? 'faded' : ''}`}>
            <div className="row">
              <span className="stopnum">{i + 1}</span>
              <b>{L.arrive} {fmt(arrive)}</b>
              <span className={`pill ${SEVERITY[o.sev].color}`}>{wt.lines[1][1].split(' · ').slice(0, 2).join(' · ')}</span>
            </div>
            <dl className="techlines" dir={t.lang === 'ar' ? 'auto' : undefined}>
              {wt.lines.filter(([k]) => k !== wt.lines[1][0]).map(([k, v], j) => (
                <div key={j}><dt>{k}</dt><dd>{v}</dd></div>
              ))}
            </dl>
            {pics.length > 0 && (
              <div className="thumbs" aria-label={L.photos}>
                {pics.map((p, j) => <a key={j} href={p.src} target="_blank" rel="noreferrer"><img src={p.src} alt={`${L.photos} ${j + 1}`} /></a>)}
              </div>
            )}
            {!done && (
              <div className="row progbtns" aria-label={L.status}>
                {[['onway', L.onway], ['started', L.started], ['parts', L.waitParts]].map(([k, l]) => {
                  const p = progress[o.id] || {}
                  const on = !!p[k]
                  return (
                    <button key={k} type="button" className={`btn mini ${on ? 'done' : ''}`}
                      onClick={() => setProgress({ ...progress, [o.id]: { ...p, [k]: on && k === 'parts' ? null : new Date().toISOString(), by: t.name } })}>
                      {l}{on && k !== 'parts' ? ' ✓' : ''}
                    </button>
                  )
                })}
              </div>
            )}
            <div className="row techbtns">
              {addr && <a className="btn primary" href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(addr)}&travelmode=driving`} target="_blank" rel="noreferrer">📍 {L.directions}</a>}
              {phone && <a className="btn" href={`tel:${phone}`}>{L.call}</a>}
              {wt.translateUrl && <a className="btn" href={wt.translateUrl} target="_blank" rel="noreferrer">{L.translateMsg}</a>}
              <label className="btn photobtn">📷 {L.addPhoto}
                <input type="file" accept="image/*" capture="environment" multiple onChange={async (e) => { addPhotos(o.id, await readPhotos(e.target.files)); e.target.value = '' }} />
              </label>
              <button className={done ? 'done' : 'primary'} onClick={() => setTechDone({ ...techDone, [o.id]: done ? undefined : { by: t.name, at: new Date().toISOString() } })}>
                {done ? `✓ ${L.finished}` : L.done}
              </button>
            </div>
            <PartsList id={o.id} parts={parts} setParts={setParts} suggestions={o.bring} label={L.partsUsed} addLabel={L.add} />
            {done && <ResidentUpdate order={o} siteName={o.community} />}
          </article>
        )
      })}
      {waiting > 0 && <p className="small">{fill(L.waiting, { n: waiting })}</p>}
      {t && (
        <section className="card">
          <p className="small"><b>{L.dayOff}</b></p>
          <div className="chips">
            {DAYS.map((d) => {
              const k = `${t.id}|${d}`
              return <button key={d} className={`chip chipbtn ${timeoff[k] ? 'sel' : ''}`} onClick={() => setTimeoff({ ...timeoff, [k]: timeoff[k] ? undefined : true })}>{d}{timeoff[k] ? ' ✕' : ''}</button>
            })}
          </div>
        </section>
      )}
      <MyPin current={myPin} onSet={onPin} labels={{ title: L.changePin, save: '✓' }} />
      <p className="small notice">On the team's here.now site, this screen updates live when your supervisor approves a job, and your Done taps reach them. On test links it's saved on this phone only.</p>
    </>
  )
}
