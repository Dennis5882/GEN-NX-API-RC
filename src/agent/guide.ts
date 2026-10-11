/* GUIDE 패널 데이터 (label/cmd/note 모두 3개 언어). send:true = 클릭 시 즉시 전송 */
import type { Lang } from '../i18n/types'

type L3 = Record<Lang, string>
const G = (ko: string, en: string, zh: string): L3 => ({ ko, en, zh })

export type GuideItem =
  | { div: true }
  | { note: L3 }
  | { icon: string; label: L3; cmd: L3; send?: boolean }

export interface GuideSection { id: string; icon: string; open: boolean; label: L3; items: GuideItem[] }

export const GUIDE: GuideSection[] = [
  { id: 'build', icon: '⊞', open: true, label: G('모델 생성', 'Build', '建立模型'), items: [
    { icon: '🏠', label: G('주거 15층', 'Residential 15F', '住宅 15 層'), cmd: G('주거 15층 만들어', 'build 15 story residential', '建立 15 層住宅') },
    { icon: '🏢', label: G('사무 10층', 'Office 10F', '辦公 10 層'), cmd: G('사무 10층 만들어', 'build 10 story office', '建立 10 層辦公') },
    { icon: '🏬', label: G('상가 6층', 'Commercial 6F', '商場 6 層'), cmd: G('상가 6층 만들어', 'build 6 story mall', '建立 6 層商場') },
    { icon: '🏥', label: G('병원 8층', 'Hospital 8F', '醫院 8 層'), cmd: G('병원 8층 만들어', 'build 8 story hospital', '建立 8 層醫院') },
    { icon: '🏫', label: G('학교 5층', 'School 5F', '學校 5 層'), cmd: G('학교 5층 만들어', 'build 5 story school', '建立 5 層學校') },
    { div: true },
    { icon: '🏗', label: G('자유 골조', 'Custom frame', '自訂構架'), cmd: G('자유골조 10층 만들어', 'build a 10 story custom frame', '建立 10 層自訂構架') },
    { note: G('클릭하면 입력창에 채워집니다 → Enter → 편집 카드(표준층 표)에서 정밀 수정', 'Click to fill the input → Enter → fine-tune in the editable card (typical-floor table)', '點選後填入輸入框 → Enter → 於可編輯卡（標準層表）精細調整') },
  ] },
  { id: 'section', icon: '◫', open: true, label: G('단면·스펙 수정', 'Section / Spec', '斷面·規格修改'), items: [
    { icon: '↕', label: G('기둥 전체 변경', 'Resize all columns', '全部柱變更'), cmd: G('기둥 700x700으로 변경', 'change all columns to 700x700', '柱改為 700x700') },
    { icon: '↕', label: G('N층 기둥 변경', 'Resize floor columns', '指定樓層柱'), cmd: G('3층 기둥 700x700으로 키워', 'enlarge floor 3 columns to 700x700', '第 3 樓柱加大為 700x700') },
    { icon: '↕', label: G('층 범위 기둥', 'Floor-range columns', '樓層範圍柱'), cmd: G('1~3층 기둥 키워', 'enlarge floors 1-3 columns', '1~3 樓柱加大') },
    { icon: '↔', label: G('보 전체 변경', 'Resize all beams', '全部梁變更'), cmd: G('보 400x700으로 변경', 'change all beams to 400x700', '梁改為 400x700') },
    { div: true },
    { icon: '🔢', label: G('층수 변경', 'Change stories', '變更樓層數'), cmd: G('층수 20층으로 바꿔', 'change stories to 20', '樓層數改為 20') },
    { icon: '📐', label: G('층고 변경', 'Change floor height', '變更樓高'), cmd: G('층고 3500으로 바꿔', 'change floor height to 3500', '樓高改為 3500') },
    { icon: '🧱', label: G('재료 변경', 'Change material', '變更材料'), cmd: G('재료 C350으로 바꿔', 'change material to C350', '材料改為 C350') },
    { note: G('숫자를 원하는 값으로 고친 뒤 전송. 스펙 변경 시 재생성 확인 카드가 표시됩니다.', 'Edit numbers then send. Spec changes show a rebuild-confirm card.', '修改數字後送出。規格變更時將顯示重建確認卡。') },
  ] },
  { id: 'load', icon: '⬇', open: true, label: G('하중·보강', 'Load · Brace', '載重·補強'), items: [
    { icon: '↓', label: G('활하중 추가', 'Add live load', '新增活載重'), cmd: G('옥상에 활하중 5000N 추가', 'add 5000N live load on roof', '屋頂新增活載重 5000N') },
    { icon: '↓', label: G('풍하중 추가', 'Add wind load', '新增風力'), cmd: G('풍하중 추가', 'add wind load', '新增風力') },
    { icon: '✕', label: G('가새 추가 (1동)', 'Add bracing (B1)', '新增斜撐 (1棟)'), cmd: G('1동 가새 추가', 'add bracing to building 1', '第 1 棟新增斜撐') },
    { icon: '✕', label: G('특정 층 가새', 'Bracing on floor', '指定樓層斜撐'), cmd: G('1동 3층 가새 추가', 'add bracing building 1 floor 3', '第 1 棟 3 樓新增斜撐') },
  ] },
  { id: 'analysis', icon: '∑', open: true, label: G('해석·결과', 'Analysis', '分析·結果'), items: [
    { icon: '▷', label: G('정적 해석 실행', 'Run analysis', '執行靜力分析'), cmd: G('해석 돌려', 'run analysis', '執行分析'), send: true },
    { icon: '▷', label: G('최대 변위 조회', 'Max displacement', '查詢最大變位'), cmd: G('최대 변위 알려줘', 'show max displacement', '查詢最大變位'), send: true },
    { icon: '▷', label: G('지점 반력 조회', 'Reactions', '查詢支承反力'), cmd: G('반력 알려줘', 'show reactions', '查詢反力'), send: true },
    { icon: '▷', label: G('부재력 조회', 'Member forces', '查詢桿件內力'), cmd: G('부재력 보여줘', 'show member forces', '顯示桿件內力'), send: true },
    { icon: '▷', label: G('상태 요약', 'Status summary', '目前狀態摘要'), cmd: G('상태 요약', 'status summary', '狀態摘要'), send: true },
    { div: true },
    { icon: '◈', label: G('3D 뷰로 이동', 'Go to 3D view', '切換 3D 視圖'), cmd: G('3D 보여줘', 'show 3D', '顯示 3D'), send: true },
  ] },
  { id: 'misc', icon: '⊟', open: false, label: G('모델 관리', 'Manage', '模型管理'), items: [
    { icon: '↺', label: G('모델 초기화', 'Clear model', '清除模型'), cmd: G('초기화', 'clear', '清除') },
    { div: true },
    { icon: '❓', label: G('도움말', 'Help', '使用說明'), cmd: G('도움말', 'help', '使用說明'), send: true },
    { icon: '◉', label: G('연결 확인', 'Check connection', '確認連線'), cmd: G('연결 확인', 'check connection', '確認連線'), send: true },
  ] },
]
