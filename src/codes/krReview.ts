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
   P-Δ 증폭(a_d = 1/(1−θ))·비틀림증폭 A_x 는 미반영(알려진 단순화)
════════════════════════════════════════════════════════════ */
import type { BuildingSpec } from '../engine'
import { t } from '../i18n'
import { classifyModes, num, subTableObjs, tableObjs } from '../mapi/tables'
import { heightAboveGround } from './selfweight'
import type { ReviewItem, ReviewTable } from './types'
import { IE_KR, SYSTEMS, impKR, rsRequiredKR, siteKR, sdcKR, systemKR } from './kr'

const DRIFT_COL = 'Maximum Drift of All Vertical Elements/Story Drift'
const DA: Record<string, number> = { S: 0.010, 1: 0.015, 2: 0.020, 3: 0.020 }

export function krReviewTables(ctx: { rs: boolean }): ReviewTable[] {
  const [lx, ly] = ctx.rs ? ['RSX(RS)', 'RSY(RS)'] : ['EX(ST)', 'EY(ST)']
  return [
    { key: 'EV', type: 'EIGENVALUEMODE' },
    { key: 'DX', type: 'STORY_DRIFT_X', lcs: [lx] },
    { key: 'DY', type: 'STORY_DRIFT_Y', lcs: [ly] },
    { key: 'TX', type: 'TORSIONAL_IRREGULARITY_X', lcs: ['EX(ST)'] },
    { key: 'TY', type: 'TORSIONAL_IRREGULARITY_Y', lcs: ['EY(ST)'] },
  ]
}

export function krReviewEvaluate(p: BuildingSpec, sp: Record<string, any>, data: Record<string, any>,
  ctx: { rs: boolean; T1: number | null; rsChk?: any }): ReviewItem[] {
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
