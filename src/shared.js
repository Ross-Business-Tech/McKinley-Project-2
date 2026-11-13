// Shared, saved app data.
//
// On the team's here.now site (account-owned), every change is saved as a small "event" in
// here.now Site Data, so a supervisor's approval on a laptop shows up on the technician's phone
// a few seconds later. Everyone replays the same list of events, oldest first, so they all
// end up with the same picture.
//
// On an anonymous test link (or in the smoke test) Site Data isn't available. Then changes are
// saved in this browser only, so they survive a reload but aren't shared.
//
// Records from Site Data come from other people's browsers: treat them as untrusted input.
// We only ever JSON.parse them and render values through React (which escapes text).
import { useSyncExternalStore } from 'react'

const LS_KEY = 'mk-shared-v1'
const API = './.herenow/data/events'
const POLL_MS = 8000

const defs = {}
let values = {}
let mode = 'starting' // 'starting' | 'local' | 'online'
let who = 'someone'
const seen = new Set()
const listeners = new Set()
let version = 0

function notify() {
  version++
  for (const l of listeners) l()
}

// type: 'map' (object keyed by id), 'list' (array of objects with an id field), 'value' (anything)
// opts.persist = false: don't keep a copy in this browser's storage (used for photo pieces,
// which are big; they're still shared with the team on the team's site).
export function define(key, type, initial, idField = 'id', opts = {}) {
  defs[key] = { type, initial, idField, persist: opts.persist !== false }
  if (!(key in values)) values[key] = initial
}

export const getMode = () => mode
export const setWho = (name) => {
  who = name || 'someone'
}

function loadLocal() {
  try {
    const saved = JSON.parse(localStorage.getItem(LS_KEY) || '{}')
    for (const k of Object.keys(defs)) if (k in saved) values[k] = saved[k]
  } catch {
    /* nothing saved, or storage blocked */
  }
}
function saveLocal() {
  try {
    const keep = Object.fromEntries(Object.entries(values).filter(([k]) => defs[k]?.persist !== false))
    localStorage.setItem(LS_KEY, JSON.stringify(keep))
  } catch {
    /* storage full or blocked: keep going in memory */
  }
}

const same = (a, b) => JSON.stringify(a) === JSON.stringify(b)

// Work out the smallest set of changes between two versions of a value.
function diff(key, prev, next) {
  const d = defs[key]
  const out = []
  if (d.type === 'map') {
    const keys = new Set([...Object.keys(prev || {}), ...Object.keys(next || {})])
    for (const id of keys) {
      const a = prev?.[id]
      const b = next?.[id]
      if (!same(a, b)) out.push({ k: key, i: id, v: b === undefined ? null : b })
    }
  } else if (d.type === 'list') {
    const f = d.idField
    const pa = Object.fromEntries((prev || []).map((x) => [x[f], x]))
    const pb = Object.fromEntries((next || []).map((x) => [x[f], x]))
    for (const id of new Set([...Object.keys(pa), ...Object.keys(pb)])) {
      if (!same(pa[id], pb[id])) out.push({ k: key, i: id, v: pb[id] === undefined ? null : pb[id] })
    }
  } else if (!same(prev, next)) {
    out.push({ k: key, v: next })
  }
  return out
}

function apply(e) {
  const d = defs[e.k]
  if (!d) return
  if (d.type === 'map') {
    const m = { ...(values[e.k] || {}) }
    if (e.v === null) delete m[e.i]
    else m[e.i] = e.v
    values[e.k] = m
  } else if (d.type === 'list') {
    const f = d.idField
    const arr = [...(values[e.k] || [])]
    const at = arr.findIndex((x) => String(x[f]) === String(e.i))
    if (e.v === null) {
      if (at >= 0) arr.splice(at, 1)
    } else if (at >= 0) arr[at] = e.v
    else arr.push(e.v)
    values[e.k] = arr
  } else {
    values[e.k] = e.v
  }
}

async function post(e) {
  try {
    await fetch(API, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'Idempotency-Key': crypto.randomUUID() },
      body: JSON.stringify({ k: e.k, i: e.i ?? '', v: JSON.stringify(e.v), by: who }),
    })
  } catch {
    /* offline: the change still shows here; it will be missing for others */
  }
}

export function set(key, next) {
  const prev = values[key]
  const changes = diff(key, prev, typeof next === 'function' ? next(prev) : next)
  if (!changes.length) return
  for (const c of changes) apply(c)
  notify()
  if (mode === 'online') changes.forEach(post)
  else saveLocal()
}

export function useShared(key) {
  useSyncExternalStore(
    (cb) => {
      listeners.add(cb)
      return () => listeners.delete(cb)
    },
    () => version,
  )
  return [values[key], (next) => set(key, typeof next === 'function' ? next(values[key]) : next)]
}

export const useSyncMode = () =>
  useSyncExternalStore(
    (cb) => {
      listeners.add(cb)
      return () => listeners.delete(cb)
    },
    () => mode,
  )

function toEvent(r) {
  let v = null
  try {
    v = JSON.parse(r.v)
  } catch {
    return null
  }
  if (typeof r.k !== 'string') return null
  return { k: r.k, i: r.i || undefined, v, at: r.created_at }
}

async function fetchNew(all) {
  // Newest first; stop at the first record we've already applied (unless loading everything).
  const fresh = []
  let cursor = null
  for (let page = 0; page < 200; page++) {
    const res = await fetch(`${API}?limit=100${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ''}`)
    if (!res.ok) throw new Error(`site data ${res.status}`)
    const { records = [], nextCursor } = await res.json()
    let hitSeen = false
    for (const r of records) {
      if (seen.has(r.id)) {
        hitSeen = true
        break
      }
      fresh.push(r)
    }
    if ((!all && hitSeen) || !nextCursor) break
    cursor = nextCursor
  }
  fresh.sort((a, b) => String(a.created_at).localeCompare(String(b.created_at)))
  return fresh
}

export async function connect() {
  loadLocal()
  try {
    const first = await fetch(`${API}?limit=1`)
    const body = first.ok ? await first.json() : null
    if (!body || !Array.isArray(body.records)) throw new Error('no site data')
  } catch {
    mode = 'local'
    notify()
    return
  }
  // Online: the shared event list is the truth. Start from the defaults and replay it.
  mode = 'online'
  values = Object.fromEntries(Object.entries(defs).map(([k, d]) => [k, d.initial]))
  try {
    for (const r of await fetchNew(true)) {
      seen.add(r.id)
      const e = toEvent(r)
      if (e) apply(e)
    }
  } catch {
    /* keep whatever loaded */
  }
  notify()
  setInterval(async () => {
    try {
      const fresh = await fetchNew(false)
      if (!fresh.length) return
      for (const r of fresh) {
        seen.add(r.id)
        const e = toEvent(r)
        if (e) apply(e)
      }
      notify()
    } catch {
      /* try again next tick */
    }
  }, POLL_MS)
}

// Who is signed in through the here.now access gate (members-only or invite-only sites).
export async function signedInEmail() {
  try {
    const res = await fetch('./.herenow/me')
    if (!res.ok) return null
    const { email } = await res.json()
    return typeof email === 'string' && email.includes('@') ? email.toLowerCase() : null
  } catch {
    return null
  }
}
