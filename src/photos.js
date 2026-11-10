// Photos people attach to a request. They are shrunk in the browser (longest side 1200px)
// so they load fast on a phone. They live only in this browser tab for now: keeping them
// for everyone would need here.now storage on the team's site.
export function readPhotos(fileList) {
  const files = [...(fileList || [])].filter((f) => f.type.startsWith('image/')).slice(0, 6)
  return Promise.all(files.map(shrink))
}

function shrink(file) {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => {
      const scale = Math.min(1, 1200 / Math.max(img.width, img.height))
      const c = document.createElement('canvas')
      c.width = Math.round(img.width * scale)
      c.height = Math.round(img.height * scale)
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height)
      URL.revokeObjectURL(url)
      resolve({ name: file.name, src: c.toDataURL('image/jpeg', 0.8) })
    }
    img.onerror = () => resolve({ name: file.name, src: url })
    img.src = url
  })
}
