import { useEffect, useState } from 'react'
import './App.css'
import {
  SAMPLE_REFERRALS,
  SAMPLE_TRACKER,
  BEFORE_DAYS,
  GOAL_DAYS,
  DEPARTMENTS,
  COORDINATORS,
} from './sampleData.js'
import { askAI } from './ai.js'

const URGENCIES = ['Urgent', 'Soon', 'Routine']
const URGENCY_RANK = { Urgent: 0, Soon: 1, Routine: 2 }

function plural(n, word) {
  return `${n} ${word}${n === 1 ? '' : 's'}`
}

function Scoreboard({ tracker }) {
  const finished = tracker.filter((t) => t.turnaround !== undefined)
  const avg = finished.length
    ? finished.reduce((sum, t) => sum + t.turnaround, 0) / finished.length
    : null
  const avgText = avg === null ? '—' : `${Number.isInteger(avg) ? avg : avg.toFixed(1)} days`
  const onGoal = avg !== null && avg <= GOAL_DAYS
  return (
    <section className="scoreboard" aria-label="Turnaround before and after">
      <div className="score before">
        <span className="score-label">Before</span>
        <span className="score-value">{BEFORE_DAYS} days</span>
        <span className="score-note">average referral turnaround</span>
      </div>
      <div className="score goal">
        <span className="score-label">Goal</span>
        <span className="score-value">{GOAL_DAYS} days</span>
        <span className="score-note">routed right the first time</span>
      </div>
      <div className={`score now${onGoal ? ' on-goal' : ''}`}>
        <span className="score-label">Now {onGoal && '✓'}</span>
        <span className="score-value">{avgText}</span>
        <span className="score-note">
          {avg === null
            ? 'route a referral to start'
            : `average of ${plural(finished.length, 'scheduled referral')}`}
        </span>
      </div>
    </section>
  )
}

function InboxItem({ referral, selected, onSelect }) {
  const late = referral.waitingDays > GOAL_DAYS
  return (
    <li>
      <button
        type="button"
        className={`inbox-item${selected ? ' selected' : ''}`}
        onClick={() => onSelect(referral.id)}
      >
        <span className="inbox-top">
          <span className={`badge via-${referral.via.toLowerCase()}`}>{referral.via}</span>
          <span className={`waiting${late ? ' late' : ''}`}>
            {referral.waitingDays === 0
              ? 'Just added'
              : `Waiting ${referral.waitingDays} ${referral.waitingDays === 1 ? 'day' : 'days'}`}
          </span>
        </span>
        <span className="inbox-from">{referral.from}</span>
        <span className="inbox-snippet">{referral.text}</span>
      </button>
    </li>
  )
}

function AiSuggestion({ result, choice, onChange }) {
  if (!result) {
    return (
      <div className="ai-card thinking" role="status">
        <span className="ai-label">Prototype AI (simulated)</span>
        <p>Reading the referral…</p>
      </div>
    )
  }

  const level = result.ok
    ? result.confidence >= 85
      ? 'high'
      : result.confidence >= 65
        ? 'medium'
        : 'low'
    : 'none'

  return (
    <div className="ai-card" aria-live="polite">
      <span className="ai-label">Prototype AI (simulated)</span>

      {!result.ok && <p className="ai-error">{result.message}</p>}

      <label className="field">
        <span className="field-label">Send to</span>
        <select
          value={choice.department}
          onChange={(e) => onChange({ ...choice, department: e.target.value })}
        >
          <option value="">Choose a department…</option>
          {DEPARTMENTS.map((d) => (
            <option key={d} value={d}>
              {d}
            </option>
          ))}
        </select>
      </label>

      <div className="field">
        <span className="field-label">Urgency</span>
        <div className="segmented" role="group" aria-label="Urgency">
          {URGENCIES.map((u) => (
            <button
              key={u}
              type="button"
              className={`seg seg-${u.toLowerCase()}${choice.urgency === u ? ' on' : ''}`}
              aria-pressed={choice.urgency === u}
              onClick={() => onChange({ ...choice, urgency: u })}
            >
              {u}
            </button>
          ))}
        </div>
      </div>

      {result.ok && (
        <>
          <div className="field">
            <span className="field-label">Missing info</span>
            {result.missing.length === 0 ? (
              <p className="check ok">✓ Everything needed is there.</p>
            ) : (
              <p className="check warn">
                ⚠ Missing: <strong>{result.missing.join(', ')}</strong>. Ask the doctor’s office for
                this before sending, so it isn’t bounced back.
              </p>
            )}
          </div>

          <div className="field">
            <span className="field-label">How sure</span>
            <div className={`confidence ${level}`}>
              <div className="bar">
                <div className="fill" style={{ width: `${result.confidence}%` }} />
              </div>
              <span className="conf-text">
                {level === 'high' ? 'Very sure' : level === 'medium' ? 'Fairly sure' : 'Not sure'} (
                {result.confidence}%)
              </span>
            </div>
            <p className="reason">
              <strong>Why:</strong> {result.reason}
            </p>
          </div>
        </>
      )}
      <p className="override-note">You can change any of these before routing.</p>
    </div>
  )
}

function ReferralDetail({ referral, result, choice, onChange, onBack, onRoute }) {
  const [error, setError] = useState('')

  function route() {
    if (!choice.department) {
      setError('Please choose a department in “Send to” first.')
      return
    }
    if (!choice.owner) {
      setError('Please choose who will chase this referral.')
      return
    }
    onRoute(referral, choice)
  }

  return (
    <section className="detail" aria-label="Referral details">
      <button type="button" className="back-link" onClick={onBack}>
        ← Back to inbox
      </button>
      <p className="detail-id">
        {referral.id} · {referral.via === 'Pasted' ? 'pasted in by you' : `arrived by ${referral.via.toLowerCase()}`}
      </p>
      <h2>{referral.from}</h2>
      <p className="detail-patient">{referral.patient}</p>
      <blockquote className="detail-text">{referral.text}</blockquote>

      <h3 className="step-title">2. Check where it goes</h3>
      <AiSuggestion result={result} choice={choice} onChange={onChange} />

      {result && (
        <>
          <h3 className="step-title">3. Who will chase it?</h3>
          <label className="field">
            <span className="field-label">Owner (gets a 3-day deadline)</span>
            <select
              value={choice.owner || ''}
              onChange={(e) => {
                onChange({ ...choice, owner: e.target.value })
                setError('')
              }}
            >
              <option value="">Choose a coordinator…</option>
              {COORDINATORS.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </label>
          {error && (
            <p className="ai-error route-error" role="alert">
              {error}
            </p>
          )}
          <button type="button" className="primary" onClick={route}>
            Route it{choice.department ? ` to ${choice.department}` : ''} →
          </button>
        </>
      )}
    </section>
  )
}

function PastePanel({ onSubmit, onBack }) {
  const [text, setText] = useState('')
  const [error, setError] = useState('')

  function submit(e) {
    e.preventDefault()
    if (!text.trim()) {
      setError('There’s no referral text yet. Paste the fax or email first.')
      return
    }
    onSubmit(text.trim())
  }

  return (
    <section className="detail" aria-label="Paste a new referral">
      <button type="button" className="back-link" onClick={onBack}>
        ← Back to inbox
      </button>
      <h2>Paste a new referral</h2>
      <p className="hint">Copy the text from the fax or email and paste it here.</p>
      <form onSubmit={submit}>
        <textarea
          className="paste-box"
          rows={6}
          value={text}
          placeholder="e.g. Please see for worsening knee pain after a fall. X-ray attached. Insurance: Coastal Care."
          onChange={(e) => {
            setText(e.target.value)
            setError('')
          }}
        />
        {error && (
          <p className="ai-error" role="alert">
            {error}
          </p>
        )}
        <button type="submit" className="primary">
          Sort it with AI
        </button>
      </form>
    </section>
  )
}

function countdown(item, today) {
  const daysIn = today - item.routedDay
  if (item.status === 'Done') return { text: `Done (took ${plural(item.turnaround, 'day')})`, tone: 'done' }
  if (item.status === 'Scheduled')
    return { text: `Scheduled ✓ (took ${plural(item.turnaround, 'day')})`, tone: 'ok' }
  const left = GOAL_DAYS - daysIn
  if (left < 0) return { text: `Overdue by ${plural(-left, 'day')}`, tone: 'late', overdue: true }
  if (left === 0) return { text: 'Due today', tone: 'soon' }
  return { text: `Due in ${plural(left, 'day')}`, tone: left === 1 ? 'soon' : 'ok' }
}

function Tracker({ items, today, onStatus, onNextDay }) {
  const withClock = items.map((it) => ({ ...it, clock: countdown(it, today) }))
  const order = (it) =>
    it.status === 'Done' ? 3 : it.status === 'Scheduled' ? 2 : it.clock.overdue ? 0 : 1
  withClock.sort(
    (a, b) =>
      order(a) - order(b) ||
      URGENCY_RANK[a.urgency] - URGENCY_RANK[b.urgency] ||
      b.routedDay - a.routedDay,
  )
  const overdue = withClock.filter((i) => i.clock.overdue).length
  const open = withClock.filter((i) => i.status === 'Sent').length

  return (
    <section className="tracker" id="tracker" aria-label="Tracker">
      <div className="tracker-head">
        <div>
          <h2 className="section-title">Tracker: who’s chasing what</h2>
          <p className="hint">
            {open} waiting for an appointment
            {overdue > 0 && (
              <>
                {' · '}
                <strong className="late-text">{overdue} overdue</strong>
              </>
            )}
          </p>
        </div>
        <button type="button" className="ghost" onClick={onNextDay}>
          ⏩ Skip to next day (demo)
        </button>
      </div>
      <ul className="tracker-list">
        {withClock.map((it) => (
          <li key={it.id} className={`track-card tone-${it.clock.tone}`}>
            <div className="track-top">
              <span className={`badge urg-${it.urgency.toLowerCase()}`}>{it.urgency}</span>
              <span className={`clock tone-${it.clock.tone}`}>{it.clock.text}</span>
            </div>
            <p className="track-dept">{it.department}</p>
            <p className="track-from">
              {it.id} · {it.from}
            </p>
            <div className="track-bottom">
              <span className="owner">
                Owner: <strong>{it.owner}</strong>
              </span>
              {it.status === 'Sent' && (
                <button type="button" className="small" onClick={() => onStatus(it.id, 'Scheduled')}>
                  Mark scheduled
                </button>
              )}
              {it.status === 'Scheduled' && (
                <button type="button" className="small" onClick={() => onStatus(it.id, 'Done')}>
                  Mark done
                </button>
              )}
              {it.status === 'Done' && <span className="done-tag">✓ Done</span>}
            </div>
          </li>
        ))}
      </ul>
    </section>
  )
}

function App() {
  const [referrals, setReferrals] = useState(SAMPLE_REFERRALS)
  const [selectedId, setSelectedId] = useState(null)
  const [pasting, setPasting] = useState(false)
  const [aiResults, setAiResults] = useState({}) // id -> askAI result
  const [choices, setChoices] = useState({}) // id -> { department, urgency, owner }
  const [tracker, setTracker] = useState(SAMPLE_TRACKER)
  const [today, setToday] = useState(0) // demo clock: days since the app opened
  const [toast, setToast] = useState('')

  const selected = referrals.find((r) => r.id === selectedId)

  // Ask the AI about a referral the first time it is opened.
  useEffect(() => {
    if (!selected || aiResults[selected.id]) return
    let cancelled = false
    askAI(selected.text).then((result) => {
      if (cancelled) return
      setAiResults((prev) => ({ ...prev, [selected.id]: result }))
      setChoices((prev) => ({
        ...prev,
        [selected.id]: {
          department: result.ok ? result.department : '',
          urgency: result.ok ? result.urgency : 'Routine',
        },
      }))
    })
    return () => {
      cancelled = true
    }
  }, [selected, aiResults])

  function openReferral(id) {
    setPasting(false)
    setSelectedId(id)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  function addPasted(text) {
    const id = `R-${2000 + referrals.length}`
    const newRef = {
      id,
      from: 'Pasted referral',
      via: 'Pasted',
      waitingDays: 0,
      patient: 'Patient details as written in the referral',
      text,
    }
    setReferrals((prev) => [newRef, ...prev])
    openReferral(id)
  }

  function routeReferral(referral, choice) {
    setTracker((prev) => [
      {
        id: referral.id,
        from: referral.from,
        department: choice.department,
        urgency: choice.urgency,
        owner: choice.owner,
        routedDay: today,
        status: 'Sent',
      },
      ...prev,
    ])
    setReferrals((prev) => prev.filter((r) => r.id !== referral.id))
    setSelectedId(null)
    setToast(`✓ Sent to ${choice.department}. ${choice.owner} owns it, due in ${GOAL_DAYS} days.`)
    setTimeout(() => setToast(''), 4000)
    setTimeout(() => document.getElementById('tracker')?.scrollIntoView({ behavior: 'smooth' }), 50)
  }

  function setStatus(id, status) {
    setTracker((prev) =>
      prev.map((t) =>
        t.id !== id
          ? t
          : status === 'Scheduled'
            ? { ...t, status, turnaround: Math.max(1, today - t.routedDay) }
            : { ...t, status },
      ),
    )
  }

  function goBack() {
    setSelectedId(null)
    setPasting(false)
  }

  const showingPanel = pasting || selected

  return (
    <div className="app">
      <header className="topbar">
        <div>
          <p className="org">Saint Aurelia Medical Center</p>
          <h1>Referral Autopilot</h1>
        </div>
        <span className="sample-tag">Sample data only</span>
      </header>

      <Scoreboard tracker={tracker} />

      <main className={`workspace${showingPanel ? ' has-selection' : ''}`}>
        <section className="inbox" aria-label="Inbox">
          <h2 className="section-title">
            1. Inbox <span className="count">{referrals.length} to sort</span>
          </h2>
          <p className="hint">Tap a referral to open it.</p>
          <button
            type="button"
            className="paste-button"
            onClick={() => {
              setSelectedId(null)
              setPasting(true)
            }}
          >
            + Paste a new referral
          </button>
          <ul className="inbox-list">
            {referrals.map((r) => (
              <InboxItem
                key={r.id}
                referral={r}
                selected={r.id === selectedId}
                onSelect={openReferral}
              />
            ))}
          </ul>
        </section>

        {pasting ? (
          <PastePanel onSubmit={addPasted} onBack={goBack} />
        ) : selected ? (
          <ReferralDetail
            referral={selected}
            result={aiResults[selected.id]}
            choice={choices[selected.id] || { department: '', urgency: 'Routine' }}
            onChange={(c) => setChoices((prev) => ({ ...prev, [selected.id]: c }))}
            onBack={goBack}
            onRoute={routeReferral}
          />
        ) : (
          <section className="detail empty">
            <p>
              {referrals.length
                ? 'Pick a referral from the inbox to see it here.'
                : 'Inbox empty. Every referral has an owner. 🎉'}
            </p>
          </section>
        )}
      </main>

      <div className={showingPanel ? 'hide-on-phone' : ''}>
        <Tracker
          items={tracker}
          today={today}
          onStatus={setStatus}
          onNextDay={() => setToday((d) => d + 1)}
        />
      </div>

      {toast && (
        <div className="toast" role="status">
          {toast}
        </div>
      )}
    </div>
  )
}

export default App
