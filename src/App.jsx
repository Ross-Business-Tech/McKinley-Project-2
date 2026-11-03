import { useEffect, useState } from 'react'
import './App.css'
import { SAMPLE_REFERRALS, BEFORE_DAYS, GOAL_DAYS, DEPARTMENTS } from './sampleData.js'
import { askAI } from './ai.js'

const URGENCIES = ['Urgent', 'Soon', 'Routine']

function Scoreboard() {
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
      <div className="score now">
        <span className="score-label">Now</span>
        <span className="score-value">—</span>
        <span className="score-note">route a referral to start</span>
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

function ReferralDetail({ referral, result, choice, onChange, onBack }) {
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

      <button type="button" className="primary" disabled>
        Route it (coming in step 3)
      </button>
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

function App() {
  const [referrals, setReferrals] = useState(SAMPLE_REFERRALS)
  const [selectedId, setSelectedId] = useState(null)
  const [pasting, setPasting] = useState(false)
  const [aiResults, setAiResults] = useState({}) // id -> askAI result
  const [choices, setChoices] = useState({}) // id -> { department, urgency }

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

      <Scoreboard />

      <main className={`workspace${showingPanel ? ' has-selection' : ''}`}>
        <section className="inbox" aria-label="Inbox">
          <h2 className="section-title">
            1. Inbox <span className="count">{referrals.length} new</span>
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
          />
        ) : (
          <section className="detail empty">
            <p>Pick a referral from the inbox to see it here.</p>
          </section>
        )}
      </main>
    </div>
  )
}

export default App
