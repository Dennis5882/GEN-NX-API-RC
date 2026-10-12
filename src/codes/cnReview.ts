/* ════════════════════════════════════════════════════════════
   중국 심사 지표(审图) — 동적해석 뒤 Gen NX 층 결과 테이블을 읽어 GB 한계와 비교.
   값 = Gen 표(라이브 확인 헤더, MAPI_FINDINGS 2026-10-12), 한계 = 원문 KB 대조 조문.
   - 층간변위각  GB 50011 5.5.1 표 (框架 1/550, 框架-抗震墙·框架-核心筒 1/800) — 多遇地震 표준값(계수 1.0)
   - 剪重比     GB 50011 5.2.5 / GB 55002 4.2.3 (λ = 0.2αmax × 주기보정)
   - 扭转位移比  GB 50011 3.4.3 표 3.4.3-1(>1.2 扭转不规则), 3.4.4-1-1)(≤1.5 宜) — 偶然偏心 규정수평력(EX/EY+5%)
   - 有效质量    GB 50011 5.2.2 条文说明 (振型参与质量 ≥ 90%)
   - 周期比      JGJ 3-2010 3.4.5 (A级 Tt/T1 ≤ 0.9) — ⚠ JGJ 3 원문 KB 없음(미대조)
════════════════════════════════════════════════════════════ */
import type { BuildingSpec } from '../engine/types'
import { t } from '../i18n'
import { classifyModes, num, subTableObjs, tableObjs } from '../mapi/tables'
import type { ReviewItem, ReviewTable } from './types'

const DRIFT_COL = 'Maximum Drift of All Vertical Elements/Story Drift'

export function cnReviewTables(ctx: { rs: boolean }): ReviewTable[] {
  const [lx, ly] = ctx.rs ? ['RSX(RS)', 'RSY(RS)'] : ['EX(ST)', 'EY(ST)']
  const out: ReviewTable[] = [
    { key: 'EV', type: 'EIGENVALUEMODE' },
    { key: 'DX', type: 'STORY_DRIFT_X', lcs: [lx] },
    { key: 'DY', type: 'STORY_DRIFT_Y', lcs: [ly] },
    { key: 'TX', type: 'TORSIONAL_IRREGULARITY_X', lcs: ['EX(ST)'] },
    { key: 'TY', type: 'TORSIONAL_IRREGULARITY_Y', lcs: ['EY(ST)'] },
  ]
  if (ctx.rs) out.push({ key: 'SX', type: 'STORY_SHEAR_FORCE_COEFFICIENT', lcs: ['RSX(RS)'] }, { key: 'SY', type: 'STORY_SHEAR_FORCE_COEFFICIENT', lcs: ['RSY(RS)'] })
  return out
}

const inv = (x: number) => (x > 0 ? `1/${Math.round(1 / x)}` : '-')

/** 구조형식별 층간변위각 한계 — 벽(코어) 있으면 框架-抗震墙/框架-核心筒 1/800, 없으면 框架 1/550 */
export function driftLimitCN(p: BuildingSpec): { lim: number; sys: string } {
  const walls = (p.core as any)?.on || (Array.isArray(p.walls) && p.walls.length)
  return walls ? { lim: 1 / 800, sys: '框架-抗震墙' } : { lim: 1 / 550, sys: '框架' }
}

export function cnReviewEvaluate(p: BuildingSpec, data: Record<string, any>, ctx: { rs: boolean; T1: number | null; lambda: number | null }): ReviewItem[] {
  const items: ReviewItem[] = []
  const src = ctx.rs ? 'RS' : 'ST'
  /* 1) 층간변위각 */
  const { lim, sys } = driftLimitCN(p)
  for (const [d, key] of [['X', 'DX'], ['Y', 'DY']] as const) {
    let max = 0, where = ''
    for (const r of tableObjs(data[key], key)) {
      const th = num(r[DRIFT_COL]) / num(r['Story Height'])
      if (th > max) { max = th; where = r.Story }
    }
    items.push(max > 0
      ? { id: 'drift', label: t('rv_drift'), dir: d, value: inv(max), limit: `≤ ${inv(lim)} (${sys})`, status: max <= lim ? 'ok' : 'ng', where, clause: 'GB 50011 5.5.1', note: src }
      : { id: 'drift', label: t('rv_drift'), dir: d, value: '-', limit: `≤ ${inv(lim)}`, status: 'info', clause: 'GB 50011 5.5.1', note: t('rv_no_data') })
  }
  /* 2) 剪重比 (RS 일 때 — 정적 底部剪力法은 산정 단계에서 λ 를 이미 반영) */
  if (ctx.rs) {
    for (const [d, key] of [['X', 'SX'], ['Y', 'SY']] as const) {
      let min = Infinity, where = ''
      for (const r of tableObjs(data[key], key)) {
        const c = num(r['Story Shear Force Coefficient/' + d])
        if (c > 0 && c < min) { min = c; where = r.Story }
      }
      const lam = ctx.lambda ?? 0
      items.push(isFinite(min)
        ? { id: 'shear', label: t('rv_shear'), dir: d, value: min.toFixed(4), limit: `≥ λ ${lam.toFixed(4)}`, status: min >= lam - 1e-6 ? 'ok' : 'ng', where, clause: 'GB 55002 4.2.3' }
        : { id: 'shear', label: t('rv_shear'), dir: d, value: '-', limit: `≥ λ ${lam.toFixed(4)}`, status: 'info', clause: 'GB 55002 4.2.3', note: t('rv_no_data') })
    }
  }
  /* 3) 扭转位移比 — 정적 EX/EY(+5% 偶然偏心) */
  for (const [d, key] of [['X', 'TX'], ['Y', 'TY']] as const) {
    let max = 0, where = ''
    for (const r of tableObjs(data[key], key)) {
      const avg = num(r['Average Value of Extreme Points/Story Drift']), mx = num(r['Maximum Value/Story Drift'])
      if (avg > 1e-9 && mx / avg > max) { max = mx / avg; where = r.Story }
    }
    items.push(max > 0
      ? { id: 'torsion', label: t('rv_torsion'), dir: d, value: max.toFixed(2), limit: '≤ 1.2 (≤ 1.5)', status: max <= 1.2 ? 'ok' : max <= 1.5 ? 'warn' : 'ng', where, clause: 'GB 50011 3.4.3 / 3.4.4', note: t('rv_torsion_src') }
      : { id: 'torsion', label: t('rv_torsion'), dir: d, value: '-', limit: '≤ 1.2 (≤ 1.5)', status: 'info', clause: 'GB 50011 3.4.3 / 3.4.4', note: t('rv_no_data') })
  }
  /* 4) 주기·질량참여 (EIGENVALUEMODE SUB_TABLES) */
  const periods = subTableObjs(data.EV, 'EV', 'EIGENVALUE ANALYSIS').map(r => ({ mode: Math.round(num(r.ModeNo ?? r.Mode)), T: num(r['Period(sec)']) }))
  const modes = classifyModes(subTableObjs(data.EV, 'EV', 'MODAL PARTICIPATION MASSES'))
  const Tof = (m: number) => periods.find(x => x.mode === m)?.T ?? NaN
  if (modes.length) {
    const last = modes[modes.length - 1]
    for (const [d, v] of [['X', last.sumX], ['Y', last.sumY]] as const)
      items.push({ id: 'mass', label: t('rv_mass'), dir: d, value: `${v.toFixed(1)}%`, limit: '≥ 90%', status: v >= 90 ? 'ok' : 'ng', where: `${modes.length} ${t('modes')}`, clause: 'GB 50011 5.2.2 条文说明' })
    const t1 = modes.find(m => m.dom !== 'RZ'), tt = modes.find(m => m.dom === 'RZ')
    const r = t1 && tt ? Tof(tt.mode) / Tof(t1.mode) : NaN
    if (t1 && tt && isFinite(r)) {
      items.push({ id: 'period', label: t('rv_period'), value: r.toFixed(3), limit: '≤ 0.9', status: r <= 0.9 ? 'ok' : 'ng',
        where: `Tt=${Tof(tt.mode).toFixed(3)}s (${tt.mode}) / T1=${Tof(t1.mode).toFixed(3)}s (${t1.mode}·${t1.dom})`, clause: 'JGJ 3-2010 3.4.5', note: t('rv_unverified_clause') })
    } else items.push({ id: 'period', label: t('rv_period'), value: '-', limit: '≤ 0.9', status: 'info', clause: 'JGJ 3-2010 3.4.5', note: t('rv_no_torsion_mode') })
  } else {
    items.push({ id: 'mass', label: t('rv_mass'), value: '-', limit: '≥ 90%', status: 'info', clause: 'GB 50011 5.2.2 条文说明', note: t('rv_no_data') })
  }
  return items
}
