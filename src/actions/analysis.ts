/* 해석·결과 회수·동적해석 — 바닐라 1:1 이전 */
import { profileOf } from '../codes'
import { RC } from '../engine'
import { t, tl } from '../i18n'
import { mapi } from '../mapi/client'
import { S, type Table } from '../state/store'
import { log, renderModelState, renderResults } from '../state/ui'
import { putStoryCalc, setUnit } from './model'

/* 해석 전 자동 저장 경로 — C:/temp 고정 (사용자 지정 2026-10-12).
   ⚠ 예전엔 MAPI 계정 이메일 앞부분으로 C:/Users/<id>/Documents 를 추정했으나, Windows 사용자 폴더명과 달라
   Gen NX 에 "잘못된 경로" 모달이 떠 세션이 막혔다(경로는 Gen NX 가 실행 중인 PC 기준). */
const AUTO_SAVE_DIR = 'C:/temp'
function autoSavePath(): string {
  return `${AUTO_SAVE_DIR}/gen_rc_temp_${Date.now()}.mgbx`
}

const NOT_ALLOWED = /not allowed|not permitted|허용되지|許可/i

async function runAnalysis(): Promise<void> {
  await setUnit('N', 'MM')
  log(tl('analRun'), 'info')
  try { await mapi('POST', '/doc/saveas', { Argument: autoSavePath() }) } catch { /* noop */ }
  const analRes = await mapi('POST', '/doc/anal', {})
  /* doc/anal 은 거부 시 HTTP 200 + message 로 회신(에러필드 아님) → 메시지 직접 점검 */
  const analMsg = String((analRes && analRes.message) || '')
  if (NOT_ALLOWED.test(analMsg)) throw new Error(t('analysis_refused') + analMsg)
  log(tl('analDone'), 'ok')
}

/* Track D: post/table에 UNIT을 명시 → 모델 전역 단위와 무관하게 항상 N·mm로 회수
   (설계 엔진은 N·mm 기준). STYLES/LOAD_CASE_NAMES 유지. extra로 UNIT 등 override 가능. */
async function fetchTable(type: string, lcNames: string[], extra: Record<string, any> = {}): Promise<Table | null> {
  const body = { Argument: { TABLE_NAME: 'SS', TABLE_TYPE: type,
    UNIT: { FORCE: 'N', DIST: 'MM' },
    STYLES: { FORMAT: 'Fixed', PLACE: 4 },
    LOAD_CASE_NAMES: lcNames, ...extra } }
  const j = await mapi('POST', '/post/table', body)
  return (j?.SS?.HEAD && j?.SS?.DATA) ? { head: j.SS.HEAD, data: j.SS.DATA } : null
}

export async function actAnalyze(): Promise<typeof S.results> {
  if (!S.model.nodes.length) throw new Error(t('e_noanalyze'))
  await runAnalysis()
  const lc = S.model.loadCases.map(l => l.name + '(ST)')
  S.results.react = await fetchTable('REACTIONG', lc)
  S.results.disp = await fetchTable('DISPLACEMENTG', lc)
  S.results.force = await fetchTable('BEAMFORCE', lc, { PARTS: ['PartI', 'PartJ'] })
  renderResults()
  /* ope/STOR: 결과 회수 완료 후 Story Calc OPT 등록 — fetchTable 전에 호출 시 GEN NX 내부 상태 변경으로 post/table 실패 */
  if (S.model.spec?.storyData !== false) try { await putStoryCalc() } catch { /* noop */ }
  return S.results
}

/* ════════════════════════════════════════════════════════════
   M2-A4: 동적해석 — 질량(자중+하중→질량) → 고유치(db/EIGV) → 실주기 T₁
   → 지진 Cs 재산정. + (옵션) 응답스펙트럼(db/SPFC 대만 설계스펙트럼 + db/SPLC, CQC).
   모든 엔드포인트 라이브 검증 스키마(MAPI_FINDINGS.md). 단위: KN/M (GRAV 9.806 정합).
════════════════════════════════════════════════════════════ */
export async function actDynamic(opt: { rs?: boolean } = {}): Promise<string> {
  if (!S.connected) throw new Error(t('e_notconn'))
  if (!S.model.nodes || !S.model.nodes.length) throw new Error(t('e_nomodel'))
  const p: any = S.model.spec || {}
  const sp: any = p.seismic || {}
  const stories = p.stories || Math.max(1, ...(S.model.elemRecs || []).map(r => r.iz || 1))
  const doRS = !!opt.rs
  const prof = profileOf(S.model.spec)
  await setUnit('KN', 'M')
  /* 1) 질량원: 자중→질량(db/styp) + 바닥/절점/보하중→질량(db/LTOM: DL×1.0 + 활하중×liveF) */
  await mapi('PUT', 'styp', { Assign: { 1: { bSELFWEIGHT: true } } })
  const liveF = (sp.massLiveRatio != null ? sp.massLiveRatio : prof.seismic.massLiveRatio)
  const vLC: { LCNAME: string; FACTOR: number }[] = [{ LCNAME: 'DL', FACTOR: 1.0 }]
  ;(S.model.loadCases || []).forEach(l => { if (prof.seismic.massLiveTypes.includes(l.type)) vLC.push({ LCNAME: l.name, FACTOR: liveF }) })
  await mapi('PUT', 'ltom', { Assign: { 1: { DIR: 'XY', bNODAL: true, bBEAM: true, bFLOOR: true, GRAV: 9.806, vLC } } })
  log('▸ ' + t('massSrc', liveF), 'ok')
  /* 2) 고유치 해석 제어 (Subspace), 모드수 = clamp(층수×3, 6..30) */
  const modes = Math.min(Math.max(stories * 3, 6), 30)
  await mapi('PUT', 'eigv', { Assign: { 1: RC.eigvPayload(modes) } })
  log('▸ ' + t('eigenvalue_setup') + ` (${modes} modes)`, 'ok')
  /* 3) (옵션) 응답스펙트럼: 기준별 설계스펙트럼 → SPFC, RSX·RSY → SPLC(CQC) */
  let ds: ReturnType<typeof prof.seismic.spectrum> = null
  if (doRS) {
    ds = prof.seismic.spectrum(sp)
    if (!ds) {
      log('▸ ' + t('no_sds_sd1_rs_skipped'), 'warn')
    } else {
      await mapi('PUT', 'spfc', { Assign: { 1: ds.spfc } })
      /* SPLC DIR 은 "XY"/"Z" 만 유효 — 단일축 "X"/"Y" 는 Wrong Field(MAPI_FINDINGS, 2026-10-12 라이브 재확인).
         수평 방향은 ANGLE 로 구분: RSX 0°, RSY 90°. (바닐라는 "X"/"Y" 를 보내 RS 가 실패했음) */
      const extra = prof.seismic.splcExtra ?? {}
      await mapi('PUT', 'splc', { Assign: {
        1: { ...RC.splcPayload('RSX', 'XY', ds.name), ANGLE: 0, ...extra },
        2: { ...RC.splcPayload('RSY', 'XY', ds.name), ANGLE: 90, ...extra },
      } })
      log('▸ ' + t(prof.seismic.spectrumLogKey) + ds.logSuffix, 'ok')
    }
  }
  /* 4) 해석 실행 — 동적해석은 라이선스/시트에 따라 막힐 수 있음("Analysis is not allowed"). */
  await setUnit('KN', 'M')
  log(tl('analRun'), 'info')
  try { await mapi('POST', '/doc/saveas', { Argument: autoSavePath() }) } catch { /* noop */ }
  const analRes = await mapi('POST', '/doc/anal', {})
  const analMsg = String((analRes && analRes.message) || '')
  const notAllowed = NOT_ALLOWED.test(analMsg)
  if (notAllowed) log('▸ ' + t('analysis_refused') + analMsg + t('eigen_uses_lanczos_subspac'), 'err')
  else log(tl('analDone'), 'ok')
  /* 5) 주기 회수 — EIGENVALUEMODE 의 SUB_TABLES["EIGENVALUE ANALYSIS"](Period(sec)).
       PARTICIPATIONVECTORMODE 는 모드형상만(SUB_TABLES 없음) — 라이브 확인 2026-06-14. */
  let modal: { modes: any[]; T1: number | null } = { modes: [], T1: null }
  try {
    const resp = await mapi('POST', '/post/table', { Argument: { TABLE_NAME: 'EV', TABLE_TYPE: 'EIGENVALUEMODE', UNIT: { FORCE: 'KN', DIST: 'M' } } })
    modal = RC.pickModalPeriods(resp)
  } catch (e: any) { log('▸ ' + t('period_retrieval_failed') + e.message, 'warn') }
  /* 6) 지진 Cs 재산정 (실주기 T₁ 피드백) */
  let fb: any = null
  if (modal.T1 && prof.seismic.ready(sp)) {
    const r = prof.seismic.storyForces(p, sp, { T: modal.T1 })
    const old = S.model.seismic
    fb = { Tdyn: modal.T1, Ta: (old && old.T) || null, CsOld: (old && old.Cs) || null, Cs: r.Cs, Vold: (old && old.V) || null, V: r.V }
    S.model.dynamic = { T1: modal.T1, modes: modal.modes, Cs: r.Cs, V: r.V, Ta: fb.Ta, rs: !!ds }
  } else {
    S.model.dynamic = { T1: modal.T1, modes: modal.modes, rs: !!ds }
  }
  renderModelState()
  /* ── 보고 메시지 ── */
  let msg = t('dynTitle', ds)
  if (modal.T1) {
    msg += '<br>' + t('1st_mode_period') + ` <b>T₁=${modal.T1.toFixed(3)}s</b>`
    if (modal.modes.length > 1) msg += ` · ${modal.modes.length} ${t('modes')}`
  } else if (notAllowed) {
    msg += '<br>' + t('analysis_was_refused_setup')
  } else {
    msg += '<br>' + t('analysis_ran_but_the_eigen')
  }
  if (fb) {
    msg += '<br>' + t('seismic_cs_update_empirica')
    if (fb.Ta) msg += `<br>　Ta=${fb.Ta.toFixed(3)}s → T₁=${fb.Tdyn.toFixed(3)}s`
    if (fb.CsOld != null) msg += ` · Cs ${fb.CsOld.toFixed(3)}→<b>${fb.Cs.toFixed(3)}</b>`
    if (fb.Vold != null) msg += ` · V ${Math.round(fb.Vold)}→<b>${Math.round(fb.V)}</b>kN`
  }
  if (ds) msg += '<br>' + t('design_spectrum') + ds.reportSuffix
  msg += `<br><span style="color:var(--dim);font-size:.85em">` + t('dynNote', liveF) + `</span>`
  return msg
}
