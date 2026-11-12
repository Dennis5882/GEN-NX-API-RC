/* Behavior-preserving port of shared/rc_engine.js. Equations and iteration order are unchanged. */
import { storyElevations, asSpans } from './geometry'
import type {
  BuildingSpec,
  Frame,
  LateralForce,
  RegisteredWindStory,
  SelfProfile,
  SelfProfileRow,
  NativeSseisRecord,
  NativeStoryRow,
  NumericComparison,
  ProfileDifferenceRow,
  SelfWeightRow,
  StoryPropResponse,
  StoryData,
} from './types'

function _ssNum(v: unknown) {
  const n = parseFloat(v as string)
  return isFinite(n) ? n : null
}

export function sseisSelfProfile(
  forces?: LateralForce[],
  _ecc?: number,
): SelfProfile {
  const fs = (forces || []).map(f => ({
    story: f.story,
    name: f.name,
    level: +f.h || 0,
    force: (+f.F || 0) * 1000,
  })) // kN→N
  const rows = fs
    .map(cur => {
      let shear = 0,
        otm = 0
      for (const o of fs) {
        if (o.level > cur.level + 1e-6) shear += o.force // Gen 규약: 엄격 상위
        if (o.level >= cur.level - 1e-6) otm += o.force * (o.level - cur.level)
      }
      return {
        story: cur.story,
        name: cur.name != null ? String(cur.name) : String(cur.story) + 'F',
        level: cur.level,
        force: cur.force,
        shear: shear,
        otm: otm,
      }
    })
    .sort((a, b) => a.level - b.level)
  const baseShear = fs.reduce((s, o) => s + o.force, 0)
  const baseOTM = fs.reduce((s, o) => s + o.force * o.level, 0)
  return { rows, base: { shear: baseShear, otm: baseOTM } }
}

export function swindSelfPressures(
  forces?: LateralForce[],
  regStories?: RegisteredWindStory[],
) {
  const lv = (regStories || [])
    .map(s => +s.level || 0)
    .filter(x => isFinite(x))
    .sort((a, b) => a - b)
  const widthByName: Record<string, number> = {}
  ;(regStories || []).forEach(s => {
    widthByName[String(s.name)] = +s.width || 0
  })
  const tribH: (level: number) => number = L => {
    const i = lv.findIndex(v => Math.abs(v - L) < 0.5)
    if (i < 0) return 0
    const up = i < lv.length - 1 ? (lv[i + 1] - L) / 2 : 0,
      dn = i > 0 ? (L - lv[i - 1]) / 2 : 0
    return up + dn
  }
  const press: { STORY_NAME: string | undefined; PRESS: number }[] = [],
    skipped: (string | undefined)[] = []
  ;(forces || []).forEach(f => {
    const L = +f.h || 0,
      w = widthByName[String(f.name)] || 0,
      th = tribH(L)
    if (L <= 0 || w <= 0 || th <= 0) {
      skipped.push(f.name)
      return
    }
    press.push({ STORY_NAME: f.name, PRESS: ((+f.F || 0) * 1000) / (w * th) })
  })
  return { press, skipped }
}

export function sseisGenRows(
  gen?: NativeSseisRecord | null,
  dir?: string,
): NativeStoryRow[] {
  dir = dir || 'X'
  const P =
    (gen &&
      (gen.PROFILE ||
        (gen.Assign && gen.Assign['1'] && gen.Assign['1'].PROFILE))) ||
    null
  if (!P) return []
  let arr = P[dir + '_DIR'] || P[dir] || P.X_DIR || P.SRSS || []
  if (!Array.isArray(arr)) arr = arr.ITEMS || arr.STORY || arr.rows || []
  return Array.isArray(arr) ? arr : []
}

export function sseisDiff(
  self: SelfProfile,
  gen: NativeSseisRecord,
  dir?: string,
  tol?: number,
) {
  tol = tol == null ? 0.05 : tol
  dir = dir || 'X'
  const rel: (a: number, b: number) => number = (a, b) =>
    Math.abs(b) < 1e-9
      ? Math.abs(a) < 1e-9
        ? 0
        : 1
      : Math.abs(a - b) / Math.abs(b)
  const cmp: (self: number, gen: unknown) => NumericComparison | null = (
    sv,
    gv,
  ) => {
    const g = _ssNum(gv)
    if (g == null) return null
    const e = rel(sv, g)
    return { self: sv, gen: g, err: e, ok: e <= tol }
  }
  const genRows = sseisGenRows(gen, dir)
  const byName: Record<string, SelfProfileRow> = {}
  ;(self.rows || []).forEach(r => {
    byName[String(r.name)] = r
  })
  const isGL: (name: unknown) => boolean = nm =>
    /^(g\.?\s*l\.?|base|ground)$/i.test(String(nm || '').trim())
  const out: ProfileDifferenceRow[] = []
  let matched = 0,
    shearFails = 0,
    worstShear = 0,
    glRow: NativeStoryRow | null = null
  genRows.forEach(g => {
    const nm = String(
      g.STORY_NAME != null ? g.STORY_NAME : g.NAME != null ? g.NAME : '',
    )
    if (isGL(nm)) {
      glRow = g
      return
    }
    const s = byName[nm]
    if (!s) return
    matched++
    const cs = cmp(s.shear, g.STORY_SHEAR)
    if (cs) {
      worstShear = Math.max(worstShear, cs.err)
      if (!cs.ok) shearFails++
    }
    out.push({
      name: nm,
      shear: cs,
      otm: cmp(s.otm, g.OVERTURN_MOMENT),
      torsion: {
        self: null,
        gen: _ssNum(g.ACCIDENT_TORSION),
        err: null,
        ok: null,
      },
    }) // 평면치수 의존 → 참고만
  })
  let base: ProfileDifferenceRow | null = null
  if (glRow) {
    const bs = cmp(self.base.shear, (glRow as NativeStoryRow).STORY_SHEAR),
      bo = cmp(self.base.otm, (glRow as NativeStoryRow).OVERTURN_MOMENT)
    if (bs) {
      matched++
      worstShear = Math.max(worstShear, bs.err)
      if (!bs.ok) shearFails++
    }
    base = { name: 'G.L.(base)', shear: bs, otm: bo, torsion: null }
    out.push(base)
  }
  return {
    dir,
    tol,
    matched,
    shearFails,
    worstShear,
    pass: matched > 0 && shearFails === 0,
    rows: out,
    base,
  }
}

export function storyWeightDiff(
  selfStories: SelfWeightRow[],
  gen: StoryPropResponse,
  tol?: number,
) {
  tol = tol == null ? 0.1 : tol
  const P =
    (gen &&
      (gen.STORYPROP ||
        (gen.Assign && gen.Assign['1'] && gen.Assign['1'].STORYPROP))) ||
    gen
  const data = P && P.DATA ? P.DATA : []
  const rel: (a: number, b: number) => number = (a, b) =>
    Math.abs(b) < 1e-9
      ? Math.abs(a) < 1e-9
        ? 0
        : 1
      : Math.abs(a - b) / Math.abs(b)
  const isGL: (name: unknown) => boolean = nm =>
    /^(g\.?\s*l\.?|base|ground)$/i.test(String(nm || '').trim())
  const out: {
    name: string
    level: number
    self: number
    gen: number
    err: number
    ok: boolean
  }[] = []
  let matched = 0,
    fails = 0,
    worst = 0,
    sSelf = 0,
    sGen = 0
  data.forEach(g => {
    const ev = _ssNum(g.ELEV),
      gw = _ssNum(g.WEIGHT),
      nm = String(g.STORY != null ? g.STORY : '')
    if (ev == null || gw == null || isGL(nm)) return
    let best: SelfWeightRow | null = null,
      bd = 1e9
    ;(selfStories || []).forEach(s => {
      const d = Math.abs((+s.level || 0) - ev)
      if (d < bd) {
        bd = d
        best = s
      }
    })
    if (!best || bd > 1) return
    const e = rel((best as SelfWeightRow).weight, gw)
    worst = Math.max(worst, e)
    if (e > tol) fails++
    matched++
    sSelf += (best as SelfWeightRow).weight
    sGen += gw
    out.push({
      name: nm,
      level: ev,
      self: (best as SelfWeightRow).weight,
      gen: gw,
      err: e,
      ok: e <= tol,
    })
  })
  return {
    tol,
    matched,
    fails,
    worst,
    totalSelf: sSelf,
    totalGen: sGen,
    totalErr: rel(sSelf, sGen),
    rows: out,
  }
}

export function sseisProfileToStoryProp(genSseis?: NativeSseisRecord | null) {
  const g =
    genSseis && genSseis.SSEIS && genSseis.SSEIS['1']
      ? genSseis.SSEIS['1']
      : genSseis || {}
  const prof = g.PROFILE || {}
  const rows = prof.X_DIR || prof.Y_DIR || prof.SRSS || []
  const data: { STORY: string; WEIGHT: number; ELEV: number | null }[] = []
  rows.forEach(r => {
    const w = _ssNum(r.STORY_WEIGHT),
      ev = _ssNum(r.STORY_LEVEL),
      nm = String(r.STORY_NAME != null ? r.STORY_NAME : '')
    if (w == null) return // G.L. 행은 STORY_WEIGHT="-" → skip
    data.push({ STORY: nm, WEIGHT: w, ELEV: ev })
  })
  return { STORYPROP: { DATA: data } }
}

export function buildStoryData(
  p: BuildingSpec,
  f?: Pick<Frame, 'nodes'>,
): Record<number, StoryData> {
  const elev = storyElevations(p)
  const useStoryDia =
    p.diaphragmMethod !== 'rigd' && p.diaphragmMethod !== 'none' // 기본=story(미지정 포함), 'rigd'·'none'(2동 막요소 바닥) 은 false
  let mnx = Infinity,
    mxx = -Infinity,
    mny = Infinity,
    mxy = -Infinity
  ;((f && f.nodes) || []).forEach(n => {
    if (n.x < mnx) mnx = n.x
    if (n.x > mxx) mxx = n.x
    if (n.y < mny) mny = n.y
    if (n.y > mxy) mxy = n.y
  })
  /* 2동 이상: 우발편심 기준폭 = 1개 동 평면(동 사이 간격 제외) — 층 전체 폭이면 간격까지 포함돼 과대 */
  const wX = isFinite(mxx - mnx) ? mxx - mnx : 0,
    wY = isFinite(mxy - mny) ? mxy - mny : 0
  const multi = (p.buildings || 1) > 1
  const eX = multi ? asSpans(p.spanX, p.bayX).reduce((a, b) => a + b, 0) : wX,
    eY = multi ? asSpans(p.spanY, p.bayY).reduce((a, b) => a + b, 0) : wY
  const cX = isFinite(mnx) ? (mnx + mxx) / 2 : 0,
    cY = isFinite(mny) ? (mny + mxy) / 2 : 0
  /* bFLOOR_DIAPHRAGM: 'rigd' 방식(기본)=false(db/rigd가 담당), 'story' 방식=true(Story Data가 직접 담당) */
  const mk: (name: string, level: number) => StoryData = (name, lvl) => ({
    STORY_NAME: name,
    STORY_LEVEL: lvl,
    bFLOOR_DIAPHRAGM: useStoryDia && lvl > 0,
    WIND_FLOOR_WIDTH_X: wX,
    WIND_FLOOR_WIDTH_Y: wY,
    WIND_CENTER_X: cX,
    WIND_CENTER_Y: cY,
    WIND_ECCENT_X: 0,
    WIND_ECCENT_Y: 0,
    SEIS_ACC_ECCENT_X: 0.05 * eX,
    SEIS_ACC_ECCENT_Y: 0.05 * eY,
    SEIS_INHERENT_ECCENT_X: 0,
    SEIS_INHERENT_ECCENT_Y: 0,
    SEIS_TORSIONAL_AMP_FACTOR_X: 1.0,
    SEIS_TORSIONAL_AMP_FACTOR_Y: 1.0,
  })
  const a: Record<number, StoryData> = {}
  let k = 1
  a[k++] = mk('1F', 0) // 지반 G.L.
  for (let iz = 1; iz <= (p.stories || 0); iz++) {
    a[k++] = mk(iz === p.stories ? 'RF' : iz + 1 + 'F', +elev[iz] || 0)
  }
  return a
}
