// A tiny server that sits between the website and UM GPT.
//
// Why it exists: the website is public, so it can never hold the UM GPT key. This server holds the
// key in its own private settings (environment variables) and makes the call on the website's behalf.
// The key is never sent to the browser, never logged, and never written in the code.
//
// It has no dependencies: run it with  node server/ai-proxy.mjs
//
// Settings (environment variables, set in the Render dashboard, never in the repository):
//   UMGPT_API_KEY       required  the key
//   UMGPT_BASE_URL      required  the full address of UM GPT's chat endpoint, including any ?api-version=...
//   UMGPT_MODEL         optional  forces this model name into every call (recommended)
//   UMGPT_AUTH_STYLE    optional  "bearer" (default: Authorization: Bearer <key>) or "api-key" (api-key: <key>)
//   UMGPT_TOKEN_FIELD   optional  name of the length-limit field, default "max_tokens" (some models want "max_completion_tokens")
//   UMGPT_TEMPERATURE   optional  a number, only sent if set (some models reject it)
//   ALLOWED_ORIGINS     required  the website address(es) allowed to call this, comma separated,
//                                 for example https://mckinley-maintenance-hub.onrender.com
//   RATE_LIMIT_PER_HOUR optional  calls per visitor address per hour, default 120
//   PORT                optional  Render sets this itself
import http from 'node:http'

const MAX_BODY = 32 * 1024 // bytes the website may send
const MAX_FIELD = 8000 // characters in the system and user text
const MAX_TOKENS_CAP = 1200
const UPSTREAM_TIMEOUT_MS = 30000

export function createServer(env = process.env) {
  const allowed = new Set(
    String(env.ALLOWED_ORIGINS || '')
      .split(',')
      .map((s) => s.trim().replace(/\/$/, ''))
      .filter(Boolean),
  )
  const limit = Number(env.RATE_LIMIT_PER_HOUR) > 0 ? Number(env.RATE_LIMIT_PER_HOUR) : 120
  const hits = new Map() // visitor address -> { count, resetAt }
  const configured = () => !!(env.UMGPT_API_KEY && env.UMGPT_BASE_URL && allowed.size)

  const rateOk = (ip) => {
    const now = Date.now()
    const h = hits.get(ip)
    if (!h || h.resetAt < now) {
      hits.set(ip, { count: 1, resetAt: now + 3600_000 })
      return true
    }
    h.count += 1
    return h.count <= limit
  }

  const send = (res, status, obj, headers = {}) => {
    res.writeHead(status, { 'content-type': 'application/json', 'cache-control': 'no-store', ...headers })
    res.end(JSON.stringify(obj))
  }

  const readBody = (req) =>
    new Promise((resolve, reject) => {
      let size = 0
      let tooBig = false
      const chunks = []
      req.on('data', (c) => {
        if (tooBig) return // keep draining the rest so the "too large" answer can be delivered
        size += c.length
        if (size > MAX_BODY) {
          tooBig = true
          chunks.length = 0
          reject(new Error('too_large'))
        } else chunks.push(c)
      })
      req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')))
      req.on('error', reject)
    })

  return http.createServer(async (req, res) => {
    const origin = String(req.headers.origin || '').replace(/\/$/, '')
    const cors = origin && allowed.has(origin) ? { 'access-control-allow-origin': origin, vary: 'Origin' } : {}

    if (req.method === 'GET' && req.url === '/health') return send(res, 200, { ok: true, configured: configured() })

    if (req.method === 'OPTIONS') {
      if (!cors['access-control-allow-origin']) return send(res, 403, { error: 'origin_not_allowed' })
      return send(res, 204, {}, { ...cors, 'access-control-allow-methods': 'POST, OPTIONS', 'access-control-allow-headers': 'content-type', 'access-control-max-age': '600' })
    }

    if (req.method !== 'POST' || req.url !== '/ai-read') return send(res, 404, { error: 'not_found' })
    // Only the website's own address may call this. A request with no allowed Origin is refused.
    if (!cors['access-control-allow-origin']) return send(res, 403, { error: 'origin_not_allowed' })
    if (!configured()) return send(res, 503, { error: 'not_configured' }, cors)

    const ip = String(req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown').split(',')[0].trim()
    if (!rateOk(ip)) return send(res, 429, { error: 'rate_limited' }, cors)

    let input
    try {
      input = JSON.parse(await readBody(req))
    } catch (e) {
      return send(res, e.message === 'too_large' ? 413 : 400, { error: e.message === 'too_large' ? 'too_large' : 'bad_json' }, { ...cors, connection: 'close' })
    }
    const { system, user } = input || {}
    if (typeof system !== 'string' || typeof user !== 'string' || !user.trim() || system.length > MAX_FIELD || user.length > MAX_FIELD) {
      return send(res, 400, { error: 'bad_request' }, cors)
    }
    const maxTokens = Math.min(Math.max(Number(input.max_tokens) || 800, 50), MAX_TOKENS_CAP)

    const body = { messages: [{ role: 'system', content: system }, { role: 'user', content: user }], [env.UMGPT_TOKEN_FIELD || 'max_tokens']: maxTokens }
    if (env.UMGPT_MODEL) body.model = env.UMGPT_MODEL
    if (env.UMGPT_TEMPERATURE !== undefined && env.UMGPT_TEMPERATURE !== '') body.temperature = Number(env.UMGPT_TEMPERATURE)
    const headers = { 'content-type': 'application/json' }
    if (env.UMGPT_AUTH_STYLE === 'api-key') headers['api-key'] = env.UMGPT_API_KEY
    else headers.authorization = `Bearer ${env.UMGPT_API_KEY}`

    const ctl = new AbortController()
    const timer = setTimeout(() => ctl.abort(), UPSTREAM_TIMEOUT_MS)
    try {
      const up = await fetch(env.UMGPT_BASE_URL, { method: 'POST', headers, body: JSON.stringify(body), signal: ctl.signal })
      if (!up.ok) {
        console.log(`upstream status ${up.status}`) // status only: never the request, the answer or the key
        return send(res, 502, { error: 'upstream_error', status: up.status }, cors)
      }
      const data = await up.json()
      const text = data?.choices?.[0]?.message?.content
      if (typeof text !== 'string') return send(res, 502, { error: 'unexpected_answer' }, cors)
      return send(res, 200, { text, model: env.UMGPT_MODEL || data.model || 'umgpt' }, cors)
    } catch {
      return send(res, 504, { error: 'upstream_unreachable' }, cors)
    } finally {
      clearTimeout(timer)
    }
  })
}

// Start listening only when run directly (not when imported by the tests).
if (import.meta.url === `file://${process.argv[1]}`) {
  const port = Number(process.env.PORT) || 8787
  createServer().listen(port, () => {
    const ok = !!(process.env.UMGPT_API_KEY && process.env.UMGPT_BASE_URL && process.env.ALLOWED_ORIGINS)
    console.log(`AI proxy listening on ${port}. ${ok ? 'Configured.' : 'NOT configured yet: set UMGPT_API_KEY, UMGPT_BASE_URL and ALLOWED_ORIGINS.'}`)
  })
}
