/* ════════════════════════════════════════════════════════════
   AGENT DISPATCH (LOCAL) — handleLocal(txt): parseCommand → 액션/즉시 응답. 바닐라 1:1.
   건물 확인·편집 카드는 kind:'plan' 메시지(PlanCard 컴포넌트)로 렌더.
════════════════════════════════════════════════════════════ */
import { actAnalyze, actDynamic } from '../actions/analysis'
import { actAddBracing, actAddLoad, actBuildFrame, actModifySection, actResizeSubset, clearModel } from '../actions/model'
import type { BuildingSpec } from '../engine'
import { pick, t } from '../i18n'
import { S, notify } from '../state/store'
import { addMsg, addPlanMsg, draw3D, previewSpec, renderModelState, tab, thinking } from '../state/ui'
import { parseCommand } from './parse'
import { resultBrief, statusBrief } from './results'

const HELP = {
  ko: `사용 가능한 명령:<br>
🏗 <b>모델 생성</b> — <code>주거 15층 만들어</code> · <code>층고 3.5m</code> · <code>기둥 700</code>(정사각)<br>
✏ <b>단면 수정</b> — <code>기둥 700×700으로 바꿔</code> · <code>3층 보 키워줘</code><br>
🔧 <b>스펙 변경</b> — <code>층수 20층으로 바꿔</code> · <code>층고 3500으로</code> · <code>재료 C350으로</code><br>
⬇ <b>하중·보강</b> — <code>활하중 5000N 추가</code> · <code>1동 가새 추가</code><br>
▷ <b>해석·결과</b> — <code>해석 돌려</code> · <code>동적 해석</code> · <code>최대 변위</code> · <code>반력</code><br>
🖥 <b>뷰 전환</b> — <code>3D 보여줘</code> · <code>결과 탭</code> · <code>모델 탭</code><br>
ℹ <b>기타</b> — <code>상태</code> · <code>연결 확인</code> · <code>초기화</code>`,
  en: `Available commands:<br>
🏗 <b>Build</b> — <code>build 15 story residential</code> · <code>floor height 3.5m</code> · <code>column 700</code>(square)<br>
✏ <b>Section</b> — <code>change all columns to 700×700</code> · <code>enlarge floor 3 beams</code><br>
🔧 <b>Spec</b> — <code>change stories to 20</code> · <code>floor height 3500</code> · <code>material C350</code><br>
⬇ <b>Load/Brace</b> — <code>add 5000N live load</code> · <code>add bracing</code><br>
▷ <b>Analysis</b> — <code>run analysis</code> · <code>dynamic analysis</code> · <code>max displacement</code> · <code>reactions</code><br>
🖥 <b>View</b> — <code>3D</code> · <code>result tab</code> · <code>model tab</code><br>
ℹ <b>Other</b> — <code>status</code> · <code>check connection</code> · <code>clear</code>`,
  zh: `可用指令:<br>
🏗 <b>建立模型</b> — <code>建立 15 層住宅</code> · <code>樓高 3.5m</code> · <code>柱 700</code>(正方)<br>
✏ <b>斷面修改</b> — <code>柱改為 700×700</code> · <code>第 3 樓梁加大</code><br>
🔧 <b>規格變更</b> — <code>樓層數改為 20</code> · <code>樓高 3500</code> · <code>材料 C350</code><br>
⬇ <b>載重·補強</b> — <code>新增活載重 5000N</code> · <code>新增斜撐</code><br>
▷ <b>分析·結果</b> — <code>執行分析</code> · <code>動力分析</code> · <code>最大變位</code> · <code>反力</code><br>
🖥 <b>切換視圖</b> — <code>3D</code> · <code>結果分頁</code> · <code>模型分頁</code><br>
ℹ <b>其他</b> — <code>目前狀態</code> · <code>確認連線</code> · <code>清除</code>`,
}
const UNKNOWN_HINT = { ko: '💡 <code>도움말</code>로 사용 가능한 명령 확인', en: '💡 Type <code>help</code> to see all commands', zh: '💡 輸入 <code>使用說明</code> 查看指令' }

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
      proposeBuild(cmd.params, !cmd.params.bldgType)
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
      addMsg('bot', pick(HELP))
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
  const hint = pick(UNKNOWN_HINT)
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
    const sm = S.model.seismic
    if (sm) msg += `<br><span style="color:var(--cyan)">🌐 ${t('seismic')}: V=${Math.round(sm.V)} kN · T=${sm.T.toFixed(2)}s · Cs=${sm.Cs.toFixed(3)} (EX·EY, cLCB5/7)</span>`
    const wm = S.model.wind
    if (wm) msg += `<br><span style="color:var(--cyan)">🌬 ${t('wind')}: Vx=${Math.round(wm.Vx)} · Vy=${Math.round(wm.Vy)} kN (WX·WY, cLCB4/6)</span>`
    if (S.model.walls && S.model.walls.length) msg += `<br><span style="color:var(--cyan)">🧱 ${t('shear_wall_core')}: ${S.model.walls.length} ${t('panels_plate')}</span>`
    addMsg('bot', msg)
  } catch (e: any) { th.remove(); addMsg('bot', t('build_fail', e.message)) }
}
