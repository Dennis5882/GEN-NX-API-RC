/* ════════════════════════════════════════════════════════════
   설계기준 프로필 — 국가/기준별로 달라지는 모든 것을 한 객체로.
   UI 언어와는 독립(예: 한국어 UI + 대만 기준). 앱의 나머지(형상 생성·표준층·MAPI 전송·
   해석·3D·채팅)는 기준 무관 → 기준 의존 호출은 반드시 이 인터페이스를 거친다.
════════════════════════════════════════════════════════════ */
import type { BuildingSpec, MaterialProps } from '../engine/types'
import type { I18nKey } from '../i18n'
import type { ElemRec, Node3 } from '../state/store'

export type CodeId = 'TW' | 'CN' | 'KR'

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

/** terms: [하중케이스, 계수, 해석타입(기본 'ST', 응답스펙트럼 'RS')] */
/** 심사 지표 한 줄 — 값은 Gen NX 층 결과 테이블, 한계는 기준 조문 */
export interface ReviewItem {
  id: string
  label: string
  dir?: 'X' | 'Y'
  value: string
  limit: string
  status: 'ok' | 'warn' | 'ng' | 'info'
  /** 지배 층·모드 등 */
  where?: string
  clause: string
  note?: string
}

/** RS 보정 입력 — rows = STORY_SHEAR_FORCE_COEFFICIENT 행(방향별 RS 케이스), scale0 = 그 해석에 쓴 SCALE */
export interface RsCtx {
  T1: number | null
  Tdir: { X: number | null; Y: number | null }
  rows: { X: Record<string, string>[]; Y: Record<string, string>[] }
  scale0: { X: number; Y: number }
}

/** post/table 요청 1건 — key 는 TABLE_NAME(응답 키) */
/** extra = post/table Argument 에 덧붙일 항목 (예: ADDITIONAL·NODE_ELEMS·PARTS) */
export interface ReviewTable { key: string; type: string; lcs?: string[]; extra?: Record<string, any> }

export interface Combo { name: string; desc: string; terms: [string, number, string?][] }
export interface LoadCaseRef { name: string; type: string }

export interface CodeProfile {
  id: CodeId
  /** Gen NX RC Design 기준 라벨 (참고/표시) */
  designCode: string
  /* ── 재료 ── */
  /** 팔레트 체크박스 카탈로그 (이름 → E/poisn/den) */
  materials: Record<string, MaterialProps>
  /** 기본(대표) 재료명 */
  defaultMat: string
  /** db/MATL 콘크리트 항목 — DAMP_RAT 제외 전부 (TYPE·NAME·PARAM …). 단위계 N·mm 기준 */
  concreteMatl(name: string): Record<string, any>
  /** 템플릿·타 기준 스펙을 이 기준에 맞춤(재료명 등) — 없으면 그대로 */
  adaptSpec?(p: BuildingSpec): BuildingSpec
  /* ── 하중 ── */
  floorUse: Record<string, { sdl: number; live: string; liveVal: number }>
  /** 철근콘크리트 단위중량 kN/m³ — 슬래브 자중·모델 고정하중 산정 */
  concreteGamma: number
  combos(loadCases: LoadCaseRef[]): Combo[]
  combosLogKey: I18nKey
  /* ── 횡하중 ── */
  seismic: LateralGroup & {
    /** 층력 계산 가능한 입력인지 (동적해석 후 계수 재산정 여부) */
    ready(sp: Record<string, any>): boolean
    /** 결과 표시용 계수 이름 (대만 Cs, 중국 α1) */
    coefLabel: string
    /** 질량원 활하중 계수 기본값 (sp.massLiveRatio 미지정 시) */
    massLiveRatio: number
    /** 질량원에 넣을 활하중 케이스 타입 (예: 대만 L·LR, 중국 L — 不上人屋面 제외) */
    massLiveTypes: string[]
    storyForces(p: BuildingSpec, sp: Record<string, any>, opt?: { T?: number }): SeismicResult
    storyWeights(p: BuildingSpec, sp: Record<string, any>): number[]
    /** 응답스펙트럼 — 입력 부족이면 null. spfc = db/SPFC 항목, name = SPLC 가 참조할 함수명 */
    spectrum(sp: Record<string, any>, p?: BuildingSpec): SpectrumDef | null
    spectrumLogKey: I18nKey
    /** 응답스펙트럼이 주 해석인지 (예: 중국 GB 50011 5.1.2 — 지상 40m 초과). 없으면 false = 정적이 주 해석 */
    rsPrimary?(p: BuildingSpec, sp: Record<string, any>): boolean
    /** 주 해석이 RS 인 근거 문구 (예: 'GB 50011 5.1.2 — 지상 H=45m > 40m') */
    rsPrimaryWhy?(p: BuildingSpec): string
    /** RS 초기 SPLC SCALE (방향별) — 예: 대만 3.2 조정계수 C(경험주기). 없으면 1 */
    rsScale0?(p: BuildingSpec, sp: Record<string, any>): { X: number; Y: number }
    /** RS 해석 뒤 방향별 최종 SCALE 결정 (중국 최소 剪重比 증폭, 대만 3.2 C·3.3 총횡력 조정). 바뀌면 SPLC 갱신 후 재해석 */
    rsAdjust?(p: BuildingSpec, sp: Record<string, any>, ctx: RsCtx): { scale: { X: number; Y: number }; chk: any; lines: string[] }
    /** 정적 EX/EY 우발편심 비율(평면 직교 치수 대비) — 층 비틀림 MZ = F·e·L⊥ 를 함께 재하. 예: 중국 0.05 (GB 50011 3.4.3 '具有偶然偏心的规定水平力') */
    staticAccEcc?: number
    /** SPLC(응답스펙트럼 하중케이스)에 덧붙일 항목 — 예: 중국 우발편심 5% (Gen NX bACCECC) */
    splcExtra?: Record<string, any>
  }
  wind: LateralGroup & {
    storyForces(p: BuildingSpec, wp: Record<string, any>): WindResult
  }
  /** 빌드 완료 메시지에 붙는 조합 참조 (예: 대만 'cLCB5/7') */
  comboRefs: { seismic: string; wind: string }
  /** 심사 지표(审图) — 동적해석 뒤 Gen 층 결과 테이블로 산정. 없으면 패널 미표시 */
  review?: {
    tables(ctx: { rs: boolean; model?: any }): ReviewTable[]
    evaluate(p: BuildingSpec, sp: Record<string, any>, data: Record<string, any>, ctx: { rs: boolean; T1: number | null; rsChk?: any; model?: any }): ReviewItem[]
  }
  /** 원문 대조 전 값이 포함됐는지 — UI 에 '미검증' 표시 */
  unverified?: boolean
  /** 편집 카드 → 스펙 변환 마지막 보정 (예: 대만 풍하중 I 를 지진 I 와 공유) */
  finalizeLateral?(seis: Record<string, any>, wind: Record<string, any>): void
  /** 새 스펙(템플릿·자유 골조) 기준별 기본값 보정 — explicit = 사용자가 명령·도구 인자로 직접 준 항목(덮어쓰지 않음).
      notes = 계획 카드에 보여줄 변경 안내. 예: 중국 자유 골조 1동, 轴压比 기준 기둥 크기 */
  prepareNew?(p: BuildingSpec, explicit: string[]): { spec: BuildingSpec; notes: string[] }
  /** 보 강성 배율 — 요소 id → Iyy 배율(Gen NX db/ESSF, 보 연직 휨). 예: 중국 中梁刚度放大·连梁刚度折减. sectH = 단면 id → 춤(mm) */
  beamStiffness?(p: BuildingSpec, recs: ElemRec[], nodes: Node3[], sectH: Record<number, number>): { factors: Record<number, number>; log: string } | null
}
