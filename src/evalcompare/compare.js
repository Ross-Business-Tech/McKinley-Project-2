import { benjaminiHochberg, compareMetric, holm, mean, quantile, sd } from './stats.js'

export class CoverageError extends Error {}

const CORRECTIONS = { holm, bh: benjaminiHochberg, none: (ps) => ps }

// Average repeated trials per example. Errored trials make the example unusable for that variant.
export function collapseTrials(rows) {
  const by = new Map()
  for (const r of rows) {
    const k = `${r.variant}\u0000${r.example}`
    if (!by.has(k)) by.set(k, { variant: r.variant, example: r.example, trials: [], errors: 0 })
    const e = by.get(k)
    if (r.ok) e.trials.push(r)
    else e.errors++
  }
  const out = []
  for (const e of by.values()) {
    if (e.errors || !e.trials.length) {
      out.push({ ...e, ok: false })
      continue
    }
    const metrics = {}
    const trialSd = {}
    for (const m of Object.keys(e.trials[0].metrics)) {
      const xs = e.trials.map((t) => t.metrics[m])
      metrics[m] = mean(xs)
      trialSd[m] = sd(xs)
    }
    out.push({ ...e, ok: true, metrics, trialSd, output: e.trials[0].output, nTrials: e.trials.length })
  }
  return out
}

export function errorSummary(rows, variants) {
  return Object.fromEntries(
    variants.map((v) => {
      const mine = rows.filter((r) => r.variant === v)
      const errors = mine.filter((r) => !r.ok)
      return [v, { calls: mine.length, errors: errors.length, errorRate: mine.length ? errors.length / mine.length : 0, sample: errors[0]?.error ?? null }]
    }),
  )
}

function latencyStats(rows, v) {
  const xs = rows.filter((r) => r.variant === v && r.ok && Number.isFinite(r.latencyMs)).map((r) => r.latencyMs)
  return { p50: quantile(xs, 0.5), p95: quantile(xs, 0.95) }
}

// Core comparison. config: { baseline, metrics: {name: {higherIsBetter, minEffect}}, slices: fn(example)->[labels],
// alpha, correction, minCoverage, seed, iterations, examples: [{id, ...}], pareto: {quality, cost} }
export function compare(rows, config) {
  const { baseline, metrics, alpha = 0.05, correction = 'holm', minCoverage = 0.8, seed = 1, iterations = 2000, examples = [] } = config
  const variants = [...new Set(rows.map((r) => r.variant))]
  if (!variants.includes(baseline)) throw new CoverageError(`Baseline "${baseline}" has no results`)
  const exampleById = new Map(examples.map((e) => [e.id, e]))
  const collapsed = collapseTrials(rows)
  const get = (v) => new Map(collapsed.filter((c) => c.variant === v).map((c) => [c.example, c]))
  const base = get(baseline)
  const allIds = [...new Set(rows.map((r) => r.example))].sort()
  const tests = []
  const perVariant = {}
  for (const v of variants.filter((x) => x !== baseline)) {
    const cand = get(v)
    const paired = allIds.filter((id) => base.get(id)?.ok && cand.get(id)?.ok)
    const dropped = allIds.length - paired.length
    const coverage = allIds.length ? paired.length / allIds.length : 0
    if (coverage < minCoverage) {
      throw new CoverageError(`"${v}" is paired with the baseline on only ${paired.length} of ${allIds.length} examples (${(coverage * 100).toFixed(0)}%, minimum ${minCoverage * 100}%). Check for errors or a mismatched dataset.`)
    }
    perVariant[v] = { paired, dropped, coverage, metrics: {}, slices: {}, regressions: {}, improvements: {} }
    const sliceMembers = {}
    for (const id of paired) for (const s of config.slices?.(exampleById.get(id)) ?? []) (sliceMembers[s] ||= []).push(id)
    for (const [m, spec] of Object.entries(metrics)) {
      const diffsFor = (ids) => ids.map((id) => cand.get(id).metrics[m] - base.get(id).metrics[m])
      const opts = { ...spec, alpha, iterations, seed }
      const res = compareMetric(diffsFor(paired), opts)
      res.baselineMean = mean(paired.map((id) => base.get(id).metrics[m]))
      res.candidateMean = mean(paired.map((id) => cand.get(id).metrics[m]))
      res.trialSd = mean(paired.map((id) => cand.get(id).trialSd[m]))
      perVariant[v].metrics[m] = res
      tests.push(res)
      perVariant[v].slices[m] = {}
      for (const [s, ids] of Object.entries(sliceMembers)) {
        const sr = compareMetric(diffsFor(ids), opts)
        perVariant[v].slices[m][s] = sr
        tests.push(sr)
      }
      const worse = (id) => (spec.higherIsBetter === false ? 1 : -1) * (cand.get(id).metrics[m] - base.get(id).metrics[m])
      const ranked = paired.map((id) => ({ id, change: cand.get(id).metrics[m] - base.get(id).metrics[m], baseline: base.get(id).output, candidate: cand.get(id).output })).filter((r) => r.change !== 0)
      ranked.sort((a, b) => worse(a.id) - worse(b.id))
      perVariant[v].regressions[m] = ranked.filter((r) => worse(r.id) < 0).slice(0, 5)
      perVariant[v].improvements[m] = ranked.filter((r) => worse(r.id) > 0).slice(-5).reverse()
    }
  }
  // Multiple-comparison control across every variant x metric x slice test.
  const adjusted = CORRECTIONS[correction](tests.map((t) => t.pSign))
  tests.forEach((t, i) => {
    t.pAdjusted = adjusted[i]
    if (t.pAdjusted >= alpha && ['better', 'worse', 'below min effect'].includes(t.verdict)) t.verdict = 'no significant difference'
  })
  const warnings = []
  for (const [v, pv] of Object.entries(perVariant)) {
    if (pv.dropped) warnings.push(`${v}: ${pv.dropped} of ${pv.dropped + pv.paired.length} examples were unpaired (error or missing) and left out.`)
    for (const [m, r] of Object.entries(pv.metrics)) {
      if (r.underpowered) warnings.push(`${v} / ${m}: only ${(r.power * 100).toFixed(0)}% power to detect the minimum effect with n=${r.n}; a "no significant difference" here is weak evidence.`)
    }
  }
  const summary = {}
  for (const v of variants) {
    const mine = v === baseline ? base : get(v)
    summary[v] = { means: {}, latency: latencyStats(rows, v) }
    for (const m of Object.keys(metrics)) summary[v].means[m] = mean([...mine.values()].filter((c) => c.ok).map((c) => c.metrics[m]))
  }
  const pareto = config.pareto ? paretoFront(summary, metrics, config.pareto) : []
  return { baseline, alpha, correction, nExamples: allIds.length, variants: perVariant, summary, errors: errorSummary(rows, variants), warnings, pareto }
}

// Variants not beaten on both quality and cost by another variant.
export function paretoFront(summary, metrics, { quality, cost }) {
  const q = (v) => summary[v].means[quality] * (metrics[quality].higherIsBetter === false ? -1 : 1)
  const c = (v) => summary[v].means[cost] * (metrics[cost].higherIsBetter === false ? 1 : -1)
  const vs = Object.keys(summary)
  return vs.filter((a) => !vs.some((b) => b !== a && q(b) >= q(a) && c(b) <= c(a) && (q(b) > q(a) || c(b) < c(a))))
}

// Gate: fail if a variant is significantly worse on a gated metric/slice, or has too many errors.
export function evaluateGate(result, { maxErrorRate = 0.05, metrics = null, slices = true } = {}) {
  const failures = []
  for (const [v, pv] of Object.entries(result.variants)) {
    for (const [m, r] of Object.entries(pv.metrics)) {
      if (metrics && !metrics.includes(m)) continue
      if (r.verdict === 'worse') failures.push(`${v} is significantly worse on ${m} (delta ${r.delta.toFixed(3)})`)
      if (slices) for (const [s, sr] of Object.entries(pv.slices[m])) if (sr.verdict === 'worse') failures.push(`${v} is significantly worse on ${m} in slice ${s}`)
    }
    const e = result.errors[v]
    if (e.errorRate > maxErrorRate) failures.push(`${v} errored on ${(e.errorRate * 100).toFixed(1)}% of calls (limit ${maxErrorRate * 100}%)`)
  }
  return { pass: failures.length === 0, failures, exitCode: failures.length ? 1 : 0 }
}
