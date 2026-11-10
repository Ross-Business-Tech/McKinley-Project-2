import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'
import { compare, CoverageError, evaluateGate } from '../src/evalcompare/compare.js'
import { pairwiseJudge } from '../src/evalcompare/judge.js'
import { runExperiment } from '../src/evalcompare/runner.js'
import { benjaminiHochberg, compareMetric, holm, mulberry32, power, signTest } from '../src/evalcompare/stats.js'

const noise = (n, seed, scale = 1) => { const r = mulberry32(seed); return Array.from({ length: n }, () => (r() - 0.5) * scale) }

test('clear win is better; clear loss is worse', () => {
  const d = noise(60, 1, 0.2).map((x) => x + 0.5)
  assert.equal(compareMetric(d).verdict, 'better')
  assert.equal(compareMetric(d.map((x) => -x)).verdict, 'worse')
})
test('pure noise is not significant', () => assert.equal(compareMetric(noise(60, 2)).verdict, 'no significant difference'))
test('small n cannot reach significance and is flagged underpowered', () => {
  const r = compareMetric([0.3, 0.4, 0.2], { minEffect: 0.1 })
  assert.equal(r.verdict, 'no significant difference') // sign test with n=3 can never reach p<0.05
  assert.equal(r.underpowered, true)
})
test('lower-is-better flips direction', () => {
  const d = noise(60, 3, 0.2).map((x) => x - 0.5)
  assert.equal(compareMetric(d, { higherIsBetter: false }).verdict, 'better')
  assert.equal(compareMetric(d, { higherIsBetter: true }).verdict, 'worse')
})
test('ties are counted and a real but tiny effect is "below min effect"', () => {
  const r = compareMetric([0, 0, 0, 0.01, 0.01, 0.01, 0.01, 0.01, 0.01, 0.01, 0.01, 0.01, 0.01, 0.01], { minEffect: 0.5 })
  assert.equal(r.ties, 3)
  assert.equal(r.verdict, 'below min effect')
})
test('sign test exact values', () => {
  assert.equal(signTest(0, 0), 1)
  assert.ok(Math.abs(signTest(10, 0) - 2 / 1024) < 1e-12)
})
test('multiple-comparison correction', () => {
  const ps = [0.01, 0.04, 0.03]
  assert.deepEqual(holm(ps).map((x) => +x.toFixed(4)), [0.03, 0.06, 0.06])
  assert.deepEqual(benjaminiHochberg(ps).map((x) => +x.toFixed(4)), [0.03, 0.04, 0.04])
  assert.ok(power(100, 1, 0.5) > power(10, 1, 0.5))
})

const mkRows = (variant, ids, fn, ok = () => true) => ids.map((id, i) => (ok(i) ? { variant, example: id, trial: 0, ok: true, metrics: { q: fn(i) }, output: i, latencyMs: 1 } : { variant, example: id, trial: 0, ok: false, error: 'boom' }))
const ids = Array.from({ length: 40 }, (_, i) => `e${i}`)
const cfg = { baseline: 'base', metrics: { q: { higherIsBetter: true, minEffect: 0.05 } }, examples: ids.map((id) => ({ id })), slices: () => ['all'] }

test('pairing drops unpaired examples and reports them', () => {
  const rows = [...mkRows('base', ids, (i) => i % 2), ...mkRows('cand', ids, (i) => (i % 2) + 1, (i) => i >= 4)]
  const res = compare(rows, cfg)
  assert.equal(res.variants.cand.dropped, 4)
  assert.equal(res.errors.cand.errors, 4)
  assert.ok(res.warnings.some((w) => w.includes('unpaired')))
})
test('badly mismatched coverage fails loudly', () => {
  const rows = [...mkRows('base', ids, () => 1), ...mkRows('cand', ids, () => 2, (i) => i < 10)]
  assert.throws(() => compare(rows, cfg), CoverageError)
})
test('gate exit codes', () => {
  const win = compare([...mkRows('base', ids, () => 0.2), ...mkRows('cand', ids, (i) => 0.8 + i * 1e-4)], cfg)
  assert.equal(evaluateGate(win).exitCode, 0)
  const loss = compare([...mkRows('base', ids, (i) => 0.8 + i * 1e-4), ...mkRows('cand', ids, () => 0.2)], cfg)
  assert.equal(evaluateGate(loss).exitCode, 1)
  const errs = compare([...mkRows('base', ids, () => 0.5), ...mkRows('cand', ids, () => 0.5, (i) => i > 5)], cfg)
  assert.equal(evaluateGate(errs, { maxErrorRate: 0.05 }).exitCode, 1)
})
test('multiple-comparison correction can remove a marginal verdict', () => {
  const marginal = [...mkRows('base', ids, () => 0), ...mkRows('cand', ids, (i) => (i < 30 ? 0.5 + i * 0.01 : -0.2))]
  const none = compare(marginal, { ...cfg, correction: 'none' })
  const corrected = compare(marginal, { ...cfg, correction: 'holm', slices: () => ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'].slice(0) })
  assert.ok(corrected.variants.cand.metrics.q.pAdjusted >= none.variants.cand.metrics.q.pAdjusted)
})
test('repeated trials report variance', () => {
  const rows = [0, 1, 2].flatMap((t) => ids.flatMap((id, i) => [{ variant: 'base', example: id, trial: t, ok: true, metrics: { q: 0 }, output: 0 }, { variant: 'cand', example: id, trial: t, ok: true, metrics: { q: 1 + (t - 1) * 0.1 + i * 1e-4 }, output: 0 }]))
  const r = compare(rows, cfg)
  assert.ok(r.variants.cand.metrics.q.trialSd > 0.09)
})

const dir = () => mkdtempSync(join(tmpdir(), 'evalcache-'))
const counting = (id, params = {}, extra = {}) => { const v = { id, params, calls: 0, run: async (ex) => { v.calls++; if (extra.fail?.(ex)) throw new Error('bad'); return { metrics: { q: ex.n } } }, ...extra.v }; return v }
const exs = Array.from({ length: 20 }, (_, i) => ({ id: `e${i}`, n: i }))

test('cache hit, add-a-variant, invalidation, refresh, no-cache', async () => {
  const cacheDir = dir()
  const a = counting('a')
  await runExperiment({ examples: exs, variants: [a], cacheDir })
  assert.equal(a.calls, 20)
  const a2 = counting('a'), b = counting('b')
  const r2 = await runExperiment({ examples: exs, variants: [a2, b], cacheDir })
  assert.equal(a2.calls, 0); assert.equal(b.calls, 20); assert.equal(r2.stats.hits, 20)
  const changed = counting('a', { temperature: 1 })
  await runExperiment({ examples: exs, variants: [changed], cacheDir })
  assert.equal(changed.calls, 20)
  const a3 = counting('a')
  await runExperiment({ examples: exs, variants: [a3], cacheDir, refresh: true })
  assert.equal(a3.calls, 20)
  const a4 = counting('a')
  await runExperiment({ examples: exs, variants: [a4], cacheDir, noCache: true })
  assert.equal(a4.calls, 20)
  rmSync(cacheDir, { recursive: true })
})
test('resume after an interrupted run only reruns what is missing; errors are counted, not cached', async () => {
  const cacheDir = dir()
  const flaky = counting('f', {}, { fail: (ex) => ex.n % 5 === 0 })
  const first = await runExperiment({ examples: exs, variants: [flaky], cacheDir, retries: 0 })
  assert.equal(first.rows.filter((r) => !r.ok).length, 4)
  const fixed = counting('f')
  const second = await runExperiment({ examples: exs, variants: [fixed], cacheDir })
  assert.equal(fixed.calls, 4) // only the previously failed items run again
  assert.equal(second.rows.every((r) => r.ok), true)
  rmSync(cacheDir, { recursive: true })
})
test('retry with backoff on rate limits, timeouts reported', async () => {
  let n = 0
  const v = { id: 'r', run: async () => { if (n++ < 2) throw Object.assign(new Error('429'), { status: 429 }); return { metrics: { q: 1 } } } }
  const r = await runExperiment({ examples: [{ id: 'x' }], variants: [v], backoffMs: 1 })
  assert.equal(r.rows[0].ok, true); assert.equal(n, 3)
  const slow = { id: 's', run: () => new Promise((res) => setTimeout(() => res({ metrics: { q: 1 } }), 200)) }
  const t = await runExperiment({ examples: [{ id: 'x' }], variants: [slow], timeoutMs: 10 })
  assert.equal(t.rows[0].ok, false); assert.equal(t.rows[0].timeout, true)
})
test('concurrency is bounded', async () => {
  let live = 0, peak = 0
  const v = { id: 'c', run: async () => { peak = Math.max(peak, ++live); await new Promise((r) => setTimeout(r, 5)); live--; return { metrics: { q: 1 } } } }
  await runExperiment({ examples: exs, variants: [v], concurrency: 4 })
  assert.ok(peak <= 4 && peak > 1)
})
test('pairwise judge removes position bias', async () => {
  const alwaysA = async () => 'A'
  assert.deepEqual(await pairwiseJudge({ judge: alwaysA, prompt: 'p', model: 'fake-1', baseline: 'x', candidate: 'y' }).then((r) => [r.score, r.orderBias]), [0.5, true])
  const prefersY = async (_p, { a, b }) => (b === 'y' ? 'B' : 'A')
  assert.equal((await pairwiseJudge({ judge: prefersY, prompt: 'p', model: 'fake-1', baseline: 'x', candidate: 'y' })).score, 1)
})
test('two identical variants are rarely flagged (false-positive rate near alpha)', () => {
  let flagged = 0
  const runs = 400
  for (let s = 0; s < runs; s++) {
    const d = noise(40, 1000 + s, 1)
    if (['better', 'worse'].includes(compareMetric(d, { seed: s + 1, iterations: 500 }).verdict)) flagged++
  }
  assert.ok(flagged / runs <= 0.06, `false positive rate ${flagged / runs}`)
})
test('end to end: second run hits the cache and gives byte-identical stats; gate exit code', () => {
  const out = dir(), cache = dir()
  const run = () => spawnSync('node', ['tools/evalcompare.mjs', '--days', '60', '--out', out, '--cache', cache], { encoding: 'utf8' })
  const r1 = run()
  const j1 = readFileSync(join(out, 'comparison.json'), 'utf8')
  const r2 = run()
  assert.match(r1.stdout, /Ran 180 calls, 0 from cache/)
  assert.match(r2.stdout, /Ran 0 calls, 180 from cache/)
  assert.equal(readFileSync(join(out, 'comparison.json'), 'utf8'), j1)
  assert.equal(r2.status, 1) // live-no-priority is genuinely worse, so the gate fails
  const ok = spawnSync('node', ['tools/evalcompare.mjs', '--days', '60', '--out', out, '--cache', cache, '--gate-metrics', 'driveMin'], { encoding: 'utf8' })
  assert.equal(ok.status, 0)
  rmSync(out, { recursive: true }); rmSync(cache, { recursive: true })
})
