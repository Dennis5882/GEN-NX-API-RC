/* ════════════════════════════════════════════════════════════
   설계기준 프로필 — 국가/기준별로 달라지는 모든 것을 한 객체로.
   UI 언어와는 독립(예: 한국어 UI + 대만 기준). 앱의 나머지(형상 생성·표준층·MAPI 전송·
   해석·3D·채팅)는 기준 무관 → 기준 의존 호출은 반드시 이 인터페이스를 거친다.
════════════════════════════════════════════════════════════ */
import type { BuildingSpec, MaterialProps } from '../engine/types'
import type { I18nKey } from '../i18n'

export type CodeId = 'TW'

/** 편집 카드 입력 항목 — number(숫자 입력) / select(선택) */
export interface ParamField {
  key: string
  kind: 'number' | 'select'
  label(): string
  unit?: string
  options?(): { value: string; label: string }[]
  /** 스펙에 값이 없을 때 초기값 ('' = 빈칸) */
  def(p: BuildingSpec): number | string
}

export interface LateralGroup {
  /** 적용 체크박스 문구 */
  toggleKey: I18nKey
  /** 하단 안내(HTML) */
  tipHtml(): string
  fields: ParamField[]
  /** 지역 프리셋(선택 시 일부 필드 채움) — 없으면 미표시 */
  presets?: { labelKey: I18nKey; list(): { label: string; values: Record<string, number | string | undefined> }[] }
}

export interface StoryForce { h: number; F: number }
export interface SeismicResult { T: number; Cs: number; V: number; Wtot: number; forces: StoryForce[] }
export interface WindResult { Vx: number; Vy: number; V10: number; forcesX: StoryForce[]; forcesY: StoryForce[] }

export interface SpectrumDef {
  name: string
  spfc: Record<string, any>
  /** 설정 로그 꼬리 (예: " · T0=0.6s Ts=…") */
  logSuffix: string
  /** 동적해석 보고 꼬리 (예: " SDS=… SD1=… (T0=…)") */
  reportSuffix: string
}

export interface Combo { name: string; desc: string; terms: [string, number][] }

export interface CodeProfile {
  id: CodeId
  /** Gen NX RC Design 기준 라벨 (참고/표시) */
  designCode: string
  /* ── 재료 ── */
  /** 팔레트 체크박스 카탈로그 (이름 → E/poisn/den) */
  materials: Record<string, MaterialProps>
  /** db/MATL 콘크리트 항목 (이름 정규화 + Gen NX 재료 DB) */
  concreteMatl(name: string): { NAME: string; STANDARD: string; DB: string }
  /* ── 하중 ── */
  floorUse: Record<string, { sdl: number; live: string; liveVal: number }>
  combos(loadCases: { name: string; type: string }[]): Combo[]
  combosLogKey: I18nKey
  /* ── 횡하중 ── */
  seismic: LateralGroup & {
    storyForces(p: BuildingSpec, sp: Record<string, any>, opt?: { T?: number }): SeismicResult
    storyWeights(p: BuildingSpec, sp: Record<string, any>): number[]
    /** 응답스펙트럼 — 입력 부족이면 null. spfc = db/SPFC 항목, name = SPLC 가 참조할 함수명 */
    spectrum(sp: Record<string, any>): SpectrumDef | null
    spectrumLogKey: I18nKey
  }
  wind: LateralGroup & {
    storyForces(p: BuildingSpec, wp: Record<string, any>): WindResult
  }
  /** 편집 카드 → 스펙 변환 마지막 보정 (예: 대만 풍하중 I 를 지진 I 와 공유) */
  finalizeLateral?(seis: Record<string, any>, wind: Record<string, any>): void
}
