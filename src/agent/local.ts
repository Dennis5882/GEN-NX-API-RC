/* ════════════════════════════════════════════════════════════
   AGENT DISPATCH (LOCAL) — handleLocal(txt): parseCommand → 액션/즉시 응답. 바닐라 1:1.
   건물 확인·편집 카드는 kind:'plan' 메시지(PlanCard 컴포넌트)로 렌더.
════════════════════════════════════════════════════════════ */
import { actAnalyze, actDynamic } from '../actions/analysis'
import { actReview } from '../actions/review'
import { actAddBracing, actAddLoad, actBuildFrame, actModifySection, actResizeSubset, clearModel } from '../actions/model'
import { profileOf, stampSpec } from '../codes'
import type { BuildingSpec } from '../engine'
import { t } from '../i18n'
import { S, notify } from '../state/store'
import { addMsg, addPlanMsg, draw3D, previewSpec, renderModelState, tab, thinking } from '../state/ui'
import { parseCommand } from './parse'
import { resultBrief, statusBrief } from './results'


/** 빌드 확인 카드 생성 (건물유형 → 설명카드 / 자유골조 → 편집카드) */
function proposeBuild(p: BuildingSpec, editable: boolean): void {
  S.pendingBuild = p
  S.pendingBuildId++
  addPlanMsg({ intro: t(editable ? 'plan_intro_custom' : 'plan_intro_tpl'), spec: p, editable, buildId: S.pendingBuildId, epoch: S.buildEpoch })
  tab('viewP'); previewSpec(p)
}

export async function handleLocal(txt: string): Promise<void> {
  const cmd = parseCommand(txt)
  switch (cmd.intent) {
    case 'build':
      proposeBuild(stampSpec(cmd.params), !cmd.params.bldgType)
      return
    case 'clear': {
      const th = thinking()
      try {
        await clearModel()
        S.model = { ...S.model, nodes: [], cols: [], beams: [], links: [] }
        renderModelState(); th.remove(); addMsg('bot', t('clear_chat_model'))
      } catch (e: any) { th.remove(); addMsg('bot', t('err', e.message)) }
      return
    }
    case 'analyze': {
      const th = thinking()
      try {
        await actAnalyze(); th.remove()
        addMsg('bot', resultBrief()); tab('resP')
      } catch (e: any) { th.remove(); addMsg('bot', t('err', e.message)) }
      return
    }
    case 'dynamic': {
      const th = thinking()
      try {
        const msg = await actDynamic({ rs: cmd.rs }); th.remove()
        addMsg('bot', msg); tab('logP')
      } catch (e: any) { th.remove(); addMsg('bot', t('err', e.message)) }
      return
    }
    case 'result': {
      /* 휨모멘트 탭은 별도 테이블이 아니라 BEAMFORCE(force)에서 파생 */
      const src = cmd.which === 'moment' ? 'force' : cmd.which
      if (!S.results[src]) { addMsg('bot', t('need_analyze')); return }
      S.resultTab = cmd.which; tab('resP')
      addMsg('bot', resultBrief(cmd.which))
      return
    }
    case 'status':
      addMsg('bot', statusBrief()); tab('modelP')
      return
    case 'review': {
      const th = thinking()
      try {
        const msg = await actReview(); th.remove()
        addMsg('bot', msg); if (S.review) tab('resP')
      } catch (e: any) { th.remove(); addMsg('bot', t('err', e.message)) }
      return
    }
    case 'modify_section':
    case 'resize_subset':
    case 'add_load':
    case 'add_bracing': {
      const th = thinking()
      try {
        let msg: string
        tab('logP')
        if (cmd.intent === 'modify_section') msg = await actModifySection(cmd.target, cmd.H, cmd.B)
        else if (cmd.intent === 'resize_subset') msg = await actResizeSubset(cmd.target, cmd.H, cmd.B, cmd.floors)
        else if (cmd.intent === 'add_load') msg = await actAddLoad(cmd.name, cmd.type, cmd.floor, cmd.fz)
        else msg = await actAddBracing(cmd.building, cmd.floors || [S.model.spec!.stories])
        th.remove()
        addMsg('bot', t('edit_done', msg))
      } catch (e: any) { th.remove(); addMsg('bot', t('err', e.message)) }
      return
    }
    case 'help':
      addMsg('bot', t('help_html'))
      return
    case 'tab': {
      const M = { '3d': 'viewP', result: 'resP', log: 'logP', model: 'modelP' } as const
      tab(M[cmd.which])
      if (cmd.which === '3d') draw3D()
      return
    }
    case 'conn_check':
      addMsg('bot', S.connected
        ? `✅ ${t('conn_linked')}${S.apiUser ? ` <span style="color:var(--muted)">· ${S.apiUser}</span>` : ''}`
        : `⚠ ${t('e_notconn')}`)
      return
    case 'change_spec': {
      if (!S.model.spec) { addMsg('bot', t('e_nomodel_edit')); return }
      proposeBuild({ ...S.model.spec, [cmd.field]: cmd.value }, false)
      return
    }
  }
  const hint = t('unknown_hint')
  addMsg('bot', t('unknown') + (hint ? `<br><span style="color:var(--dim);font-size:.78rem">${hint}</span>` : ''))
}

/** 카드의 [실행] — 오래된 카드(buildId 불일치)는 무시. 실행 시 모든 카드의 버튼 제거(buildEpoch++). */
export async function confirmBuild(p: BuildingSpec, buildId: number): Promise<void> {
  if (buildId !== S.pendingBuildId) return   // stale build card
  S.pendingBuild = null
  S.buildEpoch++
  notify()
  const th = thinking()
  try {
    tab('logP'); await actBuildFrame(p)
    th.remove()
    const e = S.model.cols.length + S.model.beams.length + S.model.links.length
    let msg = t('build_ok', p.buildings, p.stories, S.model.nodes.length, e)
    const prof = profileOf(p)
    const sm = S.model.seismic
    if (sm) msg += `<br><span style="color:var(--cyan)">🌐 ${t('seismic')}: V=${Math.round(sm.V)} kN · T=${sm.T.toFixed(2)}s · ${prof.seismic.coefLabel}=${sm.Cs.toFixed(3)} (EX·EY, ${prof.comboRefs.seismic})</span>`
    if (sm && p.seismic && prof.seismic.rsPrimary?.(p, p.seismic)) msg += `<br><span style="color:var(--amber)">📈 ${t('rs_primary_build', (p.seismic as any).method === 'RS' ? t('rs_primary_forced') : prof.seismic.rsPrimaryWhy?.(p) ?? '')}</span>`
    const wm = S.model.wind
    if (wm) msg += `<br><span style="color:var(--cyan)">🌬 ${t('wind')}: Vx=${Math.round(wm.Vx)} · Vy=${Math.round(wm.Vy)} kN (WX·WY, ${prof.comboRefs.wind})</span>`
    if (S.model.walls && S.model.walls.length) msg += `<br><span style="color:var(--cyan)">🧱 ${t('shear_wall_core')}: ${S.model.walls.length} ${t('panels_plate')}</span>`
    addMsg('bot', msg)
  } catch (e: any) { th.remove(); addMsg('bot', t('build_fail', e.message)) }
}
