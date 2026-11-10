// Small, browser-safe hash (FNV-1a, 64 bits as two 32-bit halves). Used to fingerprint days; not for security.
export function hashOf(x) {
  const s = typeof x === 'string' ? x : JSON.stringify(x)
  let a = 0x811c9dc5
  let b = 0x01000193
  for (let i = 0; i < s.length; i++) {
    a = Math.imul(a ^ s.charCodeAt(i), 0x01000193) >>> 0
    b = Math.imul(b ^ s.charCodeAt(i), 0x85ebca6b) >>> 0
  }
  return a.toString(16).padStart(8, '0') + b.toString(16).padStart(8, '0')
}
