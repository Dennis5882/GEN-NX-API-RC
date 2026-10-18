/* 해석·결과 회수·동적해석 — 바닐라 1:1 이전 */
import { profileOf } from '../codes'
import { RC } from '../engine'
import { t, tl } from '../i18n'
import { mapi } from '../mapi/client'
import { dirPeriods, num, tableObjs } from '../mapi/tables'
import { S, type Table } from '../state/store'
import { log, renderModelState, renderResults } from '../state/ui'
import { commitTorsionAmp, putCombos, putStoryCalc, reapplyTorsionAmp, revertTorsionAmp, setUnit } from './model'
import { actReview } from './review'

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

/** 비틀림 증폭 A_x (耐震規範 2.14) — 정적 EX/EY(+우발편심) 의 층별 δmax/δavg 에서 A_x = (δmax/(1.2δavg))² (≤ max, 1.2 이하 = 1).
    Story Calc(ope/STOR) 가 해석 전에 등록돼 있어야 표가 나옴. 증폭할 층이 없거나 이미 적용했으면 null */
async function torsionAmpFactors(p: any, prof: ReturnType<typeof profileOf>): Promise<{ X: number[]; Y: number[]; max: number } | null> {
  const cfg = prof.seismic.torsionAmp
  if (!cfg || !p.seismic?.on || !S.model.lat || S.model.lat.ampDone || p.storyData === false) return null
  const ax = { X: [] as number[], Y: [] as number[], max: 1 }
  const dirs = ['X', 'Y'] as const
  /* Gen NX 는 요청을 하나씩 처리하고 표 상태가 전역 — 병렬 호출 금지(순차) */
  const tabs: any[] = []
  for (const d of dirs) tabs.push(await mapi('POST', '/post/table', { Argument: { TABLE_NAME: 'TQ', TABLE_TYPE: `TORSIONAL_IRREGULARITY_${d}`,
    UNIT: { FORCE: 'KN', DIST: 'M' }, STYLES: { FORMAT: 'Fixed', PLACE: 5 }, LOAD_CASE_NAMES: [`E${d}(ST)`] } }))
  let unmapped = 0
  dirs.forEach((d, i) => {
    for (const r of tableObjs(tabs[i], 'TQ')) {
      const avg = num(r['Average Value of Extreme Points/Story Drift']), mx = num(r['Maximum Value/Story Drift'])
      if (!(avg > 1e-9)) continue
      /* Story Data 층 이름 규약(buildStoryData): 지반 1F@0, 그 위 (iz+1)F, 최상 RF — 그 밖의 이름(B1 등)은 매핑 불가 */
      const m = /^(\d+)F$/i.exec(String(r.Story).trim())
      const iz = r.Story === 'RF' ? p.stories : m ? +m[1] - 1 : NaN
      if (!Number.isFinite(iz)) { unmapped++; continue }
      const A = mx / avg > cfg.threshold ? Math.min(cfg.max, (mx / avg / cfg.threshold) ** 2) : 1
      if (iz >= 1 && A > 1.005) { ax[d][iz] = A; ax.max = Math.max(ax.max, A) }
    }
  })
  if (unmapped) log('▸ A_x: ' + t('tw_ax_unmapped', unmapped), 'warn')
  return ax.max > 1.005 ? ax : null
}

/** A_x 를 재하 → 재해석. 실패하면 증폭 하중(+apply 가 바꾼 것)을 원복하고 원래 해석으로 복구한 뒤 던짐. 성공해야 ampDone */
async function withTorsionAmp(ax: { X: number[]; Y: number[]; max: number }, hooks: { apply?: () => Promise<void>; rollback?: () => Promise<void>; reanalyze: () => Promise<void> }): Promise<void> {
  await reapplyTorsionAmp(ax)
  try {
    await hooks.apply?.()
    await hooks.reanalyze()
  } catch (e) {
    await revertTorsionAmp(); await hooks.rollback?.(); await hooks.reanalyze()
    throw e
  }
  commitTorsionAmp()
  log('▸ ' + t('tw_ax_log', ax.max.toFixed(2)), 'ok')
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
  const prof0 = profileOf(S.model.spec)
  /* A_x 표(층 결과 테이블)는 Story Calc 선등록이 필요 — 해석 전에 호출(해석 후 호출은 결과 무효화) */
  if (prof0.seismic.torsionAmp && S.model.spec?.storyData !== false) try { await putStoryCalc() } catch { /* noop */ }
  /* 이전 해석의 A_x 는 편집(단면·하중 변경)으로 낡을 수 있음 → 증폭 전 하중으로 되돌리고 이번 해석에서 다시 산정 */
  await revertTorsionAmp()               // 실패하면 던짐 — 낡은 증폭 하중으로 해석하지 않음
  await runAnalysis()
  try {
    const ax = await torsionAmpFactors(S.model.spec, prof0)
    if (ax) await withTorsionAmp(ax, { reanalyze: runAnalysis })
  } catch (e: any) { log('▸ A_x: ' + e.message, 'warn') }
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
async function shearCoefRows(lc: string): Promise<Record<string, string>[]> {
  const j = await mapi('POST', '/post/table', { Argument: { TABLE_NAME: 'SC', TABLE_TYPE: 'STORY_SHEAR_FORCE_COEFFICIENT',
    UNIT: { FORCE: 'KN', DIST: 'M' }, STYLES: { FORMAT: 'Fixed', PLACE: 5 }, LOAD_CASE_NAMES: [lc + '(RS)'] } })
  return tableObjs(j, 'SC')
}

export async function actDynamic(opt: { rs?: boolean } = {}): Promise<string> {
  if (!S.connected) throw new Error(t('e_notconn'))
  if (!S.model.nodes || !S.model.nodes.length) throw new Error(t('e_nomodel'))
  const p: any = S.model.spec || {}
  const sp: any = p.seismic || {}
  const stories = p.stories || Math.max(1, ...(S.model.elemRecs || []).map(r => r.iz || 1))
  const prof = profileOf(S.model.spec)
  /* 응답스펙트럼이 주 해석인 기준(중국 H>40m 등)은 요청과 무관하게 RS 수행 */
  const primary = !!sp.on && !!prof.seismic.rsPrimary?.(p, sp)
  const doRS = !!opt.rs || primary
  let extra: Record<string, any> = prof.seismic.splcExtra ?? {}
  /* SPLC DIR 은 "XY"/"Z" 만 유효 — 단일축 "X"/"Y" 는 Wrong Field(MAPI_FINDINGS, 2026-10-12 라이브 재확인).
     수평 방향은 ANGLE 로 구분: RSX 0°, RSY 90°. (바닐라는 "X"/"Y" 를 보내 RS 가 실패했음). sx·sy = 방향별 SCALE */
  /* 이전 A_x 는 낡았을 수 있음 → 증폭 전 하중으로 되돌리고 이번 해석 뒤(4b)에 다시 산정. RS 우발편심 %(Gen 네이티브)에는 그 최대 A_x 를 반영 */
  const wasAmp = await revertTorsionAmp()   // 실패하면 던짐
  const scale0 = prof.seismic.rsScale0?.(p, sp) ?? { X: 1, Y: 1 }
  const putSplc = (fn: string, sx: number, sy: number) => mapi('PUT', 'splc', { Assign: {
    1: { ...RC.splcPayload('RSX', 'XY', fn, sx), ANGLE: 0, ...extra },
    2: { ...RC.splcPayload('RSY', 'XY', fn, sy), ANGLE: 90, ...extra },
  } })
  /* 이전 RS 실행의 증폭된 우발편심 %가 SPLC 에 남아 있으면(이번엔 RS 미지정 → SPLC 를 다시 쓰지 않음) 기본값으로 복원 */
  if (wasAmp && !doRS && extra.ACCECC_PERCENT) try {
    const cur = (await mapi('GET', 'splc'))?.SPLC || {}
    const fix: Record<string, any> = {}
    for (const k in cur) fix[k] = { ...cur[k], ACCECC_PERCENT: extra.ACCECC_PERCENT }
    if (Object.keys(fix).length) await mapi('PUT', 'splc', { Assign: fix })
  } catch { /* noop */ }
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
    ds = prof.seismic.spectrum(sp, p)
    if (!ds) {
      log('▸ ' + t('no_sds_sd1_rs_skipped'), 'warn')
    } else {
      await mapi('PUT', 'spfc', { Assign: { 1: ds.spfc } })
      await putSplc(ds.name, scale0.X, scale0.Y)
      log('▸ ' + t(prof.seismic.spectrumLogKey) + ds.logSuffix, 'ok')
      /* 주 해석 = RS → 하중조합의 지진을 RSX/RSY 로 (정적 EX/EY 는 规定水平力 참고용으로 모델에 남김) */
      if (primary) {
        S.model.rsCases = [{ name: 'RSX', type: 'RS' }, { name: 'RSY', type: 'RS' }]
        await putCombos()
        log('▸ ' + t('rs_combos'), 'ok')
      }
    }
  }
  /* 4) 해석 실행 — 동적해석은 라이선스/시트에 따라 막힐 수 있음("Analysis is not allowed"). */
  /* 심사 지표용 층 결과 테이블은 Story Calc(ope/STOR) 등록이 필요 — 해석 전에 호출(해석 후 호출 시 결과 무효화) */
  if (prof.review && p.storyData !== false) try { await putStoryCalc() } catch { /* noop */ }
  await setUnit('KN', 'M')
  log(tl('analRun'), 'info')
  try { await mapi('POST', '/doc/saveas', { Argument: autoSavePath() }) } catch { /* noop */ }
  const analRes = await mapi('POST', '/doc/anal', {})
  const analMsg = String((analRes && analRes.message) || '')
  const notAllowed = NOT_ALLOWED.test(analMsg)
  if (notAllowed) log('▸ ' + t('analysis_refused') + analMsg + t('eigen_uses_lanczos_subspac'), 'err')
  else log(tl('analDone'), 'ok')
  /* 4b) 비틀림 증폭 A_x (2.14) — 정적 우발편심에 층별 계수, RS(Gen 네이티브 우발편심)는 최대 A_x 를 % 에 반영(보수적) → 재해석 */
  if (!notAllowed) try {
    const ax = await torsionAmpFactors(p, prof)
    if (ax) {
      const extra0 = extra
      await withTorsionAmp(ax, {
        apply: async () => {
          if (ds && extra.ACCECC_PERCENT) { extra = { ...extra, ACCECC_PERCENT: +(extra.ACCECC_PERCENT * ax.max).toFixed(3) }; await setUnit('KN', 'M'); await putSplc(ds.name, scale0.X, scale0.Y) }
        },
        rollback: async () => { extra = extra0; if (ds) { await setUnit('KN', 'M'); await putSplc(ds.name, scale0.X, scale0.Y) } },
        reanalyze: async () => {
          await setUnit('KN', 'M')
          const r2 = await mapi('POST', '/doc/anal', {})
          if (NOT_ALLOWED.test(String((r2 && r2.message) || ''))) throw new Error(t('analysis_refused') + r2.message)
        },
      })
    }
  } catch (e: any) { log('▸ A_x: ' + e.message, 'warn') }
  /* 5) 주기 회수 — EIGENVALUEMODE 의 SUB_TABLES["EIGENVALUE ANALYSIS"](Period(sec)).
       PARTICIPATIONVECTORMODE 는 모드형상만(SUB_TABLES 없음) — 라이브 확인 2026-06-14. */
  let modal: { modes: any[]; T1: number | null } = { modes: [], T1: null }
  let evResp: any = null
  try {
    const resp = await mapi('POST', '/post/table', { Argument: { TABLE_NAME: 'EV', TABLE_TYPE: 'EIGENVALUEMODE', UNIT: { FORCE: 'KN', DIST: 'M' } } })
    modal = RC.pickModalPeriods(resp)
    evResp = resp
  } catch (e: any) { log('▸ ' + t('period_retrieval_failed') + e.message, 'warn') }
  /* 5b) RS 보정 — 기준 훅(rsAdjust)이 방향별 최종 SCALE 결정 → 바뀌면 SPLC 갱신 후 재해석.
       중국: 최소 剪重比(GB 55002 4.2.3, 5.2.5 조문설명 3 — 내력·변위 모두 조정이라 하중케이스 배율로).
       대만: 3.2 조정계수 C(T₁) + 3.3 총횡력 ≥ 정적 V 의 90%(정형)/100%(비정형). */
  let rsChk: any = null
  let rsLines: string[] = []
  if (ds && !notAllowed && prof.seismic.rsAdjust) {
    try {
      const res = prof.seismic.rsAdjust(p, sp, { T1: modal.T1, Tdir: evResp ? dirPeriods(evResp, 'EV') : { X: null, Y: null },
        rows: { X: await shearCoefRows('RSX'), Y: await shearCoefRows('RSY') }, scale0 })
      rsChk = res.chk; rsLines = res.lines
      const sx = +res.scale.X.toFixed(4), sy = +res.scale.Y.toFixed(4)
      if (Math.abs(sx - scale0.X) > 1e-4 || Math.abs(sy - scale0.Y) > 1e-4) {
        await putSplc(ds.name, sx, sy)
        await setUnit('KN', 'M')
        const r2 = await mapi('POST', '/doc/anal', {})
        if (NOT_ALLOWED.test(String((r2 && r2.message) || ''))) throw new Error(t('analysis_refused') + r2.message)
        if (rsChk) rsChk.scaled = true
        log('▸ ' + t('rs_scaled', sx, sy), 'ok')
      }
    } catch (e: any) { log('▸ ' + t('rs_min_shear_failed') + e.message, 'warn') }
  }
  /* 6) 지진 Cs 재산정 (실주기 T₁ 피드백) */
  let fb: any = null
  if (modal.T1 && prof.seismic.ready(sp)) {
    const r = prof.seismic.storyForces(p, sp, { T: modal.T1 })
    const old = S.model.seismic
    fb = { Tdyn: modal.T1, psiT: (r as any).psiT, Ta: (old && old.T) || null, CsOld: (old && old.Cs) || null, Cs: r.Cs, Vold: (old && old.V) || null, V: r.V }
    S.model.dynamic = { T1: modal.T1, modes: modal.modes, Cs: r.Cs, V: r.V, Ta: fb.Ta, rs: !!ds, ...(primary ? { rsPrimary: true } : {}), ...(ds && rsChk ? { rsChk } : {}) }
  } else {
    S.model.dynamic = { T1: modal.T1, modes: modal.modes, rs: !!ds, ...(primary ? { rsPrimary: true } : {}), ...(ds && rsChk ? { rsChk } : {}) }
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
    if (fb.psiT && fb.psiT < 1) msg += ` · ψT ${fb.psiT} → T=${(fb.psiT * fb.Tdyn).toFixed(3)}s`   // 周期折减(JGJ 3 4.3.17) — 지진력 산정 주기
    if (fb.CsOld != null) msg += ` · Cs ${fb.CsOld.toFixed(3)}→<b>${fb.Cs.toFixed(3)}</b>`
    if (fb.Vold != null) msg += ` · V ${Math.round(fb.Vold)}→<b>${Math.round(fb.V)}</b>kN`
  }
  if (ds) msg += '<br>' + t('design_spectrum') + ds.reportSuffix
  if (primary && ds) {
    msg += '<br><b>' + t('rs_primary_title') + '</b> — ' + (sp.method === 'RS' ? t('rs_primary_forced') : prof.seismic.rsPrimaryWhy?.(p) ?? '')
    msg += '<br>　' + t('rs_combos')
  }
  if (ds && rsLines.length) {
    msg += rsLines.map(l => '<br>　' + l).join('')
  }
  msg += `<br><span style="color:var(--dim);font-size:.85em">` + t('dynNote', liveF) + `</span>`
  /* 심사 지표(기준 지원 시) — 재해석까지 끝난 결과로 */
  if (prof.review && !notAllowed) {
    try { msg += '<br><br>' + await actReview() } catch (e: any) { log('▸ ' + t('rv_fetch_failed') + e.message, 'warn') }
  }
  return msg
}
