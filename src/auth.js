// Sign-in helpers.
//
// The property manager signs in with a passcode (8+ characters). The app only ever keeps a
// SHA-256 fingerprint ("hash") of it, never the passcode itself. IT sets the starting passcode by
// putting its hash in VITE_PM_PASSCODE_HASH when the site is built (see ACCESS.md); the manager can
// change it later on the Access tab. Without that setting, the demo passcode is "mckinley-demo".
export const DEMO_PM_HASH = '6e6ca1c0a036d24c13e7a981ca39ad0f9e3405cc435c04e9658c3a69e776d14a'
export const BUILD_PM_HASH = (import.meta.env?.VITE_PM_PASSCODE_HASH || '').trim().toLowerCase() || DEMO_PM_HASH
// Emails IT allows in as property manager when signed in through here.now (comma-separated).
export const BUILD_PM_EMAILS = (import.meta.env?.VITE_PM_EMAILS || '')
  .split(',')
  .map((x) => x.trim().toLowerCase())
  .filter(Boolean)

export async function hashPass(text) {
  const data = new TextEncoder().encode(text)
  const buf = await crypto.subtle.digest('SHA-256', data)
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

export const randomPin = () => {
  const a = new Uint32Array(1)
  crypto.getRandomValues(a)
  return String(a[0] % 10000).padStart(4, '0')
}
