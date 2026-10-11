/* ════════════════════════════════════════════════════════════
   QA 교차검증 — db/SSEIS(지진) · db/SWIND(풍) · 층중량. 바닐라 1:1 이전.
   ⚠ SSEIS/SWIND 는 KDS + USER TYPE 만 지원 → 대만은 USER TYPE 고정.
   ⚠ Gen GUI "Auto Generate Story Data" 선행 필수(순수 API + ope/STOR 만으론 Wrong Key).
════════════════════════════════════════════════════════════ */
import { RC } from '../engine'
import { t, tv } from '../i18n'
import { mapi } from '../mapi/client'
import { S } from '../state/store'
import { log } from '../state/ui'
import { setUnit } from './model'

const f0 = (x: number | null | undefined) => x == null ? '–' : (Math.abs(x) >= 1e6 ? (x / 1e6).toFixed(2) + 'e6' : Math.round(x))
const pe = (c: any) => c == null ? '<span style="opacity:.4">–</span>'
  : `<b style="color:${c.ok ? 'var(--green,#3c3)' : 'var(--red,#e55)'}">${(c.err * 100).toFixed(1)}%</b>`
const TD = 'padding:1px 8px 1px 0'

function tableHead(hdr: string[]): string {
  return '<table style="font-size:11px;border-collapse:collapse;margin:4px 0"><tr>' +
    hdr.map(h => `<th style="text-align:left;${TD};border-bottom:1px solid #555">${h}</th>`).join('') + '</tr>'
}

/** GET db/STOR → 등록 층 목록 */
async function registeredStories(withWidth = false): Promise<{ name: string; level: number; width: number }[]> {
  try {
    const sd = await mapi('GET', 'STOR'); const T = (sd && sd.STOR) || {}
    return Object.keys(T).map(k => ({ name: T[k].STORY_NAME, level: +T[k].STORY_LEVEL || 0, width: withWidth ? (+T[k].WIND_FLOOR_WIDTH_Y || 0) : 0 }))
  } catch { return [] }
}

/** 자체 층력을 등록 층 레벨에 최근접 매핑(tol 1mm) */
function mapToStories(forces: any[], reg: { name: string; level: number }[]) {
  const mapped: { story: string; name: string; h: number; F: number }[] = []
  for (const f of forces || []) {
    const lv = +f.h || 0; if (lv <= 0) continue
    let best: { name: string } | null = null, bd = 1e9
    for (const s of reg) { const d = Math.abs(s.level - lv); if (d < bd) { bd = d; best = s } }
    if (best && bd <= 1) mapped.push({ story: best.name, name: best.name, h: lv, F: f.F })
  }
  return mapped
}

function unwrapAssign(gen: any, key: string): any {
  return (gen && gen[key] && gen[key]['1']) ? gen[key]['1'] : ((gen && gen.Assign && gen.Assign['1']) ? gen.Assign['1'] : gen)
}

function requireModel(spec?: any) {
  if (!S.connected) throw new Error(t('e_notconn'))
  const p = spec || S.model.spec
  if (!p || !S.model.nodes.length) throw new Error(t('e_nomodel_edit'))
  return p
}

/* SSEIS 교차검증 — 등록 층명(GET db/STOR)으로 USER TYPE PUT → GET PROFILE → diff */
export async function actSseisVerify(spec?: any): Promise<string> {
  const p = requireModel(spec)
  const sp = p.seismic
  if (!(sp && sp.on)) throw new Error(t('need_a_model_with_seismic_'))
  await setUnit('N', 'MM')
  const r = RC.seismicStoryForces(p, { SDS: sp.SDS, SD1: sp.SD1, T0: sp.T0, I: sp.I, R: sp.R, w0: sp.w0, liveRatio: sp.liveRatio, Cs: sp.Cs, V: sp.V })
  const reg = (await registeredStories()).filter(s => s.level > 0)
  if (!reg.length) throw new Error(t('err_sseis_nostory'))
  const mapped = mapToStories(r.forces, reg)
  if (!mapped.length) throw new Error(t('err_level_mismatch'))
  /* ACCIDENT_ECCEN 은 정수 옵션 enum[0,1,2]; 비율은 STOR 가 보유 */
  const seisForce = mapped.map(m => ({ STORY_NAME: m.name, FORCE_X: (+m.F || 0) * 1000, FORCE_Y: 0 }))
  try {
    await mapi('PUT', 'SSEIS', { Assign: { 1: {
      SEIS_CODE: 'USER TYPE', SCALE_FACTOR_X: 1.0, SCALE_FACTOR_Y: 1.0,
      SEISMIC_FORCE: seisForce, ACCIDENT_ECCEN_X: 1, ACCIDENT_ECCEN_Y: 1, ACCIDENT_TORSION: true, DESC: 'QA-verify',
    } } })
  } catch (e: any) {
    if (/Wrong Key|not a seismic-load story/i.test(e.message || '')) throw new Error(t('err_sseis_names'))
    throw e
  }
  log('▸ db/SSEIS USER TYPE PUT <b>' + seisForce.length + '</b> ' + t('forces_registered_stories'), 'ok')
  const genResp = unwrapAssign(await mapi('GET', 'SSEIS'), 'SSEIS')
  const self = RC.sseisSelfProfile(mapped, 0.05)
  const tol = (sp.verifyTol != null ? sp.verifyTol : 0.05)
  const d = RC.sseisDiff(self, genResp, 'X', tol)
  S.model.sseisQA = { dir: d.dir, tol: d.tol, matched: d.matched, pass: d.pass, worstShear: d.worstShear, base: self.base }
  let html = tableHead(tv<string[]>('hdr_shear'))
  d.rows.forEach((rw: any) => {
    html += `<tr><td style="${TD}">${rw.name}</td>` +
      `<td style="${TD}">${rw.shear ? f0(rw.shear.self) + '/' + f0(rw.shear.gen) + ' ' + pe(rw.shear) : '–'}</td>` +
      `<td style="${TD}">${rw.otm ? f0(rw.otm.self) + '/' + f0(rw.otm.gen) + ' ' + pe(rw.otm) : '–'}</td>` +
      `<td style="${TD}">${rw.torsion && rw.torsion.gen != null ? '<span style="opacity:.7">Gen ' + f0(rw.torsion.gen) + '</span>' : '–'}</td></tr>`
  })
  html += '</table>'
  log(t('sseis_cross_check_x_dir') +
    ` — ${d.pass ? 'PASS ✓' : 'MISMATCH ✗'} (${t('worst_shear_err')} ${(d.worstShear * 100).toFixed(1)}%)` + html, d.pass ? 'ok' : 'err')
  const pct = (d.worstShear * 100).toFixed(1)
  if (!d.matched) {
    log('⚠ SSEIS ' + t('no_profile_rows_matched_ch'), 'err')
    return 'SSEIS verify: GET returned but no PROFILE story rows matched. Inspect log.'
  }
  return `SSEIS cross-check (X-dir): ${d.matched} rows matched (incl. base), worst STORY_SHEAR diff ${pct}% (tol ${(tol * 100).toFixed(0)}%) → ${d.pass ? 'PASS ✓ self-computed seismic matches Gen native profile' : 'MISMATCH — review story-force mapping'}.`
}

/* SWIND 교차검증 — 자체 풍력(kN)을 Gen 규약(폭·tribH)으로 압력 역산 → PUT → GET PROFILE diff */
export async function actSwindVerify(spec?: any): Promise<string> {
  const p = requireModel(spec)
  const wp = p.wind
  if (!(wp && wp.on)) throw new Error(t('need_a_model_with_wind_loa'))
  await setUnit('N', 'MM')
  const r = RC.windStoryForces(p, { V10: wp.V10, exposure: wp.exposure, G: wp.G, Cf: wp.Cf, I: wp.I })
  const regAll = await registeredStories(true)
  const reg = regAll.filter(s => s.level > 0)
  if (!reg.length) throw new Error(t('err_swind_nostory'))
  const mapped = mapToStories(r.forcesX, reg)
  if (!mapped.length) throw new Error(t('err_level_mismatch'))
  const pr = RC.swindSelfPressures(mapped, regAll)
  if (!pr.press.length) throw new Error(t('pressure_conversion_failed'))
  try {
    await mapi('PUT', 'SWIND', { Assign: { 1: {
      WIND_CODE: 'USER TYPE', SCALE_FACTOR_X: 1.0, SCALE_FACTOR_Y: 1.0,
      STORY_WIND_PRESSURE: pr.press.map((x: any) => ({ STORY_NAME: x.STORY_NAME, PRESS_X: x.PRESS, PRESS_Y: 0 })), DESC: 'QA-verify',
    } } })
  } catch (e: any) {
    if (/Wrong Key|requires a building/i.test(e.message || '')) throw new Error(t('err_swind_names'))
    throw e
  }
  log('▸ db/SWIND USER TYPE PUT <b>' + pr.press.length + '</b> ' + t('stories_pressure_from_forc'), 'ok')
  const genResp = unwrapAssign(await mapi('GET', 'SWIND'), 'SWIND')
  const self = RC.sseisSelfProfile(mapped, 0)
  const tol = (wp.verifyTol != null ? wp.verifyTol : 0.05)
  const d = RC.sseisDiff(self, genResp, 'X', tol)
  S.model.swindQA = { dir: d.dir, tol: d.tol, matched: d.matched, pass: d.pass, worstShear: d.worstShear, base: self.base }
  let html = tableHead(tv<string[]>('hdr_shear_otm'))
  d.rows.forEach((rw: any) => {
    html += `<tr><td style="${TD}">${rw.name}</td>` +
      `<td style="${TD}">${rw.shear ? f0(rw.shear.self) + '/' + f0(rw.shear.gen) + ' ' + pe(rw.shear) : '–'}</td>` +
      `<td style="${TD}">${rw.otm ? f0(rw.otm.self) + '/' + f0(rw.otm.gen) + ' ' + pe(rw.otm) : '–'}</td></tr>`
  })
  html += '</table>'
  log(t('swind_cross_check_x_dir_wi') +
    ` — ${d.pass ? 'PASS ✓' : 'MISMATCH ✗'} (${t('worst_shear_err')} ${(d.worstShear * 100).toFixed(1)}%)` + html, d.pass ? 'ok' : 'err')
  const pct = (d.worstShear * 100).toFixed(1)
  if (!d.matched) {
    log('⚠ SWIND ' + t('no_profile_rows_matched'), 'err')
    return 'SWIND verify: GET returned but no PROFILE story rows matched. Inspect log.'
  }
  return `SWIND cross-check (X-dir): ${d.matched} rows matched (incl. base), worst STORY_SHEAR diff ${pct}% (tol ${(tol * 100).toFixed(0)}%) → ${d.pass ? 'PASS ✓ self-computed wind matches Gen native profile' : 'MISMATCH — review pressure conversion'}.`
}

/* 층중량 교차검증(정보성) — ope/STORPROP 404 이므로 db/SSEIS PROFILE 의 STORY_WEIGHT 로 대체.
   최소 SSEIS PUT→GET→DELETE(QA 흔적 제거). 추정(w0) vs 실질량이라 차이는 정상. */
export async function actStoryWeightVerify(spec?: any): Promise<string> {
  const p = requireModel(spec)
  await setUnit('KN', 'MM')                                           // STORY_WEIGHT kN, STORY_LEVEL mm
  const sp = p.seismic || {}
  const W = RC.seismicStoryWeights(p, { w0: sp.w0, liveRatio: sp.liveRatio })
  const elev = RC.storyElevations(p)
  const selfStories: { level: number; weight: number }[] = []
  for (let s = 1; s <= p.stories; s++) { if ((elev[s] || 0) > 0) selfStories.push({ level: elev[s], weight: W[s] || 0 }) }
  if (!selfStories.length) throw new Error(t('no_stories_above_g_l'))
  const reg = (await registeredStories()).filter(s => s.level > 0)
  if (!reg.length) throw new Error(t('err_weight_nostory'))
  const probe = reg.map(s => ({ STORY_NAME: s.name, FORCE_X: 1, FORCE_Y: 0 }))
  let gen: any
  try {
    await mapi('PUT', 'SSEIS', { Assign: { 1: { SEIS_CODE: 'USER TYPE', SCALE_FACTOR_X: 1.0, SCALE_FACTOR_Y: 1.0,
      SEISMIC_FORCE: probe, ACCIDENT_ECCEN_X: 0, ACCIDENT_ECCEN_Y: 0, ACCIDENT_TORSION: false, DESC: 'QA-weight' } } })
    gen = await mapi('GET', 'SSEIS')
  } catch (e: any) {
    if (/Wrong Key|not a seismic-load story/i.test(e.message || '')) throw new Error(t('err_sseis_names2'))
    throw e
  } finally {
    try { await mapi('DELETE', 'SSEIS') } catch { /* QA 흔적 제거 실패 무시 */ }
  }
  const genResp = RC.sseisProfileToStoryProp(gen)
  const d = RC.storyWeightDiff(selfStories, genResp, 0.10)
  if (!d.matched) throw new Error(t('err_weight_mismatch'))
  const fw = (x: number | null) => x == null ? '–' : Math.round(x)
  const pw = (c: any) => `<b style="color:${c.ok ? 'var(--green,#3c3)' : 'var(--amber,#d90)'}">${(c.err * 100).toFixed(1)}%</b>`
  let html = tableHead(tv<string[]>('hdr_weight'))
  d.rows.forEach((rw: any) => {
    html += `<tr><td style="${TD}">${rw.name}</td>` +
      `<td style="${TD}">${fw(rw.self)}</td><td style="${TD}">${fw(rw.gen)}</td>` +
      `<td style="${TD}">${pw(rw)}</td></tr>`
  })
  html += `<tr><td style="padding:2px 8px 1px 0;border-top:1px solid #555"><b>Σ</b></td><td style="border-top:1px solid #555">${fw(d.totalSelf)}</td><td style="border-top:1px solid #555">${fw(d.totalGen)}</td><td style="border-top:1px solid #555"><b>${(d.totalErr * 100).toFixed(1)}%</b></td></tr></table>`
  log(t('story_weight_check_self_es') + ` — ΣΔ ${(d.totalErr * 100).toFixed(1)}%` + html, 'ok')
  return `Story weight check (via db/SSEIS PROFILE): ${d.matched} stories. Self ΣW=${Math.round(d.totalSelf)} kN vs Gen ΣW=${Math.round(d.totalGen)} kN (Δ${(d.totalErr * 100).toFixed(1)}%). Informational — self uses w0 estimate; Gen is model-derived (use Gen weights to calibrate w0).`
}
