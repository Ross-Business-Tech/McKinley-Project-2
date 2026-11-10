// Site maps and building positions (from McKinley's site-map data you uploaded).
// Positions are pixels on each property's own site plan image. They are NOT feet or meters,
// and each map has its own scale, so we only compare buildings on the same map.
import data from './maps/mapdata.json' with { type: 'json' }
import { travelMinutes } from './config.js'

export const MAPS = data.maps
export const SITE_GEO = data.sites

export function mapFor(siteName) {
  const s = SITE_GEO[siteName]
  return s && s.map ? { slug: s.map, ...MAPS[s.map], dataName: s.dataName } : null
}

export function buildingsFor(siteName) {
  const m = mapFor(siteName)
  if (!m) return []
  const own = m.b.filter((b) => b.p === m.dataName)
  return own.length ? own : m.b
}

export function buildingPos(siteName, buildingId) {
  if (!buildingId) return null
  const id = String(buildingId).replace(/^0+(?=.)/, '')
  const b = buildingsFor(siteName).find((x) => x.id.replace(/^0+(?=.)/, '') === id)
  return b ? { x: b.x, y: b.y, zone: b.z, low: b.c === 'l', note: b.note } : null
}

// Where a technician starts the day: the maintenance shop if the map shows one, else the leasing office.
export function startPlace(siteName) {
  const m = mapFor(siteName)
  const node = m && (m.n.find((n) => n.t === 'maintenance_shop') || m.n.find((n) => n.t === 'leasing_office'))
  return { site: siteName, ...(node ? { x: node.x, y: node.y, zone: 'all', label: node.t === 'maintenance_shop' ? 'Maintenance shop' : 'Leasing office' } : {}) }
}

export function placeOf(job) {
  return { site: job.community, ...(buildingPos(job.community, job.resident?.building || job.loc?.building) || {}) }
}

function km(a, b) {
  const R = 6371
  const toR = (d) => (d * Math.PI) / 180
  const dLat = toR(b.lat - a.lat)
  const dLng = toR(b.lng - a.lng)
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toR(a.lat)) * Math.cos(toR(b.lat)) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(h))
}

// Estimated minutes between two places. All rough until McKinley confirms real travel times.
// Same map: walking, 1 to 10 minutes from one corner of the property to the other,
//   plus 6 minutes if the buildings are in different zones (a road, creek or rail line in between).
// Different properties: straight-line distance from latitude/longitude, at city driving speed.
export function travel(a, b) {
  if (!a?.site || !b?.site) return 10
  const ma = SITE_GEO[a.site]?.map
  const mb = SITE_GEO[b.site]?.map
  if (ma && ma === mb && a.x != null && b.x != null) {
    const m = MAPS[ma]
    const d = Math.hypot(a.x - b.x, a.y - b.y) / Math.hypot(m.w, m.h)
    const barrier = a.zone && b.zone && a.zone !== 'all' && b.zone !== 'all' && a.zone !== b.zone ? 6 : 0
    return Math.max(1, Math.round(1 + 9 * d + barrier))
  }
  if (a.site === b.site) return 4
  const ga = SITE_GEO[a.site]
  const gb = SITE_GEO[b.site]
  if (ga?.lat != null && gb?.lat != null) {
    const k = km(ga, gb)
    return k > 300 ? 999 : Math.round(6 + k * 2.2)
  }
  return travelMinutes(a.site, b.site)
}
