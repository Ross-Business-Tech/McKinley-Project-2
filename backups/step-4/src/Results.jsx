import { PILOT_RESULTS, FAILURE_TYPES, COST_PER_HOUR } from './data.js'

function money(n) {
  return '$' + Math.round(n).toLocaleString('en-US')
}

// Before/after view of unplanned downtime: the client's success metric.
export default function Results({ orders }) {
  const r = PILOT_RESULTS
  const before = r.byFailure.reduce((s, f) => s + f.before, 0)
  const after = r.byFailure.reduce((s, f) => s + f.after, 0)
  const cut = (before - after) / before
  const target = before * (1 - r.targetCut)
  const met = cut >= r.targetCut

  // Live tally from work orders released in this demo session.
  const released = Object.values(orders).filter((o) => o.status === 'released')
  const avoidedToday = released.reduce((s, o) => s + (o.plan.unplannedCost - o.plan.plannedCost), 0)

  return (
    <section className="results" aria-labelledby="results-title">
      <h2 id="results-title">Is it working? Unplanned downtime, before vs. with the agent</h2>
      <p className="results-sub">6 welding robots · sample pilot data (invented) · ${(COST_PER_HOUR / 1000).toFixed(0)}K per hour of line downtime</p>

      <div className="hero-compare">
        <div className="hero before">
          <span className="hero-label">{r.beforeLabel}</span>
          <span className="hero-num">{before} hrs</span>
          <span className="hero-money">{money(before * COST_PER_HOUR)}</span>
        </div>
        <div className="hero-arrow" aria-hidden="true">→</div>
        <div className="hero after">
          <span className="hero-label">{r.afterLabel}</span>
          <span className="hero-num">{after} hrs</span>
          <span className="hero-money">{money(after * COST_PER_HOUR)}</span>
        </div>
        <div className={`hero verdict ${met ? 'met' : ''}`}>
          <span className="hero-label">Change</span>
          <span className="hero-num">−{Math.round(cut * 100)}%</span>
          <span className="hero-money">
            {met ? '✔ Beats the 30% target' : '✖ Below the 30% target'} · saves {money((before - after) * COST_PER_HOUR)}/month
          </span>
        </div>
      </div>

      <div className="bars-chart" role="img" aria-label={`Downtime fell from ${before} hours to ${after} hours. Target is ${target} hours or less.`}>
        {[
          { label: 'Before', hours: before, cls: 'bar-before' },
          { label: 'With agent', hours: after, cls: 'bar-after' },
        ].map((b) => (
          <div className="hbar-row" key={b.label}>
            <span className="hbar-label">{b.label}</span>
            <div className="hbar-track">
              <div
                className={`hbar ${b.cls}`}
                style={{ width: `${(b.hours / before) * 100}%` }}
                title={`${b.label}: ${b.hours} hrs = ${money(b.hours * COST_PER_HOUR)}`}
              />
              <span className="target-line" style={{ left: `${(target / before) * 100}%` }} aria-hidden="true" />
            </div>
            <span className="hbar-value">{b.hours} hrs</span>
          </div>
        ))}
        <p className="target-key">
          <span className="target-swatch" aria-hidden="true" /> Target: {target} hrs or less (30% cut)
        </p>
      </div>

      <div className="results-grid">
        <div>
          <h3>Where the hours came back</h3>
          <table className="breakdown">
            <thead>
              <tr>
                <th scope="col">Failure type</th>
                <th scope="col">Before</th>
                <th scope="col">With agent</th>
              </tr>
            </thead>
            <tbody>
              {r.byFailure.map((f) => (
                <tr key={f.key}>
                  <th scope="row">{FAILURE_TYPES[f.key].name}</th>
                  <td>{f.before} hrs</td>
                  <td>{f.after} hrs</td>
                </tr>
              ))}
              <tr className="total">
                <th scope="row">Total</th>
                <td>{before} hrs</td>
                <td>{after} hrs</td>
              </tr>
            </tbody>
          </table>
        </div>
        <div>
          <h3>How the agent did it</h3>
          <ul className="how-list">
            <li>
              <strong>{r.caughtEarly.caught} of {r.caughtEarly.total}</strong> breakdowns were spotted early from sensor trends
            </li>
            <li>
              <strong>{r.fixedInsideBreaks}</strong> repairs fit inside breaks the line already had
            </li>
            <li>
              <strong>{r.partsWaitsAvoided}</strong> waits for parts or tools avoided, because they were reserved before the job
            </li>
          </ul>
          <div className="today-tally">
            <span className="hero-label">In this demo so far</span>
            <span className="today-num">{money(avoidedToday)}</span>
            <span>
              downtime avoided by {released.length} released work order{released.length === 1 ? '' : 's'}
              {released.length === 0 && '. Prepare and release a repair on the Robots tab to see this grow.'}
            </span>
          </div>
        </div>
      </div>
    </section>
  )
}
