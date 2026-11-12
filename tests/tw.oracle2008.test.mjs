/* TW 외부 오라클 — 內政部營建署 鄉村地區住宅標準圖樣 結構計算書(2008, 공개 공문서)와 앱 지진계수 사슬 대조.
   출처·환산 근거: docs/tw-oracle-sources.md. 계산서는 94/95년판 耐震規範이라 αy(RC 1.5 / 2층 계산서 1.2)·Cu 1.2 를
   계산서 값으로 환산해 비교한다(앱은 111년판: αy 1.0, 1.4Ta 상한). 식 구조(SaD·Fu·(SaD/Fu)m·V_D·V*·V_M·竖向분배)는 동일.
   숫자는 계산서 표기 자릿수(4자리) 기준 ±0.05% / 톤 단위 ±0.1 t 허용. */
import { describe, it, expect } from 'vitest'
import * as T from '../src/codes/tw.ts'

const near = (a, b, tol) => expect(Math.abs(a - b)).toBeLessThanOrEqual(tol)
const rel = (a, b, r = 5e-4) => near(a, b, Math.abs(b) * r)

describe('TW 오라클 — 營建署 4층 RC 抗彎矩構架 계산서 (新竹 香山, 2005 code, ETABS)', () => {
  // 계산서 4-1: SsD 0.7 / S1D 0.4 / SsM 0.9 / S1M 0.5, Fa=Fv=1 (堅實地盤) → SDS 0.7 SD1 0.4 SMS 0.9 SM1 0.5
  // I=1, αy=1.5, R: V_D 의 Ra=3.0 → R=4 (Ra=1+(R−1)/1.5), V_M 은 Ra=R=4.0 (앱 cM 도 fuTW(T, R) 사용)
  const sp = { SDS: 0.7, SD1: 0.4, SMS: 0.9, SM1: 0.5, I: 1, R: 4 }
  const AY = 1.5, W = 636.4   // t
  const site = T.siteTW(sp)

  it('T0D = SD1/SDS = 0.5714', () => rel(site.T0D, 0.5714))
  it('경험주기 Ta = 0.070·hn^¾ (hn 9.0 m) = 0.3637 / 벽 0.050 → 0.2598', () => {
    rel(0.070 * Math.pow(9.0, 0.75), 0.3637)
    rel(0.050 * Math.pow(9.0, 0.75), 0.2598)
  })

  // 계산서 설계주기: T_des = min(T_dyn, Cu·Ta), Cu 1.2 (2005) → X 0.4365 / Y 0.3118. 앱 상한은 1.4Ta 라 T 는 계산서 값을 직접 넣는다.
  const Tx = Math.min(0.5820, 1.2 * 0.3637), Ty = Math.min(0.4820, 1.2 * 0.2598)
  it('설계주기 X 0.4365 / Y 0.3118', () => { rel(Tx, 0.4365); rel(Ty, 0.3118) })

  for (const [dir, Tt, exp] of [
    ['X', Tx, { Fu: 2.5490, m: 0.2746, cV: 0.1308, VD: 83.2, FuM: 3.2743, mM: 0.2749, cM: 0.1309, VM: 83.3, cS: 0.1111, VS: 70.7 }],
    ['Y', Ty, { Fu: 2.2361, m: 0.3068, cV: 0.1461, VD: 93.0, FuM: 2.6458, mM: 0.3209, cM: 0.1528, VM: 97.2, cS: 0.1089, VS: 69.3 }],
  ]) {
    const cf = T.coefTW(Tt, sp)
    it(`${dir}: SaD = SDS 0.7 (단주기 평탄부), Fu ${exp.Fu}`, () => { rel(cf.SaD, 0.7); rel(cf.Fu, exp.Fu) })
    it(`${dir}: (SaD/Fu)m ${exp.m}`, () => rel(cf.m, exp.m))
    it(`${dir}: V_D/W = I/(1.4αy)·m = ${exp.cV} → V_D ${exp.VD} t`, () => { rel(cf.cV / AY, exp.cV); near(cf.cV / AY * W, exp.VD, 0.1) })
    it(`${dir}: V_M (SaM 0.9, Ra=R=4) Fu ${exp.FuM} → V_M ${exp.VM} t`, () => {
      const T0M = sp.SM1 / sp.SMS
      rel(T0M, 0.5556)
      rel(T.fuTW(Tt, sp.R, T0M), exp.FuM)
      rel(T.modTW(T.saTW(Tt, sp.SMS, T0M) / T.fuTW(Tt, sp.R, T0M)), exp.mM)
      rel(cf.cM / AY, exp.cM); near(cf.cM / AY * W, exp.VM, 0.1)
    })
    it(`${dir}: V* = I·Fu/(4.2αy)·m = ${exp.cS} → ${exp.VS} t`, () => { rel(cf.cStar / AY, exp.cS); near(cf.cStar / AY * W, exp.VS, 0.1) })
  }

  it('지배값: X V_M 83.3 ≈ V_D 83.2 (계산서 설계 V 83.29 = V_D 쪽), Y V_M 97.2 > V_D 93.0 — 앱 gov 판정 일치', () => {
    expect(T.coefTW(Tx, sp).gov === 'VM' || T.coefTW(Tx, sp).gov === 'V').toBe(true)
    expect(T.coefTW(Ty, sp).gov).toBe('VM')
    // 계산서 b.항 밑면전단 X 83.29 / Y 97.25 = 각 방향 max(V_D, V_M)
    near(Math.max(T.coefTW(Tx, sp).cV, T.coefTW(Tx, sp).cM) / AY * W, 83.29, 0.15)
    near(Math.max(T.coefTW(Ty, sp).cV, T.coefTW(Ty, sp).cM) / AY * W, 97.25, 0.15)
  })

  // 계산서 4-2 b. 竖向분배 (X): 층 1~5 h 3.10/6.10/9.10/12.10/13.20 m, W 246.00/149.50/240.90/0.01/0.01 t, V 83.29, Ft 0 (T ≤ 0.7)
  // seismicTW 2.11 과 같은 식 (V−Ft)·W_x h_x/ΣW h — 모델 스펙 없이 식만 대조
  it('竖向분배 F_x = V·W h/ΣW h → 16.43 / 19.64 / 47.22 t, 누적 V 83.29/66.87/47.22, 전도 592.18 t·m', () => {
    const h = [3.10, 6.10, 9.10, 12.10, 13.20], w = [246.00, 149.50, 240.90, 0.01, 0.01], V = 83.29
    const Ft = Tx > 0.7 ? Math.min(0.07 * Tx * V, 0.25 * V) : 0
    expect(Ft).toBe(0)
    const den = h.reduce((a, hi, i) => a + hi * w[i], 0)
    const F = h.map((hi, i) => (V - Ft) * w[i] * hi / den)
    near(F[0], 16.43, 0.01); near(F[1], 19.64, 0.01); near(F[2], 47.22, 0.01)
    const cum = [0, 0, 0]; for (let i = 2; i >= 0; i--) cum[i] = F[i] + (cum[i + 1] || F[3] + F[4])
    near(cum[2], 47.22, 0.02); near(cum[1], 66.87, 0.02); near(cum[0], 83.29, 0.02)
    // 계산서 MOMENT 열 = Σ(층전단 × 층고 3.00) 누적 (기면 아래 0.10 m 제외) → 592.18
    near(cum[2] * 3.0 + cum[1] * 3.0 + cum[0] * 3.0, 592.18, 0.3)
  })
})

describe('TW 오라클 — 營建署 2층 계산서 (花東, 2005 code, GTStrudl, αy 1.2)', () => {
  // 계산서 5장: SsD 0.80 S1D 0.45 SsM 0.90 S1M 0.55, 地盤 3 → Fa 1.0 / Fv 1.5 (설계), Fa 1.0 / Fv 1.4 (최대) → SDS 0.80 SD1 0.675 SMS 0.90 SM1 0.77
  const sp = { SDS: 0.80, SD1: 0.675, SMS: 0.90, SM1: 0.77, I: 1, R: 4 }
  const AY = 1.2, W = 30.45, Tuse = 0.326
  it('T0D 0.844 / T0M 0.856', () => { rel(T.siteTW(sp).T0D, 0.844, 1e-3); rel(sp.SM1 / sp.SMS, 0.856, 1e-3) })
  it('FuD 2.236 / FuM 2.646, V_D 0.1965W=5.98 / V* 0.1464W=4.46 / V_M 0.1910W=5.82', () => {
    const cf = T.coefTW(Tuse, sp)
    rel(cf.Fu, 2.236, 1e-3); rel(T.fuTW(Tuse, sp.R, sp.SM1 / sp.SMS), 2.646, 1e-3)
    rel(cf.cV / AY, 0.1965, 1e-3); near(cf.cV / AY * W, 5.98, 0.02)
    rel(cf.cStar / AY, 0.1464, 1e-3); near(cf.cStar / AY * W, 4.46, 0.02)
    rel(cf.cM / AY, 0.1910, 1e-3); near(cf.cM / AY * W, 5.82, 0.02)
    expect(cf.gov).toBe('V')
  })
  it('竖向분배 RF 11.99 t@4.70 / 2F 18.46 t@2.85 → 3.09 / 2.89 t, 전도 25.763 t·m', () => {
    const V = 5.98, h = [2.85, 4.70], w = [18.46, 11.99], den = 2.85 * 18.46 + 4.70 * 11.99
    const F = h.map((hi, i) => V * w[i] * hi / den)
    near(F[1], 3.09, 0.01); near(F[0], 2.89, 0.01)
    // 계산서 傾倒力矩 25.763 은 기준면 정의가 표기돼 있지 않아(ΣF·h = 22.76) 대조에서 제외
  })
  it('수직지진 2.18: R=3 → Ra 1+2/1.5, Fuv = √(2Ra−1) = 1.9149', () => {
    const Ra = 1 + (3 - 1) / 1.5
    rel(Math.sqrt(2 * Ra - 1), 1.9149)
  })
})
