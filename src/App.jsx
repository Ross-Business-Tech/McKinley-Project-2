import { useEffect, useMemo, useRef, useState } from 'react'
import './App.css'
import { SCENARIOS } from './data.js'
import { fmt, runEvaluation } from './evaluate.js'
import { liveScenario } from './planner.js'
import { sampleDay } from './casefile.js'
import Day from './Day.jsx'
import { Pill, Timelines } from './parts.jsx'
import { URGENCY, urgClass } from './urg.js'
import Repeat from './Repeat.jsx'

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
  const [mode, setMode] = useState('repeat') // repeat | single
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

      <div className="seg" role="radiogroup" aria-label="Evaluation mode">
        <button role="radio" aria-checked={mode === 'repeat'} className={mode === 'repeat' ? 'seg-on' : ''} onClick={() => setMode('repeat')}>
          Repeat runs (for AI models)
        </button>
        <button role="radio" aria-checked={mode === 'single'} className={mode === 'single' ? 'seg-on' : ''} onClick={() => setMode('single')}>
          One plan, step by step
        </button>
      </div>

      {mode === 'repeat' && <Repeat key={ctx.id} day={day} />}

      {mode === 'single' && (
        <>
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
        </>
      )}
      <footer className="note">The built-in sample day comes from the sprint's sample resident spreadsheet. Every value in it is synthetic, so no real resident, property or technician is shown.</footer>
    </main>
  )
}

function Skipped() {
  return <p className="note">Skipped: the plan could not work in real life, so it is not scored.</p>
}




function Metrics({ plan, hand }) {
  const rows = [
    ['Drive time', `${plan.driveMin} min`, `${hand.driveMin} min`, plan.driveMin <= hand.driveMin],
    ['Jobs finished', `${plan.finished} of ${plan.total}`, `${hand.finished} of ${hand.total}`, plan.finished >= hand.finished],
    ['Wasted trips', plan.wasted, hand.wasted, plan.wasted <= hand.wasted],
    ['Avg. wait for an urgent job', `${Math.round(plan.response)} min`, `${Math.round(hand.response)} min`, plan.response <= hand.response],
    ['Important notes reached the tech', `${plan.notes} of ${plan.notesTotal}`, `${hand.notes} of ${hand.notesTotal}`, plan.notes >= hand.notes],
    ['Right skill for the job', `${plan.skill} of ${plan.total}`, `${hand.skill} of ${hand.total}`, plan.skill >= hand.skill],
    ['Estimated cost', `$${plan.cost}`, `$${hand.cost}`, plan.cost <= hand.cost],
  ]
  return (
    <div className="scroll">
      <table>
        <thead>
          <tr><th>Measure</th><th>Planner</th><th>By hand</th></tr>
        </thead>
        <tbody>
          {rows.map(([label, a, b, better]) => (
            <tr key={label}>
              <td>{label}</td>
              <td className={better ? 'have' : 'miss'}>{a}</td>
              <td>{b}</td>
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
        <p>The same day planned the simple way a busy manager would: urgent jobs first, first free technician, no grouping.</p>
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
  return <Scorecard r={r} />
}

function Scorecard({ r }) {
  const p = r.planScore
  const h = r.handScore
  return (
    <div className="stack">
      <p className={`banner ${r.pass ? 'pass' : 'fail'}`} role="status">
        {r.pass ? 'PASS: all gates cleared' : 'FAIL: a must-pass check failed, whatever the other numbers say'}
      </p>
      <div className="stack">
        <b>Must-pass checks</b>
        {[...r.check.checks, ...r.gateList].map((g) => (
          <div key={g.label} className="row"><span>{g.label}</span><Pill ok={g.ok} /></div>
        ))}
      </div>
      {p && (
        <section className={`strip ${r.pass ? '' : 'dim'}`} aria-label="Planner compared with by hand">
          <div className="stat"><b>{h.driveMin - p.driveMin >= 0 ? '−' : '+'}{Math.abs(h.driveMin - p.driveMin)} min</b><span>Drive time vs. by hand</span></div>
          <div className="stat"><b>{h.wasted - p.wasted >= 0 ? '−' : '+'}{Math.abs(h.wasted - p.wasted)}</b><span>Wasted trips vs. by hand</span></div>
          <div className="stat"><b>${Math.abs(h.cost - p.cost)}</b><span>{p.cost <= h.cost ? 'Estimated saving' : 'Estimated extra cost'}</span></div>
        </section>
      )}
      {p && !r.pass && <p className="note">These numbers do not count: a must-pass check failed.</p>}
      <p className="note">Estimate only: the test day uses synthetic data and assumed times, not a real day.</p>
    </div>
  )
}
