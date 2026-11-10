import type { Settings } from '../domain/types'

const KEY = 'capocantiere-settings'

export const DEFAULT_SETTINGS: Settings = {
  apiKey: '',
  baseUrl: 'https://api.openai.com/v1',
  model: 'gpt-4o-mini',
}

export type KeySource = 'env' | 'browser' | 'none'

export interface ResolvedSettings {
  settings: Settings
  source: KeySource
}

export function envConfig(): Settings {
  const key = String(import.meta.env.VITE_OPENAI_API_KEY ?? '').trim()
  const base = String(import.meta.env.VITE_OPENAI_BASE_URL ?? '').trim()
  const model = String(import.meta.env.VITE_OPENAI_MODEL ?? '').trim()
  return {
    apiKey: key,
    baseUrl: base || DEFAULT_SETTINGS.baseUrl,
    model: model || DEFAULT_SETTINGS.model,
  }
}

export function maskKey(key: string): string {
  const value = key.trim()
  if (!value) return ''
  const visible = Math.min(6, Math.max(2, value.length - 4))
  return `${value.slice(0, visible)}… · ${value.length} caratteri`
}

function asSettings(value: unknown): (Settings & { ignoreEnvKey?: boolean }) | null {
  if (!value || typeof value !== 'object') return null
  const parsed = value as Partial<Settings>
  return {
    apiKey: typeof parsed.apiKey === 'string' ? parsed.apiKey : '',
    baseUrl: typeof parsed.baseUrl === 'string' ? parsed.baseUrl : '',
    model: typeof parsed.model === 'string' ? parsed.model : '',
    ignoreEnvKey: parsed.ignoreEnvKey === true,
  }
}

export function readBrowserSettings(): Settings | null {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return null
    return asSettings(JSON.parse(raw))
  } catch {
    return null
  }
}

export function interpretSettings(env: Settings, stored: Settings | null): ResolvedSettings {
  const baseUrl = stored?.baseUrl.trim() || env.baseUrl.trim() || DEFAULT_SETTINGS.baseUrl
  const model = stored?.model.trim() || env.model.trim() || DEFAULT_SETTINGS.model
  const browserKey = stored?.apiKey.trim() ?? ''
  if (browserKey) {
    return { settings: { apiKey: browserKey, baseUrl, model, ignoreEnvKey: false }, source: 'browser' }
  }
  if (stored?.ignoreEnvKey) {
    return { settings: { apiKey: '', baseUrl, model, ignoreEnvKey: true }, source: 'none' }
  }
  const envKey = env.apiKey.trim()
  if (envKey) {
    return { settings: { apiKey: envKey, baseUrl, model, ignoreEnvKey: false }, source: 'env' }
  }
  return { settings: { apiKey: '', baseUrl, model, ignoreEnvKey: false }, source: 'none' }
}

export function resolveSettings(): ResolvedSettings {
  return interpretSettings(envConfig(), readBrowserSettings())
}

export function loadSettings(): Settings {
  return resolveSettings().settings
}

export function keySource(): KeySource {
  return resolveSettings().source
}

export function saveSettings(settings: Settings): void {
  const payload: Settings = {
    apiKey: settings.apiKey.trim(),
    baseUrl: settings.baseUrl.trim() || DEFAULT_SETTINGS.baseUrl,
    model: settings.model.trim() || DEFAULT_SETTINGS.model,
    ignoreEnvKey: settings.ignoreEnvKey === true && settings.apiKey.trim().length === 0,
  }
  localStorage.setItem(KEY, JSON.stringify(payload))
}

export function forgetBrowserSettings(): void {
  localStorage.removeItem(KEY)
}

export function hasApiKey(): boolean {
  return loadSettings().apiKey.trim().length > 0
}
