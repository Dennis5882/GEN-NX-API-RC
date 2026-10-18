/* TW 프로필 검증 — 耐震規範(113)·耐風規範(2014)·混凝土規範(112) 식을 테스트 안에서 원문대로 독립 재구현해 앱 값과 대조 (`npm test`) */
import { boot, checker } from './_harness.mjs'
const { server, S, load, RC } = await boot()
S.lang = 'ko'
const T = await load('/src/codes/tw.ts')
const { modelDeadWeights, heightAboveGround } = await load('/src/codes/selfweight.ts')
const { twReviewEvaluate, driftCoefTW } = await load('/src/codes/twReview.ts')
const { ok, eq, done } = checker()

/* ── 독립 재구현 (KB seismic 2.2·2.9·2.10, 표2-5(a)/2-7(a), 2.18) ── */
const sa = (t, s, t0) => (t <= 0.2 * t0 ? s * (0.4 + 3 * t / t0) : t <= t0 ? s : t <= 2.5 * t0 ? s * t0 / t : 0.4 * s)
const fu = (t, ra, t0) => { const r = Math.sqrt(2 * ra - 1); return t >= t0 ? ra : t >= 0.6 * t0 ? r + (ra - r) * (t - 0.6 * t0) / (0.4 * t0) : t >= 0.2 * t0 ? r : r + (r - 1) * (t - 0.2 * t0) / (0.2 * t0) }
const mm = x => (x <= 0.3 ? x : x < 0.8 ? 0.52 * x + 0.144 : 0.7 * x)
function vw(t, { SDS, SD1, T0 = 0, SMS = 0, I = 1, R = 4.8 }) {
  const basin = T0 > 0, t0d = basin ? T0 : SD1 / SDS
  const ra = 1 + (R - 1) / (basin ? 2 : 1.5), a = sa(t, SDS, t0d), f = fu(t, ra, t0d), m = mm(a / f)
  const vm = SMS > 0 && basin ? I / 1.4 * mm(sa(t, SMS, T0) / fu(t, R, T0)) : 0
  return Math.max(I / 1.4 * m, I * f / (basin ? 3.5 : 4.2) * m, vm)
}

// 1) 스펙트럼·Fu·보정 (2-2, 2-12, 표2-5(a)/2-7(a))
for (const t of [0.05, 0.1, 0.3, 0.6, 1, 2, 3.5, 6]) {
  ok(`SaD T=${t}`, T.saTW(t, 0.6, 0.583), sa(t, 0.6, 0.583))
  ok(`Fu T=${t}`, T.fuTW(t, 1 + 3.8 / 1.5, 0.583), fu(t, 1 + 3.8 / 1.5, 0.583))
}
for (const x of [0.1, 0.3, 0.5, 0.8, 1.2]) ok(`(Sa/Fu)m x=${x}`, T.modTW(x), mm(x))
// 2) V/W — 일반 부지·臺北盆地·VM
for (const [tag, sp] of [['일반 .6/.35', { SDS: 0.6, SD1: 0.35 }], ['일반 I1.5', { SDS: 0.8, SD1: 0.45, I: 1.5 }], ['盆地 三區', { SDS: 0.6, SD1: 0.63, T0: 1.05, SMS: 0.8, SM1: 0.84 }], ['盆地 一區', { SDS: 0.6, SD1: 0.96, T0: 1.6, SMS: 0.8, SM1: 1.28 }]])
  for (const t of [0.4, 1.2, 2.5]) ok(`V/W ${tag} T=${t}`, T.coefTW(t, { R: 4.8, I: 1, ...sp }).c, vw(t, { R: 4.8, ...sp }))
// 3) 사무 10층 — 경험주기·분배
const base = { ...RC.DEFAULT_SPEC, buildings: 1, code: 'TW', bldgType: 'office', stories: 10, h1: 4500, hTyp: 4000, bayX: 4, bayY: 3, spanX: 9000, spanY: 9000, matName: 'C350', colH: 600, colB: 600, colName: 'C600x600', beamH: 700, beamB: 350, podium: 0 }
const sp = { SDS: 0.6, SD1: 0.35, I: 1, R: 4.8, liveRatio: 0 }
const hn = heightAboveGround(base)
ok('hn', hn, 40.5)
ok('Ta frame', T.periodTW(base), 0.07 * Math.pow(hn, 0.75))
ok('Ta wall', T.periodTW({ ...base, walls: [{}] }), 0.05 * Math.pow(hn, 0.75))
const r = T.seismicTW(base, sp)
const D = modelDeadWeights(base, T.TW), Wref = D.reduce((a, b) => a + (b || 0), 0)
ok('W = 모델 고정하중', r.Wtot, Wref)
ok('V', r.V, vw(Math.min(r.T, 1.4 * r.Ta), sp) * Wref)
ok('ΣF = V', r.forces.reduce((a, f) => a + f.F, 0), r.V)
ok('Ft = 0.07TV (T>0.7)', r.Ft, r.T > 0.7 ? Math.min(0.07 * r.T * r.V, 0.25 * r.V) : 0)
{ const el = RC.storyElevations(base); let den = 0
  for (let i = 1; i <= 10; i++) den += D[i] * el[i] / 1000
  ok('F5', r.forces[4].F, (r.V - r.Ft) * D[5] * (el[5] / 1000) / den) }
eq('방법 auto 40.5m·10층 → ESL', T.rsPrimaryTW(base, sp), false)
eq('방법 auto 15층 → RS', T.rsPrimaryTW({ ...base, stories: 15 }, sp), true)
eq('방법 auto 50m → RS', T.rsPrimaryTW({ ...base, stories: 12, hTyp: 4300 }, sp), true)
eq('method ESL 강제', T.rsPrimaryTW({ ...base, stories: 20 }, { ...sp, method: 'ESL' }), false)
// 4) 풍 (2014 2.6·2.7·표2.2·표2.4)
{ const wp = { V10: 42.5, exposure: 'B', Iw: 1, G: 1.88 }
  const w = T.windTW(base, wp)
  const e = { A: [0.32, 500], B: [0.25, 400], C: [0.15, 300] }.B
  const q = z => 0.06 * 2.774 * Math.pow(Math.max(z, 5) / e[1], 2 * e[0]) * 42.5 ** 2 * 0.00980665
  const Lx = 36, Ly = 27, cp = 0.5 - 0.2 * (Lx / Ly - 1)       // 표2.4: L/B 1~2 선형 (−0.5 → −0.3)
  const el = RC.storyElevations(base).map(x => x / 1000), h = el[10]
  let Vx = 0
  for (let s = 1; s <= 10; s++) Vx += 1.88 * (0.8 * q(el[s]) + cp * q(h)) * Ly * ((el[s] - el[s - 1]) / 2 + (s < 10 ? (el[s + 1] - el[s]) / 2 : 0))
  ok('풍 Vx', w.Vx, Vx)
  ok('q(10m) C', T.kzTW(10, 'C'), 2.774 * Math.pow(10 / 300, 0.3))
  ok('Cp L/B=4', T.cpLeeTW(4), 0.2); ok('Cp L/B=0.5', T.cpLeeTW(0.5), 0.5); ok('Cp L/B=3', T.cpLeeTW(3), 0.25) }
// 5) 수직지진 2.18
{ const v = T.verticalTW(base, { SDS: 0.6, SD1: 0.35, I: 1 })
  const ra = 1 + 2 / 1.5, fuv = Math.sqrt(2 * ra - 1), x = 0.5 * 0.6 / fuv, m = x <= 0.15 ? x : x < 0.4 ? 0.52 * x + 0.072 : 0.7 * x
  ok('Kz', v.Kz, Math.max(m / 1.4, fuv / 4.2 * m)); ok('kc = 0.4·SDS·I/2', v.kc, 0.12)
  eq('vertical N → 없음', T.verticalTW(base, { SDS: 0.6, vertical: 'N' }), null) }
// 6) 조합 112 5.3.1 + 2.18 해설
{ const lc = [{ name: 'DL', type: 'D' }, { name: 'LL', type: 'L' }, { name: 'LR', type: 'LR' }, { name: 'WX', type: 'W' }, { name: 'WY', type: 'W' }, { name: 'EX', type: 'E' }, { name: 'EY', type: 'E' }]
  const d0 = T.TW.combos(lc).map(c => c.desc)
  for (const x of ['1.4D', '1.2D+1.6L+0.5Lr', '1.2D+1.6Lr+1.0L', '1.2D+1.6WX+1.0L+0.5Lr', '0.9D+1.6WY', '1.2D+1.0EX+1.0L', '0.9D+1.0EY', '1.2D+1.6Lr+0.8WX']) eq(`조합 ${x}`, d0.includes(x), true)
  const withEV = T.TW.combos([...lc, { name: 'EV', type: 'USER' }])
  eq('EV 조합 추가', withEV.length - d0.length, 8 * 2)
  const c = withEV.find(c => c.desc === '0.9D+0.3EX-1EV')
  eq('0.3Eh − 1.0Ev', JSON.stringify(c?.terms.map(t => [t[0], t[1]])), JSON.stringify([['DL', 0.9], ['EV', -1], ['EX', 0.3]]))
  const pm = T.TW.combos([...lc, { name: 'EXm', type: 'E' }, { name: 'EYm', type: 'E' }])
  eq('± 편심 케이스 조합', pm.some(x => x.desc === '1.2D+1.0EXm+1.0L'), true)
  const rs = T.TW.combos([{ name: 'DL', type: 'D' }, { name: 'LL', type: 'L' }, { name: 'RSX', type: 'RS' }, { name: 'RSY', type: 'RS' }])
  eq('RS 조합 ANAL', rs.find(x => x.desc === '0.9D+1.0RSX').terms.some(t => t[0] === 'RSX' && t[2] === 'RS'), true) }
// 7) 재료 Ec = 12000√fc′ (112 19.2.2.1b)
for (const g of ['C210', 'C280', 'C350', 'C420']) {
  const e = Math.round(12000 * Math.sqrt(+g.slice(1)) * 0.0980665)
  ok(`Ec ${g}`, T.TW.materials[g].E, e)
  const m = T.TW.concreteMatl(g).PARAM[0]
  eq(`Gen ELAST ${g}`, m.bELAST === true && m.ELAST === e, true)
}
// 8) 盆地 프리셋 (표 2-6(c))
{ const z = Object.fromEntries(RC.SEISMIC_ZONES.filter(x => x.city === '臺北盆地').map(x => [x.dist, x]))
  ok('一區 T0', z['臺北一區'].T0, 1.6); ok('二區 T0', z['臺北二區'].T0, 1.3); ok('三區 T0', z['臺北三區'].T0, 1.05)
  for (const k of Object.keys(z)) { ok(`${k} SD1=SDS·T0`, z[k].SD1, 0.6 * z[k].T0); ok(`${k} SMS`, z[k].SMS, 0.8); ok(`${k} SM1=SMS·T0`, z[k].SM1, 0.8 * z[k].T0) } }
// 9) 새 스펙 기둥 보정 — 압축 φPn,max
{ const fc = 0.0980665 * 350, phi = A => 0.8 * 0.65 * (0.85 * fc * A * 0.99 + 420 * 0.01 * A) / 1000
  const r0 = T.sizeColumnTW(base)
  eq('기본 600 → 확대 필요', !!r0 && r0.side > 600, true)
  ok('φPn,max', T.phiPnMaxTW(fc, 360000), phi(360000))
  const big = T.sizeColumnTW({ ...base, colH: r0.side, colB: r0.side, colName: 'x' })
  eq('확대 후 충분 → null', big, null)
  eq('3층은 600 유지', T.sizeColumnTW({ ...base, stories: 3 }), null)
  const rect = T.sizeColumnTW({ ...base, colH: 800, colB: 500, colName: 'x' })
  eq('직사각형 확대 — 가로세로비 유지(H≥B)', !!rect && rect.H > 800 && rect.B > 500 && Math.abs(rect.H / rect.B - 1.6) < 0.1, true)
  eq('직사각형 확대 후 충분 → null', T.sizeColumnTW({ ...base, colH: rect.H, colB: rect.B, colName: 'x' }), null)
  const th = T.thetaTW(base)
  eq('θ 추정(C600) 0.08~0.16', th > 0.08 && th < 0.16, true)
  eq('벽 있으면 θ 생략', T.thetaTW({ ...base, walls: [{}] }), null) }
// 10) P-Δ 훅
{ const lc = [{ name: 'DL', type: 'D' }, { name: 'LL', type: 'L' }]
  eq('pdelta N', T.TW.pDelta(base, { ...sp, pdelta: 'N' }, lc), null)
  const y = T.TW.pDelta(base, { ...sp, pdelta: 'Y' }, lc)
  eq('pdelta Y 1.2D+1.0L', JSON.stringify(y.PDEL_CASES), JSON.stringify([{ LCNAME: 'DL', FACTOR: 1.2 }, { LCNAME: 'LL', FACTOR: 1 }]))
  eq('auto: θ≥0.1 → 적용', !!T.TW.pDelta(base, sp, lc), (T.thetaTW(base) ?? 0) >= 0.1)
  eq('auto: 큰 기둥 → 미적용', T.TW.pDelta({ ...base, colH: 1000, colB: 1000 }, sp, lc), null)
  eq('auto: 팔레트(θ 추정 신뢰 불가) → 보수적으로 적용', !!T.TW.pDelta({ ...base, colH: 1000, colB: 1000, palette: { cols: [{}] } }, sp, lc), true) }
// 11) 검토 지표 — 합성 표
{ const tb = (HEAD, DATA) => ({ HEAD, DATA })
  const DC = 'Maximum Drift of All Vertical Elements/Story Drift'
  const data = {
    EV: {}, DX: { DX: tb(['Story', 'Story Height', DC], [['2F', '4', '0.008']]) }, DY: { DY: tb(['Story', 'Story Height', DC], [['2F', '4', '0.004']]) },
    TX: { TX: tb(['Story', 'Average Value of Extreme Points/Story Drift', 'Maximum Value/Story Drift'], [['2F', '1', '1.3']]) },
    TY: { TY: tb(['Story', 'Average Value of Extreme Points/Story Drift', 'Maximum Value/Story Drift'], [['2F', '1', '1.1']]) },
  }
  const items = twReviewEvaluate(base, sp, data, { rs: false, T1: 2, V: 1000, model: {} })
  const g = (id, d) => items.find(i => i.id === id && i.dir === d)
  const Wt = T.storyWeightsTW(base, sp).reduce((a, b) => a + (b || 0), 0), k = driftCoefTW(2, sp) * Wt / 1000
  eq('변위각 환산 X (V*/V)', g('drift', 'X').value, (0.008 / 4 * k).toFixed(4))
  eq('비틀림 X 1.3 → warn', g('torsion', 'X').status, 'warn'); eq('비틀림 Y 1.1 → ok', g('torsion', 'Y').status, 'ok')
  ok('V* 계수 = Fu/4.2·(Sa/Fu)m', driftCoefTW(2, sp), (() => { const t0 = 0.35 / 0.6, ra = 1 + 3.8 / 1.5, f = fu(2, ra, t0), a = 0.6 * t0 / 2 /* 2.16.1: SaD 하한 0.4SDS 없음 */; return f / 4.2 * mm(a / f) })()) }

const fails = done('TW')
await server.close()
process.exit(fails ? 1 : 0)
