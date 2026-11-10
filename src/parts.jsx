import { URGENCY } from './urg.js'
import { fmt } from './evaluate.js'

import { urgClass } from './urg.js'

export function UrgencyTag({ job, marked }) {
  return (
    <span className="chips">
      <span className={`pill ${urgClass(marked)}`}>Marked {URGENCY[marked]}</span>
      {marked < job.urgency && <span className="chip bad">Less urgent than it really is</span>}
    </span>
  )
}

export function Pill({ ok, yes = 'Pass', no = 'Fail' }) {
  return <span className={`pill ${ok ? 'ok' : 'crit'}`}>{ok ? yes : no}</span>
}

export function Timelines({ list, compact, urgency, comms }) {
  return (
    <div className="stack">
      {list.map(({ tech, stops }) => (
        <div key={tech.id} className="tl">
          <div className="tl-head">
            <b>{tech.name}</b> <span className="note">{tech.trade} · starts at {comms[tech.base].name}</span>
          </div>
          {stops.length === 0 && <p className="note">No jobs</p>}
          {stops.map((s) => (
            <div key={s.job.id} className={`stop ${s.overlap ? 'bad' : ''}`}>
              <span className="time">{fmt(s.start)}–{fmt(s.end)}</span>
              <span>
                <b>{s.job.rid}</b> · {comms[s.job.comm].name} · {s.job.trade}
                {urgency && s.job.urgency !== null && <UrgencyTag job={s.job} marked={urgency[s.job.id] ?? s.job.urgency} />}
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
