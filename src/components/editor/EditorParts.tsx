/* 편집 카드 공용 부품 — 번호 섹션(접힘 요약) · 분절 버튼 · 스위치 행.
   기존 .plan-editor 스타일 계약(pe-grid·pe-f)은 그대로 두고, 이 부품만 Tailwind 로 스타일한다. */
import { ChevronDown, CircleCheck, TriangleAlert } from 'lucide-react'
import { Collapsible } from 'radix-ui'
import { useId, useState, type ReactNode } from 'react'
import { cn } from '@/lib/utils'
import { t } from '../../i18n'
import { Switch } from '../ui/switch'

/** 번호 원 + 제목 + (접혔을 때) 한 줄 요약 + 펼침 화살표 */
export function EditorSection({ num, title, summary, missing = [], defaultOpen, children }: {
  num: number; title: string; summary?: ReactNode; missing?: string[]; defaultOpen?: boolean; children: ReactNode
}) {
  const [open, setOpen] = useState(!!defaultOpen)
  return (
    <Collapsible.Root open={open} onOpenChange={setOpen} data-slot="editor-section"
      className="mt-[10px] overflow-hidden rounded-[10px] border border-[var(--border)] bg-[var(--panel2)] first:mt-0">
      <Collapsible.Trigger
        className="flex w-full cursor-pointer items-center gap-[10px] border-0 bg-transparent px-[12px] py-[9px] text-left font-[inherit] text-[var(--txt)]">
        <span className="grid size-[22px] shrink-0 place-items-center rounded-full bg-[var(--cyan)] text-[.72rem] font-bold text-[var(--bg)]">{num}</span>
        <span className="text-[.86rem] font-semibold">{title}</span>
        {missing.length > 0 && <TriangleAlert aria-label={t('pe_req_missing')} className="size-[14px] shrink-0 text-[var(--amber)]" />}
        {!open && summary != null && summary !== '' && (
          <span className="ml-auto min-w-0 truncate text-right text-[.72rem] text-[var(--muted)]">{summary}</span>
        )}
        <ChevronDown aria-hidden className={cn('size-4 shrink-0 text-[var(--muted)] transition-transform', open ? 'rotate-180' : '', !open && summary ? '' : 'ml-auto')} />
      </Collapsible.Trigger>
      <Collapsible.Content className="border-t border-[var(--border)] px-[12px] pt-[10px] pb-[12px]">
        {children}
        <RequiredStatus missing={missing} />
      </Collapsible.Content>
    </Collapsible.Root>
  )
}

/** 2~4개 선택지를 한 줄 버튼으로 — 좁은 화면에서는 줄바꿈 */
export function Segmented({ value, options, onChange, label }: {
  value: string; options: { value: string; label: string }[]; onChange(v: string): void; label?: string
}) {
  return (
    <div role="radiogroup" aria-label={label} className="flex w-full flex-wrap overflow-hidden rounded-[6px] border border-[var(--border)] bg-[var(--bg)]">
      {options.map((o, i) => {
        const on = o.value === value
        return (
          <button key={o.value} type="button" role="radio" aria-checked={on} onClick={() => onChange(o.value)}
            className={cn(
              'min-w-[64px] flex-1 cursor-pointer border-0 px-[8px] py-[6px] font-[inherit] text-[.78rem] transition-colors',
              i > 0 ? 'border-l border-l-[var(--border)]' : '',
              on ? 'bg-[var(--cyan)] font-semibold text-[var(--bg)]' : 'bg-transparent text-[var(--txt)] hover:bg-[var(--panel2)]',
            )}>
            {o.label}
          </button>
        )
      })}
    </div>
  )
}

/** 켜기/끄기 — 스위치 + 라벨 + 현재 상태(켬/끔) */
export function SwitchRow({ checked, onChange, label }: { checked: boolean; onChange(v: boolean): void; label: ReactNode }) {
  const id = useId()
  return (
    <div className="flex items-center gap-[10px]">
      <Switch id={id} checked={checked} onCheckedChange={onChange} />
      <label htmlFor={id} className="cursor-pointer text-[.82rem] font-semibold text-[var(--cyan)]">{label}</label>
      <span className="text-[.72rem] text-[var(--muted)]">{checked ? t('pe_on') : t('pe_off')}</span>
    </div>
  )
}

/** 섹션 하단 — 필수 항목이 모두 입력되었는지, 아니면 무엇이 비었는지 */
export function RequiredStatus({ missing }: { missing: string[] }) {
  const ok = missing.length === 0
  return (
    <div role="status" data-required={ok ? 'ok' : 'missing'}
      className={cn('mt-[12px] flex items-center justify-end gap-[6px] text-[.74rem]', ok ? 'text-[var(--green,#2f9e6f)]' : 'text-[var(--amber)]')}>
      {ok ? <CircleCheck aria-hidden className="size-[15px]" /> : <TriangleAlert aria-hidden className="size-[15px]" />}
      <span>{ok ? t('pe_req_ok') : `${t('pe_req_missing')}: ${missing.join(', ')}`}</span>
    </div>
  )
}
