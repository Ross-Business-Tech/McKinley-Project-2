import { useState } from 'react'
import { SEVERITY } from './triage/config.js'
import { fmt } from './triage/engine.js'
import { workTicket, uiText, langInfo, fill } from './triage/translate.js'
import { readPhotos } from './photos.js'

// What one technician sees on their phone: only work orders the manager has approved
// for them, in route order and in their own language.
export default function TechDay({ techs, plan, approved, techDone, setTechDone, addressOf, photos, addPhotos }) {
  const [me, setMe] = useState(techs.find((t) => t.lang && t.lang !== 'en')?.id || techs[0]?.id || '')
  const t = techs.find((x) => x.id === me)
  const mine = plan.techs.find((x) => x.tech.id === me)
  const stops = mine ? mine.plan.stops : []
  const ready = stops.filter((s) => approved[s.job.id])
  const waiting = stops.length - ready.length
  const L = uiText(t?.lang)
  const lang = langInfo(t?.lang)

  return (
    <>
      <label className="iam">{L.iam}
        <select value={me} onChange={(e) => setMe(e.target.value)}>
          {techs.map((x) => (
            <option key={x.id} value={x.id}>{x.name} · {x.sites.join(', ')} · {langInfo(x.lang)?.native || 'language not set'}</option>
          ))}
        </select>
      </label>
      {t && (
        <section className="techhead">
          <h2>{L.myDay} · {t.name}</h2>
          <p className="small">{lang?.native || 'English'}{lang && !lang.full ? ' (English shown, tap Translate)' : ''} · {fmt(t.shift[0])}–{fmt(t.shift[1])}</p>
        </section>
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
            <div className="row techbtns">
              {addr && <a className="btn primary" href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(addr)}&travelmode=driving`} target="_blank" rel="noreferrer">📍 {L.directions}</a>}
              {phone && <a className="btn" href={`tel:${phone}`}>{L.call}</a>}
              {wt.translateUrl && <a className="btn" href={wt.translateUrl} target="_blank" rel="noreferrer">{L.translateMsg}</a>}
              <label className="btn photobtn">📷 {L.addPhoto}
                <input type="file" accept="image/*" capture="environment" multiple onChange={async (e) => { addPhotos(o.id, await readPhotos(e.target.files)); e.target.value = '' }} />
              </label>
              <button className={done ? 'done' : 'primary'} onClick={() => setTechDone({ ...techDone, [o.id]: done ? undefined : { by: t.name } })}>
                {done ? `✓ ${L.finished}` : L.done}
              </button>
            </div>
          </article>
        )
      })}
      {waiting > 0 && <p className="small">{fill(L.waiting, { n: waiting })}</p>}
      <p className="small notice">Prototype: this screen shares data with the manager board only on the same phone or computer. Using it on separate phones needs the team's here.now site with saved data.</p>
    </>
  )
}
