// Outside vendors. ALL MADE UP until McKinley shares its real vendor list.
export const TRADES = { hvac: 'HVAC', plumbing: 'Plumbing', pest: 'Pest control', mold: 'Mold remediation', roofing: 'Roofing', appliance: 'Appliances', flooring: 'Flooring / carpet', elevator: 'Elevator' }
const MI = ['Ann Arbor', 'Ypsilanti']
const FL = ['Orlando', 'Winter Park', 'Brevard']
export const DEFAULT_VENDORS = [
  { id: 'V1', name: 'Sample HVAC Co. (MI)', trade: 'hvac', areas: MI, phone: '734-555-0191', email: 'hvac-mi@example.com' },
  { id: 'V2', name: 'Sample HVAC Co. (FL)', trade: 'hvac', areas: FL, phone: '407-555-0191', email: 'hvac-fl@example.com' },
  { id: 'V3', name: 'Sample Pest Control (MI)', trade: 'pest', areas: MI, phone: '734-555-0192', email: 'pest-mi@example.com' },
  { id: 'V4', name: 'Sample Pest Control (FL)', trade: 'pest', areas: FL, phone: '407-555-0192', email: 'pest-fl@example.com' },
  { id: 'V5', name: 'Sample Plumbing (MI)', trade: 'plumbing', areas: MI, phone: '734-555-0193', email: 'plumbing-mi@example.com' },
  { id: 'V6', name: 'Sample Plumbing (FL)', trade: 'plumbing', areas: FL, phone: '407-555-0193', email: 'plumbing-fl@example.com' },
  { id: 'V7', name: 'Sample Mold Remediation', trade: 'mold', areas: [...MI, ...FL], phone: '800-555-0194', email: 'mold@example.com' },
  { id: 'V8', name: 'Sample Roofing', trade: 'roofing', areas: [...MI, ...FL], phone: '800-555-0195', email: 'roofing@example.com' },
  { id: 'V9', name: 'Sample Appliance Service', trade: 'appliance', areas: [...MI, ...FL], phone: '800-555-0196', email: 'appliance@example.com' },
  { id: 'V10', name: 'Sample Flooring', trade: 'flooring', areas: [...MI, ...FL], phone: '800-555-0197', email: 'flooring@example.com' },
]

// Which trade a vendor flag (from config.js VENDOR_RULES) needs.
export function tradeFor(order) {
  const v = `${order.vendor?.vendor || ''} ${order.vendor?.why || ''}`.toLowerCase()
  if (/hvac|furnace|compressor/.test(v)) return 'hvac'
  if (/pest/.test(v)) return 'pest'
  if (/mold/.test(v)) return 'mold'
  if (/roof|ceiling/.test(v)) return 'roofing'
  if (/plumb|sewer/.test(v)) return 'plumbing'
  if (/appliance/.test(v)) return 'appliance'
  if (/floor|carpet/.test(v)) return 'flooring'
  if (/elevator/.test(v)) return 'elevator'
  // Repeat problems: use the job's own trade
  return { hvac: 'hvac', plumbing: 'plumbing', appliance: 'appliance' }[order.skill] || null
}

