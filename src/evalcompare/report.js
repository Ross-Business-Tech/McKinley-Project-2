const f = (x, d = 3) => (Number.isFinite(x) ? x.toFixed(d) : 'n/a')
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c])

export function toMarkdown(result, config, gate) {
  const L = []
  L.push(`# Evaluation comparison`, '', `Baseline: **${result.baseline}** · ${result.nExamples} examples · alpha ${result.alpha} · correction: ${result.correction}`, '')
  L.push(gate ? `**Gate: ${gate.pass ? 'PASS' : 'FAIL'}**` : '', ...(gate?.failures ?? []).map((x) => `- ${x}`), '')
  if (result.warnings.length) L.push('## Warnings', '', ...result.warnings.map((w) => `- ${w}`), '')
  L.push('## Errors and timeouts', '', '| Variant | Calls | Errors | Rate |', '|---|---|---|---|')
  for (const [v, e] of Object.entries(result.errors)) L.push(`| ${v} | ${e.calls} | ${e.errors} | ${f(e.errorRate * 100, 1)}% |`)
  L.push('', '## Quality, cost and latency (means over usable examples)', '', `| Variant | ${Object.keys(config.metrics).join(' | ')} | p50 ms | p95 ms |`, `|---|${Object.keys(config.metrics).map(() => '---|').join('')}---|---|`)
  for (const [v, s] of Object.entries(result.summary)) L.push(`| ${v}${result.pareto.includes(v) ? ' ★' : ''} | ${Object.values(s.means).map((x) => f(x)).join(' | ')} | ${f(s.latency.p50, 0)} | ${f(s.latency.p95, 0)} |`)
  if (result.pareto.length) L.push('', `★ = Pareto-optimal on ${config.pareto.quality} vs ${config.pareto.cost}.`)
  for (const [v, pv] of Object.entries(result.variants)) {
    L.push('', `## ${v} vs ${result.baseline}`, '', `Paired on ${pv.paired.length} examples (${pv.dropped} dropped).`, '', '| Metric | Baseline | Candidate | Delta | 95% CI | W/L/T | p (sign, adj) | Verdict |', '|---|---|---|---|---|---|---|---|')
    for (const [m, r] of Object.entries(pv.metrics)) L.push(`| ${m} | ${f(r.baselineMean)} | ${f(r.candidateMean)} | ${f(r.delta)} | [${f(r.ci[0])}, ${f(r.ci[1])}] | ${r.wins}/${r.losses}/${r.ties} | ${f(r.pAdjusted, 4)} | ${r.verdict} |`)
    L.push('', '### Slices', '', '| Metric | Slice | n | Delta | W/L/T | Verdict |', '|---|---|---|---|---|---|')
    for (const [m, ss] of Object.entries(pv.slices)) for (const [s, r] of Object.entries(ss)) L.push(`| ${m} | ${s} | ${r.n} | ${f(r.delta)} | ${r.wins}/${r.losses}/${r.ties} | ${r.verdict} |`)
    for (const [m, list] of Object.entries(pv.regressions)) {
      if (!list.length) continue
      L.push('', `### Worst regressions on ${m}`, '')
      for (const r of list) L.push(`- \`${r.id}\` change ${f(r.change)}  \n  baseline: ${JSON.stringify(r.baseline)}  \n  candidate: ${JSON.stringify(r.candidate)}`)
    }
  }
  return L.join('\n') + '\n'
}

// Single self-contained HTML page (no scripts, no external files). All text is escaped.
export function toHtml(result, config, gate) {
  const md = esc(toMarkdown(result, config, gate))
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Evaluation comparison</title><style>body{font:14px/1.5 system-ui;margin:16px;max-width:1000px}pre{white-space:pre-wrap;overflow-wrap:anywhere}</style></head><body><pre>${md}</pre></body></html>\n`
}
