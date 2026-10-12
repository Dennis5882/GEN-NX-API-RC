/* ════════════════════════════════════════════════════════════
   STATE — 바닐라 전역 S 를 그대로 옮긴 외부 store.
   액션은 S 를 직접 변경한 뒤 notify() — React 는 useStore() 로 구독(version 기반 재렌더).
   액션 로직을 바닐라와 1:1 로 유지하기 위한 의도적 설계(mutable store).
════════════════════════════════════════════════════════════ */
import type { ReviewItem } from '../codes/types'
import { useSyncExternalStore } from 'react'
import { DEFAULT_LANG, normalizeLang, type Lang } from '../i18n/types'
import type { BuildingSpec } from '../engine/types'
import type { CodeId } from '../codes/types'

export type PanelId = 'logP' | 'modelP' | 'viewP' | 'resP'
export type ResultTab = 'react' | 'disp' | 'force' | 'moment'
export type Provider = 'claude' | 'gemini' | 'gpt' | 'deepseek'
export type LogType = 'api' | 'ok' | 'err' | 'info' | 'warn'

export interface Table { head: string[]; data: string[][] }

export interface ElemRec {
  id: number
  type: 'col' | 'beam' | 'link' | 'wall' | 'brace'
  sect: number
  matl?: number
  b: number
  iz: number
  n1?: number
  n2?: number
  nodes?: number[]
}

export interface Node3 { id: number; x: number; y: number; z: number }
export type Edge = [number, number]

export interface ModelState {
  matl: string | null
  colSect: string | null
  beamSect: string | null
  nodes: Node3[]
  cols: Edge[]
  beams: Edge[]
  links: Edge[]
  braces?: Edge[]
  walls?: any[]
  baseNodes: number[]
  elev: number[]
  loadCases: { name: string; type: string }[]
  /** 조합에 쓸 응답스펙트럼 케이스 (주 해석 = RS 일 때, actDynamic 이 등록) */
  rsCases?: { name: string; type: string }[]
  spec: BuildingSpec | null
  elemRecs: ElemRec[]
  edits: string[]
  sections: Record<number, { name: string; H: number; B: number }>
  secReg?: any
  materials?: string[]
  nextEid?: number
  nextSect?: number
  nextMat?: number
  nextLC?: number
  floorGroups?: any
  combos?: string[]
  seismic?: { T: number; Cs: number; V: number; Wtot: number } | null
  wind?: { Vx: number; Vy: number; V10: number } | null
  dynamic?: any
  sseisQA?: any
  swindQA?: any
}

export interface LogEntry { id: number; ts: string; type: LogType; html: string }

/** 채팅 메시지 — html(일반) / plan(건물 확인·편집 카드) / thinking(대기 표시) */
export type ChatMsg =
  | { id: number; role: 'user' | 'bot'; kind: 'html'; html: string }
  | { id: number; role: 'bot'; kind: 'thinking' }
  | {
      id: number; role: 'bot'; kind: 'plan'
      intro: string           // plan_intro_tpl / plan_intro_custom
      spec: BuildingSpec
      editable: boolean       // 자유골조 → 처음부터 편집 카드
      buildId: number
      epoch: number           // 생성 시점 buildEpoch — 실행되면 모든 카드 버튼 제거
    }

export interface ConvTurn {
  role: 'user' | 'assistant' | 'tool'
  text?: string
  calls?: { id: string; name: string; args: any }[]
  results?: { id: string; name: string; output: string }[]
  reasoning?: string   // DeepSeek reasoning_content (재전송 필수)
  raw?: any[]          // Gemini 원본 parts (thoughtSignature 보존)
}

function emptyModel(): ModelState {
  return {
    matl: null, colSect: null, beamSect: null, nodes: [], cols: [], beams: [], links: [],
    baseNodes: [], elev: [], loadCases: [], spec: null, elemRecs: [], edits: [], sections: {},
  }
}

/** 설계기준 — 저장값 우선, 없으면 언어로 추정(zh-CN → CN, 그 외 TW) */
function readCode(lang: Lang): CodeId {
  try {
    const c = localStorage.getItem('nx_code')
    if (c === 'TW' || c === 'CN') return c
  } catch { /* storage 차단 */ }
  return lang === 'zh-CN' ? 'CN' : 'TW'
}

function readLang(): Lang {
  try {
    return normalizeLang(localStorage.getItem('nx_lang')) ?? DEFAULT_LANG
  } catch { /* storage 차단 환경 */ }
  return DEFAULT_LANG
}

const initLang = readLang()

export const S = {
  lang: initLang,
  /* MIDAS API — MAPI-Key 는 메모리에만(저장 금지) */
  baseUrl: 'https://moa-engineers.midasit.com:443/gen',
  mapiKey: '',
  connected: false,
  connErr: false,
  program: '',
  apiUser: '',
  /* LLM — 키는 메모리에만 */
  llm: false,
  provider: 'claude' as Provider,
  provKey: '',
  provModel: 'claude-sonnet-5-5',
  conv: [] as ConvTurn[],
  /* 설계기준 (UI 언어와 독립) */
  code: readCode(initLang),
  /** 사용자가 기준을 직접 고른 적 있는지 — 없으면 언어 변경을 따라감 */
  codeChosen: (() => { try { return localStorage.getItem('nx_code') != null } catch { return false } })(),
  /* 모델·결과 */
  model: emptyModel(),
  results: { react: null as Table | null, disp: null as Table | null, force: null as Table | null },
  /* 대화형 빌드 카드 */
  pendingBuild: null as BuildingSpec | null,
  pendingBuildId: 0,
  buildEpoch: 0,
  /* UI */
  panel: 'logP' as PanelId,
  resultTab: 'react' as ResultTab,
  /** 심사 지표(审图) — 동적해석 뒤 기준 프로필 review 훅이 채움. 새 빌드 시 초기화 */
  review: null as null | { items: ReviewItem[]; rs: boolean },
  preview: null as BuildingSpec | null,   // 3D 미리보기 스펙(null = 현재 모델 표시)
  viewNonce: 0,                           // 3D 재플롯 트리거
  busy: false,
  log: [] as LogEntry[],
  msgs: [] as ChatMsg[],
}
export type AppState = typeof S

let version = 0
const listeners = new Set<() => void>()

export function notify(): void {
  version++
  listeners.forEach(l => l())
}

const getVersion = (): number => version

function subscribe(l: () => void): () => void {
  listeners.add(l)
  return () => { listeners.delete(l) }
}

/** S 전체를 구독 — 변경(notify) 시 재렌더. 반환값은 S 자체(가변). */
export function useStore(): AppState {
  useSyncExternalStore(subscribe, getVersion, getVersion)
  return S
}

export function resetModel(): void {
  S.model = emptyModel()
}

let seq = 0
export const nextId = (): number => ++seq
