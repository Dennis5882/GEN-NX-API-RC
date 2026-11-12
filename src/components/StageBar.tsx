/* 단계 표시줄 — ① 전처리 → ② 솔버 → ③ 후처리. 상태는 색 + 아이콘 + 글자로 함께 표시(색만으로 구분하지 않음).
   클릭 = 그 단계의 기본 탭으로 이동하는 바로가기. 탭과 단계가 1:1 이 아니어서(활동 탭은 생성·해석 모두) 현재 탭을 강조하지 않음.
   상태는 앱이 실행한 동작 기준(Gen GUI 직접 변경은 모름 — title 안내). */
import { ChevronRight, Circle, CircleCheck, LoaderCircle, RefreshCw, TriangleAlert } from 'lucide-react'
import { cn } from '@/lib/utils'
import { t, type I18nKey } from '../i18n'
import { useStore, type PanelId } from '../state/store'
import { stageStatus, type StageKey, type StageStatus } from '../state/stage'
import { tab } from '../state/ui'

const STAGES: { key: StageKey; label: I18nKey; panel: PanelId }[] = [
  { key: 'pre', label: 'stage_pre', panel: 'modelP' },
  { key: 'solve', label: 'stage_solve', panel: 'logP' },
  { key: 'post', label: 'stage_post', panel: 'resP' },
]

const STATUS: Record<StageStatus, { label: I18nKey; Icon: typeof Circle; tone: string }> = {
  none: { label: 'stage_none', Icon: Circle, tone: 'text-[var(--muted)]' },
  fresh: { label: 'stage_fresh', Icon: CircleCheck, tone: 'text-[var(--green,#2f9e6f)]' },
  stale: { label: 'stage_stale', Icon: RefreshCw, tone: 'text-[var(--amber)]' },
  running: { label: 'stage_running', Icon: LoaderCircle, tone: 'text-[var(--cyan)]' },
  failed: { label: 'stage_failed', Icon: TriangleAlert, tone: 'text-[var(--red)]' },
}

export function StageBar() {
  const s = useStore()
  const v = stageStatus(s.stage)
  return (
    <nav aria-label={t('stage_nav')} title={t('stage_note')} data-slot="stage-bar"
      className="flex items-center gap-[4px] overflow-x-auto border-b border-[var(--border)] bg-[var(--panel)] px-[8px] py-[6px]">
      {STAGES.map((st, i) => {
        const status = v[st.key]
        const { label, Icon, tone } = STATUS[status]
        const sub = st.key === 'solve' && status !== 'none' && v.solveKind ? t(v.solveKind === 'dynamic' ? 'stage_kind_dynamic' : 'stage_kind_static') : ''
        return (
          <div key={st.key} className="flex min-w-0 items-center gap-[4px]">
            {i > 0 && <ChevronRight aria-hidden className="size-[14px] shrink-0 text-[var(--dim,var(--muted))]" />}
            <button type="button" onClick={() => tab(st.panel)} data-stage={st.key} data-status={status}
              aria-label={`${i + 1}. ${t(st.label)} — ${t(label)}${sub ? ' · ' + sub : ''}`}
              className="flex min-w-0 cursor-pointer items-center gap-[6px] rounded-[6px] border border-transparent bg-transparent px-[8px] py-[4px] font-[inherit] text-[.78rem] transition-colors hover:bg-[var(--panel2)] focus-visible:border-[var(--cyan)]">
              <span className="grid size-[18px] shrink-0 place-items-center rounded-full bg-[var(--cyan)] text-[.66rem] font-bold text-[var(--bg)]">{i + 1}</span>
              <span className="shrink-0 font-semibold text-[var(--txt)]">{t(st.label)}</span>
              <Icon aria-hidden className={cn('size-[14px] shrink-0', tone, status === 'running' && 'animate-spin')} />
              <span className={cn('truncate max-[560px]:hidden', tone)}>{t(label)}{sub ? ` · ${sub}` : ''}</span>
            </button>
          </div>
        )
      })}
    </nav>
  )
}
