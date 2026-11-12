/* Behavior-preserving port of shared/rc_engine.js. Equations and iteration order are unchanged. */
import { asSpans, cumPos } from './geometry'
import type { BeamDesign, ColumnDesign } from './design'
import type {
  BuildingSpec,
  SectionGeometry,
  BarChoice,
  DrawingProfile,
  DxfEntity,
  DxfDocument,
  DrawingOptions,
} from './types'

export interface BeamDrawing extends SectionGeometry {
  mark: string
  Ln: number
  barsTop: BarChoice
  barsBot: BarChoice
  stirrup: BeamDesign['stirrup']
  MuPos?: number
  MuNeg?: number
  Vu?: number
}
export interface ColumnDrawing extends SectionGeometry {
  mark: string
  storyH?: number
  bars: BarChoice
  tie: ColumnDesign['tie']
  rho: number
}
export interface DrawingGroup {
  role: string
  from: number
  to: number
  beam?: {
    sec: { B: number; H: number }
    d: BeamDesign
    MuPos?: number
    MuNeg?: number
    Vu?: number
  }
  col?: { sec: { B: number; H: number }; d: ColumnDesign }
}
export interface DrawingSetData {
  spec?: BuildingSpec
  groups?: DrawingGroup[]
  colB?: number
  repSpan?: number
  storyH?: number
  roleLabel?: (role: string) => string
  date?: string
}
export interface GroupDifferenceNote {
  role: string
  from: number
  to: number
  diffs: string[]
}
export interface GroupDifferences {
  base: DrawingGroup
  notes: GroupDifferenceNote[]
}

export const DRAW_PROFILE: Record<string, DrawingProfile> = {
  tw: {
    name: 'TW 公會 標準圖',
    topExtraDiv: 3,
    botExtraDiv: 4,
    confineH: 2,
    txt: { mark: 220, callout: 150, dim: 120, title: 320 },
    ref: { beam: 'RC04 梁配筋', col: 'RC06 柱配筋', note: 'RC01 一般說明' },
    layers: [
      ['S-OUTLINE', 7],
      ['S-REBAR', 1],
      ['S-STIRR', 3],
      ['S-TEXT', 2],
      ['S-DIM', 4],
      ['S-TITLE', 5],
    ],
  },
}

function _hex4(n: number) {
  return ('000' + n.toString(16).toUpperCase()).slice(-4)
}

export function dxfStr(s: unknown) {
  let o = ''
  for (const ch of String(s)) {
    const c = ch.codePointAt(0)!
    o += c > 127 ? '\\U+' + _hex4(c) : ch
  }
  return o
}

function _barDia(dia: string | undefined) {
  const m = /(\d+)/.exec(String(dia || 'D25'))
  return m ? +m[1] : 25
}

export function DxfDoc(
  profile?: Partial<Pick<DrawingProfile, 'layers'>>,
): DxfDocument {
  const e: DxfEntity[] = []
  const lys = (profile && profile.layers) || [['0', 7]]
  const put: (entity: DxfEntity) => void = a => e.push(a)
  const api: DxfDocument = {
    line: (x1, y1, x2, y2, ly) => {
      put(['LINE', ly || '0', [10, x1, 20, y1, 30, 0, 11, x2, 21, y2, 31, 0]])
      return api
    },
    rect: (x, y, w, h, ly) => {
      api.line(x, y, x + w, y, ly)
      api.line(x + w, y, x + w, y + h, ly)
      api.line(x + w, y + h, x, y + h, ly)
      api.line(x, y + h, x, y, ly)
      return api
    },
    circle: (x, y, r, ly) => {
      put(['CIRCLE', ly || '0', [10, x, 20, y, 30, 0, 40, r]])
      return api
    },
    text: (x, y, h, s, ly, o) => {
      o = o || {}
      const al = o.align === 'center' ? 1 : o.align === 'right' ? 2 : 0
      const g = [10, x, 20, y, 30, 0, 40, h, 1, dxfStr(s), 50, o.rot || 0]
      if (al) {
        g.push(72, al, 11, x, 21, y, 31, 0)
      }
      put(['TEXT', ly || '0', g])
      return api
    },
    toString: () => {
      let s =
        '0\nSECTION\n2\nHEADER\n9\n$ACADVER\n1\nAC1009\n9\n$INSUNITS\n70\n4\n0\nENDSEC\n'
      s += '0\nSECTION\n2\nTABLES\n0\nTABLE\n2\nLAYER\n70\n' + lys.length + '\n'
      lys.forEach(([n, c]) => {
        s += '0\nLAYER\n2\n' + n + '\n70\n0\n62\n' + c + '\n6\nCONTINUOUS\n'
      })
      s += '0\nENDTAB\n0\nENDSEC\n0\nSECTION\n2\nENTITIES\n'
      for (const [t, ly, g] of e) {
        s += '0\n' + t + '\n8\n' + ly + '\n'
        for (let i = 0; i < g.length; i += 2) s += g[i] + '\n' + g[i + 1] + '\n'
      }
      return s + '0\nENDSEC\n0\nEOF\n'
    },
  }
  return api
}

export function beamRebarDXF(
  doc: DxfDocument,
  ox: number,
  oy: number,
  P: BeamDrawing,
  prof?: DrawingProfile,
) {
  prof = prof || DRAW_PROFILE.tw
  const b = P.b,
    h = P.h,
    Ln = P.Ln,
    cov = 40,
    T = prof.txt
  const L = {
    o: 'S-OUTLINE',
    r: 'S-REBAR',
    s: 'S-STIRR',
    t: 'S-TEXT',
    d: 'S-DIM',
  }
  doc.rect(ox, oy, Ln, h, L.o) // 입면 외곽
  doc.line(ox + 30, oy + h - cov, ox + Ln - 30, oy + h - cov, L.r) // 상부 연속근
  const te = Ln / prof.topExtraDiv // 단부 상부 추가근 Ln/3
  doc.line(ox + 30, oy + h - cov - 50, ox + 30 + te, oy + h - cov - 50, L.r)
  doc.line(
    ox + Ln - 30 - te,
    oy + h - cov - 50,
    ox + Ln - 30,
    oy + h - cov - 50,
    L.r,
  )
  doc.line(ox + 30, oy + cov, ox + Ln - 30, oy + cov, L.r) // 하부 연속근
  const be = Ln / prof.botExtraDiv // 중앙 하부 추가근
  doc.line(
    ox + Ln / 2 - be,
    oy + cov + 50,
    ox + Ln / 2 + be,
    oy + cov + 50,
    L.r,
  )
  const sMid = P.stirrup.s,
    sEnd = Math.max(50, Math.round(sMid / 2 / 10) * 10),
    cz = Math.min(prof.confineH * h, Ln * 0.3)
  const xs = []
  for (let x = cov; x < cz; x += sEnd) xs.push(x)
  for (let x = cz; x <= Ln - cz; x += sMid) xs.push(x)
  for (let x = Ln - cz; x <= Ln - cov; x += sEnd) xs.push(x)
  xs.forEach(x => doc.line(ox + x, oy + cov, ox + x, oy + h - cov, L.s)) // 스터럽
  doc.text(
    ox + Ln / 2,
    oy + h + T.callout * 0.6,
    T.callout,
    `上 T:${P.barsTop.n}-${P.barsTop.dia} (端部追加 Ln/${prof.topExtraDiv})`,
    L.t,
    { align: 'center' },
  )
  doc.text(
    ox + Ln / 2,
    oy - T.callout * 1.4,
    T.callout,
    `下 B:${P.barsBot.n}-${P.barsBot.dia}`,
    L.t,
    { align: 'center' },
  )
  doc.text(
    ox + cz / 2,
    oy + h / 2,
    T.dim,
    `${P.stirrup.leg}-${P.stirrup.dia}@${sEnd}`,
    L.t,
    { align: 'center' },
  )
  doc.text(ox + Ln / 2, oy + h / 2, T.dim, `@${sMid}`, L.t, { align: 'center' })
  doc.text(ox, oy + h + T.mark * 1.3, T.mark, `${P.mark}  ${b}x${h}`, L.t, {})
  doc.text(ox + Ln / 2, oy - T.dim * 3, T.dim, `Ln=${Math.round(Ln)}`, L.d, {
    align: 'center',
  })
  // 단면도(우측)
  const sx = ox + Ln + 1400,
    r = _barDia(P.barsTop.dia) / 2
  void r
  doc.rect(sx, oy, b, h, L.o)
  doc.rect(sx + cov, oy + cov, b - 2 * cov, h - 2 * cov, L.s)
  const row: (n: number, y: number, diameter: string) => void = (
    n,
    yy,
    dia,
  ) => {
    const rr = _barDia(dia) / 2,
      iw = b - 2 * cov - 2 * rr
    for (let i = 0; i < n; i++) {
      const xx = sx + cov + rr + (n > 1 ? (i * iw) / (n - 1) : iw / 2)
      doc.circle(xx, yy, rr, L.r)
    }
  }
  row(P.barsTop.n, oy + h - cov, P.barsTop.dia)
  row(P.barsBot.n, oy + cov, P.barsBot.dia)
  doc.text(sx + b / 2, oy + h + T.dim, T.dim, '斷面', L.t, { align: 'center' })
  return { w: Ln + 900 + b, h: h }
}

export function rebarSheetDXF(groups: BeamDrawing[], opts?: DrawingOptions) {
  opts = opts || {}
  const prof = opts.profile || DRAW_PROFILE.tw,
    doc = DxfDoc(prof),
    T = prof.txt
  let y = 0
  const pitch: (height: number) => number = h => h + 2200
  let maxw = 0
  doc.text(
    0,
    1200 + (groups.length ? 0 : 0),
    T.title,
    opts.title || '梁配筋圖 (Beam Rebar)',
    'S-TITLE',
    {},
  )
  doc.text(
    0,
    1200 - T.callout * 1.4,
    T.callout,
    `配筋詳圖依 ${prof.ref.beam} 標準圖 / ${prof.ref.note}`,
    'S-TEXT',
    {},
  )
  // 도면들은 타이틀 아래로 쌓는다(아래로 내려가며)
  y = -200
  groups.forEach(g => {
    y -= pitch(g.h)
    const r = beamRebarDXF(doc, 0, y, g, prof)
    if (r.w > maxw) maxw = r.w
  })
  return doc.toString()
}

const _ZH = ['零', '一', '二', '三', '四', '五', '六', '七', '八', '九', '十']

export function zhNum(n: number) {
  n = Math.abs(n)
  if (n <= 10) return _ZH[n]
  if (n < 20) return '十' + (n % 10 ? _ZH[n % 10] : '')
  const t = Math.floor(n / 10),
    o = n % 10
  return (t > 1 ? _ZH[t] : '') + '十' + (o ? _ZH[o] : '')
}

export function floorLabelTW(idx: number, role: string) {
  if (role === 'BASEMENT')
    return { short: 'B' + idx, zh: '地下' + zhNum(idx) + '層' }
  if (role === 'ROOF') return { short: 'RF', zh: '屋頂層' }
  return { short: idx + 'F', zh: zhNum(idx) + '樓' }
}

function _twoFaceBars(
  doc: DxfDocument,
  x: number,
  y: number,
  w: number,
  h: number,
  n: number,
  r: number,
  ly: string,
) {
  const nb = Math.ceil(n / 2),
    nt = Math.max(1, n - nb)
  const row: (count: number, y: number) => void = (c, yy) => {
    for (let i = 0; i < c; i++) {
      const xx = x + r + (c > 1 ? (i * (w - 2 * r)) / (c - 1) : (w - 2 * r) / 2)
      doc.circle(xx, yy, r, ly)
    }
  }
  row(nb, y + r)
  row(nt, y + h - r)
}

export function columnRebarDXF(
  doc: DxfDocument,
  ox: number,
  oy: number,
  P: ColumnDrawing,
  prof?: DrawingProfile,
) {
  prof = prof || DRAW_PROFILE.tw
  const b = P.b,
    h = P.h,
    Hs = P.storyH || 3200,
    cov = 40,
    T = prof.txt
  const L = {
    o: 'S-OUTLINE',
    r: 'S-REBAR',
    s: 'S-STIRR',
    t: 'S-TEXT',
    d: 'S-DIM',
  }
  doc.rect(ox, oy, b, Hs, L.o)
  doc.line(ox + cov, oy, ox + cov, oy + Hs, L.r)
  doc.line(ox + b - cov, oy, ox + b - cov, oy + Hs, L.r)
  const cz = Math.max(h, Hs / 6),
    sEnd = Math.max(50, Math.round(P.tie.s / 2 / 10) * 10),
    sMid = P.tie.s
  const ys = []
  for (let y = cov; y < cz; y += sEnd) ys.push(y)
  for (let y = cz; y <= Hs - cz; y += sMid) ys.push(y)
  for (let y = Hs - cz; y <= Hs - cov; y += sEnd) ys.push(y)
  ys.forEach(y => doc.line(ox + cov, oy + y, ox + b - cov, oy + y, L.s))
  doc.text(ox, oy + Hs + T.mark * 1.3, T.mark, `${P.mark}  ${b}x${h}`, L.t, {})
  const cxt = ox + b + 400 // 콜아웃 x(입면 우측, 단면과 충분히 이격)
  doc.text(
    cxt,
    oy + Hs * 0.62,
    T.callout,
    `主筋 ${P.bars.n}-${P.bars.dia} (ρ${(P.rho * 100).toFixed(1)}%)`,
    L.t,
    {},
  )
  doc.text(
    cxt,
    oy + Hs * 0.62 - T.callout * 1.8,
    T.dim,
    `箍 ${P.tie.dia}@${sMid} (中央) / @${sEnd} (端部加密)`,
    L.t,
    {},
  )
  const sx = ox + b + 3200
  doc.rect(sx, oy, b, h, L.o)
  doc.rect(sx + cov, oy + cov, b - 2 * cov, h - 2 * cov, L.s)
  _twoFaceBars(
    doc,
    sx + cov,
    oy + cov,
    b - 2 * cov,
    h - 2 * cov,
    P.bars.n,
    _barDia(P.bars.dia) / 2,
    L.r,
  )
  doc.text(sx + b / 2, oy + h + T.dim, T.dim, '柱斷面', L.t, {
    align: 'center',
  })
}

export function tableDXF(
  doc: DxfDocument,
  ox: number,
  oy: number,
  headers: unknown[],
  rows: unknown[][],
  colW: number[],
  prof?: DrawingProfile,
  title?: string,
) {
  prof = prof || DRAW_PROFILE.tw
  const T = prof.txt,
    rh = T.callout * 2.2,
    L = 'S-TEXT',
    LO = 'S-OUTLINE'
  const totW = colW.reduce((a, c) => a + c, 0)
  let top = oy
  if (title) {
    doc.text(ox, oy + rh * 0.4, T.mark, title, L, {})
    top = oy - rh * 0.7
  }
  const all = [headers].concat(rows),
    nR = all.length
  all.forEach((rw, ri) => {
    const ry = top - ri * rh
    let cx = ox
    rw.forEach((cell, ci) => {
      doc.text(cx + colW[ci] / 2, ry - rh * 0.66, T.callout, String(cell), L, {
        align: 'center',
      })
      cx += colW[ci]
    })
  })
  const bot = top - nR * rh
  let cx = ox
  for (let i = 0; i <= colW.length; i++) {
    doc.line(cx, top, cx, bot, LO)
    if (i < colW.length) cx += colW[i]
  }
  for (let i = 0; i <= nR; i++)
    doc.line(ox, top - i * rh, ox + totW, top - i * rh, LO)
  return { w: totW, h: nR * rh + (title ? rh : 0) }
}

export function titleBlockDXF(
  doc: DxfDocument,
  ox: number,
  oy: number,
  info: Record<string, string | undefined>,
  prof?: DrawingProfile,
) {
  prof = prof || DRAW_PROFILE.tw
  const T = prof.txt,
    w = 6500,
    h = 1600,
    L = 'S-TITLE',
    LT = 'S-TEXT'
  info = info || {}
  const xd = ox + w * 0.58 // 좌/우 칸 경계
  doc.rect(ox, oy, w, h, L)
  doc.line(ox, oy + h * 0.5, ox + w, oy + h * 0.5, L)
  doc.line(xd, oy, xd, oy + h, L)
  doc.text(ox + 220, oy + h * 0.6, T.title, info.title || '梁柱配筋圖', LT, {}) // 좌상: 圖名(大)
  doc.text(xd + 200, oy + h * 0.7, T.dim, info.code || 'TWD-USD112', LT, {}) // 우상1
  doc.text(
    xd + 200,
    oy + h * 0.55,
    T.dim,
    info.org || '依 公會 RC 標準圖',
    LT,
    {},
  ) // 우상2
  doc.text(
    ox + 220,
    oy + h * 0.16,
    T.dim,
    `圖號 ${info.sheet || 'S-01'}    比例 ${info.scale || 'NTS'}`,
    LT,
    {},
  ) // 좌하
  doc.text(
    xd + 200,
    oy + h * 0.16,
    T.dim,
    `設計 ${info.by || 'Dennis'}    日期 ${info.date || ''}`,
    LT,
    {},
  ) // 우하
}

export function framingPlanDXF(
  doc: DxfDocument,
  ox: number,
  oy: number,
  spec: BuildingSpec,
  prof?: DrawingProfile,
  colB?: number,
) {
  prof = prof || DRAW_PROFILE.tw
  const T = prof.txt,
    LO = 'S-OUTLINE',
    LB = 'S-REBAR',
    LT = 'S-TEXT'
  const sx = asSpans(spec.spanX, spec.bayX),
    sy = asSpans(spec.spanY, spec.bayY)
  const Xp = cumPos(sx),
    Yp = cumPos(sy)
  colB = colB || 600
  const x1 = Xp[Xp.length - 1],
    y1 = Yp[Yp.length - 1]
  Yp.forEach(y => doc.line(ox + Xp[0], oy + y, ox + x1, oy + y, LB))
  Xp.forEach(x => doc.line(ox + x, oy + Yp[0], ox + x, oy + y1, LB))
  Xp.forEach(x =>
    Yp.forEach(y =>
      doc.rect(ox + x - colB / 2, oy + y - colB / 2, colB, colB, LO),
    ),
  )
  Xp.forEach((x, i) =>
    doc.text(ox + x, oy + Yp[0] - 800, T.callout, String(i + 1), LT, {
      align: 'center',
    }),
  )
  Yp.forEach((y, i) =>
    doc.text(
      ox + Xp[0] - 800,
      oy + y,
      T.callout,
      String.fromCharCode(65 + i),
      LT,
      { align: 'center' },
    ),
  )
  return { w: x1, h: y1 }
}

export function groupDiffNotes(
  groups?: DrawingGroup[],
): GroupDifferences | null {
  const gs = (groups || []).filter(g => g.beam || g.col)
  if (!gs.length) return null
  const span: (group: DrawingGroup) => number = g => g.to - g.from + 1
  const typ = gs
    .filter(g => g.role === 'TYPICAL')
    .sort((a, b) => span(b) - span(a))
  const base = typ[0] || gs.slice().sort((a, b) => span(b) - span(a))[0]
  if (!base) return null
  const bt: (beam: BeamDesign | undefined) => string = x =>
      x ? `${x.barsTop.n}-${x.barsTop.dia}` : '',
    bb: (beam: BeamDesign | undefined) => string = x =>
      x ? `${x.barsBot.n}-${x.barsBot.dia}` : '',
    bs: (beam: BeamDesign | undefined) => string = x =>
      x ? `${x.stirrup.dia}@${x.stirrup.s}` : '',
    cb: (column: ColumnDesign | undefined) => string = x =>
      x ? `${x.bars.n}-${x.bars.dia}` : '',
    ct: (column: ColumnDesign | undefined) => string = x =>
      x ? `${x.tie.dia}@${x.tie.s}` : ''
  const notes: GroupDifferenceNote[] = []
  gs.forEach(g => {
    if (g === base) return
    const d: string[] = []
    if (g.beam && base.beam) {
      const A = base.beam,
        Bg = g.beam
      if (A.sec.B !== Bg.sec.B || A.sec.H !== Bg.sec.H)
        d.push(`梁斷面 ${A.sec.B}×${A.sec.H}→${Bg.sec.B}×${Bg.sec.H}`)
      if (bt(A.d) !== bt(Bg.d)) d.push(`梁上筋 ${bt(A.d)}→${bt(Bg.d)}`)
      if (bb(A.d) !== bb(Bg.d)) d.push(`梁下筋 ${bb(A.d)}→${bb(Bg.d)}`)
      if (bs(A.d) !== bs(Bg.d)) d.push(`梁箍 ${bs(A.d)}→${bs(Bg.d)}`)
    }
    if (g.col && base.col) {
      const A = base.col,
        Cg = g.col
      if (A.sec.B !== Cg.sec.B || A.sec.H !== Cg.sec.H)
        d.push(`柱斷面 ${A.sec.B}×${A.sec.H}→${Cg.sec.B}×${Cg.sec.H}`)
      if (cb(A.d) !== cb(Cg.d)) d.push(`柱主筋 ${cb(A.d)}→${cb(Cg.d)}`)
      if (ct(A.d) !== ct(Cg.d)) d.push(`柱箍 ${ct(A.d)}→${ct(Cg.d)}`)
    }
    notes.push({ role: g.role, from: g.from, to: g.to, diffs: d })
  })
  return { base, notes }
}

export function diffNoteDXF(
  doc: DxfDocument,
  ox: number,
  oy: number,
  dn: GroupDifferences,
  RL: (role: string) => string,
  prof?: DrawingProfile,
) {
  prof = prof || DRAW_PROFILE.tw
  const T = prof.txt,
    L = 'S-TEXT'
  const fr: (group: { from: number; to: number }) => string = g =>
    g.from === g.to ? `${g.from}F` : `${g.from}~${g.to}F`
  doc.text(
    ox,
    oy,
    T.callout,
    `本圖以 標準層(${RL(dn.base.role)} ${fr(dn.base)}) 為基準；其餘樓層僅標示差異，餘同標準層。`,
    L,
    {},
  )
  let y = oy - T.callout * 1.9
  dn.notes.forEach(n => {
    doc.text(
      ox,
      y,
      T.dim,
      `· ${RL(n.role)}(${fr(n)}): ${n.diffs.length ? n.diffs.join('  ·  ') : '同標準層'}`,
      L,
      {},
    )
    y -= T.dim * 1.8
  })
  return { h: oy - y }
}

export function drawingSetDXF(data: DrawingSetData, opts?: DrawingOptions) {
  opts = opts || {}
  const prof = opts.profile || DRAW_PROFILE.tw,
    doc = DxfDoc(prof),
    T = prof.txt
  const RL: (role: string) => string = data.roleLabel || (r => r)
  const gap = 4500
  let y = 0
  const head: (text: string) => void = s => {
    doc.text(0, y, T.title, s, 'S-TITLE', {})
    y -= T.title * 1.8
  }
  const fr: (group: DrawingGroup) => string = g =>
    g.from === g.to ? `${g.from}F` : `${g.from}~${g.to}F`
  const bmk: (group: DrawingGroup) => string = g => `梁 ${RL(g.role)} ${fr(g)}`,
    cmk: (group: DrawingGroup) => string = g => `柱 ${RL(g.role)} ${fr(g)}`
  // 1. 골조 평면도(보조)
  if (data.spec) {
    head('① ' + (opts.t_plan || '標準層 골조 평면도 (參考)'))
    const sy = asSpans(data.spec.spanY, data.spec.bayY),
      ph = cumPos(sy).pop()!
    framingPlanDXF(doc, 0, y - ph, data.spec, prof, data.colB)
    y -= ph + gap + 1500
  }
  // 2. 梁配筋圖
  head('② 梁配筋圖')
  doc.text(
    0,
    y,
    T.callout,
    `配筋詳圖依 ${prof.ref.beam} / ${prof.ref.note}`,
    'S-TEXT',
    {},
  )
  y -= T.callout * 2
  ;(data.groups || [])
    .filter(g => g.beam)
    .forEach(g => {
      const h = g.beam!.sec.H
      y -= h + gap + 1200
      beamRebarDXF(
        doc,
        0,
        y,
        {
          mark: bmk(g),
          b: g.beam!.sec.B,
          h: h,
          Ln: data.repSpan || 6600,
          barsTop: g.beam!.d.barsTop,
          barsBot: g.beam!.d.barsBot,
          stirrup: g.beam!.d.stirrup,
          MuPos: g.beam!.MuPos,
          MuNeg: g.beam!.MuNeg,
          Vu: g.beam!.Vu,
        },
        prof,
      )
    })
  y -= gap
  // 3. 柱配筋圖
  head('③ 柱配筋圖')
  doc.text(0, y, T.callout, `配筋詳圖依 ${prof.ref.col}`, 'S-TEXT', {})
  y -= T.callout * 2
  ;(data.groups || [])
    .filter(g => g.col)
    .forEach(g => {
      const Hs = data.storyH || 3200
      y -= Hs + gap + 1200
      columnRebarDXF(
        doc,
        0,
        y,
        {
          mark: cmk(g),
          b: g.col!.sec.B,
          h: g.col!.sec.H,
          storyH: Hs,
          bars: g.col!.d.bars,
          tie: g.col!.d.tie,
          rho: g.col!.d.rho,
        },
        prof,
      )
    })
  y -= gap
  // 4. 梁表 / 柱表
  head('④ 梁表 / 柱表')
  const bRows = (data.groups || [])
    .filter(g => g.beam)
    .map(g => [
      bmk(g),
      `${g.beam!.sec.B}x${g.beam!.sec.H}`,
      `${g.beam!.d.barsTop.n}-${g.beam!.d.barsTop.dia}`,
      `${g.beam!.d.barsBot.n}-${g.beam!.d.barsBot.dia}`,
      `${g.beam!.d.stirrup.leg}-${g.beam!.d.stirrup.dia}@${g.beam!.d.stirrup.s}`,
    ])
  const rb = tableDXF(
    doc,
    0,
    y,
    ['梁', '斷面', '上筋', '下筋', '箍筋'],
    bRows,
    [3600, 1800, 1800, 1800, 2400],
    prof,
    '梁表',
  )
  const cRows = (data.groups || [])
    .filter(g => g.col)
    .map(g => [
      cmk(g),
      `${g.col!.sec.B}x${g.col!.sec.H}`,
      `${g.col!.d.bars.n}-${g.col!.d.bars.dia}`,
      `${g.col!.d.tie.dia}@${g.col!.d.tie.s}`,
      `${(g.col!.d.rho * 100).toFixed(1)}%`,
    ])
  tableDXF(
    doc,
    rb.w + 1500,
    y,
    ['柱', '斷面', '主筋', '箍筋', 'ρ'],
    cRows,
    [3600, 1800, 1800, 1800, 1200],
    prof,
    '柱表',
  )
  y -= Math.max(rb.h, 1) + gap
  // 5. 層別 差異 註記 (표준층 기준)
  const dn = groupDiffNotes(data.groups)
  if (dn) {
    head('⑤ 層別 差異 註記 (基準: 標準層)')
    const r = diffNoteDXF(doc, 0, y, dn, RL, prof)
    y -= r.h + gap
  }
  // 6. 표제란
  titleBlockDXF(
    doc,
    0,
    y - 1500,
    {
      title: opts.title || '梁柱配筋圖',
      sheet: opts.sheet || 'S-01',
      date: data.date || '',
      by: 'Dennis',
      org: '依 公會 RC01/RC04/RC06 標準圖',
      code: 'TWD-USD112',
    },
    prof,
  )
  return doc.toString()
}
