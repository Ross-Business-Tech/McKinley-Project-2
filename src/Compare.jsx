import { useState } from 'react'
import { compare, evaluateGate } from './evalcompare/compare.js'
import { defaultConfig, defaultVariants, makeDays } from './evalcompare/experiment.js'

const LABELS = { finishedRate: 'Jobs finished', wasted: 'Wasted trips', driveMin: 'Drive minutes', cost: 'Cost ($)', response: 'Emergency response (min)' }
const PLANNER = { live: 'Rule-based planner', 'live-no-priority': 'Rule-based planner without urgent-first' }
const NICE = { better: 'Better', worse: 'Worse', 'below min effect': 'Too small to matter', 'no significant difference': 'No clear difference' }
const cls = (v) => (v === 'better' ? 'ok' : v === 'worse' ? 'crit' : 'warn')
const num = (x, d = 2) => (Number.isFinite(x) ? x.toFixed(d) : '–')

// Runs the planners on many generated days right in the browser and shows whether each one is clearly better or worse than by hand.
async function runCompare(days) {
  const examples = makeDays(days, 1)
  const rows = []
  for (const v of defaultVariants()) {
    for (const ex of examples) {
      const out = await v.run(ex)
      rows.push({ variant: v.id, example: ex.id, trial: 0, ok: true, metrics: out.metrics, output: out.output, latencyMs: 0 })
    }
  }
  const config = { ...defaultConfig, seed: 1, examples }
  const result = compare(rows, config)
  return { result, gate: evaluateGate(result), config }
}

export default function Compare() {
  const [days, setDays] = useState(200)
  const [state, setState] = useState({ status: 'idle' })

  async function go() {
    setState({ status: 'running' })
    try {
      await new Promise((r) => setTimeout(r, 30)) // let the "running" message paint first
      setState({ status: 'done', ...(await runCompare(days)) })
    } catch {
      setState({ status: 'error' })
    }
  }

  return (
    <section className="panel stack" aria-label="Compare planners over many days">
      <h2>Compare planners over many days</h2>
      <p className="note">
        One day can be luck. This tests every planner on many made-up days (the same days for each) and says whether it is clearly better or worse than the by-hand plan.
      </p>
      <label className="note" htmlFor="days">Number of days to test: <b>{days}</b></label>
      <input id="days" type="range" min="20" max="500" step="10" value={days} onChange={(e) => setDays(Number(e.target.value))} />
      <div className="actions">
        <button className="primary" onClick={go} disabled={state.status === 'running'}>{state.status === 'running' ? 'Testing…' : 'Compare planners'}</button>
      </div>
      {state.status === 'error' && <p className="banner fail" role="alert">Something went wrong. Try fewer days.</p>}
      {state.status === 'done' && <Results {...state} />}
    </section>
  )
}

function Results({ result, gate }) {
  const names = Object.keys(result.variants)
  return (
    <div className="stack" aria-live="polite">
      <p className={`banner ${gate.pass ? 'pass' : 'fail'}`}>{gate.pass ? 'PASS: no planner is clearly worse than by hand' : 'FAIL: a planner is clearly worse than by hand'}</p>
      {result.warnings.map((w) => <p key={w} className="note">⚠ {w}</p>)}
      {names.map((v) => {
        const pv = result.variants[v]
        return (
          <div key={v} className="tl">
            <h3>{PLANNER[v] ?? v} vs by hand {result.pareto.includes(v) ? '★' : ''}</h3>
            <p className="note">Compared on {pv.paired.length} days{pv.dropped ? ` (${pv.dropped} left out because of errors)` : ''}.</p>
            {Object.entries(pv.metrics).map(([m, r]) => (
              <div key={m} className="row">
                <div>
                  <b>{LABELS[m] ?? m}</b>
                  <p className="note">By hand {num(r.baselineMean)} → planner {num(r.candidateMean)} · better on {r.wins} days, worse on {r.losses}, same on {r.ties}</p>
                </div>
                <span className={`pill ${cls(r.verdict)}`}>{NICE[r.verdict]}</span>
              </div>
            ))}
            <details>
              <summary>By type of day</summary>
              {Object.entries(pv.slices).flatMap(([m, ss]) => Object.entries(ss).map(([s, r]) => (
                <div key={m + s} className="row"><span className="note">{LABELS[m] ?? m} · {s} ({r.n} days)</span><span className={`pill ${cls(r.verdict)}`}>{NICE[r.verdict]}</span></div>
              )))}
            </details>
            {Object.values(pv.regressions).flat().length > 0 && (
              <details>
                <summary>Days where it did worse than by hand</summary>
                {[...new Set(Object.values(pv.regressions).flat().map((r) => r.id))].slice(0, 5).map((id) => <p key={id} className="note">{id}</p>)}
              </details>
            )}
          </div>
        )
      })}
      <p className="note">★ = best balance of jobs finished and cost. Days are generated from the sample spreadsheet's requests, so these are estimates.</p>
    </div>
  )
}
