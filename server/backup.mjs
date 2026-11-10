// Copie di sicurezza del database SQLite (VACUUM INTO: copia coerente anche mentre l'app lavora).
import fs from 'node:fs'
import path from 'node:path'

const stamp = (date) => date.toISOString().slice(0, 16).replace(/[-:T]/g, '')

export function makeBackup(db, dir, now = new Date()) {
  fs.mkdirSync(dir, { recursive: true })
  const file = path.join(dir, `capocantiere-${stamp(now)}.db`)
  if (fs.existsSync(file)) fs.unlinkSync(file)
  db.exec(`VACUUM INTO '${file.replace(/'/g, "''")}'`)
  return file
}

export function pruneBackups(dir, keep) {
  const files = fs
    .readdirSync(dir)
    .filter((name) => /^capocantiere-\d{12}\.db$/.test(name))
    .sort()
  const old = files.slice(0, Math.max(0, files.length - keep))
  for (const name of old) fs.unlinkSync(path.join(dir, name))
  return old
}

export function listBackups(dir) {
  if (!fs.existsSync(dir)) return []
  return fs
    .readdirSync(dir)
    .filter((name) => /^capocantiere-\d{12}\.db$/.test(name))
    .sort()
    .reverse()
    .map((name) => ({ name, bytes: fs.statSync(path.join(dir, name)).size }))
}

/** Avvia le copie periodiche. Restituisce una funzione per fermarle. */
export function startBackups(db, dataDir, env, log = console.log) {
  const hours = Number(env.BACKUP_EVERY_HOURS ?? 12)
  const keep = Number(env.BACKUP_KEEP ?? 7)
  if (!(hours > 0)) return () => undefined
  const dir = path.join(dataDir, 'backups')
  const run = () => {
    try {
      const file = makeBackup(db, dir)
      pruneBackups(dir, keep)
      log(`Backup creato: ${path.basename(file)}`)
    } catch (error) {
      log(`Backup non riuscito: ${error instanceof Error ? error.message : error}`)
    }
  }
  const first = setTimeout(run, 30_000)
  const timer = setInterval(run, hours * 3600 * 1000)
  first.unref?.()
  timer.unref?.()
  return () => {
    clearTimeout(first)
    clearInterval(timer)
  }
}
