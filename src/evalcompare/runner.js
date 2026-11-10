// Node-only: runs variants over examples with bounded concurrency, a content-addressed cache,
// retry with backoff, and results streamed to disk as they finish (which also makes runs resumable).
import { createHash } from 'node:crypto'
import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

export const sha = (x) => createHash('sha256').update(typeof x === 'string' ? x : JSON.stringify(x)).digest('hex')
export const seedFor = (exampleId, trial, base = 1) => parseInt(sha(`${base}|${exampleId}|${trial}`).slice(0, 8), 16)
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

export const cacheKey = (variant, example, trial) => sha({ v: variant.id, cfg: variant.params ?? null, ver: variant.version ?? 1, ex: example.hash ?? sha(example), trial })

function loadCache(file) {
  const map = new Map()
  if (!existsSync(file)) return map
  for (const line of readFileSync(file, 'utf8').split('\n')) {
    if (!line) continue
    try {
      const row = JSON.parse(line)
      map.set(row.key, row)
    } catch {
      // A half-written last line from an interrupted run: ignore it, that item simply reruns.
    }
  }
  return map
}

// Run `fn` for every item with at most `limit` in flight.
export async function pool(items, limit, fn) {
  let next = 0
  const worker = async () => {
    while (next < items.length) {
      const i = next++
      await fn(items[i], i)
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker))
}

async function callWithRetry(variant, example, ctx, { retries, backoffMs }) {
  for (let attempt = 0; ; attempt++) {
    try {
      return await variant.run(example, ctx)
    } catch (err) {
      const retryable = err?.retryable || err?.status === 429 || err?.status >= 500
      if (!retryable || attempt >= retries) throw err
      await sleep(backoffMs * 2 ** attempt * (0.5 + ctx.jitter()))
    }
  }
}

// options: { cacheDir, concurrency, trials, seed, refresh, noCache, retries, backoffMs, timeoutMs, onRow }
export async function runExperiment({ examples, variants, cacheDir, concurrency = 8, trials = 1, seed = 1, refresh = false, noCache = false, retries = 3, backoffMs = 200, timeoutMs = 0, onRow }) {
  const cacheFile = cacheDir && !noCache ? join(cacheDir, 'rows.jsonl') : null
  if (cacheFile) mkdirSync(cacheDir, { recursive: true })
  const cache = cacheFile && !refresh ? loadCache(cacheFile) : new Map()
  const rows = []
  const stats = { hits: 0, calls: 0 }
  const tasks = []
  for (const variant of variants) for (const example of examples) for (let trial = 0; trial < trials; trial++) tasks.push({ variant, example, trial })
  await pool(tasks, concurrency, async ({ variant, example, trial }) => {
    const key = cacheKey(variant, example, trial)
    let row = cache.get(key)
    if (row) {
      stats.hits++
    } else {
      stats.calls++
      const started = Date.now()
      try {
        const rng = seedFor(example.id, trial, seed)
        const ctx = { seed: rng, trial, jitter: () => (rng % 1000) / 1000 }
        const work = callWithRetry(variant, example, ctx, { retries, backoffMs })
        const out = timeoutMs ? await Promise.race([work, sleep(timeoutMs).then(() => Promise.reject(Object.assign(new Error('timeout'), { timeout: true })))]) : await work
        row = { key, variant: variant.id, example: example.id, trial, ok: true, metrics: out.metrics, output: out.output ?? null, latencyMs: out.latencyMs ?? Date.now() - started }
        if (cacheFile) appendFileSync(cacheFile, JSON.stringify(row) + '\n')
      } catch (err) {
        // Errors are reported, never scored as success, and never cached so the next run retries them.
        row = { key, variant: variant.id, example: example.id, trial, ok: false, error: String(err?.message ?? err), timeout: Boolean(err?.timeout) }
      }
    }
    rows.push(row)
    onRow?.(row)
  })
  rows.sort((a, b) => a.variant.localeCompare(b.variant) || a.example.localeCompare(b.example) || a.trial - b.trial)
  return { rows, stats }
}

export function writeJson(file, data) {
  writeFileSync(file, JSON.stringify(data, null, 2) + '\n')
}
