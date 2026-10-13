/* 설계기준 프로필 레지스트리 — 기준 추가 = 프로필 파일 + 여기 한 줄 */
import type { BuildingSpec } from '../engine/types'
import { S } from '../state/store'
import { CN } from './cn'
import { KR } from './kr'
import { TW } from './tw'
import type { CodeId, CodeProfile } from './types'

export const PROFILES: Record<CodeId, CodeProfile> = { TW, CN, KR }
export const CODE_IDS = Object.keys(PROFILES) as CodeId[]

/** 현재 선택된 기준 */
export function profile(): CodeProfile { return PROFILES[S.code] }

/** 스펙에 기록된 기준(없으면 현재 선택) — 이미 만든 모델은 자기 기준으로 계산 */
export function profileOf(p: BuildingSpec | null | undefined): CodeProfile {
  const id = p?.code as CodeId | undefined
  return (id && PROFILES[id]) || profile()
}

/** 새 스펙에 현재 기준을 기록하고 기준에 맞게 변환 (템플릿 재료명 등) */
export function stampSpec(p: BuildingSpec): BuildingSpec {
  const prof = profile()
  const explicit = (p._explicit as string[] | undefined) || []
  let q = prof.adaptSpec ? prof.adaptSpec(p) : { ...p }
  delete q._explicit
  q.code = prof.id
  /* 기준별 새 스펙 보정(prepareNew) — 안내 문구는 prepNotes 로 넘겨 계획 카드·LLM 응답에 표시 후 제거 */
  if (prof.prepareNew) { const r = prof.prepareNew(q, explicit); q = r.spec; if (r.notes.length) q.prepNotes = r.notes }
  return q
}

/** stampSpec 이 붙인 안내 문구를 꺼내고 스펙에서 지움 */
export function takePrepNotes(p: BuildingSpec): string[] {
  const n = (p.prepNotes as string[] | undefined) || []
  delete p.prepNotes
  return n
}

export type * from './types'
