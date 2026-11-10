import { useState } from 'react'
import { exportCase, parseCase, sampleDay } from './casefile.js'
import { livePlan } from './planner.js'
import { fmt } from './evaluate.js'

function download(name, obj) {
  const url = URL.createObjectURL(new Blob([JSON.stringify(obj, null, 2)], { type: 'application/json' }))
  const a = document.createElement('a')
  a.href = url
  a.download = name
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export default function Day({ day, setDay }) {
  const { ctx } = day
  const [text, setText] = useState('')
  const [error, setError] = useState('')
  const [open, setOpen] = useState(false)

  function load(t) {
    const r = parseCase(t)
    if (r.error) return setError(r.error)
    setError('')
    setText('')
    setDay({ ctx: r.ctx, loaded: r.loaded })
    setOpen(false)
  }

  async function onFile(e) {
    const f = e.target.files?.[0]
    e.target.value = ''
    if (!f) return
    try {
      load(await f.text())
    } catch {
      setError('I could not read that file.')
    }
  }

  const safeName = (ctx.title || 'day').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'day'
  return (
    <details className="panel" open={open} onToggle={(e) => setOpen(e.currentTarget.open)}>
      <summary>
        Test day: {ctx.title} <span className="note">· {ctx.jobs.length} requests{ctx.held.length ? ` (+${ctx.held.length} on hold)` : ''} · {ctx.crew.length} crew · {fmt(ctx.shift[0])}–{fmt(ctx.shift[1])}{day.loaded ? ' · includes a plan' : ''} (change)</span>
      </summary>
      <div className="stack">
        {ctx.source && <p className="note">Source: {ctx.source}</p>}
        {ctx.warnings.length > 0 && (
          <div className="banner fail" role="alert">
            {ctx.warnings.map((w) => (
              <div key={w}>{w}</div>
            ))}
          </div>
        )}
        <p className="note">
          A <b>case file</b> holds one day: the requests, the crew, drive times and, if you like, the plan a planner made. Any planner can write one. Load one
          to grade that planner’s plan against a by-hand plan for the same day. Nothing leaves your device.
        </p>
        <div className="actions">
          <label className="filebtn">
            Load a case file
            <input type="file" accept=".json,application/json" onChange={onFile} />
          </label>
          <button onClick={() => download(`${safeName}.json`, exportCase(ctx))}>Download this day</button>
          <button onClick={() => download(`${safeName}-with-plan.json`, exportCase(ctx, { planner: 'Rule-based planner (example)', plan: livePlan(ctx), urgency: {} }))}>
            Download example with a plan
          </button>
          {!ctx.isSample && <button onClick={() => setDay({ ctx: sampleDay(), loaded: null })}>Back to the sample day</button>}
        </div>
        <label className="stack">
          <span className="note">Or paste a case file</span>
          <textarea value={text} onChange={(e) => setText(e.target.value)} placeholder='{"format": "plan-case/v1", ...}' aria-label="Paste a case file" />
        </label>
        {error && <p className="banner fail" role="alert">{error}</p>}
        <div className="actions">
          <button className="primary" disabled={!text.trim()} onClick={() => load(text)}>Use this case file</button>
        </div>
      </div>
    </details>
  )
}
