import { useEffect, useMemo, useRef, useState } from 'react'
import './App.css'
import { SCENARIOS } from './data.js'
import { GATE_CAP, fmt, measureRows, runEvaluation, verdictFor } from './evaluate.js'
import { liveScenario } from './planner.js'
import { sampleDay } from './casefile.js'
import Day from './Day.jsx'
import { Pill, Timelines } from './parts.jsx'
import { URGENCY, urgClass } from './urg.js'

const STEPS = [
  { n: 1, title: 'Write the test day', short: 'A day of requests from the sheet, plus an assumed crew and drive times' },
  { n: 2, title: 'Planner makes a plan', short: 'The planner sees the day, never the answer key' },
  { n: 3, title: 'Plan handed back', short: 'Only the plan itself is judged' },
  { n: 4, title: 'Check', short: 'Could this plan work in real life?' },
  { n: 5, title: 'Compare', short: 'We plan the same day by hand' },
  { n: 6, title: 'Score', short: 'Both plans graded the same way' },
  { n: 7, title: 'Gates', short: 'Must-pass checks' },
  { n: 8, title: 'Scorecard', short: 'One-page summary' },
]

const reduceMotion = () => typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

export default function App() {
  const [day, setDay] = useState(() => ({ ctx: sampleDay(), loaded: null }))
  const [scenarioId, setScenarioId] = useState('live')
  const [status, setStatus] = useState('idle') // idle | running | done
  const [step, setStep] = useState(0) // number of finished steps
  const timer = useRef(null)
  const { ctx, loaded } = day
  const scenarios = useMemo(() => {
    const list = [liveScenario(ctx)]
    if (ctx.isSample) list.push(...SCENARIOS)
    if (loaded) {
      list.push({ id: 'file', label: loaded.planner, blurb: 'The plan that came in the case file you loaded.', selfReport: 'No self-reported score given', urgency: loaded.urgency, plan: loaded.plan })
    }
    return list
  }, [ctx, loaded])
  const scenario = scenarios.find((s) => s.id === scenarioId) || scenarios[0]
  const result = useMemo(() => {
    try {
      return runEvaluation(ctx, scenario)
    } catch {
      return null
    }
  }, [ctx, scenario])

  function changeDay(d) {
    clearInterval(timer.current)
    setStatus('idle')
    setStep(0)
    setScenarioId(d.loaded ? 'file' : 'live')
    setDay(d)
  }

  useEffect(() => () => clearInterval(timer.current), [])

  function run() {
    clearInterval(timer.current)
    if (reduceMotion()) {
      setStep(8)
      setStatus('done')
      return
    }
    setStep(0)
    setStatus('running')
    timer.current = setInterval(() => {
      setStep((s) => {
        if (s + 1 >= 8) {
          clearInterval(timer.current)
          setStatus('done')
        }
        return s + 1
      })
    }, 650)
  }

  function showNow() {
    clearInterval(timer.current)
    setStep(8)
    setStatus('done')
  }

  function reset() {
    clearInterval(timer.current)
    setStatus('idle')
    setStep(0)
  }

  function pick(id) {
    setScenarioId(id)
    reset()
  }

  if (!result) {
    return (
      <main className="wrap">
        <p className="banner fail" role="alert">Something went wrong building the test. Please reload the page.</p>
      </main>
    )
  }

  const skipped = !result.check.ok // plan is not feasible: steps 5–7 cannot run
  return (
    <main className="wrap">
      <header className="stack">
        <span className="tag">Evaluator demo · made-up sample data</span>
        <h1>Plan Evaluator</h1>
        <p className="sub">
          Tests a maintenance planner the way a teacher grades an exam: the planner hands in a plan, we check it, compare it with a
          by-hand plan, score both, and apply must-pass gates. It works on any day described in a case file, from any planner. The built-in sample day uses made-up data, so results are estimates.
        </p>
      </header>

      <Day day={day} setDay={changeDay} />

      <section className="panel stack" aria-label="Choose a planner to test">
        <h2>1. Pick a planner to test</h2>
        <div className="seg" role="radiogroup" aria-label="Planner scenarios">
          {scenarios.map((s) => (
            <button key={s.id} role="radio" aria-checked={s.id === scenarioId} className={s.id === scenarioId ? 'seg-on' : ''} onClick={() => pick(s.id)}>
              {s.label}
            </button>
          ))}
        </div>
        <p className="note">{scenario.blurb}</p>
        <div className="actions">
          <button className="primary" onClick={run} disabled={status === 'running'}>
            {status === 'running' ? `Running step ${Math.min(step + 1, 8)} of 8…` : status === 'done' ? 'Run again' : 'Run the evaluation'}
          </button>
          {status !== 'running' && status !== 'done' && <button onClick={showNow}>Show the score now</button>}
          {status !== 'idle' && status !== 'running' && <button onClick={reset}>Clear</button>}
        </div>
      </section>

      {status === 'idle' && (
        <section className="empty" aria-live="polite">
          <b>No evaluation yet.</b> Choose a planner above and press <i>Run the evaluation</i>. Try “Good plan” first, then the others to
          see each gate catch a different problem.
        </section>
      )}

      {status !== 'idle' && (
        <ol className="steps" aria-live="polite">
          {STEPS.map((s) => {
            const state = step >= s.n ? 'done' : step + 1 === s.n && status === 'running' ? 'active' : 'pending'
            const isSkipped = skipped && s.n >= 5 && s.n <= 7
            return (
              <li key={s.n} className={`step ${state}`}>
                <div className="step-head">
                  <span className="num">{state === 'active' ? <i className="spin" aria-hidden="true" /> : s.n}</span>
                  <div>
                    <h3>{s.title}</h3>
                    <p className="note">{s.short}</p>
                  </div>
                </div>
                {state === 'done' && <div className="step-body">{isSkipped ? <Skipped /> : <StepBody n={s.n} scenario={scenario} r={result} ctx={ctx} />}</div>}
              </li>
            )
          })}
        </ol>
      )}
      <footer className="note">The built-in sample day comes from the sprint's sample resident spreadsheet. Every value in it is synthetic, so no real resident, property or technician is shown.</footer>
    </main>
  )
}

function Skipped() {
  return <p className="note">Skipped: the plan could not work in real life, so it is not scored.</p>
}




function Metrics({ plan, hand }) {
  const rows = measureRows(plan, hand)
  return (
    <div className="scroll">
      <table>
        <thead>
          <tr><th>Measure</th><th>Planner</th><th>By hand</th></tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.key}>
              <td>{r.label}</td>
              <td className={r.cmp > 0 ? 'have' : r.cmp < 0 ? 'miss' : ''}>{r.plan}{r.note && <><br /><span className="note">{r.note}</span></>}</td>
              <td>{r.hand}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function StepBody({ n, scenario, r, ctx }) {
  if (n === 1) {
    return (
      <div className="stack">
        <p className="note">
          <b>From the day's data:</b> each request, where it is, its entry window, the resident's notes, the crew and the drive times.
          {ctx.isSample && <> The sample day's urgency, skills, job lengths, crew and drive times are assumptions.</>}
          {ctx.source && <> Source: {ctx.source}</>}
        </p>
        <div className="scroll">
          <table>
            <thead><tr><th>Request</th><th>Where</th><th>What the request says</th></tr></thead>
            <tbody>
              {ctx.jobs.map((j) => (
                <tr key={j.id}>
                  <td><b>{j.rid}</b><br /><span className="note">{j.trade}{j.iid && <><br />{j.iid}</>}</span></td>
                  <td>{ctx.comms[j.comm].name}</td>
                  <td>{j.text}<span className="chips">{j.hidden.map((h) => <span key={h} className="chip">{h}</span>)}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="note">
          Crew: {ctx.crew.map((t) => `${t.name} (${t.trade})`).join(' · ')}. Shifts {fmt(ctx.shift[0])}–{fmt(ctx.shift[1])}. Drive times:{' '}
          {ctx.travelPairs.map((p) => `${ctx.comms[p.a].name} to ${ctx.comms[p.b].name} ${p.minutes} min`).join('; ') || 'none listed'}.
        </p>
        <details>
          <summary>Answer key (sealed from the planner){ctx.isSample ? '; urgency and skill are our assumptions' : ''}</summary>
          <div className="scroll">
            <table>
              <thead><tr><th>Request</th><th>True urgency</th><th>Right skill</th><th>Must tell the tech</th></tr></thead>
              <tbody>
                {ctx.jobs.map((j) => (
                  <tr key={j.id}>
                    <td><b>{j.rid}</b></td>
                    <td>{j.urgency === null ? <span className="note">Not given</span> : <span className={`pill ${urgClass(j.urgency)}`}>{URGENCY[j.urgency]}</span>}</td>
                    <td>{j.trade}</td>
                    <td>{j.note}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
      </div>
    )
  }
  if (n === 2) {
    return (
      <div className="stack">
        <p>The planner receives the requests and crew list above. It does not know it is being graded and never sees the answer key.</p>
        {scenario.rules && (
          <>
            <b>How this planner decides</b>
            <ol className="rules">{scenario.rules.map((r) => <li key={r}>{r}</li>)}</ol>
          </>
        )}
        {!scenario.rules && <p className="note">This plan is a scripted example, written by hand to show one kind of mistake.</p>}
      </div>
    )
  }
  if (n === 3) {
    return (
      <div className="stack">
        <Timelines list={r.planTl} urgency={scenario.urgency} comms={ctx.comms} />
        <p className="note"><s>{scenario.selfReport}</s> We ignore anything the planner says about itself; only the plan counts.</p>
      </div>
    )
  }
  if (n === 4) {
    return (
      <div className="stack">
        {r.check.checks.map((c) => (
          <div key={c.label} className="row">
            <span>{c.label}{c.detail && !c.ok && <span className="note"><br />{c.detail}</span>}</span>
            <Pill ok={c.ok} />
          </div>
        ))}
        {!r.check.ok && <p className="banner fail" role="alert">This plan would not work in real life, so it cannot be scored.</p>}
      </div>
    )
  }
  if (n === 5) {
    return (
      <div className="stack">
        <p>The same day planned the naive way: requests in the order they came in, each to the first technician with the right skill at that site, no grouping and no waiting for entry windows.</p>
        <Timelines list={r.handTl} compact comms={ctx.comms} />
      </div>
    )
  }
  if (n === 6) return <Metrics plan={r.planScore} hand={r.handScore} />
  if (n === 7) {
    return (
      <div className="stack">
        {r.gateList.map((g) => (
          <div key={g.label} className="row">
            <span>{g.label}<span className="note"><br />{g.detail}</span></span>
            <Pill ok={g.ok} />
          </div>
        ))}
      </div>
    )
  }
  return <Scorecard r={r} ctx={ctx} />
}

function Scorecard({ r, ctx }) {
  const p = r.planScore
  const h = r.handScore
  const delta = r.final === null ? null : r.final - r.handPts.total
  return (
    <div className="stack">
      {r.final !== null ? (
        <div className={`scorebox ${r.pass ? 'pass' : 'fail'}`} role="status">
          <div className="score-main">
            <span className="score-num">{r.final}</span>
            <span className="score-of">/ 100</span>
          </div>
          <div>
            <b>{r.pass ? verdictFor(r.final) : 'Fails a must-pass check'}</b>
            <p>By hand: {r.handPts.total} / 100 · {delta === 0 ? 'the same as by hand' : `${delta > 0 ? '+' : '−'}${Math.abs(delta)} ${delta > 0 ? 'better' : 'worse'} than by hand`}</p>
            {r.capped && <p>The plan earned {r.planPts.total} on the rubric, but a must-pass gate failed, so the score is capped at {GATE_CAP}.</p>}
          </div>
        </div>
      ) : (
        <p className="banner fail" role="status">NOT SCORED: this plan could not work in real life. By hand scores {r.handPts.total} / 100.</p>
      )}
      {p && (() => {
        const rows = measureRows(p, h)
        const better = rows.filter((x) => x.cmp > 0)
        const worse = rows.filter((x) => x.cmp < 0)
        return (
          <div className="stack">
            <b>Compared with by hand: better on {better.length}, worse on {worse.length}, same or not comparable on {rows.length - better.length - worse.length} of {rows.length} measures</b>
            {better.length > 0 && <ul className="list good">{better.map((x) => <li key={x.key}>{x.say(1)}</li>)}</ul>}
            {worse.length > 0 && <ul className="list bad">{worse.map((x) => <li key={x.key}>Worse: {x.say(-1)}</li>)}</ul>}
          </div>
        )
      })()}
      {ctx.held.length > 0 && (
        <div className="stack">
          <b>On hold, not scheduled ({ctx.held.length})</b>
          {ctx.held.map((h) => (
            <div key={h.id} className="row">
              <span>{h.id} · {h.rid}{h.text ? `: “${h.text.slice(0, 70)}${h.text.length > 70 ? '…' : ''}”` : ''}<span className="note"><br />{h.reason}</span></span>
              {h.urgency === 3 ? <span className="pill crit">Urgent: needs a person now</span> : <span className="pill warn">On hold</span>}
            </div>
          ))}
          <p className="note">Held requests are not part of the score. Any that are urgent still need a person to act today.</p>
        </div>
      )}
      {r.planPts && (
        <div className="scroll">
          <table>
            <thead><tr><th>What the score is made of</th><th>Plan</th><th>By hand</th></tr></thead>
            <tbody>
              {r.planPts.parts.map((part, i) => {
                const hp = r.handPts.parts[i]
                return (
                  <tr key={part.key} className={part.na ? 'na' : ''}>
                    <td>{part.label}<br /><span className="note">{part.na ? 'Not counted: the case file gave nothing to check it against' : `Worth ${part.max} points`}</span></td>
                    <td className={!part.na && part.got >= hp.got ? 'have' : ''}>{part.na ? '–' : `${part.got}`}<br /><span className="note">{part.detail}</span></td>
                    <td>{part.na ? '–' : `${hp.got}`}<br /><span className="note">{hp.detail}</span></td>
                  </tr>
                )
              })}
              <tr><td><b>Total</b></td><td><b>{r.planPts.total}</b></td><td><b>{r.handPts.total}</b></td></tr>
            </tbody>
          </table>
        </div>
      )}
      <div className="stack">
        <b>Must-pass checks</b>
        {[...r.check.checks, ...r.gateList].map((g) => (
          <div key={g.label} className="row"><span>{g.label}{g.skipped && <span className="note"><br />{g.detail}</span>}</span><Pill ok={g.ok} /></div>
        ))}
      </div>
      {p && (
        <section className={`strip ${r.pass ? '' : 'dim'}`} aria-label="Planner compared with by hand">
          <div className="stat"><b>{h.driveMin - p.driveMin >= 0 ? '−' : '+'}{Math.abs(h.driveMin - p.driveMin)} min</b><span>Drive time vs. by hand</span></div>
          <div className="stat"><b>{h.wasted - p.wasted >= 0 ? '−' : '+'}{Math.abs(h.wasted - p.wasted)}</b><span>Wasted trips vs. by hand</span></div>
          <div className="stat"><b>${Math.abs(h.cost - p.cost)}</b><span>{p.cost <= h.cost ? 'Estimated saving' : 'Estimated extra cost'} (not part of the score)</span></div>
        </section>
      )}
      <p className="note">The “by hand” plan is a naive plan made by code: requests in the order they came in, each to the first technician with the right skill at that site, no grouping, no reordering by urgency and no waiting for entry windows. Estimate only: the test day uses made-up data.</p>
    </div>
  )
}
