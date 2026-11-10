// Before/after benchmark with a simulated slow variant (40 ms per call, 400 examples, 3 variants).
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { runExperiment } from '../src/evalcompare/runner.js'

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const examples = Array.from({ length: 400 }, (_, i) => ({ id: `e${i}`, n: i }))
let calls = 0
const slow = (id) => ({ id, run: async (ex) => { calls++; await sleep(40); return { metrics: { q: ex.n % 7 } } } })
const timed = async (label, opts) => {
  calls = 0
  const t = Date.now()
  await runExperiment({ examples, ...opts })
  console.log(`${label.padEnd(44)} ${String(Date.now() - t).padStart(6)} ms  ${String(calls).padStart(5)} model calls`)
}
const dir = mkdtempSync(join(tmpdir(), 'bench-'))
const three = [slow('a'), slow('b'), slow('c')]
await timed('before: serial, no cache (3 variants)', { variants: three, concurrency: 1, noCache: true })
await timed('after: 16 workers, cold cache', { variants: three, concurrency: 16, cacheDir: dir })
await timed('after: rerun, everything cached', { variants: three, concurrency: 16, cacheDir: dir })
await timed('after: add a 4th variant (only it runs)', { variants: [...three, slow('d')], concurrency: 16, cacheDir: dir })
rmSync(dir, { recursive: true })
