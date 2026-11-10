// Reads where a request is from free text, including numbers written as words:
//   "building eleven unit four"        -> Building 11, Unit 4
//   "apartment two hundred five"       -> Unit 205
//   "unit one oh eight" / "four twenty" -> Unit 108 / Unit 420 (said digit by digit, like people do)
//   "bldg twenty-one"                   -> Building 21
import { DEFAULT_SITES } from './config.js'

const ONES = { zero: 0, oh: 0, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9 }
const TEENS = { ten: 10, eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15, sixteen: 16, seventeen: 17, eighteen: 18, nineteen: 19 }
const TENS = { twenty: 20, thirty: 30, forty: 40, fourty: 40, fifty: 50, sixty: 60, seventy: 70, eighty: 80, ninety: 90 }
const NUM = '(?:zero|oh|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|twenty|thirty|forty|fourty|fifty|sixty|seventy|eighty|ninety|hundred|and|\\d+[a-z]?)'
const KEY = '(building|bldg\\.?|bld|unit|apt\\.?|apartment|suite)'
const RUN = new RegExp(`\\b${KEY}(\\s+(?:number|no\\.?|#)|\\s*#)?\\s+(${NUM}(?:[\\s-]+${NUM})*)\\b`, 'gi')

// Turns a list of number words into digits. Returns the digits and how many words it used.
function wordsToDigits(tokens) {
  let out = ''
  let i = 0
  const small = (k) => {
    const w = tokens[k]?.toLowerCase()
    if (w in TENS) {
      const next = tokens[k + 1]?.toLowerCase()
      if (next in ONES && ONES[next] > 0) return { v: TENS[w] + ONES[next], n: 2 }
      return { v: TENS[w], n: 1 }
    }
    if (w in TEENS) return { v: TEENS[w], n: 1 }
    if (w in ONES) return { v: ONES[w], n: 1 }
    return null
  }
  while (i < tokens.length) {
    const w = tokens[i].toLowerCase()
    if (/^\d+[a-z]?$/.test(w)) {
      out += w.toUpperCase()
      i++
      continue
    }
    const s = small(i)
    if (!s) break
    if (s.v < 10 && tokens[i + 1]?.toLowerCase() === 'hundred') {
      let j = i + 2
      if (tokens[j]?.toLowerCase() === 'and') j++
      const rest = small(j)
      out += String(s.v * 100 + (rest ? rest.v : 0))
      i = rest ? j + rest.n : i + 2
      continue
    }
    out += String(s.v)
    i += s.n
  }
  return { digits: out, used: i }
}

export function normalizeNumbers(text) {
  return text.replace(RUN, (match, key, extra, run) => {
    const tokens = run.split(/[\s-]+/)
    const { digits, used } = wordsToDigits(tokens)
    if (!digits) return match
    const rest = tokens.slice(used).join(' ')
    return `${key} ${digits}${rest ? ` ${rest}` : ''}`
  })
}

const SITE_NAMES = DEFAULT_SITES.map((s) => s.name).sort((a, b) => b.length - a.length)
const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

export function parseLocation(text, siteNames = SITE_NAMES) {
  const t = normalizeNumbers(text)
  const b = t.match(/\b(?:building|bldg\.?|bld)\s+(\d+[A-Z]?)\b/i)
  const u = t.match(/\b(?:unit|apt\.?|apartment|suite)\s+(\d+[A-Z]?)\b/i) || t.match(/#\s*(\d+[A-Z]?)\b/)
  const site = siteNames.find((n) => new RegExp(`\\b${esc(n)}\\b`, 'i').test(t)) || null
  return { building: b ? b[1] : null, unit: u ? u[1] : null, site, normalized: t }
}

// "011" and "11" are the same building.
export const sameCode = (a, b) => a != null && b != null && String(a).replace(/^0+(?=.)/, '').toUpperCase() === String(b).replace(/^0+(?=.)/, '').toUpperCase()
