import { uiClass } from '@/styles/component-classes'
/* 하단 상태 바 — 개발자·버전·업데이트일(왼쪽) + 테마 빠른 전환 버튼(오른쪽) */
import { setTheme } from '../agent/session'
import { t } from '../i18n'
import { cn } from '../lib/utils'
import { Button } from './ui/button'
import { S, THEMES, notify, useStore } from '../state/store'
import { APP_VERSION, BUILD_DATE } from '../version'
import { ReleaseNotes } from './ReleaseNotes'

/* 버튼 견본색 = 각 테마의 배경 + 강조색 (app.css 토큰과 같은 값) */
const SWATCH = {
  navy: 'bg-[linear-gradient(135deg,#08090b_50%,#6b86f0_50%)]',
  light: 'bg-[linear-gradient(135deg,#ffffff_50%,#1f3a8a_50%)]',
  cyber: 'bg-[linear-gradient(135deg,#000000_50%,#38e1d6_50%)]',
}

export function Footer() {
  const s = useStore()
  const setRn = (v: boolean) => { S.rnOpen = v; notify() }
  return (
    <footer className={uiClass("flex shrink-0 items-center gap-[10px] border-t border-border bg-card px-[14px] pt-[5px] pb-[calc(5px+env(safe-area-inset-bottom))] font-mono text-[.68rem] text-[var(--dim)]")}>
      <span className={uiClass("overflow-hidden text-ellipsis whitespace-nowrap")}><span className={uiClass("max-[640px]:hidden")}>{t('dev')} <b className={uiClass("font-semibold text-muted-foreground")}>Dennis</b> · </span><Button variant="plain" size="plain" className={uiClass("cursor-pointer border-0 bg-transparent px-[2px] font-[inherit] text-primary underline decoration-dotted underline-offset-[3px] hover:decoration-solid")} onClick={() => setRn(true)} title={t('rn_open')}>v{APP_VERSION}</Button><span className={uiClass("max-[640px]:hidden")}>{BUILD_DATE && ` (${t('updated')} : ${BUILD_DATE})`}</span></span>
      {s.rnOpen && <ReleaseNotes onClose={() => setRn(false)} />}
      <span className={uiClass("flex-1")} />
      <span className={uiClass("whitespace-nowrap max-[640px]:hidden")}>{t('theme_label')}</span>
      <div className={uiClass("flex overflow-hidden rounded-[5px] border border-border")} role="group" aria-label={t('theme_label')}>
        {THEMES.map(th => (
          <Button key={th} variant="plain" size="plain" aria-pressed={s.theme === th} className={uiClass(cn('flex cursor-pointer items-center gap-[6px] border-0 border-l border-border bg-transparent px-[10px] py-[3px] font-[inherit] whitespace-nowrap text-muted-foreground transition-[color,background] duration-[120ms] first:border-l-0 hover:bg-accent hover:text-[var(--txt-hi)]', s.theme === th && 'bg-[color-mix(in_srgb,var(--cyan)_14%,transparent)] text-[var(--txt-hi)]'))}
            onClick={() => setTheme(th)} title={t(`theme_${th}`)}>
            <span className={uiClass(cn('size-[11px] shrink-0 rounded-[3px] border border-border', SWATCH[th]))} />
            {t(`theme_s_${th}`)}
          </Button>
        ))}
      </div>
    </footer>
  )
}
