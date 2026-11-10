// Ricerca video YouTube lato server. Restituisce solo video realmente trovati (id, titolo, canale): niente invenzioni.
const cache = new Map()
const TTL = 60 * 60 * 1000

function walk(node, found) {
  if (!node || typeof node !== 'object') return
  if (Array.isArray(node)) {
    for (const item of node) walk(item, found)
    return
  }
  if (node.videoRenderer && node.videoRenderer.videoId) found.push(node.videoRenderer)
  for (const value of Object.values(node)) walk(value, found)
}

function extractInitialData(html) {
  const marker = 'var ytInitialData = '
  const start = html.indexOf(marker)
  if (start < 0) return null
  const from = start + marker.length
  const end = html.indexOf(';</script>', from)
  if (end < 0) return null
  try {
    return JSON.parse(html.slice(from, end))
  } catch {
    return null
  }
}

async function viaScrape(query) {
  const response = await fetch(`https://www.youtube.com/results?search_query=${encodeURIComponent(query)}&hl=it&gl=IT`, {
    signal: AbortSignal.timeout(10_000),
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36',
      'Accept-Language': 'it-IT,it;q=0.9',
      Cookie: 'CONSENT=YES+1; SOCS=CAI',
    },
  })
  if (!response.ok) throw new Error(`YouTube ha risposto ${response.status}`)
  const data = extractInitialData(await response.text())
  if (!data) throw new Error('Risposta di YouTube non leggibile')
  const raw = []
  walk(data, raw)
  const seen = new Set()
  const videos = []
  for (const item of raw) {
    if (seen.has(item.videoId)) continue
    seen.add(item.videoId)
    if (!/^[A-Za-z0-9_-]{11}$/.test(String(item.videoId))) continue // solo identificativi YouTube validi
    const duration = item.lengthText?.simpleText || ''
    if (!duration) continue // dirette e anteprime senza durata
    videos.push({
      id: item.videoId,
      title: item.title?.runs?.map((run) => run.text).join('') || 'Video',
      channel: item.ownerText?.runs?.[0]?.text || '',
      duration,
      thumb: `https://i.ytimg.com/vi/${item.videoId}/mqdefault.jpg`,
    })
    if (videos.length >= 4) break
  }
  return videos
}

async function viaApi(query, key) {
  const url = new URL('https://www.googleapis.com/youtube/v3/search')
  url.search = new URLSearchParams({
    part: 'snippet',
    type: 'video',
    videoEmbeddable: 'true',
    maxResults: '4',
    relevanceLanguage: 'it',
    regionCode: 'IT',
    safeSearch: 'moderate',
    q: query,
    key,
  }).toString()
  const response = await fetch(url, { signal: AbortSignal.timeout(10_000) })
  const data = await response.json()
  if (!response.ok) throw new Error(data?.error?.message || `YouTube API ${response.status}`)
  return (data.items || []).filter((item) => /^[A-Za-z0-9_-]{11}$/.test(String(item.id?.videoId))).map((item) => ({
    id: item.id.videoId,
    title: item.snippet.title,
    channel: item.snippet.channelTitle,
    duration: '',
    thumb: `https://i.ytimg.com/vi/${item.id.videoId}/mqdefault.jpg`, // sempre un indirizzo YouTube noto
  }))
}

export async function searchVideos(query, env) {
  const q = String(query || '').trim().slice(0, 140)
  if (!q) throw new Error('Ricerca vuota')
  const hit = cache.get(q)
  if (hit && Date.now() - hit.at < TTL) return hit.videos
  const key = String(env.YOUTUBE_API_KEY || '').trim()
  let videos
  if (key) {
    try {
      videos = await viaApi(q, key)
    } catch {
      videos = await viaScrape(q)
    }
  } else {
    videos = await viaScrape(q)
  }
  if (videos.length) {
    if (cache.size >= 300) cache.delete(cache.keys().next().value) // la memoria non cresce senza limiti
    cache.set(q, { at: Date.now(), videos })
  }
  return videos
}
