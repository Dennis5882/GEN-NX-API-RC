import { uiClass } from '@/styles/component-classes'
import { llmActive, setCode, setLang } from '../agent/session'
import { CODE_IDS, type CodeId } from '../codes'
import { LANG_DEFS, t, type Lang } from '../i18n'
import { useStore } from '../state/store'
import { Button } from './ui/button'
import { HintButton } from './ui/hint-button'
import { NativeSelect } from './ui/native-select'
import { cn } from '../lib/utils'
import { headerClass, gearClass, selectClass } from './ui/chrome'

export function Header({ onOpenMapi, onOpenLlm }: { onOpenMapi(): void; onOpenLlm(): void }) {
  const s = useStore()
  const connTxt = s.connected ? t('conn_linked') : s.connErr ? t('conn_failed') : t('conn_unlinked')

  return (
    <header className={uiClass(cn(headerClass, 'max-[640px]:flex-wrap max-[640px]:gap-x-[8px] max-[640px]:gap-y-[6px] max-[640px]:px-[12px] max-[640px]:py-[8px]'))}>
      <div className={uiClass("max-[640px]:hidden flex size-[36px] items-center justify-center bg-[linear-gradient(135deg,#ec1c2e_0%,#c80f25_100%)] font-sans text-[.72rem] font-bold tracking-[.3px] text-white shadow-[0_2px_9px_rgba(200,15,37,.4)] [clip-path:polygon(0_0,calc(100%_-_9px)_0,100%_9px,100%_100%,9px_100%,0_calc(100%_-_9px))]")}>GEN</div>
      <h1 className={uiClass("max-[640px]:basis-[calc(100%_-_96px)] text-[.98rem] font-semibold tracking-[.3px]")}>
        {t('app_title')}
        <small className={uiClass("mt-[2px] block text-[.64rem] font-normal tracking-[1.5px] text-muted-foreground uppercase")}>{t('subtitle')}</small>
      </h1>
      <div className={uiClass("flex-1 max-[640px]:hidden")} />
      <div className={uiClass("mr-[4px] flex items-center max-[640px]:order-3")}>
        <NativeSelect plain className={uiClass(selectClass)} value={s.lang} onChange={e => setLang(e.target.value as Lang)} aria-label="Language">
          {LANG_DEFS.map(d => <option key={d.code} value={d.code}>{d.label}</option>)}
        </NativeSelect>
      </div>
      {/* 설계기준 — UI 언어와 독립. 이후 새로 만드는 모델에 적용 */}
      <div className={uiClass("mr-[4px] flex items-center max-[640px]:order-4")} title={t('code_label')}>
        <NativeSelect plain className={uiClass(selectClass)} value={s.code} onChange={e => setCode(e.target.value as CodeId)} aria-label={t('code_label')}>
          {CODE_IDS.map(id => <option key={id} value={id}>{t(`code_${id}`)}</option>)}
        </NativeSelect>
      </div>
      <Button variant="plain" size="plain" aria-label={connTxt} title={connTxt} className={uiClass("max-[640px]:order-5 max-[640px]:px-[8px] max-[640px]:[&>span:last-child]:hidden flex cursor-pointer items-center gap-[7px] whitespace-nowrap rounded-[20px] border border-border bg-transparent px-[11px] py-[5px] font-mono text-[.7rem] text-[var(--txt-2)] transition-colors duration-200 hover:border-[var(--dim)] hover:text-[var(--txt-hi)]")} onClick={onOpenMapi}>
        <span className={uiClass(cn('size-[7px] rounded-full bg-[var(--dim)] transition-colors duration-300', s.connected && 'bg-[var(--green)] shadow-[0_0_8px_var(--green)]', s.connErr && 'bg-[var(--red)] shadow-[0_0_8px_var(--red)]'))} />
        <span>{connTxt}</span>
      </Button>
      <HintButton hint={t('set_title')} variant="plain" size="plain" id="gearBtn" className={uiClass(cn(gearClass, "max-[640px]:order-1"), "gearBtn")} onClick={onOpenMapi} aria-label={t('set_title')}>⚙</HintButton>
      <HintButton hint={t('ai_section')} variant="plain" size="plain" id="llmGear"
        className={uiClass(cn(gearClass, 'max-[640px]:order-2 text-[.75rem] font-semibold tracking-[.5px]', llmActive() && 'text-primary'), "llmGear")}
        onClick={onOpenLlm}
        title={t('ai_section')}
      >AI</HintButton>
    </header>
  )
}
