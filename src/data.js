// All data is synthetic (made up). Residents echo the sprint's sample spreadsheet IDs only.
export const SHIFT_START = 480 // 8:00 AM, in minutes after midnight
export const SHIFT_END = 960 // 4:00 PM

export const COMMUNITIES = {
  HL: { name: 'Heron Lake', region: 'Orlando' },
  SP: { name: 'Sandpiper Pointe', region: 'Orlando' },
  BW: { name: 'Birchwood Commons', region: 'Michigan' },
  FH: { name: 'Fernhill', region: 'Michigan' },
}

// Rough drive minutes between communities. Same community = 5 (parking and walking).
export function travel(a, b) {
  if (a === b) return 5
  const pair = [a, b].sort().join('')
  if (pair === 'HLSP') return 20
  if (pair === 'BWFH') return 15
  return Infinity // different regions: nobody drives between Orlando and Michigan
}

export const TECHS = [
  { id: 'A', name: 'Tech A', trade: 'Plumbing + general', skills: ['plumbing', 'general'], base: 'HL', rate: 38 },
  { id: 'B', name: 'Tech B', trade: 'HVAC + general', skills: ['hvac', 'general'], base: 'SP', rate: 38 },
  { id: 'C', name: 'Tech C', trade: 'All trades, Michigan', skills: ['plumbing', 'hvac', 'general'], base: 'BW', rate: 38 },
  { id: 'V', name: 'Pest vendor', trade: 'Pest control', skills: ['pest'], base: 'HL', vendor: true, flat: 85 },
]

export const URGENCY = { 3: 'Urgent', 2: 'Soon', 1: 'Routine' }

// win = resident's entry window [start, end] in minutes. key = the word that must reach the technician.
export const JOBS = [
  { id: 'W1', rid: 'R008', comm: 'HL', skill: 'plumbing', trade: 'Plumbing', urgency: 3, dur: 60, win: [540, 900],
    text: 'Kitchen sink leaking under the cabinet AGAIN. 4th time.',
    hidden: ['Home weekdays 9–3 only', 'Missed callback in May'],
    key: 'camera', note: 'Plumbing vendor to camera the drain line; resident home weekdays 9–3' },
  { id: 'W2', rid: 'R001', comm: 'HL', skill: 'hvac', trade: 'HVAC', urgency: 2, dur: 45, win: [480, 660],
    text: 'AC makes a loud rattling noise when it kicks on. Mornings please.',
    hidden: ['Dog must be crated', 'Replacement pending'],
    key: 'crate', note: 'Crate Biscuit (dog) before entry; replacement pending, do not promise a date' },
  { id: 'W3', rid: 'R015', comm: 'HL', skill: 'pest', trade: 'Pest', urgency: 1, dur: 40, win: [480, 960],
    text: 'A few roaches again in the kitchen. Please treat the neighbors too.',
    hidden: ['Treat neighboring units'],
    key: 'neighbor', note: 'Treat neighboring units at the same visit' },
  { id: 'W4', rid: 'R010', comm: 'SP', skill: 'general', trade: 'General', urgency: 1, dur: 30, win: [480, 960],
    text: 'Bathroom faucet dripping. Same cat rules as always.',
    hidden: ['Cat bolts for the door'],
    key: 'cat', note: 'Keep the front door shut; cat Pepper bolts' },
  { id: 'W5', rid: 'R003', comm: 'SP', skill: 'general', trade: 'General', urgency: 2, dur: 20, win: [660, 960],
    text: 'Smoke detector chirping. After 11 AM please, text first.',
    hidden: ['Works nights, sleeps days', 'Text, never call before 10'],
    key: 'text', note: 'Arrive after 11 AM; text first, no calls before 10' },
  { id: 'W6', rid: 'R012', comm: 'HL', skill: 'general', trade: 'General', urgency: 1, dur: 30, win: [780, 960],
    text: 'La puerta del balcón no cierra bien.',
    hidden: ['Spanish speaker', 'Afternoons only'],
    key: 'spanish', note: 'Resident prefers Spanish, by text' },
  { id: 'W7', rid: 'R018', comm: 'SP', skill: 'general', trade: 'General', urgency: 3, dur: 15, win: [480, 960],
    text: 'I am locked out of my apartment.',
    hidden: ['Lockout fee applies'],
    key: 'id', note: 'Check ID before letting in; lockout fee applies' },
  { id: 'W8', rid: 'R004', comm: 'FH', skill: 'hvac', trade: 'HVAC', urgency: 3, dur: 60, win: [480, 960],
    text: 'Heat not coming on. Thermostat set to 70, apartment is 61.',
    hidden: ['Friendly dog at home'],
    key: 'dog', note: 'Dog (Waffles) is friendly; OK to enter' },
  { id: 'W9', rid: 'R016', comm: 'BW', skill: 'general', trade: 'General', urgency: 1, dur: 30, win: [720, 960],
    text: 'Cracked outlet cover and a wall patch before I move out.',
    hidden: ['Moving out Nov 30', 'Prefers email'],
    key: 'email', note: 'Contact by email; moving out Nov 30' },
  { id: 'W10', rid: 'R013', comm: 'FH', skill: 'plumbing', trade: 'Plumbing', urgency: 1, dur: 30, win: [660, 780],
    text: 'Kitchen drain is slow and smells.',
    hidden: ['Late mornings only (11–1)'],
    key: 'late', note: 'Late mornings only (11–1)' },
  { id: 'W11', rid: 'R017', comm: 'FH', skill: 'general', trade: 'General', urgency: 1, dur: 40, win: [480, 960],
    text: 'Dishwasher is not draining.',
    hidden: ['Dishwasher replaced in May'],
    key: 'warranty', note: 'Dishwasher was replaced in May; check warranty first' },
]

const full = (ids) => ids.map((id) => ({ id, note: JOBS.find((j) => j.id === id).note }))
const withAt = (list) => list.map(([id, at]) => ({ id, at, note: JOBS.find((j) => j.id === id).note }))

export const SCENARIOS = [
  {
    id: 'good',
    label: 'Good plan',
    blurb: 'Groups jobs by community and respects every entry window.',
    selfReport: 'Self-reported score: 96 / 100',
    urgency: {},
    plan: {
      A: full(['W1', 'W6']),
      B: full(['W7', 'W2', 'W4', 'W5']),
      C: full(['W8', 'W11', 'W10', 'W9']),
      V: full(['W3']),
    },
  },
  {
    id: 'downgrade',
    label: 'Downgrades an emergency',
    blurb: 'Treats the repeat sink leak as routine and does it last.',
    selfReport: 'Self-reported score: 94 / 100',
    urgency: { W1: 1 },
    plan: {
      A: full(['W6', 'W1']),
      B: full(['W7', 'W2', 'W4', 'W5']),
      C: full(['W8', 'W11', 'W10', 'W9']),
      V: full(['W3']),
    },
  },
  {
    id: 'impossible',
    label: 'Impossible plan',
    blurb: 'Double-books Tech A and forgets a request.',
    selfReport: 'Self-reported score: 99 / 100',
    urgency: {},
    plan: {
      A: withAt([['W1', 540], ['W6', 570]]),
      B: full(['W7', 'W2', 'W4', 'W5']),
      C: full(['W8', 'W10', 'W9']),
      V: full(['W3']),
    },
  },
  {
    id: 'windows',
    label: 'Ignores resident times',
    blurb: 'Shows up before or after entry windows, wasting trips.',
    selfReport: 'Self-reported score: 91 / 100',
    urgency: {},
    plan: {
      A: withAt([['W1', 490], ['W6', 660]]),
      B: withAt([['W7', 485], ['W5', 520], ['W4', 560], ['W2', 800]]),
      C: withAt([['W8', 495], ['W11', 560], ['W10', 610], ['W9', 650]]),
      V: full(['W3']),
    },
  },
]
