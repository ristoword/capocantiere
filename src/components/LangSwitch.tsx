import { LANGS, setLang, useLang, useT, type Lang } from '../lib/i18n'

/** Selettore della lingua dell'app (italiano, inglese, spagnolo). */
export function LangSwitch({ compact = false }: { compact?: boolean }) {
  const lang = useLang()
  const t = useT()
  return (
    <label className={compact ? 'lang-switch compact' : 'field'}>
      {compact ? null : <span className="field-label">{t('acc.language')}</span>}
      <select aria-label={t('common.language')} value={lang} onChange={(event) => setLang(event.target.value as Lang)}>
        {LANGS.map((item) => (
          <option key={item.code} value={item.code}>
            {item.label}
          </option>
        ))}
      </select>
    </label>
  )
}
