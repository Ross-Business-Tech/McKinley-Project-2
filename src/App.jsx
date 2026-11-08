import { useEffect, useMemo, useRef, useState } from 'react'
import './App.css'
import { COMMUNITIES, JOBS, SCENARIOS, SHEET_NAME, TECHS, URGENCY } from './data.js'
import { fmt, runEvaluation } from './evaluate.js'
import { LIVE_SCENARIO } from './planner.js'

const ALL_SCENARIOS = [LIVE_SCENARIO, ...SCENARIOS]

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

const urgClass = (u) => (u === 3 ? 'crit' : u === 2 ? 'warn' : 'ok')
const reduceMotion = () => typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

export default function App() {
  const [scenarioId, setScenarioId] = useState('live')
  const [status, setStatus] = useState('idle') // idle | running | done
  const [step, setStep] = useState(0) // number of finished steps
  const timer = useRef(null)
  const scenario = ALL_SCENARIOS.find((s) => s.id === scenarioId)
  const result = useMemo(() => {
    try {
      return runEvaluation(scenario)
    } catch {
      return null
    }
  }, [scenario])

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
        <span className="tag">Evaluator demo · built from the sample spreadsheet</span>
        <h1>Plan Evaluator</h1>
        <p className="sub">
          Tests a maintenance planner the way a teacher grades an exam: the planner hands in a plan, we check it, compare it with a
          by-hand plan, score both, and apply must-pass gates. The people and requests come from the sprint's sample spreadsheet. The crew, job times and drive times are assumptions, so results are estimates.
        </p>
      </header>

      <section className="panel stack" aria-label="Choose a planner to test">
        <h2>1. Pick a planner to test</h2>
        <div className="seg" role="radiogroup" aria-label="Planner scenarios">
          {ALL_SCENARIOS.map((s) => (
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
                {state === 'done' && <div className="step-body">{isSkipped ? <Skipped /> : <StepBody n={s.n} scenario={scenario} r={result} />}</div>}
              </li>
            )
          })}
        </ol>
      )}
      <footer className="note">Built from the sprint's sample resident spreadsheet. Every value in it is synthetic, so no real resident, property or technician is shown.</footer>
    </main>
  )
}

function Skipped() {
  return <p className="note">Skipped: the plan could not work in real life, so it is not scored.</p>
}

function UrgencyTag({ job, marked }) {
  return (
    <span className="chips">
      <span className={`pill ${urgClass(marked)}`}>Marked {URGENCY[marked]}</span>
      {marked < job.urgency && <span className="chip bad">Less urgent than it really is</span>}
    </span>
  )
}

function Pill({ ok, yes = 'Pass', no = 'Fail' }) {
  return <span className={`pill ${ok ? 'ok' : 'crit'}`}>{ok ? yes : no}</span>
}

function Timelines({ list, compact, urgency }) {
  return (
    <div className="stack">
      {list.map(({ tech, stops }) => (
        <div key={tech.id} className="tl">
          <div className="tl-head">
            <b>{tech.name}</b> <span className="note">{tech.trade} · starts at {COMMUNITIES[tech.base].name}</span>
          </div>
          {stops.length === 0 && <p className="note">No jobs</p>}
          {stops.map((s) => (
            <div key={s.job.id} className={`stop ${s.overlap ? 'bad' : ''}`}>
              <span className="time">{fmt(s.start)}–{fmt(s.end)}</span>
              <span>
                <b>{s.job.rid}</b> · {COMMUNITIES[s.job.comm].name} · {s.job.trade}
                {urgency && <UrgencyTag job={s.job} marked={urgency[s.job.id] ?? s.job.urgency} />}
                {!compact && s.note && <span className="note"> — {s.note}</span>}
                <span className="chips">
                  {s.wasted && <span className="chip flag">Wasted trip (outside entry window)</span>}
                  {s.overlap && <span className="chip bad">Double-booked</span>}
                  {s.outsideShift && <span className="chip bad">Outside hours</span>}
                  {s.skillMismatch && <span className="chip bad">Wrong skill</span>}
                </span>
              </span>
            </div>
          ))}
        </div>
      ))}
    </div>
  )
}

function Metrics({ plan, hand }) {
  const rows = [
    ['Drive time', `${plan.driveMin} min`, `${hand.driveMin} min`, plan.driveMin <= hand.driveMin],
    ['Jobs finished', `${plan.finished} of ${plan.total}`, `${hand.finished} of ${hand.total}`, plan.finished >= hand.finished],
    ['Wasted trips', plan.wasted, hand.wasted, plan.wasted <= hand.wasted],
    ['Avg. wait for an urgent job', `${Math.round(plan.response)} min`, `${Math.round(hand.response)} min`, plan.response <= hand.response],
    ['Important notes reached the tech', `${plan.notes} of ${plan.total}`, `${hand.notes} of ${hand.total}`, plan.notes >= hand.notes],
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

function StepBody({ n, scenario, r }) {
  if (n === 1) {
    return (
      <div className="stack">
        <p className="note">
          <b>From the spreadsheet:</b> who the resident is, their community, entry window, pets, language, contact preference and
          staff note, plus each request's wording (the sheet's row IDs are shown). <b>Assumed by us:</b> urgency, skill needed, how
          long each job takes, the crew and the drive times. Source: {SHEET_NAME}
        </p>
        <div className="scroll">
          <table>
            <thead><tr><th>Request</th><th>Where</th><th>What the sheet says</th></tr></thead>
            <tbody>
              {JOBS.map((j) => (
                <tr key={j.id}>
                  <td><b>{j.rid}</b><br /><span className="note">{j.trade}<br />Row {j.iid}</span></td>
                  <td>{COMMUNITIES[j.comm].name}</td>
                  <td>{j.text}<span className="chips">{j.hidden.map((h) => <span key={h} className="chip">{h}</span>)}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="note">
          Crew: {TECHS.map((t) => `${t.name} (${t.trade})`).join(' · ')}. Shifts 8 AM–4 PM. About 20 min between Heron Lake and
          Sandpiper Pointe, 15 min between Birchwood and Fernhill.
        </p>
        <details>
          <summary>Answer key (sealed from the planner; urgency and skill are our assumptions)</summary>
          <div className="scroll">
            <table>
              <thead><tr><th>Request</th><th>True urgency</th><th>Right skill</th><th>Must tell the tech</th></tr></thead>
              <tbody>
                {JOBS.map((j) => (
                  <tr key={j.id}>
                    <td><b>{j.rid}</b></td>
                    <td><span className={`pill ${urgClass(j.urgency)}`}>{URGENCY[j.urgency]}</span></td>
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
        <Timelines list={r.planTl} urgency={scenario.urgency} />
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
        <Timelines list={r.handTl} compact />
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
