import { useMemo, useState } from 'react'
import { PLANNERS, buildPrompt, parsePasted } from './planners.js'
import { gradeSingle, jobName, runBatch } from './batch.js'
import { Timelines } from './parts.jsx'

const pct = (x) => `${Math.round(x * 100)}%`
const KIND = { deterministic: 'Fixed rules', simulated: 'Simulated model', pasted: 'Pasted plan' }
const range = (s, f = (x) => x) => (s ? (s.min === s.max ? f(s.min) : `${f(s.min)}–${f(s.max)}`) : 'n/a')

export default function Repeat({ day }) {
  const { ctx, loaded } = day
  const [picked, setPicked] = useState(() => new Set(PLANNERS.map((p) => p.id)))
  const [count, setCount] = useState(10)
  const [seed, setSeed] = useState(2026)
  const [batches, setBatches] = useState([])
  const [pasted, setPasted] = useState([])
  const [name, setName] = useState('')
  const [text, setText] = useState('')
  const [error, setError] = useState('')
  const [copied, setCopied] = useState(false)
  const prompt = useMemo(() => buildPrompt(ctx), [ctx])
  const fromFile = useMemo(
    () =>
      loaded
        ? { ...gradeSingle(loaded.planner, ctx, loaded.plan, loaded.urgency), note: loaded.gaveUrgency ? '' : 'This file gave no urgency ratings for its plan, so the “no emergency played down” check could not be applied.' }
        : null,
    [loaded, ctx],
  )

  const toggle = (id) =>
    setPicked((s) => {
      const n = new Set(s)
      if (n.has(id)) n.delete(id)
      else n.add(id)
      return n
    })

  function run() {
    setBatches(PLANNERS.filter((p) => picked.has(p.id)).map((p) => runBatch(p, ctx, count, seed)))
    setSeed((s) => s + 1)
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(prompt)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      setError('Copying was blocked here. Open “Show the prompt” and copy it by hand.')
    }
  }

  function grade(e) {
    e.preventDefault()
    const r = parsePasted(text, ctx)
    if (r.error) return setError(r.error)
    setError('')
    const label = name.trim() || `Pasted plan ${pasted.length + 1}`
    setPasted((p) => [...p, { ...gradeSingle(label, ctx, r.plan, r.urgency), note: r.gaveUrgency ? '' : 'This answer gave no urgency ratings, so the “no emergency played down” check could not be applied.' }])
    setText('')
    setName('')
  }

  const results = [...(fromFile ? [fromFile] : []), ...batches, ...pasted]
  return (
    <>
      <section className="panel stack" aria-label="Choose planners and how many runs">
        <h2>Test planners the way AI models behave</h2>
        <p className="note">
          An AI model can give a different plan each time you ask. So one pass or fail tells you little. Here every planner plans the
          same day several times, each plan is graded with the same checks and must-pass gates, and you see how often it passes, how
          the results vary and which mistakes keep coming back.
        </p>
        <div className="checks" role="group" aria-label="Planners">
          {PLANNERS.map((p) => (
            <label key={p.id} className="pick">
              <input type="checkbox" checked={picked.has(p.id)} onChange={() => toggle(p.id)} />
              <span>
                <b>{p.label}</b>
                <br />
                <span className="note">{p.blurb}</span>
              </span>
            </label>
          ))}
        </div>
        <div className="actions">
          <label className="pick">
            Runs per planner
            <select value={count} onChange={(e) => setCount(Number(e.target.value))} aria-label="Runs per planner">
              {[5, 10, 25, 50].map((n) => (
                <option key={n} value={n}>{n}</option>
              ))}
            </select>
          </label>
          <button className="primary" onClick={run} disabled={!picked.size}>
            {batches.length ? 'Run again with a new mix' : 'Run the test'}
          </button>
        </div>
        <p className="note">The simulated models are stand-ins, not real AI. They start from a sound plan and make the kinds of slips people see from real models, at set rates. Use the box below to grade a real model.</p>
      </section>

      <section className="panel stack" aria-label="Grade a real model">
        <h2>Grade a real model (Claude, Muse, or any other)</h2>
        <ol className="rules">
          <li>Copy the test day as a prompt and give it to any model.</li>
          <li>Paste the model’s answer here. Nothing is sent anywhere.</li>
        </ol>
        <div className="actions">
          <button onClick={copy}>{copied ? 'Copied' : 'Copy the prompt'}</button>
        </div>
        <details>
          <summary>Show the prompt</summary>
          <textarea readOnly value={prompt} aria-label="Prompt to give the model" rows={8} />
        </details>
        <form className="stack" onSubmit={grade}>
          <label className="stack">
            <span className="note">Model name (optional)</span>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="For example: Claude, run 1" className="field" />
          </label>
          <label className="stack">
            <span className="note">The model’s answer</span>
            <textarea value={text} onChange={(e) => setText(e.target.value)} placeholder='{"plan": {"A": [...]}, "urgency": {...}}' />
          </label>
          {error && <p className="banner fail" role="alert">{error}</p>}
          <div className="actions">
            <button className="primary" type="submit" disabled={!text.trim()}>Grade this plan</button>
            {pasted.length > 0 && <button type="button" onClick={() => setPasted([])}>Clear pasted plans</button>}
          </div>
        </form>
      </section>

      {!results.length && (
        <section className="empty" aria-live="polite">
          <b>No results yet.</b> Press <i>Run the test</i>. Watch how the rule-based planner always gives the same result, while the
          simulated models vary from run to run.
        </section>
      )}

      {results.length > 0 && (
        <section className="stack" aria-label="Results" aria-live="polite">
          <h2>Results</h2>
          <div className="cards">
            {results.map((b, i) => (
              <Card key={`${b.planner.id}-${i}`} b={b} />
            ))}
          </div>
          <p className="note">Estimate only: the test day uses synthetic data and assumed times. The pass range shows how far a result could be from the truth given this few runs.</p>
        </section>
      )}
    </>
  )
}

function Card({ b }) {
  const { planner: p } = b
  const multi = b.n > 1
  return (
    <article className={`card ${b.unsafeRuns ? 'unsafe' : ''}`}>
      <div className="card-head">
        <div>
          <h3>{p.label}</h3>
          <span className="note">{KIND[p.kind]}</span>
        </div>
        <span className={`pill ${b.passes === b.n ? 'ok' : 'crit'}`}>{b.passes === b.n ? (multi ? 'All passed' : 'Pass') : b.passes ? 'Some failed' : 'Fail'}</span>
      </div>
      <p className={`verdict ${b.verdict.level}`} role="status">{b.verdict.text}</p>
      <div>
        <span className="big">{b.passes} of {b.n}</span> <span className="note">{b.n === 1 ? 'run passed' : 'runs passed'}</span>
        {multi && <p className="note">Likely pass rate: {pct(b.lo)} to {pct(b.hi)}</p>}
      </div>
      {multi && (
        <div className="dots" role="img" aria-label={`${b.passes} runs passed and ${b.n - b.passes} failed${b.unsafeRuns ? `, ${b.unsafeRuns} of them played an emergency down` : ''}`}>
          {b.runs.map((r) => (
            <span key={r.i} className={`dot ${r.pass ? '' : r.issues.some((x) => x.code === 'downgrade') ? 'unsafe' : 'fail'}`} />
          ))}
        </div>
      )}
      {b.note && <p className="note">{b.note}</p>}
      {b.cost && (
        <p className="note">
          Estimated cost {range(b.cost, (x) => `$${Math.round(x)}`)} · drive time {range(b.drive, (x) => `${Math.round(x)} min`)} · wasted trips {range(b.wasted, Math.round)}
          {multi ? ' (across runs that could be scored)' : ''}
        </p>
      )}
      {b.patterns.length > 0 ? (
        <div className="stack">
          <b>What went wrong{multi ? ', across runs' : ''}</b>
          <ul className="list">
            {b.patterns.map((x) => (
              <li key={x.label}>
                {x.label}: {x.runs} of {b.n} {b.n === 1 ? 'run' : 'runs'} {x.hard ? <span className="chip bad">fails the run</span> : <span className="chip flag">costs points</span>}
              </li>
            ))}
          </ul>
          {multi && b.problemJobs.length > 0 && <p className="note">Requests that went wrong most often: {b.problemJobs.map((j) => `${jobName(b.ctx, j.id)} (${j.runs})`).join(', ')}</p>}
        </div>
      ) : (
        <p className="note">No mistakes found in any run.</p>
      )}
      {b.worst && b.worst.issues.length > 0 && (
        <details>
          <summary>See the {multi ? 'worst run' : 'plan'}</summary>
          <Timelines list={b.worst.result.planTl} urgency={b.worst.urgency} comms={b.ctx.comms} />
        </details>
      )}
    </article>
  )
}
