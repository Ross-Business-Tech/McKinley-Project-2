// Prototype AI (simulated).
// Everything the "AI agent" does goes through askAI(). Today it uses the sample data,
// simple rules and text templates. Later, the body of askAI could be swapped for a call
// to a real model (through a here.now proxy route) without changing the rest of the app.

import { FAILURE_TYPES } from './data.js'

export const AI_LABEL = 'Prototype AI (simulated)'

const HOURS_PER_SHIFT = 8

// Which failure each sensor signal points to.
const SIGNAL_TO_FAILURE = {
  tipTemp: 'tip_wear',
  welds: 'tip_wear',
  servoTemp: 'servo_overheat',
  vibration: 'servo_overheat',
  current: 'cable_wear',
  feedCurrent: 'wire_feed',
  shortStops: 'wire_feed',
}

export function formatHours(h) {
  if (!Number.isFinite(h)) return 'no failure expected soon'
  if (h < 1) return 'under 1 hour'
  if (h < 24) return `about ${Math.round(h)} hours`
  const d = Math.round(h / 24)
  return `about ${d} ${d === 1 ? 'day' : 'days'}`
}

// How fast each signal is moving toward its limit, in hours.
function readSignal(signal) {
  const h = signal.history
  const latest = h[h.length - 1]
  const perShift = (latest - h[0]) / (h.length - 1)
  const hoursToLimit = perShift > 0 ? ((signal.limit - latest) / perShift) * HOURS_PER_SHIFT : Infinity
  return {
    ...signal,
    latest,
    perShift,
    rising: perShift > 0,
    pctOfLimit: Math.round((latest / signal.limit) * 100),
    hoursToLimit: Math.max(0, hoursToLimit),
  }
}

function assess(robot) {
  const readings = robot.signals.map(readSignal)
  const ranked = [...readings].sort((a, b) => a.hoursToLimit - b.hoursToLimit)
  const lead = ranked[0]
  const hours = lead.hoursToLimit
  const risk = hours <= 12 ? 'high' : hours <= 48 ? 'medium' : 'low'
  const failureKey = SIGNAL_TO_FAILURE[lead.key]
  const failure = FAILURE_TYPES[failureKey]

  // Signals that agree with the lead signal make the AI more confident.
  const agreeing = readings.filter(
    (r) => r.rising && r.hoursToLimit <= 72 && SIGNAL_TO_FAILURE[r.key] === failureKey,
  )

  const reasons = readings
    .filter((r) => r.rising && r.hoursToLimit <= 72)
    .map(
      (r) =>
        `${r.label} went ${r.history.join(' → ')}${r.unit ? ' ' + r.unit : ''} over 3 shifts ` +
        `(now ${r.pctOfLimit}% of its limit).`,
    )

  if (risk === 'low') {
    return {
      robotId: robot.id,
      risk,
      hoursToFailure: hours,
      failureKey: null,
      failureName: 'None expected',
      summary: `${robot.id} looks healthy. No signal is heading toward its limit in the next 2 days.`,
      reasons: reasons.length ? reasons : ['All readings are steady and well under their limits.'],
      recommendation: 'No action needed. Keep the normal inspection schedule.',
      confidence: 'High',
      readings,
    }
  }

  const window = formatHours(hours)
  return {
    robotId: robot.id,
    risk,
    hoursToFailure: hours,
    failureKey,
    failureName: failure.name,
    summary: `${robot.id} is likely to stop from ${failure.name.toLowerCase()} in ${window}.`,
    reasons,
    whyItHappens: failure.cause,
    recommendation:
      risk === 'high'
        ? `Fix it at the next planned break, before it fails. A planned fix takes about ${failure.plannedHours} hr, ` +
          `while a surprise breakdown usually costs ${failure.unplannedHours} hrs.`
        : `Schedule a fix within the next ${window}. A planned fix takes about ${failure.plannedHours} hr ` +
          `instead of ${failure.unplannedHours} hrs if it breaks on its own.`,
    confidence: agreeing.length >= 2 ? 'High' : 'Medium',
    readings,
  }
}

/**
 * The one entry point for the AI agent.
 * input: { task: 'assess', robot }
 * Returns a Promise, just like a real model call would.
 */
export async function askAI(input) {
  await new Promise((resolve) => setTimeout(resolve, 500 + Math.random() * 400))

  if (!input || !input.task) {
    return { error: 'The agent did not get a request. Please try again.' }
  }
  if (input.task === 'assess') {
    if (!input.robot || !Array.isArray(input.robot.signals) || input.robot.signals.length === 0) {
      return { error: 'No sensor readings were found for this robot, so the agent cannot assess it yet.' }
    }
    return assess(input.robot)
  }
  return { error: `The agent does not know how to do "${input.task}" yet.` }
}
