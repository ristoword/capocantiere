// Server di produzione: serve dist e il proxy AI. Uso: npm run build && npm start
import http from 'node:http'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createApi } from './api.mjs'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const dist = path.join(root, 'dist')

function loadEnvFile(name) {
  const file = path.join(root, name)
  if (!fs.existsSync(file)) return {}
  const out = {}
  for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
    if (m) out[m[1]] = m[2].replace(/^["']|["']$/g, '')
  }
  return out
}

const env = { ...loadEnvFile('.env'), ...loadEnvFile('.env.local'), ...process.env }
const ai = createApi(env)
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.ico': 'image/x-icon', '.jpg': 'image/jpeg', '.woff2': 'font/woff2' }

const server = http.createServer((req, res) => {
  ai(req, res, () => {
    const clean = decodeURIComponent((req.url || '/').split('?')[0])
    let file = path.join(dist, clean)
    if (!file.startsWith(dist) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) file = path.join(dist, 'index.html')
    const ext = path.extname(file)
    res.setHeader('Content-Type', types[ext] || 'application/octet-stream')
    res.setHeader('X-Content-Type-Options', 'nosniff')
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin')
    if (clean.startsWith('/assets/')) res.setHeader('Cache-Control', 'public, max-age=31536000, immutable')
    else res.setHeader('Cache-Control', 'no-cache')
    fs.createReadStream(file).pipe(res)
  })
})
const port = Number(env.PORT || 4173)
server.listen(port, () => console.log(`Capocantiere su http://localhost:${port}`))

// Spegnimento pulito (Railway invia SIGTERM a ogni nuovo deploy): smette di accettare richieste e chiude.
for (const signal of ['SIGTERM', 'SIGINT']) {
  process.on(signal, () => {
    console.log(`${signal}: chiudo il server`)
    server.close(() => process.exit(0))
    setTimeout(() => process.exit(0), 5000).unref()
  })
}
