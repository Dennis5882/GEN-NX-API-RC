/* 단계 상태 — 전처리(모델 생성·편집) · 솔버(해석) · 후처리(심사 지표 등).
   불리언을 직접 뒤집지 않고 "무엇을 기준으로 만들어졌는가"를 에포크로 기록해 낡음을 계산한다.
   v1 규칙(docs/stage-ui-plan.md 4.2): 앞 단계가 바뀌면 뒤 단계 전부 오래됨.
   앱이 실행한 동작만 안다 — Gen GUI 에서 직접 바꾼 것은 감지하지 못함(표시줄에 안내). */

export type StageKey = 'pre' | 'solve' | 'post'
export type StageStatus = 'none' | 'fresh' | 'stale' | 'running' | 'failed'
export type SolveKind = 'static' | 'dynamic'
export type PostItem = 'review'

export interface StageState {
  /** 모델 생성·편집이 일어날 때마다 ++ (성공·실패 무관 — Gen 모델이 바뀌었을 수 있음) */
  preEpoch: number
  preDone: boolean
  /** 해석이 성공할 때마다 ++ */
  solveEpoch: number
  solveDone: boolean
  /** 마지막 성공 해석이 기준으로 한 preEpoch */
  solveBasedOn: number
  solveKind: SolveKind | null
  /** 후처리 항목별 — 기준으로 한 solveEpoch */
  post: Partial<Record<PostItem, number>>
  /** 실행 중 단계(중첩 가능: 동적해석 안의 심사) */
  running: StageKey[]
  error: Partial<Record<StageKey, string>>
  /** 이번 해석 실행에서 이미 성공 처리했는지 — 동적해석이 끝나기 전에 심사를 돌릴 때 이중 증가 방지 */
  solveMarked: boolean
}

export function initStage(): StageState {
  return { preEpoch: 0, preDone: false, solveEpoch: 0, solveDone: false, solveBasedOn: -1, solveKind: null, post: {}, running: [], error: {}, solveMarked: false }
}

export interface StageView {
  pre: StageStatus
  solve: StageStatus
  post: StageStatus
  solveKind: SolveKind | null
  postItems: Partial<Record<PostItem, StageStatus>>
}

/** 순수 판정 — 전이표는 tests/stage.test.mjs 가 전수 검증 */
export function stageStatus(st: StageState): StageView {
  const run = (k: StageKey) => st.running.includes(k)
  const pre: StageStatus = run('pre') ? 'running' : st.error.pre ? 'failed' : st.preDone ? 'fresh' : 'none'
  let solve: StageStatus
  if (run('solve')) solve = 'running'
  else if (st.error.solve) solve = 'failed'
  else if (!st.solveDone) solve = 'none'
  else solve = st.solveBasedOn === st.preEpoch ? 'fresh' : 'stale'
  const postItems: Partial<Record<PostItem, StageStatus>> = {}
  for (const [k, basedOn] of Object.entries(st.post) as [PostItem, number][]) {
    postItems[k] = basedOn === st.solveEpoch && solve === 'fresh' ? 'fresh' : 'stale'
  }
  const vals = Object.values(postItems)
  let post: StageStatus
  if (run('post')) post = 'running'
  else if (st.error.post) post = 'failed'
  else if (!vals.length) post = 'none'
  else post = vals.includes('stale') ? 'stale' : 'fresh'
  return { pre, solve, post, solveKind: st.solveKind, postItems }
}

/* ── 전이 (store 와 분리한 순수 변경 — 액션 쪽 래퍼가 notify) ── */

export function begin(st: StageState, k: StageKey): void {
  st.running.push(k)
  delete st.error[k]
  if (k === 'solve') st.solveMarked = false
}

export function end(st: StageState, k: StageKey): void {
  const i = st.running.lastIndexOf(k)
  if (i >= 0) st.running.splice(i, 1)
}

/** 전처리 동작이 끝남 — 성공이면 모델 있음, 실패면 모델 상태 불명 */
export function prePassed(st: StageState, ok: boolean, msg?: string): void {
  st.preEpoch++
  st.preDone = ok
  if (ok) delete st.error.pre
  else st.error.pre = msg || 'failed'
}

export function solvePassed(st: StageState, kind: SolveKind): void {
  if (st.solveMarked) return
  st.solveMarked = true
  st.solveEpoch++
  st.solveDone = true
  st.solveBasedOn = st.preEpoch
  st.solveKind = kind
  delete st.error.solve
}

export function solveFailed(st: StageState, msg: string): void {
  st.solveDone = false
  st.error.solve = msg || 'failed'
}

export function postPassed(st: StageState, item: PostItem): void {
  st.post[item] = st.solveEpoch
  delete st.error.post
}

export function postFailed(st: StageState, msg: string): void {
  st.error.post = msg || 'failed'
}
