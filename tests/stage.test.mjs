/* 단계 상태 전이표 — src/state/stage.ts (docs/stage-ui-plan.md 4.2 v1 규칙: 앞 단계가 바뀌면 뒤 단계 전부 오래됨) */
import { describe, it, expect } from 'vitest'
import * as St from '../src/state/stage.ts'

const view = st => { const v = St.stageStatus(st); return [v.pre, v.solve, v.post] }
const build = st => { St.begin(st, 'pre'); St.prePassed(st, true); St.end(st, 'pre') }
const solve = (st, kind = 'static') => { St.begin(st, 'solve'); St.solvePassed(st, kind); St.end(st, 'solve') }
const review = st => { St.begin(st, 'post'); St.postPassed(st, 'review'); St.end(st, 'post') }

describe('stage — 전이표', () => {
  it('초기: 전부 미실행', () => expect(view(St.initStage())).toEqual(['none', 'none', 'none']))

  it('생성 → 해석 → 심사: 전부 최신', () => {
    const st = St.initStage(); build(st); solve(st); review(st)
    expect(view(st)).toEqual(['fresh', 'fresh', 'fresh'])
  })

  it('모델 편집 → 해석·후처리 오래됨, 재해석 → 해석 최신·후처리 오래됨, 재심사 → 전부 최신', () => {
    const st = St.initStage(); build(st); solve(st); review(st)
    build(st); expect(view(st)).toEqual(['fresh', 'stale', 'stale'])
    solve(st); expect(view(st)).toEqual(['fresh', 'fresh', 'stale'])
    review(st); expect(view(st)).toEqual(['fresh', 'fresh', 'fresh'])
  })

  it('실행 중 표시 — 중첩(동적해석 안의 심사)', () => {
    const st = St.initStage(); build(st)
    St.begin(st, 'solve'); expect(St.stageStatus(st).solve).toBe('running')
    St.solvePassed(st, 'dynamic')
    St.begin(st, 'post'); expect(view(st)).toEqual(['fresh', 'running', 'running'])
    St.postPassed(st, 'review'); St.end(st, 'post')
    St.solvePassed(st, 'dynamic')            // 같은 실행에서 이중 호출 — 증가하지 않아야 심사가 최신으로 남음
    St.end(st, 'solve')
    expect(view(st)).toEqual(['fresh', 'fresh', 'fresh'])
    expect(St.stageStatus(st).solveKind).toBe('dynamic')
  })

  it('해석 실패 → 실패, 다음 성공 시 해제. 실패 동안 후처리는 오래됨', () => {
    const st = St.initStage(); build(st); solve(st); review(st)
    St.begin(st, 'solve'); St.solveFailed(st, 'refused'); St.end(st, 'solve')
    expect(view(st)).toEqual(['fresh', 'failed', 'stale'])
    solve(st); expect(view(st)).toEqual(['fresh', 'fresh', 'stale'])
  })

  it('모델 생성 실패 → 전처리 실패, 해석은 오래됨(모델이 바뀌었을 수 있음)', () => {
    const st = St.initStage(); build(st); solve(st)
    St.begin(st, 'pre'); St.prePassed(st, false, 'x'); St.end(st, 'pre')
    expect(view(st).slice(0, 2)).toEqual(['failed', 'stale'])
    build(st); expect(view(st).slice(0, 2)).toEqual(['fresh', 'stale'])
  })

  it('후처리 실패 표시와 해제', () => {
    const st = St.initStage(); build(st); solve(st)
    St.begin(st, 'post'); St.postFailed(st, 'x'); St.end(st, 'post')
    expect(St.stageStatus(st).post).toBe('failed')
    review(st); expect(St.stageStatus(st).post).toBe('fresh')
  })

  it('초기화(initStage) → 전부 미실행', () => {
    const st = St.initStage(); build(st); solve(st); review(st)
    expect(view(St.initStage())).toEqual(['none', 'none', 'none'])
  })
})
