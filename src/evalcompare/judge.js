// Pairwise LLM-as-judge with position swap. `judge(prompt, {a, b})` returns 'A' | 'B' | 'tie'.
// A judge that picks the same *position* both times is showing order bias, so that counts as a tie.
export async function pairwiseJudge({ judge, prompt, model, baseline, candidate }) {
  const first = await judge(prompt, { a: baseline, b: candidate })
  const second = await judge(prompt, { a: candidate, b: baseline })
  const forCandidate = (first === 'B' ? 1 : first === 'A' ? -1 : 0) + (second === 'A' ? 1 : second === 'B' ? -1 : 0)
  return { score: forCandidate > 0 ? 1 : forCandidate < 0 ? 0 : 0.5, orderBias: first === second && first !== 'tie', record: { prompt, model, first, second } }
}
