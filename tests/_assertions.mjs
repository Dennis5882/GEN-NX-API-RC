/* 기존 상대오차(절대오차 하한 포함)와 엄격 동등 비교를 각각 Vitest 테스트로 등록한다. */
import { expect, it } from 'vitest'

export function ok(name, actual, expected, tolerance = 1e-3) {
  it(name, () => {
    expect(Math.abs(actual - expected)).toBeLessThanOrEqual(
      tolerance * Math.max(1, Math.abs(expected)),
    )
  })
}

export function eq(name, actual, expected) {
  it(name, () => {
    expect(actual === expected).toBe(true)
  })
}
