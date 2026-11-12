/* Behavior-preserving port of shared/rc_engine.js. Equations and iteration order are unchanged. */
import type {
  BuildingSpec,
  BuildingTypeKey,
  BuildingTypeTemplate,
  MaterialProps,
  FloorLoadPreset,
  FloorGroup,
  FloorGroupResultRow,
  Palette,
  SectionDef,
  SectionRegistry,
  StorySectionAssignment,
  SeismicZone,
} from './types'

export const _MPA2CNS: Record<string, string> = {
  C24: 'C245',
  C28: 'C280',
  C30: 'C315',
  C35: 'C350',
  C40: 'C420',
}

export const _CNS_CONC = ['C210', 'C245', 'C280', 'C315', 'C350', 'C420']

export const MATERIALS: Record<string, MaterialProps> = {
  C210: { E: 21660, poisn: 0.18, den: 2.4e-9 },
  C245: { E: 23380, poisn: 0.18, den: 2.4e-9 },
  C280: { E: 24990, poisn: 0.18, den: 2.4e-9 },
  C315: { E: 26500, poisn: 0.18, den: 2.4e-9 },
  C350: { E: 27940, poisn: 0.18, den: 2.4e-9 },
  C420: { E: 30600, poisn: 0.18, den: 2.4e-9 },
}

export const FLOOR_USE: Record<string, FloorLoadPreset> = {
  Residential: { sdl: 1.5, live: 'LL', liveVal: 2.0 }, // 住宅 200 kgf/m²
  Office: { sdl: 1.5, live: 'LL', liveVal: 3.0 }, // 辦公 300
  Commercial: { sdl: 2.0, live: 'LL', liveVal: 5.0 }, // 商場/賣場 ~500
  School: { sdl: 1.5, live: 'LL', liveVal: 2.5 }, // 學校教室 250 (복도는 별도 그룹으로 상향)
  Hospital: { sdl: 1.5, live: 'LL', liveVal: 2.0 }, // 醫院病房 200 (설비층은 Equipment로 분리)
  Equipment: { sdl: 2.5, live: 'LL', liveVal: 7.5 }, // 設備層/機房 ~750
  Roof: { sdl: 2.5, live: 'LR', liveVal: 1.0 }, // 屋頂 100
}

export const TYPE_USE: Record<string, string> = {
  apartment: 'Residential',
  office: 'Office',
  commercial: 'Commercial',
  hospital: 'Hospital',
  school: 'School',
}

export function useOf(p: Partial<BuildingSpec>): string {
  return TYPE_USE[p.bldgType!] || 'Residential'
}

export function deriveFloorGroups(p: BuildingSpec): Record<number, FloorGroup> {
  const g: Record<number, FloorGroup> = {}
  if (p.groups && p.groups.length) {
    p.groups.forEach(gr => {
      for (let s = gr.from; s <= gr.to; s++)
        g[s] = {
          role: gr.role || 'TYPICAL',
          use: gr.use || useOf(p),
          dia: gr.dia !== false,
          h: gr.h != null ? +gr.h : null,
          col: gr.col || null,
          beam: gr.beam || null,
          mat: gr.mat || null,
        }
    })
    return g
  }
  const u = useOf(p)
  for (let iz = 1; iz <= p.stories; iz++) g[iz] = { role: 'TYPICAL', use: u }
  if (p.podium)
    for (let iz = 1; iz <= Math.min(p.podium, p.stories); iz++)
      g[iz] = { role: 'PODIUM', use: p.podiumUse || 'Commercial' }
  if (p.stories >= 1) g[p.stories] = { role: 'ROOF', use: 'Roof' }
  return g
}

export function specToGroupRows(p: BuildingSpec): FloorGroupResultRow[] {
  const g = deriveFloorGroups(p)
  const rows: FloorGroupResultRow[] = []
  const keys = Object.keys(g)
    .map(Number)
    .sort((a, b) => a - b)
  for (const s of keys) {
    const cur = g[s]
    const h =
      cur.h != null ? cur.h : (s === 1 ? p.h1 : p.hTyp) || p.hTyp || 3000
    const dia = cur.dia !== false
    const col = cur.col || null,
      beam = cur.beam || null,
      mat = cur.mat || null
    const last = rows[rows.length - 1]
    if (
      last &&
      last.role === cur.role &&
      last.use === cur.use &&
      last.dia === dia &&
      last.h === h &&
      last.col === col &&
      last.beam === beam &&
      last.mat === mat &&
      last.to === s - 1
    ) {
      last.to = s
    } else
      rows.push({
        role: cur.role,
        from: s,
        to: s,
        h,
        use: cur.use,
        dia,
        col,
        beam,
        mat,
      })
  }
  return rows
}

export const FG_ROLES = ['TYPICAL', 'PODIUM', 'TRANSFER', 'ROOF', 'BASEMENT']

export const FG_USES = [
  'Residential',
  'Office',
  'Commercial',
  'School',
  'Hospital',
  'Equipment',
  'Roof',
]

export function paletteFor(p: BuildingSpec): Palette {
  const pal: Partial<Palette> = p.palette || {}
  const cols =
    pal.cols && pal.cols.length
      ? pal.cols.map(c => ({ name: c.name, H: +c.H, B: +c.B }))
      : [{ name: p.colName, H: p.colH, B: p.colB }]
  const beams =
    pal.beams && pal.beams.length
      ? pal.beams.map(b => ({ name: b.name, H: +b.H, B: +b.B }))
      : [{ name: p.beamName, H: p.beamH, B: p.beamB }]
  const mats = pal.mats && pal.mats.length ? pal.mats.slice() : [p.matName]
  return { cols, beams, mats }
}

export function specSections(p: BuildingSpec): SectionRegistry {
  const pal = paletteFor(p)
  const g = deriveFloorGroups(p)
  const sections: SectionDef[] = [],
    sIdx: Record<string, number> = {}
  const addSect: (section: SectionDef | undefined) => number = s => {
    if (!s || !s.name) return 0
    if (sIdx[s.name] != null) return sIdx[s.name]
    sections.push({ name: s.name, H: s.H, B: s.B })
    return (sIdx[s.name] = sections.length)
  }
  const mats: string[] = [],
    mIdx: Record<string, number> = {}
  const addMat: (name: string | undefined) => number = name => {
    name = name || p.matName
    if (mIdx[name] != null) return mIdx[name]
    mats.push(name)
    return (mIdx[name] = mats.length)
  }
  const colByName: Record<string, SectionDef> = {}
  pal.cols.forEach(c => (colByName[c.name] = c))
  const beamByName: Record<string, SectionDef> = {}
  pal.beams.forEach(b => (beamByName[b.name] = b))
  colByName[p.colName] = colByName[p.colName] || {
    name: p.colName,
    H: p.colH,
    B: p.colB,
  }
  beamByName[p.beamName] = beamByName[p.beamName] || {
    name: p.beamName,
    H: p.beamH,
    B: p.beamB,
  }
  // 기본(폴백) 단면을 id 1·2로 먼저 등록 → 표시·링크 일관성
  const def = {
    colSect: addSect(colByName[p.colName]),
    beamSect: addSect(beamByName[p.beamName]),
    mat: addMat(p.matName),
  }
  const storyAssign: Record<number, StorySectionAssignment> = {}
  for (let s = 1; s <= p.stories; s++) {
    const gr = g[s] || {}
    const cSpec = colByName[gr.col!] || colByName[p.colName]
    const bSpec = beamByName[gr.beam!] || beamByName[p.beamName]
    storyAssign[s] = {
      colSect: addSect(cSpec),
      beamSect: addSect(bSpec),
      mat: addMat(gr.mat || p.matName),
    }
  }
  return { sections, mats, storyAssign, def }
}

export const DEFAULT_SPEC: BuildingSpec = {
  buildings: 2,
  bayX: 4,
  bayY: 2,
  spanX: 7000,
  spanY: 8000,
  stories: 10,
  h1: 3600,
  hTyp: 2900,
  gap: 12000,
  connectFloor: 8,
  matName: 'C280',
  E: 24990,
  poisn: 0.18,
  den: 2.4e-9,
  colName: 'C600x600',
  colH: 600,
  colB: 600,
  beamName: 'B400x600',
  beamH: 600,
  beamB: 400,
}

export const BUILDING_TYPES: Record<BuildingTypeKey, BuildingTypeTemplate> = {
  apartment: {
    icon: '🏠',
    buildings: 1,
    bayX: 4,
    bayY: 3,
    spanX: 6500,
    spanY: 7000,
    stories: 15,
    h1: 2900,
    hTyp: 2800,
    gap: 14000,
    connectFloor: 0,
    podium: 1,
    podiumUse: 'Commercial',
    matName: 'C280',
    E: 24990,
    poisn: 0.18,
    den: 2.4e-9,
    colName: 'C500x500',
    colH: 500,
    colB: 500,
    beamName: 'B300x500',
    beamH: 500,
    beamB: 300,
  },
  office: {
    icon: '🏢',
    buildings: 1,
    bayX: 4,
    bayY: 3,
    spanX: 9000,
    spanY: 9000,
    stories: 10,
    h1: 4500,
    hTyp: 4000,
    gap: 0,
    connectFloor: 0,
    podium: 1,
    podiumUse: 'Commercial',
    matName: 'C350',
    E: 27940,
    poisn: 0.18,
    den: 2.4e-9,
    colName: 'C600x600',
    colH: 600,
    colB: 600,
    beamName: 'B350x700',
    beamH: 700,
    beamB: 350,
  },
  commercial: {
    icon: '🏬',
    buildings: 1,
    bayX: 5,
    bayY: 4,
    spanX: 9000,
    spanY: 9000,
    stories: 6,
    h1: 5000,
    hTyp: 4500,
    gap: 0,
    connectFloor: 0,
    podium: 1,
    podiumUse: 'Commercial',
    matName: 'C350',
    E: 27940,
    poisn: 0.18,
    den: 2.4e-9,
    colName: 'C700x700',
    colH: 700,
    colB: 700,
    beamName: 'B400x750',
    beamH: 750,
    beamB: 400,
  },
  hospital: {
    icon: '🏥',
    buildings: 1,
    bayX: 4,
    bayY: 4,
    spanX: 8500,
    spanY: 8500,
    stories: 8,
    h1: 4500,
    hTyp: 4200,
    gap: 0,
    connectFloor: 0,
    podium: 1,
    podiumUse: 'Commercial',
    matName: 'C350',
    E: 27940,
    poisn: 0.18,
    den: 2.4e-9,
    colName: 'C700x700',
    colH: 700,
    colB: 700,
    beamName: 'B400x700',
    beamH: 700,
    beamB: 400,
  },
  school: {
    icon: '🏫',
    buildings: 1,
    bayX: 6,
    bayY: 2,
    spanX: 7200,
    spanY: 8400,
    stories: 5,
    h1: 3800,
    hTyp: 3600,
    gap: 0,
    connectFloor: 0,
    podium: 1,
    podiumUse: 'Office',
    matName: 'C280',
    E: 24990,
    poisn: 0.18,
    den: 2.4e-9,
    colName: 'C550x550',
    colH: 550,
    colB: 550,
    beamName: 'B350x550',
    beamH: 550,
    beamB: 350,
  },
}

export const TYPE_KEYWORDS: Record<BuildingTypeKey, RegExp> = {
  apartment:
    /공동주택|아파트|주거|公寓|住宅|集合住宅|apartment|apt|residential/,
  office: /사무실|사무|오피스|업무|辦公室|辦公|商辦|office/,
  commercial:
    /상가|상업|쇼핑|백화점|商場|商场|購物|百貨|賣場|商業|mall|commercial|retail/,
  hospital: /병원|의료|醫院|醫療|hospital/,
  school: /학교|교육|學校|校舍|教學|教育|school/,
}

export function detectBuildingType(t: string): BuildingTypeKey | null {
  for (const [key, re] of Object.entries(TYPE_KEYWORDS))
    if (re.test(t)) return key as BuildingTypeKey
  return null
}

export const SEISMIC_ZONES: SeismicZone[] = [
  /* 臺北盆地 微分區 (表2-6a, Sederes 조회값) — Sa1=N/A, T0로 정의 → SD1=SDS·T0 */
  {
    city: '臺北盆地',
    dist: '臺北一區',
    SDS: 0.6,
    T0: 1.6,
    SD1: 0.96,
    SMS: 0.8,
    SM1: 1.28,
    note: '표2-6(c) T0=1.60 (예: 大安區 仁愛里). 里별 微分區 상이 — Sederes 확인',
  },
  {
    city: '臺北盆地',
    dist: '臺北二區',
    SDS: 0.6,
    T0: 1.3,
    SD1: 0.78,
    SMS: 0.8,
    SM1: 1.04,
    note: '표2-6(c) T0=1.30',
  },
  {
    city: '臺北盆地',
    dist: '臺北三區',
    SDS: 0.6,
    T0: 1.05,
    SD1: 0.63,
    SMS: 0.8,
    SM1: 0.84,
    note: '표2-6(c) T0=1.05',
  },
  { city: '新北市', dist: '三峽區', SDS: 0.7, SD1: 0.4 },
  { city: '新北市', dist: '石碇區', SDS: 0.7, SD1: 0.4 },
  { city: '新北市', dist: '坪林區', SDS: 0.7, SD1: 0.4 },
  { city: '新北市', dist: '雙溪區', SDS: 0.7, SD1: 0.4 },
  { city: '新北市', dist: '貢寮區', SDS: 0.7, SD1: 0.4 },
  { city: '新北市', dist: '烏來區', SDS: 0.7, SD1: 0.4 },
  { city: '新北市', dist: '鶯歌區', SDS: 0.6, SD1: 0.35 },
  { city: '新北市', dist: '瑞芳區', SDS: 0.6, SD1: 0.35 },
  { city: '新北市', dist: '深坑區', SDS: 0.6, SD1: 0.35 },
  { city: '新北市', dist: '平溪區', SDS: 0.6, SD1: 0.35 },
  { city: '新北市', dist: '林口區', SDS: 0.5, SD1: 0.3 },
  { city: '新北市', dist: '三芝區', SDS: 0.5, SD1: 0.3 },
  { city: '新北市', dist: '石門區', SDS: 0.5, SD1: 0.3 },
  { city: '新北市', dist: '金山區', SDS: 0.5, SD1: 0.3 },
  { city: '新北市', dist: '萬里區', SDS: 0.5, SD1: 0.3 },
]
