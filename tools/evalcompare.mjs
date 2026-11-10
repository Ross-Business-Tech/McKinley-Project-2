#!/usr/bin/env node
// Compare maintenance planners over many generated days, with paired statistics.
//   node tools/evalcompare.mjs --days 200 --out eval-results
// Exit code: 0 = pass, 1 = a variant is significantly worse (gate failed), 2 = usage or coverage problem.
import { execSync } from 'node:child_process'
import { mkdirSync, writeFileSync } from 'node:fs'
import { parseArgs } from 'node:util'
import { compare, CoverageError, evaluateGate } from '../src/evalcompare/compare.js'
import { defaultConfig, defaultVariants, makeDays } from '../src/evalcompare/experiment.js'
import { toHtml, toMarkdown } from '../src/evalcompare/report.js'
import { runExperiment, sha } from '../src/evalcompare/runner.js'

const { values: a } = parseArgs({
  options: {
    days: { type: 'string', default: '200' }, trials: { type: 'string', default: '1' }, seed: { type: 'string', default: '1' },
    concurrency: { type: 'string', default: '8' }, out: { type: 'string', default: 'eval-results' }, cache: { type: 'string', default: '.evalcache' },
    'no-cache': { type: 'boolean', default: false }, refresh: { type: 'boolean', default: false }, html: { type: 'boolean', default: false },
    baseline: { type: 'string' }, 'max-error-rate': { type: 'string', default: '0.05' }, 'gate-metrics': { type: 'string' },
  },
})

try {
  const seed = Number(a.seed)
  const examples = makeDays(Number(a.days), seed)
  const variants = defaultVariants()
  const config = { ...defaultConfig, baseline: a.baseline ?? defaultConfig.baseline, seed, examples }
  const { rows, stats } = await runExperiment({ examples, variants, cacheDir: a.cache, concurrency: Number(a.concurrency), trials: Number(a.trials), seed, refresh: a.refresh, noCache: a['no-cache'] })
  const result = compare(rows, config)
  const gate = evaluateGate(result, { maxErrorRate: Number(a['max-error-rate']), metrics: a['gate-metrics']?.split(',') })
  mkdirSync(a.out, { recursive: true })
  // Stats files contain no timestamps, so a rerun is byte-identical. Run details go in manifest.json.
  writeFileSync(`${a.out}/comparison.json`, JSON.stringify({ result, gate }, null, 2) + '\n')
  writeFileSync(`${a.out}/report.md`, toMarkdown(result, config, gate))
  if (a.html) writeFileSync(`${a.out}/report.html`, toHtml(result, config, gate))
  writeFileSync(`${a.out}/rows.jsonl`, rows.map((r) => JSON.stringify(r)).join('\n') + '\n')
  let gitSha = 'unknown'
  try { gitSha = execSync('git rev-parse HEAD', { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim() } catch { /* not a git checkout */ }
  writeFileSync(`${a.out}/manifest.json`, JSON.stringify({
    gitSha, startedAt: new Date().toISOString(), seed, trials: Number(a.trials), configHash: sha({ ...config, slices: null, examples: null }),
    datasetHash: sha(examples.map((e) => e.hash)), variants: variants.map((v) => ({ id: v.id, params: v.params, version: v.version })), cache: stats,
  }, null, 2) + '\n')
  console.log(`Ran ${stats.calls} calls, ${stats.hits} from cache. Report: ${a.out}/report.md`)
  console.log(`Gate: ${gate.pass ? 'PASS' : 'FAIL'}`)
  gate.failures.forEach((x) => console.log(`  - ${x}`))
  process.exit(gate.exitCode)
} catch (err) {
  console.error(err instanceof CoverageError ? `Coverage problem: ${err.message}` : err)
  process.exit(2)
}
