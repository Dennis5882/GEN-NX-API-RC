/* shared/rc_engine.js 공개 API 타입 — 이전하면서 any 를 구체 타입으로 교체해 나간다. */
import type { Lang } from '../i18n/types'

export type L3 = Record<Lang, string>

export interface MaterialProps {
  E: number
  poisn: number
  den: number
}

export type BuildingTypeKey = 'apartment' | 'office' | 'commercial' | 'hospital' | 'school'

export interface SectionDef { name: string; H: number; B: number }
export interface Palette { cols: SectionDef[]; beams: SectionDef[]; mats: string[] }

/** 표준층 그룹 행 (표 1행 = 연속 층 구간) */
export interface FloorGroupRow {
  role: string
  from: number
  to: number
  h: number
  use: string
  col?: string
  beam?: string
  mat?: string
}

export interface SeismicInput {
  on?: boolean
  SDS?: number; SD1?: number; T0?: number; I?: number; R?: number
  w0?: number; liveRatio?: number; Cs?: number; V?: number
  massLiveRatio?: number; verifyTol?: number
}
export interface WindInput {
  on?: boolean
  V10?: number; exposure?: string; G?: number; Cf?: number; I?: number; verifyTol?: number
}
export interface CoreInput { on?: boolean; thick?: number }

export interface BuildingSpec {
  buildings: number
  bayX: number
  bayY: number
  spanX: number | number[]
  spanY: number | number[]
  stories: number
  h1: number
  hTyp: number
  gap: number
  connectFloor: number
  matName: string
  E: number
  poisn: number
  den: number
  colName: string
  colH: number
  colB: number
  beamName: string
  beamH: number
  beamB: number
  bldgType?: BuildingTypeKey | null
  podium?: number
  podiumUse?: string
  palette?: Palette
  groups?: FloorGroupRow[]
  storyData?: boolean
  diaphragmMethod?: 'story' | 'rigd'
  seismic?: SeismicInput
  wind?: WindInput
  core?: CoreInput
  walls?: any[]
  [extra: string]: unknown
}

export interface BuildingTypeTemplate extends Partial<BuildingSpec> {
  icon: string
  label: L3
  desc: L3
  tip: L3
}

export interface SeismicZone { city: string; dist: string; SDS: number; SD1: number; T0?: number }

export interface RCEngineApi {
  MATERIALS: Record<string, MaterialProps>
  DEFAULT_SPEC: BuildingSpec
  BUILDING_TYPES: Record<BuildingTypeKey, BuildingTypeTemplate>
  FG_ROLES: string[]
  FG_USES: string[]
  SEISMIC_ZONES: SeismicZone[]
  detectBuildingType(text: string): BuildingTypeKey | null
  paletteFor(p: BuildingSpec): Palette
  specToGroupRows(p: BuildingSpec): FloorGroupRow[]
  useOf(p: Partial<BuildingSpec>): string
  asSpans(span: number | number[], bays: number): number[]
  cumPos(spans: number[]): number[]
  // ── 아래는 아직 미타입 (이전 시 구체화) ──
  [name: string]: any
}

declare global {
  interface Window {
    RCEngine: RCEngineApi
  }
}
