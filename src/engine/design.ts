/* Behavior-preserving port of shared/rc_engine.js. Equations and iteration order are unchanged. */
import { _MPA2CNS, _CNS_CONC } from './spec'
import type {
  BeamDemand,
  ColumnDemand,
  SectionGeometry,
  ConcreteDesignMaterial,
  BarChoice,
  StirrupCheck,
  RebarLayer,
  InteractionCurve,
  InteractionPoint,
} from './types'

export const KGFCM2_TO_MPA = 0.0980665

export function fcMPa(matName: string) {
  const g = _CNS_CONC.includes(matName) ? matName : _MPA2CNS[matName] || 'C280'
  return +g.slice(1) * KGFCM2_TO_MPA
}

export const REBAR_FY = { SD280: 280, SD420: 420, SD490: 490 }

export const BAR_AREA = {
  D10: 113,
  D13: 127,
  D16: 199,
  D19: 287,
  D22: 387,
  D25: 507,
  D29: 642,
  D32: 794,
}

export const DEFAULT_REBAR = { fy: 420, fyt: 280, cover: 40 }

export function beamEffDepth(h: number, cover?: number) {
  return h - (cover || 40) - 10 - 16
}

export function flexAs(
  Mu: number,
  b: number,
  d: number,
  fc: number,
  fy: number,
) {
  if (!(Mu > 0)) return 0
  const Mn = Mu / 0.9,
    Rn = Mn / (b * d * d),
    t = 1 - (2 * Rn) / (0.85 * fc)
  if (t <= 0) return NaN
  return ((0.85 * fc) / fy) * (1 - Math.sqrt(t)) * b * d
}

export function flexAsMin(b: number, d: number, fc: number, fy: number) {
  return Math.max((0.25 * Math.sqrt(fc)) / fy, 1.4 / fy) * b * d
}

export function beta1(fc: number) {
  return fc <= 28 ? 0.85 : Math.max(0.65, 0.85 - (0.05 * (fc - 28)) / 7)
}

export function flexRhoMax(fc: number, fy: number) {
  return 0.85 * beta1(fc) * (fc / fy) * (0.003 / (0.003 + 0.005))
}

export function shearVc(b: number, d: number, fc: number) {
  return 0.17 * Math.sqrt(fc) * b * d
}

export function stirrupSpacing(
  Vu: number,
  b: number,
  d: number,
  fc: number,
  fyt: number,
  Av: number,
): StirrupCheck {
  const Vc = shearVc(b, d, fc),
    Vs = Vu / 0.75 - Vc,
    sMax = Math.min(d / 2, 600)
  if (Vs <= 0) return { s: sMax, Vs: 0, Vc, note: 'min' }
  if (Vs > 0.66 * Math.sqrt(fc) * b * d)
    return { s: 0, Vs, Vc, note: 'section' } // 단면 부족
  const sCap = Vs > 0.33 * Math.sqrt(fc) * b * d ? Math.min(d / 4, 300) : sMax
  return { s: Math.min((Av * fyt * d) / Vs, sCap), Vs, Vc, note: 'ok' }
}

export function pickBars(As: number): BarChoice {
  if (!(As > 0)) return { dia: '-', n: 0, As: 0 }
  for (const [dia, a] of [
    ['D19', 287],
    ['D22', 387],
    ['D25', 507],
    ['D29', 642],
  ] as [string, number][]) {
    const n = Math.ceil(As / a)
    if (n <= 8) return { dia, n: Math.max(2, n), As: Math.max(2, n) * a }
  }
  const n = Math.max(2, Math.ceil(As / 794))
  return { dia: 'D32', n, As: n * 794 }
}

export function rcBeamDesign(
  demand: BeamDemand,
  geom: SectionGeometry,
  mat: ConcreteDesignMaterial,
) {
  const resolvedMat = Object.assign({}, DEFAULT_REBAR, mat || {})
  const b = geom.b,
    h = geom.h,
    d = beamEffDepth(h, resolvedMat.cover),
    fc = resolvedMat.fc,
    fy = resolvedMat.fy,
    fyt = resolvedMat.fyt
  const asMin = flexAsMin(b, d, fc, fy),
    rhoMax = flexRhoMax(fc, fy),
    asMax = rhoMax * b * d
  const rawBot = flexAs(demand.MuPos || 0, b, d, fc, fy),
    rawTop = flexAs(demand.MuNeg || 0, b, d, fc, fy)
  const over =
    isNaN(rawBot) || isNaN(rawTop) || rawBot > asMax || rawTop > asMax
  const asBot = Math.max(isNaN(rawBot) ? asMax : rawBot, asMin),
    asTop = Math.max(isNaN(rawTop) ? asMax : rawTop, asMin)
  const sh = stirrupSpacing(demand.Vu || 0, b, d, fc, fyt, 2 * BAR_AREA.D10) // 2-leg D10
  return {
    b,
    h,
    d,
    asMin,
    asMax,
    asTop,
    asBot,
    barsTop: pickBars(asTop),
    barsBot: pickBars(asBot),
    stirrup: {
      dia: 'D10',
      leg: 2,
      Av: 2 * BAR_AREA.D10,
      s: Math.max(50, Math.floor(sh.s / 10) * 10),
      note: sh.note,
    },
    over,
  }
}

export const ES_STEEL = 200000,
  ECU = 0.003

export function colLayers(
  As: number,
  nBars: number,
  b: number,
  h: number,
  cover: number | undefined,
  axis?: 'x' | 'y',
): RebarLayer[] {
  const dp = (cover || 40) + 10 + 16 // 피복+띠철근(D10)+주근반경(D32 보수적)
  const depth = axis === 'y' ? b : h,
    width = axis === 'y' ? h : b
  const Hc = Math.max(1, depth - 2 * dp),
    Wc = Math.max(1, width - 2 * dp) // 주근 중심 둘레사각형
  const peri = 2 * (Hc + Wc),
    Abar = As / nBars,
    step = peri / nBars,
    acc: Map<number, number> = new Map()
  for (let i = 0; i < nBars; i++) {
    let s = step * i,
      y // (0,0)→(Wc,0)→(Wc,Hc)→(0,Hc) 둘레 진행
    if (s < Wc) y = 0
    else if (s < Wc + Hc) y = s - Wc
    else if (s < 2 * Wc + Hc) y = Hc
    else y = Hc - (s - 2 * Wc - Hc)
    const di = Math.round(dp + y)
    acc.set(di, (acc.get(di) || 0) + Abar)
  }
  return [...acc.entries()].map(([di, A]) => ({ di: +di, A }))
}

export function colPMcurve(
  layers: RebarLayer[],
  widthC: number,
  depth: number,
  fc: number,
  fy: number,
  Ast: number,
): InteractionCurve {
  const b1 = beta1(fc),
    ety = fy / ES_STEEL,
    pts: InteractionPoint[] = []
  const Po = 0.85 * fc * (widthC * depth - Ast) + fy * Ast // 순축 공칭(콘크리트 점유 공제)
  const phiPnMax = 0.8 * 0.65 * Po // ACI 318/TWD 띠철근 압축 평탄캡
  let balanced: InteractionPoint | null = null,
    prevEtl: number | null = null
  /* 순인장 앵커(c→0): φPt = −0.9·fy·Ast, M=0 */
  pts.push({ P: -0.9 * fy * Ast, M: 0 })
  for (let c = 0.03 * depth; c <= 3 * depth; c *= 1.04) {
    const a = Math.min(b1 * c, depth),
      Cc = 0.85 * fc * widthC * a
    let Ps = 0,
      Ms = 0,
      etl = 0,
      dmax = 0
    layers.forEach(L => {
      const es = (ECU * (c - L.di)) / c
      let fs = Math.max(-fy, Math.min(fy, ES_STEEL * es))
      const f = L.di < a ? fs - 0.85 * fc : fs
      Ps += L.A * f
      Ms += L.A * f * (depth / 2 - L.di)
      if (L.di >= dmax) {
        dmax = L.di
        etl = -es
      }
    }) // 최외측 인장철근 변형률(인장 +)
    const Pn = Cc + Ps,
      Mn = Cc * (depth / 2 - a / 2) + Ms
    let phi = 0.65
    if (etl >= 0.005) phi = 0.9
    else if (etl > ety) phi = 0.65 + ((etl - ety) * 0.25) / (0.005 - ety)
    let P = phi * Pn
    const M = phi * Math.abs(Mn)
    if (P > phiPnMax) P = phiPnMax // 압축지배 평탄부 클립
    if (prevEtl !== null && prevEtl >= ety && etl < ety && !balanced)
      balanced = { P: +P.toFixed(0), M: +M.toFixed(0) }
    prevEtl = etl
    pts.push({ P, M })
  }
  return { pts, Po, phiPnMax, balanced }
}

export function colMcapFrom(pts: InteractionPoint[], Pu: number) {
  let best = 0
  for (let i = 1; i < pts.length; i++) {
    const A = pts[i - 1],
      B = pts[i]
    if ((A.P - Pu) * (B.P - Pu) <= 0) {
      const t = (Pu - A.P) / (B.P - A.P || 1)
      best = Math.max(best, A.M + t * (B.M - A.M))
    }
  }
  return best
}

export function colPMpoints(
  rho: number,
  b: number,
  h: number,
  fc: number,
  fy: number,
  cover?: number,
) {
  const Ast = rho * b * h
  return colPMcurve(colLayers(Ast, 8, b, h, cover, 'x'), b, h, fc, fy, Ast).pts
}

export function colMcapAt(
  rho: number,
  b: number,
  h: number,
  fc: number,
  fy: number,
  cover: number | undefined,
  Pu: number,
) {
  return colMcapFrom(colPMpoints(rho, b, h, fc, fy, cover), Pu)
}

export function pickColBars(As: number): BarChoice {
  for (const [dia, a] of [
    ['D22', 387],
    ['D25', 507],
    ['D29', 642],
    ['D32', 794],
  ] as [string, number][]) {
    let n = Math.ceil(As / a)
    if (n % 2) n++
    n = Math.max(4, n)
    if (n <= 16) return { dia, n, As: n * a }
  }
  let n = Math.max(4, Math.ceil(As / 794))
  if (n % 2) n++
  return { dia: 'D32', n, As: n * 794 }
}

export function rcColumnDesign(
  demand: ColumnDemand,
  geom: SectionGeometry,
  mat: ConcreteDesignMaterial,
) {
  const resolvedMat = Object.assign({}, DEFAULT_REBAR, mat || {})
  const b = geom.b,
    h = geom.h,
    fc = resolvedMat.fc,
    fy = resolvedMat.fy,
    cover = resolvedMat.cover,
    A = 1.0
  const Pu = Math.abs(demand.Pu || 0),
    Mux = Math.abs(demand.Mux || 0),
    Muy = Math.abs(demand.Muy || 0)
  const curve: (
    rho: number,
    nBars: number,
    axis: 'x' | 'y',
  ) => InteractionCurve = (rho, nB, axis) => {
    const Ast = rho * b * h
    const wC = axis === 'y' ? h : b,
      dp = axis === 'y' ? b : h
    return colPMcurve(
      colLayers(Ast, nB, b, h, cover, axis),
      wC,
      dp,
      fc,
      fy,
      Ast,
    )
  }
  const util: (rho: number, nBars: number) => number = (rho, nB) => {
    const Mnx = colMcapFrom(curve(rho, nB, 'x').pts, Pu),
      Mny = colMcapFrom(curve(rho, nB, 'y').pts, Pu)
    if (Mux > 0 && Mnx <= 0) return 9
    if (Muy > 0 && Mny <= 0) return 9
    return (
      (Mnx > 0 ? Math.pow(Mux / Mnx, A) : 0) +
      (Mny > 0 ? Math.pow(Muy / Mny, A) : 0)
    )
  }
  let lo = 0.01,
    hi = 0.06,
    ok = false
  for (let it = 0; it < 26; it++) {
    const mid = (lo + hi) / 2
    if (util(mid, 8) <= 1.0) {
      hi = mid
      ok = true
    } else lo = mid
  }
  const rho0 = ok ? hi : 0.06
  const bars = pickColBars(rho0 * b * h)
  const rho = bars.As / (b * h) // 실제 배근 기준 ρ
  const fx = curve(rho, bars.n, 'x'),
    fy_ = curve(rho, bars.n, 'y')
  const MnX = colMcapFrom(fx.pts, Pu),
    MnY = colMcapFrom(fy_.pts, Pu)
  let U =
    (Mux > 0 && MnX <= 0) || (Muy > 0 && MnY <= 0)
      ? 9
      : (MnX > 0 ? Math.pow(Mux / MnX, A) : 0) +
        (MnY > 0 ? Math.pow(Muy / MnY, A) : 0)
  const axialCap = fx.phiPnMax,
    over = !ok || U > 1.0 || Pu > axialCap
  const dbLong = +bars.dia.slice(1) // 실 주근 직경(mm)
  const tieS = Math.min(16 * dbLong, 48 * 10, Math.min(b, h)) // min(16db_long, 48db_tie, 최소변)
  return {
    b,
    h,
    rho,
    As: bars.As,
    bars,
    tie: { dia: 'D10', s: Math.floor(tieS / 10) * 10 },
    over,
    Pu,
    Mux,
    Muy,
    util: +U.toFixed(3),
    pm: {
      x: fx.pts,
      y: fy_.pts,
      Po: +fx.Po.toFixed(0),
      phiPnMax: +axialCap.toFixed(0),
      MnX: +MnX.toFixed(0),
      MnY: +MnY.toFixed(0),
      balX: fx.balanced,
      balY: fy_.balanced,
    },
  }
}

export type BeamDesign = ReturnType<typeof rcBeamDesign>
export type ColumnDesign = ReturnType<typeof rcColumnDesign>
