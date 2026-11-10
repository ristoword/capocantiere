// API di Capocantiere: account, sessioni, dati persistenti (progetti, foto, listino, profilo), limiti d'uso.
import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { openDatabase } from './db.mjs'
import { clientIp, createLimiter, fail, parseCookies, readJson, readRaw, send } from './http.mjs'
import { createAiMiddleware } from './aiProxy.mjs'
import { listBackups, makeBackup } from './backup.mjs'

const COOKIE = 'cc_session'
const SESSION_DAYS = 30
const ID = /^[A-Za-z0-9_-]{1,80}$/
const EMAIL = /^[^\s@]{1,64}@[^\s@]{1,190}\.[^\s@]{2,}$/
const MB = 1024 * 1024

const num = (value, fallback) => {
  const parsed = Number(value)
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback
}

// scrypt gira nel pool di thread di Node: non blocca le altre richieste.
const scrypt = (password, salt, length) =>
  new Promise((resolve, reject) => crypto.scrypt(password, salt, length, (error, key) => (error ? reject(error) : resolve(key))))

export async function hashPassword(password) {
  const salt = crypto.randomBytes(16)
  const hash = await scrypt(password, salt, 64)
  return `scrypt$${salt.toString('hex')}$${hash.toString('hex')}`
}

export async function verifyPassword(password, stored) {
  const [scheme, saltHex, hashHex] = String(stored).split('$')
  if (scheme !== 'scrypt' || !saltHex || !hashHex) return false
  const expected = Buffer.from(hashHex, 'hex')
  const actual = await scrypt(password, Buffer.from(saltHex, 'hex'), expected.length)
  return crypto.timingSafeEqual(actual, expected)
}

const sha = (value) => crypto.createHash('sha256').update(value).digest('hex')
const safeEqual = (a, b) => {
  const left = Buffer.from(String(a))
  const right = Buffer.from(String(b))
  return left.length === right.length && crypto.timingSafeEqual(left, right)
}

// Prezzi indicativi in USD per milione di token (ingresso, uscita). Modificabili con COST_IN_PER_M / COST_OUT_PER_M.
const RATES = [
  ['gpt-4o-mini', 0.15, 0.6],
  ['gpt-4o', 2.5, 10],
  ['gpt-4.1-mini', 0.4, 1.6],
  ['gpt-4.1', 2, 8],
]

export function estimateCost(env, usage) {
  if (usage.kind === 'image') return num(env.IMAGE_COST_USD, 0.01)
  const model = String(usage.model || '')
  const found = RATES.find(([prefix]) => model.startsWith(prefix)) ?? ['', 2.5, 10]
  const inRate = num(env.COST_IN_PER_M, found[1])
  const outRate = num(env.COST_OUT_PER_M, found[2])
  return (usage.tokensIn * inRate + usage.tokensOut * outRate) / 1_000_000
}

export function createApi(env, options = {}) {
  const db = options.db ?? openDatabase(path.resolve(env.DATA_DIR || './data', 'capocantiere.db'))
  const send_mail = options.sendMail ?? sendMail
  const dataDir = path.resolve(env.DATA_DIR || './data')
  const backupDir = path.join(dataDir, 'backups')
  const ai = createAiMiddleware(env, {
    onUsage(req, usage) {
      const user = req.ccUser
      if (!user) return
      q.spendAdd.run(user.id, today(), usage.kind, usage.tokensIn, usage.tokensOut, estimateCost(env, usage), usage.tokensIn, usage.tokensOut, estimateCost(env, usage))
    },
  })
  const limiter = createLimiter()
  const inviteCode = String(env.INVITE_CODE || '').trim()
  const signupOpen = String(env.SIGNUP_OPEN || '').toLowerCase() === 'true'
  const limits = {
    ai: num(env.AI_DAILY_LIMIT, 150),
    image: num(env.IMAGE_DAILY_LIMIT, 40),
    video: num(env.VIDEO_DAILY_LIMIT, 200),
  }
  // Foto + fascicoli. Il limite tiene l'export JSON (base64) entro dimensioni gestibili in memoria.
  const storageLimit = num(env.STORAGE_LIMIT_MB, 120) * MB
  // Account senza quote giornaliere né limite di spazio (restano burst, richieste in parallelo e budget mensile globale).
  const unlimited = new Set(String(env.UNLIMITED_EMAILS || '').split(',').map((e) => e.trim().toLowerCase()).filter(Boolean))
  const isUnlimited = (user) => unlimited.has(String(user.email || '').toLowerCase())
  const storageLimitFor = (user) => (isUnlimited(user) ? Number.MAX_SAFE_INTEGER / 2 : storageLimit)
  const mailReady = Boolean((env.RESEND_API_KEY || options.sendMail) && env.APP_URL)
  const inflight = new Map()
  const nowIso = () => new Date().toISOString()
  const today = () => new Date().toISOString().slice(0, 10)

  const q = {
    userCount: db.prepare('SELECT COUNT(*) AS n FROM users'),
    userByEmail: db.prepare('SELECT * FROM users WHERE email = ?'),
    userById: db.prepare('SELECT * FROM users WHERE id = ?'),
    insertUser: db.prepare('INSERT INTO users (id, email, name, pass_hash, is_admin, created_at) VALUES (?, ?, ?, ?, ?, ?)'),
    setPassword: db.prepare('UPDATE users SET pass_hash = ? WHERE id = ?'),
    deleteUser: db.prepare('DELETE FROM users WHERE id = ?'),
    insertSession: db.prepare('INSERT INTO sessions (token_hash, user_id, created_at, expires_at) VALUES (?, ?, ?, ?)'),
    sessionUser: db.prepare(
      'SELECT u.* FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.token_hash = ? AND s.expires_at > ?',
    ),
    deleteSession: db.prepare('DELETE FROM sessions WHERE token_hash = ?'),
    deleteUserSessions: db.prepare('DELETE FROM sessions WHERE user_id = ?'),
    purgeSessions: db.prepare('DELETE FROM sessions WHERE expires_at <= ?'),
    projects: db.prepare('SELECT data FROM projects WHERE user_id = ? ORDER BY updated_at DESC'),
    putProject: db.prepare(
      'INSERT INTO projects (user_id, id, data, updated_at) VALUES (?, ?, ?, ?) ON CONFLICT(user_id, id) DO UPDATE SET data = excluded.data, updated_at = excluded.updated_at',
    ),
    deleteProject: db.prepare('DELETE FROM projects WHERE user_id = ? AND id = ?'),
    deleteProjectPhotos: db.prepare('DELETE FROM photos WHERE user_id = ? AND project_id = ?'),
    photoList: db.prepare(
      'SELECT id, project_id, phase_id, name, mime, created_at FROM photos WHERE user_id = ? AND project_id = ? ORDER BY created_at',
    ),
    photoGet: db.prepare('SELECT mime, data FROM photos WHERE user_id = ? AND id = ?'),
    putPhoto: db.prepare(
      'INSERT INTO photos (user_id, id, project_id, phase_id, name, mime, created_at, data) VALUES (?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT(user_id, id) DO UPDATE SET project_id = excluded.project_id, phase_id = excluded.phase_id, name = excluded.name, mime = excluded.mime, created_at = excluded.created_at, data = excluded.data',
    ),
    photoBytes: db.prepare('SELECT COALESCE(SUM(LENGTH(data)), 0) AS n FROM photos WHERE user_id = ?'),
    projectBytes: db.prepare('SELECT COALESCE(SUM(LENGTH(data)), 0) AS n FROM projects WHERE user_id = ?'),
    adminCount: db.prepare('SELECT COUNT(*) AS n FROM users WHERE is_admin = 1'),
    allPhotos: db.prepare('SELECT id, project_id, phase_id, name, mime, created_at, data FROM photos WHERE user_id = ?'),
    setProfile: db.prepare('UPDATE users SET profile = ? WHERE id = ?'),
    setPrices: db.prepare('UPDATE users SET prices = ? WHERE id = ?'),
    setName: db.prepare('UPDATE users SET name = ? WHERE id = ?'),
    spendAdd: db.prepare(
      'INSERT INTO spend (user_id, day, kind, calls, tokens_in, tokens_out, cost) VALUES (?, ?, ?, 1, ?, ?, ?) ON CONFLICT(user_id, day, kind) DO UPDATE SET calls = calls + 1, tokens_in = tokens_in + ?, tokens_out = tokens_out + ?, cost = cost + ?',
    ),
    monthCost: db.prepare('SELECT COALESCE(SUM(cost), 0) AS n FROM spend WHERE day >= ?'),
    overview: db.prepare(
      `SELECT u.id, u.email, u.name, u.is_admin, u.created_at,
        (SELECT COUNT(*) FROM projects p WHERE p.user_id = u.id) AS projects,
        (SELECT COALESCE(SUM(LENGTH(data)), 0) FROM photos f WHERE f.user_id = u.id) AS photo_bytes,
        (SELECT COALESCE(SUM(calls), 0) FROM spend s WHERE s.user_id = u.id AND s.day >= ?) AS calls,
        (SELECT COALESCE(SUM(cost), 0) FROM spend s WHERE s.user_id = u.id AND s.day >= ?) AS cost
       FROM users u ORDER BY u.created_at`,
    ),
    daily: db.prepare('SELECT day, SUM(calls) AS calls, SUM(cost) AS cost FROM spend WHERE day >= ? GROUP BY day ORDER BY day'),
    insertReset: db.prepare('INSERT OR REPLACE INTO reset_tokens (token_hash, user_id, expires_at) VALUES (?, ?, ?)'),
    resetGet: db.prepare('SELECT user_id FROM reset_tokens WHERE token_hash = ? AND expires_at > ?'),
    resetDelete: db.prepare('DELETE FROM reset_tokens WHERE token_hash = ?'),
    resetDeleteUser: db.prepare('DELETE FROM reset_tokens WHERE user_id = ?'),
    usageGet: db.prepare('SELECT count FROM usage WHERE user_id = ? AND day = ? AND kind = ?'),
    usageAdd: db.prepare(
      'INSERT INTO usage (user_id, day, kind, count) VALUES (?, ?, ?, 1) ON CONFLICT(user_id, day, kind) DO UPDATE SET count = count + 1',
    ),
  }

  const publicUser = (user) => ({ id: user.id, email: user.email, name: user.name, isAdmin: user.is_admin === 1 })

  function makeResetToken(userId) {
    const token = crypto.randomBytes(24).toString('base64url')
    q.insertReset.run(sha(token), userId, Date.now() + 3600 * 1000)
    return token
  }

  function signupMode() {
    if (inviteCode) return 'invite'
    if (signupOpen || q.userCount.get().n === 0) return 'open'
    return 'closed'
  }

  function startSession(req, res, userId) {
    const token = crypto.randomBytes(32).toString('hex')
    const maxAge = SESSION_DAYS * 24 * 3600
    q.insertSession.run(sha(token), userId, nowIso(), Date.now() + maxAge * 1000)
    const secure = String(req.headers['x-forwarded-proto'] || '') === 'https' ? '; Secure' : ''
    res.setHeader('Set-Cookie', `${COOKIE}=${token}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${maxAge}${secure}`)
  }

  function endSessionCookie(res) {
    res.setHeader('Set-Cookie', `${COOKIE}=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0`)
  }

  function currentUser(req) {
    const token = parseCookies(req.headers.cookie)[COOKIE]
    if (!token) return null
    return q.sessionUser.get(sha(token), Date.now()) ?? null
  }

  const budget = num(env.MONTHLY_BUDGET_USD, 0)
  const monthStart = () => `${today().slice(0, 7)}-01`
  const overBudget = () => budget > 0 && q.monthCost.get(monthStart()).n >= budget

  const usedBytes = (userId) => q.photoBytes.get(userId).n + q.projectBytes.get(userId).n

  function consume(user, kind) {
    if (isUnlimited(user)) return true
    const used = q.usageGet.get(user.id, today(), kind)?.count ?? 0
    if (used >= limits[kind]) return false
    q.usageAdd.run(user.id, today(), kind)
    return true
  }

  async function auth(req, res, route) {
    const ip = clientIp(req)
    if (route !== 'me') {
      const guard = limiter(`auth:${ip}`, 15, 15 * 60 * 1000)
      if (!guard.ok) {
        res.setHeader('Retry-After', String(guard.retryAfter))
        return fail(res, 429, 'Troppi tentativi. Riprova tra qualche minuto.')
      }
    }
    if (route === 'me' && req.method === 'GET') {
      const user = currentUser(req)
      return send(res, 200, { user: user ? publicUser(user) : null, signup: signupMode(), aiConfigured: Boolean(env.OPENAI_API_KEY) })
    }
    if (route === 'register' && req.method === 'POST') {
      const body = await readJson(req, 20000)
      const mode = signupMode()
      if (mode === 'closed') return fail(res, 403, 'Le registrazioni sono chiuse. Chiedi un invito al proprietario.')
      if (mode === 'invite' && !safeEqual(String(body.invite || '').trim(), inviteCode)) {
        return fail(res, 403, 'Codice di invito errato.')
      }
      const email = String(body.email || '').trim().toLowerCase()
      const password = String(body.password || '')
      const name = String(body.name || '').trim().slice(0, 80)
      if (!EMAIL.test(email)) return fail(res, 400, 'Email non valida.')
      if (password.length < 8 || password.length > 200) return fail(res, 400, 'La password deve avere almeno 8 caratteri.')
      if (q.userByEmail.get(email)) return fail(res, 409, 'Esiste già un account con questa email.')
      const id = crypto.randomUUID()
      const first = q.userCount.get().n === 0
      q.insertUser.run(id, email, name, await hashPassword(password), first ? 1 : 0, nowIso())
      startSession(req, res, id)
      return send(res, 201, { user: publicUser(q.userById.get(id)) })
    }
    if (route === 'login' && req.method === 'POST') {
      const body = await readJson(req, 20000)
      const email = String(body.email || '').trim().toLowerCase()
      // Limite per coppia (email, IP): chi sbaglia non può bloccare l'account dall'esterno da altri indirizzi.
      const perPair = limiter(`login:${email}:${ip}`, 8, 15 * 60 * 1000)
      const perAccount = limiter(`login-acct:${email}`, 40, 15 * 60 * 1000)
      if (!perPair.ok || !perAccount.ok) {
        res.setHeader('Retry-After', String(Math.max(perPair.retryAfter, perAccount.retryAfter)))
        return fail(res, 429, 'Troppi tentativi su questo account. Riprova tra qualche minuto.')
      }
      const user = q.userByEmail.get(email)
      // Costo uguale con utente inesistente, per non rivelare quali email sono registrate.
      const ok = user ? await verifyPassword(String(body.password || ''), user.pass_hash) : (await hashPassword('x'), false)
      if (!user || !ok) return fail(res, 401, 'Email o password errate.')
      startSession(req, res, user.id)
      return send(res, 200, { user: publicUser(user) })
    }
    if (route === 'forgot' && req.method === 'POST') {
      const body = await readJson(req, 20000)
      const email = String(body.email || '').trim().toLowerCase()
      const user = q.userByEmail.get(email)
      if (user && mailReady) {
        const token = makeResetToken(user.id)
        const base = String(env.APP_URL).replace(/\/$/, '') // mai l'intestazione Host: sarebbe falsificabile
        // Senza attendere: i tempi di risposta non devono rivelare se l'email è registrata.
        void send_mail(env, {
          to: user.email,
          subject: 'Reimposta la password di Capocantiere',
          text: `Per scegliere una nuova password apri questo link (valido 1 ora):\n${base}/reset?token=${token}\n\nSe non l'hai richiesto, ignora questa email.`,
        }).catch(() => undefined)
      }
      // Stessa risposta in ogni caso: non rivela se l'email è registrata.
      return send(res, 200, { ok: true, emailEnabled: mailReady })
    }
    if (route === 'reset' && req.method === 'POST') {
      const body = await readJson(req, 20000)
      const hash = sha(String(body.token || ''))
      const row = q.resetGet.get(hash, Date.now())
      const password = String(body.password || '')
      if (!row) return fail(res, 400, 'Link scaduto o non valido. Richiedine uno nuovo.')
      if (password.length < 8 || password.length > 200) return fail(res, 400, 'La password deve avere almeno 8 caratteri.')
      q.setPassword.run(await hashPassword(password), row.user_id)
      q.deleteUserSessions.run(row.user_id)
      q.resetDeleteUser.run(row.user_id) // invalida anche gli altri link ancora validi
      return send(res, 200, { ok: true })
    }
    if (route === 'logout' && req.method === 'POST') {
      const token = parseCookies(req.headers.cookie)[COOKIE]
      if (token) q.deleteSession.run(sha(token))
      endSessionCookie(res)
      return send(res, 200, { ok: true })
    }
    return fail(res, 404, 'Percorso non trovato')
  }

  // Il logo deve essere un'immagine incorporata: mai un indirizzo esterno (tracciamento) né altro tipo di dato.
  function cleanProfile(profile) {
    if (typeof profile.logo === 'string' && (!/^data:image\/(png|jpeg|webp);base64,/.test(profile.logo) || profile.logo.length > 400_000)) profile.logo = ''
    else if (typeof profile.logo !== 'string' && 'logo' in profile) profile.logo = ''
    return profile
  }

  function projectsOk(value) {
    return value && typeof value === 'object' && typeof value.id === 'string' && ID.test(value.id) && typeof value.updatedAt === 'string'
  }

  function insertPhoto(userId, meta, bytes) {
    if (!ID.test(String(meta.id)) || !ID.test(String(meta.projectId))) throw Object.assign(new Error('Foto non valida'), { status: 400 })
    const mime = /^image\/(jpeg|png|webp|gif)$/.test(String(meta.mime)) ? String(meta.mime) : 'image/jpeg'
    q.putPhoto.run(
      userId,
      String(meta.id),
      String(meta.projectId),
      meta.phaseId ? String(meta.phaseId).slice(0, 80) : null,
      String(meta.name || 'foto').slice(0, 160),
      mime,
      String(meta.createdAt || nowIso()).slice(0, 40),
      bytes,
    )
  }

  async function data(req, res, user, parts) {
    const [kind, id, sub] = parts
    const method = req.method
    if (kind === 'projects') {
      if (!id && method === 'GET') {
        return send(res, 200, { projects: q.projects.all(user.id).map((row) => JSON.parse(row.data)) })
      }
      if (id && !ID.test(id)) return fail(res, 400, 'Identificativo non valido')
      if (id && sub === 'photos' && method === 'GET') {
        const photos = q.photoList.all(user.id, id).map((row) => ({
          id: row.id,
          projectId: row.project_id,
          phaseId: row.phase_id,
          name: row.name,
          mime: row.mime,
          createdAt: row.created_at,
        }))
        return send(res, 200, { photos })
      }
      if (id && !sub && method === 'PUT') {
        const body = await readJson(req, 4 * MB)
        if (!projectsOk(body) || body.id !== id) return fail(res, 400, 'Fascicolo non valido')
        const json = JSON.stringify(body)
        if (usedBytes(user.id) + json.length > storageLimitFor(user) + 20 * MB) return fail(res, 413, 'Spazio esaurito: elimina qualche lavoro o scarica un backup.')
        q.putProject.run(user.id, id, json, body.updatedAt)
        return send(res, 200, { ok: true })
      }
      if (id && !sub && method === 'DELETE') {
        q.deleteProjectPhotos.run(user.id, id)
        q.deleteProject.run(user.id, id)
        return send(res, 200, { ok: true })
      }
    }
    if (kind === 'photos' && id && ID.test(id)) {
      if (method === 'GET') {
        const row = q.photoGet.get(user.id, id)
        if (!row) return fail(res, 404, 'Foto non trovata')
        res.statusCode = 200
        res.setHeader('Content-Type', row.mime)
        res.setHeader('Cache-Control', 'private, max-age=86400')
        return res.end(Buffer.from(row.data))
      }
      if (method === 'PUT') {
        let meta
        try {
          meta = JSON.parse(decodeURIComponent(String(req.headers['x-photo-meta'] || '{}')))
        } catch {
          return fail(res, 400, 'Dati della foto non validi')
        }
        const bytes = await readRaw(req, 15 * MB)
        if (!bytes.length) return fail(res, 400, 'Foto vuota')
        if (usedBytes(user.id) + bytes.length > storageLimitFor(user)) {
          return fail(res, 413, 'Spazio foto esaurito. Elimina qualche lavoro o scarica un backup.')
        }
        insertPhoto(user.id, { ...meta, id, mime: req.headers['content-type'] }, bytes)
        return send(res, 200, { ok: true })
      }
    }
    if ((kind === 'profile' || kind === 'prices') && !id) {
      const column = kind
      if (method === 'GET') return send(res, 200, { [kind]: JSON.parse(user[column] || '{}') })
      if (method === 'PUT') {
        const body = await readJson(req, kind === 'profile' ? 1 * MB : 100000)
        if (!body || typeof body !== 'object' || Array.isArray(body)) return fail(res, 400, 'Dati non validi')
        if (kind === 'profile') cleanProfile(body)
        ;(kind === 'profile' ? q.setProfile : q.setPrices).run(JSON.stringify(body), user.id)
        return send(res, 200, { ok: true })
      }
    }
    if (kind === 'export' && method === 'GET') {
      const photos = q.allPhotos.all(user.id).map((row) => ({
        id: row.id,
        projectId: row.project_id,
        phaseId: row.phase_id,
        name: row.name,
        mime: row.mime,
        createdAt: row.created_at,
        base64: Buffer.from(row.data).toString('base64'),
      }))
      res.setHeader('Content-Disposition', `attachment; filename="capocantiere-backup-${today()}.json"`)
      return send(res, 200, {
        app: 'capocantiere',
        version: 1,
        exportedAt: nowIso(),
        profile: JSON.parse(user.profile || '{}'),
        prices: JSON.parse(user.prices || '{}'),
        projects: q.projects.all(user.id).map((row) => JSON.parse(row.data)),
        photos,
      })
    }
    if (kind === 'import' && method === 'POST') {
      const body = await readJson(req, 200 * MB)
      if (body?.app !== 'capocantiere' || !Array.isArray(body.projects)) return fail(res, 400, 'File di backup non riconosciuto.')
      let projects = 0
      let photos = 0
      db.exec('BEGIN')
      try {
        for (const project of body.projects) {
          if (!projectsOk(project)) continue
          q.putProject.run(user.id, project.id, JSON.stringify(project), project.updatedAt)
          projects += 1
        }
        let used = usedBytes(user.id)
        for (const photo of Array.isArray(body.photos) ? body.photos : []) {
          if (typeof photo?.base64 !== 'string') continue
          const bytes = Buffer.from(photo.base64, 'base64')
          if (!bytes.length || used + bytes.length > storageLimitFor(user)) continue
          insertPhoto(user.id, photo, bytes)
          used += bytes.length
          photos += 1
        }
        if (body.profile && typeof body.profile === 'object' && !Array.isArray(body.profile)) {
          cleanProfile(body.profile)
          q.setProfile.run(JSON.stringify(body.profile), user.id)
        }
        if (body.prices && typeof body.prices === 'object') q.setPrices.run(JSON.stringify(body.prices), user.id)
        db.exec('COMMIT')
      } catch (error) {
        db.exec('ROLLBACK')
        throw error
      }
      return send(res, 200, { projects, photos })
    }
    return fail(res, 404, 'Percorso non trovato')
  }

  async function account(req, res, user, route) {
    const body = await readJson(req, 20000)
    if (route === 'password' && req.method === 'POST') {
      if (!(await verifyPassword(String(body.current || ''), user.pass_hash))) return fail(res, 403, 'Password attuale errata.')
      const next = String(body.next || '')
      if (next.length < 8 || next.length > 200) return fail(res, 400, 'La nuova password deve avere almeno 8 caratteri.')
      q.setPassword.run(await hashPassword(next), user.id)
      q.deleteUserSessions.run(user.id)
      q.resetDeleteUser.run(user.id)
      startSession(req, res, user.id)
      return send(res, 200, { ok: true })
    }
    if (route === 'name' && req.method === 'POST') {
      q.setName.run(String(body.name || '').trim().slice(0, 80), user.id)
      return send(res, 200, { ok: true })
    }
    if (route === 'delete' && req.method === 'POST') {
      if (!(await verifyPassword(String(body.password || ''), user.pass_hash))) return fail(res, 403, 'Password errata.')
      if (user.is_admin && q.adminCount.get().n <= 1 && q.userCount.get().n > 1) {
        return fail(res, 409, 'Sei l’unico amministratore: non puoi cancellare l’account finché ci sono altri utenti.')
      }
      q.deleteUser.run(user.id) // le tabelle collegate si cancellano a cascata
      endSessionCookie(res)
      return send(res, 200, { ok: true })
    }
    return fail(res, 404, 'Percorso non trovato')
  }

  async function admin(req, res, user, route) {
    if (!user.is_admin) return fail(res, 403, 'Solo per l’amministratore')
    if (route === 'overview' && req.method === 'GET') {
      const since = monthStart()
      const days = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10)
      const users = q.overview.all(since, since).map((row) => ({
        id: row.id,
        email: row.email,
        name: row.name,
        isAdmin: row.is_admin === 1,
        createdAt: row.created_at,
        projects: row.projects,
        photoMb: Math.round((row.photo_bytes / MB) * 10) / 10,
        calls: row.calls,
        cost: Math.round(row.cost * 10000) / 10000,
      }))
      return send(res, 200, {
        budget,
        monthCost: Math.round(q.monthCost.get(since).n * 10000) / 10000,
        model: String(env.OPENAI_MODEL || 'gpt-4o-mini'),
        emailEnabled: Boolean(env.RESEND_API_KEY),
        users,
        days: q.daily.all(days).map((row) => ({ day: row.day, calls: row.calls, cost: Math.round(row.cost * 10000) / 10000 })),
      })
    }
    if (route === 'backups' && req.method === 'GET') {
      return send(res, 200, { backups: listBackups(backupDir) })
    }
    if (route === 'backup' && req.method === 'GET') {
      // Copia coerente del database, da scaricare e conservare fuori da Railway.
      // Copia temporanea (non entra nella rotazione dei backup automatici), inviata in streaming e poi cancellata.
      const file = makeBackup(db, path.join(dataDir, 'tmp'))
      res.statusCode = 200
      res.setHeader('Content-Type', 'application/octet-stream')
      res.setHeader('Content-Disposition', `attachment; filename="${path.basename(file)}"`)
      res.setHeader('Cache-Control', 'no-store')
      const stream = fs.createReadStream(file)
      const cleanup = () => fs.rm(file, { force: true }, () => undefined)
      stream.on('close', cleanup)
      stream.on('error', () => {
        cleanup()
        res.destroy()
      })
      stream.pipe(res)
      return
    }
    if (route === 'reset-link' && req.method === 'POST') {
      const body = await readJson(req, 20000)
      const target = q.userById.get(String(body.userId || ''))
      if (!target) return fail(res, 404, 'Utente non trovato')
      if (!env.APP_URL) return fail(res, 409, 'Imposta la variabile APP_URL (indirizzo pubblico del sito) per generare i link di reset.')
      const base = String(env.APP_URL).replace(/\/$/, '')
      return send(res, 200, { link: `${base}/reset?token=${makeResetToken(target.id)}`, email: target.email })
    }
    return fail(res, 404, 'Percorso non trovato')
  }

  async function apiMiddleware(req, res, next) {
    const url = (req.url || '').split('?')[0]
    if (!url.startsWith('/api/')) return next()
    try {
      if (req.method !== 'GET' && req.method !== 'HEAD' && req.headers['x-requested-with'] !== 'capocantiere') {
        return fail(res, 403, 'Richiesta non consentita')
      }
      if (url === '/api/health') return send(res, 200, { ok: true })
      if (url === '/api/ai/status') return ai(req, res, next)
      const parts = url.split('/').filter(Boolean).slice(1) // dopo "api"
      if (parts[0] === 'auth') return await auth(req, res, parts[1])
      const user = currentUser(req)
      if (!user) return fail(res, 401, 'Accedi per continuare.')
      if (Math.random() < 0.01) q.purgeSessions.run(Date.now())
      if (parts[0] === 'data') return await data(req, res, user, parts.slice(1))
      if (parts[0] === 'account') return await account(req, res, user, parts[1])
      if (parts[0] === 'admin') return await admin(req, res, user, parts[1])
      if (parts[0] === 'ai' || parts[0] === 'yt') {
        const kind = url === '/api/ai/image' ? 'image' : parts[0] === 'yt' ? 'video' : 'ai'
        const burst = limiter(`burst:${user.id}`, 30, 60 * 1000)
        if (!burst.ok) {
          res.setHeader('Retry-After', String(burst.retryAfter))
          return fail(res, 429, 'Troppe richieste in poco tempo. Attendi un minuto.')
        }
        if (overBudget()) return fail(res, 503, 'Il budget mensile dell’AI è esaurito. Riprova il mese prossimo o chiedi all’amministratore.')
        if (!consume(user, kind)) {
          return fail(res, 429, 'Hai raggiunto il limite giornaliero per questa funzione. Riprova domani.')
        }
        const running = inflight.get(user.id) ?? 0
        if (running >= 3) return fail(res, 429, 'Hai già richieste AI in corso: attendi che finiscano.')
        inflight.set(user.id, running + 1)
        res.on('close', () => inflight.set(user.id, Math.max(0, (inflight.get(user.id) ?? 1) - 1)))
        req.ccUser = user
        return ai(req, res, next)
      }
      return fail(res, 404, 'Percorso non trovato')
    } catch (error) {
      const status = error?.status ?? 500
      return fail(res, status, status === 500 ? 'Errore del server' : error.message)
    }
  }
  apiMiddleware.db = db
  return apiMiddleware
}

async function sendMail(env, { to, subject, text }) {
  const key = String(env.RESEND_API_KEY || '').trim()
  if (!key) throw new Error('Email non configurata')
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: env.MAIL_FROM || 'Capocantiere <onboarding@resend.dev>', to: [to], subject, text }),
  })
  if (!response.ok) throw new Error(`Invio email non riuscito (${response.status})`)
}
