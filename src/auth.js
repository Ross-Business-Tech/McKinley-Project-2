// Sign-in helpers.
//
// Property managers are set by IT in src/access/managers.json: one entry per manager, with the
// properties they run. The file holds only scrambled fingerprints (SHA-256 "hashes") of each
// manager's work email and optional passcode, because this code is public. See ACCESS.md.
import data from './access/managers.json' with { type: 'json' }

export const MANAGERS = data.managers

export async function hashPass(text) {
  const bytes = new TextEncoder().encode(text)
  const buf = await crypto.subtle.digest('SHA-256', bytes)
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('')
}
export const hashEmail = (email) => hashPass(String(email || '').trim().toLowerCase())

// A manager's current passcode fingerprint: one they changed in the app, else the one IT set.
export const passHashOf = (m, overrides = {}) => overrides[m.id] || m.passcodeHash || null

export const randomPin = () => {
  const a = new Uint32Array(1)
  crypto.getRandomValues(a)
  return String(a[0] % 10000).padStart(4, '0')
}
