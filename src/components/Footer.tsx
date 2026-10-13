/* 하단 상태 바 — 개발자·버전·업데이트일(왼쪽) + 테마 빠른 전환 버튼(오른쪽) */
import { setTheme } from '../agent/session'
import { t } from '../i18n'
import { S, THEMES, notify, useStore } from '../state/store'
import { APP_VERSION, BUILD_DATE } from '../version'
import { ReleaseNotes } from './ReleaseNotes'

/* 버튼 견본색 = 각 테마의 배경 + 강조색 (app.css 토큰과 같은 값) */
const SWATCH: Record<(typeof THEMES)[number], [string, string]> = {
  navy: ['#08090b', '#6b86f0'], light: ['#ffffff', '#1f3a8a'], cyber: ['#000000', '#38e1d6'],
}

export function Footer() {
  const s = useStore()
  const setRn = (v: boolean) => { S.rnOpen = v; notify() }
  return (
    <footer className="appfoot">
      <span className="byline"><span className="by-x">{t('dev')} <b>Dennis</b> · </span><button className="ver-btn" onClick={() => setRn(true)} title={t('rn_open')}>v{APP_VERSION}</button><span className="by-x">{BUILD_DATE && ` (${t('updated')} : ${BUILD_DATE})`}</span></span>
      {s.rnOpen && <ReleaseNotes onClose={() => setRn(false)} />}
      <span style={{ flex: 1 }} />
      <span className="foot-lbl">{t('theme_label')}</span>
      <div className="theme-seg" role="radiogroup" aria-label={t('theme_label')}>
        {THEMES.map(th => (
          <button key={th} role="radio" aria-checked={s.theme === th} className={s.theme === th ? 'on' : ''}
            onClick={() => setTheme(th)} title={t(`theme_${th}`)}>
            <span className="sw" style={{ background: `linear-gradient(135deg,${SWATCH[th][0]} 50%,${SWATCH[th][1]} 50%)` }} />
            {t(`theme_s_${th}`)}
          </button>
        ))}
      </div>
    </footer>
  )
}
