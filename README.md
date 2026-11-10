# McKinley Project 2
This is your team's repository for the Business+Tech AI Sprint.

## Comparing planners with statistics (evalcompare)

The Plan Evaluator grades one day. `evalcompare` answers "is planner B really better than planner A?" by comparing them on many generated days (random subsets of the 11 jobs with jittered durations). It runs offline and needs no extra packages.

```bash
npm run evalcompare -- --days 200 --out eval-results   # add --html for a single-file report
npm test                                               # statistics, cache, resume and gate tests
node tools/bench.mjs                                   # speed benchmark
```

**Method.** Every variant is run on the same days, and each day is compared against the baseline (`hand`). For each metric we report the average difference, a 95% bootstrap interval (seeded, so repeatable), wins/losses/ties and an exact sign test. A variant is "better" or "worse" only if the interval excludes zero, the sign test agrees, and the difference is at least the metric's minimum practical effect. Lower-is-better metrics (cost, drive minutes, wasted trips, response time) are handled. Holm correction is applied across all variants, metrics and slices; a warning appears when there are too few days to detect the minimum effect. Days where a variant errored are left out of the comparison and listed; coverage below 80% stops the run.

**Reading the report** (`report.md`, `comparison.json`, `manifest.json`): check the gate line and warnings first, then errors, then the table of deltas. Look at slices and the worst regressions, not only the average. ★ marks variants not beaten on both quality and cost.

**Add a variant.** In `src/evalcompare/experiment.js` add `planner('my-id', (jobs) => myPlan(jobs), { ...settings })` to `defaultVariants()`. Change one thing per variant. Bump `version` when you change the code, otherwise cached results are reused. **Add a metric:** return it from `planMetrics` and list it in `defaultConfig.metrics` with its direction and minimum effect. **Add a slice:** edit `slices` and the day `tags`. AI judges: `pairwiseJudge` in `src/evalcompare/judge.js` asks twice with A/B swapped and treats order-dependent answers as ties; store the prompt and model id it returns.

**Running it.** Results are cached in `.evalcache/` (variant settings + day + trial), so adding a variant only runs that variant and an interrupted run resumes. `--refresh` re-runs everything, `--no-cache` skips the cache. Exit code 1 means a variant is significantly worse (use `--gate-metrics` and `--max-error-rate` to tune), 2 means a usage or coverage problem.

**Guidance for evaluators.** One change per variant. Use days the planner was not tuned on. Expect to need roughly 50+ days to see small effects (the report tells you the power). Generated days are made up, so treat results as estimates about the sample spreadsheet, not real operations.
