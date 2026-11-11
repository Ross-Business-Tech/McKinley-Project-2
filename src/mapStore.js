// Helpers for site maps uploaded in the app (see MapSetup.jsx).
const CHUNK = 14000

export function readMapImage(file) {
  return new Promise((resolve, reject) => {
    if (!file || !file.type.startsWith('image/')) return reject(new Error('Please choose an image file (PNG, JPG or WEBP).'))
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => {
      const scale = Math.min(1, 1600 / Math.max(img.width, img.height))
      const c = document.createElement('canvas')
      c.width = Math.round(img.width * scale)
      c.height = Math.round(img.height * scale)
      const g = c.getContext('2d')
      g.fillStyle = '#fff'
      g.fillRect(0, 0, c.width, c.height)
      g.drawImage(img, 0, 0, c.width, c.height)
      URL.revokeObjectURL(url)
      let q = 0.75
      let src = c.toDataURL('image/jpeg', q)
      while (src.length > 400000 && q > 0.35) {
        q -= 0.1
        src = c.toDataURL('image/jpeg', q)
      }
      resolve({ src, w: c.width, h: c.height })
    }
    img.onerror = () => reject(new Error("That image couldn't be opened."))
    img.src = url
  })
}

// Turn an image into the shared records: one "sitemaps" entry plus numbered pieces.
export function mapRecords(siteName, img, prev) {
  const pieces = []
  for (let i = 0; i < img.src.length; i += CHUNK) pieces.push(img.src.slice(i, i + CHUNK))
  const meta = { w: img.w, h: img.h, chunks: pieces.length, v: Date.now(), b: prev?.b || [], n: prev?.n || [] }
  const chunkEntries = Object.fromEntries(pieces.map((p, i) => [`${siteName}|${meta.v}|${i}`, p]))
  return { meta, chunkEntries }
}

export function assembleMaps(sitemaps, chunks) {
  const out = {}
  for (const [name, m] of Object.entries(sitemaps || {})) {
    if (!m) continue
    const parts = []
    for (let i = 0; i < m.chunks; i++) parts.push(chunks[`${name}|${m.v}|${i}`])
    if (parts.every((p) => typeof p === 'string') && parts.join('').startsWith('data:image/')) {
      out[name] = { w: m.w, h: m.h, file: parts.join(''), b: m.b || [], n: m.n || [] }
    } else {
      out[name] = { w: m.w, h: m.h, file: null, loading: true, b: m.b || [], n: m.n || [] }
    }
  }
  return out
}

