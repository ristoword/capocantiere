import { useEffect, useState } from 'react'
import { useT } from '../lib/i18n'

interface InstallEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

const standalone = () =>
  typeof window !== 'undefined' && (window.matchMedia?.('(display-mode: standalone)').matches || (navigator as { standalone?: boolean }).standalone === true)

/** Installazione come app: bottone vero quando il browser lo permette, altrimenti istruzioni (iPhone/iPad e altri browser). */
export function InstallApp() {
  const t = useT()
  const [event, setEvent] = useState<InstallEvent | null>(null)
  const [installed, setInstalled] = useState(standalone())
  useEffect(() => {
    const onPrompt = (e: Event) => {
      e.preventDefault()
      setEvent(e as InstallEvent)
    }
    const onDone = () => setInstalled(true)
    window.addEventListener('beforeinstallprompt', onPrompt)
    window.addEventListener('appinstalled', onDone)
    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt)
      window.removeEventListener('appinstalled', onDone)
    }
  }, [])
  const ios = /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
  return (
    <section className="card stack" style={{ marginBottom: '1rem' }}>
      <h2>📲 {t('install.title')}</h2>
      <p className="help">{t('install.help')}</p>
      {installed ? (
        <p className="banner">{t('install.installed')}</p>
      ) : event ? (
        <div className="inline-actions">
          <button
            type="button"
            className="btn solid"
            onClick={async () => {
              await event.prompt()
              if ((await event.userChoice).outcome === 'accepted') setInstalled(true)
              setEvent(null)
            }}
          >
            {t('install.btn')}
          </button>
        </div>
      ) : (
        <p className="help">{ios ? t('install.ios') : t('install.generic')}</p>
      )}
    </section>
  )
}
