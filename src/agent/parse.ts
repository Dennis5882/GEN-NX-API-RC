/* ════════════════════════════════════════════════════════════
   NL PARSER (LOCAL mode) — parseCommand(txt) → {intent, ...params}. 바닐라 1:1.
   인텐트: help · tab · conn_check · clear · build · modify_section · resize_subset ·
          add_load · add_bracing · change_spec · dynamic · analyze · result · status · unknown
════════════════════════════════════════════════════════════ */
import { RC, type BuildingSpec } from '../engine'
import { profileOf } from '../codes'
import { S, type ResultTab } from '../state/store'

export type Command =
  | { intent: 'help' | 'release_notes' | 'conn_check' | 'clear' | 'analyze' | 'status' | 'review' | 'unknown' }
  | { intent: 'tab'; which: '3d' | 'result' | 'log' | 'model' }
  | { intent: 'build'; params: BuildingSpec }
  | { intent: 'modify_section'; target: 'col' | 'beam'; H: number; B: number }
  | { intent: 'resize_subset'; target: 'col' | 'beam'; H: number; B: number; floors: number[] }
  | { intent: 'add_load'; name: string; type: string; floor: number; fz: number }
  | { intent: 'add_bracing'; building: number; floors: number[] | null }
  | { intent: 'change_spec'; field: 'matName' | 'hTyp' | 'stories'; value: string | number }
  | { intent: 'dynamic'; rs: boolean }
  | { intent: 'result'; which: ResultTab }

/* ── 간체 → 번체 정규화 — zh-CN 입력을 기존 번체 정규식으로 인식 ──
   간체 전용 글자만 바꾸므로 ko/en/zh-TW 입력은 영향 없음. 글자표는 OpenCC s2t 로 생성(為 는 대만 자형으로 보정).
   키워드를 추가할 때 정규식에는 번체만 쓰면 된다. */
const ZH_S2T_PAIRS = '业業个個为為内內况況刚剛创創删刪办辦动動医醫卖賣变變号號吗嗎场場学學实實层層应應开開弯彎强強态態恒恆执執挠撓撑撐数數构構栋棟楼樓点點状狀现現疗療盖蓋确確筑築线線统統维維缩縮补補装裝视視计計认認说說谱譜货貨质質购購载載运運连連间間静靜风風'
const ZH_S2T: Record<string, string> = Object.fromEntries(
  Array.from({ length: ZH_S2T_PAIRS.length / 2 }, (_, i) => [ZH_S2T_PAIRS[i * 2], ZH_S2T_PAIRS[i * 2 + 1]]))
/* 대륙식 어휘 → 대만식(정규식 기준) — 글자 정규화 뒤 적용 */
const ZH_WORDS: [string, string][] = [
  ['創建', '建立'], ['添加', '新增'], ['運行', '執行'], ['層高', '樓高'], ['振型', '振態'],
  ['特征', '特徵'], ['框架', '構架'], ['活荷載', '活載重'], ['確認連接', '確認連線'], ['連接確認', '連線確認'], ['連接狀態', '連線狀態'],
]

export function normalizeZh(t: string): string {
  let s = t.replace(/[\u4e00-\u9fff]/g, c => ZH_S2T[c] ?? c)
  for (const [a, b] of ZH_WORDS) s = s.split(a).join(b)
  return s
}

function num(re: RegExp, txt: string): number | null {
  const m = txt.match(re); if (!m) return null
  const v = m.slice(1).find(g => g != null)
  return v != null ? parseFloat(v.replace(/,/g, '')) : null
}

function range(a: number, b: number): number[] {
  const r: number[] = []
  for (let i = Math.min(a, b); i <= Math.max(a, b); i++) r.push(i)
  return r
}

/* 층 인식 — 한국어(층) / 中文(樓·層) / English(floor·story·F) */
export function parseFloors(t: string): number[] {
  let m: RegExpMatchArray | null
  m = t.match(/(\d+)\s*[~\-]\s*(\d+)\s*(?:층|樓|層)/); if (m) return range(+m[1], +m[2])
  m = t.match(/floors?\s*(\d+)\s*(?:[~\-]|to)\s*(\d+)/); if (m) return range(+m[1], +m[2])
  m = t.match(/(\d+)\s*[~\-]\s*(\d+)\s*floors?/); if (m) return range(+m[1], +m[2])
  m = t.match(/((?:\d+\s*,\s*)+\d+)\s*(?:층|樓|層)/); if (m) return m[1].split(/\s*,\s*/).map(Number)
  m = t.match(/(?:第\s*)?(\d+)\s*(?:층|樓|層)/); if (m) return [+m[1]]
  m = t.match(/floors?\s*(\d+)/); if (m) return [+m[1]]
  m = t.match(/(\d+)\s*(?:st|nd|rd|th)\s*floor/); if (m) return [+m[1]]
  return []
}

export function parseCommand(txt: string): Command {
  const t = normalizeZh(txt.toLowerCase())
  const hasModel = S.model && S.model.nodes && S.model.nodes.length > 0
  /* ── 최우선: 뷰·도움말·연결 확인 (모델 여부 무관) ── */
  if (/릴리[즈스]\s*노트|변경\s*(?:이력|내역)|release\s*notes?|changelog|版本(?:紀錄|記錄|說明)|更新(?:紀錄|記錄|日誌|日志)/.test(t)) return { intent: 'release_notes' }
  if (/도움말|매뉴얼|메뉴얼|뭘\s*할|어떻게\s*써|어떤\s*명령|使用說明|使用手[冊册]|用[戶户]手[冊册]|指令說明|help|manual|what\s*can|commands?\s*list/.test(t))
    return { intent: 'help' }
  if (/3[dD]|3디|입체|삼차원|三維|透視/.test(t)) return { intent: 'tab', which: '3d' }
  if (/결과\s*(?:탭|tab|보여)|탭.*결과|result\s*tab|tab.*result|show\s*results?\b|顯示\s*結果|显示\s*结果|結果\s*(?:分頁|頁|面板|選項卡)|结果\s*(?:选项卡|页|面板)/.test(t)) return { intent: 'tab', which: 'result' }
  if (/로그\s*(?:탭|tab|보여)|활동\s*(?:탭|tab)|log\s*tab|activity\s*tab|show\s*log|活[動动]\s*[記紀记][錄录]|[顯显]示\s*(?:[記记][錄录]|日[誌志])/.test(t)) return { intent: 'tab', which: 'log' }
  if (/모델\s*(?:탭|tab|정보|개요)|model\s*(?:tab|info|summ)|模型\s*(?:概要|資訊|資料|分頁|選項卡|选项卡)/.test(t)) return { intent: 'tab', which: 'model' }
  if (/연결\s*(?:됐|상태|확인|됩|테스트)|접속\s*됐|connected\?|conn\s*(?:status|check)|check\s*(?:the\s*)?connection|connection\s*(?:status|check)|連線\s*(?:了嗎|狀態|確認)|確認\s*連線/.test(t))
    return { intent: 'conn_check' }
  if (/초기화|모두\s*삭제|비우|清除|清空|重置|初始化|全部刪除|刪除全部|clear|reset/.test(t)) return { intent: 'clear' }
  if (hasModel) {
    const isEdit = /키워|키우|늘려|줄여|바꿔|변경|수정|추가|보강|加大|放大|增大|加粗|加強|縮小|改成|改為|變更|修改|新增|增加|補強|加上|加裝|change|resize|modify|add|increase|enlarge|bigger|larger|reduce|smaller|set|make/.test(t)
    const size = t.match(/(\d{3,4})\s*[x×]\s*(\d{3,4})/)
    const floors = parseFloors(t)
    if (/가새|브레이싱|斜撐|交叉撐|斜撐構材|支撐|brace|bracing/.test(t)) {
      const bld = (num(/(\d+)\s*동|第?\s*(\d+)\s*棟|building\s*(\d+)/, t) || 1)
      return { intent: 'add_bracing', building: Math.max(0, bld - 1), floors: floors.length ? floors : null }
    }
    if ((/하중|載重|荷載|風力|風載|활하중|活載重|活載|靜載|恆載|풍하중|load/.test(t)) && isEdit) {
      const fz = num(/(\d+)\s*(?:kn|n|뉴턴|牛頓|公斤|kg)?/, t)
      const fl = floors.length ? floors[0] : (S.model.spec ? S.model.spec.stories : 1)
      const isWind = /풍|風力|風載|風|wind/.test(t), isLive = /활하중|活載重|活載|live/.test(t)
      return { intent: 'add_load', name: isWind ? 'WIND' : isLive ? 'LL' : 'ADD', type: isWind ? 'W' : isLive ? 'L' : 'U',
        floor: fl, fz: -(fz && fz > 10 ? fz : 5000) }
    }
    const isCol = /기둥|컬럼|柱|column/.test(t)
    const isBeam = /거더|梁|大梁|beam|girder/.test(t) || /(?:^|[\s\d])보(?:[\s\d으로]|$)/.test(t)
    if (isEdit && (isCol || isBeam)) {
      const target = isCol ? 'col' : 'beam'
      let H: number, B: number
      const sqm = t.match(/(?:기둥|컬럼|柱|column|보|梁|beam|girder)\s+(\d{3,4})(?!\s*[x×\d])/)
      if (size) { H = +size[1]; B = +size[2] }
      else if (sqm) { const s = +sqm[1]; H = s; B = s }
      else { const cur = S.model.sections[target === 'col' ? 1 : 2]; H = (cur?.H || 600) + 100; B = (cur?.B || 600) + 100 }
      if (floors.length) return { intent: 'resize_subset', target, H, B, floors }
      return { intent: 'modify_section', target, H, B }
    }
    /* 스펙 수정 후 재생성 — 재료·층고·층수 */
    if (isEdit && S.model.spec) {
      /* 재료 = 모델 자신의 기준 카탈로그에 있는 이름만 (TW C280·C350… / GB C30·C40…) */
      const matM = t.match(/(c\d{2,3})(?!\d)/)
      if (matM && /재료|材料|材質|콘크리트|concrete|material/.test(t) && profileOf(S.model.spec).materials[matM[1].toUpperCase()])
        return { intent: 'change_spec', field: 'matName', value: matM[1].toUpperCase() }
      /* 숫자가 뒤에 오는 문장도(樓高改為 3500 · floor height to 3500) — 키워드와 숫자 사이 '改為/to/=' 등 허용 */
      const HT = '(?:층고|樓高|層高|(?:story|floor)\\s*height)'
      const htMm = num(new RegExp(`${HT}\\D{0,8}?(\\d{4})(?!\\s*m(?!m))`), t) || num(/층고\s*(\d{3,5})/, t)
      const htMobj = t.match(new RegExp(`${HT}\\D{0,8}?(\\d+\\.?\\d*)\\s*m(?!m)`))
      const htVal = htMm || (htMobj ? Math.round(+htMobj[1] * 1000) : null)
      if (htVal && htVal >= 2000 && htVal <= 8000 && /층고|樓高|層高|height/.test(t))
        return { intent: 'change_spec', field: 'hTyp', value: htVal }
      const nsM = num(/(\d+)\s*(?:층|樓|層)/, t) || num(/(\d+)\s*stor/, t) || num(/(?:층수|樓層數|層數|stories)\D{0,8}?(\d+)/i, t)
      if (nsM && nsM >= 1 && nsM <= 100 && /층수|층.*(?:바꿔|변경)|樓層.*(?:改|變)|層數.*(?:改|變)|stories?\s*(?:to|change)|change\s*stories/i.test(t))
        return { intent: 'change_spec', field: 'stories', value: nsM }
    }
  }
  /* M2-A4: 동적해석(고유치·응답스펙트럼) — '해석'을 포함하므로 analyze 보다 먼저 판정 */
  /* 심사 지표(审图) — normalizeZh 글자표에 审·图·标 이 없어 간체를 직접 나열 */
  if (/심사|검토\s*지표|審圖|审图|審查|审查|指標|指标|review\s*(indicator|check)?s?/i.test(t)) return { intent: 'review' }
  if (/동적\s*해석|고유치|고유\s*주기|모드\s*해석|진동\s*주기|응답\s*스펙트럼|반응\s*스펙트럼|動力分析|特徵值|振態|反應譜|週期|dynamic|eigen|modal|mode\s*shape|response\s*spectrum/i.test(t)) {
    const rs = /응답\s*스펙트럼|반응\s*스펙트럼|反應譜|response\s*spectrum|spectrum/i.test(t)
    return { intent: 'dynamic', rs }
  }
  if (/해석|분석|돌려|실행|分析|計算|執行|跑一下|跑|solve|analy|run/.test(t) && !/만들|생성|모델링|建立|生成|建模|建造|create|build/.test(t))
    return { intent: 'analyze' }
  if (/변위|처짐|變位|位移|撓度|displacement|deflect/.test(t)) return { intent: 'result', which: 'disp' }
  if (/반력|지점|反力|支承反力|支點|reaction/.test(t)) return { intent: 'result', which: 'react' }
  if (/휨\s*모멘트|bending\s*moment|彎矩/.test(t)) return { intent: 'result', which: 'moment' }
  if (/부재력|모멘트|전단|桿件內力|構材內力|內力|剪力|force|moment|shear/.test(t)) return { intent: 'result', which: 'force' }
  if (/상태|요약|현재|狀態|摘要|目前|現況|status|summary/.test(t)) return { intent: 'status' }
  const bldgType = RC.detectBuildingType(t)
  if (/만들|생성|모델링|세워|짓|建立|生成|建模|建造|蓋|做一個|做個|create|build/.test(t) || bldgType || /건물|골조|프레임|建築|構架|構架系統|剛架|frame|building/.test(t)) {
    const p: BuildingSpec = bldgType ? { ...RC.BUILDING_TYPES[bldgType], bldgType } as BuildingSpec : { ...RC.DEFAULT_SPEC, bldgType: null }
    const stories = num(/(\d+)\s*(?:층|樓|層)/, t) || num(/(\d+)\s*stor/, t); if (stories) p.stories = stories
    const bld = num(/(\d+)\s*동|(\d+)\s*棟|(\d+)\s*building/, t); if (bld) p.buildings = bld
    const bx = num(/(\d+)\s*(?:베이|跨|開間|bay)/, t); if (bx) p.bayX = bx
    let by = num(/(?:x|×)\s*(\d+)\s*(?:베이|跨|開間|bay)/, t)
    if (!by && bx) { const mm = t.match(/(?:베이|跨|開間|bay)\s*[x×]\s*(\d+)/); if (mm) by = +mm[1] }
    if (by) p.bayY = by
    const col = t.match(/(?:기둥|柱|column)\s*(\d+)\s*[x×]\s*(\d+)/)
    if (col) { const h = +col[1], b = +col[2]; p.colH = h; p.colB = b; p.colName = `C${h}x${b}` }
    else { const colSq = t.match(/(?:기둥|柱|column)\s+(\d{3,4})(?!\s*[x×\d])/); if (colSq) { const s = +colSq[1]; p.colH = s; p.colB = s; p.colName = `C${s}x${s}` } }
    const bm = t.match(/(?:보|梁|beam)\s*(\d+)\s*[x×]\s*(\d+)/)
    if (bm) { const h = +bm[1], b = +bm[2]; p.beamH = h; p.beamB = b; p.beamName = `B${b}x${h}` }
    else { const bmSq = t.match(/(?:보|梁|beam)\s+(\d{3,4})(?!\s*[x×\d])/); if (bmSq) { const s = +bmSq[1]; p.beamH = s; p.beamB = s; p.beamName = `B${s}x${s}` } }
    const span = num(/스팬\s*(\d+)|跨距\s*(\d+)|跨度\s*(\d+)|span\s*(\d+)/, t); if (span) { p.spanX = span; p.spanY = span }
    else { const spanM = t.match(/(?:스팬|跨距|跨度|span)\s*(\d+\.?\d*)\s*m(?!m)/); if (spanM) { const v = Math.round(+spanM[1] * 1000); p.spanX = v; p.spanY = v } }
    const gap = num(/간격\s*(\d+)|間距\s*(\d+)|gap\s*(\d+)/, t); if (gap) p.gap = gap
    const pod = num(/기단부\s*(\d+)|裙樓\s*(\d+)|裙房\s*(\d+)|podium\s*(\d+)/, t); if (pod) p.podium = pod
    const cf = num(/(\d+)\s*(?:층|樓|層)\s*(?:에서|處)?\s*(?:연결|連接)|connect\D*(\d+)/, t); if (cf) p.connectFloor = cf
    /* 층고 — 미터 단위 지원 (e.g. "층고 3.5m" → 3500) */
    const htBM = t.match(/(?:층고|樓高|floor\s*height)\s*(\d+\.?\d*)\s*m(?!m)/)
    const htBMM = num(/(?:층고|樓高|floor\s*height)\s*(\d{3,5})/, t)
    const htBVal = htBMM || (htBM ? Math.round(+htBM[1] * 1000) : null)
    if (htBVal && htBVal >= 2000 && htBVal <= 8000) p.hTyp = htBVal
    if (p.buildings >= 2 && !p.gap) p.gap = 14000
    if (p.buildings >= 2 && !p.connectFloor) p.connectFloor = Math.max(1, Math.round(p.stories * 0.8))
    return { intent: 'build', params: p }
  }
  return { intent: 'unknown' }
}
