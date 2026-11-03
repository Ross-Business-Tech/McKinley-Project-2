import { useEffect, useState } from 'react'
import { ROBOTS, COST_PER_HOUR } from './data.js'
import { askAI, AI_LABEL, formatHours } from './ai.js'
import './App.css'

const RISK_LABEL = { high: 'Act now', medium: 'Watch', low: 'Healthy' }
const RISK_ORDER = { high: 0, medium: 1, low: 2 }

function money(n) {
  return '$' + Math.round(n).toLocaleString('en-US')
}

function AiBadge() {
  return <span className="ai-badge">{AI_LABEL}</span>
}

function RobotCard({ robot, result, selected, onSelect }) {
  return (
    <button
      type="button"
      className={`robot-card risk-${result.risk} ${selected ? 'selected' : ''}`}
      onClick={onSelect}
      aria-pressed={selected}
    >
      <span className={`risk-pill risk-${result.risk}`}>{RISK_LABEL[result.risk]}</span>
      <span className="robot-id">{robot.id}</span>
      <span className="robot-meta">
        {robot.line} · {robot.job}
      </span>
      <span className="robot-forecast">
        {result.risk === 'low'
          ? 'No failure expected in the next 2 days'
          : `${result.failureName} in ${formatHours(result.hoursToFailure)}`}
      </span>
    </button>
  )
}

function SignalRow({ r }) {
  const pct = Math.min(100, r.pctOfLimit)
  const level = r.pctOfLimit >= 90 ? 'high' : r.pctOfLimit >= 75 ? 'medium' : 'low'
  return (
    <li className="signal">
      <div className="signal-top">
        <span className="signal-label">{r.label}</span>
        <span className="signal-value">
          {r.latest.toLocaleString('en-US')}
          {r.unit ? ` ${r.unit}` : ''} <span className="signal-limit">/ limit {r.limit.toLocaleString('en-US')}</span>
        </span>
      </div>
      <div className="bar" aria-hidden="true">
        <div className={`bar-fill risk-${level}`} style={{ width: `${pct}%` }} />
      </div>
      <div className="signal-trend">
        Last 3 shifts: {r.history.join(' → ')} {r.rising ? '▲ rising' : '■ steady'}
      </div>
    </li>
  )
}

function RobotDetail({ robot, onBack }) {
  const [state, setState] = useState({ loading: true })

  useEffect(() => {
    let cancelled = false
    setState({ loading: true })
    askAI({ task: 'assess', robot }).then((res) => {
      if (!cancelled) setState({ loading: false, res })
    })
    return () => {
      cancelled = true
    }
  }, [robot])

  const res = state.res
  return (
    <section className="detail" aria-live="polite">
      <button type="button" className="back-link" onClick={onBack}>
        ← All robots
      </button>
      <h2>
        {robot.id} <span className="detail-sub">{robot.line} · {robot.job}</span>
      </h2>

      <div className="ai-panel">
        <div className="ai-panel-head">
          <h3>Agent assessment</h3>
          <AiBadge />
        </div>
        {state.loading && <p className="thinking">Reading the last 3 shifts of sensor data…</p>}
        {!state.loading && res.error && <p className="error-msg">{res.error}</p>}
        {!state.loading && !res.error && (
          <>
            <p className={`ai-summary risk-${res.risk}`}>{res.summary}</p>
            <dl className="facts">
              <div>
                <dt>Likely problem</dt>
                <dd>{res.failureName}</dd>
              </div>
              <div>
                <dt>Time to failure</dt>
                <dd>{res.risk === 'low' ? 'More than 2 days' : formatHours(res.hoursToFailure)}</dd>
              </div>
              <div>
                <dt>Confidence</dt>
                <dd>{res.confidence}</dd>
              </div>
            </dl>
            <h4>Why the agent thinks so</h4>
            <ul className="reasons">
              {res.reasons.map((reason) => (
                <li key={reason}>{reason}</li>
              ))}
              {res.whyItHappens && <li>Typical cause: {res.whyItHappens}.</li>}
            </ul>
            <h4>Recommended action</h4>
            <p className="recommendation">{res.recommendation}</p>
          </>
        )}
      </div>

      <h3>Sensor readings</h3>
      <ul className="signals">
        {robot.signals.map((s) => {
          const h = s.history
          const latest = h[h.length - 1]
          return (
            <SignalRow
              key={s.key}
              r={{ ...s, latest, rising: latest > h[0], pctOfLimit: Math.round((latest / s.limit) * 100) }}
            />
          )
        })}
      </ul>
    </section>
  )
}

export default function App() {
  const [results, setResults] = useState(null)
  const [selectedId, setSelectedId] = useState(null)

  // On load, the agent scans every robot and ranks them by risk.
  useEffect(() => {
    Promise.all(ROBOTS.map((robot) => askAI({ task: 'assess', robot }))).then((list) => {
      const byId = {}
      list.forEach((r, i) => {
        byId[ROBOTS[i].id] = r.error ? { risk: 'low', failureName: '—', hoursToFailure: Infinity } : r
      })
      setResults(byId)
    })
  }, [])

  const ranked = results
    ? [...ROBOTS].sort(
        (a, b) =>
          RISK_ORDER[results[a.id].risk] - RISK_ORDER[results[b.id].risk] ||
          results[a.id].hoursToFailure - results[b.id].hoursToFailure,
      )
    : []
  const counts = results
    ? Object.values(results).reduce((acc, r) => ({ ...acc, [r.risk]: (acc[r.risk] || 0) + 1 }), {})
    : {}
  // Each at-risk robot can stop its line: $12K for every hour it is down.
  const atRiskCount = (counts.high || 0) + (counts.medium || 0)
  const selected = ROBOTS.find((r) => r.id === selectedId)

  return (
    <div className={`app ${selected ? 'has-selection' : ''}`}>
      <header className="topbar">
        <div>
          <p className="eyebrow">Ironvale Automotive Parts · Body shop</p>
          <h1>Weld Cell Coordinator</h1>
        </div>
        <p className="shift">2nd shift · sample data</p>
      </header>

      <section className="summary" aria-label="Risk summary">
        {!results ? (
          <p className="thinking">
            Agent is scanning {ROBOTS.length} welding robots… <AiBadge />
          </p>
        ) : (
          <>
            <div className="stat risk-high">
              <span className="stat-num">{counts.high || 0}</span>
              <span className="stat-label">Act now</span>
            </div>
            <div className="stat risk-medium">
              <span className="stat-num">{counts.medium || 0}</span>
              <span className="stat-label">Watch</span>
            </div>
            <div className="stat risk-low">
              <span className="stat-num">{counts.low || 0}</span>
              <span className="stat-label">Healthy</span>
            </div>
            <div className="stat stat-wide">
              <span className="stat-num">{money(atRiskCount * COST_PER_HOUR)}</span>
              <span className="stat-label">
                per hour of line time at risk ({atRiskCount} robots)
              </span>
            </div>
          </>
        )}
      </section>

      <main className="layout">
        <section className="board" aria-label="Welding robots ranked by risk">
          <h2 className="board-title">Robots ranked by risk</h2>
          {results &&
            ranked.map((robot) => (
              <RobotCard
                key={robot.id}
                robot={robot}
                result={results[robot.id]}
                selected={robot.id === selectedId}
                onSelect={() => setSelectedId(robot.id)}
              />
            ))}
        </section>

        {selected ? (
          <RobotDetail robot={selected} onBack={() => setSelectedId(null)} />
        ) : (
          <section className="detail empty">
            <p>Tap a robot to see what the agent found and what it recommends.</p>
          </section>
        )}
      </main>
    </div>
  )
}
