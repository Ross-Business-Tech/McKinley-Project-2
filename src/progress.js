// Job progress, set by the technician and seen by supervisors and residents.
// Steps: received → approved → scheduled → on the way → started (or waiting on parts) → done.
export const PROGRESS_STEPS = ['onway', 'started', 'parts']

export function statusOf(id, { approved, techDone, progress, scheduled }) {
  if (techDone[id]) return { key: 'done', at: techDone[id].at }
  const p = progress[id] || {}
  let best = null
  for (const k of PROGRESS_STEPS) if (p[k] && (!best || p[k] > p[best])) best = k
  if (best) return { key: best, at: p[best], by: p.by }
  if (approved[id]) return { key: scheduled ? 'scheduled' : 'approved' }
  return { key: 'received' }
}

export const STATUS_LABEL = {
  received: 'Waiting for approval',
  approved: 'Approved',
  scheduled: 'Scheduled',
  onway: 'Tech on the way',
  started: 'Work started',
  parts: 'Waiting on parts',
  done: 'Done',
}

export const timeOf = (iso) => {
  if (!iso) return ''
  try {
    return new Date(iso).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
  } catch {
    return ''
  }
}
