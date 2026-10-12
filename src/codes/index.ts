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
  const q = prof.adaptSpec ? prof.adaptSpec(p) : { ...p }
  q.code = prof.id
  return q
}

export type * from './types'
