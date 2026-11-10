import type { GuideStep, Settings } from '../domain/types'
import { ModelError } from './api'

const STYLE =
  'Clean flat vector instructional illustration for a home-repair manual, friendly bright colors, one clear scene, plain light background, absolutely no text, no letters, no numbers, no labels.'

export function stepPrompt(trade: string, phaseTitle: string, step: GuideStep): string {
  const scene = step.visual?.trim() || `${step.title}. ${step.how}`
  return `${STYLE} Trade: ${trade}. Phase: ${phaseTitle}. Scene to draw: ${scene}`.slice(0, 1400)
}

/** Riduce l'immagine a 640 px JPEG: resta leggera nel database del browser. */
async function compact(b64: string): Promise<string> {
  const original = `data:image/png;base64,${b64}`
  try {
    const bitmap = await createImageBitmap(await (await fetch(original)).blob())
    const side = 640
    const canvas = document.createElement('canvas')
    canvas.width = side
    canvas.height = Math.round((bitmap.height / bitmap.width) * side)
    const ctx = canvas.getContext('2d')
    if (!ctx) return original
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
    return canvas.toDataURL('image/jpeg', 0.82)
  } catch {
    return original
  }
}

export async function generateImage(settings: Settings, prompt: string): Promise<string> {
  const key = settings.apiKey.trim()
  const direct = key.length > 0
  const base = (settings.baseUrl.trim() || 'https://api.openai.com/v1').replace(/\/$/, '')
  let response: Response
  try {
    response = await fetch(direct ? `${base}/images/generations` : '/api/ai/image', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(direct ? { Authorization: `Bearer ${key}` } : {}) },
      body: JSON.stringify(
        direct ? { model: 'gpt-image-1-mini', prompt, size: '1024x1024', quality: 'low', n: 1 } : { prompt },
      ),
    })
  } catch {
    throw new ModelError('Nessuna risposta dal servizio immagini. Controlla la rete.')
  }
  let data: { data?: { b64_json?: string }[]; error?: { message?: string } }
  try {
    data = await response.json()
  } catch {
    throw new ModelError(`Il servizio immagini ha risposto senza JSON (errore ${response.status}).`)
  }
  if (!response.ok) throw new ModelError(data.error?.message || `Errore del servizio immagini (${response.status}).`)
  const b64 = data.data?.[0]?.b64_json
  if (!b64) throw new ModelError('Il servizio non ha restituito nessuna immagine.')
  return compact(b64)
}
