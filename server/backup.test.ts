import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
// @ts-expect-error modulo JS senza tipi
import { listBackups, makeBackup, pruneBackups } from './backup.mjs'
// @ts-expect-error modulo JS senza tipi
import { openDatabase } from './db.mjs'

describe('backup del database', () => {
  it('crea una copia leggibile e tiene solo le ultime', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cc-backup-'))
    const db = openDatabase(path.join(dir, 'src.db'))
    db.prepare("INSERT INTO users (id, email, name, pass_hash, created_at) VALUES ('u1', 'a@b.it', '', 'x', 'now')").run()
    const target = path.join(dir, 'backups')
    makeBackup(db, target, new Date('2026-01-01T10:00:00Z'))
    makeBackup(db, target, new Date('2026-01-02T10:00:00Z'))
    const last = makeBackup(db, target, new Date('2026-01-03T10:00:00Z'))
    expect(listBackups(target).map((item: { name: string }) => item.name)[0]).toBe('capocantiere-202601031000.db')
    expect(pruneBackups(target, 2)).toEqual(['capocantiere-202601011000.db'])
    expect(listBackups(target)).toHaveLength(2)
    const copy = openDatabase(last)
    expect(copy.prepare('SELECT email FROM users').get().email).toBe('a@b.it')
    copy.close()
    db.close()
  })
})
