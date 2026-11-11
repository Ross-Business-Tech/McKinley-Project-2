import { useState } from 'react'
import history from './triage/history.json' with { type: 'json' }
import { fmt } from './triage/engine.js'
import { missingInfo } from './triage/followup.js'
import { readPhotos } from './photos.js'

// What a resident sees: only their own requests, where each one stands, and what we need from them.
// Residents never see technicians' phone numbers or other residents' requests.

const T = {
  en: {
    title: 'My maintenance requests', newReq: 'New request', mine: 'My requests', past: 'Past requests',
    none: "You don't have any open requests.", steps: ['Received', 'Approved', 'Scheduled', 'On the way', 'Working', 'Fixed'],
    onway: (n) => `${n} is on the way to your home.`, started: (n) => `${n} is working on it now.`, parts: 'Waiting on a part. We will come back to finish as soon as it arrives.',
    received: "We've got your request and are reviewing it.", approved: 'Approved. We are lining up the right technician.',
    scheduled: (name, time) => `${name} is scheduled to come around ${time}.`, done: 'Your repair is finished.',
    emergency: 'Emergency: if you smell gas or see smoke or fire, leave your home and call 911. Our team is on the way.',
    vendor: "This one needs a specialist company. We're arranging them and will let you know the time.",
    needOk: 'We need your OK to enter your home.', giveOk: 'Yes, you may enter', okGiven: 'Thanks, you gave us permission to enter.',
    needInfo: 'We need a bit more information:', reply: 'Reply to our team', send: 'Send', sent: 'Sent. Thank you!',
    fixed: 'Is it fixed?', yes: 'Yes, all good', no: 'Still a problem', thanksYes: 'Great, thank you for letting us know!', thanksNo: "Sorry about that. We've told your maintenance team.",
    describe: "What's wrong? Where in your home is it?", photos: '📷 Add photos (optional)', submit: 'Send to maintenance',
    submitted: "Thanks! Your request was sent. You'll see its status here.", unit: 'Unit', bldg: 'Bldg', switch: 'Sign out',
    note: 'Only you can see your requests after signing in. Prototype with sample residents.',
  },
  es: {
    title: 'Mis solicitudes de mantenimiento', newReq: 'Nueva solicitud', mine: 'Mis solicitudes', past: 'Solicitudes anteriores',
    none: 'No tiene solicitudes abiertas.', steps: ['Recibida', 'Aprobada', 'Programada', 'En camino', 'Trabajando', 'Reparada'],
    onway: (n) => `${n} va en camino a su casa.`, started: (n) => `${n} está trabajando en ello ahora.`, parts: 'Esperando una pieza. Regresaremos a terminar en cuanto llegue.',
    received: 'Recibimos su solicitud y la estamos revisando.', approved: 'Aprobada. Estamos asignando al técnico adecuado.',
    scheduled: (name, time) => `${name} tiene programado llegar alrededor de las ${time}.`, done: 'Su reparación está terminada.',
    emergency: 'Emergencia: si huele a gas o ve humo o fuego, salga de su casa y llame al 911. Nuestro equipo va en camino.',
    vendor: 'Esta reparación necesita una compañía especializada. La estamos coordinando y le avisaremos la hora.',
    needOk: 'Necesitamos su permiso para entrar a su casa.', giveOk: 'Sí, pueden entrar', okGiven: 'Gracias, nos dio permiso para entrar.',
    needInfo: 'Necesitamos un poco más de información:', reply: 'Responder a nuestro equipo', send: 'Enviar', sent: '¡Enviado. Gracias!',
    fixed: '¿Quedó reparado?', yes: 'Sí, todo bien', no: 'Sigue el problema', thanksYes: '¡Excelente, gracias por avisarnos!', thanksNo: 'Lo sentimos. Ya le avisamos a su equipo de mantenimiento.',
    describe: '¿Qué pasa? ¿En qué parte de su casa?', photos: '📷 Agregar fotos (opcional)', submit: 'Enviar a mantenimiento',
    submitted: '¡Gracias! Su solicitud fue enviada. Verá su estado aquí.', unit: 'Unidad', bldg: 'Edif.', switch: 'Cerrar sesión',
    note: 'Solo usted puede ver sus solicitudes después de iniciar sesión. Prototipo con residentes de ejemplo.',
  },
}

export default function ResidentView({ me, orders, setRaw, fullPlan, approved, techDone, state, setState, feedback, setFeedback, replies, setReplies, photos, addPhotos, progress, syncChip, onSwitch }) {
  const L = me.lang === 'Spanish' ? T.es : T.en
  const [tab, setTab] = useState('mine')
  const [text, setText] = useState('')
  const [pics, setPics] = useState([])
  const [done, setDone] = useState(false)
  const [draft, setDraft] = useState({})

  const mine = orders.filter((o) => o.resident?.id === me.id).reverse()
  const past = history.filter((h) => h.res === me.id && h.status === 'closed').reverse()
  const stopOf = (id) => {
    for (const t of fullPlan.techs) {
      const s = t.plan.stops.find((x) => x.job.id === id)
      if (s) return { name: t.tech.name, arrive: s.arrive }
    }
    return null
  }

  const submit = (e) => {
    e.preventDefault()
    if (!text.trim()) return
    const id = `R${Date.now().toString(36).toUpperCase()}`
    const now = new Date()
    setRaw((r) => [...r, { id, residentId: me.id, received: `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`, text: text.trim().slice(0, 1000), phone: me.phone, email: me.email, from: 'resident' }])
    if (pics.length) addPhotos(id, pics)
    setText('')
    setPics([])
    setDone(true)
    setTab('mine')
  }

  return (
    <main className="app">
      <header className="hero hero-tech">
        <div className="row between">
          <span className="wordmark">mckinley</span>
          <button className="switch" onClick={onSwitch}>{L.switch}</button>
        </div>
        {syncChip}
        <h1>{L.title}</h1>
        <p>{me.community} · {L.unit} {me.unit}</p>
      </header>

      <nav className="tabs">
        {[['mine', L.mine], ['new', L.newReq]].map(([k, l]) => (
          <button key={k} className={tab === k ? 'on' : ''} onClick={() => { setTab(k); setDone(false) }}>{l}</button>
        ))}
      </nav>

      {tab === 'new' && (
        <form className="card" onSubmit={submit}>
          <label>{L.describe}
            <textarea rows={4} value={text} onChange={(e) => setText(e.target.value)} required maxLength={1000} />
          </label>
          <label className="btn photobtn">{L.photos}
            <input type="file" accept="image/*" multiple onChange={async (e) => { const l = await readPhotos(e.target.files); setPics((p) => [...p, ...l].slice(0, 6)); e.target.value = '' }} />
          </label>
          {pics.length > 0 && <div className="thumbs">{pics.map((p, i) => <img key={i} src={p.src} alt={`${i + 1}`} />)}</div>}
          <p className="small">{L.emergency}</p>
          <button className="primary send" type="submit">{L.submit}</button>
        </form>
      )}

      {tab === 'mine' && (
        <>
          {done && <p className="notice">{L.submitted}</p>}
          {mine.length === 0 && <section className="card"><p>{L.none}</p></section>}
          {mine.map((o) => {
            const stop = stopOf(o.id)
            const isDone = !!techDone[o.id]
            const pr = progress[o.id] || {}
            const latest = ['onway', 'started', 'parts'].filter((k) => pr[k]).sort((a, b) => (pr[a] > pr[b] ? -1 : 1))[0]
            const step = isDone ? 5 : latest === 'started' || latest === 'parts' ? 4 : latest === 'onway' ? 3 : approved[o.id] && stop ? 2 : approved[o.id] ? 1 : 0
            const techName = pr.by || stop?.name || ''
            const needOk = o.entry.status === 'hold' && !o.okReceived
            const missing = missingInfo(o).filter((m) => m.key !== 'entry')
            const fb = feedback[o.id]
            const myReplies = replies[o.id] || []
            return (
              <article key={o.id} className={`card order ${isDone ? 'green' : o.sev >= 5 ? 'red' : 'orange'}`}>
                <p className="text">“{o.text}”</p>
                <ol className="steps">
                  {L.steps.map((s, i) => <li key={s} className={i <= step ? 'on' : ''}>{s}</li>)}
                </ol>
                <p className="status">
                  {isDone ? L.done : latest === 'parts' ? L.parts : step === 4 ? L.started(techName) : step === 3 ? L.onway(techName) : step === 2 ? L.scheduled(stop.name, fmt(stop.arrive)) : step === 1 ? L.approved : L.received}
                </p>
                {o.sev >= 5 && !isDone && <p className="notice warn">{L.emergency}</p>}
                {o.vendor && !isDone && <p className="small">{L.vendor}</p>}
                {(photos[o.id] || []).length > 0 && <div className="thumbs">{photos[o.id].map((p, i) => <img key={i} src={p.src} alt={`${i + 1}`} />)}</div>}

                {needOk && (
                  <div className="askbox">
                    <p><b>{L.needOk}</b></p>
                    <button className="primary" onClick={() => setState({ ...state, [o.id]: { ...state[o.id], okReceived: true } })}>{L.giveOk}</button>
                  </div>
                )}
                {o.entry.status === 'hold' && o.okReceived && <p className="small">✓ {L.okGiven}</p>}

                {missing.length > 0 && !isDone && (
                  <div className="askbox">
                    <p><b>{L.needInfo}</b> {missing.map((m) => m.ask).join('; ')}</p>
                  </div>
                )}
                {!isDone && (
                  <form className="row partform" onSubmit={(e) => {
                    e.preventDefault()
                    const t = (draft[o.id] || '').trim()
                    if (!t) return
                    setReplies({ ...replies, [o.id]: [...myReplies, { text: t.slice(0, 500), at: new Date().toISOString() }] })
                    setDraft({ ...draft, [o.id]: '' })
                  }}>
                    <input value={draft[o.id] || ''} onChange={(e) => setDraft({ ...draft, [o.id]: e.target.value })} placeholder={L.reply} aria-label={L.reply} />
                    <button type="submit">{L.send}</button>
                  </form>
                )}
                {myReplies.length > 0 && <ul className="replies">{myReplies.map((r, i) => <li key={i}>{r.text}</li>)}</ul>}

                {isDone && (
                  <div className="askbox">
                    {!fb ? (
                      <>
                        <p><b>{L.fixed}</b></p>
                        <div className="row">
                          <button className="primary" onClick={() => setFeedback({ ...feedback, [o.id]: { ok: true, at: new Date().toISOString() } })}>{L.yes}</button>
                          <button onClick={() => setFeedback({ ...feedback, [o.id]: { ok: false, at: new Date().toISOString() } })}>{L.no}</button>
                        </div>
                      </>
                    ) : <p>{fb.ok ? L.thanksYes : L.thanksNo}</p>}
                  </div>
                )}
              </article>
            )
          })}
          {past.length > 0 && (
            <section className="card">
              <h2>{L.past}</h2>
              <ul className="pastlist">
                {past.map((h) => <li key={h.id}><b>{h.subject}</b> · {h.at.slice(0, 10)} · ✓ {L.steps[5]}</li>)}
              </ul>
            </section>
          )}
          <p className="small notice">{L.note}</p>
        </>
      )}
    </main>
  )
}
