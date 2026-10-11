/* ════════════════════════════════════════════════════════════
   편집 카드 상태 ↔ 스펙 변환 — 바닐라 planEditor(초기값) / readPlanEditor(읽기) 의 순수 함수판.
   DOM 대신 EditorState 를 단일 출처로 사용. 입력값은 문자열로 보관(입력 중 상태 보존).
════════════════════════════════════════════════════════════ */
import { RC, type BuildingSpec, type Palette } from '../engine'
import { editorPalette } from './plan'

export type TopKey = 'buildings' | 'bayX' | 'bayY' | 'spanX' | 'spanY' | 'connectFloor' | 'gap'
export const TOP_KEYS: TopKey[] = ['buildings', 'bayX', 'bayY', 'spanX', 'spanY', 'connectFloor', 'gap']
export const SEIS_KEYS = ['SDS', 'SD1', 'T0', 'I', 'R', 'w0', 'liveRatio', 'Cs', 'V'] as const
export const WIND_KEYS = ['V10', 'G', 'Cf'] as const

export interface PalRow { key: number; H: string; B: string }
export interface FgRow { key: number; role: string; from: string; to: string; h: string; use: string; col: string; beam: string; mat: string }

export interface EditorState {
  top: Record<TopKey, string>
  cols: PalRow[]
  beams: PalRow[]
  mats: string[]          // 체크된 재료
  matCat: string[]        // 체크박스 목록(카탈로그 + 팔레트 고유 재료)
  rows: FgRow[]           // 표시 순서 = 위(지붕) → 아래(지하)
  storyData: boolean
  diaMethod: 'story' | 'rigd'
  seis: { on: boolean } & Record<(typeof SEIS_KEYS)[number], string>
  wind: { on: boolean; exposure: string } & Record<(typeof WIND_KEYS)[number], string>
  core: { on: boolean; thick: string }
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
  const matCat = Object.keys(RC.MATERIALS)
  pal.mats.forEach(m => { if (!matCat.includes(m)) matCat.unshift(m) })
  const s: any = p.seismic || {}
  const w: any = p.wind || {}
  const c: any = p.core || {}
  const I0 = (p.bldgType === 'hospital' || p.bldgType === 'school') ? 1.25 : 1.0
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
    seis: {
      on: !!s.on,
      SDS: str(s.SDS ?? 0.6), SD1: str(s.SD1 ?? 0.35), T0: str(s.T0), I: str(s.I ?? I0),
      R: str(s.R ?? 4.5), w0: str(s.w0 ?? 12), liveRatio: str(s.liveRatio ?? 0.25), Cs: str(s.Cs), V: str(s.V),
    },
    wind: { on: !!w.on, exposure: w.exposure || 'B', V10: str(w.V10 ?? 42.5), G: str(w.G ?? 1.9), Cf: str(w.Cf ?? 1.3) },
    core: { on: !!c.on, thick: str(c.thick ?? 250) },
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

/** 편집 상태 → 완전한 스펙 (바닐라 readPlanEditor). base 는 E/poisn/den/bldgType 등 보존용. */
export function editorToSpec(st: EditorState, base: BuildingSpec): BuildingSpec {
  const p: BuildingSpec = { ...base }
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
  // 단면·재료 팔레트 + 1차 단면/재료를 최상위 필드에 반영(하위호환·설계·표시용)
  const pal = paletteOf(st, base)
  p.palette = pal
  p.colName = pal.cols[0].name; p.colH = pal.cols[0].H; p.colB = pal.cols[0].B
  p.beamName = pal.beams[0].name; p.beamH = pal.beams[0].H; p.beamB = pal.beams[0].B
  p.matName = pal.mats[0]
  const mt = RC.MATERIALS[pal.mats[0]]
  if (mt) { p.E = mt.E; p.poisn = mt.poisn; p.den = mt.den }
  // 표준층 표 → groups(층 구성·높이·단면·재료의 단일 출처). stories·h1·hTyp는 표를 따름.
  const rows = st.rows.map(r => ({ role: r.role, from: +r.from, to: +r.to, h: +r.h, use: r.use, ...effectiveSel(pal, r) }))
    .filter(g => g.to >= g.from)
  if (rows.length) {
    p.groups = rows
    p.stories = Math.max(1, ...rows.map(g => g.to))
    // ⚠ 바닐라 동작 그대로: rows[0] 은 표의 맨 위(지붕) 행. 그룹 높이가 우선이라 h1 은 표시용에만 영향.
    p.h1 = rows[0].h
    p.hTyp = (rows.find(g => g.role === 'TYPICAL') || rows[rows.length - 1]).h
  }
  p.storyData = st.storyData
  p.diaphragmMethod = st.diaMethod
  const seis: any = { on: st.seis.on }
  SEIS_KEYS.forEach(k => { if (st.seis[k] !== '') seis[k] = parseFloat(st.seis[k]) })
  p.seismic = seis
  const wind: any = { on: st.wind.on, exposure: st.wind.exposure }
  WIND_KEYS.forEach(k => { if (st.wind[k] !== '') wind[k] = parseFloat(st.wind[k]) })
  if (seis.I != null) wind.I = seis.I   // 用途係數 공유
  p.wind = wind
  const core: any = { on: st.core.on }
  if (st.core.thick !== '') core.thick = parseFloat(st.core.thick)
  p.core = core
  p.walls = core.on ? [RC.autoCore(p, core.thick)] : []
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
