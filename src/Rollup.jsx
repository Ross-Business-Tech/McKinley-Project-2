import { useMemo } from 'react'
import { runEvaluation, verdictFor } from './evaluate.js'
import { Pill } from './parts.jsx'

const r1 = (x) => Math.round(x * 10) / 10

// Grades several case files (for example one per supervisor) and shows them side by side with an overall score.
export default function Rollup({ items, onOpen }) {
  const graded = useMemo(
    () =>
      items.map((it) => {
        if (it.error) return { ...it, kind: 'error' }
        if (!it.loaded) return { ...it, kind: 'noplan' }
        return { ...it, kind: 'ok', r: runEvaluation(it.ctx, { plan: it.loaded.plan, urgency: it.loaded.urgency }) }
      }),
    [items],
  )
  const ok = graded.filter((g) => g.kind === 'ok')
  const skipped = graded.filter((g) => g.kind !== 'ok')
  const weight = (g) => g.ctx.jobs.length
  const total = ok.reduce((n, g) => n + weight(g), 0)
  const avg = (f) => (total ? ok.reduce((n, g) => n + weight(g) * f(g), 0) / total : 0)
  // A plan that could not work in real life counts as 0 in the overall score, so it cannot hide behind the others.
  const overall = r1(avg((g) => g.r.final ?? 0))
  const handAll = r1(avg((g) => g.r.handPts.total))
  const failing = ok.filter((g) => !g.r.pass)
  const gap = r1(overall - handAll)
  // The same request can appear in several files (for example an unknown unit), so count each urgent one once.
  const urgent = new Map()
  ok.forEach((g) => g.ctx.held.forEach((h) => h.urgency === 3 && urgent.set(h.id, h)))
  const jobsCount = ok.reduce((n, g) => n + g.ctx.jobs.length, 0)

  return (
    <section className="stack" aria-label="All case files">
      <h2>All files together</h2>
      {ok.length > 0 && (
        <>
          <div className={`scorebox ${failing.length ? 'fail' : 'pass'}`} role="status">
            <div className="score-main">
              <span className="score-num">{overall}</span>
              <span className="score-of">/ 100</span>
            </div>
            <div>
              <b>{failing.length ? `${failing.length} of ${ok.length} files fail a must-pass check` : verdictFor(overall)}</b>
              <p>
                Overall across {ok.length} {ok.length === 1 ? 'file' : 'files'} and {jobsCount} scheduled jobs, weighted by how many jobs each file has. By hand: {handAll} / 100 ·{' '}
                {gap === 0 ? 'the same as by hand' : `${gap > 0 ? '+' : '−'}${Math.abs(gap)} ${gap > 0 ? 'better' : 'worse'} than by hand`}
              </p>
            </div>
          </div>
          <section className="strip" aria-label="Summary">
            <div className="stat"><b>{ok.length - failing.length} of {ok.length}</b><span>Files that pass every check and gate</span></div>
            <div className="stat"><b>{jobsCount}</b><span>Jobs scheduled across all files</span></div>
            <div className="stat"><b>{urgent.size}</b><span>Urgent requests on hold, needing a person now</span></div>
          </section>
          <div className="scroll">
            <table>
              <thead>
                <tr><th>File</th><th>Jobs</th><th>On hold</th><th>Score</th><th>By hand</th></tr>
              </thead>
              <tbody>
                {ok.map((g, i) => {
                  const d = g.r.final === null ? null : r1(g.r.final - g.r.handPts.total)
                  const urg = g.ctx.held.filter((h) => h.urgency === 3).length
                  return (
                    <tr key={`${g.name}-${i}`}>
                      <td>
                        <b>{g.ctx.title}</b>
                        <br />
                        <span className="note">{g.name}</span>
                        <br />
                        <button onClick={() => onOpen(g)}>Open the full grading</button>
                      </td>
                      <td>{g.ctx.jobs.length}</td>
                      <td>
                        {g.ctx.held.length}
                        {urg > 0 && <><br /><span className="chip bad">{urg} urgent</span></>}
                      </td>
                      <td>
                        {g.r.final === null ? <span className="pill crit">Not scored</span> : <b>{g.r.final}</b>}
                        <br />
                        <Pill ok={g.r.pass} yes="Pass" no="Fail" />
                      </td>
                      <td>
                        {g.r.handPts.total}
                        {d !== null && <><br /><span className={`note ${d > 0 ? 'have' : d < 0 ? 'miss' : ''}`}>{d === 0 ? 'same' : `${d > 0 ? '+' : '−'}${Math.abs(d)}`}</span></>}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          {urgent.size > 0 && (
            <div className="stack">
              <b>Urgent requests on hold ({urgent.size})</b>
              {[...urgent.values()].map((h) => (
                <div key={h.id} className="row">
                  <span>{h.id} · {h.rid}{h.text ? `: “${h.text.slice(0, 70)}${h.text.length > 70 ? '…' : ''}”` : ''}<span className="note"><br />{h.reason}</span></span>
                  <span className="pill crit">Urgent: needs a person now</span>
                </div>
              ))}
            </div>
          )}
        </>
      )}
      {skipped.length > 0 && (
        <div className="stack">
          <b>Not included ({skipped.length})</b>
          {skipped.map((g, i) => (
            <p key={`${g.name}-${i}`} className="banner fail" role="alert">
              {g.name}: {g.kind === 'error' ? g.error : 'this file has no plan in it (it describes a day only), so there is nothing to grade.'}
            </p>
          ))}
        </div>
      )}
      <p className="note">Each file is graded on its own, exactly as when loaded alone. The overall score weights each file by its number of scheduled jobs. Open a row to see its full step-by-step grading.</p>
    </section>
  )
}
