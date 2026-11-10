// All the "made-up for now" settings live here so they are easy to swap for real
// McKinley information later (technicians, travel times, vendors, severity scale).

export const SEVERITY = {
  5: { label: 'Emergency', color: 'red', sla: 'Go now', desc: 'Danger to people or major property damage: gas, fire/smoke, active flooding, sewage backup, sparking electrical, no heat in cold weather.' },
  4: { label: 'Urgent', color: 'orange', sla: 'Same day', desc: 'Home is hard to live in: no AC in Florida heat, no hot water, lockout, dead fridge, only toilet broken, slow leak.' },
  3: { label: 'Soon', color: 'amber', sla: 'Within 48 hours', desc: 'Something important is broken but the home is livable: dishwasher, stove burner, repeat problems.' },
  2: { label: 'Routine', color: 'green', sla: 'Within a week', desc: 'Normal wear: sticky door, running toilet, light fixture, small repairs.' },
  1: { label: 'Cosmetic', color: 'gray', sla: 'When convenient', desc: 'Paint touch-ups, caulking, blinds.' },
}

// The three Ann Arbor sites. Each has its own maintenance team (see TECHS below).
// Resident-to-site assignment in the sample data is made up.
// McKinley's 49 communities, compiled from mckinley.com (the list you uploaded).
// Phones are the public leasing numbers. Blank = not found on the site.
// Leasing office emails were not on the list, so they are blank until you add them on the Teams tab.
import properties from './properties.json' with { type: 'json' }

export const DEFAULT_SITES = properties.map((p) => ({
  name: p.name, market: p.market, city: `${p.city}, ${p.state}`, state: p.state, address: p.address, zip: p.zip, beds: p.beds, phone: p.phone, email: '',
}))

const BY_NAME = Object.fromEntries(DEFAULT_SITES.map((s) => [s.name, s]))

// Rough drive time in minutes (made up until we have the site maps).
// Same property = 4 (walking between buildings). Same city/market = 12.
// Same state, different market (e.g. Ann Arbor to Ypsilanti) = 25. Different state = not reachable in a day.
export function travelMinutes(a, b) {
  if (!a || !b) return 0
  if (a === b) return 4
  const A = BY_NAME[a], B = BY_NAME[b]
  if (!A || !B) return 12
  if (A.market === B.market) return 12
  return A.state === B.state ? 25 : 999
}

// Made-up technicians. Skills are what each person is strongest at.
export const TECHS = [
  { id: 'SK1', name: 'Dale', lang: 'en', phone: '734-555-0151', sites: ['Spruce Knob'], skills: ['hvac', 'plumbing', 'general'], shift: [8, 17] },
  { id: 'SK2', name: 'Tasha', lang: 'en', phone: '734-555-0152', sites: ['Spruce Knob'], skills: ['electrical', 'appliance', 'locks', 'general'], shift: [8, 17] },
  { id: 'GH1', name: 'Marcus', lang: 'en', phone: '734-555-0153', sites: ['Glencoe Hills'], skills: ['hvac', 'electrical', 'general'], shift: [8, 17] },
  { id: 'GH2', name: 'Priya', lang: 'en', phone: '734-555-0154', sites: ['Glencoe Hills'], skills: ['plumbing', 'appliance', 'locks', 'general'], shift: [8, 17] },
  { id: 'EV1', name: 'Jonah', lang: 'en', phone: '734-555-0155', sites: ['Evergreen'], skills: ['hvac', 'plumbing', 'general'], shift: [8, 17] },
  { id: 'EV2', name: 'Rosa', lang: 'es', phone: '734-555-0156', sites: ['Evergreen'], skills: ['electrical', 'appliance', 'locks', 'general'], shift: [8, 17] },
  { id: 'BC1', name: 'Carlos', lang: 'en', phone: '407-555-0157', sites: ['Bella Casa'], skills: ['hvac', 'electrical', 'general'], shift: [8, 17] },
  { id: 'BC2', name: 'Alicia', lang: 'es', phone: '407-555-0158', sites: ['Bella Casa'], skills: ['plumbing', 'appliance', 'locks', 'general'], shift: [8, 17] },
  { id: 'PO1', name: 'Terrence', lang: 'pt', phone: '407-555-0159', sites: ['Portofino'], skills: ['hvac', 'plumbing', 'general'], shift: [8, 17] },
  { id: 'PO2', name: 'Mei', lang: 'en', phone: '407-555-0160', sites: ['Portofino'], skills: ['electrical', 'appliance', 'locks', 'general'], shift: [8, 17] },
  { id: 'TP1', name: 'Andre', lang: 'ht', phone: '407-555-0161', sites: ['The Pines'], skills: ['hvac', 'electrical', 'general'], shift: [8, 17] },
  { id: 'TP2', name: 'Lena', lang: 'en', phone: '407-555-0162', sites: ['The Pines'], skills: ['plumbing', 'appliance', 'locks', 'general'], shift: [8, 17] },
]

// Minutes a typical job takes, and what to bring. Edit freely.
export const JOB_TYPES = {
  gas:        { label: 'Gas smell / leak', skill: 'plumbing', mins: 45, bring: ['Gas detector', 'Pipe wrench', 'Shut-off key'], base: 5 },
  fire:       { label: 'Smoke / fire / burning smell', skill: 'electrical', mins: 45, bring: ['Multimeter', 'Fire extinguisher'], base: 5 },
  flood:      { label: 'Flooding / burst pipe', skill: 'plumbing', mins: 90, bring: ['Wet vac', 'Pipe clamps', 'Water shut-off key'], base: 5 },
  sewage:     { label: 'Sewage backup', skill: 'plumbing', mins: 90, bring: ['Drain machine', 'PPE'], base: 5 },
  sparks:     { label: 'Sparking / dangerous electrical', skill: 'electrical', mins: 60, bring: ['Multimeter', 'Breaker tester'], base: 5 },
  noheat:     { label: 'No heat', skill: 'hvac', mins: 75, bring: ['Igniter', 'Thermostat', 'Multimeter'], base: 4 },
  noac:       { label: 'No AC / not cooling', skill: 'hvac', mins: 75, bring: ['Capacitor', 'Drain-line vac', 'Gauges'], base: 4 },
  lockout:    { label: 'Lockout / broken lock', skill: 'locks', mins: 25, bring: ['Lock-out kit', 'Spare cores'], base: 4 },
  nohotwater: { label: 'No hot water', skill: 'plumbing', mins: 60, bring: ['Heating element', 'Thermostat'], base: 4 },
  fridge:     { label: 'Refrigerator not working', skill: 'appliance', mins: 60, bring: ['Multimeter', 'Fan motor'], base: 4 },
  leak:       { label: 'Leak / dripping', skill: 'plumbing', mins: 45, bring: ['Supply lines', 'Wrench set', 'Plumber tape'], base: 3 },
  toilet:     { label: 'Toilet problem', skill: 'plumbing', mins: 40, bring: ['Flapper kit', 'Plunger', 'Closet auger'], base: 3 },
  appliance:  { label: 'Appliance issue', skill: 'appliance', mins: 50, bring: ['Multimeter', 'Common appliance parts'], base: 3 },
  pest:       { label: 'Pests', skill: 'general', mins: 30, bring: ['Inspection flashlight'], base: 3 },
  electrical: { label: 'Outlet / light / breaker', skill: 'electrical', mins: 35, bring: ['Outlets', 'Bulbs', 'Multimeter'], base: 2 },
  door:       { label: 'Door / window / cabinet', skill: 'general', mins: 30, bring: ['Drill', 'Hinges'], base: 2 },
  amenity:    { label: 'Common area / amenity', skill: 'general', mins: 30, bring: ['Drill', 'Hardware kit'], base: 2, noEntry: true },
  cosmetic:   { label: 'Cosmetic', skill: 'general', mins: 30, bring: ['Paint', 'Caulk'], base: 1 },
  other:      { label: 'Other / unclear', skill: 'general', mins: 40, bring: ['Basic tool kit'], base: 2 },
}

// ASSUMPTION (McKinley has not told us yet): jobs that probably need an outside vendor.
// Replace this list once McKinley tells us which projects they outsource.
export const VENDOR_RULES = [
  { words: /compressor|replace(ment)? (the )?(ac|unit|hvac)|condenser (is )?(dead|failed)|furnace (is )?dead/i, vendor: 'HVAC vendor', why: 'Major HVAC part or unit replacement' },
  { words: /roof|ceiling (is )?(caving|collaps)|water (stain|coming) (from|through) (the )?ceiling/i, vendor: 'Roofing vendor', why: 'Roof or ceiling water damage' },
  { words: /mold|mildew/i, vendor: 'Mold remediation vendor', why: 'Mold needs certified cleanup' },
  { words: /roach|cockroach|bed ?bug|rodent|mice|mouse|rats?|termite|ants?/i, vendor: 'Pest control vendor', why: 'Pest treatment, often building-wide' },
  { words: /sewer (main|line)|main line|backs? up in (every|all)|tree root/i, vendor: 'Plumbing vendor', why: 'Main sewer line work' },
  { words: /elevator/i, vendor: 'Elevator vendor', why: 'Licensed elevator work only' },
  { words: /carpet (clean|replace)|flooring|replace the carpet/i, vendor: 'Flooring / carpet vendor', why: 'Flooring work' },
  { words: /appliance (is )?(dead|beyond repair)|replace (the )?(dishwasher|fridge|refrigerator|stove|oven|washer|dryer)/i, vendor: 'Appliance vendor / delivery', why: 'Appliance replacement' },
]

// Repeat-repair threshold that triggers a "bring in a vendor / manager review" flag.
export const REPEAT_THRESHOLD = 3

// Entry-notice rules. ASSUMPTIONS to confirm with McKinley legal and each lease.
// Florida (Fla. Stat. 83.53): tenant may not unreasonably withhold consent; landlord may enter
//   at reasonable times with at least 12 hours' notice for repairs; emergencies need no notice.
// Michigan: no general state statute on entry notice; the lease and "reasonable notice" govern.
//   Courts and most leases expect about 24 hours. We use 24 hours to be safe.
export const ENTRY_RULES = {
  Florida: { hours: 12, source: 'Florida law (Fla. Stat. 83.53): 12 hours notice, reasonable times' },
  Michigan: { hours: 24, source: 'Michigan has no set statute, so we use 24 hours notice and the lease terms' },
}
