// All data here is invented sample data for the Ironvale prototype.
// No real machines, people or plants.

export const COST_PER_HOUR = 12000 // client figure: $12K per hour of line downtime

// The kinds of welding-robot failures we track, what warns us, and what a fix needs.
export const FAILURE_TYPES = {
  tip_wear: {
    steps: ["Jog robot to the tip-change position with the teach pendant", "Pull both electrode tips and fit new ones", "Run the tip dresser once and check the first weld"],
    name: 'Electrode tip wear',
    warning: 'Tip temperature climbs and weld count nears the tip-change limit',
    cause: 'Worn tips draw more heat, then welds start failing quality checks',
    plannedHours: 0.5,
    unplannedHours: 3,
    parts: ['Electrode tips (pair)', 'Tip dresser blade'],
    tools: ['Tip puller', 'Torque wrench'],
    safety: false,
    safetyNote: 'Done from outside the cell with the teach pendant. No lockout needed.',
  },
  servo_overheat: {
    safetyChecks: ["Lockout points for the robot and cell power are identified", "Hoist sling is inspected and rated for the servo motor's weight", "A second person stays at the cell gate while the arm is slung"],
    steps: ["Lock out and tag the robot cell", "Sling the arm and swap the Axis 3 servo motor", "Regrease the gearbox and check alignment", "Remove lockout, run a slow test cycle"],
    name: 'Joint servo overheating',
    warning: 'Servo temperature and vibration rising together over several shifts',
    cause: 'Dry gearbox or failing bearing makes the motor work harder',
    plannedHours: 2,
    unplannedHours: 8,
    parts: ['Axis 3 servo motor', 'Gearbox grease cartridge'],
    tools: ['Hoist sling', 'Torque wrench', 'Alignment gauge'],
    safety: true,
    safetyNote: 'Requires lockout/tagout and entering the robot cell.',
  },
  cable_wear: {
    safetyChecks: ["Lockout points for the robot and weld power are identified", "Weld power is tested and shown to be at zero before cables are touched", "Cell gate key goes with the technician who holds the lock"],
    steps: ["Lock out and tag the robot cell", "Replace the dress-pack cable set along the arm", "Check weld current with the multimeter", "Remove lockout, run a test weld"],
    name: 'Dress-pack cable wear',
    warning: 'Weld current draw is erratic and higher than normal',
    cause: 'Cables twist with every move and the copper strands break over time',
    plannedHours: 1.5,
    unplannedHours: 5,
    parts: ['Dress-pack cable set', 'Cable ties and clamps'],
    tools: ['Crimping tool', 'Multimeter'],
    safety: true,
    safetyNote: 'Requires lockout/tagout. High-current cables.',
  },
  wire_feed: {
    steps: ["Cut and replace the wire liner", "Clean and swap the drive rolls", "Feed wire and run 5 test welds"],
    name: 'Wire-feed jam',
    warning: 'Feed motor current spikes and short stops are increasing',
    cause: 'Worn liner or dirty drive rolls make the wire slip and bunch',
    plannedHours: 0.75,
    unplannedHours: 2.5,
    parts: ['Wire liner', 'Drive roll set'],
    tools: ['Liner cutter', 'Compressed air gun'],
    safety: false,
    safetyNote: 'Wire feeder sits outside the guarded area. No lockout needed.',
  },
}

// Six welding robots across two lines. Each signal has its last 3 shift readings (oldest first)
// and the limit where trouble starts.
export const ROBOTS = [
  {
    id: 'W-101',
    line: 'Line A',
    job: 'Door panel spot welds',
    signals: [
      { key: 'tipTemp', label: 'Tip temperature', unit: '°C', limit: 95, history: [78, 85, 92] },
      { key: 'welds', label: 'Welds since tip change', unit: '', limit: 3000, history: [2310, 2580, 2840] },
      { key: 'vibration', label: 'Vibration', unit: 'mm/s', limit: 5, history: [2.0, 2.1, 2.1] },
    ],
  },
  {
    id: 'W-102',
    line: 'Line A',
    job: 'Roof rail seam welds',
    signals: [
      { key: 'servoTemp', label: 'Axis 3 servo temp', unit: '°C', limit: 75, history: [58, 64, 71] },
      { key: 'vibration', label: 'Vibration', unit: 'mm/s', limit: 5, history: [3.1, 3.9, 4.6] },
      { key: 'current', label: 'Weld current draw', unit: '% of normal', limit: 115, history: [101, 102, 101] },
    ],
  },
  {
    id: 'W-103',
    line: 'Line A',
    job: 'Hinge bracket welds',
    signals: [
      { key: 'tipTemp', label: 'Tip temperature', unit: '°C', limit: 95, history: [66, 68, 67] },
      { key: 'welds', label: 'Welds since tip change', unit: '', limit: 3000, history: [420, 690, 960] },
      { key: 'vibration', label: 'Vibration', unit: 'mm/s', limit: 5, history: [1.8, 1.9, 1.8] },
    ],
  },
  {
    id: 'W-104',
    line: 'Line B',
    job: 'Floor pan welds',
    signals: [
      { key: 'current', label: 'Weld current draw', unit: '% of normal', limit: 115, history: [103, 106, 108] },
      { key: 'vibration', label: 'Vibration', unit: 'mm/s', limit: 5, history: [2.6, 2.9, 3.2] },
      { key: 'servoTemp', label: 'Axis 3 servo temp', unit: '°C', limit: 75, history: [55, 56, 57] },
    ],
  },
  {
    id: 'W-105',
    line: 'Line B',
    job: 'Bumper beam MIG welds',
    signals: [
      { key: 'feedCurrent', label: 'Wire-feed motor current', unit: '% of normal', limit: 120, history: [100, 104, 108] },
      { key: 'shortStops', label: 'Short stops this shift', unit: '', limit: 6, history: [1, 2, 3] },
      { key: 'vibration', label: 'Vibration', unit: 'mm/s', limit: 5, history: [2.2, 2.3, 2.2] },
    ],
  },
  {
    id: 'W-106',
    line: 'Line B',
    job: 'Cross-member MIG welds',
    signals: [
      { key: 'feedCurrent', label: 'Wire-feed motor current', unit: '% of normal', limit: 120, history: [98, 100, 99] },
      { key: 'shortStops', label: 'Short stops this shift', unit: '', limit: 6, history: [0, 1, 0] },
      { key: 'vibration', label: 'Vibration', unit: 'mm/s', limit: 5, history: [1.9, 2.0, 1.9] },
    ],
  },
]

// What the tool crib has right now. qty 0 = not in the crib.
export const CRIB = {
  'Electrode tips (pair)': { qty: 24, bin: 'Crib A, bin 3' },
  'Tip dresser blade': { qty: 6, bin: 'Crib A, bin 4' },
  'Tip puller': { qty: 2, bin: 'Crib A, wall rack' },
  'Torque wrench': { qty: 3, bin: 'Crib A, drawer 2' },
  'Axis 3 servo motor': { qty: 0, bin: 'Plant stores, Bldg 2', fallback: 'Not in the crib. The agent found 1 in plant stores (Bldg 2) and asked a runner to bring it. ETA about 40 min.' },
  'Gearbox grease cartridge': { qty: 8, bin: 'Crib B, bin 11' },
  'Hoist sling': { qty: 1, bin: 'Crib B, hook 2' },
  'Alignment gauge': { qty: 0, bin: 'Line C', fallback: 'Checked out to Line C. The agent asked for it to be returned before the job starts.' },
  'Dress-pack cable set': { qty: 2, bin: 'Crib B, shelf 5' },
  'Cable ties and clamps': { qty: 200, bin: 'Crib B, bin 1' },
  'Crimping tool': { qty: 2, bin: 'Crib B, drawer 1' },
  'Multimeter': { qty: 4, bin: 'Crib A, drawer 1' },
  'Wire liner': { qty: 5, bin: 'Crib B, bin 7' },
  'Drive roll set': { qty: 3, bin: 'Crib B, bin 8' },
  'Liner cutter': { qty: 2, bin: 'Crib B, drawer 3' },
  'Compressed air gun': { qty: 4, bin: 'Each line, tool board' },
}

// Upcoming times the line is already stopped (hours from now; "now" is 18:00 on 2nd shift).
export const STOP_WINDOWS = [
  { label: 'Break at 19:30', startsIn: 1.5, length: 0.5 },
  { label: 'Lunch at 22:00', startsIn: 4, length: 0.75 },
  { label: 'Planned maintenance block, tomorrow 08:00', startsIn: 14, length: 2 },
]

// Technicians on shift (roles only, no real people).
export const TECHS = [
  { id: 'T1', label: 'Tech 1 · Robotics, servo certified', skills: ['servo_overheat', 'cable_wear'] },
  { id: 'T2', label: 'Tech 2 · Welding equipment', skills: ['tip_wear', 'wire_feed'] },
  { id: 'T3', label: 'Tech 3 · Electrical', skills: ['cable_wear', 'wire_feed'] },
]

// Invented pilot results: unplanned downtime hours on the 6 welding robots,
// the month before the agent vs. the first month with it.
export const PILOT_RESULTS = {
  beforeLabel: 'October (before agent)',
  afterLabel: 'November pilot (with agent)',
  targetCut: 0.3,
  byFailure: [
    { key: 'tip_wear', before: 12, after: 6 },
    { key: 'servo_overheat', before: 14, after: 10 },
    { key: 'cable_wear', before: 8, after: 6 },
    { key: 'wire_feed', before: 6, after: 4 },
  ],
  caughtEarly: { caught: 9, total: 13 },
  fixedInsideBreaks: 6,
  partsWaitsAvoided: 5,
}
