/* ════════════════════════════════════════════════════════════
   한국 검토 지표 — 동적해석 뒤 Gen NX 층 결과 테이블을 읽어 KDS 41 17 00 한계와 비교 (중국 审图와 같은 틀).
   - 내진설계범주   5.2 표 5.2-1·5.2-2 (S_DS·S_D1·내진등급)
   - 시스템 높이     6.2 표 6.2-1 (범주 D 높이 제한: RC 보통모멘트골조 30m, 보통전단벽 계열 60m)
   - 해석법          7.1 (범주 C·D 높이·층수·비정형 → 동적해석)
   - 층간변위        7.2.8.1 Δ = C_d·δ_e/I_E ≤ 8.2.3 표 8.2-1 Δ_a (특 0.010·I 0.015·II 0.020 h_sx).
                     RS 결과는 SPLC 에 곱한 C_m 을 나눠 제외(7.3.3.5 '층간변위에는 C_m 을 곱하지 않는다')
   - 비틀림 비정형   5.3 표 5.3-1 H-1 (우발편심 포함 최대/평균 층변위 > 1.2, 범주 C·D 에서 의미)
   - 유효질량        7.3.3.1 (직교 각 방향 ≥ 90%)
   - RS 보정 C_m     7.3.3.5 (정보)
   - 연층 V-1        표 5.3-2 (K < 0.7·상층 또는 < 0.8·상부 3층 평균) — K = 층전단/층간변위(Gen STIFFNESS_IRREGULARITY 'Story Shear / Story Drift').
                     5.3.2 ① 예외(층간변위각비 ≤ 130%)는 미적용(보수적), 최상 2개 층 제외
   - 중량비 V-2      표 5.3-2 (W > 1.5·인접층, 하부층보다 가벼운 지붕층 제외) — 앱 지진 유효중량(7.2.1)
   - P-Δ 안정계수    7.2.8.2 θ = P_x·Δ/(V_x·h_sx·C_d), Δ = C_d·Δ_e/I_E → θ = P_x/(I_E·K·h). θ ≤ 0.1 생략, θ_max = 0.5/C_d ≤ 0.25(β = 1)
                     P_x = Σ(D + L) (하중계수 1.0)
   - 비정형 발견 + 등가정적 → 7.1 동적해석 필요 재판정
   P-Δ 증폭(a_d = 1/(1−θ)) 적용·비틀림증폭 A_x 는 미반영(알려진 단순화)
════════════════════════════════════════════════════════════ */
import type { BuildingSpec } from '../engine'
import { t } from '../i18n'
import { classifyModes, num, subTableObjs, tableObjs } from '../mapi/tables'
import { heightAboveGround } from './selfweight'
import type { ReviewItem, ReviewTable } from './types'
import { RC } from '../engine'
import { IE_KR, SYSTEMS, impKR, rsRequiredKR, siteKR, sdcKR, storyGravityKR, storyWeightsKR, systemKR } from './kr'
import { rowsOf, storyByLevel, storyName } from './cnReviewExtra'

const DRIFT_COL = 'Maximum Drift of All Vertical Elements/Story Drift'
const SD = { ADDITIONAL: { SET_CALCULATION_METHOD: { STORY_DRIFT_METHOD: 'Drift at the Center of Mass', STORY_STIFFNESS_METHOD: 'Story Shear / Story Drift' } } }
const DA: Record<string, number> = { S: 0.010, 1: 0.015, 2: 0.020, 3: 0.020 }

export function krReviewTables(ctx: { rs: boolean }): ReviewTable[] {
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

export function krReviewEvaluate(p: BuildingSpec, sp: Record<string, any>, data: Record<string, any>,
  ctx: { rs: boolean; T1: number | null; rsChk?: any; model?: any }): ReviewItem[] {
  const items: ReviewItem[] = []
  const st = siteKR(sp)
  const imp = impKR(p, sp.imp), Ie = IE_KR[imp]
  const grade = t('kr_grade_n', imp)
  const sdc = sdcKR(st.SDS, st.SD1, imp)
  const sysId = systemKR(p, sp), sys = SYSTEMS[sysId]
  const H = heightAboveGround(p)
  const src = ctx.rs ? 'RS' : 'ST'

  /* 0) 내진설계범주 · 시스템 높이 제한 · 해석법 */
  items.push({ id: 'sdc', label: t('rv_sdc'), value: sdc, limit: `S_DS ${st.SDS.toFixed(3)} · S_D1 ${st.SD1.toFixed(3)} · ${t('rv_kr_grade')} ${grade} (I_E ${Ie})`,
    status: 'info', clause: 'KDS 41 17 00 5.2' })
  const lim = sdc === 'D' ? sys.limD : undefined
  items.push({ id: 'system', label: t('rv_sys'), value: `${H.toFixed(1)} m`, limit: `${t(`kr_sys_${sysId}` as any)} · ${lim ? t('rv_kr_limd', lim) : t('rv_no_limit')}`,
    status: lim && H > lim ? 'ng' : 'ok', clause: `KDS 41 17 00 표 6.2-1 ${sys.ref}` })
  const req = rsRequiredKR(p, { ...sp, method: 'auto' })
  items.push({ id: 'method', label: t('rv_method'), value: ctx.rs ? t('kr_method_RS') : t('kr_method_ESL'),
    limit: req.req ? t('rv_method_dyn') : t('rv_method_esl_ok'), status: req.req && !ctx.rs ? 'ng' : 'ok',
    where: `${sdc} · H ${req.H.toFixed(1)} m · ${t('kr_floors', req.n)}${sp.regular === 'N' ? ' · ' + t('kr_regular_N') : ''}`, clause: 'KDS 41 17 00 7.1' })

  /* 1) 층간변위 Δ/h = C_d·(δ_e/h)/I_E (÷ C_m) */
  const da = DA[imp]
  for (const [d, key] of [['X', 'DX'], ['Y', 'DY']] as const) {
    const cm = ctx.rs && ctx.rsChk?.scaled ? +(ctx.rsChk?.[d]?.Cm) || 1 : 1   // 재해석 실패 시 결과는 미보정 → 나누지 않음
    let max = 0, where = ''
    for (const r of tableObjs(data[key], key)) {
      const th = num(r[DRIFT_COL]) / num(r['Story Height']) * sys.Cd / Ie / cm
      if (th > max) { max = th; where = r.Story }
    }
    const clause = 'KDS 41 17 00 7.2.8.1 / 8.2.3'
    items.push(max > 0
      ? { id: 'drift', label: t('rv_kr_drift'), dir: d, value: max.toFixed(4), limit: `≤ ${da.toFixed(3)} (${t('rv_kr_grade')} ${grade})`, status: max <= da ? 'ok' : 'ng',
          where, clause, note: `${src} · ${t('rv_kr_drift_note', sys.Cd, Ie)}${cm > 1 ? ` · ÷C_m ${cm.toFixed(3)}` : ''}` }
      : { id: 'drift', label: t('rv_kr_drift'), dir: d, value: '-', limit: `≤ ${da.toFixed(3)}`, status: 'info', clause, note: t('rv_no_data') })
  }

  /* 2) 비틀림 비정형 H-1 — 정적 EX/EY(+5% 우발편심) 최대/평균 층변위 */
  const cd = sdc === 'C' || sdc === 'D'
  for (const [d, key] of [['X', 'TX'], ['Y', 'TY']] as const) {
    let worst: { r: number; story: string } | null = null
    for (const row of tableObjs(data[key], key)) {
      const avg = num(row['Average Value of Extreme Points/Story Drift']), mx = num(row['Maximum Value/Story Drift'])
      if (!(avg > 1e-9)) continue
      if (!worst || mx / avg > worst.r) worst = { r: mx / avg, story: row.Story }
    }
    const clause = 'KDS 41 17 00 표 5.3-1 H-1'
    items.push(worst
      ? { id: 'torsion', label: t('rv_kr_torsion'), dir: d, value: worst.r.toFixed(2), limit: '≤ 1.2', status: worst.r <= 1.2 ? 'ok' : cd ? 'warn' : 'info',
          where: worst.story, clause, note: worst.r > 1.2 ? t('rv_kr_torsion_note') : t('rv_torsion_src') }
      : { id: 'torsion', label: t('rv_kr_torsion'), dir: d, value: '-', limit: '≤ 1.2', status: 'info', clause, note: t('rv_no_data') })
  }

  /* 2b) 연층 V-1 · 중량비 V-2 · P-Δ 안정계수 θ — 층 강성 K = V/Δ (kN/m) */
  const elev: number[] = ctx.model?.elev?.length ? ctx.model.elev : RC.storyElevations(p)
  const n = p.stories, g = RC.deriveFloorGroups(p)
  let nb = 0
  for (let s = 1; s <= n; s++) if (g[s] && g[s].role === 'BASEMENT') nb = s
  const hOf = (s: number) => ((elev[s] || 0) - (elev[s - 1] || 0)) / 1000
  const K: Record<'X' | 'Y', number[]> = { X: [], Y: [] }
  for (const [d, key] of [['X', 'KX'], ['Y', 'KY']] as const)
    for (const r of rowsOf(data[key], key)) { const s = storyByLevel(elev, num(r.Level)); if (s > 0) K[d][s] = num(r['Story Stiffness']) }
  let irr = items.some(x => x.id === 'torsion' && x.status === 'warn')
  for (const d of ['X', 'Y'] as const) {
    const k = K[d]
    let worst: { s: number; v: number; lim: number; avg3: boolean } | null = null
    for (let s = nb + 1; s <= n - 2; s++) {          // 최상 2개 층 제외(5.3.2 ①)
      if (!(k[s] > 0 && k[s + 1] > 0)) continue
      const c = [{ v: k[s] / k[s + 1], lim: 0.7, avg3: false }]
      const up = [1, 2, 3].map(i => k[s + i]).filter(x => x > 0)
      if (up.length === 3) c.push({ v: k[s] / (up.reduce((a, b) => a + b, 0) / 3), lim: 0.8, avg3: true })
      for (const x of c) if (!worst || x.v / x.lim < worst.v / worst.lim) worst = { s, ...x }
    }
    const clause = 'KDS 41 17 00 표 5.3-2 V-1'
    if (worst && worst.v < worst.lim) irr = true
    items.push(worst
      ? { id: 'soft', label: t('rv_kr_soft'), dir: d, value: worst.v.toFixed(2), limit: `≥ ${worst.lim}${worst.avg3 ? ` (${t('rv_stiff_avg3')})` : ''}`,
          status: worst.v >= worst.lim ? 'ok' : 'warn', where: storyName(p, worst.s), clause, note: worst.v >= worst.lim ? t('rv_stiff_note') : t('rv_kr_soft_note') }
      : { id: 'soft', label: t('rv_kr_soft'), dir: d, value: '-', limit: '≥ 0.7', status: 'info', clause, note: t('rv_no_data') })
  }
  {
    const W = storyWeightsKR(p, sp)
    let worst: { s: number; v: number } | null = null
    for (let s = nb + 1; s <= n; s++) {
      /* 인접층 비교. 하부층보다 가벼운 지붕층은 제외(표 5.3-2 V-2 단서) */
      const nbr = [s - 1 > nb ? s - 1 : 0, s + 1 <= n && !(s + 1 === n && W[n] < W[s]) ? s + 1 : 0].filter(x => x > 0 && W[x] > 0)
      for (const j of nbr) { const v = W[s] / W[j]; if (!worst || v > worst.v) worst = { s, v } }
    }
    const clause = 'KDS 41 17 00 표 5.3-2 V-2'
    if (worst && worst.v > 1.5) irr = true
    items.push(worst
      ? { id: 'weight', label: t('rv_kr_weight'), value: `${(worst.v * 100).toFixed(0)}%`, limit: '≤ 150%', status: worst.v <= 1.5 ? 'ok' : 'warn',
          where: storyName(p, worst.s), clause, note: t('rv_kr_weight_note') }
      : { id: 'weight', label: t('rv_kr_weight'), value: '-', limit: '≤ 150%', status: 'info', clause, note: t('rv_no_data') })
  }
  {
    const gr = storyGravityKR(p)
    const thMax = Math.min(0.5 / sys.Cd, 0.25)
    for (const d of ['X', 'Y'] as const) {
      let worst: { s: number; v: number } | null = null
      for (let s = nb + 1; s <= n; s++) {
        const k = K[d][s]
        if (!(k > 0)) continue
        let P = 0
        for (let j = s; j <= n; j++) P += (gr.D[j] || 0) + (gr.L[j] || 0)
        const v = P / (Ie * k * hOf(s))
        if (!worst || v > worst.v) worst = { s, v }
      }
      const clause = 'KDS 41 17 00 7.2.8.2'
      items.push(worst
        ? { id: 'pdelta', label: t('rv_kr_pdelta'), dir: d, value: worst.v.toFixed(3), limit: `≤ 0.10 · θ_max ${thMax.toFixed(3)}`,
            status: worst.v <= 0.1 ? 'ok' : worst.v <= thMax ? 'warn' : 'ng', where: storyName(p, worst.s), clause,
            note: worst.v <= 0.1 ? t('rv_kr_pdelta_ok') : worst.v <= thMax ? t('rv_kr_pdelta_amp', (1 / (1 - worst.v)).toFixed(3)) : t('rv_kr_pdelta_ng') }
        : { id: 'pdelta', label: t('rv_kr_pdelta'), dir: d, value: '-', limit: '≤ 0.10', status: 'info', clause, note: t('rv_no_data') })
    }
  }
  /* 비정형 발견 + 등가정적 → 7.1 동적해석 필요 재판정 */
  if (irr && !ctx.rs && sp.regular !== 'N' && rsRequiredKR(p, { ...sp, method: 'auto', regular: 'N' }).req) {
    const m = items.find(x => x.id === 'method')
    if (m) { m.status = 'warn'; m.note = t('rv_kr_irr_dyn') }
  }

  /* 3) 유효질량 ≥ 90% (7.3.3.1) */
  const modes = classifyModes(subTableObjs(data.EV, 'EV', 'MODAL PARTICIPATION MASSES'))
  if (modes.length) {
    const last = modes[modes.length - 1]
    for (const [d, v] of [['X', last.sumX], ['Y', last.sumY]] as const)
      items.push({ id: 'mass', label: t('rv_mass'), dir: d, value: `${v.toFixed(1)}%`, limit: '≥ 90%', status: v >= 90 ? 'ok' : 'ng', where: `${modes.length} ${t('modes')}`, clause: 'KDS 41 17 00 7.3.3.1' })
  } else items.push({ id: 'mass', label: t('rv_mass'), value: '-', limit: '≥ 90%', status: 'info', clause: 'KDS 41 17 00 7.3.3.1', note: t('rv_no_data') })

  /* 4) RS 보정 C_m (정보) */
  if (ctx.rs && ctx.rsChk) for (const d of ['X', 'Y'] as const) {
    const c = ctx.rsChk[d]
    if (c) items.push({ id: 'cm', label: t('rv_cm'), dir: d, value: c.Cm.toFixed(3), limit: `V_t ${Math.round(c.Vt)} / 0.85V ${Math.round(0.85 * c.V)} kN`,
      status: 'info', clause: 'KDS 41 17 00 7.3.3.5', note: t('rv_cm_note') })
  }
  return items
}
