import { TECHS, DEFAULT_SUPERVISORS } from '../triage/config.js'

const TECH_PINS = Object.fromEntries(TECHS.map((t) => [t.id, t.pin]))
const SUP_PINS = Object.fromEntries(DEFAULT_SUPERVISORS.map((x) => [x.id, x.pin]))
// A person's PIN: the one set on the Teams tab, else the sample default.
export function pinOf(x) {
  return x?.pin || TECH_PINS[x?.id] || SUP_PINS[x?.id] || null
}

