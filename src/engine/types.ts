/* shared/rc_engine.js 공개 API 타입 — 이전하면서 any 를 구체 타입으로 교체해 나간다. */
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
/** 코어 배치 — ix/iy = 좌하단 베이 인덱스(빈값 = 가운데), nx/ny = 크기(베이 수), 2동 이상 layout·pos·skip (rc_engine coreLayout) */
export interface CoreInput {
  on?: boolean; thick?: number
  ix?: number | null; iy?: number | null; nx?: number; ny?: number
  layout?: 'same' | 'mirror' | 'each'
  pos?: ({ ix?: number; iy?: number } | null)[]
  skip?: number[]
}
/** 내력벽(벽식) — rc_engine bearingWalls: 세대 경계벽(모든 X 그리드선 Y 방향) + 가운데 복도벽(X 방향 한 베이 걸러). 벽 속 기둥 생략 */
export interface BearingInput { on?: boolean; thick?: number }
export interface CoreLayout {
  nbx: number; nby: number; nx: number; ny: number; layout: 'same' | 'mirror' | 'each'
  towers: { building: number; on: boolean; ix: number; iy: number }[]
}

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
  /** 설계기준 프로필 id (src/codes) — 없으면 현재 선택 기준 */
  code?: string
  podium?: number
  podiumUse?: string
  palette?: Palette
  groups?: FloorGroupRow[]
  storyData?: boolean
  diaphragmMethod?: 'story' | 'rigd'
  seismic?: SeismicInput
  wind?: WindInput
  core?: CoreInput
  bearing?: BearingInput
  walls?: any[]
  /** 슬래브 두께 mm — 바닥 DL 에 자중(두께×γc)으로 반영. 없으면 150 (src/codes/selfweight.ts) */
  slabThk?: number
  [extra: string]: unknown
}

/** 건물유형 템플릿 — UI 문구는 사전 bt_<type>_* (엔진엔 데이터만) */
export interface BuildingTypeTemplate extends Partial<BuildingSpec> {
  icon: string
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
  coreLayout(p: Partial<BuildingSpec>, c?: CoreInput): CoreLayout
  coreWalls(p: Partial<BuildingSpec>, c?: CoreInput): any[]
  bearingWalls(p: Partial<BuildingSpec>, bw?: BearingInput): any[]
  specWalls(p: Partial<BuildingSpec>): any[]
  resolveWalls(p: Partial<BuildingSpec>): any[]
  // ── 아래는 아직 미타입 (이전 시 구체화) ──
  [name: string]: any
}

declare global {
  interface Window {
    RCEngine: RCEngineApi
  }
}
