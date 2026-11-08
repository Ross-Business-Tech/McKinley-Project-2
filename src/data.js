// All data is synthetic (made up). Residents echo the sprint's sample spreadsheet IDs only.
export const SHIFT_START = 480 // 8:00 AM, in minutes after midnight
export const SHIFT_END = 960 // 4:00 PM

import sheet from './sample-residents.json'

// Residents and requests come from the sprint's sample spreadsheet (synthetic). Each community code
// stands for the community name used in the sheet.
export const COMMUNITIES = {
  HL: { name: 'Heron Lake Apartments', region: 'Orlando' },
  SP: { name: 'Sandpiper Pointe', region: 'Orlando' },
  BW: { name: 'Birchwood Commons', region: 'Michigan' },
  FH: { name: 'Fernhill Apartments', region: 'Michigan' },
}
const CODE_BY_NAME = Object.fromEntries(Object.entries(COMMUNITIES).map(([k, v]) => [v.name, k]))

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

// The sheet's entry-window words, turned into minutes after midnight (our reading of each phrase).
const WINDOWS = {
  'any time': [480, 960],
  weekdays: [480, 960],
  'mornings (8-11 AM)': [480, 660],
  'weekdays 9 AM - 3 PM': [540, 900],
  'after 11 AM': [660, 960],
  'afternoons (1-5 PM)': [780, 960],
  afternoons: [720, 960],
  'late mornings': [660, 780],
  evenings: [480, 960], // outside shift hours; only used for R018's lockout, which cannot wait
}

const residentById = Object.fromEntries(sheet.residents.map((r) => [r.resident_id, r]))
const interactionById = Object.fromEntries(sheet.interactions.map((i) => [i.interaction_id, i]))

// ASSUMED (not in the sheet): urgency answer key, skill, how long the job takes, and which phrase must reach the tech.
const SPECS = [
  { id: 'W1', rid: 'R008', iid: 'I046', skill: 'plumbing', trade: 'Plumbing', urgency: 3, dur: 60, key: 'callback' },
  { id: 'W2', rid: 'R001', iid: 'I008', skill: 'hvac', trade: 'HVAC', urgency: 2, dur: 45, key: 'crate' },
  { id: 'W3', rid: 'R015', iid: 'I079', skill: 'pest', trade: 'Pest', urgency: 1, dur: 40, key: 'neighboring' },
  { id: 'W4', rid: 'R010', iid: 'I055', skill: 'general', trade: 'General', urgency: 1, dur: 30, key: 'front door' },
  { id: 'W5', rid: 'R003', iid: 'I013', skill: 'general', trade: 'General', urgency: 2, dur: 20, key: 'text first' },
  { id: 'W6', rid: 'R012', iid: 'I066', skill: 'general', trade: 'General', urgency: 1, dur: 30, key: 'spanish' },
  { id: 'W7', rid: 'R018', iid: 'I091', skill: 'general', trade: 'General', urgency: 3, dur: 15, key: 'lockout' },
  { id: 'W8', rid: 'R004', iid: 'I022', skill: 'hvac', trade: 'HVAC', urgency: 3, dur: 60, key: 'waffles' },
  { id: 'W9', rid: 'R016', iid: 'I084', skill: 'general', trade: 'General', urgency: 1, dur: 30, key: 'nov 30' },
  { id: 'W10', rid: 'R013', iid: 'I068', skill: 'general', trade: 'General', urgency: 1, dur: 30, key: 'late mornings' },
  { id: 'W11', rid: 'R017', iid: 'I088', skill: 'general', trade: 'General', urgency: 1, dur: 40, key: 'dishwasher replaced' },
]

function build(spec) {
  const res = residentById[spec.rid]
  const ix = interactionById[spec.iid]
  const text = ix.full_text.split(/\s(?:Office:|Tech note)/)[0].replace(/^Resident:\s*/, '')
  const entry = res.preferred_entry_window
  const pets = res.pets !== 'none' ? `Pets: ${res.pets}. ` : ''
  const lang = res.preferred_language !== 'English' ? `Language: ${res.preferred_language}. ` : ''
  return {
    ...spec,
    comm: CODE_BY_NAME[res.community],
    win: WINDOWS[entry] || WINDOWS['any time'],
    text,
    subject: ix.subject,
    entry,
    hidden: [
      res.notes_for_staff.replace(/\.$/, ''),
      `Entry: ${entry}`,
      ...(res.pets !== 'none' ? [`Pet: ${res.pets}`] : []),
      ...(lang ? [`Language: ${res.preferred_language}`] : []),
      `Prefers ${res.preferred_contact}`,
    ],
    note: `${res.notes_for_staff} ${pets}${lang}Entry: ${entry}. Prefers ${res.preferred_contact}.`,
  }
}

export const JOBS = SPECS.map(build)
export const SHEET_NAME = sheet.source

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
