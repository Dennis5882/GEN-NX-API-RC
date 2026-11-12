import { uiClass } from '@/styles/component-classes'
/* 설정은 controlled Sheet. 키 값은 기존 store 메모리에서만 다룬다. */
import { useRef, useState } from 'react'
import { PROVIDERS } from '../agent/llm'
import { setProvider, testConn, type TestOut } from '../agent/session'
import { t } from '../i18n'
import { S, notify, useStore, type Provider } from '../state/store'
import { cn } from '../lib/utils'
import { AppButton } from './ui/app-button'
import { Button } from './ui/button'
import { gearClass, headerClass } from './ui/chrome'
import { Input } from './ui/input'
import { NativeSelect } from './ui/native-select'
import { Sheet, SheetContent, SheetTitle } from './ui/sheet'
import { Switch } from './ui/switch'

export type DrawerId = 'mapi' | 'llm' | null
const inputClass = 'w-full rounded-[8px] border border-border bg-background px-[11px] py-[9px] font-mono text-[.82rem] text-foreground outline-none focus:border-primary'
const labelClass = 'mb-[6px] block font-mono text-[.74rem] tracking-[.5px] text-muted-foreground'
const hintClass = 'mt-[5px] text-[.7rem] leading-[1.5] text-[var(--dim)]'

function DrawerHead({ title, sub, onClose }: { title: string; sub?: string; onClose(): void }) {
  return <header className={uiClass(cn(headerClass, 'bg-none'))}>
    <SheetTitle className={uiClass("text-[.9rem] font-semibold tracking-[.3px]")}>{title}{sub && <small className={uiClass("mt-[2px] block text-[.64rem] font-normal tracking-[1.5px] text-muted-foreground uppercase")}>{sub}</small>}</SheetTitle>
    <div className={uiClass("flex-1")} />
    <Button variant="plain" size="plain" className={uiClass(gearClass)} onClick={onClose} aria-label={t('close')}>✕</Button>
  </header>
}

function MapiDrawer({ onClose, out, setOut }: { onClose(): void; out: TestOut | null; setOut(value: TestOut | null): void }) {
  const s = useStore()
  async function onTest() { setOut({ cls: '', text: t('test_ing') }); setOut(await testConn()) }
  return <>
    <DrawerHead title={t('set_title')} sub="MIDAS Gen NX" onClose={onClose} />
    <div className={uiClass("flex-1 overflow-y-auto p-[20px]")}>
      <div className={uiClass("mb-[18px]")}><label className={uiClass(labelClass)} htmlFor="mapiBaseUrl">BASE URL</label><Input plain id="mapiBaseUrl" className={uiClass(inputClass, "mapiBaseUrl")} value={s.baseUrl} onChange={e => { S.baseUrl = e.target.value; notify() }} /></div>
      <div className={uiClass("mb-[18px]")}><label className={uiClass(labelClass)} htmlFor="mapiKey">MAPI-KEY</label><Input plain id="mapiKey" className={uiClass(inputClass, "mapiKey")} type="password" autoComplete="off" value={s.mapiKey} placeholder={t('mapi_key_ph')} onChange={e => { S.mapiKey = e.target.value; notify() }} /><div className={uiClass(hintClass)} dangerouslySetInnerHTML={{ __html: t('mapi_hint_html') }} /></div>
      <AppButton onClick={onTest}>{t('conn_test')}</AppButton>
      {out && <div role="status" className={uiClass(cn('mt-[10px] rounded-[8px] border border-border bg-background p-[10px] font-mono text-[.74rem]', out.cls === 'ok' ? 'text-[var(--green)]' : out.cls === 'err' ? 'text-[var(--red)]' : 'text-muted-foreground'))}>{out.text}</div>}
      <div className={uiClass("mt-[16px] flex gap-[8px]")}><AppButton onClick={onClose}>{t('save')}</AppButton><AppButton variant="ghost" onClick={onClose}>{t('close')}</AppButton></div>
    </div>
  </>
}

function LlmDrawer({ onClose, custom, setCustom }: { onClose(): void; custom: boolean; setCustom(value: boolean): void }) {
  const s = useStore()
  const cfg = PROVIDERS[s.provider]
  return <>
    <DrawerHead title={t('ai_section')} onClose={onClose} />
    <div className={uiClass("flex-1 overflow-y-auto p-[20px]")}>
      <div className={uiClass("mb-[18px] flex items-center justify-between pb-[12px]")}>
        <span className={uiClass("text-[.85rem]")}>{t('llm_mode')}</span>
        <Switch checked={s.llm} onCheckedChange={checked => { S.llm = checked; notify() }} aria-label={t('llm_mode')} className={uiClass("h-[23px]! w-[42px]! border-0 bg-[var(--border)] shadow-none data-[state=checked]:bg-[color-mix(in_srgb,var(--violet)_30%,transparent)] [&_[data-slot=switch-thumb]]:size-[17px]! [&_[data-slot=switch-thumb]]:translate-x-[3px] [&_[data-slot=switch-thumb]]:bg-[var(--muted)] [&_[data-slot=switch-thumb][data-state=checked]]:translate-x-[22px]! [&_[data-slot=switch-thumb][data-state=checked]]:bg-[var(--violet)]")} />
      </div>
      <div className={uiClass("grid grid-cols-[1fr_1.4fr] gap-[10px]")}>
        <div className={uiClass("mb-[18px]")}><label className={uiClass(labelClass)} htmlFor="llmProvider">PROVIDER</label><NativeSelect plain id="llmProvider" className={uiClass(inputClass, "llmProvider")} value={s.provider} onChange={e => { setProvider(e.target.value as Provider); setCustom(false) }}>{(Object.keys(PROVIDERS) as Provider[]).map(p => <option key={p} value={p}>{PROVIDERS[p].label}</option>)}</NativeSelect></div>
        <div className={uiClass("mb-[18px]")}><label className={uiClass(labelClass)} htmlFor="llmModel">MODEL</label>{custom || !cfg.models.includes(s.provModel) && s.provModel
          ? <Input plain id="llmModel" className={uiClass(inputClass, "llmModel")} value={s.provModel} autoFocus={custom} onChange={e => { S.provModel = e.target.value; notify() }} onBlur={() => { if (!S.provModel.trim()) { S.provModel = cfg.def; setCustom(false); notify() } }} />
          : <NativeSelect plain id="llmModel" className={uiClass(inputClass, "llmModel")} value={s.provModel} onChange={e => { if (e.target.value === '__custom') { setCustom(true); return } S.provModel = e.target.value; notify() }}>{cfg.models.map(m => <option key={m} value={m}>{m}</option>)}<option value="__custom">{t('model_custom')}</option></NativeSelect>}</div>
      </div>
      <div className={uiClass("mb-[18px]")}><label className={uiClass(labelClass)} htmlFor="llmKey">{cfg.keyLabel}</label><Input plain id="llmKey" className={uiClass(inputClass, "llmKey")} type="password" autoComplete="off" value={s.provKey} placeholder={cfg.ph} onChange={e => { S.provKey = e.target.value; notify() }} /><div className={uiClass(hintClass)} dangerouslySetInnerHTML={{ __html: t(`prov_hint_${s.provider}`) }} /></div>
      <div className={uiClass("mt-[8px] flex gap-[8px]")}><AppButton onClick={onClose}>{t('save')}</AppButton><AppButton variant="ghost" onClick={onClose}>{t('close')}</AppButton></div>
    </div>
  </>
}

export function Drawers({ open, onClose }: { open: DrawerId; onClose(): void }) {
  const opener = useRef<HTMLElement | null>(null)
  const lastOpen = useRef<Exclude<DrawerId, null>>('mapi')
  if (open) lastOpen.current = open
  const kind = open ?? lastOpen.current
  const [out, setOut] = useState<TestOut | null>(null)
  const [custom, setCustom] = useState(false)
  return <Sheet open={open !== null} onOpenChange={value => { if (!value) onClose() }}>
    <SheetContent id={kind === 'mapi' ? 'drawerMapi' : 'drawerLlm'} aria-describedby={undefined} showCloseButton={false} onOpenAutoFocus={() => { opener.current = document.activeElement as HTMLElement }} onCloseAutoFocus={event => { event.preventDefault(); opener.current?.focus() }} overlayClassName="z-40 bg-[var(--scrim)] backdrop-blur-[3px]" className={uiClass("z-[41] w-[380px] max-w-[90vw] gap-0 border-l border-border bg-card p-0 shadow-[-20px_0_40px_var(--shadow)] sm:max-w-[90vw]")}>
      {kind === 'mapi' ? <MapiDrawer onClose={onClose} out={out} setOut={setOut} /> : <LlmDrawer onClose={onClose} custom={custom} setCustom={setCustom} />}
    </SheetContent>
  </Sheet>
}
