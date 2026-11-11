// Photos people attach to a request. They are shrunk in the browser (longest side 1000px)
// so they load fast on a phone, then saved in small pieces so they fit here.now Site Data and
// reach supervisors and technicians on the team's site. On test links they last until reload.
const CHUNK = 14000

export function readPhotos(fileList) {
  const files = [...(fileList || [])].filter((f) => f.type.startsWith('image/')).slice(0, 6)
  return Promise.all(files.map(shrink))
}

function shrink(file) {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => {
      const scale = Math.min(1, 1000 / Math.max(img.width, img.height))
      const c = document.createElement('canvas')
      c.width = Math.round(img.width * scale)
      c.height = Math.round(img.height * scale)
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height)
      URL.revokeObjectURL(url)
      resolve({ name: file.name, src: c.toDataURL('image/jpeg', 0.65) })
    }
    img.onerror = () => resolve(null)
    img.src = url
  })
}

// Split photos into saved pieces: one list entry per order, plus numbered pieces.
export function photoRecords(orderId, list, prevMeta = [], by = '') {
  const meta = [...prevMeta]
  const chunks = {}
  list.filter(Boolean).forEach((p, n) => {
    const v = `${Date.now().toString(36)}${n}`
    const pieces = []
    for (let i = 0; i < p.src.length; i += CHUNK) pieces.push(p.src.slice(i, i + CHUNK))
    pieces.forEach((piece, i) => {
      chunks[`${orderId}|${v}|${i}`] = piece
    })
    meta.push({ v, n: pieces.length, by, at: new Date().toISOString() })
  })
  return { meta, chunks }
}

export function assemblePhotos(photometa, photochunks) {
  const out = {}
  for (const [id, list] of Object.entries(photometa || {})) {
    out[id] = (list || [])
      .map((m) => {
        const parts = []
        for (let i = 0; i < m.n; i++) parts.push(photochunks[`${id}|${m.v}|${i}`])
        const src = parts.every((x) => typeof x === 'string') ? parts.join('') : null
        return src && src.startsWith('data:image/') ? { src, by: m.by, at: m.at } : null
      })
      .filter(Boolean)
  }
  return out
}
