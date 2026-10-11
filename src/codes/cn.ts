/* ════════════════════════════════════════════════════════════
   중국 프로필 — 해석 범위(모델링·하중·조합·정적 지진/풍·응답스펙트럼). 배근·도면 제외.
   근거 체계: 조합 GB 55001-2021 / GB 55002-2021, 지진 GB 50011-2010(2016) 底部剪力法,
   풍 GB 50009-2012 wk=βz·μs·μz·w0, 재료 GB 50010-2010.

   ✔ 원문 검증: 콘크리트 Ec(표 4.1.5)·νc=0.2(4.1.5)·αc=1e-5(4.1.8) — COde/CN/knowledge/gb50010-2010
   ✔ Gen NX 리소스 확인: 재료기준 이름 "GB/T10(RC)", 응답스펙트럼 SPEC_CODE "CH2010"
   ⚠ 미검증(원문 미보유, 지식 기반 — 원문 대조 전까지 학습·검토용):
     GB 55001 활하중·조합계수, GB 50011 αmax/Tg/감쇠보정/δn/최소전단계수, GB 50009 μz,
     경험주기 T1=0.08N, 재료 DB 등급 표기("C30"), CH2010 페이로드 STR 값(EQ_ 등) — 라이브 확인 필요
════════════════════════════════════════════════════════════ */
import { RC } from '../engine'
import type { BuildingSpec, MaterialProps } from '../engine/types'
import { t } from '../i18n'
import type { CodeProfile, Combo, ParamField, StoryForce } from './types'

/* ── 재료 — GB 50010-2010 표 4.1.5 Ec(N/mm²), νc 0.2. den: 철근콘크리트 25 kN/m³ → 질량밀도 t/mm³(미검증: GB 50009 부록 A) ── */
const EC: Record<string, number> = { C20: 25500, C25: 28000, C30: 30000, C35: 31500, C40: 32500, C45: 33500, C50: 34500, C55: 35500, C60: 36000 }
const DEN = 25e-6 / 9806.65   // 25 kN/m³ = 2.5e-5 N/mm³ ÷ g(mm/s²) ≈ 2.55e-9 t/mm³ (TW 엔진 den 과 같은 단위)
const MATERIALS: Record<string, MaterialProps> = Object.fromEntries(
  Object.entries(EC).map(([k, E]) => [k, { E, poisn: 0.2, den: +DEN.toExponential(3) }]))

/* 대만 등급(CNS, kgf/cm² 원주강도) → GB 입방체 등급 근사 (fcu ≈ fc'/0.8). 템플릿 변환용 */
const TW2CN: Record<string, string> = { C210: 'C25', C245: 'C30', C280: 'C35', C315: 'C40', C350: 'C45', C420: 'C50',
  C24: 'C30', C28: 'C35', C30: 'C30', C35: 'C35', C40: 'C40' }
const toCN = (m: string | undefined) => (m && EC[m] ? m : (m && TW2CN[m]) || 'C30')

/* ── 용도별 바닥하중 kN/m² — 활하중 GB 55001-2021 표 4.2.2 (미검증), SDL 은 마감 가정(대만과 동일 값) ── */
const FLOOR_USE: CodeProfile['floorUse'] = {
  Residential: { sdl: 1.5, live: 'LL', liveVal: 2.0 },   // 住宅
  Office: { sdl: 1.5, live: 'LL', liveVal: 2.5 },        // 办公楼
  Commercial: { sdl: 2.0, live: 'LL', liveVal: 4.0 },    // 商店
  School: { sdl: 1.5, live: 'LL', liveVal: 2.5 },        // 教室
  Hospital: { sdl: 1.5, live: 'LL', liveVal: 2.0 },      // 病房
  Equipment: { sdl: 2.5, live: 'LL', liveVal: 8.0 },     // 通风机房·电梯机房
  Roof: { sdl: 2.5, live: 'LR', liveVal: 0.5 },          // 不上人屋面
}

/* ── 하중조합 — GB 55001-2021 (γG 1.3/1.0, γQ 1.5, ψc 활 0.7·풍 0.6), GB 55002-2021 지진 (γG 1.3/1.0, γEh 1.4, G_E=G+0.5Q, 不上人屋面 활하중 제외) ── */
function gbCombos(loadCases: { name: string; type: string }[]): Combo[] {
  const by: Record<string, string[]> = {}
  ;(loadCases || []).forEach(l => { (by[l.type] = by[l.type] || []).push(l.name) })
  const D = by.D || [], L = by.L || [], Lr = by.LR || [], W = by.W || [], E = by.E || []
  if (!D.length) return []
  const T = (...pp: [string[], number][]) => pp.flatMap(([ns, f]) => ns.map(n => [n, f] as [string, number]))
  const defs: [string, boolean, [string, number][]][] = [
    ['1.3D+1.5L+1.05Lr', true, T([D, 1.3], [L, 1.5], [Lr, 1.05])],
    ['1.3D+1.5Lr+1.05L', Lr.length > 0, T([D, 1.3], [Lr, 1.5], [L, 1.05])],
  ]
  W.forEach(w => {
    defs.push([`1.3D+1.5L+1.05Lr+0.9${w}`, true, T([D, 1.3], [L, 1.5], [Lr, 1.05], [[w], 0.9])])
    defs.push([`1.3D+1.5${w}+1.05L+1.05Lr`, true, T([D, 1.3], [[w], 1.5], [L, 1.05], [Lr, 1.05])])
    defs.push([`1.0D+1.5${w}`, true, T([D, 1.0], [[w], 1.5])])
  })
  E.forEach(e => {
    defs.push([`1.3(D+0.5L)+1.4${e}`, true, T([D, 1.3], [L, 0.65], [[e], 1.4])])
    defs.push([`1.0(D+0.5L)+1.4${e}`, true, T([D, 1.0], [L, 0.5], [[e], 1.4])])
  })
  return defs.filter(d => d[1] && d[2].length).map((d, i) => ({ name: `gLCB${i + 1}`, desc: d[0], terms: d[2] }))
}

/* ── 지진 — GB 50011-2010 5.1.4~5.2.5 (미검증) ── */
const INTENSITY: Record<string, { label: string; amax: number; sfi: string }> = {
  '6_005': { label: '6 (0.05g)', amax: 0.04, sfi: '0.05g' },
  '7_010': { label: '7 (0.10g)', amax: 0.08, sfi: '0.10g' },
  '7_015': { label: '7 (0.15g)', amax: 0.12, sfi: '0.15g' },
  '8_020': { label: '8 (0.20g)', amax: 0.16, sfi: '0.20g' },
  '8_030': { label: '8 (0.30g)', amax: 0.24, sfi: '0.30g' },
  '9_040': { label: '9 (0.40g)', amax: 0.32, sfi: '0.40g' },
}
const SITES = ['I0', 'I1', 'II', 'III', 'IV'] as const
/* 특성주기 Tg (s) [설계지진분조 1·2·3][장지류별] — 표 5.1.4-2 */
const TG: Record<string, number[]> = {
  '1': [0.20, 0.25, 0.35, 0.45, 0.65],
  '2': [0.25, 0.30, 0.40, 0.55, 0.75],
  '3': [0.30, 0.35, 0.45, 0.65, 0.90],
}

function siteParams(sp: Record<string, any>) {
  const it = INTENSITY[sp.intensity] || INTENSITY['7_010']
  const grp = TG[String(sp.group)] ? String(sp.group) : '1'
  const si = Math.max(0, SITES.indexOf(sp.site))
  const zeta = sp.zeta > 0 ? sp.zeta : 0.05
  return { it, grp, site: SITES[si], Tg: TG[grp][si], zeta }
}

/** 지진영향계수 곡선 α(T) — 5.1.5 (감쇠 보정 γ·η1·η2 포함) */
function alphaOf(T: number, amax: number, Tg: number, zeta: number): number {
  const gamma = 0.9 + (0.05 - zeta) / (0.3 + 6 * zeta)
  const eta1 = Math.max(0, 0.02 + (0.05 - zeta) / (4 + 32 * zeta))
  const eta2 = Math.max(0.55, 1 + (0.05 - zeta) / (0.08 + 1.6 * zeta))
  if (T < 0.1) return (0.45 + (eta2 - 0.45) * T / 0.1) * amax
  if (T <= Tg) return eta2 * amax
  if (T <= 5 * Tg) return Math.pow(Tg / T, gamma) * eta2 * amax
  return Math.max(0, eta2 * Math.pow(0.2, gamma) - eta1 * (T - 5 * Tg)) * amax
}

/** 정상부 부가지진작용계수 δn — 표 5.2.1 (T1 > 1.4Tg 일 때) */
function deltaN(T1: number, Tg: number): number {
  if (T1 <= 1.4 * Tg) return 0
  if (Tg <= 0.35) return 0.08 * T1 + 0.07
  if (Tg <= 0.55) return 0.08 * T1 + 0.01
  return 0.08 * T1 - 0.02
}

/** 중력하중대표값 G_E (kN, 층별) = 면적 × (w0 + ψ·활하중), 不上人屋面 활하중 제외 */
function storyWeightsCN(p: BuildingSpec, sp: Record<string, any>): number[] {
  const w0 = sp.w0 != null ? sp.w0 : 12
  const psi = sp.psiL != null ? sp.psiL : 0.5
  const area = RC.planAreaM2(p) * (p.buildings || 1)
  const g = RC.deriveFloorGroups(p)
  const W: number[] = []
  for (let s = 1; s <= p.stories; s++) {
    const fu = FLOOR_USE[(g[s] && g[s].use) || 'Residential'] || FLOOR_USE.Residential
    W[s] = area * (w0 + (fu.live === 'LR' ? 0 : psi * fu.liveVal))
  }
  return W
}

function seismicCN(p: BuildingSpec, sp: Record<string, any>, opt: { T?: number } = {}) {
  const { it, Tg, zeta } = siteParams(sp)
  const W = storyWeightsCN(p, sp)
  const elev = RC.storyElevations(p)
  const Wtot = W.reduce((a, b) => a + (b || 0), 0)
  /* 기본주기: 모달 → 직접입력 → 경험식 T1=0.08N (골조, 미검증) */
  const T = opt.T ?? (sp.T > 0 ? sp.T : 0.08 * p.stories)
  const a1 = alphaOf(T, it.amax, Tg, zeta)
  let FEk = a1 * 0.85 * Wtot                                    // Geq = 0.85·ΣG_E
  const lambda = 0.2 * it.amax                                   // 최소 지진전단계수(5.2.5) — 밑면에만 적용(간이)
  if (FEk < lambda * Wtot) FEk = lambda * Wtot
  const dn = deltaN(T, Tg)
  let denom = 0
  for (let s = 1; s <= p.stories; s++) denom += (W[s] || 0) * (elev[s] || 0)
  const forces: (StoryForce & { story: number; w: number })[] = []
  for (let s = 1; s <= p.stories; s++) {
    let F = denom > 0 ? (W[s] || 0) * (elev[s] || 0) / denom * FEk * (1 - dn) : 0
    if (s === p.stories) F += dn * FEk                           // ΔFn — 정상부 집중
    forces.push({ story: s, h: elev[s], w: W[s], F })
  }
  /* Cs 자리에 α1(지진영향계수)을 둔다 — 화면 표기 coefLabel 'α1'. 최소전단계수 적용 결과는 V 에 반영 */
  return { T, Cs: a1, V: FEk, Wtot, W, forces, Tg, deltaN: dn }
}

/* ── 풍 — GB 50009-2012 8.1.1·8.2.1 (미검증) ── */
const TERRAIN: Record<string, { c: number; e: number; min: number }> = {
  A: { c: 1.284, e: 0.24, min: 1.09 }, B: { c: 1.0, e: 0.30, min: 1.0 }, C: { c: 0.544, e: 0.44, min: 0.65 }, D: { c: 0.262, e: 0.60, min: 0.51 },
}
const muZ = (z: number, cat: string) => {
  const r = TERRAIN[cat] || TERRAIN.B
  return Math.min(2.91, Math.max(r.min, r.c * Math.pow(z / 10, r.e)))
}

function windCN(p: BuildingSpec, wp: Record<string, any>) {
  const w0 = wp.w0 != null ? wp.w0 : 0.45, mus = wp.mus != null ? wp.mus : 1.3, bz = wp.betaz != null ? wp.betaz : 1.0
  const cat = wp.terrain || 'B'
  const Xp = RC.cumPos(RC.asSpans(p.spanX, p.bayX)), Yp = RC.cumPos(RC.asSpans(p.spanY, p.bayY))
  const Lx = (Xp[Xp.length - 1] || 0) / 1000, Ly = (Yp[Yp.length - 1] || 0) / 1000
  const nb = p.buildings || 1
  const elev = RC.storyElevations(p)
  const fx: (StoryForce & { story: number })[] = [], fy: (StoryForce & { story: number })[] = []
  let Vx = 0, Vy = 0
  for (let s = 1; s <= p.stories; s++) {
    const z = (elev[s] || 0) / 1000
    const hb = ((elev[s] || 0) - (elev[s - 1] || 0)) / 1000, ha = s < p.stories ? ((elev[s + 1] || 0) - (elev[s] || 0)) / 1000 : 0
    const wk = bz * mus * muZ(z, cat) * w0                        // kN/m²
    const base = wk * (hb / 2 + ha / 2) * nb
    const Fx = base * Ly, Fy = base * Lx                          // WX 는 Y폭 면, WY 는 X폭 면
    fx.push({ story: s, h: elev[s], F: Fx }); fy.push({ story: s, h: elev[s], F: Fy }); Vx += Fx; Vy += Fy
  }
  return { Vx, Vy, V10: w0, forcesX: fx, forcesY: fy }
}

const num = (key: string, label: () => string, def: ParamField['def'], unit?: string): ParamField =>
  ({ key, kind: 'number', label, def, unit })

export const CN: CodeProfile = {
  id: 'CN',
  designCode: 'GB/T50010-10',
  unverified: true,

  materials: MATERIALS,
  defaultMat: 'C30',
  /* Gen NX 재료기준 "GB/T10(RC)" (리소스 IDS_DB_MATLCODE_CON_GB10 확인), 등급 표기 "C30" 은 라이브 미확인 */
  concreteMatl(name) {
    const g = toCN(name)
    return { TYPE: 'CONC', NAME: g, PARAM: [{ P_TYPE: 1, STANDARD: 'GB/T10(RC)', DB: g }] }
  },
  adaptSpec(p) {
    const q: BuildingSpec = { ...p, code: 'CN' }
    q.matName = toCN(p.matName)
    const mt = MATERIALS[q.matName]
    if (mt) { q.E = mt.E; q.poisn = mt.poisn; q.den = mt.den }
    if (p.palette) q.palette = { ...p.palette, mats: [...new Set(p.palette.mats.map(toCN))] }
    if (p.groups) q.groups = p.groups.map(g => ({ ...g, mat: g.mat ? toCN(g.mat) : g.mat }))
    return q
  },

  floorUse: FLOOR_USE,
  combos: gbCombos,
  combosLogKey: 'load_combos_gb',
  comboRefs: { seismic: 'gLCB 1.3(D+0.5L)+1.4E', wind: 'gLCB 1.5W' },

  seismic: {
    ready: sp => !!INTENSITY[sp.intensity],
    coefLabel: 'α1',
    massLiveRatio: 0.5,
    massLiveTypes: ['L'],   // 不上人屋面 활하중은 중력하중대표값 제외 (정적 storyWeightsCN 과 일치)
    toggleKey: 'cn_seis_toggle',
    tipHtml: () => t('cn_seis_tip'),
    fields: [
      { key: 'intensity', kind: 'select', label: () => t('cn_intensity'), def: () => '7_010',
        options: () => Object.entries(INTENSITY).map(([v, o]) => ({ value: v, label: o.label })) },
      { key: 'group', kind: 'select', label: () => t('cn_group'), def: () => '1',
        options: () => ['1', '2', '3'].map(v => ({ value: v, label: t('cn_group_n', v) })) },
      { key: 'site', kind: 'select', label: () => t('cn_site'), def: () => 'II',
        options: () => SITES.map(v => ({ value: v, label: v.replace('0', '₀').replace(/^I1$/, 'I₁') })) },
      num('zeta', () => t('cn_zeta'), () => 0.05),
      num('w0', () => t('dead_w0'), () => 12, 'kN/㎡'),
      num('psiL', () => t('cn_psil'), () => 0.5),
      num('T', () => t('cn_t1'), () => '', 's'),
    ],
    storyForces: (p, sp, opt) => seismicCN(p, sp, opt),
    storyWeights: (p, sp) => storyWeightsCN(p, sp),
    /* Gen NX 네이티브 GB50011-2010 스펙트럼 (SPEC_CODE CH2010, 매뉴얼 1-2-E) — STR 값 라이브 미확인 */
    spectrum(sp) {
      const { it, grp, site, Tg, zeta } = siteParams(sp)
      return {
        name: 'CN-RS',
        spfc: { NAME: 'CN-RS', iTYPE: 1, iMETHOD: 0, SCALE: 1, GRAV: 9.806, DRATIO: zeta,
          STR: { SPEC_CODE: 'CH2010', SFI: it.sfi, SC_: site, EQ_: 'FREQUENT' },
          OPT: { NSC: +grp - 1, nLForce: 0 },
          VAL: { aTG: [Tg, 0, 0], DP: zeta, MaxEQ: it.amax, PERIOD: 6 },
          CALC_OPT: true },
        logSuffix: ` · ${it.label} ${site} G${grp} · αmax=${it.amax} Tg=${Tg}s`,
        reportSuffix: ` GB50011-2010 (CH2010) ${it.label} ${site} G${grp} · αmax=${it.amax} Tg=${Tg}s ζ=${zeta}`,
      }
    },
    spectrumLogKey: 'response_spectrum_cn',
  },

  wind: {
    toggleKey: 'cn_wind_toggle',
    tipHtml: () => t('cn_wind_tip'),
    fields: [
      num('w0', () => t('cn_w0wind'), () => 0.45, 'kN/㎡'),
      { key: 'terrain', kind: 'select', label: () => t('cn_terrain'), def: () => 'B',
        options: () => ['A', 'B', 'C', 'D'].map(x => ({ value: x, label: `${x} ${t('cn_terrain_n', x)}` })) },
      num('mus', () => t('cn_mus'), () => 1.3),
      num('betaz', () => t('cn_betaz'), () => 1.0),
    ],
    storyForces: (p, wp) => windCN(p, wp),
  },
}
