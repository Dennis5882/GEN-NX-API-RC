/* ════════════════════════════════════════════════════════════
   편집 카드 상태 ↔ 스펙 변환 — 바닐라 planEditor(초기값) / readPlanEditor(읽기) 의 순수 함수판.
   DOM 대신 EditorState 를 단일 출처로 사용. 입력값은 문자열로 보관(입력 중 상태 보존).
════════════════════════════════════════════════════════════ */
import { profileOf, type LateralGroup } from '../codes'
import { slabThk } from '../codes/selfweight'
import { RC, type BuildingSpec, type Palette } from '../engine'
import type { CoreInput } from '../engine/types'
import { editorPalette } from './plan'

export type TopKey = 'buildings' | 'bayX' | 'bayY' | 'spanX' | 'spanY' | 'connectFloor' | 'gap'
export const TOP_KEYS: TopKey[] = ['buildings', 'bayX', 'bayY', 'spanX', 'spanY', 'connectFloor', 'gap']

export interface PalRow { key: number; H: string; B: string }
export interface FgRow { key: number; role: string; from: string; to: string; h: string; use: string; col: string; beam: string; mat: string }

export type LateralState = { on: boolean; vals: Record<string, string> }

/** 프로필 필드 정의 → 입력 초기값 (number: 스펙값 ?? 기본, select: 빈값이면 기본) */
function initLateral(g: LateralGroup, src: Record<string, any> | undefined, p: BuildingSpec): LateralState {
  const s = src || {}
  const vals: Record<string, string> = {}
  for (const f of g.fields) {
    const v = s[f.key]
    vals[f.key] = f.kind === 'select' ? String(v == null || v === '' ? f.def(p) : v) : str(v ?? f.def(p))
  }
  return { on: !!s.on, vals }
}

/** 입력 → 스펙 객체 (number: 빈칸 제외 parseFloat, select: 문자열 그대로) */
function readLateral(g: LateralGroup, st: LateralState): Record<string, any> {
  const o: Record<string, any> = { on: st.on }
  for (const f of g.fields) {
    const v = st.vals[f.key] ?? ''
    if (f.kind === 'select') o[f.key] = v
    else if (v !== '') o[f.key] = parseFloat(v)
  }
  return o
}

export interface EditorState {
  top: Record<TopKey, string>
  cols: PalRow[]
  beams: PalRow[]
  mats: string[]          // 체크된 재료
  matCat: string[]        // 체크박스 목록(카탈로그 + 팔레트 고유 재료)
  rows: FgRow[]           // 표시 순서 = 위(지붕) → 아래(지하)
  storyData: boolean
  diaMethod: 'story' | 'rigd'
  /* 횡하중 입력 — 항목은 설계기준 프로필의 fields 가 정의 (값은 문자열) */
  seis: LateralState
  wind: LateralState
  core: CoreState
  /** 내력벽(벽식) — 세대 경계벽·복도벽, 벽 속 기둥 생략 */
  bearing: { on: boolean; thick: string }
  /** 슬래브 두께 mm (바닥 DL 자중) */
  slabThk: string
}

/** 코어 배치 편집 상태 — 위치 null = 가운데(경간 수가 바뀌어도 가운데 유지). 엔진 coreLayout 이 범위 보정 */
export interface CoreState {
  on: boolean; thick: string
  ix: number | null; iy: number | null; nx: number; ny: number
  layout: 'same' | 'mirror' | 'each'
  pos: ({ ix: number; iy: number } | null)[]   // each: 동별(index = 동, 0 은 미사용)
  skip: number[]
}

let keySeq = 0
export const newKey = (): number => ++keySeq

const str = (v: unknown) => (v == null ? '' : Array.isArray(v) ? v.join(',') : String(v))

/** 팔레트에서 실제 선택값 — 목록에 없으면 첫 항목 (바닐라 refreshFgSectionDropdowns 와 동일) */
export function effectiveSel(pal: Palette, r: Pick<FgRow, 'col' | 'beam' | 'mat'>) {
  return {
    col: pal.cols.some(c => c.name === r.col) ? r.col : pal.cols[0].name,
    beam: pal.beams.some(b => b.name === r.beam) ? r.beam : pal.beams[0].name,
    mat: pal.mats.includes(r.mat) ? r.mat : pal.mats[0],
  }
}

export function initEditor(p: BuildingSpec): EditorState {
  const pal = editorPalette(p)
  const prof = profileOf(p)
  const matCat = Object.keys(prof.materials)
  pal.mats.forEach(m => { if (!matCat.includes(m)) matCat.unshift(m) })
  const c: any = p.core || {}
  const rows = RC.specToGroupRows(p).slice().reverse().map(g => {
    const sel = effectiveSel(pal, { col: g.col || '', beam: g.beam || '', mat: g.mat || '' })
    return { key: newKey(), role: g.role, from: str(g.from), to: str(g.to), h: str(g.h), use: g.use, ...sel }
  })
  return {
    top: Object.fromEntries(TOP_KEYS.map(k => [k, str(p[k])])) as Record<TopKey, string>,
    cols: pal.cols.map(x => ({ key: newKey(), H: str(x.H), B: str(x.B) })),
    beams: pal.beams.map(x => ({ key: newKey(), H: str(x.H), B: str(x.B) })),
    mats: pal.mats.slice(),
    matCat,
    rows,
    storyData: p.storyData !== false,
    diaMethod: p.diaphragmMethod === 'rigd' ? 'rigd' : 'story',
    seis: initLateral(prof.seismic, p.seismic, p),
    wind: initLateral(prof.wind, p.wind, p),
    core: {
      on: !!c.on, thick: str(c.thick ?? 250),
      ix: c.ix ?? null, iy: c.iy ?? null, nx: c.nx || 1, ny: c.ny || 1,
      layout: c.layout === 'mirror' || c.layout === 'each' ? c.layout : 'same',
      pos: Array.isArray(c.pos) ? c.pos.slice() : [], skip: Array.isArray(c.skip) ? c.skip.slice() : [],
    },
    bearing: { on: !!p.bearing?.on, thick: str(p.bearing?.thick ?? 200) },
    slabThk: str(slabThk(p)),
  }
}

/** 편집 상태 → 팔레트 (바닐라 palFromEl) */
export function paletteOf(st: EditorState, base: BuildingSpec): Palette {
  const cols = st.cols.map(r => ({ H: +r.H, B: +r.B })).filter(r => r.H > 0 && r.B > 0).map(r => ({ name: `C${r.H}x${r.B}`, ...r }))
  const beams = st.beams.map(r => ({ H: +r.H, B: +r.B })).filter(r => r.H > 0 && r.B > 0).map(r => ({ name: `B${r.B}x${r.H}`, ...r }))
  // 바닐라: 체크박스 DOM 순서(=matCat 순서)로 읽음 → mats[0] = 대표 재료
  const mats = st.matCat.filter(m => st.mats.includes(m))
  if (!cols.length) cols.push({ name: base.colName || 'C600x600', H: base.colH || 600, B: base.colB || 600 })
  if (!beams.length) beams.push({ name: base.beamName || 'B400x600', H: base.beamH || 600, B: base.beamB || 400 })
  if (!mats.length) mats.push(base.matName || 'C280')
  return { cols, beams, mats }
}

/** 코어 편집 상태 → 스펙 core (빈 위치 = 가운데) */
export function coreInput(c: CoreState): CoreInput {
  const core: CoreInput = { on: c.on, nx: c.nx, ny: c.ny, layout: c.layout }
  if (c.thick !== '') core.thick = parseFloat(c.thick)
  if (c.ix != null) core.ix = c.ix
  if (c.iy != null) core.iy = c.iy
  if (c.layout === 'each' && c.pos.some(Boolean)) core.pos = c.pos
  if (c.skip.length) core.skip = c.skip.slice()
  return core
}

/** 상단 그리드 입력(동·경간·스팬·연결층·간격) → 스펙 필드 */
export function applyTop(p: BuildingSpec, st: Pick<EditorState, 'top'>): BuildingSpec {
  for (const k of TOP_KEYS) {
    const raw = st.top[k]
    if (k === 'spanX' || k === 'spanY') {
      // 콤마 → 가변 스팬 배열, 단일 값 → 균일 스팬
      const parts = String(raw).split(',').map(s => parseFloat(s)).filter(v => !isNaN(v) && v > 0)
      if (parts.length > 1) p[k] = parts
      else if (parts.length === 1) p[k] = parts[0]
    } else {
      let v = parseFloat(raw)
      if (!isNaN(v)) {
        // connectFloor／gap 允許 0（代表不連接）；其餘維度至少為 1
        v = (k === 'connectFloor' || k === 'gap') ? Math.max(0, v) : Math.max(1, v)
        p[k] = v
      }
    }
  }
  // 가변 스팬이면 跨數를 배열 길이에 맞춤
  if (Array.isArray(p.spanX)) p.bayX = p.spanX.length
  if (Array.isArray(p.spanY)) p.bayY = p.spanY.length
  // 多棟卻無間距 → 避免建築重疊
  if (p.buildings >= 2 && (!p.gap || p.gap <= 0)) p.gap = 14000
  return p
}

/** 편집 상태 → 완전한 스펙 (바닐라 readPlanEditor). base 는 E/poisn/den/bldgType 등 보존용. */
export function editorToSpec(st: EditorState, base: BuildingSpec): BuildingSpec {
  const p: BuildingSpec = { ...base }
  applyTop(p, st)
  // 단면·재료 팔레트 + 1차 단면/재료를 최상위 필드에 반영(하위호환·설계·표시용)
  const pal = paletteOf(st, base)
  p.palette = pal
  p.colName = pal.cols[0].name; p.colH = pal.cols[0].H; p.colB = pal.cols[0].B
  p.beamName = pal.beams[0].name; p.beamH = pal.beams[0].H; p.beamB = pal.beams[0].B
  p.matName = pal.mats[0]
  const prof = profileOf(base)
  const mt = prof.materials[pal.mats[0]]
  if (mt) { p.E = mt.E; p.poisn = mt.poisn; p.den = mt.den }
  // 표준층 표 → groups(층 구성·높이·단면·재료의 단일 출처). stories·h1·hTyp는 표를 따름.
  const rows = st.rows.map(r => ({ role: r.role, from: +r.from, to: +r.to, h: +r.h, use: r.use, ...effectiveSel(pal, r) }))
    .filter(g => g.to >= g.from)
  if (rows.length) {
    p.groups = rows
    p.stories = Math.max(1, ...rows.map(g => g.to))
    // h1 = 1층이 속한 행의 층고 (표는 위→아래 순서라 rows[0] 은 지붕 행 — 바닐라는 그걸 써서 표시가 틀렸음)
    p.h1 = (rows.find(g => g.from <= 1 && 1 <= g.to) || rows[rows.length - 1]).h
    p.hTyp = (rows.find(g => g.role === 'TYPICAL') || rows[rows.length - 1]).h
  }
  const sl = parseFloat(st.slabThk)
  p.slabThk = isNaN(sl) ? slabThk(base) : Math.max(0, sl)
  p.storyData = st.storyData
  p.diaphragmMethod = st.diaMethod
  const seis = readLateral(prof.seismic, st.seis)
  const wind = readLateral(prof.wind, st.wind)
  prof.finalizeLateral?.(seis, wind)
  p.seismic = seis
  p.wind = wind
  const core = coreInput(st.core)
  p.core = core
  const bt = parseFloat(st.bearing.thick)
  p.bearing = st.bearing.on ? { on: true, thick: isNaN(bt) ? 200 : bt } : undefined
  if (!p.bearing) delete p.bearing
  p.walls = RC.specWalls(p)   // 코어 + 내력벽(base.bearing 보존)
  return p
}

/** 시작/끝 번호 재정렬 — 맨 아래 행 = 최하층 = 1, 위로 누적 (바닐라 fgRenumber) */
export function renumber(rows: FgRow[]): FgRow[] {
  const out = rows.map(r => ({ ...r }))
  let base = 1
  for (let i = out.length - 1; i >= 0; i--) {
    const cnt = Math.max(1, (+out[i].to) - (+out[i].from) + 1)
    out[i].from = String(base); out[i].to = String(base + cnt - 1); base += cnt
  }
  return out
}
