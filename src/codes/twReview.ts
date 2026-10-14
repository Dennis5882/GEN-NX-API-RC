/* ════════════════════════════════════════════════════════════
   대만 검토 지표 — 동적해석 뒤 Gen NX 층 결과 테이블을 읽어 建築物耐震設計規範(113.03.01) 한계와 비교 (CN 审图·KR 검토와 같은 틀).
   근거 KB: COde/TW/knowledge/seismic-design-code (2026-10-14 재변환판)
   - 해석법       3.1  지상 ≥50m·≥15층, 또는 >20m·>5층 + 표1-1 1~3 / 표1-2 1 불규칙 → 동적해석
   - 층간변위각   2.16.1 V = I·Fu/4.2·(SaD/Fu)m·W (T 는 1.4배 상한 없음·I=1 가능) 에서 ≤ 0.005
                  Gen 결과는 현재 가력(정적 V · RS 조정 후 V) 기준이라 V* 대 V 비로 환산 — SaD 0.4SDS 하한 없음
   - 비틀림       표1-2 1  의도적 편심(±5%) 포함 최대/평균 층변위 > 1.2 → 불규칙(2.14 A_x 증폭은 미반영)
   - 연층         표1-1 1a·1b  K < 0.7·상층 또는 0.8·상부 3층 평균 = 軟層, < 0.6·0.7 = 極軟層(不容許)
   - 질량         표1-1 2  > 인접층 150% (지붕 아래층이 지붕층보다 무거운 경우 제외)
   - P-Δ          2.13  θ = Σ(D+L)·Δ/(V·h) = P/(K·h) ≥ 0.1 이면 P-Δ 고려 (미반영 — 안내)
   - 유효질량     3.5   X·Y 각각 ≥ 90%
   - RS 총횡력    3.3   V_RS ≥ 0.9(정형)·1.0(비정형)×정적 V (조정 η 안내)
════════════════════════════════════════════════════════════ */
import { RC, type BuildingSpec } from '../engine'
import { t } from '../i18n'
import { classifyModes, num, subTableObjs, tableObjs } from '../mapi/tables'
import { rowsOf, storyByLevel, storyName } from './cnReviewExtra'
import { heightAboveGround } from './selfweight'
import type { ReviewItem, ReviewTable } from './types'
import { fuTW, modTW, saTW, siteTW, storyGravityTW, storyWeightsTW } from './tw'

const DRIFT_COL = 'Maximum Drift of All Vertical Elements/Story Drift'
const SD = { ADDITIONAL: { SET_CALCULATION_METHOD: { STORY_DRIFT_METHOD: 'Drift at the Center of Mass', STORY_STIFFNESS_METHOD: 'Story Shear / Story Drift' } } }
const DRIFT_LIM = 0.005

export function twReviewTables(ctx: { rs: boolean }): ReviewTable[] {
  const [lx, ly] = ctx.rs ? ['RSX(RS)', 'RSY(RS)'] : ['EX(ST)', 'EY(ST)']
  return [
    { key: 'EV', type: 'EIGENVALUEMODE' },
    { key: 'DX', type: 'STORY_DRIFT_X', lcs: [lx] },
    { key: 'DY', type: 'STORY_DRIFT_Y', lcs: [ly] },
    { key: 'TX', type: 'TORSIONAL_IRREGULARITY_X', lcs: ['EX(ST)'] },
    { key: 'TY', type: 'TORSIONAL_IRREGULARITY_Y', lcs: ['EY(ST)'] },
    { key: 'KX', type: 'STIFFNESS_IRREGULARITY_X', lcs: [lx], extra: SD },
    { key: 'KY', type: 'STIFFNESS_IRREGULARITY_Y', lcs: [ly], extra: SD },
  ]
}

/** 2.16.1 변위 검토용 V* 계수 (I=1, T 상한·SaD 하한 없음) */
export function driftCoefTW(T: number, sp: Record<string, any>): number {
  const { SDS, T0D, basin } = siteTW(sp)
  if (!(SDS > 0) || !(T0D > 0)) return 0
  const R = sp.R != null ? +sp.R : 4.8
  const Ra = 1 + (R - 1) / (basin ? 2.0 : 1.5)
  const Sa = T > 2.5 * T0D ? SDS * T0D / T : saTW(T, SDS, T0D)
  const Fu = fuTW(T, Ra, T0D)
  return Fu / (basin ? 3.5 : 4.2) * modTW(Sa / Fu)
}

export function twReviewEvaluate(p: BuildingSpec, sp: Record<string, any>, data: Record<string, any>,
  ctx: { rs: boolean; T1: number | null; rsChk?: any; model?: any; V?: number | null }): ReviewItem[] {
  const items: ReviewItem[] = []
  const src = ctx.rs ? 'RS' : 'ST'
  const H = heightAboveGround(p)
  const elev: number[] = ctx.model?.elev?.length ? ctx.model.elev : RC.storyElevations(p)
  const n = p.stories, g = RC.deriveFloorGroups(p)
  let nb = 0
  for (let s = 1; s <= n; s++) if (g[s] && g[s].role === 'BASEMENT') nb = s
  const above = n - nb
  const hOf = (s: number) => ((elev[s] || 0) - (elev[s - 1] || 0)) / 1000

  /* 모드·주기 — 방향별 지배 모드 주기 */
  const per = subTableObjs(data.EV, 'EV', 'EIGENVALUE ANALYSIS').map(r => ({ mode: Math.round(num(r.ModeNo ?? r.Mode)), T: num(r['Period(sec)']) }))
  const modes = classifyModes(subTableObjs(data.EV, 'EV', 'MODAL PARTICIPATION MASSES'))
  const Tdir = (d: 'X' | 'Y') => {
    const m = modes.find(x => x.dom === d)
    const T = m ? per.find(q => q.mode === m.mode)?.T : NaN
    return T != null && isFinite(T) ? T : (ctx.T1 || 0)
  }
  const W = storyWeightsTW(p, sp)
  const Wtot = W.reduce((a, b) => a + (b || 0), 0)

  /* 0) 층간변위각 — 현재 가력 V_used 에서 V* 로 환산 */
  const vUsed: Record<'X' | 'Y', number> = { X: 0, Y: 0 }
  for (const d of ['X', 'Y'] as const) {
    const c = ctx.rsChk?.[d]
    vUsed[d] = ctx.rs && c && c.Vrs > 0 ? c.Vrs * (c.eta || 1) : (ctx.V ?? 0)
  }
  for (const [d, key] of [['X', 'DX'], ['Y', 'DY']] as const) {
    const Vstar = driftCoefTW(Tdir(d), sp) * Wtot
    const k = vUsed[d] > 0 && Vstar > 0 ? Vstar / vUsed[d] : 1
    let max = 0, where = ''
    for (const r of tableObjs(data[key], key)) {
      const th = num(r[DRIFT_COL]) / num(r['Story Height']) * k
      if (th > max) { max = th; where = r.Story }
    }
    const clause = '耐震規範 2.16.1'
    items.push(max > 0
      ? { id: 'drift', label: t('rv_drift'), dir: d, value: max.toFixed(4), limit: `≤ ${DRIFT_LIM}`, status: max <= DRIFT_LIM ? 'ok' : 'ng', where, clause,
          note: `${src} · ${t('rv_tw_drift_note', Tdir(d).toFixed(2), k.toFixed(2))}` }
      : { id: 'drift', label: t('rv_drift'), dir: d, value: '-', limit: `≤ ${DRIFT_LIM}`, status: 'info', clause, note: t('rv_no_data') })
  }

  /* 1) 비틀림 불규칙 (표1-2 1) */
  let irr = false
  for (const [d, key] of [['X', 'TX'], ['Y', 'TY']] as const) {
    let worst: { r: number; story: string } | null = null
    for (const row of tableObjs(data[key], key)) {
      const avg = num(row['Average Value of Extreme Points/Story Drift']), mx = num(row['Maximum Value/Story Drift'])
      if (!(avg > 1e-9)) continue
      if (!worst || mx / avg > worst.r) worst = { r: mx / avg, story: row.Story }
    }
    const clause = '耐震規範 表1-2 · 2.14'
    if (worst && worst.r > 1.2) irr = true
    items.push(worst
      ? { id: 'torsion', label: t('rv_torsion'), dir: d, value: worst.r.toFixed(2), limit: '≤ 1.2', status: worst.r <= 1.2 ? 'ok' : 'warn',
          where: worst.story, clause, note: worst.r > 1.2 ? t('rv_tw_torsion_note', Math.min(3, (worst.r / 1.2) ** 2).toFixed(2)) : t('rv_torsion_src') }
      : { id: 'torsion', label: t('rv_torsion'), dir: d, value: '-', limit: '≤ 1.2', status: 'info', clause, note: t('rv_no_data') })
  }

  /* 2) 연층(軟層·極軟層) · 질량 · P-Δ — K = V/Δ (kN/m) */
  const K: Record<'X' | 'Y', number[]> = { X: [], Y: [] }
  for (const [d, key] of [['X', 'KX'], ['Y', 'KY']] as const)
    for (const r of rowsOf(data[key], key)) { const s = storyByLevel(elev, num(r.Level)); if (s > 0) K[d][s] = num(r['Story Stiffness']) }
  for (const d of ['X', 'Y'] as const) {
    const k = K[d]
    let worst: { s: number; v: number; lim: number; vlim: number; avg3: boolean } | null = null
    for (let s = nb + 1; s < n; s++) {
      if (!(k[s] > 0 && k[s + 1] > 0)) continue
      const c = [{ v: k[s] / k[s + 1], lim: 0.7, vlim: 0.6, avg3: false }]
      const up = [1, 2, 3].map(i => k[s + i]).filter(x => x > 0)
      if (up.length === 3) c.push({ v: k[s] / (up.reduce((a, b) => a + b, 0) / 3), lim: 0.8, vlim: 0.7, avg3: true })
      for (const x of c) if (!worst || x.v / x.lim < worst.v / worst.lim) worst = { s, ...x }
    }
    const clause = '耐震規範 表1-1 1a·1b'
    if (worst && worst.v < worst.lim) irr = true
    items.push(worst
      ? { id: 'soft', label: t('rv_kr_soft'), dir: d, value: worst.v.toFixed(2), limit: `≥ ${worst.lim}${worst.avg3 ? ` (${t('rv_stiff_avg3')})` : ''}`,
          status: worst.v >= worst.lim ? 'ok' : worst.v >= worst.vlim ? 'warn' : 'ng', where: storyName(p, worst.s), clause,
          note: worst.v >= worst.lim ? t('rv_stiff_note') : worst.v >= worst.vlim ? t('rv_tw_soft_note') : t('rv_tw_vsoft_note') }
      : { id: 'soft', label: t('rv_kr_soft'), dir: d, value: '-', limit: '≥ 0.7', status: 'info', clause, note: t('rv_no_data') })
  }
  {
    let worst: { s: number; v: number } | null = null
    for (let s = nb + 1; s <= n; s++) {
      /* 인접층 비교 — 지붕 아래층이 지붕층보다 무거운 경우는 제외(표1-1 2 단서) */
      const nbr = [s - 1 > nb ? s - 1 : 0, s + 1 <= n && !(s + 1 === n && W[s] > W[n]) ? s + 1 : 0].filter(x => x > 0 && W[x] > 0)
      for (const j of nbr) { const v = W[s] / W[j]; if (!worst || v > worst.v) worst = { s, v } }
    }
    const clause = '耐震規範 表1-1 2'
    if (worst && worst.v > 1.5) irr = true
    items.push(worst
      ? { id: 'weight', label: t('rv_kr_weight'), value: `${(worst.v * 100).toFixed(0)}%`, limit: '≤ 150%', status: worst.v <= 1.5 ? 'ok' : 'warn',
          where: storyName(p, worst.s), clause, note: t('rv_tw_weight_note') }
      : { id: 'weight', label: t('rv_kr_weight'), value: '-', limit: '≤ 150%', status: 'info', clause, note: t('rv_no_data') })
  }
  {
    const gr = storyGravityTW(p, sp)
    for (const d of ['X', 'Y'] as const) {
      let worst: { s: number; v: number } | null = null
      for (let s = nb + 1; s <= n; s++) {
        const k = K[d][s]
        if (!(k > 0)) continue
        let P = 0
        for (let j = s; j <= n; j++) P += (gr.D[j] || 0) + (gr.L[j] || 0)
        const v = P / (k * hOf(s))
        if (!worst || v > worst.v) worst = { s, v }
      }
      const clause = '耐震規範 2.13'
      items.push(worst
        ? { id: 'pdelta', label: t('rv_kr_pdelta'), dir: d, value: worst.v.toFixed(3), limit: '< 0.10', status: worst.v < 0.1 ? 'ok' : 'warn',
            where: storyName(p, worst.s), clause, note: worst.v < 0.1 ? t('rv_kr_pdelta_ok') : t('rv_tw_pdelta_ng') }
        : { id: 'pdelta', label: t('rv_kr_pdelta'), dir: d, value: '-', limit: '< 0.10', status: 'info', clause, note: t('rv_no_data') })
    }
  }

  /* 3) 해석법 3.1 */
  {
    const need = H >= 50 || above >= 15 || ((H > 20 || above > 5) && (irr || sp.regular === 'N'))
    items.push({ id: 'method', label: t('rv_method'), value: ctx.rs ? t('tw_method_RS') : t('tw_method_ESL'),
      limit: need ? t('rv_method_dyn') : t('rv_method_esl_ok'), status: need && !ctx.rs ? 'ng' : 'ok',
      where: `H ${H.toFixed(1)} m · ${t('kr_floors', above)}${irr ? ' · ' + t('rv_tw_irr') : ''}`, clause: '耐震規範 3.1' })
  }

  /* 4) 유효질량 ≥ 90% (3.5) */
  if (modes.length) {
    const last = modes[modes.length - 1]
    for (const [d, v] of [['X', last.sumX], ['Y', last.sumY]] as const)
      items.push({ id: 'mass', label: t('rv_mass'), dir: d, value: `${v.toFixed(1)}%`, limit: '≥ 90%', status: v >= 90 ? 'ok' : 'ng', where: `${modes.length} ${t('modes')}`, clause: '耐震規範 3.5' })
  } else items.push({ id: 'mass', label: t('rv_mass'), value: '-', limit: '≥ 90%', status: 'info', clause: '耐震規範 3.5', note: t('rv_no_data') })

  /* 5) RS 총횡력 조정 (3.3) — 정보 */
  if (ctx.rs && ctx.rsChk) for (const d of ['X', 'Y'] as const) {
    const c = ctx.rsChk[d]
    if (c) items.push({ id: 'rsadj', label: t('rv_tw_rsadj'), dir: d, value: c.eta.toFixed(3), limit: `V_RS ${Math.round(c.Vrs)} / ${Math.round((ctx.rsChk.ratio || 0.9) * 100)}%V ${Math.round((ctx.rsChk.ratio || 0.9) * c.Vst)} kN`,
      status: 'info', clause: '耐震規範 3.2 · 3.3', note: t('rv_tw_rsadj_note') })
  }
  return items
}
