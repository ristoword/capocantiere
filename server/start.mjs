// Server di produzione: serve dist e le API. Uso: npm run build && npm start
import http from 'node:http'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createApi } from './api.mjs'
import { startBackups } from './backup.mjs'

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
const api = createApi(env)
startBackups(api.db, path.resolve(env.DATA_DIR || './data'), env)

const types = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.ico': 'image/x-icon',
  '.json': 'application/json',
  '.webmanifest': 'application/manifest+json',
  '.woff2': 'font/woff2',
}

// Politica di sicurezza dei contenuti: solo risorse proprie, più YouTube (video e miniature),
// Google Fonts e OpenAI (chiamata diretta se l'utente usa una chiave personale).
const CSP = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' https://fonts.gstatic.com",
  "img-src 'self' data: blob: https://i.ytimg.com",
  "media-src 'self' blob:",
  "frame-src https://www.youtube-nocookie.com",
  "connect-src 'self' https://api.openai.com",
  "worker-src 'self'",
  "manifest-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join('; ')

function securityHeaders(req, res) {
  res.setHeader('Content-Security-Policy', CSP)
  res.setHeader('X-Content-Type-Options', 'nosniff')
  res.setHeader('X-Frame-Options', 'DENY')
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin')
  res.setHeader('Permissions-Policy', 'camera=(self), microphone=(), geolocation=(), payment=()')
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin')
  if (String(req.headers['x-forwarded-proto'] || '') === 'https') {
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains')
  }
}

function plain(res, status, text) {
  res.statusCode = status
  res.setHeader('Content-Type', 'text/plain; charset=utf-8')
  res.end(text)
}

function serveStatic(req, res) {
  if (req.method !== 'GET' && req.method !== 'HEAD') return plain(res, 405, 'Metodo non consentito')
  let clean
  try {
    clean = decodeURIComponent((req.url || '/').split('?')[0])
  } catch {
    return plain(res, 400, 'Indirizzo non valido') // percent-encoding malformato
  }
  if (clean.includes('\0')) return plain(res, 400, 'Indirizzo non valido')
  if (clean.startsWith('/api/')) return plain(res, 404, 'Non trovato')
  let file = path.join(dist, clean)
  const inside = file === dist || file.startsWith(dist + path.sep)
  if (!inside || !fs.existsSync(file) || fs.statSync(file).isDirectory()) file = path.join(dist, 'index.html')
  const ext = path.extname(file)
  res.setHeader('Content-Type', types[ext] || 'application/octet-stream')
  if (clean.startsWith('/assets/')) res.setHeader('Cache-Control', 'public, max-age=31536000, immutable')
  else res.setHeader('Cache-Control', 'no-cache')
  const stream = fs.createReadStream(file)
  stream.on('error', () => {
    if (!res.headersSent) plain(res, 500, 'Errore del server')
    else res.destroy()
  })
  if (req.method === 'HEAD') return res.end()
  stream.pipe(res)
}

const server = http.createServer((req, res) => {
  securityHeaders(req, res)
  const fail = (error) => {
    console.error('Errore nella richiesta:', error)
    if (!res.headersSent) plain(res, 500, 'Errore del server')
    else res.destroy()
  }
  try {
    Promise.resolve(api(req, res, () => serveStatic(req, res))).catch(fail)
  } catch (error) {
    fail(error)
  }
})
server.requestTimeout = 120_000
server.headersTimeout = 20_000
server.keepAliveTimeout = 65_000

// Un errore imprevisto in una richiesta non deve spegnere il servizio.
process.on('unhandledRejection', (reason) => console.error('Promessa non gestita:', reason))
process.on('uncaughtException', (error) => console.error('Eccezione non gestita:', error))

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
