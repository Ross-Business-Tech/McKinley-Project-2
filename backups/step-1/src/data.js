// All data here is invented sample data for the Ironvale prototype.
// No real machines, people or plants.

export const COST_PER_HOUR = 12000 // client figure: $12K per hour of line downtime

// The kinds of welding-robot failures we track, what warns us, and what a fix needs.
export const FAILURE_TYPES = {
  tip_wear: {
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
