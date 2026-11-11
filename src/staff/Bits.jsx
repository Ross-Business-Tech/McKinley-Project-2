
export function SyncChip({ mode, email }) {
  const txt = mode === 'online' ? '● Live: shared with your team' : mode === 'local' ? '● Saved on this device only' : '● Connecting…'
  return (
    <span className={`chip sync ${mode}`} title={mode === 'local' ? 'Test links and previews can’t share data. On the team’s site, changes reach everyone.' : ''}>
      {txt}{email ? ` · ${email}` : ''}
    </span>
  )
}

// Technicians' days off this week, with a suggested cover for each.
export function TimeOffPanel({ team, allTeams, day, timeoff, setTimeoff }) {
  const off = team.filter((t) => t.daysOff?.length)
  if (!off.length) return null
  const coverFor = (t, d) =>
    allTeams
      .filter((x) => x.id !== t.id && !x.daysOff?.includes(d) && !x.workDays.includes(d) && x.sites.some((s) => t.sites.includes(s)))
      .map((x) => ({ x, score: x.skills.filter((k) => t.skills.includes(k)).length }))
      .sort((a, b) => b.score - a.score)[0]?.x ||
    allTeams.find((x) => x.id !== t.id && !x.daysOff?.includes(d) && x.sites.some((s) => t.sites.includes(s)))
  return (
    <section className="card timeoff">
      <h2>Days off</h2>
      {off.flatMap((t) =>
        t.daysOff.map((d) => {
          const c = t.usualWorkDays.includes(d) ? coverFor(t, d) : null
          return (
            <div key={`${t.id}${d}`} className={`row ${d === day ? 'today' : ''}`}>
              <span className="small"><b>{t.name}</b> off {d}</span>
              {c ? (
                c.phone ? <a className="btn mini" href={`sms:${c.phone}?&body=${encodeURIComponent(`Hi ${c.name}, could you cover ${t.name}'s shift on ${d} (${t.sites.join(', ')})?`)}`}>Ask {c.name} to cover</a>
                  : <span className="small">Cover: {c.name}</span>
              ) : t.usualWorkDays.includes(d) ? <span className="small warn">No one free to cover</span> : <span className="small">(not a usual work day)</span>}
              <button className="link" onClick={() => setTimeoff({ ...timeoff, [`${t.id}|${d}`]: undefined })}>Undo</button>
            </div>
          )
        }),
      )}
    </section>
  )
}

export function SitePicker({ value, onChange, sites, countFor, extra = [], suffix = 'requests' }) {
  const markets = [...new Set(sites.map((s) => s.market || s.city))]
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)}>
      {extra.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
      {markets.map((m) => (
        <optgroup key={m} label={m}>
          {sites.filter((s) => (s.market || s.city) === m).map((s) => <option key={s.name} value={s.name}>{s.name} ({countFor(s.name)} {suffix})</option>)}
        </optgroup>
      ))}
    </select>
  )
}
