// Pure statistics for paired comparisons. No dependencies, deterministic given a seed.

export function mulberry32(seed) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export const mean = (xs) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : NaN)
export function sd(xs) {
  if (xs.length < 2) return 0
  const m = mean(xs)
  return Math.sqrt(xs.reduce((a, b) => a + (b - m) ** 2, 0) / (xs.length - 1))
}
export function quantile(xs, q) {
  if (!xs.length) return NaN
  const s = Float64Array.from(xs).sort()
  const pos = (s.length - 1) * q
  const lo = Math.floor(pos)
  return s[lo] + (s[Math.ceil(pos)] - s[lo]) * (pos - lo)
}

// Paired bootstrap CI of the mean difference. Typed arrays, one pass per resample.
export function bootstrapCI(diffs, { iterations = 2000, alpha = 0.05, seed = 1 } = {}) {
  const n = diffs.length
  if (!n) return [NaN, NaN]
  const d = Float64Array.from(diffs)
  const rand = mulberry32(seed)
  const means = new Float64Array(iterations)
  for (let i = 0; i < iterations; i++) {
    let s = 0
    for (let j = 0; j < n; j++) s += d[(rand() * n) | 0]
    means[i] = s / n
  }
  means.sort()
  const at = (q) => means[Math.min(iterations - 1, Math.max(0, Math.floor(q * iterations)))]
  return [at(alpha / 2), at(1 - alpha / 2)]
}

function logChoose(n, k) {
  let s = 0
  for (let i = 1; i <= k; i++) s += Math.log(n - k + i) - Math.log(i)
  return s
}

// Exact two-sided sign test. Ties are dropped.
export function signTest(wins, losses) {
  const n = wins + losses
  if (n === 0) return 1
  const k = Math.min(wins, losses)
  let p = 0
  for (let i = 0; i <= k; i++) p += Math.exp(logChoose(n, i) - n * Math.LN2)
  return Math.min(1, 2 * p)
}

// Holm step-down (controls family-wise error). Returns adjusted p-values in input order.
export function holm(ps) {
  const order = ps.map((p, i) => [p, i]).sort((a, b) => a[0] - b[0])
  const out = new Array(ps.length)
  let running = 0
  order.forEach(([p, i], rank) => {
    running = Math.max(running, Math.min(1, (ps.length - rank) * p))
    out[i] = running
  })
  return out
}

// Benjamini-Hochberg (controls false discovery rate).
export function benjaminiHochberg(ps) {
  const m = ps.length
  const order = ps.map((p, i) => [p, i]).sort((a, b) => b[0] - a[0])
  const out = new Array(m)
  let running = 1
  order.forEach(([p, i], k) => {
    running = Math.min(running, (p * m) / (m - k))
    out[i] = Math.min(1, running)
  })
  return out
}

const NORM_Z = { 0.05: 1.96, 0.01: 2.576, 0.1: 1.645 }
// Rough power of a paired z-test to detect `effect` given the sd of per-example differences.
export function power(n, sdDiff, effect, alpha = 0.05) {
  if (!n || !sdDiff) return sdDiff === 0 && effect > 0 ? 1 : 0
  const z = NORM_Z[alpha] ?? 1.96
  const x = Math.abs(effect) / (sdDiff / Math.sqrt(n)) - z
  return normCdf(x)
}
export function normCdf(x) {
  const t = 1 / (1 + 0.2316419 * Math.abs(x))
  const d = 0.3989423 * Math.exp((-x * x) / 2)
  const p = d * t * (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274))))
  return x > 0 ? 1 - p : p
}

// Verdict for one metric. `diffs` = candidate - baseline per paired example.
// higherIsBetter flips the meaning of the sign. minEffect = smallest practical difference.
export function compareMetric(diffs, { higherIsBetter = true, minEffect = 0, alpha = 0.05, iterations = 2000, seed = 1 } = {}) {
  const n = diffs.length
  const delta = mean(diffs)
  const good = higherIsBetter ? (d) => d > 0 : (d) => d < 0
  const bad = higherIsBetter ? (d) => d < 0 : (d) => d > 0
  const wins = diffs.filter(good).length
  const losses = diffs.filter(bad).length
  const ties = n - wins - losses
  const [lo, hi] = bootstrapCI(diffs, { iterations, alpha, seed })
  const pSign = signTest(wins, losses)
  const ciExcludesZero = lo > 0 || hi < 0
  const signAgrees = pSign < alpha
  const significant = n > 0 && ciExcludesZero && signAgrees
  const improved = higherIsBetter ? delta > 0 : delta < 0
  let verdict = 'no significant difference'
  if (significant && Math.abs(delta) < minEffect) verdict = 'below min effect'
  else if (significant) verdict = improved ? 'better' : 'worse'
  const sdDiff = sd(diffs)
  const pw = power(n, sdDiff, minEffect || Math.abs(delta), alpha)
  return { n, delta, ci: [lo, hi], wins, losses, ties, pSign, verdict, sdDiff, power: pw, underpowered: minEffect > 0 && pw < 0.8 }
}
