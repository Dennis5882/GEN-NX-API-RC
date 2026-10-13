/* ════════════════════════════════════════════════════════════
   한국 프로필 — 해석 범위(모델링·하중·조합·정적 지진/풍·응답스펙트럼). 배근·도면 제외(TW·CN 과 동일 수준).
   근거 KB: E:/MIDAS PROGRAM/COde/KR/knowledge (KCSC OpenAPI 원문, 2026-10-12)
   - 중요도: KDS 41 10 05 3. (특·1·2·3) → 내진등급·I_E KDS 41 17 00 표 2.2-1, 풍 I_W KDS 41 12 00 표 5.5-5
   - 지진: 41 17 00 4.2 설계스펙트럼(S_DS = S·2.5·Fa·2/3, S_D1 = S·Fv·2/3, 표 4.2-1·4.2-2 보간, T_L 5s)
           5.2 내진설계범주(표 5.2-1·5.2-2) / 6.2 표 6.2-1 R·Ω0·Cd·높이제한 / 7.1 해석법(C·D 높이·층수·비정형 → 동적)
           7.2.1 W(창고 활하중 25%, 칸막이 ≥0.5 kN/m²) / 7.2.2 Cs (7.2-2~5) / 7.2.3 Cu·Ta 상한 / 7.2.4 Ta = Ct·hn^x
           7.2.5 Cvx = w h^k / Σ w h^k (k 0.5~2.5s 보간) / 7.2.6.4 우발편심 5% / 7.3.3.5 V_t ≥ 0.85V (Cm)
   - 조합: 41 12 00 1.7.1 (1.7-1~7) — 풍 1.0W(500년 강도설계, 5.1.3), 지진 1.0E. (2) L 0.5 감소 미사용(보수적).
           지진 직교 100%+30%(41 17 00 8.1.3.3, 범주 D 요구) — 범주와 무관하게 항상 포함(보수적)
   - 풍: 41 12 00 5.2.1 W_D = G_D·q_H·(C_pe1 − C_pe2)·A, 5.5 q_H = ½ρV_H², V_H = V0·K_D·K_zr·K_zt·I_W,
         표 5.5-2·5.5-3 K_zr, 표 5.7-1 외압계수(풍상 0.8k_z, 풍하 −0.5/−0.35), 5.6.1·5.6.2 G_D
   - 재료: KDS 14 20 10 4.3.3 E_c = 8500·∛f_cm, f_cm = f_ck + Δf(4~6 MPa)
   알려진 단순화: 지형계수 K_zt·풍향계수 K_D = 1.0, 풍직각·비틀림 풍하중(5.9·5.10) 미구현, 풍 n_D 기본 = 1/Ta,
     풍방향 감쇠비 ζ_D 는 KDS 에 수치 없음(입력, 기본 0.02), 비틀림증폭 A_x(7.2.6.5)·± 편심 2케이스 미구현(+ 방향 1개),
     지하층 지진력 미산정(지상만 분배), 상가 1층 활하중 5.0 대신 4.0(2층 이상 값) 일괄, P-Δ 증폭(7.2.8.1(3)) 미반영.
   ✔ Gen NX 라이브 확인(2026-10-12, v2.1 0612): 재료 "KS19(RC)" + C18~C80 수용, Gen Ec 가 앱 식과 −0.08% 일치
     ("KS21(RC)" 는 매뉴얼 예시지만 이 빌드에선 Unknown Error, "KS01(RC)" 는 구 기준 Ec 로 3~15% 작음).
     SPFC 네이티브 "KDS(41-17-00:2019)" 생성 곡선 = S_a·I_E/R_ (전 구간 오차 0%) → IE·R_ 1.0(탄성)으로 등록, R/I_E 는 SPLC SCALE.
     DCON "KDS 41 20 : 2022" 수용. RC 단위중량 24 kN/m³ 는 실무값(KDS 41 12 00 에 수치 없음)
════════════════════════════════════════════════════════════ */
import { RC } from '../engine'
import type { BuildingSpec, MaterialProps } from '../engine/types'
import { t } from '../i18n'
import { num as numOf } from '../mapi/tables'
import { heightAboveGround, modelDeadWeights } from './selfweight'
import type { CodeProfile, Combo, LoadCaseRef, ParamField, StoryForce } from './types'
import { krReviewEvaluate, krReviewTables } from './krReview'

/* ── 재료 — KDS 14 20 10 4.3.3 (보통중량 m_c 2,300 kg/m³) ── */
const GRADES = [21, 24, 27, 30, 35, 40, 45, 50, 55, 60]
const dF = (fck: number) => (fck <= 40 ? 4 : fck >= 60 ? 6 : 4 + 2 * (fck - 40) / 20)
export const ecKR = (fck: number) => 8500 * Math.cbrt(fck + dF(fck))
const GAMMA = 24                                   // kN/m³ — 실무값(KDS 41 12 00 에 수치 없음)
const DEN = GAMMA * 1e-6 / 9806.65                 // t/mm³ (TW·CN 과 같은 단위)
const MATERIALS: Record<string, MaterialProps> = Object.fromEntries(GRADES.map(f =>
  [`C${f}`, { E: Math.round(ecKR(f)), poisn: 0.2, den: +DEN.toExponential(3) }]))

/* 기준 전환·템플릿 재료 → KDS 원주강도 등급. 대만 CNS = kgf/cm²(÷10 ≈ MPa), 중국 GB = 입방체 f_cu(원주 ≈ 0.8·f_cu).
   이름이 같아도(C30) 기준마다 강도가 달라서 원 스펙 기준(from)으로 환산 후 가장 가까운 KDS 등급 */
const TW2KR: Record<string, string> = { C210: 'C21', C245: 'C24', C280: 'C27', C315: 'C30', C350: 'C35', C420: 'C40' }
const nearestKR = (mpa: number) => `C${GRADES.reduce((a, b) => (Math.abs(b - mpa) < Math.abs(a - mpa) ? b : a))}`
export function toKR(m: string | undefined, from?: string): string {
  if (!m) return 'C30'
  if (TW2KR[m]) return TW2KR[m]
  const n = +(m.match(/^C(\d+)$/)?.[1] || NaN)
  if (from === 'CN' && n > 0) return nearestKR(0.8 * n)
  return MATERIALS[m] ? m : n > 0 ? nearestKR(n) : 'C30'
}

/* ── 용도별 바닥하중 kN/m² — 활하중 KDS 41 12 00 표 3.2-1, SDL 은 마감 가정(규범값 아님, TW·CN 과 같은 값)
   사무실: 칸막이 1.0(3.2.3)을 활하중에 가산 + 지진 유효중량 칸막이 0.5(41 17 00 7.2.1②)를 SDL 에 → 정적 W = 동적 질량 (중력은 보수적) ── */
const FLOOR_USE: CodeProfile['floorUse'] = {
  Residential: { sdl: 1.5, live: 'LL', liveVal: 2.0 },   // 주거용 거실
  Office: { sdl: 2.0, live: 'LL', liveVal: 3.5 },        // 일반 사무실 2.5 + 칸막이 1.0
  Commercial: { sdl: 2.0, live: 'LL', liveVal: 4.0 },    // 판매장 2층 이상 (1층 5.0)
  School: { sdl: 1.5, live: 'LL', liveVal: 3.0 },        // 교실
  Hospital: { sdl: 1.5, live: 'LL', liveVal: 2.0 },      // 병실
  Equipment: { sdl: 2.5, live: 'LL', liveVal: 5.0 },     // 공조실·전기실·기계실
  Roof: { sdl: 2.5, live: 'LR', liveVal: 1.0 },          // 점유·사용하지 않는 지붕
}

/* ── 하중조합 KDS 41 12 00 1.7.1 ── */
function kdsCombos(loadCases: LoadCaseRef[]): Combo[] {
  const by: Record<string, string[]> = {}
  ;(loadCases || []).forEach(l => { (by[l.type] = by[l.type] || []).push(l.name) })
  const D = by.D || [], L = by.L || [], Lr = by.LR || [], W = by.W || []
  /* 응답스펙트럼 주 해석이면 지진 = RSX/RSY (ANAL 'RS'), 정적 EX/EY 는 모델에만 */
  const RS = by.RS || [], E = RS.length ? RS : by.E || [], eAnal = RS.length ? 'RS' : 'ST'
  if (!D.length) return []
  const T = (...pp: [string[], number][]) => pp.flatMap(([ns, f]) => ns.map(n => [n, f, 'ST'] as [string, number, string]))
  const defs: [string, boolean, [string, number, string][]][] = [
    ['1.4D', true, T([D, 1.4])],                                                     // (1.7-1)
    ['1.2D+1.6L+0.5Lr', true, T([D, 1.2], [L, 1.6], [Lr, 0.5])],                     // (1.7-2)
    ['1.2D+1.6Lr+1.0L', Lr.length > 0, T([D, 1.2], [Lr, 1.6], [L, 1.0])],            // (1.7-3)
  ]
  W.forEach(w => {
    defs.push([`1.2D+1.6Lr+0.5${w}`, Lr.length > 0, T([D, 1.2], [Lr, 1.6], [[w], 0.5])])                // (1.7-3)
    defs.push([`1.2D+1.0${w}+1.0L+0.5Lr`, true, T([D, 1.2], [[w], 1.0], [L, 1.0], [Lr, 0.5])])          // (1.7-4)
    defs.push([`0.9D+1.0${w}`, true, T([D, 0.9], [[w], 1.0])])                                            // (1.7-6)
  })
  /* 지진 (1.7-5)·(1.7-7) — 방향별 100% + 직교 30%(8.1.3.3). 정적은 ±, RS 는 포락(양수)이라 + 만 */
  const eTerms: [string, [string, number, string][]][] = E.map(e => [`1.0${e}`, [[e, 1.0, eAnal]]])
  if (E.length === 2) {
    const sg = eAnal === 'RS' ? [1] : [1, -1]
    for (const [a, b] of [[E[0], E[1]], [E[1], E[0]]]) for (const s of sg)
      eTerms.push([`1.0${a}${s > 0 ? '+' : '-'}0.3${b}`, [[a, 1.0, eAnal], [b, 0.3 * s, eAnal]]])
  }
  for (const [lab, et] of eTerms) {
    defs.push([`1.2D+${lab}+1.0L`, true, [...T([D, 1.2], [L, 1.0]), ...et]])          // (1.7-5)
    defs.push([`0.9D+${lab}`, true, [...T([D, 0.9]), ...et]])                          // (1.7-7)
  }
  return defs.filter(d => d[1] && d[2].length).map((d, i) => ({ name: `kLCB${i + 1}`, desc: d[0], terms: d[2] }))
}

/* ── 중요도·내진등급 (KDS 41 10 05 3. → 41 17 00 표 2.2-1) ── */
export type ImpKR = 'S' | '1' | '2' | '3'
export const IE_KR: Record<ImpKR, number> = { S: 1.5, 1: 1.2, 2: 1.0, 3: 1.0 }

function basementCount(p: BuildingSpec): number {
  const g = RC.deriveFloorGroups(p)
  let nb = 0
  for (let s = 1; s <= p.stories; s++) if (g[s] && g[s].role === 'BASEMENT') nb = s
  return nb
}
const storiesAbove = (p: BuildingSpec) => p.stories - basementCount(p)

/** 중요도 — 직접 지정 또는 용도·규모로 자동: 종합병원 → 특(3.1(3) 수술·응급시설 가정), 학교(3.2(6))·5층 이상 아파트(3.2(5))·
    연면적 5,000㎡ 이상 판매시설(3.2(3)) → 1, 그 외 2 */
export function impKR(p: BuildingSpec, imp?: string): ImpKR {
  if (imp === 'S' || imp === '1' || imp === '2' || imp === '3') return imp
  if (p.bldgType === 'hospital') return 'S'
  if (p.bldgType === 'school') return '1'
  if (p.bldgType === 'apartment' && storiesAbove(p) >= 5) return '1'
  if (p.bldgType === 'commercial' && RC.planAreaM2(p) * (p.buildings || 1) * p.stories >= 5000) return '1'
  return '2'
}

/* ── 지진력저항시스템 — 표 6.2-1 (RC 만). limD = 내진설계범주 D 높이 제한(m), frame = 모멘트골조 주기식 ── */
export const SYSTEMS: Record<string, { R: number; Om: number; Cd: number; limD?: number; frame: boolean; ref: string }> = {
  SMF: { R: 8, Om: 3, Cd: 5.5, frame: true, ref: '3-h' },
  IMF: { R: 5, Om: 3, Cd: 4.5, frame: true, ref: '3-i' },
  OMF: { R: 3, Om: 3, Cd: 2.5, limD: 30, frame: true, ref: '3-j' },
  BF_SW: { R: 6, Om: 2.5, Cd: 5, frame: false, ref: '2-n' },
  BF_OW: { R: 5, Om: 2.5, Cd: 4.5, limD: 60, frame: false, ref: '2-o' },
  DS_SW: { R: 7, Om: 2.5, Cd: 5.5, frame: false, ref: '4-j' },
  DS_OW: { R: 6, Om: 2.5, Cd: 5, frame: false, ref: '4-k' },
  DI_SW: { R: 6.5, Om: 2.5, Cd: 5, frame: false, ref: '5-b' },
  DI_OW: { R: 5.5, Om: 2.5, Cd: 4.5, limD: 60, frame: false, ref: '5-c' },
  SWF: { R: 4.5, Om: 2.5, Cd: 4, limD: 60, frame: false, ref: '7' },
}
const hasWalls = (p: BuildingSpec) => !!((p.core as any)?.on || (Array.isArray(p.walls) && p.walls.length))
export const systemKR = (p: BuildingSpec, sp: Record<string, any>) => SYSTEMS[sp.system] ? sp.system as string : hasWalls(p) ? 'BF_OW' : 'IMF'

/* ── 지반·설계스펙트럼 (4.2) ── */
const ZONE_Z: Record<string, number> = { 1: 0.11, 2: 0.07 }   // KDS 17 10 00 표 4.2-2 (KB 미보유 — 통상값), S = Z × 위험도계수 2.0 (3.2)
const SITES = ['S1', 'S2', 'S3', 'S4', 'S5'] as const
const FA: Record<string, number[]> = { S1: [1.12, 1.12, 1.12], S2: [1.4, 1.4, 1.3], S3: [1.7, 1.5, 1.3], S4: [1.6, 1.4, 1.2], S5: [1.8, 1.3, 1.3] }
const FV: Record<string, number[]> = { S1: [0.84, 0.84, 0.84], S2: [1.5, 1.4, 1.3], S3: [1.7, 1.6, 1.5], S4: [2.2, 2.0, 1.8], S5: [3.0, 2.7, 2.4] }
/** 표 4.2-1·4.2-2 — S ≤ 0.1 / 0.2 / 0.3 열 직선보간(범위 밖은 끝값) */
const interpS = (row: number[], S: number) => (S <= 0.1 ? row[0] : S >= 0.3 ? row[2] : S <= 0.2 ? row[0] + (row[1] - row[0]) * (S - 0.1) / 0.1 : row[1] + (row[2] - row[1]) * (S - 0.2) / 0.1)

export function siteKR(sp: Record<string, any>) {
  const zone = ZONE_Z[sp.zone] ? String(sp.zone) : '1'
  const S = +sp.S > 0 ? +sp.S : 2.0 * ZONE_Z[zone]
  const site = SITES.includes(sp.site) ? sp.site as string : 'S4'   // 4.1.1 ③ 자료 부족 시 S4
  const Fa = interpS(FA[site], S), Fv = interpS(FV[site], S)
  const SDS = S * 2.5 * Fa * 2 / 3, SD1 = S * Fv * 2 / 3
  return { zone, S, site, Fa, Fv, SDS, SD1, T0: 0.2 * SD1 / SDS, Ts: SD1 / SDS, TL: 5 }
}

/** 4.2.1 설계응답스펙트럼 S_a(T) */
export function saKR(T: number, s: { SDS: number; SD1: number; T0: number; Ts: number; TL: number }): number {
  if (T <= s.T0) return 0.6 * s.SDS / s.T0 * T + 0.4 * s.SDS
  if (T <= s.Ts) return s.SDS
  if (T <= s.TL) return s.SD1 / T
  return s.SD1 * s.TL / (T * T)
}

/** 5.2 내진설계범주 — 표 5.2-1(S_DS)·5.2-2(S_D1) 중 높은 것 */
export function sdcKR(SDS: number, SD1: number, imp: ImpKR): 'A' | 'B' | 'C' | 'D' {
  const sp = imp === 'S'
  const a = SDS >= 0.5 ? 'D' : SDS >= 0.33 ? (sp ? 'D' : 'C') : SDS >= 0.17 ? (sp ? 'C' : 'B') : 'A'
  const b = SD1 >= 0.2 ? 'D' : SD1 >= 0.14 ? (sp ? 'D' : 'C') : SD1 >= 0.07 ? (sp ? 'C' : 'B') : 'A'
  return (a > b ? a : b) as 'A' | 'B' | 'C' | 'D'
}

/** 7.2.4 근사고유주기 — 모멘트골조 0.0466·hn^0.9, 전단벽(기타골조) 0.0488·hn^0.75. hn = 밑면(지상)~최상층 m */
export function periodKR(p: BuildingSpec, sp: Record<string, any> = {}): number {
  const hn = Math.max(heightAboveGround(p), 0.1)
  return SYSTEMS[systemKR(p, sp)].frame ? 0.0466 * Math.pow(hn, 0.9) : 0.0488 * Math.pow(hn, 0.75)
}
/** 표 7.2-1 주기상한계수 C_u (S_D1 보간) */
export function cuKR(SD1: number): number {
  const pts: [number, number][] = [[0.1, 1.7], [0.15, 1.6], [0.2, 1.5], [0.3, 1.4]]
  if (SD1 <= 0.1) return 1.7
  if (SD1 >= 0.3) return 1.4
  for (let i = 1; i < pts.length; i++) if (SD1 <= pts[i][0]) {
    const [x0, y0] = pts[i - 1], [x1, y1] = pts[i]
    return y0 + (y1 - y0) * (SD1 - x0) / (x1 - x0)
  }
  return 1.4
}

/** 7.2.1 W — w0 빈칸 = 모델 고정하중(부재+슬래브+마감, 사무실 칸막이 0.5 포함) + 활하중비(기본 0, 창고 0.25). 지하층 0 */
function storyWeightsKR(p: BuildingSpec, sp: Record<string, any>): number[] {
  const D = sp.w0 != null ? null : modelDeadWeights(p, KR)
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

/** 7.2.2 지진응답계수 C_s */
export function csKR(T: number, s: { SDS: number; SD1: number; TL: number }, R: number, Ie: number): number {
  const RI = R / Ie
  const top = T <= s.TL ? s.SD1 / (RI * T) : s.SD1 * s.TL / (RI * T * T)
  return Math.max(Math.min(s.SDS / RI, top), 0.044 * s.SDS * Ie, 0.01)
}

/** 7.2 등가정적 — T = 직접입력/해석주기(≤ Cu·Ta) 또는 Ta. 7.2.5 수직분포(지상 기준, 지하 0) */
export function seismicKR(p: BuildingSpec, sp: Record<string, any>, opt: { T?: number } = {}) {
  const st = siteKR(sp)
  const imp = impKR(p, sp.imp), Ie = IE_KR[imp]
  const sys = SYSTEMS[systemKR(p, sp)]
  const W = storyWeightsKR(p, sp)
  const elev = RC.storyElevations(p)
  const nb = basementCount(p)
  const Wtot = W.reduce((a, b) => a + (b || 0), 0)
  const Ta = periodKR(p, sp), Cu = cuKR(st.SD1)
  const Tin = sp.T > 0 ? +sp.T : opt.T
  const T = Tin != null && Tin > 0 ? Math.min(Tin, Cu * Ta) : Ta
  const Cs = csKR(T, st, sys.R, Ie)
  const V = Cs * Wtot
  const k = T <= 0.5 ? 1 : T >= 2.5 ? 2 : 1 + (T - 0.5) / 2
  const h = (s: number) => ((elev[s] || 0) - (elev[nb] || 0)) / 1000
  let denom = 0
  for (let s = nb + 1; s <= p.stories; s++) denom += (W[s] || 0) * Math.pow(h(s), k)
  const forces: (StoryForce & { story: number; w: number })[] = []
  for (let s = 1; s <= p.stories; s++) {
    const F = s > nb && denom > 0 ? V * (W[s] || 0) * Math.pow(h(s), k) / denom : 0
    forces.push({ story: s, h: elev[s], w: W[s], F })
  }
  return { T, Ta, Cu, Cs, V, Wtot, W, forces, k, Ie, imp, R: sys.R, Cd: sys.Cd, sdc: sdcKR(st.SDS, st.SD1, imp), ...st }
}

/** 7.1 동적해석 의무 — method 'auto' 일 때: 범주 C 정형 H ≥ 70m 또는 21층 이상 / 비정형 H ≥ 20m 또는 6층 이상,
    범주 D 정형 H ≥ 70m / 비정형 H > 20m 또는 5층 초과(표 7.1-1 3항 예외), A·B 는 등가정적 */
export function rsRequiredKR(p: BuildingSpec, sp: Record<string, any>): { req: boolean; sdc: string; H: number; n: number } {
  const st = siteKR(sp)
  const sdc = sdcKR(st.SDS, st.SD1, impKR(p, sp.imp))
  const H = heightAboveGround(p), n = storiesAbove(p), irr = sp.regular === 'N'
  const req = sdc === 'C' ? (irr ? H >= 20 || n >= 6 : H >= 70 || n >= 21)
    : sdc === 'D' ? (irr ? H > 20 || n > 5 : H >= 70) : false
  return { req, sdc, H, n }
}
export function rsPrimaryKR(p: BuildingSpec, sp: Record<string, any>): boolean {
  if (sp.method === 'RS') return true
  if (sp.method === 'ESL') return false
  return rsRequiredKR(p, sp).req
}

/* ── 풍 KDS 41 12 00 5. ─────────────────────────────── */
const ROUGH: Record<string, { zb: number; Zg: number; a: number; c: number; low: number }> = {
  A: { zb: 20, Zg: 550, a: 0.33, c: 0.22, low: 0.58 }, B: { zb: 15, Zg: 450, a: 0.22, c: 0.45, low: 0.81 },
  C: { zb: 10, Zg: 350, a: 0.15, c: 0.71, low: 1.0 }, D: { zb: 5, Zg: 250, a: 0.10, c: 0.98, low: 1.13 },
}
/** 표 5.5-2 풍속고도분포계수 K_zr */
export function kzrKR(z: number, cat: string): number {
  const r = ROUGH[cat] || ROUGH.C
  return z <= r.zb ? r.low : r.c * Math.pow(Math.min(z, r.Zg), r.a)
}
/** 표 5.7-1 주 높이방향 압력분포계수 k_z */
function kzKR(z: number, H: number, r: { zb: number; a: number }): number {
  if (H <= r.zb) return 1.0
  if (z <= r.zb) return Math.pow(r.zb / H, 2 * r.a)
  if (z < 0.8 * H) return Math.pow(z / H, 2 * r.a)
  return Math.pow(0.8, 2 * r.a)
}
/** 5.6 풍방향 가스트영향계수 G_D — n_D > 1Hz 강체(5.6-2), 그 외 5.6-1. B = 풍직각 폭 m */
export function gustKR(H: number, B: number, VH: number, nD: number, zeta: number, beta: number, cat: string): number {
  const r = ROUGH[cat] || ROUGH.C
  const IH = 0.1 * Math.pow(Math.max(H, r.zb) / r.Zg, -r.a - 0.05)          // (5.5-3.a), z=H
  const gam = (3 + 3 * r.a) / (2 + r.a) * IH                                  // (5.6-1.c)
  const LH = H > 30 ? 100 * Math.sqrt(H / 30) : 100                           // (5.6-1.e)
  const k = H >= B ? 0.33 : -0.33
  const BD = 1 - 1 / Math.cbrt(1 + 5.1 * Math.pow(LH / Math.sqrt(H * B), 1.3) * Math.pow(B / H, k))   // (5.6-1.d)
  if (nD > 1) return 1 + 4 * gam * Math.sqrt(BD)                              // (5.6-2)
  const SD = 1 / ((1 + 4 * nD * B / VH) * (1 + 2.3 * nD * H / VH))            // (5.6-1.k)
  const x = nD * LH / VH
  const FD = 4 * x / Math.pow(1 + 71 * x * x, 5 / 6)                          // (5.6-1.l)
  const RD = Math.PI / (4 * zeta) * SD * FD                                   // (5.6-1.j)
  const nu = nD * Math.sqrt(RD / (BD + RD))                                   // (5.6-1.b)
  const gD = Math.sqrt(2 * Math.log(600 * nu) + 1.2)                          // (5.6-1.a)
  const phi = (2 * beta + 1) / (2 + beta) * (1 - 0.4 * Math.log(beta))        // (5.6-1.f) 균등질량: M/M* = 2β+1
  return 1 + gD * gam * Math.sqrt(BD + phi * phi * RD)                        // (5.6-1)
}

/** 주골조 풍방향 층풍력 — F = G_D·q_H·(C_pe1(z) − C_pe2)·폭·분담높이 × 동수. 높이는 지상 기준, 지하층 0 */
export function windKR(p: BuildingSpec, wp: Record<string, any>) {
  const V0 = wp.V0 != null ? +wp.V0 : 28
  const cat = ROUGH[wp.exposure] ? wp.exposure : 'C'
  const r = ROUGH[cat]
  const elev = RC.storyElevations(p)
  const nbs = basementCount(p)
  const z = (s: number) => ((elev[s] || 0) - (elev[nbs] || 0)) / 1000
  const H = Math.max(z(p.stories), 0.1)
  const imp = impKR(p, wp.imp)
  const Iw = storiesAbove(p) >= 50 || H >= 200 ? 1.05 : ({ S: 1.0, 1: 1.0, 2: 0.95, 3: 0.90 } as Record<ImpKR, number>)[imp]
  const VH = V0 * kzrKR(H, cat) * Iw                                         // K_D = K_zt = 1.0
  const qH = 0.5 * 1.225 * VH * VH / 1000                                     // kN/m²
  const Lx = RC.asSpans(p.spanX, p.bayX).reduce((a: number, b: number) => a + b, 0) / 1000
  const Ly = RC.asSpans(p.spanY, p.bayY).reduce((a: number, b: number) => a + b, 0) / 1000
  const nD = +wp.nD > 0 ? +wp.nD : 1 / periodKR(p, wp)
  const zeta = +wp.zetaD > 0 ? +wp.zetaD : 0.02
  const beta = hasWalls(p) ? 1.0 : 0.5                                        // 5.6-1 β: 코어 有 1.0, 모멘트골조 0.5
  const GX = gustKR(H, Ly, VH, nD, zeta, beta, cat), GY = gustKR(H, Lx, VH, nD, zeta, beta, cat)
  const cpe2 = (DB: number) => (DB <= 1 ? 0.5 : 0.35)                           // 풍하벽 |C_pe2|
  const cpe1 = (zz: number, DB: number) => 0.8 * kzKR(zz, H, r) + (DB > 1 ? 0.05 : 0)
  const nb = p.buildings || 1
  const fx: (StoryForce & { story: number })[] = [], fy: (StoryForce & { story: number })[] = []
  let Vx = 0, Vy = 0
  for (let s = 1; s <= p.stories; s++) {
    let Fx = 0, Fy = 0
    if (s > nbs) {
      const hb = z(s) - z(s - 1 < nbs ? nbs : s - 1), ha = s < p.stories ? z(s + 1) - z(s) : 0
      const trib = hb / 2 + ha / 2, zz = z(s)
      Fx = GX * qH * (cpe1(zz, Lx / Ly) + cpe2(Lx / Ly)) * Ly * trib * nb   // WX: 풍향 X, 받는 면 폭 Ly, 깊이 Lx
      Fy = GY * qH * (cpe1(zz, Ly / Lx) + cpe2(Ly / Lx)) * Lx * trib * nb   // WY: 풍향 Y
    }
    fx.push({ story: s, h: elev[s], F: Fx }); fy.push({ story: s, h: elev[s], F: Fy }); Vx += Fx; Vy += Fy
  }
  return { Vx, Vy, V10: V0, forcesX: fx, forcesY: fy, VH, qH, GX, GY, Iw, nD }
}

const num = (key: string, label: () => string, def: ParamField['def'], unit?: string): ParamField =>
  ({ key, kind: 'number', label, def, unit })

const maxShear = (rows: Record<string, string>[], d: 'X' | 'Y') =>
  rows.reduce((m, r) => Math.max(m, Math.abs(numOf(r['Shear Force/' + d])) || 0), 0)

export const KR: CodeProfile = {
  id: 'KR',
  designCode: 'KDS 41 20 : 2022',

  materials: MATERIALS,
  defaultMat: 'C30',
  /* Gen NX 재료기준 "KS19(RC)" + 등급 "C30" — 라이브 확인(Ec = 8500∛f_cm 과 −0.08%) */
  concreteMatl(name) {
    const g = toKR(name)
    return { TYPE: 'CONC', NAME: g, PARAM: [{ P_TYPE: 1, STANDARD: 'KS19(RC)', DB: g }] }
  },
  adaptSpec(p) {
    const from = p.code
    const q: BuildingSpec = { ...p, code: 'KR' }
    q.matName = toKR(p.matName, from)
    const mt = MATERIALS[q.matName]
    if (mt) { q.E = mt.E; q.poisn = mt.poisn; q.den = mt.den }
    if (p.palette) q.palette = { ...p.palette, mats: [...new Set(p.palette.mats.map(m => toKR(m, from)))] }
    if (p.groups) q.groups = p.groups.map(g => ({ ...g, mat: g.mat ? toKR(g.mat, from) : g.mat }))
    return q
  },

  floorUse: FLOOR_USE,
  concreteGamma: GAMMA,
  combos: kdsCombos,
  combosLogKey: 'load_combos_kds',
  comboRefs: { seismic: 'kLCB 1.2D+1.0E+1.0L · 0.9D+1.0E (+0.3E⊥)', wind: 'kLCB 1.0W' },
  review: {
    tables: ctx => krReviewTables(ctx),
    evaluate: (p, sp, data, ctx) => krReviewEvaluate(p, sp, data, ctx),
  },

  seismic: {
    ready: sp => !!ZONE_Z[sp.zone] || +sp.S > 0,
    coefLabel: 'Cs',
    massLiveRatio: 0,          // 7.2.1 W 와 일치 — 활하중은 창고만 (liveRatio 입력 시 finalizeLateral 이 질량원에도 반영)
    massLiveTypes: ['L'],
    toggleKey: 'kr_seis_toggle',
    tipHtml: () => t('kr_seis_tip') + ' ' + t('w0_auto_tip'),
    fields: [
      { key: 'zone', kind: 'select', label: () => t('kr_zone'), def: () => '1',
        options: () => ['1', '2'].map(v => ({ value: v, label: t('kr_zone_n', v) })) },
      { key: 'site', kind: 'select', label: () => t('kr_site'), def: () => 'S4',
        options: () => SITES.map(v => ({ value: v, label: v })) },
      num('S', () => t('kr_s'), () => ''),
      { key: 'imp', kind: 'select', label: () => t('kr_imp'), def: () => 'auto',
        options: () => (['auto', 'S', '1', '2', '3'] as const).map(v => ({ value: v, label: t(`kr_imp_${v}`) })) },
      { key: 'system', kind: 'select', label: () => t('kr_sys'), def: p => (hasWalls(p) ? 'BF_OW' : 'IMF'),
        options: () => Object.entries(SYSTEMS).map(([v, s]) => ({ value: v, label: `${t(`kr_sys_${v}` as any)} (R=${s.R})` })) },
      { key: 'regular', kind: 'select', label: () => t('tw_regular'), def: () => 'Y',
        options: () => (['Y', 'N'] as const).map(v => ({ value: v, label: t(`kr_regular_${v}`) })) },
      num('w0', () => t('dead_w0'), () => '', 'kN/㎡'),   // 빈칸 = 모델 고정하중
      num('liveRatio', () => t('live'), () => 0),
      num('T', () => t('kr_t'), () => '', 's'),
      { key: 'method', kind: 'select', label: () => t('cn_method'), def: () => 'auto',
        options: () => (['auto', 'ESL', 'RS'] as const).map(v => ({ value: v, label: t(`kr_method_${v}`) })) },
    ],
    storyForces: (p, sp, opt = {}) => seismicKR(p, sp, opt),
    storyWeights: (p, sp) => storyWeightsKR(p, sp),
    /* Gen NX 네이티브 KDS 41 17 00 설계스펙트럼(SPEC_CODE "KDS(41-17-00:2019)") — 라이브 확인: 생성 곡선 = 4.2.1 S_a·IE/R_.
       IE·R_ 는 1.0(탄성 곡선)으로 두고 R/I_E 감소·0.85V 보정은 SPLC SCALE (spectrum 에 스펙이 없어 중요도 자동 판정을 못 하므로) */
    spectrum(sp) {
      const st = siteKR(sp)
      return {
        name: 'KR-RS',
        spfc: { NAME: 'KR-RS', iTYPE: 1, iMETHOD: 0, SCALE: 1, GRAV: 9.806, DRATIO: 0.05,
          STR: { SPEC_CODE: 'KDS(41-17-00:2019)' }, OPT: { SC_: SITES.indexOf(st.site as any), iSEISZONE: st.zone === '2' ? 1 : 0 },
          VAL: { aSRA: [st.SDS, st.SD1], aSCP: [st.Fa, st.Fv], PERIOD: 10, IE: 1, R_: 1, ZONEFACTOR: st.S },
          CALC_OPT: true },
        logSuffix: ` · ${st.site} S=${+st.S.toFixed(3)} · S_DS=${st.SDS.toFixed(3)} S_D1=${st.SD1.toFixed(3)}`,
        reportSuffix: ` KDS 41 17 00 ${st.site} S=${+st.S.toFixed(3)} Fa=${+st.Fa.toFixed(3)} Fv=${+st.Fv.toFixed(3)} · S_DS=${st.SDS.toFixed(3)} S_D1=${st.SD1.toFixed(3)}`,
      }
    },
    spectrumLogKey: 'response_spectrum_kds',
    rsPrimary: (p, sp) => rsPrimaryKR(p, sp),
    rsPrimaryWhy: p => { const r = rsRequiredKR(p, p.seismic || {}); return t('kr_rs_primary_auto', r.sdc, +r.H.toFixed(1), r.n) },
    /* 7.3.3.2 C_sm = S_am/(R/I_E) → 초기 SCALE = I_E/R */
    rsScale0(p, sp) { const s = seismicKR(p, sp); const f = s.Ie / s.R; return { X: f, Y: f } },
    /* 7.3.3.5 — V_t < 0.85·V(7.2.3 주기, ≤ Cu·Ta) 이면 C_m = 0.85V/V_t 배. 이상이면 그대로 */
    rsAdjust(p, sp, ctx) {
      const chk: any = {}
      const lines: string[] = []
      const scale = { ...ctx.scale0 }
      for (const d of ['X', 'Y'] as const) {
        const Tm = ctx.Tdir[d] ?? ctx.T1 ?? undefined
        const Vt = maxShear(ctx.rows[d], d)
        if (!(Vt > 0)) { lines.push(t('tw_rs_nodata', d)); continue }
        const st = seismicKR(p, sp, { T: Tm ?? undefined })
        const Cm = Vt < 0.85 * st.V ? 0.85 * st.V / Vt : 1
        scale[d] = ctx.scale0[d] * Cm
        chk[d] = { T: st.T, Vt, V: st.V, Cm }
        lines.push(`${t('kr_rs_line', d, st.T.toFixed(3), Math.round(Vt), Math.round(st.V), Cm.toFixed(3))} ${Cm > 1 ? `<b style="color:var(--amber)">→ ×${Cm.toFixed(3)}</b>` : '✓'}`)
      }
      return { scale, chk, lines }
    },
    /* 7.2.6.4 우발편심 5% — 정적 EX/EY 에 MZ = F·0.05·L⊥, RS 는 Gen 네이티브 */
    staticAccEcc: 0.05,
    splcExtra: { bACCECC: true, bACCECC_AUTO: true, ACCECC_PERCENT: 5, bACCECC_CONSIDER_GL: false, bACCECC_MINIMUM_TORSION: false, aACCECC_ECCEN_LIST: [] },
  },

  wind: {
    toggleKey: 'kr_wind_toggle',
    tipHtml: () => t('kr_wind_tip'),
    fields: [
      num('V0', () => t('kr_v0'), () => 28, 'm/s'),
      { key: 'exposure', kind: 'select', label: () => t('kr_expo'), def: () => 'C',
        options: () => ['A', 'B', 'C', 'D'].map(x => ({ value: x, label: `${x} ${t('kr_expo_n', x)}` })) },
      num('nD', () => t('kr_nd'), () => '', 'Hz'),
      num('zetaD', () => t('kr_zetad'), () => 0.02),
    ],
    storyForces: (p, wp) => windKR(p, wp),
  },

  /* 질량원 활하중비 = 지진 W 의 활하중비(7.2.1 과 동적 질량 일치), 풍 I_W 는 지진 중요도와 공유 */
  finalizeLateral(seis, wind) {
    seis.massLiveRatio = seis.liveRatio != null ? seis.liveRatio : 0
    wind.imp = seis.imp
    wind.system = seis.system
  },
}
