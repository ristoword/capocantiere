/** Riduce le foto prima di inviarle al modello (max 1600 px, JPEG): meno costi e meno attese. */
export async function shrink(file: Blob, maxSide = 1600, quality = 0.82): Promise<Blob> {
  try {
    const bitmap = await createImageBitmap(file)
    const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height))
    if (scale === 1 && file.size < 900_000) return file
    const canvas = document.createElement('canvas')
    canvas.width = Math.round(bitmap.width * scale)
    canvas.height = Math.round(bitmap.height * scale)
    const ctx = canvas.getContext('2d')
    if (!ctx) return file
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
    const out = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', quality))
    return out ?? file
  } catch {
    return file
  }
}
