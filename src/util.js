// Small helpers shared by the staff and resident apps.
// Phone numbers: digits only, 10 of them, dashes added as you type (123-456-7890).
export const formatPhone = (v) => {
  const d = v.replace(/\D/g, '').slice(0, 10)
  return [d.slice(0, 3), d.slice(3, 6), d.slice(6)].filter(Boolean).join('-')
}

export function load(key, fallback) {
  try {
    const v = JSON.parse(localStorage.getItem(key))
    return v || fallback
  } catch {
    return fallback
  }
}
export function save(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch {
    /* private mode: fine, just don't remember */
  }
}

