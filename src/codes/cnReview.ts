/* ════════════════════════════════════════════════════════════
   중국 심사 지표(审图) — 동적해석 뒤 Gen NX 층 결과 테이블을 읽어 GB 한계와 비교.
   값 = Gen 표(라이브 확인 헤더, MAPI_FINDINGS 2026-10-12), 한계 = 원문 KB 대조 조문(2026-10-12 JGJ 3·GB 55008 KB 추가 후 재대조).
   - 房屋高度     JGJ 3-2010 3.3.1 표 3.3.1-1/2 (A级·B级 최대 적용높이) — 고층 등급이 아래 한계를 가름
   - 抗震等级     GB 55002-2021 5.2.1 표 5.2.1 — 抗震设防类别(GB 50223-2008)이 乙类면 내진조치를 열도 +1도로(GB 55002 2.3.2-2,
                  9度 → 特一级 JGJ 3 3.9.3, 올린 열도의 높이 상한 초과 → 一级보다 유효한 조치 GB 50011 6.1.3-4). 지진작용은 지역 열도 그대로
   - 混凝土强度等级 GB 55008-2021 2.0.2 (RC ≥ C25, 抗震等级 二级 이상 ≥ C30)
   - 층간변위각   GB 50011 5.5.1 / JGJ 3 3.7.3 (框架 1/550, 框架-剪力墙·框架-核心筒 1/800, 150~250m 는 1/500 까지 선형보간)
   - 剪重比       GB 55002 4.2.3 (= JGJ 3 4.3.12 표, λ = 0.2αmax × 주기보정)
   - 扭转位移比   GB 50011 3.4.3·3.4.4 / JGJ 3 3.4.5 (≤1.2 宜, A级 ≤1.5·B级 ≤1.4 不应; 층간변위각 ≤ 한계의 40% 층은 ≤1.6)
   - 有效质量     GB 50011 5.2.2 条文说明 / JGJ 3 5.1.13 (≥ 90%)
   - 周期比       JGJ 3 3.4.5 (A级 ≤0.9, B级 ≤0.85) — 고층(JGJ 3 1.0.2)에만 적용
════════════════════════════════════════════════════════════ */
import { RC, type BuildingSpec } from '../engine'
import { t } from '../i18n'
import { classifyModes, num, subTableObjs, tableObjs } from '../mapi/tables'
import { heightAboveGround } from './selfweight'
import type { ReviewItem, ReviewTable } from './types'
import { cnExtraItems, cnExtraTables } from './cnReviewExtra'

const DRIFT_COL = 'Maximum Drift of All Vertical Elements/Story Drift'

export function cnReviewTables(ctx: { rs: boolean; model?: any }): ReviewTable[] {
  const [lx, ly] = ctx.rs ? ['RSX(RS)', 'RSY(RS)'] : ['EX(ST)', 'EY(ST)']
  const out: ReviewTable[] = [
    { key: 'EV', type: 'EIGENVALUEMODE' },
    { key: 'DX', type: 'STORY_DRIFT_X', lcs: [lx] },
    { key: 'DY', type: 'STORY_DRIFT_Y', lcs: [ly] },
    { key: 'TX', type: 'TORSIONAL_IRREGULARITY_X', lcs: ['EX(ST)'] },
    { key: 'TY', type: 'TORSIONAL_IRREGULARITY_Y', lcs: ['EY(ST)'] },
  ]
  if (ctx.rs) out.push({ key: 'SX', type: 'STORY_SHEAR_FORCE_COEFFICIENT', lcs: ['RSX(RS)'] }, { key: 'SY', type: 'STORY_SHEAR_FORCE_COEFFICIENT', lcs: ['RSY(RS)'] })
  out.push(...cnExtraTables(ctx))   // 侧向刚度比·刚重比·倾覆力矩比·轴压比 (cnReviewExtra.ts)
  return out
}

const inv = (x: number) => (x > 0 ? `1/${Math.round(1 / x)}` : '-')

/* ── 구조 형식·높이 등급 ── */
type Sys = 'frame' | 'frameWall' | 'frameCore'
const SYS_ZH: Record<Sys, string> = { frame: '框架', frameWall: '框架-剪力墙', frameCore: '框架-核心筒' }
function sysOf(p: BuildingSpec): Sys {
  if ((p.core as any)?.on) return 'frameCore'
  return Array.isArray(p.walls) && p.walls.length ? 'frameWall' : 'frame'
}
/** 烈度 키(7_015 등) → 표 열: 6 · 7 · 8_020 · 8_030 · 9 (7度 0.15g 는 7度 열) */
const col = (intensity: string) => (intensity?.startsWith('8') ? intensity : intensity?.[0] || '7') as '6' | '7' | '8_020' | '8_030' | '9'
/* JGJ 3 표 3.3.1-1 (A级) · 3.3.1-2 (B级) 최대 적용높이 m — 框架는 B级 없음, 9度 框架 A级 '—' */
const H_A: Record<Sys, Record<string, number | null>> = {
  frame: { 6: 60, 7: 50, '8_020': 40, '8_030': 35, 9: null },
  frameWall: { 6: 130, 7: 120, '8_020': 100, '8_030': 80, 9: 50 },
  frameCore: { 6: 150, 7: 130, '8_020': 100, '8_030': 90, 9: 70 },
}
const H_B: Record<Sys, Record<string, number | null>> = {
  frame: {},
  frameWall: { 6: 160, 7: 140, '8_020': 120, '8_030': 100 },
  frameCore: { 6: 210, 7: 180, '8_020': 140, '8_030': 120 },
}
/** 고층 여부 (JGJ 3 1.0.2 / 2.1.1): 주거 = 10층 이상 또는 >28m, 그 외 >24m */
export function isTallCN(p: BuildingSpec, H: number): boolean {
  return p.bldgType === 'apartment' ? p.stories >= 10 || H > 28 : H > 24
}
/** 높이 등급 — A · B · over(B级 초과, 框架는 A级 초과) */
function heightGrade(sys: Sys, c: string, H: number): { grade: 'A' | 'B' | 'over'; a: number | null; b: number | null } {
  const a = H_A[sys][c] ?? null, b = H_B[sys][c] ?? null
  if (a != null && H <= a) return { grade: 'A', a, b }
  if (b != null && H <= b) return { grade: 'B', a, b }
  return { grade: 'over', a, b }
}

/* GB 55002 표 5.2.1 (丙类) — 등급 1~4(一~四). 높이 상한 초과 시 표의 최고 등급 + '更有效措施' */
const ZH_NUM = ['特一', '一', '二', '三', '四']
/* 표 5.2.1 각 구조형식 열도별 높이 상한 m (框架-核心筒은 표의 '≤' 값) */
const H_TOP: Record<Sys, Record<number, number>> = {
  frame: { 6: 60, 7: 50, 8: 40, 9: 24 },
  frameWall: { 6: 130, 7: 120, 8: 100, 9: 50 },
  frameCore: { 6: 150, 7: 130, 8: 100, 9: 70 },
}
/** 抗震设防类别 — 자동 = 용도: 병원(GB 50223 4.0.3-2 二·三级医院)·학교(6.0.8 中小学 教学用房) → 乙类, 그 외 丙类(3.0.4·6.0.12) */
export function categoryCN(p: BuildingSpec, sp: Record<string, any>): 'B' | 'C' {
  if (sp.category === 'B' || sp.category === 'C') return sp.category
  return p.bldgType === 'hospital' || p.bldgType === 'school' ? 'B' : 'C'
}
function seismicGrade(sys: Sys, deg: number, H: number): { frame: number; wall?: number } {
  if (sys === 'frame') {
    const t5: Record<number, [number, number, number]> = { 6: [24, 4, 3], 7: [24, 3, 2], 8: [24, 2, 1], 9: [24, 1, 1] }
    const [h, lo, hi] = t5[deg] || t5[7]
    return { frame: H <= h ? lo : hi }
  }
  if (sys === 'frameCore') {   // 框架-核心筒: 높이 구분 없음
    const fc: Record<number, [number, number]> = { 6: [3, 2], 7: [2, 2], 8: [1, 1], 9: [1, 1] }
    const [f, w] = fc[deg] || fc[7]
    return { frame: f, wall: w }
  }
  /* 框架-抗震墙: [높이 경계, 框架, 抗震墙] 오름차순 */
  const fw: Record<number, [number, number, number][]> = {
    6: [[60, 4, 3], [Infinity, 3, 3]],
    7: [[24, 4, 3], [60, 3, 2], [Infinity, 2, 2]],
    8: [[24, 3, 2], [60, 2, 1], [Infinity, 1, 1]],
    9: [[24, 2, 1], [Infinity, 1, 1]],
  }
  const row = (fw[deg] || fw[7]).find(([h]) => H <= h)!
  return { frame: row[1], wall: row[2] }
}

/** 층간변위각 한계 — 구조형식 + 높이(JGJ 3 3.7.3: ≥250m 1/500, 150~250m 선형보간) */
export function driftLimitCN(p: BuildingSpec, H = heightAboveGround(p)): { lim: number; sys: string } {
  const sys = sysOf(p)
  const base = sys === 'frame' ? 1 / 550 : 1 / 800
  const lim = H <= 150 ? base : H >= 250 ? 1 / 500 : base + (1 / 500 - base) * (H - 150) / 100
  return { lim, sys: SYS_ZH[sys] }
}

export function cnReviewEvaluate(p: BuildingSpec, sp: Record<string, any>, data: Record<string, any>, ctx: { rs: boolean; T1: number | null; lambda: number | null; model?: any; grav?: { D: number[]; L: number[] } }): ReviewItem[] {
  const items: ReviewItem[] = []
  const src = ctx.rs ? 'RS' : 'ST'
  const H = heightAboveGround(p), sys = sysOf(p), c = col(sp.intensity), deg = +String(sp.intensity || '7')[0]
  const tall = isTallCN(p, H)
  const hg = heightGrade(sys, c, H)
  const B = tall && hg.grade !== 'A'   // B级 또는 초과 → 더 엄격한 한계

  /* 0) 房屋高度 · 抗震等级 · 混凝土强度等级 */
  const aTxt = hg.a != null ? `A ≤ ${hg.a} m` : 'A —'
  items.push({ id: 'height', label: t('rv_height'), value: `${H.toFixed(1)} m${tall ? '' : ` (${t('rv_not_tall')})`}`,
    limit: `${aTxt}${hg.b != null ? ` · B ≤ ${hg.b} m` : ''} (${SYS_ZH[sys]})`,
    status: hg.grade === 'A' ? 'ok' : hg.grade === 'B' ? 'warn' : 'ng', where: hg.grade === 'A' ? t('rv_grade_a') : hg.grade === 'B' ? t('rv_grade_b') : t('rv_grade_over'),
    clause: 'JGJ 3-2010 3.3.1' })
  const cat = categoryCN(p, sp), md = cat === 'B' ? deg + 1 : deg   // 내진조치 열도
  const sg = md > 9 ? { frame: 0, wall: sys === 'frame' ? undefined : 0 } : seismicGrade(sys, md, H)
  const beyond = cat === 'B' && md <= 9 && H > H_TOP[sys][md]
  const gTxt = `${t('rv_frame')} ${ZH_NUM[sg.frame]}${sg.wall != null ? ` · ${t('rv_wall')} ${ZH_NUM[sg.wall]}` : ''}`
  items.push({ id: 'grade', label: t('rv_grade'), value: gTxt,
    limit: `${cat === 'B' ? '乙类' : '丙类'} · ${md !== deg ? `${deg}度 → ${md > 9 ? '9度+' : `${md}度`}` : `${deg}度`} · ${H.toFixed(0)} m`,
    status: beyond ? 'warn' : 'info', where: beyond ? t('rv_grade_beyond') : undefined,
    clause: cat === 'B' ? (md > 9 ? 'GB 55002 2.3.2 / JGJ 3 3.9.3' : beyond ? 'GB 55002 2.3.2 / GB 50011 6.1.3' : 'GB 55002 2.3.2 · 5.2.1') : 'GB 55002 5.2.1',
    note: t(cat === 'B' ? 'rv_grade_note_B' : 'rv_grade_note_C') })
  const mats = new Set<string>([p.matName, ...(RC.paletteFor(p).mats || [])].filter(Boolean) as string[])
  const fcu = (m: string) => +(m.match(/^C(\d+)$/)?.[1] || NaN)
  const minMat = [...mats].filter(m => !isNaN(fcu(m))).sort((a, b) => fcu(a) - fcu(b))[0]
  const need = Math.min(sg.frame, sg.wall ?? 9) <= 2 ? 30 : 25
  if (minMat) items.push({ id: 'concrete', label: t('rv_concrete'), value: minMat, limit: `≥ C${need}${need === 30 ? ` (${t('rv_grade')} ≤ 二)` : ''}`,
    status: fcu(minMat) >= need ? 'ok' : 'ng', clause: 'GB 55008 2.0.2' })

  /* 1) 층간변위각 — 층별 Δ/h 도 보관(비틀림 40% 완화 판정용) */
  const { lim } = driftLimitCN(p, H)
  const driftAt: Record<string, number> = {}
  for (const [d, key] of [['X', 'DX'], ['Y', 'DY']] as const) {
    let max = 0, where = ''
    for (const r of tableObjs(data[key], key)) {
      const th = num(r[DRIFT_COL]) / num(r['Story Height'])
      if (th > (driftAt[`${d}:${r.Story}`] ?? 0)) driftAt[`${d}:${r.Story}`] = th
      if (th > max) { max = th; where = r.Story }
    }
    const clause = tall ? 'JGJ 3 3.7.3 / GB 50011 5.5.1' : 'GB 50011 5.5.1'
    items.push(max > 0
      ? { id: 'drift', label: t('rv_drift'), dir: d, value: inv(max), limit: `≤ ${inv(lim)} (${SYS_ZH[sys]})`, status: max <= lim ? 'ok' : 'ng', where, clause, note: src }
      : { id: 'drift', label: t('rv_drift'), dir: d, value: '-', limit: `≤ ${inv(lim)}`, status: 'info', clause, note: t('rv_no_data') })
  }
  /* 2) 剪重比 (RS 일 때 — 정적 底部剪力法은 산정 단계에서 λ 를 이미 반영) */
  if (ctx.rs) {
    for (const [d, key] of [['X', 'SX'], ['Y', 'SY']] as const) {
      let min = Infinity, where = ''
      for (const r of tableObjs(data[key], key)) {
        const cc = num(r['Story Shear Force Coefficient/' + d])
        if (cc > 0 && cc < min) { min = cc; where = r.Story }
      }
      const lam = ctx.lambda ?? 0
      items.push(isFinite(min)
        ? { id: 'shear', label: t('rv_shear'), dir: d, value: min.toFixed(4), limit: `≥ λ ${lam.toFixed(4)}`, status: min >= lam - 1e-6 ? 'ok' : 'ng', where, clause: 'GB 55002 4.2.3' }
        : { id: 'shear', label: t('rv_shear'), dir: d, value: '-', limit: `≥ λ ${lam.toFixed(4)}`, status: 'info', clause: 'GB 55002 4.2.3', note: t('rv_no_data') })
    }
  }
  /* 3) 扭转位移比 — 정적 EX/EY(+5% 偶然偏心). 상한: A级·비고층 1.5, B级 1.4. 층간변위각 ≤ 0.4×한계인 층은 1.6(JGJ 3 3.4.5 注) */
  const hard = B ? 1.4 : 1.5
  for (const [d, key] of [['X', 'TX'], ['Y', 'TY']] as const) {
    let worst: { r: number; story: string; cap: number } | null = null
    for (const row of tableObjs(data[key], key)) {
      const avg = num(row['Average Value of Extreme Points/Story Drift']), mx = num(row['Maximum Value/Story Drift'])
      if (!(avg > 1e-9)) continue
      const r = mx / avg
      const relaxed = tall && (driftAt[`${d}:${row.Story}`] ?? Infinity) <= 0.4 * lim
      const cap = relaxed ? 1.6 : hard
      /* 지배 층 = 상한 대비 여유가 가장 작은 층 */
      if (!worst || r / cap > worst.r / worst.cap) worst = { r, story: row.Story, cap }
    }
    const clause = tall ? 'JGJ 3 3.4.5 / GB 50011 3.4.3' : 'GB 50011 3.4.3 / 3.4.4'
    items.push(worst
      ? { id: 'torsion', label: t('rv_torsion'), dir: d, value: worst.r.toFixed(2), limit: `≤ 1.2 (≤ ${worst.cap})`, status: worst.r <= 1.2 ? 'ok' : worst.r <= worst.cap ? 'warn' : 'ng',
          where: worst.story, clause, note: worst.cap === 1.6 ? t('rv_torsion_relaxed') : t('rv_torsion_src') }
      : { id: 'torsion', label: t('rv_torsion'), dir: d, value: '-', limit: `≤ 1.2 (≤ ${hard})`, status: 'info', clause, note: t('rv_no_data') })
  }
  /* 4) 주기·질량참여 (EIGENVALUEMODE SUB_TABLES) */
  const periods = subTableObjs(data.EV, 'EV', 'EIGENVALUE ANALYSIS').map(r => ({ mode: Math.round(num(r.ModeNo ?? r.Mode)), T: num(r['Period(sec)']) }))
  const modes = classifyModes(subTableObjs(data.EV, 'EV', 'MODAL PARTICIPATION MASSES'))
  const Tof = (m: number) => periods.find(x => x.mode === m)?.T ?? NaN
  if (modes.length) {
    const last = modes[modes.length - 1]
    for (const [d, v] of [['X', last.sumX], ['Y', last.sumY]] as const)
      items.push({ id: 'mass', label: t('rv_mass'), dir: d, value: `${v.toFixed(1)}%`, limit: '≥ 90%', status: v >= 90 ? 'ok' : 'ng', where: `${modes.length} ${t('modes')}`, clause: 'GB 50011 5.2.2 条文说明' })
    const pLim = B ? 0.85 : 0.9
    const t1 = modes.find(m => m.dom !== 'RZ'), tt = modes.find(m => m.dom === 'RZ')
    const r = t1 && tt ? Tof(tt.mode) / Tof(t1.mode) : NaN
    if (!tall) {
      items.push({ id: 'period', label: t('rv_period'), value: isFinite(r) ? r.toFixed(3) : '-', limit: `≤ ${pLim}`, status: 'info', clause: 'JGJ 3 3.4.5', note: t('rv_period_not_tall') })
    } else if (t1 && tt && isFinite(r)) {
      items.push({ id: 'period', label: t('rv_period'), value: r.toFixed(3), limit: `≤ ${pLim}`, status: r <= pLim ? 'ok' : 'ng',
        where: `Tt=${Tof(tt.mode).toFixed(3)}s (${tt.mode}) / T1=${Tof(t1.mode).toFixed(3)}s (${t1.mode}·${t1.dom})`, clause: 'JGJ 3 3.4.5' })
    } else items.push({ id: 'period', label: t('rv_period'), value: '-', limit: `≤ ${pLim}`, status: 'info', clause: 'JGJ 3 3.4.5', note: t('rv_no_torsion_mode') })
  } else {
    items.push({ id: 'mass', label: t('rv_mass'), value: '-', limit: '≥ 90%', status: 'info', clause: 'GB 50011 5.2.2 条文说明', note: t('rv_no_data') })
  }
  /* 5) 侧向刚度比·刚重比·倾覆力矩比·轴压比·嵌固端刚度比 (cnReviewExtra.ts) */
  const fg = RC.deriveFloorGroups(p)
  let nb = 0
  for (let s = 1; s <= p.stories; s++) if (fg[s] && fg[s].role === 'BASEMENT') nb = s
  items.push(...cnExtraItems(p, data, ctx.model, { sys, tall, H, frameGrade: sg.frame, grav: ctx.grav || { D: [], L: [] }, nb }))
  return items
}
