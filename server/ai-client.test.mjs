// Run with:  node --test server/ai-client.test.mjs
import test from 'node:test'
import assert from 'node:assert/strict'
import { aiRead, parseAnswer } from '../src/ai.js'

const ok = { severity: 4, reason: 'Water near an outlet', likely_cause: 'Leak', visit_needed: 'yes', resident_tip: '', hidden_risks: ['shock'], english_translation: '' }

test('reads a clean JSON answer', () => {
  assert.deepEqual(parseAnswer(JSON.stringify(ok)), ok)
})

test('copes with words or code fences around the JSON', () => {
  const wrapped = 'Sure! Here you go:\n```json\n' + JSON.stringify(ok) + '\n```\nHope that helps.'
  assert.equal(parseAnswer(wrapped).severity, 4)
})

test('refuses answers it cannot trust', () => {
  assert.equal(parseAnswer('no json at all'), null)
  assert.equal(parseAnswer('{"severity": 9}'), null)
  assert.equal(parseAnswer('{"severity": 2.5}'), null)
  assert.equal(parseAnswer('{"severity": "high"}'), null)
  assert.equal(parseAnswer('{"severity": 3'), null)
  assert.equal(parseAnswer(undefined), null)
})

test('cleans up odd fields instead of passing them on', () => {
  const r = parseAnswer(JSON.stringify({ severity: '5', reason: 12, visit_needed: 'definitely', hidden_risks: ['a', 5, null, 'b'], resident_tip: 'x'.repeat(2000) }))
  assert.equal(r.severity, 5)
  assert.equal(r.reason, '')
  assert.equal(r.visit_needed, 'unclear')
  assert.deepEqual(r.hidden_risks, ['a', 'b'])
  assert.equal(r.resident_tip.length, 600)
})

test('stops quickly when the AI server is not set up, so the app keeps using its rules', async () => {
  await assert.rejects(() => aiRead({ text: 'The sink is leaking' }), /ai_not_configured/)
})
