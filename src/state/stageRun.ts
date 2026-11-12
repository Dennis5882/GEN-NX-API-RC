/* 단계 상태를 액션에 묶는 래퍼 — 액션 로직은 그대로 두고 시작·끝만 기록한다 */
import { S, notify } from './store'
import * as St from './stage'

/** 전처리(모델 생성·편집) — 끝나면 성공·실패 무관하게 preEpoch++ → 해석·후처리는 오래됨 */
export async function runPre<T>(fn: () => Promise<T>): Promise<T> {
  St.begin(S.stage, 'pre'); notify()
  try {
    const r = await fn()
    St.prePassed(S.stage, true)
    return r
  } catch (e: any) {
    St.prePassed(S.stage, false, e?.message)
    throw e
  } finally { St.end(S.stage, 'pre'); notify() }
}

/** 솔버 — 정적은 반환 시 성공, 동적은 본문이 solveDone/solveFail 로 직접 판정(거부 메시지가 throw 가 아님) */
export async function runSolve<T>(kind: St.SolveKind, fn: () => Promise<T>, autoPass = true): Promise<T> {
  St.begin(S.stage, 'solve'); notify()
  try {
    const r = await fn()
    if (autoPass) St.solvePassed(S.stage, kind)
    return r
  } catch (e: any) {
    St.solveFailed(S.stage, e?.message)
    throw e
  } finally { St.end(S.stage, 'solve'); notify() }
}

export function solveDone(kind: St.SolveKind): void { St.solvePassed(S.stage, kind); notify() }
export function solveFail(msg: string): void { St.solveFailed(S.stage, msg); notify() }

/** 후처리 항목 — 실제 결과를 만들었을 때만 postDone 호출(미지원·선행조건 미충족 안내는 완료 아님) */
export async function runPost<T>(fn: () => Promise<T>): Promise<T> {
  St.begin(S.stage, 'post'); notify()
  try { return await fn() } catch (e: any) { St.postFailed(S.stage, e?.message); throw e } finally { St.end(S.stage, 'post'); notify() }
}
export function postDone(item: St.PostItem): void { St.postPassed(S.stage, item); notify() }

/** 모델 비우기 — 단계 상태 초기화 */
export function resetStage(): void { S.stage = St.initStage(); notify() }
