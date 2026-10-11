import { llmActive, setLang } from '../agent/session'
import { LANG_DEFS, t, type Lang } from '../i18n'
import { useStore } from '../state/store'

export function Header({ onOpenMapi, onOpenLlm }: { onOpenMapi(): void; onOpenLlm(): void }) {
  const s = useStore()
  const connTxt = s.connected ? t('conn_linked') : s.connErr ? t('conn_failed') : t('conn_unlinked')

  return (
    <header>
      <div className="mark">GEN</div>
      <h1>
        Gen NX Agent
        <span className="byline">{t('dev')} <b>Dennis</b> · v2.0.0-alpha ({t('updated')} : 2026-10-11)</span>
        <small>{t('subtitle')}</small>
      </h1>
      <div className="spacer" />
      <div className="langsel">
        <select value={s.lang} onChange={e => setLang(e.target.value as Lang)} aria-label="Language">
          {LANG_DEFS.map(d => <option key={d.code} value={d.code}>{d.label}</option>)}
        </select>
      </div>
      <div className={`pill${s.connected ? ' on' : ''}${s.connErr ? ' err' : ''}`} onClick={onOpenMapi}>
        <span className="dot" />
        <span>{connTxt}</span>
      </div>
      <div className="gear" onClick={onOpenMapi}>⚙</div>
      <div
        className={`gear${llmActive() ? ' active' : ''}`}
        onClick={onOpenLlm}
        title={t('ai_section')}
        style={{ fontSize: '.75rem', fontWeight: 600, letterSpacing: '.5px' }}
      >AI</div>
    </header>
  )
}
