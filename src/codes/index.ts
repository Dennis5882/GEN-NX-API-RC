/* 설계기준 프로필 레지스트리 — 기준 추가 = 프로필 파일 + 여기 한 줄 */
import type { BuildingSpec } from '../engine/types'
import { S } from '../state/store'
import { TW } from './tw'
import type { CodeId, CodeProfile } from './types'

export const PROFILES: Record<CodeId, CodeProfile> = { TW }

/** 현재 선택된 기준 */
export function profile(): CodeProfile { return PROFILES[S.code] }

/** 스펙에 기록된 기준(없으면 현재 선택) — 이미 만든 모델은 자기 기준으로 계산 */
export function profileOf(p: BuildingSpec | null | undefined): CodeProfile {
  const id = p?.code as CodeId | undefined
  return (id && PROFILES[id]) || profile()
}

export type * from './types'
