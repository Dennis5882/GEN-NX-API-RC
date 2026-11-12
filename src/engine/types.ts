/* 순수 엔진 모듈과 앱 소비처에서 공유하는 도메인 타입. */
export interface MaterialProps {
  E: number
  poisn: number
  den: number
}

export type BuildingTypeKey =
  | 'apartment'
  | 'office'
  | 'commercial'
  | 'hospital'
  | 'school'

export interface SectionDef {
  name: string
  H: number
  B: number
}
export interface Palette {
  cols: SectionDef[]
  beams: SectionDef[]
  mats: string[]
}

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
  dia?: boolean
}

export interface SeismicInput {
  on?: boolean
  SDS?: number
  SD1?: number
  T0?: number
  I?: number
  R?: number
  w0?: number
  liveRatio?: number
  Cs?: number
  V?: number
  massLiveRatio?: number
  verifyTol?: number
}
export interface WindInput {
  on?: boolean
  V10?: number
  exposure?: string
  G?: number
  Cf?: number
  I?: number
  verifyTol?: number
}
/** 코어 배치 — ix/iy = 좌하단 베이 인덱스(빈값 = 가운데), nx/ny = 크기(베이 수), 2동 이상 layout·pos·skip (rc_engine coreLayout) */
export interface CoreInput {
  on?: boolean
  thick?: number
  ix?: number | null
  iy?: number | null
  nx?: number
  ny?: number
  layout?: 'same' | 'mirror' | 'each'
  pos?: ({ ix?: number; iy?: number } | null)[]
  skip?: number[]
}
/** 내력벽(벽식) — rc_engine bearingWalls: 세대 경계벽(모든 X 그리드선 Y 방향) + 가운데 복도벽(X 방향 한 베이 걸러). 벽 속 기둥 생략 */
export interface BearingInput {
  on?: boolean
  thick?: number
}
export interface CoreLayout {
  nbx: number
  nby: number
  nx: number
  ny: number
  layout: 'same' | 'mirror' | 'each'
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
  diaphragmMethod?: 'story' | 'rigd' | 'none'
  seismic?: SeismicInput
  wind?: WindInput
  core?: CoreInput
  bearing?: BearingInput
  walls?: WallDefinition[]
  /** 슬래브 두께 mm — 바닥 DL 에 자중(두께×γc)으로 반영. 없으면 150 (src/codes/selfweight.ts) */
  slabThk?: number
  [extra: string]: unknown
}

export interface CoreWall {
  kind: 'core'
  building?: number
  ix0: number
  iy0: number
  ix1: number
  iy1: number
  from?: number
  to?: number
  thick?: number
}
export interface LineWall {
  kind?: 'wall'
  dir?: 'X' | 'Y'
  building?: number
  ix?: number
  iy?: number
  bays?: number
  from?: number
  to?: number
  thick?: number
  bearing?: boolean
}
export type WallDefinition = CoreWall | LineWall
export interface FloorGroup {
  role: string
  use: string
  dia?: boolean
  h?: number | null
  col?: string | null
  beam?: string | null
  mat?: string | null
}
export interface FloorGroupResultRow
  extends Omit<FloorGroupRow, 'col' | 'beam' | 'mat'> {
  dia: boolean
  col: string | null
  beam: string | null
  mat: string | null
}
export interface FloorLoadPreset {
  sdl: number
  live: 'LL' | 'LR'
  liveVal: number
}
export interface StorySectionAssignment {
  colSect: number
  beamSect: number
  mat: number
}
export interface SectionRegistry {
  sections: SectionDef[]
  mats: string[]
  storyAssign: Record<number, StorySectionAssignment>
  def: StorySectionAssignment
}
export interface FrameNode {
  id: number
  x: number
  y: number
  z: number
}
export type FrameEdge = [number, number]
export interface ColumnMeta {
  n1: number
  n2: number
  b: number
  iz: number
}
export interface BeamMeta extends ColumnMeta {
  inWall: boolean
}
export interface LinkMeta {
  n1: number
  n2: number
  iz: number
}
export interface FrameWall {
  nodes: number[]
  thick: number
  story: number
  building: number
  w: number
}
export interface Frame {
  nodes: FrameNode[]
  cols: FrameEdge[]
  beams: FrameEdge[]
  links: FrameEdge[]
  colMeta: ColumnMeta[]
  beamMeta: BeamMeta[]
  linkMeta: LinkMeta[]
  baseNodes: number[]
  elev: number[]
  floorGroups: Record<string, number[]>
  floorCorners: Record<string, number[]>
  walls: FrameWall[]
  wallThks: number[]
}
export interface DetectedFloorGroup {
  from: number
  to: number
  sig: string
  h: number
  colSects: number[]
  beamSects: number[]
  hasSlab: boolean
}
export interface ApiNode {
  X: number
  Y: number
  Z: number
}
export interface ApiElement {
  TYPE: string
  NODE: number[]
  SECT: number
}
export interface LateralForce {
  story?: number | string
  name?: string
  h: number
  F: number
}
export interface RegisteredWindStory {
  name: string
  level: number
  width: number
}
export interface SelfProfileRow {
  story?: number | string
  name: string
  level: number
  force: number
  shear: number
  otm: number
}
export interface SelfProfile {
  rows: SelfProfileRow[]
  base: { shear: number; otm: number }
}
export interface NumericComparison {
  self: number
  gen: number
  err: number
  ok: boolean
}
export type NumericValue = string | number | null | undefined
export interface NativeStoryRow {
  STORY_NAME?: NumericValue
  NAME?: NumericValue
  STORY_LEVEL?: NumericValue
  STORY_SHEAR?: NumericValue
  OVERTURN_MOMENT?: NumericValue
  ACCIDENT_TORSION?: NumericValue
  STORY_WEIGHT?: NumericValue
}
export interface NativeProfileWrapper {
  ITEMS?: NativeStoryRow[]
  STORY?: NativeStoryRow[]
  rows?: NativeStoryRow[]
}
export interface NativeStoryProfile {
  [key: string]: NativeStoryRow[] | NativeProfileWrapper | undefined
  X_DIR?: NativeStoryRow[]
  Y_DIR?: NativeStoryRow[]
  SRSS?: NativeStoryRow[]
}
export interface NativeSseisRecord {
  PROFILE?: NativeStoryProfile
  Assign?: Record<string, NativeSseisRecord>
  SSEIS?: Record<string, NativeSseisRecord>
}
export interface SelfWeightRow {
  level: number
  weight: number
}
export interface NativeWeightRow {
  STORY?: NumericValue
  WEIGHT?: NumericValue
  ELEV?: NumericValue
}
export interface StoryPropResponse {
  STORYPROP?: StoryPropResponse
  Assign?: Record<string, StoryPropResponse>
  DATA?: NativeWeightRow[]
}
export interface ProfileDifferenceRow {
  name: string
  shear: NumericComparison | null
  otm: NumericComparison | null
  torsion: { self: null; gen: number | null; err: null; ok: null } | null
}
export interface StoryData {
  STORY_NAME: string
  STORY_LEVEL: number
  bFLOOR_DIAPHRAGM: boolean
  WIND_FLOOR_WIDTH_X: number
  WIND_FLOOR_WIDTH_Y: number
  WIND_CENTER_X: number
  WIND_CENTER_Y: number
  WIND_ECCENT_X: number
  WIND_ECCENT_Y: number
  SEIS_ACC_ECCENT_X: number
  SEIS_ACC_ECCENT_Y: number
  SEIS_INHERENT_ECCENT_X: number
  SEIS_INHERENT_ECCENT_Y: number
  SEIS_TORSIONAL_AMP_FACTOR_X: number
  SEIS_TORSIONAL_AMP_FACTOR_Y: number
}
export interface SpectrumParams {
  SDS?: number
  SD1?: number
  T0?: number
  TL?: number
}
export interface SpectrumPoint {
  PERIOD: number
  VALUE: number
}
export interface ModalTable {
  HEAD: unknown[]
  DATA: unknown[][]
}
export interface ModalPeriod {
  mode: unknown
  period: number
  fcyc: number | null
}
export interface SectionGeometry {
  b: number
  h: number
}
export interface RebarConfig {
  fy: number
  fyt: number
  cover: number
}
export type ConcreteDesignMaterial = { fc: number } & Partial<RebarConfig>
export interface BeamDemand {
  MuPos?: number
  MuNeg?: number
  Vu?: number
}
export interface ColumnDemand {
  Pu?: number
  Mux?: number
  Muy?: number
}
export interface BarChoice {
  dia: string
  n: number
  As: number
}
export interface StirrupCheck {
  s: number
  Vs: number
  Vc: number
  note: 'min' | 'section' | 'ok'
}
export interface RebarLayer {
  di: number
  A: number
}
export interface InteractionPoint {
  P: number
  M: number
}
export interface InteractionCurve {
  pts: InteractionPoint[]
  Po: number
  phiPnMax: number
  balanced: InteractionPoint | null
}
export interface DrawingProfile {
  name: string
  topExtraDiv: number
  botExtraDiv: number
  confineH: number
  txt: { mark: number; callout: number; dim: number; title: number }
  ref: { beam: string; col: string; note: string }
  layers: [string, number][]
}
export type DxfEntity = [
  type: string,
  layer: string,
  groups: (string | number)[],
]
export interface DxfTextOptions {
  align?: 'left' | 'center' | 'right'
  rot?: number
}
export interface DxfDocument {
  line(
    x1: number,
    y1: number,
    x2: number,
    y2: number,
    layer?: string,
  ): DxfDocument
  rect(x: number, y: number, w: number, h: number, layer?: string): DxfDocument
  circle(x: number, y: number, r: number, layer?: string): DxfDocument
  text(
    x: number,
    y: number,
    h: number,
    text: unknown,
    layer?: string,
    options?: DxfTextOptions,
  ): DxfDocument
  toString(): string
}
export interface DrawingOptions {
  profile?: DrawingProfile
  title?: string
  sheet?: string
  t_plan?: string
}

/** 건물유형 템플릿 — UI 문구는 사전 bt_<type>_* (엔진엔 데이터만) */
export interface BuildingTypeTemplate extends Partial<BuildingSpec> {
  icon: string
}

export interface SeismicZone {
  city: string
  dist: string
  SDS: number
  SD1: number
  T0?: number
  SMS?: number
  SM1?: number
  note?: string
}
