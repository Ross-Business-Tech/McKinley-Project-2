import { useEffect, useMemo, useState } from 'react'
import '../App.css'
import '../store.js'
import { useShared, useSyncMode, setWho, signedInEmail } from '../shared.js'
import { load, save } from '../util.js'
import { RESIDENTS, buildOrder, buildPlan, DAYS } from '../triage/engine.js'
import { photoRecords, assemblePhotos } from '../photos.js'
import ResidentLogin from '../ResidentLogin.jsx'
import ResidentView from '../ResidentView.jsx'
import { ResidentNotices } from './Notices.jsx'
import { SyncChip } from '../staff/Bits.jsx'

// The resident app: a separate page (/resident/) with no staff screens or staff sign-in in it.
// It shares requests and statuses with the staff app through the team's saved data.
export default function ResidentApp() {
  const syncMode = useSyncMode()
  const [raw, setRaw] = useShared('orders')
  const [state, setState] = useShared('state')
  const [assign] = useShared('assign')
  const [approved] = useShared('approved')
  const [techDone] = useShared('techDone')
  const [aiRes] = useShared('ai')
  const [progress] = useShared('progress')
  const [feedback, setFeedback] = useShared('feedback')
  const [replies, setReplies] = useShared('replies')
  const [teams] = useShared('teams')
  const [turns] = useShared('turns')
  const [pm] = useShared('pm')
  const [vendorjobs] = useShared('vendorjobs')
  const [rescodes] = useShared('rescodes')
  const [sites] = useShared('sites')
  const [photometa, setPhotometa] = useShared('photometa')
  const [photochunks, setPhotochunks] = useShared('photochunks')
  const [residentId, setResidentId] = useState(() => load('mk-resident', null))
  const [email, setEmail] = useState(null)
  useEffect(() => save('mk-resident', residentId), [residentId])
  useEffect(() => {
    signedInEmail().then(setEmail)
  }, [])

  const me = RESIDENTS.find((r) => r.id === residentId) || (email && RESIDENTS.find((r) => (r.email || '').toLowerCase() === email)) || null
  setWho(me ? `Resident · ${me.community} unit ${me.unit}` : 'resident')

  const orders = useMemo(() => raw.map((r) => buildOrder(r, state[r.id], aiRes[r.id])), [raw, state, aiRes])
  // Today's plan (regular hours or on-call, from the clock) so residents see who is coming and when.
  const [schedule] = useState(() => {
    const now = new Date()
    const day = DAYS[now.getDay()]
    const h = now.getHours()
    return { day, afterHours: h < 8 || h >= 17 || day === 'Sat' || day === 'Sun' }
  })
  const plan = useMemo(() => buildPlan(orders, assign, teams.map((t) => ({ ...t, home: t.sites[0] || '' })), schedule), [orders, assign, teams, schedule])
  const photos = useMemo(() => assemblePhotos(photometa, photochunks), [photometa, photochunks])
  const addPhotos = (id, list) => {
    if (!list.filter(Boolean).length) return
    const { meta, chunks } = photoRecords(id, list, photometa[id], 'resident')
    setPhotochunks((c) => ({ ...c, ...chunks }))
    setPhotometa((m) => ({ ...m, [id]: meta }))
  }

  if (!me) {
    return (
      <main className="app">
        <header className="hero">
          <span className="wordmark">mckinley</span>
          <h1>Maintenance requests</h1>
          <p>Send a request and see where yours stand.</p>
        </header>
        <div className="card rolecard sel">
          <b>🏠 Resident sign-in</b>
          <ResidentLogin siteNames={sites.map((x) => x.name)} rescodes={rescodes} onSuccess={setResidentId} />
        </div>
        <p className="small notice">Only you can see your requests after signing in.</p>
      </main>
    )
  }

  return (
    <ResidentView me={me} orders={orders} setRaw={setRaw} fullPlan={plan} approved={approved} techDone={techDone}
      state={state} setState={setState} feedback={feedback} setFeedback={setFeedback} replies={replies} setReplies={setReplies}
      photos={photos} addPhotos={addPhotos} progress={progress}
      notices={<ResidentNotices me={me} turns={turns} pm={pm} vendorjobs={vendorjobs} myOrderIds={orders.filter((o) => o.resident?.id === me.id).map((o) => o.id)} />}
      syncChip={<SyncChip mode={syncMode} email={email} />} onSwitch={() => setResidentId(null)} />
  )
}

