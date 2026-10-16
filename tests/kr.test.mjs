/* KR 프로필 검증 — KDS 식을 테스트 안에서 원문대로 독립 재구현해 앱 값과 대조 (`npm test`) */
import { boot, checker } from './_harness.mjs'
const { server, S, load, RC } = await boot()
S.lang = 'ko'
const K = await load('/src/codes/kr.ts')
const { heightAboveGround, modelDeadWeights } = await load('/src/codes/selfweight.ts')
const { ok, eq, done } = checker()

const lin = (x, x0, x1, y0, y1) => y0 + (y1 - y0) * (x - x0) / (x1 - x0)
const tab = (row, S) => S <= 0.1 ? row[0] : S >= 0.3 ? row[2] : S <= 0.2 ? lin(S, 0.1, 0.2, row[0], row[1]) : lin(S, 0.2, 0.3, row[1], row[2])
const FA = { S1: [1.12, 1.12, 1.12], S2: [1.4, 1.4, 1.3], S3: [1.7, 1.5, 1.3], S4: [1.6, 1.4, 1.2], S5: [1.8, 1.3, 1.3] }
const FV = { S1: [0.84, 0.84, 0.84], S2: [1.5, 1.4, 1.3], S3: [1.7, 1.6, 1.5], S4: [2.2, 2.0, 1.8], S5: [3.0, 2.7, 2.4] }

// 1) 지반증폭·설계스펙트럼 가속도 (4.2.2·4.2.3)
for (const site of Object.keys(FA)) for (const zone of ['1', '2']) {
  const S_ = zone === '1' ? 0.22 : 0.14
  const s = K.siteKR({ zone, site })
  ok(`SDS ${site} z${zone}`, s.SDS, S_ * 2.5 * tab(FA[site], S_) * 2 / 3)
  ok(`SD1 ${site} z${zone}`, s.SD1, S_ * tab(FV[site], S_) * 2 / 3)
}
ok('Fa S3 S=0.25', K.siteKR({ site: 'S3', S: 0.25 }).Fa, 1.4)          // 1.5→1.3 중간
ok('Fv S5 S=0.15', K.siteKR({ site: 'S5', S: 0.15 }).Fv, 2.85)
// 2) 스펙트럼 형상 (4.2.1)
{ const s = K.siteKR({ zone: '1', site: 'S4' })
  ok('Sa(0)', K.saKR(0, s), 0.4 * s.SDS); ok('Sa(T0)', K.saKR(s.T0, s), s.SDS); ok('Sa(Ts)', K.saKR(s.Ts, s), s.SDS)
  ok('Sa(2)', K.saKR(2, s), s.SD1 / 2); ok('Sa(8)', K.saKR(8, s), s.SD1 * 5 / 64) }
// 3) 내진설계범주 (표 5.2-1·5.2-2)
eq('SDC II SDS.5', K.sdcKR(0.5, 0.05, '2'), 'D'); eq('SDC II SDS.4', K.sdcKR(0.4, 0.05, '2'), 'C'); eq('SDC 특 SDS.4', K.sdcKR(0.4, 0.05, 'S'), 'D')
eq('SDC I SD1.15', K.sdcKR(0.1, 0.15, '1'), 'C'); eq('SDC 특 SD1.1', K.sdcKR(0.1, 0.1, 'S'), 'C'); eq('SDC A', K.sdcKR(0.16, 0.06, 'S'), 'A')
// 4) Cu (표 7.2-1)
ok('Cu .05', K.cuKR(0.05), 1.7); ok('Cu .125', K.cuKR(0.125), 1.65); ok('Cu .25', K.cuKR(0.25), 1.45); ok('Cu .5', K.cuKR(0.5), 1.4)
// 5) 중요도 자동 (KDS 41 10 05 3.)
const base = { ...RC.DEFAULT_SPEC, buildings: 1, code: 'KR' }
eq('imp hospital', K.impKR({ ...base, bldgType: 'hospital' }), 'S')
eq('imp school', K.impKR({ ...base, bldgType: 'school' }), '1')
eq('imp apt 5F', K.impKR({ ...base, bldgType: 'apartment', stories: 5 }), '1')
eq('imp apt 4F', K.impKR({ ...base, bldgType: 'apartment', stories: 4 }), '2')
eq('imp office', K.impKR({ ...base, bldgType: 'office', stories: 30 }), '2')
eq('imp override', K.impKR({ ...base, bldgType: 'hospital' }, '2'), '2')

// 6) 등가정적 — 사무 10층 (지상 h1 4.5 + 4.0×9 = 40.5m), IMF, 구역 I · S4
const p = { ...base, bldgType: 'office', stories: 10, h1: 4500, hTyp: 4000, matName: 'C30' }
const sp = { zone: '1', site: 'S4' }
const r = K.seismicKR(p, sp)
const hn = heightAboveGround(p)
ok('hn', hn, 40.5)
const s0 = K.siteKR(sp)
const Ta = 0.0466 * Math.pow(hn, 0.9)
ok('Ta frame', r.Ta, Ta)
const Cs = Math.max(Math.min(s0.SDS / 5, s0.SD1 / (5 * Ta)), 0.044 * s0.SDS * 1.0, 0.01)
ok('Cs', r.Cs, Cs)
const D = modelDeadWeights(p, K.KR); const Wref = D.reduce((a, b) => a + (b || 0), 0)
ok('W = model dead', r.Wtot, Wref)
ok('V', r.V, Cs * Wref)
const k = 1 + (Ta - 0.5) / 2
ok('k', r.k, k)
const el = RC.storyElevations(p); let den = 0
for (let i = 1; i <= 10; i++) den += D[i] * Math.pow(el[i] / 1000, k)
ok('F10', r.forces[9].F, Cs * Wref * D[10] * Math.pow(el[10] / 1000, k) / den)
ok('ΣF = V', r.forces.reduce((a, f) => a + f.F, 0), r.V)
eq('SDC', r.sdc, 'D')
// T 상한 Cu·Ta, 하한식
ok('T cap', K.seismicKR(p, sp, { T: 5 }).T, K.cuKR(s0.SD1) * Ta)
ok('Cs floor (T long)', K.seismicKR(p, { ...sp, zone: '2', site: 'S1', system: 'SMF' }, { T: 3 }).Cs,
  Math.max(Math.min(K.siteKR({ zone: '2', site: 'S1' }).SDS / 8, K.siteKR({ zone: '2', site: 'S1' }).SD1 / (8 * Math.min(3, K.cuKR(K.siteKR({ zone: '2', site: 'S1' }).SD1) * Ta))), 0.044 * K.siteKR({ zone: '2', site: 'S1' }).SDS, 0.01))
// 벽 있음 → 0.0488 hn^0.75
ok('Ta wall', K.periodKR({ ...p, walls: [{}] }, {}), 0.0488 * Math.pow(hn, 0.75))
// 7) 동적해석 의무 (7.1)
eq('RS D reg 40m', K.rsRequiredKR(p, sp).req, false)
eq('RS D irr 40m', K.rsRequiredKR(p, { ...sp, regular: 'N' }).req, true)
eq('RS D reg 25F', K.rsRequiredKR({ ...p, stories: 25, hTyp: 3000 }, sp).req, true)      // 4.5+72=76.5m ≥ 70
eq('RS C reg 21F', K.rsRequiredKR({ ...p, stories: 21, hTyp: 2800 }, { zone: '2', site: 'S2' }).req, K.sdcKR(K.siteKR({ zone: '2', site: 'S2' }).SDS, K.siteKR({ zone: '2', site: 'S2' }).SD1, '2') === 'C')
eq('RS ESL override', K.rsPrimaryKR(p, { ...sp, regular: 'N', method: 'ESL' }), false)
// 8) RS 초기 SCALE I_E/R
ok('scale0', K.KR.seismic.rsScale0(p, sp).X, 1.0 / 5)
// 9) rsAdjust — V_t 가 0.85V 미만이면 C_m
{ const V = K.seismicKR(p, sp, { T: 1.5 }).V
  const rows = d => [{ Story: '1F', ['Shear Force/' + d]: String(0.6 * V) }]
  const res = K.KR.seismic.rsAdjust(p, sp, { T1: 1.5, Tdir: { X: 1.5, Y: 1.5 }, rows: { X: rows('X'), Y: rows('Y') }, scale0: { X: 0.2, Y: 0.2 } })
  ok('Cm', res.chk.X.Cm, 0.85 / 0.6); ok('scale', res.scale.X, 0.2 * 0.85 / 0.6)
  const res2 = K.KR.seismic.rsAdjust(p, sp, { T1: 1.5, Tdir: { X: 1.5, Y: 1.5 }, rows: { X: [{ Story: '1F', 'Shear Force/X': String(V) }], Y: rows('Y') }, scale0: { X: 0.2, Y: 0.2 } })
  ok('Cm=1', res2.chk.X.Cm, 1) }
// 10) 재료 Ec (KDS 14 20 10 4.3.3)
ok('Ec C30', K.KR.materials.C30.E, Math.round(8500 * Math.cbrt(34)))
ok('Ec C50', K.KR.materials.C50.E, Math.round(8500 * Math.cbrt(55)))
ok('Ec C60', K.KR.materials.C60.E, Math.round(8500 * Math.cbrt(66)))
eq('adapt C280', K.KR.adaptSpec({ ...p, matName: 'C280' }).matName, 'C27')
eq('adapt CN C30 → C24', K.KR.adaptSpec({ ...p, code: 'CN', matName: 'C30' }).matName, 'C24')
eq('adapt CN C40 → C30', K.KR.adaptSpec({ ...p, code: 'CN', matName: 'C40' }).matName, 'C30')
eq('adapt CN C60 → C50', K.KR.adaptSpec({ ...p, code: 'CN', matName: 'C60' }).matName, 'C50')
eq('adapt KR C30 keep', K.KR.adaptSpec({ ...p, code: 'KR', matName: 'C30' }).matName, 'C30')
const { codeForLang } = await load('/src/state/store.ts')
eq('ko → KR', codeForLang('ko'), 'KR'); eq('zh-CN → CN', codeForLang('zh-CN'), 'CN'); eq('en → TW', codeForLang('en'), 'TW')
/* 검토: Cm 은 scaled 일 때만 나눔 */
const { krReviewEvaluate } = await load('/src/codes/krReview.ts')
const T_ = (HEAD, DATA) => ({ HEAD, DATA })
const dd = { DX: { DX: T_(['Story', 'Story Height', 'Maximum Drift of All Vertical Elements/Story Drift'], [['2F', '4', '0.004']]) }, DY: { DY: T_(['Story', 'Story Height', 'Maximum Drift of All Vertical Elements/Story Drift'], [['2F', '4', '0.004']]) } }
const dr = ctx => krReviewEvaluate(p, sp, dd, ctx).find(i => i.id === 'drift' && i.dir === 'X').value
eq('drift scaled ÷Cm', dr({ rs: true, T1: 1, rsChk: { X: { Cm: 2, Vt: 1, V: 1 }, scaled: true } }), (0.001 * 4.5 / 1 / 2).toFixed(4))
eq('drift not scaled', dr({ rs: true, T1: 1, rsChk: { X: { Cm: 2, Vt: 1, V: 1 } } }), (0.001 * 4.5).toFixed(4))
const lab = krReviewEvaluate(p, sp, dd, { rs: false, T1: null }).map(i => i.limit + (i.where || '')).join(' ')
S.lang = 'en'; const labEn = krReviewEvaluate(p, sp, dd, { rs: false, T1: null }).map(i => i.limit + (i.where || '')).join(' '); S.lang = 'ko'
eq('no Korean in en review', /[가-힣]/.test(labEn), false)
// 11) 하중조합 (1.7.1)
// 12) 풍 (5.5·5.6·5.7) — 독립 재구현
{ const wp = { V0: 30, exposure: 'B' }
  const w = K.windKR(p, wp)
  const r_ = { zb: 15, Zg: 450, a: 0.22 }
  const H = 40.5, Kzr = 0.45 * Math.pow(H, 0.22), VH = 30 * Kzr * 0.95, qH = 0.5 * 1.225 * VH * VH / 1000
  ok('Kzr(H)', K.kzrKR(H, 'B'), Kzr); ok('VH', w.VH, VH); ok('qH', w.qH, qH)
  const Lx = RC.asSpans(p.spanX, p.bayX).reduce((a, b) => a + b, 0) / 1000, Ly = RC.asSpans(p.spanY, p.bayY).reduce((a, b) => a + b, 0) / 1000
  // G_D 독립: n_D = 1/Ta
  const nD = 1 / Ta, zeta = 0.02, beta = 0.5
  const IH = 0.1 * Math.pow(H / 450, -0.27), gam = (3 + 0.66) / 2.22 * IH, LH = 100 * Math.sqrt(H / 30)
  const G = (B) => { const kk = H >= B ? 0.33 : -0.33
    const BD = 1 - 1 / Math.pow(1 + 5.1 * Math.pow(LH / Math.sqrt(H * B), 1.3) * Math.pow(B / H, kk), 1 / 3)
    if (nD > 1) return 1 + 4 * gam * Math.sqrt(BD)
    const SD = 1 / ((1 + 4 * nD * B / VH) * (1 + 2.3 * nD * H / VH)), x = nD * LH / VH, FD = 4 * x / Math.pow(1 + 71 * x * x, 5 / 6)
    const RD = Math.PI / (4 * zeta) * SD * FD, nu = nD * Math.sqrt(RD / (BD + RD)), g = Math.sqrt(2 * Math.log(600 * nu) + 1.2)
    const phi = 2 / 2.5 * (1 - 0.4 * Math.log(0.5)); return 1 + g * gam * Math.sqrt(BD + phi * phi * RD) }
  ok('GX', w.GX, G(Ly)); ok('GY', w.GY, G(Lx))
  // 10층 (z=40.5 ≥ 0.8H): kz = 0.8^0.44, trib = 4.0/2
  const kz = Math.pow(0.8, 0.44), DB = Lx / Ly
  ok('F10 X', w.forcesX[9].F, G(Ly) * qH * (0.8 * kz + (DB > 1 ? 0.05 : 0) + (DB <= 1 ? 0.5 : 0.35)) * Ly * 2.0)
  // 1층 (z=4.5 ≤ zb): kz = (zb/H)^0.44, trib = 4.5/2+4/2
  const kz1 = Math.pow(15 / H, 0.44)
  ok('F1 X', w.forcesX[0].F, G(Ly) * qH * (0.8 * kz1 + (DB > 1 ? 0.05 : 0) + (DB <= 1 ? 0.5 : 0.35)) * Ly * 4.25)
  console.log(`wind: H=${H} VH=${VH.toFixed(2)} qH=${qH.toFixed(3)} nD=${nD.toFixed(3)} GX=${w.GX.toFixed(3)} GY=${w.GY.toFixed(3)} Vx=${w.Vx.toFixed(0)} Vy=${w.Vy.toFixed(0)} kN`)
  // 강체 경로 (n_D > 1)
  const wr = K.windKR({ ...p, stories: 3 }, { V0: 30, exposure: 'B', nD: 2 })
  ok('G rigid', wr.GX, 1 + 4 * ((3.66 / 2.22) * 0.1 * Math.pow(15 / 450, -0.27)) * Math.sqrt(1 - 1 / Math.cbrt(1 + 5.1 * Math.pow(100 / Math.sqrt(Math.max(heightAboveGround({ ...p, stories: 3 }), 0.1) * Ly), 1.3) * Math.pow(Ly / heightAboveGround({ ...p, stories: 3 }), Ly <= heightAboveGround({ ...p, stories: 3 }) ? 0.33 : -0.33))))
}

// 13) 편집 카드 — 시스템을 내력벽으로 바꾸면 자동 확대 기둥을 되돌리고, 골조로 되돌리면 다시 확대 (reconcileEdit)
{ const frame = { ...p, bldgType: 'office', stories: 15, colH: 500, colB: 500, colName: 'C500x500' }
  const r0 = K.sizeColumnKR(frame)
  eq('15층 골조는 500 → 확대 필요', !!r0 && r0.side > 500, true)
  const big = { ...frame, colH: r0.side, colB: r0.side, colName: `C${r0.side}x${r0.side}` }
  const base = { ...big, colAuto: { H: 500, B: 500 } }
  const toBW = { ...big, seismic: { system: 'BW_SW' } }
  const a = K.KR.reconcileEdit(big, toBW, base)
  eq('→ 내력벽: 원래 기둥 복원', a && a.H === 500 && a.B === 500, true)
  const orig = { ...frame, seismic: { system: 'BW_SW' } }
  const b = K.KR.reconcileEdit(orig, { ...frame, colH: 500, colB: 500, seismic: { system: 'SMF' } }, base)
  eq('→ 골조: 다시 확대', b && b.H === r0.side, true)
  eq('사용자가 기둥 수정 → 유지', K.KR.reconcileEdit(big, { ...toBW, colH: 700, colB: 700 }, base), null)
  eq('시스템 불변 → null', K.KR.reconcileEdit(big, big, base), null)
  eq('bearing 토글도 동일', K.KR.reconcileEdit(big, { ...big, bearing: { on: true, thick: 200 } }, base)?.H, 500) }

const fails = done('KR')
await server.close()
process.exit(fails ? 1 : 0)
