import { useState } from 'react'
import './App.css'
import { SAMPLE_REFERRALS, BEFORE_DAYS, GOAL_DAYS } from './sampleData.js'

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
            Waiting {referral.waitingDays} {referral.waitingDays === 1 ? 'day' : 'days'}
          </span>
        </span>
        <span className="inbox-from">{referral.from}</span>
        <span className="inbox-snippet">{referral.text}</span>
      </button>
    </li>
  )
}

function ReferralDetail({ referral, onBack }) {
  return (
    <section className="detail" aria-label="Referral details">
      <button type="button" className="back-link" onClick={onBack}>
        ← Back to inbox
      </button>
      <p className="detail-id">
        {referral.id} · arrived by {referral.via.toLowerCase()}
      </p>
      <h2>{referral.from}</h2>
      <p className="detail-patient">{referral.patient}</p>
      <blockquote className="detail-text">{referral.text}</blockquote>
      <div className="next-step">
        <strong>Next:</strong> the AI will suggest where to send this referral. (Coming in step 2.)
      </div>
    </section>
  )
}

function App() {
  const [selectedId, setSelectedId] = useState(null)
  const selected = SAMPLE_REFERRALS.find((r) => r.id === selectedId)

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

      <main className={`workspace${selected ? ' has-selection' : ''}`}>
        <section className="inbox" aria-label="Inbox">
          <h2 className="section-title">
            1. Inbox <span className="count">{SAMPLE_REFERRALS.length} new</span>
          </h2>
          <p className="hint">Tap a referral to open it.</p>
          <ul className="inbox-list">
            {SAMPLE_REFERRALS.map((r) => (
              <InboxItem
                key={r.id}
                referral={r}
                selected={r.id === selectedId}
                onSelect={setSelectedId}
              />
            ))}
          </ul>
        </section>

        {selected ? (
          <ReferralDetail referral={selected} onBack={() => setSelectedId(null)} />
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
