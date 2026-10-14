/* ════════════════════════════════════════════════════════════
   대만 프로필 — 建築物耐震設計規範及解說(113年) / 混凝土結構設計規範(112) / 建築物耐風設計規範(2014).
   2026-10-12 원문 대조 재구현 (이전: shared/rc_engine.js 의 ASCE 7 형식 — Wizard 는 여전히 그쪽 사용).
   근거 KB: E:/MIDAS PROGRAM/COde/TW/knowledge/{seismic-design-code,concrete-design-code-112,wind-load-2014}
   - 지진: 2.2 V = I/(1.4αy)·(SaD/Fu)m·W (2-2 수정), 2.10.1 V* = I·Fu/(4.2αy)·(SaD/Fu)m·W(분지 3.5), 2.10.2 VM(SMS·SM1 입력 시)
           2.9 Ra = 1+(R−1)/1.5(분지 2.0), Fu(T) (2-12) / 2.6 T = 0.070hn^¾(RC 골조)·0.050hn^¾(벽), 해석주기 ≤ 1.4×경험
           표2-5(a)·2-7(a) SaD / 2.11 Ft = 0.07TV(≤0.25V, T≤0.7s → 0) + (V−Ft)·Wh/ΣWh / 2.14 意外扭矩 5%
           2.2 W = 전체 정하중 + 활동칸막이 75kgf/m²(창고·서고만 활하중 1/4) / αy = 1.0 (112 5.3 해설: 극한강도+지진계수 1.0)
           3.1 동적해석 의무(H ≥ 50m 또는 15층 이상) / 3.2 RS 조정계수 C / 3.3 총횡력 ≥ 정적 V × 90%(정형)·100%(비정형)
   - 조합: 112 5.3.1 (a)~(g) — 풍 1.6W·0.8W(대만 풍하중은 사용하중 수준), 지진 1.0E. 5.3.3 의 L 0.5 감소는 미사용(보수적)
   - 풍: 2.6 q(z) = 0.06·K(z)·[I·V10(C)]² kgf/m², K(z) = 2.774(z/zg)^2α (z ≤ 5m 는 5m), 표2.2 α·zg,
         2.7 G = 1.88(보통 건물), 표2.4 Cp 풍상 0.8·q(z) / 풍하 −0.5~−0.2·q(h)
   알려진 단순화: 지하층 지진력(2.12) 미산정(지상만 분배), 2.14 Ax 증폭·± 편심 2케이스 미구현(+ 방향 1개),
   VM 지배 시 RS 는 SaD 형상 × (VM 계수/SaD(T₁)) 근사, 풍 가로·비틀림(2.10~2.13)·유연건물 G 미구현.
════════════════════════════════════════════════════════════ */
import { RC } from '../engine'
import type { BuildingSpec } from '../engine/types'
import { t } from '../i18n'
import { num as numOf } from '../mapi/tables'
import { heightAboveGround, modelColumnWeights, modelDeadWeights } from './selfweight'
import { twReviewEvaluate, twReviewTables } from './twReview'
import type { CodeProfile, Combo, LoadCaseRef, ParamField, StoryForce } from './types'

const KGF = 0.00980665                  // kgf/m² → kN/m²
const PARTITION = 75 * KGF              // 활동칸막이 75 kgf/m² (2.2 W) — 지붕 외 바닥 DL 에 포함
const ALPHA_Y = 1.0                     // RC 극한강도설계 (112 5.3 해설)

/** 바닥하중 — 활하중은 엔진 표(대만 건축기술규칙 값), SDL 에 칸막이 75kgf/m² 가산(지붕 제외) */
const FLOOR_USE: CodeProfile['floorUse'] = Object.fromEntries(Object.entries(RC.FLOOR_USE as CodeProfile['floorUse'])
  .map(([u, v]) => [u, { ...v, sdl: u === 'Roof' ? v.sdl : +(v.sdl + PARTITION).toFixed(4) }]))

/** 112 19.2.2.1(b) Ec = 12,000√fc' (kgf/cm²) → MPa. Gen CNS560(RC) DB 는 구판식(≈15,000√fc')이라 1.241배 — 라이브 2026-10-14 */
const ecMPa = (grade: string) => Math.round(12000 * Math.sqrt(+String(grade).replace(/\D/g, '')) * 0.0980665)
const MATERIALS112: CodeProfile['materials'] = Object.fromEntries(Object.entries(RC.MATERIALS as CodeProfile['materials'])
  .map(([k, v]) => [k, { ...v, E: ecMPa(k) }]))

/* ── 지진 ─────────────────────────────────────────────── */

/** 부지 계수 — T0 가 있으면 대북분지(표2-7(a), SD1 = SDS·T0D) */
export function siteTW(sp: Record<string, any>) {
  const SDS = +sp.SDS || 0
  const basin = +sp.T0 > 0
  const SD1 = +sp.SD1 > 0 ? +sp.SD1 : basin ? SDS * sp.T0 : 0
  const T0D = basin ? +sp.T0 : SDS > 0 ? SD1 / SDS : 0
  return { SDS, SD1, T0D, basin }
}

/** 표2-5(a)/2-7(a) 설계 수평 스펙트럼 계수 (중주기 S·T0/T = SD1/T) */
export function saTW(T: number, S: number, T0: number): number {
  if (!(S > 0) || !(T0 > 0)) return 0
  if (T <= 0.2 * T0) return S * (0.4 + 3 * T / T0)
  if (T <= T0) return S
  if (T <= 2.5 * T0) return S * T0 / T
  return 0.4 * S
}

/** (2-12) 구조계 지진력 감소계수 Fu */
export function fuTW(T: number, Ra: number, T0: number): number {
  const r = Math.sqrt(2 * Ra - 1)
  if (T >= T0) return Ra
  if (T >= 0.6 * T0) return r + (Ra - r) * (T - 0.6 * T0) / (0.4 * T0)
  if (T >= 0.2 * T0) return r
  return r + (r - 1) * (T - 0.2 * T0) / (0.2 * T0)
}

/** (2-2) (SaD/Fu)m */
export function modTW(x: number): number {
  if (x <= 0.3) return x
  if (x < 0.8) return 0.52 * x + 0.144
  return 0.70 * x
}

const hasWalls = (p: BuildingSpec) => !!((p.core as any)?.on || (Array.isArray(p.walls) && p.walls.length))

/** 2.6 경험주기 — RC 골조 0.070hn^¾, 벽(코어) 있으면 0.050hn^¾. hn = 기면(지상)~지붕 (m) */
export function periodTW(p: BuildingSpec): number {
  return (hasWalls(p) ? 0.050 : 0.070) * Math.pow(Math.max(heightAboveGround(p), 0.1), 0.75)
}

/** 설계주기 — 직접입력·해석주기는 경험주기 1.4배 상한(2.6) */
function designT(p: BuildingSpec, sp: Record<string, any>, Tin?: number) {
  const Ta = periodTW(p)
  const T = sp.T > 0 ? +sp.T : Tin
  return { Ta, T: T != null && T > 0 ? Math.min(T, 1.4 * Ta) : Ta }
}

/** V/W 계수 — 2.2 V, 2.10.1 V*, 2.10.2 VM 중 최대 */
export function coefTW(T: number, sp: Record<string, any>) {
  const { SDS, T0D, basin } = siteTW(sp)
  const I = sp.I != null ? +sp.I : 1.0, R = sp.R != null ? +sp.R : 4.8
  const Ra = 1 + (R - 1) / (basin ? 2.0 : 1.5)
  const SaD = saTW(T, SDS, T0D), Fu = fuTW(T, Ra, T0D)
  const m = modTW(SaD / Fu)
  const cV = I / (1.4 * ALPHA_Y) * m
  const cStar = I * Fu / ((basin ? 3.5 : 4.2) * ALPHA_Y) * m
  let cM = 0
  const SMS = +sp.SMS || 0
  const T0M = basin ? +sp.T0 : SMS > 0 && +sp.SM1 > 0 ? sp.SM1 / SMS : 0
  if (SMS > 0 && T0M > 0) cM = I / (1.4 * ALPHA_Y) * modTW(saTW(T, SMS, T0M) / fuTW(T, R, T0M))
  const c = Math.max(cV, cStar, cM)
  const gov = c === cM && cM > 0 ? 'VM' : c === cStar && cStar > cV ? 'V*' : 'V'
  return { SaD, Fu, Ra, m, cV, cStar, cM, c, gov }
}

/** 지하층(BASEMENT) 수 — 지진력·풍력은 지상만 */
function basementCount(p: BuildingSpec): number {
  const g = RC.deriveFloorGroups(p)
  let nb = 0
  for (let s = 1; s <= p.stories; s++) if (g[s] && g[s].role === 'BASEMENT') nb = s
  return nb
}

/** 2.2 W — w0 빈칸 = 모델 고정하중(부재+슬래브+마감+칸막이), 입력 시 면적×w0. 활하중비(기본 0, 창고·서고 0.25) 가산. 지하층 0 */
export function storyWeightsTW(p: BuildingSpec, sp: Record<string, any>): number[] {
  const D = sp.w0 != null ? null : modelDeadWeights(p, TW)
  const lr = sp.liveRatio != null ? +sp.liveRatio : 0
  const area = RC.planAreaM2(p) * (p.buildings || 1)
  const g = RC.deriveFloorGroups(p)
  const nb = basementCount(p)
  const W: number[] = []
  for (let s = 1; s <= p.stories; s++) {
    if (s <= nb) { W[s] = 0; continue }
    const fu = FLOOR_USE[(g[s] && g[s].use) || 'Residential'] || FLOOR_USE.Residential
    W[s] = (D ? D[s] : area * sp.w0) + area * lr * fu.liveVal
  }
  return W
}

/** 2.13 P-Δ 용 중력 — D = 지진 W 의 고정하중(w0 우선), L = 면적×활하중(지붕 제외) */
export function storyGravityTW(p: BuildingSpec, sp: Record<string, any>): { D: number[]; L: number[] } {
  const area = RC.planAreaM2(p) * (p.buildings || 1)
  const nb = basementCount(p)
  const D = sp.w0 != null
    ? Array.from({ length: p.stories + 1 }, (_, s) => (s > nb ? area * sp.w0 : 0))
    : modelDeadWeights(p, TW)
  const g = RC.deriveFloorGroups(p)
  const L: number[] = []
  for (let s = 1; s <= p.stories; s++) {
    const fu = FLOOR_USE[(g[s] && g[s].use) || 'Residential'] || FLOOR_USE.Residential
    L[s] = fu.live === 'LR' ? 0 : area * fu.liveVal
  }
  return { D, L }
}

/** 2.18 수직지진 — SaD,V = ½SaD (단주기 평탄부 = SDS), F_uv: R=3 → Ra = 1+2/1.5 (분지 2.0), Fuv = √(2Ra−1) (2-12 중간 구간).
    보·바닥 K_z = I/(1.4αy)·(SaD,V/Fuv)m (C2-10, 표 C2-11a 계수) — 2.10.1 하한 V* 형(Fuv/4.2·…)이 크면 그 값.
    기둥·벽 = 0.40·SDS·I/(2αy) (2.18 해설: 지반과 함께 상하 운동). 층별 연직력 = K_z(W−Wc) + kc·Wc */
export function verticalTW(p: BuildingSpec, sp: Record<string, any>) {
  const { SDS, basin } = siteTW(sp)
  if (!(SDS > 0) || sp.vertical === 'N') return null
  const I = sp.I != null ? +sp.I : 1.0
  const Ra = 1 + 2 / (basin ? 2.0 : 1.5), Fuv = Math.sqrt(2 * Ra - 1)
  const x = 0.5 * SDS / Fuv
  const m = x <= 0.15 ? x : x < 0.4 ? 0.52 * x + 0.072 : 0.70 * x
  const Kz = Math.max(I / (1.4 * ALPHA_Y) * m, I * Fuv / ((basin ? 3.5 : 4.2) * ALPHA_Y) * m)
  const kc = 0.4 * SDS * I / (2 * ALPHA_Y)
  const W = storyWeightsTW(p, { ...sp, liveRatio: 0 }), Wc = modelColumnWeights(p, TW)
  const nb = basementCount(p)
  const F: number[] = []
  for (let s = 1; s <= p.stories; s++) F[s] = s > nb ? Kz * Math.max(0, (W[s] || 0) - (Wc[s] || 0)) + kc * (Wc[s] || 0) : 0
  return { F, Kz, kc }
}

/** 2.11 수직분포 — Ft = 0.07TV (≤0.25V, T≤0.7s 이면 0) 정상부 + (V−Ft)·W_x h_x / ΣW h. h = 기면(지상) 기준 */
export function seismicTW(p: BuildingSpec, sp: Record<string, any>, opt: { T?: number } = {}) {
  const W = storyWeightsTW(p, sp)
  const elev = RC.storyElevations(p)
  const nb = basementCount(p)
  const Wtot = W.reduce((a, b) => a + (b || 0), 0)
  const { Ta, T } = designT(p, sp, opt.T)
  const cf = coefTW(T, sp)
  const V = sp.V != null ? +sp.V : sp.Cs != null ? +sp.Cs * Wtot : cf.c * Wtot
  const Ft = T > 0.7 ? Math.min(0.07 * T * V, 0.25 * V) : 0
  const h = (s: number) => ((elev[s] || 0) - (elev[nb] || 0)) / 1000
  let denom = 0
  for (let s = nb + 1; s <= p.stories; s++) denom += (W[s] || 0) * h(s)
  const forces: (StoryForce & { story: number; w: number })[] = []
  for (let s = 1; s <= p.stories; s++) {
    let F = s > nb && denom > 0 ? (V - Ft) * (W[s] || 0) * h(s) / denom : 0
    if (s === p.stories) F += Ft
    forces.push({ story: s, h: elev[s], w: W[s], F })
  }
  return { T, Ta, Cs: Wtot > 0 ? V / Wtot : 0, V, Wtot, W, forces, Ft, ...cf }
}

/** RS 조정계수 C (3.2) — 탄성 SaD 스펙트럼에 곱함. 하한 V* 계수, VM 지배 시 SaM 근사 */
function rsCoefTW(T: number, sp: Record<string, any>): number {
  const cf = coefTW(T, sp)
  return cf.SaD > 0 ? cf.c / cf.SaD : 0
}

/** 3.1-1 동적해석 의무 — 지상 높이 ≥ 50m 또는 지상 15층 이상. 비정형(3.1-2·3)은 method 'RS' 로 지정 */
export function rsPrimaryTW(p: BuildingSpec, sp: Record<string, any>): boolean {
  if (sp.method === 'RS') return true
  if (sp.method === 'ESL') return false
  return heightAboveGround(p) >= 50 || p.stories - basementCount(p) >= 15
}

/* ── 조합 112 5.3.1 ───────────────────────────────────── */
function twCombos(loadCases: LoadCaseRef[]): Combo[] {
  const by: Record<string, string[]> = {}
  ;(loadCases || []).forEach(l => { (by[l.type] = by[l.type] || []).push(l.name) })
  const D = [...(by.D || []), ...(by.DC || []), ...(by.DW || [])], L = by.L || []
  const Lr = [...(by.LR || []), ...(by.S || []), ...(by.R || [])], W = by.W || []
  const EV = (by.USER || []).filter(n => n === 'EV')
  /* 응답스펙트럼 주 해석이면 지진 = RSX/RSY (ANAL 'RS'), 정적 EX/EY 는 모델에만 */
  const RS = by.RS || [], E = RS.length ? RS : by.E || [], eAnal = RS.length ? 'RS' : 'ST'
  if (!D.length) return []
  const T = (...pp: [string[], number][]) => pp.flatMap(([ns, f]) => ns.map(n => [n, f, 'ST'] as [string, number, string]))
  const defs: [string, boolean, [string, number, string][]][] = [
    ['1.4D', true, T([D, 1.4])],                                                  // (a)
    ['1.2D+1.6L+0.5Lr', true, T([D, 1.2], [L, 1.6], [Lr, 0.5])],                  // (b)
    ['1.2D+1.6Lr+1.0L', Lr.length > 0, T([D, 1.2], [Lr, 1.6], [L, 1.0])],         // (c)
  ]
  W.forEach(w => {
    defs.push([`1.2D+1.6Lr+0.8${w}`, Lr.length > 0, T([D, 1.2], [Lr, 1.6], [[w], 0.8])])            // (c)
    defs.push([`1.2D+1.6${w}+1.0L+0.5Lr`, true, T([D, 1.2], [[w], 1.6], [L, 1.0], [Lr, 0.5])])        // (d)
    defs.push([`0.9D+1.6${w}`, true, T([D, 0.9], [[w], 1.6])])                                          // (f)
  })
  E.forEach(e => {
    defs.push([`1.2D+1.0${e}+1.0L`, true, [...T([D, 1.2], [L, 1.0]), [e, 1.0, eAnal]]])                // (e)
    defs.push([`0.9D+1.0${e}`, true, [...T([D, 0.9]), [e, 1.0, eAnal]]])                               // (g)
    /* 2.18 해설: 수평 100% + 수직 30%, 수평 30% + 수직 100% (수직 ± 양방향) — EV = 하향 양수 */
    EV.forEach(v => {
      for (const [kh, kv] of [[1.0, 0.3], [0.3, 1.0]] as const) for (const sg of [1, -1]) {
        const vs = `${sg > 0 ? '+' : '-'}${kv}${v}`
        defs.push([`1.2D+${kh}${e}${vs}+1.0L`, true, [...T([D, 1.2], [L, 1.0], [[v], sg * kv]), [e, kh, eAnal]]])
        defs.push([`0.9D+${kh}${e}${vs}`, true, [...T([D, 0.9], [[v], sg * kv]), [e, kh, eAnal]]])
      }
    })
  })
  return defs.filter(d => d[1] && d[2].length).map((d, i) => ({ name: `cLCB${i + 1}`, desc: d[0], terms: d[2] }))
}

/* ── 풍 2014 ─────────────────────────────────────────── */
const EXPO: Record<string, { a: number; zg: number }> = { A: { a: 0.32, zg: 500 }, B: { a: 0.25, zg: 400 }, C: { a: 0.15, zg: 300 } }   // 표2.2

/** (2.7) 풍속압 지황계수 */
export function kzTW(z: number, cat: string): number {
  const e = EXPO[cat] || EXPO.C
  return 2.774 * Math.pow(Math.max(z, 5) / e.zg, 2 * e.a)
}

/** 표2.4 풍하면 Cp (L/B: 0~1 −0.5, 2 −0.3, ≥4 −0.2, 사이 보간) — 절댓값 */
export function cpLeeTW(LB: number): number {
  if (LB <= 1) return 0.5
  if (LB <= 2) return 0.5 - 0.2 * (LB - 1)
  if (LB <= 4) return 0.3 - 0.1 * (LB - 2) / 2
  return 0.2
}

/** 주풍력저항계 층풍력 — F = G·(0.8·q(z) + |Cp풍하|·q(h))·B·분담높이 × 동수. 높이는 지상 기준, 지하층 0 */
export function windTW(p: BuildingSpec, wp: Record<string, any>) {
  const V10 = wp.V10 != null ? +wp.V10 : 42.5
  const I = wp.Iw != null ? +wp.Iw : 1.0
  const G = wp.G != null ? +wp.G : 1.88
  const cat = wp.exposure || 'C'
  const q = (z: number) => 0.06 * kzTW(z, cat) * Math.pow(I * V10, 2) * KGF          // kN/m²
  const Lx = RC.asSpans(p.spanX, p.bayX).reduce((a: number, b: number) => a + b, 0) / 1000
  const Ly = RC.asSpans(p.spanY, p.bayY).reduce((a: number, b: number) => a + b, 0) / 1000
  const nb = p.buildings || 1
  const elev = RC.storyElevations(p)
  const nbs = basementCount(p)
  const z = (s: number) => ((elev[s] || 0) - (elev[nbs] || 0)) / 1000
  const h = z(p.stories)
  const fx: (StoryForce & { story: number })[] = [], fy: (StoryForce & { story: number })[] = []
  let Vx = 0, Vy = 0
  for (let s = 1; s <= p.stories; s++) {
    let Fx = 0, Fy = 0
    if (s > nbs) {
      const hb = z(s) - z(s - 1 < nbs ? nbs : s - 1), ha = s < p.stories ? z(s + 1) - z(s) : 0
      const trib = hb / 2 + ha / 2
      Fx = G * (0.8 * q(z(s)) + cpLeeTW(Lx / Ly) * q(h)) * Ly * trib * nb      // WX: 풍향 X, 받는 면 폭 Ly
      Fy = G * (0.8 * q(z(s)) + cpLeeTW(Ly / Lx) * q(h)) * Lx * trib * nb      // WY: 풍향 Y, 받는 면 폭 Lx
    }
    fx.push({ story: s, h: elev[s], F: Fx }); fy.push({ story: s, h: elev[s], F: Fy }); Vx += Fx; Vy += Fy
  }
  return { Vx, Vy, V10, forcesX: fx, forcesY: fy, q10: q(10), qh: q(h) }
}

const num = (key: string, label: () => string, def: ParamField['def'], unit?: string): ParamField =>
  ({ key, kind: 'number', label, def, unit })

const maxShear = (rows: Record<string, string>[], d: 'X' | 'Y') =>
  rows.reduce((m, r) => Math.max(m, Math.abs(numOf(r['Shear Force/' + d])) || 0), 0)

export const TW: CodeProfile = {
  id: 'TW',
  designCode: 'TWN-USD112',

  materials: MATERIALS112,
  defaultMat: 'C280',
  /* M1.7: Taiwan material - concrete CNS560(RC) (live-verified). MPa 등급명은 CNS 표기로 정규화. */
  concreteMatl(name) {
    const shown = RC._MPA2CNS[name] || (RC._CNS_CONC.includes(name) ? name : 'C280')
    return { TYPE: 'CONC', NAME: shown, PARAM: [{ P_TYPE: 1, STANDARD: 'CNS560(RC)', DB: shown, bELAST: true, ELAST: ecMPa(shown) }] }
  },
  comboRefs: { seismic: 'cLCB 1.2D+1.0E+1.0L · 0.9D+1.0E', wind: 'cLCB 1.6W · 0.8W' },

  floorUse: FLOOR_USE,
  concreteGamma: 23.5,   // 2400 kgf/m³
  combos: twCombos,
  combosLogKey: 'load_combos_twd_usd112',

  seismic: {
    ready: sp => sp.SDS > 0,
    coefLabel: 'V/W',
    massLiveRatio: 0,          // 2.2 W 와 일치 — 활하중은 창고·서고만 (liveRatio 입력 시 finalizeLateral 이 질량원에도 반영)
    massLiveTypes: ['L', 'LR'],
    toggleKey: 'apply_equivalent_static_se',
    tipHtml: () => `<a href="https://seaport.ncree.org/sederes/" target="_blank" rel="noopener" style="color:var(--cyan);font-weight:600">↗ Sederes</a> ${t('look_up_site_sds_sd1_or_t0')} ${t('tw_seis_tip')} ${t('w0_auto_tip')}`,
    fields: [
      num('SDS', () => 'SDS', () => 0.6),
      num('SD1', () => 'SD1', () => 0.35),
      num('T0', () => t('t0_basin'), () => '', 's'),
      num('SMS', () => 'SMS', () => ''),
      num('SM1', () => 'SM1', () => ''),
      /* 2.8 用途係數: 병원 1.5(第一類), 학교·상업 1.25(第三類 人群聚集), 그 외 1.0 */
      num('I', () => 'I ' + t('use_2'), p => p.bldgType === 'hospital' ? 1.5 : (p.bldgType === 'school' || p.bldgType === 'commercial') ? 1.25 : 1.0),
      num('R', () => 'R ' + t('sys'), () => 4.8),
      num('w0', () => t('dead_w0'), () => '', 'kN/㎡'),   // 빈칸 = 모델 고정하중
      num('liveRatio', () => t('live'), () => 0),
      num('T', () => t('tw_t'), () => '', 's'),
      { key: 'method', kind: 'select', label: () => t('cn_method'), def: () => 'auto',
        options: () => (['auto', 'ESL', 'RS'] as const).map(v => ({ value: v, label: t(`tw_method_${v}`) })) },
      { key: 'vertical', kind: 'select', label: () => t('tw_vertical'), def: () => 'Y',
        options: () => (['Y', 'N'] as const).map(v => ({ value: v, label: t(`tw_vertical_${v}`) })) },
      { key: 'regular', kind: 'select', label: () => t('tw_regular'), def: () => 'Y',
        options: () => (['Y', 'N'] as const).map(v => ({ value: v, label: t(`tw_regular_${v}`) })) },
      num('Cs', () => 'V/W ' + t('ovr'), () => ''),
      num('V', () => t('v_direct'), () => '', 'kN'),
    ],
    presets: {
      labelKey: 'site_preset',
      list: () => RC.SEISMIC_ZONES.map(z => ({ label: `${z.city} ${z.dist} · SDS ${z.SDS}`, values: { SDS: z.SDS, SD1: z.SD1, T0: z.T0, SMS: z.SMS, SM1: z.SM1 } })),
    },
    storyForces: (p, sp, opt = {}) => seismicTW(p, sp, opt),
    storyWeights: (p, sp) => storyWeightsTW(p, sp),
    /* 탄성 설계스펙트럼(표2-5(a)/2-7(a)) — 감소·조정은 SPLC SCALE(3.2 C × 3.3 η) */
    spectrum(sp) {
      const { SDS, SD1, T0D, basin } = siteTW(sp)
      if (!(SDS > 0) || !(T0D > 0)) return null
      const pts = [0, 0.2 * T0D, T0D, 1.25 * T0D, 1.5 * T0D, 1.75 * T0D, 2 * T0D, 2.25 * T0D, 2.5 * T0D, 4, 6, 10]
        .filter((x, i, a) => a.findIndex(y => Math.abs(y - x) < 1e-4) === i).sort((a, b) => a - b)
      const aFUNC = pts.map(T => ({ PERIOD: +T.toFixed(4), VALUE: +saTW(T, SDS, T0D).toFixed(5) }))
      return {
        name: 'TW-RS',
        spfc: { NAME: 'TW-RS', iTYPE: 1, iMETHOD: 0, SCALE: 1, GRAV: 9.806, DRATIO: 0.05, DESC: 'TW seismic code table 2-5(a)', STR: { SPEC_CODE: 'USER' }, aFUNC },
        logSuffix: ` · T0D=${T0D.toFixed(3)}s${basin ? ' (盆地)' : ''}`,
        reportSuffix: ` SDS=${SDS} SD1=${+SD1.toFixed(3)} T0D=${T0D.toFixed(3)}s${basin ? ' (臺北盆地)' : ''}`,
      }
    },
    spectrumLogKey: 'response_spectrum_tw_rsx_r',
    rsPrimary: (p, sp) => rsPrimaryTW(p, sp),
    rsPrimaryWhy: p => t('tw_rs_primary_auto', +heightAboveGround(p).toFixed(1), p.stories - basementCount(p)),
    /* 3.2 — 초기 SCALE = C(경험주기) */
    rsScale0(p, sp) { const c = rsCoefTW(periodTW(p), sp); return { X: c || 1, Y: c || 1 } },
    /* 3.2 C(T₁) + 3.3 총횡력 ≥ 정적 V × 0.9(정형)/1.0(비정형). 초과 시 동적값 채택(축소 안 함) */
    rsAdjust(p, sp, ctx) {
      const Ta = periodTW(p)
      const ratio = sp.regular === 'N' ? 1.0 : 0.9
      const chk: any = { ratio }
      const lines: string[] = []
      const scale = { ...ctx.scale0 }
      for (const d of ['X', 'Y'] as const) {
        const T = ctx.Tdir[d] ?? ctx.T1 ?? Ta
        const C = rsCoefTW(T, sp)
        const Vb = maxShear(ctx.rows[d], d)
        if (!(Vb > 0) || !(C > 0) || !(ctx.scale0[d] > 0)) { lines.push(t('tw_rs_nodata', d)); continue }
        const Vrs = C * Vb / ctx.scale0[d]
        const Vst = seismicTW(p, sp, { T }).V
        const eta = Vrs < ratio * Vst ? ratio * Vst / Vrs : 1
        scale[d] = C * eta
        chk[d] = { T, Tcap: Math.min(T, 1.4 * Ta), C, Vrs, Vst, eta }
        lines.push(`${t('tw_rs_line', d, T.toFixed(3), C.toFixed(4), Math.round(Vrs), ratio * 100, Math.round(Vst))} ${eta > 1 ? `<b style="color:var(--amber)">→ ×${eta.toFixed(3)}</b>` : '✓'}`)
      }
      return { scale, chk, lines }
    },
    /* 2.14 意外扭矩 — 정적 EX/EY 에 MZ = F·0.05·L⊥, RS 는 Gen 네이티브 우발편심 */
    staticAccEcc: 0.05,
    splcExtra: { bACCECC: true, bACCECC_AUTO: true, ACCECC_PERCENT: 5, bACCECC_CONSIDER_GL: false, bACCECC_MINIMUM_TORSION: false, aACCECC_ECCEN_LIST: [] },
  },

  wind: {
    toggleKey: 'tw_wind_toggle',
    tipHtml: () => t('tw_wind_tip'),
    fields: [
      num('V10', () => t('wind_v10'), () => 42.5, 'm/s'),
      { key: 'exposure', kind: 'select', label: () => t('exposure'), def: () => 'B',
        options: () => ['A', 'B', 'C'].map(x => ({ value: x, label: `${x} ${t('expo', x)}` })) },
      /* 風 2.5 用途係數: 병원·학교·상업(공중 사용) 1.1, 그 외 1.0 */
      num('Iw', () => t('tw_wind_i'), p => (p.bldgType === 'hospital' || p.bldgType === 'school' || p.bldgType === 'commercial') ? 1.1 : 1.0),
      num('G', () => t('gust_g'), () => 1.88),
    ],
    storyForces: (p, wp) => windTW(p, wp),
  },

  /* 검토 지표 — Gen 층 결과 테이블 → 耐震規範 한계 (src/codes/twReview.ts) */
  verticalForces: (p, sp) => verticalTW(p, sp),
  review: {
    tables: ctx => twReviewTables(ctx),
    evaluate: (p, sp, data, ctx) => twReviewEvaluate(p, sp, data, { ...ctx, V: ctx.model?.dynamic?.V ?? ctx.model?.seismic?.V ?? null }),
  },

  /* 질량원 활하중비 = 지진 W 의 활하중비 (2.2 와 동적 질량 일치) */
  finalizeLateral(seis) { seis.massLiveRatio = seis.liveRatio != null ? seis.liveRatio : 0 },
}
