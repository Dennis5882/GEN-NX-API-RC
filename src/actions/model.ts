/* ════════════════════════════════════════════════════════════
   모델 생성·편집 액션 — 바닐라 ACTIONS 섹션 1:1 이전.
   엔진(RC.*)은 순수 계산, 여기서 MAPI 전송 + S.model 갱신 + 로그.
════════════════════════════════════════════════════════════ */
import { profileOf } from '../codes'
import { slabLoad, slabThk } from '../codes/selfweight'
import { RC, type BuildingSpec } from '../engine'
import { t, tl } from '../i18n'
import { mapi } from '../mapi/client'
import { S, type ElemRec } from '../state/store'
import { draw3D, log, renderModelState } from '../state/ui'

export async function clearModel(): Promise<void> {
  /* 전체 문서를 doc/new로 한 번에 초기화 — 항목별 DELETE의 알림음·"참조 중 삭제" 경고를
     피하고, Story/다이어프램(STOR·rigd·SSEIS·SWIND) 잔존도 원천 제거(빈 새 문서).
     ⚠ doc/new가 단위를 리셋하므로 호출측에서 setUnit 재설정(actBuildFrame은 clear 직후 setUnit). */
  await mapi('POST', '/doc/new', {})
  log(tl('cleared'), 'ok')
}

export async function setUnit(force = 'N', dist = 'MM'): Promise<void> {
  await mapi('PUT', 'unit', { Assign: { 1: { FORCE: force, DIST: dist, HEAT: 'KJ', TEMPER: 'C' } } })
  log(tl('unit', force, dist), 'ok')
}

export async function putSection(id: number, name: string, H: number, B: number): Promise<void> {
  await mapi('PUT', 'sect', { Assign: { [id]: { SECTTYPE: 'DBUSER', SECT_NAME: name,
    SECT_BEFORE: { SHAPE: 'SB', DATATYPE: 2, SECT_I: { vSIZE: [H, B, 0, 0, 0, 0, 0] },
      USE_SHEAR_DEFORM: true, USE_WARPING_EFFECT: false } } } })
  log(tl('sect', name, H, B), 'ok')
}

/* 다중 단면·재료 일괄 등록 — id = 배열 index+1 (specSections 레지스트리와 일치) */
async function putMaterials(p: BuildingSpec, mats: string[]): Promise<void> {
  const a: Record<number, any> = {}
  const prof = profileOf(p)
  mats.forEach((name, i) => {
    a[i + 1] = { ...prof.concreteMatl(name), DAMP_RAT: 0.05 }   // 기준별 재료 DB (대만 CNS560(RC) · 중국 GB/T10(RC))
  })
  await mapi('PUT', 'matl', { Assign: a })
  S.model.matl = a[1] ? a[1].NAME : '-'
  log('▸ ' + t('material') + ' <b>' + mats.length + '</b> (' + Object.values(a).map((m: any) => m.NAME).join(', ') + ')', 'ok')
}

async function putSections(sects: { name: string; H: number; B: number }[]): Promise<void> {
  const a: Record<number, any> = {}
  sects.forEach((s, i) => {
    a[i + 1] = { SECTTYPE: 'DBUSER', SECT_NAME: s.name,
      SECT_BEFORE: { SHAPE: 'SB', DATATYPE: 2, SECT_I: { vSIZE: [s.H, s.B, 0, 0, 0, 0, 0] },
        USE_SHEAR_DEFORM: true, USE_WARPING_EFFECT: false } }
  })
  await mapi('PUT', 'sect', { Assign: a })
  sects.forEach(s => log(tl('sect', s.name, s.H, s.B), 'ok'))
}

async function putNodes(nodes: { id: number; x: number; y: number; z: number }[]): Promise<void> {
  const a: Record<number, any> = {}
  nodes.forEach(n => { a[n.id] = { X: +n.x.toFixed(4), Y: +n.y.toFixed(4), Z: +n.z.toFixed(4) } })
  await mapi('PUT', 'node', { Assign: a })
  log(tl('node', nodes.length), 'ok')
}

async function putElements(elems: { id: number; n1: number; n2: number; sect: number; matl?: number }[]): Promise<void> {
  const a: Record<number, any> = {}
  elems.forEach(e => { a[e.id] = { TYPE: 'BEAM', MATL: e.matl || 1, SECT: e.sect, NODE: [e.n1, e.n2], ANGLE: 0, STYPE: 0 } })
  await mapi('PUT', 'elem', { Assign: a })
  log(tl('elem', elems.length), 'ok')
}

async function putBoundary(nodeIds: number[], constraint: string): Promise<void> {
  const a: Record<number, any> = {}
  nodeIds.forEach((nid, k) => { a[nid] = { ITEMS: [{ ID: k + 1, CONSTRAINT: constraint, GROUP_NAME: '' }] } })
  await mapi('PUT', 'cons', { Assign: a })
  log(tl('bound', nodeIds.length, constraint), 'ok')
}

async function putLoadCase(no: number, name: string, type: string): Promise<void> {
  await mapi('PUT', 'stld', { Assign: { [no]: { NO: no, NAME: name, TYPE: type, DESC: '' } } })
  log(tl('lc', name, type), 'ok')
}

async function putSelfWeight(no: number, lcName: string, factor = -1): Promise<void> {
  await mapi('PUT', 'BODF', { Assign: { [no]: { LCNAME: lcName, GROUP_NAME: '', FV: [0, 0, factor] } } })
  log(tl('selfw', factor, lcName), 'ok')
}

async function putNodalLoad(_no: number, lcName: string, nodeIds: number[], f: { fx?: number; fy?: number; fz?: number; mx?: number; my?: number; mz?: number }): Promise<void> {
  const a: Record<number, any> = {}
  nodeIds.forEach((nid, k) => {
    a[nid] = { ITEMS: [{ ID: k + 1, LCNAME: lcName, GROUP_NAME: '',
      FX: f.fx || 0, FY: f.fy || 0, FZ: f.fz || 0, MX: f.mx || 0, MY: f.my || 0, MZ: f.mz || 0 }] }
  })
  await mapi('PUT', 'CNLD', { Assign: a })
  log(tl('nodal', nodeIds.length, lcName), 'ok')
}

/* 바닥하중: FBLD(용도 타입) + FBLA(층별 면적). 중력=음수, N/mm^2 = kN/m^2 * 1e-3 */
async function applyFloorLoads(p: BuildingSpec, f: any): Promise<void> {
  const groups = RC.deriveFloorGroups(p)
  const uses: string[] = [...new Set(Object.values(groups).map((g: any) => g.use as string))]
  if (!uses.length || !f.floorCorners) return
  S.model.floorGroups = groups
  let no = S.model.nextLC || 2
  const lcTypeMap: Record<string, string> = { LL: 'L', LR: 'LR' }
  const prof = profileOf(p)
  const floorUse = prof.floorUse
  const slab = slabLoad(p, prof)            // 슬래브 자중 kN/m² — 바닥판 요소가 없으므로 DL 에 얹음
  const liveNeeded = [...new Set(uses.map(u => floorUse[u].live))]
  for (const lc of liveNeeded) {
    await putLoadCase(no, lc, lcTypeMap[lc] || 'L')
    S.model.loadCases.push({ name: lc, type: lcTypeMap[lc] || 'L' })
    no++
  }
  S.model.nextLC = no
  const fbld: Record<number, any> = {}
  let fi = 1
  uses.forEach(u => {
    const pr = floorUse[u]
    fbld[fi++] = { NAME: u, DESC: '', ITEM: [
      { LCNAME: 'DL', FLOOR_LOAD: -Math.round((pr.sdl + slab) * 1e6) / 1e9, OPT_SUB_BEAM_WEIGHT: true },
      { LCNAME: pr.live, FLOOR_LOAD: -(pr.liveVal * 1e-3), OPT_SUB_BEAM_WEIGHT: true },
    ] }
  })
  await mapi('PUT', 'fbld', { Assign: fbld })
  const fbla: Record<number, any> = {}
  let ai = 1
  for (let b = 0; b < p.buildings; b++) for (let iz = 1; iz <= p.stories; iz++) {
    const g = groups[iz]
    const corners = f.floorCorners[b + '_' + iz]
    if (!g || !corners) continue
    fbla[ai++] = { FLOOR_LOAD_TYPE_NAME: g.use, FLOOR_DIST_TYPE: 2, DIR: 'GZ', NODES: corners, GROUP_NAME: '' }
  }
  await mapi('PUT', 'fbla', { Assign: fbla })
  log('▸ ' + t('floor_loads') + ' <b>' + (ai - 1) + '</b> (' + uses.join(', ') + ') · ' + t('slab_thk') + ' ' + slabThk(p) + 'mm = ' + +slab.toFixed(2) + ' kN/㎡ → DL', 'ok')
}

/* 하중조합 — 설계기준 프로필 (대만: taiwanCombos, TWD-USD112) */
async function putCombos(): Promise<void> {
  const prof = profileOf(S.model.spec)
  /* rsCases: 응답스펙트럼이 주 해석일 때 동적해석이 등록(RSX/RSY, type 'RS') — 정적 결과 회수 목록과 분리 */
  const combos = prof.combos([...(S.model.loadCases || []), ...(S.model.rsCases || [])])
  if (!combos.length) {
    if ((S.model.combos || []).length) { try { await mapi('DELETE', 'lcom-gen', {}) } catch { /* noop */ } S.model.combos = [] }
    return
  }
  const a: Record<number, any> = {}
  combos.forEach((cb, i) => {
    a[i + 1] = { NAME: cb.name, ACTIVE: 'ACTIVE', iTYPE: 0, DESC: cb.desc,
      vCOMB: cb.terms.map(([lc, fac, anal]) => ({ ANAL: anal || 'ST', LCNAME: lc, FACTOR: fac })) }
  })
  /* 이전 등록보다 조합 수가 줄면(예: KR 정적 21 → RS 17) 옛 번호가 남아 정적 조합이 섞임 → 먼저 비우고 PUT.
     ⚠ DELETE lcom-gen 은 Assign 번호를 무시하고 전체를 지움(라이브 2026-10-12) — 그래서 PUT 앞에서만 호출 */
  if ((S.model.combos || []).length > combos.length) {
    try { await mapi('DELETE', 'lcom-gen', {}) } catch { /* noop */ }
  }
  await mapi('PUT', 'lcom-gen', { Assign: a })
  S.model.combos = combos.map(c => c.name)
  log('▸ ' + t(prof.combosLogKey) + ' <b>' + combos.length + '</b>', 'ok')
}

/* db/STOR 층 데이터 PUT — 표준층 모델에서 Story Data 자동 생성(엔진 buildStoryData, 15필드 라이브 스키마).
   규약 A: 지반 1F@0(다이어프램 OFF) + 층 (iz+1)F·최상 RF. ⚠ Story Data 테이블만 채움(Story Manager 등록은 GUI 별도). */
async function putStoryData(p: BuildingSpec, f: any): Promise<void> {
  const a = RC.buildStoryData(p, f)
  const n = Object.keys(a).length
  await mapi('PUT', 'STOR', { Assign: a })
  log('▸ ' + t('story_data_db_stor') + ' <b>' + n + '</b> ' + t('g_l_1f_floors_diaphragm_vi'), 'ok')
}

/* ope/STOR(Story Calc OPT) — 우발편심 자동산정(지진 5%·풍 15%). db/STOR 선행 필수.
   ⚠ 호출 순서: runAnalysis → fetchTable×3 → renderResults → 여기. 앞에 두면 [SS] no-result. */
export async function putStoryCalc(): Promise<void> {
  await mapi('POST', '/ope/STOR', { Argument: {
    SEIS_ECC: { INC_SEIS_ECC: true, SEIS_ECC_VALUE: 5 },
    WIND_ECC: { INC_WIND_ECC: true, WIND_ECC_VALUE: 15 } } })
  log('▸ ' + t('story_register_accidental_') + ' ✓', 'ok')
}

/* M2-A: 횡하중(지진 EX/EY + 풍 WX/WY) 통합 적용.
   층력을 절점 균등분배 — 모든 활성 케이스를 '한 번의 CNLD PUT'에 합쳐 절점 ITEMS로
   (직렬 ID). 분리 PUT 시 같은 절점이 덮어쓰여 먼저 넣은 케이스가 사라지는 것을 방지.
   조합은 taiwanCombos 가 E/W 감지 → cLCB4~7 자동. */
async function applyLateral(p: BuildingSpec, f: any): Promise<void> {
  const sp: any = p.seismic, wp: any = p.wind
  const useS = !!(sp && sp.on), useW = !!(wp && wp.on)
  if (!useS && !useW) return
  let no = S.model.nextLC || 2
  /* 층력(storyForces)은 전체 동 합계(면적·풍압폭 × 동 수) → 같은 층의 모든 동 절점에 나눠 재하.
     ⚠ 예전(바닐라부터)엔 floorGroups(동_층)마다 합계 전체를 실어 2동이면 CNLD 합 = 2V 였음 (2026-10-12 수정) */
  const byStory: Record<number, number[]> = {}
  for (const k in (f.floorGroups || {})) { const iz = +k.split('_')[1]; (byStory[iz] = byStory[iz] || []).push(...f.floorGroups[k]) }
  const perNode: Record<string, { LCNAME: string; FX: number; FY: number; MZ?: number; FZ?: number }[]> = {}
  const push = (nid: number, it: { LCNAME: string; FX: number; FY: number; MZ?: number; FZ?: number }) => { (perNode[nid] = perNode[nid] || []).push(it) }
  if (useS) {
    const r = profileOf(p).seismic.storyForces(p, sp)
    S.model.seismic = { T: r.T, Cs: r.Cs, V: r.V, Wtot: r.Wtot }
    await putLoadCase(no, 'EX', 'E'); S.model.loadCases.push({ name: 'EX', type: 'E' }); no++
    await putLoadCase(no, 'EY', 'E'); S.model.loadCases.push({ name: 'EY', type: 'E' }); no++
    /* 우발편심(기준 지정 시): EX 는 Y 치수, EY 는 X 치수 × e 만큼 편심 → 층 비틀림 MZ 를 절점 균등분배(강성 다이어프램이 합산). N·mm */
    const ecc = profileOf(p).seismic.staticAccEcc || 0
    const Lx = RC.asSpans(p.spanX, p.bayX).reduce((a: number, b: number) => a + b, 0)
    const Ly = RC.asSpans(p.spanY, p.bayY).reduce((a: number, b: number) => a + b, 0)
    /* 2동 이상: 다이어프램이 동별 막요소라 절점 MZ 는 전달이 불확실 → 동마다 우발편심 비틀림을 강체 회전 분포의 절점 힘 짝(합력 0)으로 */
    const nodeAt = new Map<number, any>(f.nodes.map((n: any) => [n.id, n]))
    const multiB = (p.buildings || 1) > 1
    for (const k in byStory) {
      const iz = +k
      const ns = byStory[iz]
      const F = (r.forces[iz - 1] ? r.forces[iz - 1].F : 0) * 1000
      if (!F || !ns.length) continue
      const per = F / ns.length
      if (ecc && multiB) {
        for (let b = 0; b < p.buildings; b++) {
          const g: number[] = f.floorGroups[`${b}_${iz}`] || []; if (!g.length) continue
          const pts = g.map(id => nodeAt.get(id)), xc = pts.reduce((a, n) => a + n.x, 0) / pts.length, yc = pts.reduce((a, n) => a + n.y, 0) / pts.length
          const J = pts.reduce((a, n) => a + (n.x - xc) ** 2 + (n.y - yc) ** 2, 0) || 1
          const Fb = per * g.length, mzx = Fb * ecc * Ly, mzy = Fb * ecc * Lx       // EX → Y 치수, EY → X 치수
          g.forEach((nid, i) => {
            const n = pts[i], rx = n.x - xc, ry = n.y - yc
            push(nid, { LCNAME: 'EX', FX: per - mzx * ry / J, FY: mzx * rx / J })
            push(nid, { LCNAME: 'EY', FX: -mzy * ry / J, FY: per + mzy * rx / J })
          })
        }
      } else if (ecc) {
        const mx = F * ecc * Ly / ns.length, my = F * ecc * Lx / ns.length
        ns.forEach(nid => { push(nid, { LCNAME: 'EX', FX: per, FY: 0, MZ: mx }); push(nid, { LCNAME: 'EY', FX: 0, FY: per, MZ: my }) })
      } else ns.forEach(nid => { push(nid, { LCNAME: 'EX', FX: per, FY: 0 }); push(nid, { LCNAME: 'EY', FX: 0, FY: per }) })
    }
    /* 수직지진 EV (기준이 지정 시) — 층 연직력을 층 절점에 균등 분배, 하향 양수 케이스(조합이 ±) */
    const ev = profileOf(p).verticalForces?.(p, sp)
    if (ev) {
      await putLoadCase(no, 'EV', 'USER'); S.model.loadCases.push({ name: 'EV', type: 'USER' }); no++
      let tot = 0
      for (const k in byStory) {
        const F = (ev.F[+k] || 0) * 1000
        if (!F || !byStory[k].length) continue
        tot += F
        byStory[k].forEach(nid => push(nid, { LCNAME: 'EV', FX: 0, FY: 0, FZ: -F / byStory[k].length }))
      }
      log(`▸ ${t('tw_vertical_log', ev.Kz.toFixed(3), ev.kc.toFixed(3), Math.round(tot / 1000))}`, 'ok')
    }
    log('▸ ' + t('seismic_static') +
      ` <b>V=${Math.round(r.V)} kN</b> · T=${r.T.toFixed(2)}s · ${profileOf(p).seismic.coefLabel}=${r.Cs.toFixed(3)} (EX·EY)` + (ecc ? ` · ${t('acc_ecc')} ${ecc * 100}%` : ''), 'ok')
  }
  if (useW) {
    const r = profileOf(p).wind.storyForces(p, wp)
    S.model.wind = { Vx: r.Vx, Vy: r.Vy, V10: r.V10 }
    await putLoadCase(no, 'WX', 'W'); S.model.loadCases.push({ name: 'WX', type: 'W' }); no++
    await putLoadCase(no, 'WY', 'W'); S.model.loadCases.push({ name: 'WY', type: 'W' }); no++
    for (const k in byStory) {
      const iz = +k
      const ns = byStory[iz]
      if (!ns.length) continue
      const Fx = (r.forcesX[iz - 1] ? r.forcesX[iz - 1].F : 0) * 1000 / ns.length
      const Fy = (r.forcesY[iz - 1] ? r.forcesY[iz - 1].F : 0) * 1000 / ns.length
      ns.forEach(nid => { push(nid, { LCNAME: 'WX', FX: Fx, FY: 0 }); push(nid, { LCNAME: 'WY', FX: 0, FY: Fy }) })
    }
    log('▸ ' + t('wind') + ` <b>Vx=${Math.round(r.Vx)} · Vy=${Math.round(r.Vy)} kN</b> (WX·WY)`, 'ok')
  }
  S.model.nextLC = no
  const a: Record<string, any> = {}
  for (const nid in perNode) {
    a[nid] = { ITEMS: perNode[nid].map((it, i) => (
      { ID: i + 1, LCNAME: it.LCNAME, GROUP_NAME: '', FX: it.FX || 0, FY: it.FY || 0, FZ: it.FZ || 0, MX: 0, MY: 0, MZ: it.MZ || 0 })) }
  }
  if (Object.keys(a).length) await mapi('PUT', 'cnld', { Assign: a })
}

/** 동별 막요소 바닥 — PLSTRS(평면응력, 회전자유도 비활성) 경간마다 1개, 사용자 재료 밀도 0(슬래브 자중·질량은 이미 바닥 DL 에 있음).
    면내 강성만 주고 휨·질량은 그대로 → 동마다 강성 바닥, 동 사이는 연결층(connectFloor)의 연결 슬래브로만 묶임(JGJ 3 10.5.4 강접합 가정).
    라이브 2026-10-13: PLSTRS + Story Data 는 해석 허용. 반환 = 마지막 요소 번호 */
async function putFloorMembranes(p: BuildingSpec, f: any, recs: ElemRec[], eid: number, matId: number, thkId: number): Promise<number> {
  const prof = profileOf(p)
  const E = prof.materials[p.matName]?.E || p.E
  await mapi('PUT', 'matl', { Assign: { [matId]: { TYPE: 'USER', NAME: 'SLAB-MEMB', HE_SPEC: 0, HE_COND: 0, PLMT: 0, P_NAME: '', bMASS_DENS: true, DAMP_RAT: 0.05,
    PARAM: [{ P_TYPE: 2, ELAST: E, POISN: 0.2, THERMAL: 1e-5, DEN: 0, MASS: 0 }] } } })
  const tk = Math.max(100, slabThk(p) || 0)
  await mapi('PUT', 'thik', { Assign: { [thkId]: { NAME: `SLAB${tk}M`, TYPE: 'VALUE', bINOUT: false, T_IN: tk, T_OUT: 0, O_VALUE: 0 } } })
  const key = (x: number, y: number, z: number) => `${Math.round(x)}_${Math.round(y)}_${Math.round(z)}`
  const at = new Map<string, number>(f.nodes.map((n: any) => [key(n.x, n.y, n.z), n.id]))
  const byId = new Map<number, any>(f.nodes.map((n: any) => [n.id, n]))
  const A: Record<number, any> = {}
  let nFloor = 0, nConn = 0
  const quad = (x0: number, x1: number, y0: number, y1: number, z: number, b: number, iz: number) => {
    const q = [at.get(key(x0, y0, z)), at.get(key(x1, y0, z)), at.get(key(x1, y1, z)), at.get(key(x0, y1, z))]
    if (q.some(v => v == null)) return false
    A[++eid] = { TYPE: 'PLSTRS', MATL: matId, SECT: thkId, NODE: q, ANGLE: 0, STYPE: 1 }
    recs.push({ id: eid, type: 'slab', sect: thkId, matl: matId, b, iz, nodes: q as number[] })
    return true
  }
  const uniq = (v: number[]) => [...new Set(v.map(Math.round))].sort((a, b) => a - b)
  for (const k in (f.floorGroups || {})) {
    const [b, iz] = k.split('_').map(Number)
    const ns = (f.floorGroups[k] as number[]).map(id => byId.get(id))
    const xs = uniq(ns.map(n => n.x)), ys = uniq(ns.map(n => n.y)), z = ns[0].z
    for (let i = 0; i < xs.length - 1; i++) for (let j = 0; j < ys.length - 1; j++) if (quad(xs[i], xs[i + 1], ys[j], ys[j + 1], z, b, iz)) nFloor++
  }
  /* 연결층 — 이웃 동 마주 보는 외곽선 사이 */
  const cf = p.connectFloor || 0
  if (cf > 0) for (let b = 0; b < p.buildings - 1; b++) {
    const L = (f.floorGroups[`${b}_${cf}`] || []).map((id: number) => byId.get(id)), Rn = (f.floorGroups[`${b + 1}_${cf}`] || []).map((id: number) => byId.get(id))
    if (!L.length || !Rn.length) continue
    const xL = Math.max(...L.map((n: any) => n.x)), xR = Math.min(...Rn.map((n: any) => n.x)), ys = uniq(L.map((n: any) => n.y)), z = L[0].z
    for (let j = 0; j < ys.length - 1; j++) if (quad(xL, xR, ys[j], ys[j + 1], z, -1, cf)) nConn++
  }
  if (Object.keys(A).length) await mapi('PUT', 'elem', { Assign: A })
  log('▸ ' + t('dia_per_bldg', p.buildings, nFloor, tk, nConn ? cf : 0, nConn), 'ok')
  return eid
}

export async function actBuildFrame(p: BuildingSpec, clear = true): Promise<any> {
  if (!S.connected) throw new Error(t('e_notconn'))
  p.walls = RC.resolveWalls(p)   // 코어 + 내력벽 — 층수·경간이 바뀐 스펙(change_spec 등)의 낡은 walls 재생성
  const f = RC.buildFrame(p)
  S.review = null
  /* 이전 동적해석 상태 초기화 — 남아 있으면 새 모델 조합이 없는 RSX/RSY 를 참조 (doc/new 가 조합도 지움) */
  S.model.rsCases = undefined
  S.model.dynamic = null
  if (clear) { await clearModel(); S.model.combos = [] }              // doc/new가 단위를 리셋하므로 setUnit은 그 다음
  await setUnit('N', 'MM')
  const R = RC.specSections(p)               // 다중 단면·재료 레지스트리 + 층별 배정
  await putMaterials(p, R.mats)
  await putSections(R.sections)
  await putNodes(f.nodes)
  const asg = (iz: number) => R.storyAssign[iz] || R.def
  let eid = 0
  const elems: { id: number; n1: number; n2: number; sect: number; matl?: number }[] = []   // eid 는 막요소(putFloorMembranes)가 이어서 씀
  const recs: ElemRec[] = []
  f.colMeta.forEach((c: any) => {
    const a = asg(c.iz); const id = ++eid
    elems.push({ id, n1: c.n1, n2: c.n2, sect: a.colSect, matl: a.mat })
    recs.push({ id, type: 'col', sect: a.colSect, matl: a.mat, b: c.b, iz: c.iz, n1: c.n1, n2: c.n2 })
  })
  f.beamMeta.forEach((c: any) => {
    const a = asg(c.iz); const id = ++eid
    elems.push({ id, n1: c.n1, n2: c.n2, sect: a.beamSect, matl: a.mat })
    recs.push({ id, type: 'beam', sect: a.beamSect, matl: a.mat, b: c.b, iz: c.iz, n1: c.n1, n2: c.n2, ...(c.inWall ? { inWall: true } : {}) })
  })
  f.linkMeta.forEach((c: any) => {
    const a = asg(c.iz); const id = ++eid
    elems.push({ id, n1: c.n1, n2: c.n2, sect: a.beamSect, matl: a.mat })
    recs.push({ id, type: 'link', sect: a.beamSect, matl: a.mat, b: -1, iz: c.iz, n1: c.n1, n2: c.n2 })
  })
  await putElements(elems)
  /* M2-A3: 전단벽/코어/내력벽 = Gen WALL 요소(STYPE 2 plate). 두께별 THIK → SECT. Wall ID = 동·벽 정의·평면별.
     PLATE 는 Gen 층 결과(층간변위·비틀림·강성·전도모멘트)의 '수직 부재'로 인식되지 않음 → 기둥 없는 벽식 모델에서 표가 0
     (라이브 2026-10-13). WALL 이면 인식되고 전도모멘트도 Frame/Wall 로 나뉨 */
  if (f.walls && f.walls.length) {
    const thmap: Record<number, number> = {}
    const thA: Record<number, any> = {}
    f.wallThks.forEach((tk: number, i: number) => {
      thmap[tk] = i + 1
      thA[i + 1] = { NAME: 'W' + tk, TYPE: 'VALUE', bINOUT: false, T_IN: tk, T_OUT: 0, O_VALUE: 0 }
    })
    await mapi('PUT', 'thik', { Assign: thA })
    const wa: Record<number, any> = {}
    const xyz = new Map(f.nodes.map((n: any) => [n.id, n]))
    const wid = new Map<string, number>()
    f.walls.forEach((w: any) => {
      const id = ++eid; const a = asg(w.story)
      const [p1, p2] = [xyz.get(w.nodes[0]) as any, xyz.get(w.nodes[1]) as any]
      const key = `${w.building}|${w.w}|${Math.abs(p1.x - p2.x) < 1 ? 'X' + Math.round(p1.x) : 'Y' + Math.round(p1.y)}`
      if (!wid.has(key)) wid.set(key, wid.size + 1)
      wa[id] = { TYPE: 'WALL', MATL: a.mat, SECT: thmap[w.thick], NODE: w.nodes, STYPE: 2, WALL: wid.get(key), W_CON: 0, W_TYPE: 0, ANGLE: 0 }
      recs.push({ id, type: 'wall', sect: thmap[w.thick], matl: a.mat, b: w.building, iz: w.story, nodes: w.nodes })
    })
    await mapi('PUT', 'elem', { Assign: wa })
    log('▸ ' + t('shear_wall_core') + ' <b>' + f.walls.length + '</b> (' + f.wallThks.map((tk: number) => tk + 'mm').join(', ') + ')', 'ok')
  }
  /* 부재 강성 배율(기준 훅) — db/ESSF 요소별(숫자 = IYY 만, 객체 = IYY·IZZ), db/PSSF 벽 요소별.
     doc/new 직후라 이전 배율 없음(ESSF 전체 DELETE 는 502 — 라이브 2026-10-13) */
  const stiff = clear ? profileOf(p).memberStiffness?.(p, recs, f.nodes, Object.fromEntries(R.sections.map((s: any, i: number) => [i + 1, s.H]))) : null
  /* 벽 위에 겹친 보(inWall) = 자중 0(벽 자중에 포함, 바닥하중 전달용으로만 유지) — 강성 배율과 같은 ESSF 항목에 합침 */
  const inWall = recs.filter(r => r.inWall).map(r => r.id)
  const factors = stiff?.factors || {}
  if (Object.keys(factors).length || inWall.length) {
    const sa: Record<number, any> = {}
    const wall0 = new Set(inWall)
    for (const id of new Set([...Object.keys(factors).map(Number), ...inWall])) {
      const k = factors[id] ?? 1
      const [iy, iz] = typeof k === 'number' ? [k, 1] : [k.iyy, k.izz]
      sa[id] = { ITEMS: [{ ID: 1, AREA_SF: 1, ASY_SF: 1, ASZ_SF: 1, IXX_SF: 1, IYY_SF: iy, IZZ_SF: iz, WGT_SF: wall0.has(id) ? 0 : 1, GROUP_NAME: '' }] }
    }
    await mapi('PUT', 'ESSF', { Assign: sa })
  }
  /* 벽 강성 — /db/WSSF 키 = WALL 요소 번호, BENDING = 면내 휨(T₁ ×0.7 → +12.9%), SHEAR = 면내 전단(+2.9%) — 라이브 2026-10-13.
     PSSF 는 WALL 요소에 입력 불가. 실패해도 모델링은 계속 */
  if (stiff && stiff.walls && Object.keys(stiff.walls).length) {
    const wa2: Record<number, any> = {}
    for (const [id, k] of Object.entries(stiff.walls))
      wa2[+id] = { ITEMS: [{ ID: 1, GROUP_NAME: '', SHEAR: k.shear, BENDING: k.bending }] }
    try { await mapi('PUT', 'WSSF', { Assign: wa2 }) } catch (e: any) { log('⚠ WSSF: ' + (e?.message || e), 'warn') }
  }
  if (stiff && (Object.keys(stiff.factors).length || Object.keys(stiff.walls || {}).length)) log('▸ ' + stiff.log, 'ok')
  if (inWall.length) log('▸ ' + t('inwall_beams', inWall.length), 'ok')
  await putBoundary(f.baseNodes, '1111110')
  await putLoadCase(1, 'DL', 'D')
  await putSelfWeight(1, 'DL', -1)
  /* M1.7: 다이어프램. 기본=story(db/STOR bFLOOR_DIAPHRAGM). 'rigd' 명시 시만 db/rigd 사용.
     ⚠ Gen NX(0612)는 db/rigd 와 db/STOR 가 함께 있으면 해석 거부('Analysis is not allowed', 라이브 2026-10-13) →
       Story Data 를 쓰는 기본 경로에선 rigd 를 쓰지 않고 story 다이어프램으로 대체.
     2동 이상은 story 다이어프램이 층 전체를 한 강체로 묶어(동 A 만 가력해도 동 B 같은 변위 — 라이브) 떨어진 동이 매 층 한 몸이 됨 →
       다이어프램 OFF + 동별 막요소 바닥(putFloorMembranes) */
  const multi = (p.buildings || 1) > 1
  let diaMethod: string | undefined = multi ? 'none' : p.diaphragmMethod
  if (diaMethod === 'rigd' && p.storyData !== false) { diaMethod = 'story'; log('▸ ' + t('rigd_story_conflict'), 'warn') }
  if (multi) eid = await putFloorMembranes(p, f, recs, eid, R.mats.length + 1, (f.wallThks || []).length + 1)
  if (diaMethod === 'rigd') {
    const dia: Record<number, any> = {}
    let rid = 1
    const dg = RC.deriveFloorGroups(p)
    for (const k in (f.floorGroups || {})) {
      const iz = +k.split('_')[1]; const g = dg[iz]
      if (g && g.dia === false) continue
      const ns: number[] = f.floorGroups[k]
      if (ns.length >= 3) dia[ns[0]] = { ITEMS: [{ ID: rid++, GROUP_NAME: '', DOF: 110001, S_NODE: ns.slice(1) }] }
    }
    if (Object.keys(dia).length) {
      await mapi('PUT', 'rigd', { Assign: dia })
      log('▸ ' + t('rigid_diaphragm') + ' <b>' + Object.keys(dia).length + '</b>', 'ok')
    }
  }
  /* M2-A8: Story 정보(db/STOR) 자동 생성 — 표준층 모델 기본 ON(p.storyData!==false)
     ope/STOR(putStoryCalc)는 해석 후 actAnalyze에서 호출(해석 전 호출 시 [SS] no-result 알림 발생). */
  if (p.storyData !== false) {
    try { await putStoryData({ ...p, diaphragmMethod: diaMethod as any }, f) } catch (e: any) {
      log('⚠ ' + t('story_data_skipped') + (e.message || e), 'err')
    }
  }
  const secMap: Record<number, { name: string; H: number; B: number }> = {}
  R.sections.forEach((s: any, i: number) => { secMap[i + 1] = { name: s.name, H: s.H, B: s.B } })
  Object.assign(S.model, { spec: p, colSect: p.colName, beamSect: p.beamName,
    nodes: f.nodes, cols: f.cols, beams: f.beams, links: f.links, walls: f.walls || [],
    elemRecs: recs, nextEid: eid + 1, nextSect: R.sections.length + 1, nextMat: R.mats.length + 1 + (multi ? 1 : 0), nextLC: 2,
    sections: secMap, secReg: R, materials: R.mats.slice(),
    baseNodes: f.baseNodes, elev: f.elev, loadCases: [{ name: 'DL', type: 'D' }], edits: [], seismic: null, wind: null })
  await applyFloorLoads(p, f)
  await applyLateral(p, f)
  await putCombos()
  renderModelState(); draw3D()
  /* 모델링 종료: GEN NX 화면을 ISO 뷰로 회전 — 전체 모델 한눈에. (라이브 확정: H=30,V=15)
     view/ANGLE 실패가 모델링을 깨지 않도록 격리. */
  try {
    await mapi('POST', '/view/ANGLE', { Argument: { HORIZONTAL: 30, VERTICAL: 15 } })
    log('▸ ' + t('iso_view'), 'ok')
  } catch { /* noop */ }
  return f
}

export async function actModifySection(target: 'col' | 'beam', H: number, B: number): Promise<string> {
  if (!S.model.nodes.length) throw new Error(t('e_nomodel_edit'))
  const sid = target === 'col' ? 1 : 2
  const name = (target === 'col' ? 'C' : 'B') + H + 'x' + B
  await putSection(sid, name, H, B)
  S.model.sections[sid] = { name, H, B }
  if (target === 'col') S.model.colSect = name; else S.model.beamSect = name
  const tg = t(target === 'col' ? 'tgt_col' : 'tgt_beam')
  const cnt = S.model.elemRecs.filter(r => r.sect === sid).length
  S.model.edits.push(`${tg} → ${name}`)
  renderModelState()
  return t('act_modsect', tg, name, cnt)
}

export async function actResizeSubset(target: 'col' | 'beam', H: number, B: number, floors: number[]): Promise<string> {
  if (!S.model.nodes.length) throw new Error(t('e_nomodel_edit'))
  const type = target === 'col' ? 'col' : 'beam'
  let recs = S.model.elemRecs.filter(r => r.type === type)
  if (floors && floors.length) recs = recs.filter(r => floors.includes(r.iz))
  if (!recs.length) throw new Error(t('e_notarget'))
  const sid = S.model.nextSect!++
  const name = (target === 'col' ? 'C' : 'B') + H + 'x' + B + '_' + (floors && floors.length ? ('F' + floors.join('-')) : 'sub')
  await putSection(sid, name, H, B)
  S.model.sections[sid] = { name, H, B }
  const a: Record<number, any> = {}
  recs.forEach(r => { r.sect = sid; a[r.id] = { TYPE: 'BEAM', MATL: 1, SECT: sid, NODE: [r.n1, r.n2], ANGLE: 0, STYPE: 0 } })
  await mapi('PUT', 'elem', { Assign: a })
  log(tl('reassign', recs.length, name), 'ok')
  const tg = t(target === 'col' ? 'tgt_col' : 'tgt_beam')
  const fl = floors && floors.length ? `${floors.join(',')}F ` : ''
  S.model.edits.push(`${fl}${tg} → ${name} (${recs.length})`)
  renderModelState()
  return t('act_resize', fl, tg, recs.length, H, B, name)
}

export async function actAddLoad(name: string, type: string, floor: number, fz: number): Promise<string> {
  if (!S.model.nodes.length) throw new Error(t('e_nomodel'))
  const no = S.model.nextLC!++
  await putLoadCase(no, name, type)
  const z = S.model.elev[floor]
  const ids = S.model.nodes.filter(n => Math.abs(n.z - z) < 1).map(n => n.id)
  if (!ids.length) throw new Error(t('e_nofloor'))
  await putNodalLoad(no, name, ids, { fz })
  S.model.loadCases.push({ name, type })
  await putCombos()
  S.model.edits.push(`${name}: F${floor} ${ids.length}pt Fz=${fz}`)
  renderModelState()
  return t('act_addload', name, type, floor, ids.length, fz)
}

export async function actAddBracing(building: number, floors: number[]): Promise<string> {
  if (!S.model.nodes.length) throw new Error(t('e_nomodel'))
  const p = S.model.spec!
  const sx = RC.asSpans(p.spanX, p.bayX), sy = RC.asSpans(p.spanY, p.bayY)
  const nbx = sx.length, nby = sy.length, npy = nby + 1
  const Xp = RC.cumPos(sx), Yp = RC.cumPos(sy), bW = Xp[nbx]
  const ox = building * (bW + p.gap)
  const nodeAt = (ix: number, iy: number, iz: number) => S.model.nodes.find(n =>
    Math.abs(n.x - (ox + Xp[ix])) < 1 && Math.abs(n.y - Yp[iy]) < 1 && Math.abs(n.z - S.model.elev[iz]) < 1)
  const sid = S.model.nextSect!++
  await putSection(sid, 'BRACE300x300', 300, 300)
  S.model.sections[sid] = { name: 'BRACE300x300', H: 300, B: 300 }
  const a: Record<number, any> = {}
  const newRecs: ElemRec[] = []
  const newEdges: [number, number][] = []
  let cnt = 0
  floors.forEach(iz => {
    for (let iy = 0; iy < npy; iy++) {
      for (let ix = 0; ix < nbx; ix++) {
        const A = nodeAt(ix, iy, iz - 1), B = nodeAt(ix + 1, iy, iz)
        if (A && B) {
          const id = S.model.nextEid!++
          a[id] = { TYPE: 'BEAM', MATL: 1, SECT: sid, NODE: [A.id, B.id], ANGLE: 0, STYPE: 0 }
          newRecs.push({ id, type: 'brace', sect: sid, b: building, iz, n1: A.id, n2: B.id })
          newEdges.push([A.id, B.id]); cnt++
        }
      }
    }
  })
  if (!cnt) throw new Error(t('e_nobrace'))
  await mapi('PUT', 'elem', { Assign: a })
  log(tl('braceAdd', cnt, building + 1, floors.join(',')), 'ok')
  S.model.elemRecs.push(...newRecs)
  S.model.links = S.model.links || []
  S.model.braces = (S.model.braces || []).concat(newEdges)
  S.model.edits.push(t('act_brace', building + 1, floors.join(','), cnt))
  renderModelState(); draw3D()
  return t('act_brace', building + 1, floors.join(','), cnt)
}

export { putCombos }
