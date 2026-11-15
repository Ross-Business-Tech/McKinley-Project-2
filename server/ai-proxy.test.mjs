// Run with:  node --test server/ai-proxy.test.mjs
// Uses a pretend UM GPT (a local server) and a made-up key, so nothing real is called.
import test from 'node:test'
import assert from 'node:assert/strict'
import http from 'node:http'
import { createServer } from './ai-proxy.mjs'

const FAKE_KEY = 'fake-test-key-not-real'
const SITE = 'https://site.example'

// Close a server and any connections still open (otherwise the test run never finishes).
const stop = (...servers) => servers.forEach((s) => { s.closeAllConnections?.(); s.close() })

function listen(server) {
  return new Promise((resolve) => server.listen(0, '127.0.0.1', () => resolve(server.address().port)))
}

// A pretend UM GPT that records what it was sent and answers like an OpenAI-style chat endpoint.
async function pretendUpstream(status = 200, answer = { choices: [{ message: { content: '{"severity":4}' } }], model: 'pretend-model' }) {
  const seen = []
  const server = http.createServer((req, res) => {
    let b = ''
    req.on('data', (c) => (b += c))
    req.on('end', () => {
      seen.push({ headers: req.headers, body: JSON.parse(b || '{}'), url: req.url })
      res.writeHead(status, { 'content-type': 'application/json' })
      res.end(JSON.stringify(answer))
    })
  })
  const port = await listen(server)
  return { seen, server, url: `http://127.0.0.1:${port}/chat?api-version=1` }
}

async function proxyWith(env) {
  const server = createServer(env)
  const port = await listen(server)
  const call = (path, init = {}) => fetch(`http://127.0.0.1:${port}${path}`, init)
  const ask = (body, origin = SITE) =>
    call('/ai-read', { method: 'POST', headers: { 'content-type': 'application/json', ...(origin ? { origin } : {}) }, body: JSON.stringify(body) })
  return { server, call, ask }
}

const good = { system: 'You triage requests.', user: 'The sink is leaking', max_tokens: 500 }

test('attaches the key on the server and returns only the text', async () => {
  const up = await pretendUpstream()
  const p = await proxyWith({ UMGPT_API_KEY: FAKE_KEY, UMGPT_BASE_URL: up.url, UMGPT_MODEL: 'forced-model', ALLOWED_ORIGINS: SITE })
  const r = await p.ask(good)
  assert.equal(r.status, 200)
  const out = await r.json()
  assert.equal(out.text, '{"severity":4}')
  assert.equal(out.model, 'forced-model')
  assert.equal(r.headers.get('access-control-allow-origin'), SITE)
  assert.ok(!JSON.stringify(out).includes(FAKE_KEY), 'the key must never be sent back to the browser')
  assert.equal(up.seen[0].headers.authorization, `Bearer ${FAKE_KEY}`)
  assert.equal(up.seen[0].body.model, 'forced-model')
  assert.equal(up.seen[0].body.max_tokens, 500)
  assert.equal(up.seen[0].body.messages[1].content, 'The sink is leaking')
  assert.equal(up.seen[0].url, '/chat?api-version=1')
  stop(p.server, up.server)
})

test('can use the api-key header style and a different length field', async () => {
  const up = await pretendUpstream()
  const p = await proxyWith({ UMGPT_API_KEY: FAKE_KEY, UMGPT_BASE_URL: up.url, UMGPT_AUTH_STYLE: 'api-key', UMGPT_TOKEN_FIELD: 'max_completion_tokens', UMGPT_TEMPERATURE: '0', ALLOWED_ORIGINS: SITE })
  await p.ask(good)
  assert.equal(up.seen[0].headers['api-key'], FAKE_KEY)
  assert.equal(up.seen[0].headers.authorization, undefined)
  assert.equal(up.seen[0].body.max_completion_tokens, 500)
  assert.equal(up.seen[0].body.temperature, 0)
  stop(p.server, up.server)
})

test('refuses other websites and calls with no origin', async () => {
  const up = await pretendUpstream()
  const p = await proxyWith({ UMGPT_API_KEY: FAKE_KEY, UMGPT_BASE_URL: up.url, ALLOWED_ORIGINS: SITE })
  assert.equal((await p.ask(good, 'https://evil.example')).status, 403)
  assert.equal((await p.ask(good, null)).status, 403)
  assert.equal(up.seen.length, 0, 'nothing should reach UM GPT')
  stop(p.server, up.server)
})

test('answers the browser preflight only for the allowed site', async () => {
  const up = await pretendUpstream()
  const p = await proxyWith({ UMGPT_API_KEY: FAKE_KEY, UMGPT_BASE_URL: up.url, ALLOWED_ORIGINS: `${SITE}/` })
  const ok = await p.call('/ai-read', { method: 'OPTIONS', headers: { origin: SITE } })
  assert.equal(ok.status, 204)
  assert.equal(ok.headers.get('access-control-allow-origin'), SITE)
  const no = await p.call('/ai-read', { method: 'OPTIONS', headers: { origin: 'https://evil.example' } })
  assert.equal(no.status, 403)
  stop(p.server, up.server)
})

test('says not configured instead of failing when settings are missing', async () => {
  const p = await proxyWith({ ALLOWED_ORIGINS: SITE })
  assert.equal((await p.ask(good)).status, 503)
  const health = await (await p.call('/health')).json()
  assert.deepEqual(health, { ok: true, configured: false })
  stop(p.server)
})

test('limits how often one visitor can call, and how big a call can be', async () => {
  const up = await pretendUpstream()
  const p = await proxyWith({ UMGPT_API_KEY: FAKE_KEY, UMGPT_BASE_URL: up.url, ALLOWED_ORIGINS: SITE, RATE_LIMIT_PER_HOUR: '2' })
  assert.equal((await p.ask(good)).status, 200)
  assert.equal((await p.ask(good)).status, 200)
  assert.equal((await p.ask(good)).status, 429)
  const p2 = await proxyWith({ UMGPT_API_KEY: FAKE_KEY, UMGPT_BASE_URL: up.url, ALLOWED_ORIGINS: SITE })
  assert.equal((await p2.ask({ system: 's', user: 'x'.repeat(9000) })).status, 400)
  assert.equal((await p2.ask({ system: 's', user: 'x'.repeat(40000) })).status, 413)
  assert.equal((await p2.ask({ user: 5 })).status, 400)
  const big = await p2.ask({ ...good, max_tokens: 999999 })
  assert.equal(big.status, 200)
  assert.equal(up.seen.at(-1).body.max_tokens, 1200, 'the length is capped')
  stop(p.server, p2.server, up.server)
})

test('hides upstream details when UM GPT fails', async () => {
  const up = await pretendUpstream(401, { error: 'bad key upstream-secret-should-not-leak' })
  const p = await proxyWith({ UMGPT_API_KEY: FAKE_KEY, UMGPT_BASE_URL: up.url, ALLOWED_ORIGINS: SITE })
  const r = await p.ask(good)
  assert.equal(r.status, 502)
  const text = await r.text()
  assert.ok(!text.includes('upstream-secret-should-not-leak') && !text.includes(FAKE_KEY))
  stop(p.server, up.server)
})

test('adds /chat/completions when only a base address is given, and leaves a full address alone', async () => {
  const up = await pretendUpstream()
  const base = up.url.replace('/chat?api-version=1', '/v1')
  const p = await proxyWith({ UMGPT_API_KEY: FAKE_KEY, UMGPT_BASE_URL: base, ALLOWED_ORIGINS: SITE })
  await p.ask(good)
  assert.equal(up.seen[0].url, '/v1/chat/completions')
  const full = up.url.replace('/chat?api-version=1', '/openai/chat/completions?api-version=2024-02-01')
  const p2 = await proxyWith({ UMGPT_API_KEY: FAKE_KEY, UMGPT_BASE_URL: full, ALLOWED_ORIGINS: SITE })
  await p2.ask(good)
  assert.equal(up.seen[1].url, '/openai/chat/completions?api-version=2024-02-01')
  stop(p.server, p2.server, up.server)
})
