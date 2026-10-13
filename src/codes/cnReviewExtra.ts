/* ════════════════════════════════════════════════════════════
   중국 심사 지표(审图) 추가분 — Gen 층 결과 테이블 + 기둥 부재력으로 산정 (원문 KB 대조 2026-10-13)
   - 侧向刚度比   JGJ 3-2010 3.5.2 (框架 γ1: 상층 0.7·상부 3층 평균 0.8 / 벽 有 고층 γ2 = γ1·hi/hi+1 ≥ 0.9, hi>1.5hi+1 → 1.1, 嵌固层 1.5)
                  비고층은 GB 50011 3.4.3 표 3.4.3-2 (0.7·0.8). 미달 층 = 软弱层 → 3.5.8 지진전단 ×1.25 (미적용, 안내만)
                  K = 층전단/층간변위 — Gen STIFFNESS_IRREGULARITY ADDITIONAL 'Story Shear / Story Drift'(라이브 확인)
   - 刚重比       JGJ 3 5.4.4(안정, 不应) / 5.4.1(≥ 이면 P-Δ 생략). 框架 Di·hi/ΣGj ≥ 10 (20), 벽 有 EJd/(H²ΣG) ≥ 1.4 (2.7)
                  G = 1.2D + 1.4L(층 바닥 활하중, 不上人屋面 제외). EJd = 11qH⁴/(120u), 倒三角 q = 2V0/H → 11·V0·H³/(60u) (5.4.1 条文说明)
                  V0·u = 정적 EX/EY(底部剪力法 — 倒三角에 가까운 분포) 지상 밑면전단·지상 최상층 평균변위(嵌固端 대비)
   - 倾覆力矩比   JGJ 3 8.1.3 / GB 50011 6.1.3 — 벽 有 만. 框架 Mc = Σ_i Σ_j V_ij·h_i (6.1.3 条文说明), 총 M0 = Gen OVERTURNING_MOMENT 嵌固端 층
                  (판 요소 벽은 Gen 이 Wall 로 분류하지 않아 Frame 값 = 전체 — 라이브 확인). 규정수평력 = 정적 EX/EY 로 단순화
   - 轴压比       GB 50011 6.3.6 표 — N = 1.3(D+0.5L) + 1.4|E| (GB 55002 지진조합, E = RS 또는 정적 ±), μ = N/(fc·A), fc = GB 50010 표 4.1.4
                  框架-抗震墙 계열은 倾覆力矩比 > 50% 면 框架 한계(JGJ 3 8.1.3-3·4). 特一级 = 一级 −0.05(JGJ 3 3.10.4). 剪跨比 ≤ 2 의 −0.05 는 미반영
   - 嵌固端刚度比 JGJ 3 5.3.7 (지하 1층/지상 1층 ≥ 2) — 附录 E.0.1 등가전단강성 G·A/h, A = Aw + Σ 2.5(hc/h)²·Ac (≤1). 지하층 있을 때만.
                  지하실 '相关范围'(지상 외곽 3跨)·토층 구속은 모델에 없음 → 같은 평면이면 보통 미달로 나옴
   - 风振舒适度   JGJ 3 3.7.6 (H ≥ 150m) — GB 50009 附录 J 横风向(附录 H 풍력 스펙트럼)·10년 풍압이 필요해 미산정 안내만
════════════════════════════════════════════════════════════ */
import { RC, type BuildingSpec } from '../engine'
import { t } from '../i18n'
import { num } from '../mapi/tables'
import type { ReviewItem, ReviewTable } from './types'

/** 기둥 축력·전단 회수용 BEAMFORCE + 강성·변위·전도모멘트 표 */
export function cnExtraTables(ctx: { rs: boolean; model?: any }): ReviewTable[] {
  const SD = { ADDITIONAL: { SET_CALCULATION_METHOD: { STORY_DRIFT_METHOD: 'Drift at the Center of Mass', STORY_STIFFNESS_METHOD: 'Story Shear / Story Drift' } } }
  const [lx, ly] = ctx.rs ? ['RSX(RS)', 'RSY(RS)'] : ['EX(ST)', 'EY(ST)']
  const out: ReviewTable[] = [
    { key: 'KX', type: 'STIFFNESS_IRREGULARITY_X', lcs: [lx], extra: SD },
    { key: 'KY', type: 'STIFFNESS_IRREGULARITY_Y', lcs: [ly], extra: SD },
    { key: 'UX', type: 'STORY_DISPLACEMENT_X', lcs: ['EX(ST)'] },
    { key: 'UY', type: 'STORY_DISPLACEMENT_Y', lcs: ['EY(ST)'] },
    { key: 'OX', type: 'OVERTURNING_MOMENT', lcs: ['EX(ST)'] },
    { key: 'OY', type: 'OVERTURNING_MOMENT', lcs: ['EY(ST)'] },
  ]
  if (ctx.rs) out.push({ key: 'KSX', type: 'STIFFNESS_IRREGULARITY_X', lcs: ['EX(ST)'], extra: SD }, { key: 'KSY', type: 'STIFFNESS_IRREGULARITY_Y', lcs: ['EY(ST)'], extra: SD })
  const m = ctx.model
  const cols: number[] = (m?.elemRecs || []).filter((r: any) => r.type === 'col').map((r: any) => r.id)
  if (cols.length) {
    const lc = (m.loadCases || []).filter((l: any) => l.type === 'D' || l.type === 'L').map((l: any) => l.name + '(ST)')
    out.push({ key: 'CF', type: 'BEAMFORCE', lcs: [...lc, 'EX(ST)', 'EY(ST)', ...(ctx.rs ? ['RSX(RS)', 'RSY(RS)'] : [])],
      extra: { NODE_ELEMS: { KEYS: cols }, PARTS: ['PartI'] } })
  }
  return out
}

/* ── 표 읽기 ── */
const rowsOf = (j: any, key: string): Record<string, string>[] => {
  const tb = j?.[key]; if (!tb?.HEAD || !tb?.DATA) return []
  return tb.DATA.map((r: string[]) => Object.fromEntries(tb.HEAD.map((h: string, i: number) => [h, r[i]])))
}
/** 층 = 표의 Level(층 바닥 m) ↔ elev[s-1] */
function storyByLevel(elev: number[], level: number): number {
  for (let s = 1; s < elev.length; s++) if (Math.abs(elev[s - 1] / 1000 - level) < 0.01) return s
  return -1
}

/** GB 50010 表 4.1.4-1 fc (N/mm²) */
const FC: Record<string, number> = { C25: 11.9, C30: 14.3, C35: 16.7, C40: 19.1, C45: 21.1, C50: 23.1, C55: 25.3, C60: 27.5 }
/** GB 50011 表 6.3.6 [一, 二, 三, 四] */
const MU_LIM = { frame: [0.65, 0.75, 0.85, 0.90], wall: [0.75, 0.85, 0.90, 0.95] }

export interface CnExtraInfo {
  sys: 'frame' | 'frameWall' | 'frameCore'
  tall: boolean
  H: number
  frameGrade: number   // 0 = 特一 … 4 = 四
  /** 층별 1.2D+1.4L (kN, index = story) */
  grav: { D: number[]; L: number[] }
  nb: number           // 지하층 수
}

export function cnExtraItems(p: BuildingSpec, data: Record<string, any>, model: any, info: CnExtraInfo): ReviewItem[] {
  const items: ReviewItem[] = []
  const elev: number[] = model?.elev?.length ? model.elev : RC.storyElevations(p)
  const n = p.stories, nb = info.nb, wallSys = info.sys !== 'frame'
  const hOf = (s: number) => ((elev[s] || 0) - (elev[s - 1] || 0)) / 1000
  const Gd = (s: number) => 1.2 * (info.grav.D[s] || 0) + 1.4 * (info.grav.L[s] || 0)

  /* 층 강성 K(s) (kN/m) — 방향별 */
  const K: Record<'X' | 'Y', number[]> = { X: [], Y: [] }
  for (const [d, key] of [['X', 'KX'], ['Y', 'KY']] as const)
    for (const r of rowsOf(data[key], key)) { const s = storyByLevel(elev, num(r.Level)); if (s > 0) K[d][s] = num(r['Story Stiffness']) }

  /* 1) 侧向刚度比 — 지상층(nb+1 … n-1) */
  for (const d of ['X', 'Y'] as const) {
    const k = K[d]
    let worst: { s: number; v: number; lim: number; kind: string } | null = null
    for (let s = nb + 1; s < n; s++) {
      if (!(k[s] > 0 && k[s + 1] > 0)) continue
      const cands: { v: number; lim: number; kind: string }[] = []
      if (wallSys && info.tall) {
        const g2 = (k[s] / k[s + 1]) * (hOf(s) / hOf(s + 1))
        const lim = s === nb + 1 ? 1.5 : hOf(s) > 1.5 * hOf(s + 1) ? 1.1 : 0.9
        cands.push({ v: g2, lim, kind: 'γ2' })
      } else {
        cands.push({ v: k[s] / k[s + 1], lim: 0.7, kind: 'γ1' })
        const up = [1, 2, 3].map(i => k[s + i]).filter(x => x > 0)
        if (up.length === 3) cands.push({ v: k[s] / (up.reduce((a, b) => a + b, 0) / 3), lim: 0.8, kind: 'γ1·3' })
      }
      for (const c of cands) if (!worst || c.v / c.lim < worst.v / worst.lim) worst = { s, ...c }
    }
    const clause = wallSys && info.tall ? 'JGJ 3 3.5.2-2' : info.tall ? 'JGJ 3 3.5.2-1' : 'GB 50011 3.4.3'
    items.push(worst
      ? { id: 'stiff', label: t('rv_stiff'), dir: d, value: worst.v.toFixed(2), limit: `≥ ${worst.lim}${worst.kind === 'γ1·3' ? ` (${t('rv_stiff_avg3')})` : ''}`,
          status: worst.v >= worst.lim ? 'ok' : 'warn', where: storyName(p, worst.s), clause,
          note: worst.v >= worst.lim ? t('rv_stiff_note') : t('rv_stiff_soft') }
      : { id: 'stiff', label: t('rv_stiff'), dir: d, value: '-', limit: '-', status: 'info', clause, note: t('rv_no_data') })
  }

  /* 2) 刚重比 */
  const Habove = info.H
  const sumG = (from: number) => { let g = 0; for (let s = from; s <= n; s++) g += Gd(s); return g }
  for (const [d, kS, uK] of [['X', 'KSX', 'UX'], ['Y', 'KSY', 'UY']] as const) {
    if (!wallSys) {
      let worst: { s: number; v: number } | null = null
      for (let s = nb + 1; s <= n; s++) {
        const Di = K[d][s]; if (!(Di > 0)) continue
        const v = Di * hOf(s) / sumG(s)
        if (!worst || v < worst.v) worst = { s, v }
      }
      items.push(stabItem(d, worst ? worst.v : NaN, 10, 20, 'Di·hi/ΣGj', worst ? storyName(p, worst.s) : undefined))
    } else {
      /* 정적 V0(지상 1층 전단) · u(지상 최상층 − 嵌固端 평균변위) */
      const kRows = rowsOf(data[data[kS] ? kS : d === 'X' ? 'KX' : 'KY'], data[kS] ? kS : d === 'X' ? 'KX' : 'KY')
      const v0 = num(kRows.find(r => storyByLevel(elev, num(r.Level)) === nb + 1)?.['Story Shear Force'])
      const uRows = rowsOf(data[uK], uK)
      const avgAt = (lv: number) => num(uRows.find(r => Math.abs(num(r.Level) - lv) < 0.01)?.AverageDisplacement)
      const u = avgAt(elev[n] / 1000) - (nb ? avgAt(elev[nb] / 1000) : 0)
      const ejd = v0 > 0 && u > 0 ? 11 * v0 * Habove ** 3 / (60 * u) : NaN
      const v = ejd / (Habove * Habove * sumG(nb + 1))
      items.push(stabItem(d, v, 1.4, 2.7, 'EJd/(H²ΣG)', isFinite(ejd) ? `EJd=${(ejd / 1e6).toFixed(2)}e6 kN·m²` : undefined))
    }
  }

  /* 3) 倾覆力矩比 (벽 有) — 嵌固端 층(nb+1) 기준 */
  let frameRatio: number | null = null
  const cf = rowsOf(data.CF, 'CF')
  const recs: any[] = model?.elemRecs || []
  const colStory = new Map<number, number>(recs.filter(r => r.type === 'col').map(r => [r.id, r.iz]))
  if (wallSys && cf.length) {
    for (const [d, lc, oKey] of [['X', 'EX', 'OX'], ['Y', 'EY', 'OY']] as const) {
      /* 층별 기둥 전단 합 — 방향 성분은 합이 큰 쪽(기둥 국부축: EX → Shear-z, 라이브) */
      const sy: number[] = [], sz: number[] = []
      for (const r of cf) {
        if (String(r.Load).replace(/\(.*\)$/, '') !== lc) continue
        const s = colStory.get(+r.Elem); if (!s) continue
        sy[s] = (sy[s] || 0) + num(r['Shear-y']); sz[s] = (sz[s] || 0) + num(r['Shear-z'])
      }
      let mc = 0
      for (let s = nb + 1; s <= n; s++) { const v = Math.abs(sz[s] || 0) >= Math.abs(sy[s] || 0) ? sz[s] : sy[s]; mc += Math.abs(v || 0) * hOf(s) }
      const tb = data[oKey]?.[oKey]
      let m0 = NaN
      if (tb?.HEAD) {
        const H = tb.HEAD as string[], fi = H.indexOf('Overturning Moment by Vertical Member Types/Frame/Value'), wi = H.indexOf('Overturning Moment by Vertical Member Types/Wall/Value')
        const fi2 = H.indexOf('Overturning Moment by Vertical Member Types/Frame/Value', fi + 1), wi2 = H.indexOf('Overturning Moment by Vertical Member Types/Wall/Value', wi + 1)
        const row = (tb.DATA as string[][]).find(r => storyByLevel(elev, num(r[H.indexOf('Level')])) === nb + 1)
        if (row) m0 = Math.max(Math.abs((num(row[fi]) || 0) + (num(row[wi]) || 0)), fi2 > 0 ? Math.abs((num(row[fi2]) || 0) + (num(row[wi2]) || 0)) : 0)   // EY 는 Angle1 열이 '-' (라이브)
      }
      const r = m0 > 0 ? mc / m0 : NaN
      if (isFinite(r)) frameRatio = Math.max(frameRatio ?? 0, r)
      const band = !isFinite(r) ? '' : r <= 0.1 ? t('rv_otm_1') : r <= 0.5 ? t('rv_otm_2') : r <= 0.8 ? t('rv_otm_3') : t('rv_otm_4')
      items.push({ id: 'otm', label: t('rv_otm'), dir: d, value: isFinite(r) ? `${(r * 100).toFixed(1)}%` : '-', limit: '10% · 50% · 80%',
        status: !isFinite(r) ? 'info' : r > 0.5 ? 'warn' : 'info', where: band, clause: 'JGJ 3 8.1.3 / GB 50011 6.1.3', note: t('rv_otm_note') })
    }
  }

  /* 4) 轴压比 */
  if (cf.length) {
    const lcType = new Map<string, string>((model?.loadCases || []).map((l: any) => [l.name, l.type]))
    const N = new Map<number, { D: number; L: number; E: number }>()
    const eCases = data.CF && cf.some(r => /^RS[XY]/.test(String(r.Load))) ? ['RSX', 'RSY'] : ['EX', 'EY']
    for (const r of cf) {
      const id = +r.Elem, lc = String(r.Load).replace(/\(.*\)$/, ''), a = num(r.Axial)
      const o = N.get(id) || { D: 0, L: 0, E: 0 }
      if (lcType.get(lc) === 'D') o.D += a
      else if (lcType.get(lc) === 'L') o.L += a
      else if (eCases.includes(lc)) o.E = Math.max(o.E, Math.abs(a))
      N.set(id, o)
    }
    const secs = model?.sections || {}, mats: string[] = model?.secReg?.mats || model?.materials || []
    const useFrame = !wallSys || (frameRatio != null && frameRatio > 0.5)
    const g = info.frameGrade
    const base = (useFrame ? MU_LIM.frame : MU_LIM.wall)[Math.max(0, Math.min(3, (g || 1) - 1))]
    const lim = +(g === 0 ? base - 0.05 : base).toFixed(2)
    let worst: { id: number; mu: number; s: number } | null = null
    for (const rec of recs.filter(r => r.type === 'col')) {
      const f = N.get(rec.id); const sc = secs[rec.sect]; if (!f || !sc) continue
      const mat = String(mats[(rec.matl || 1) - 1] || p.matName), fc = FC[mat]; if (!fc) continue
      const Nc = -1.3 * (f.D + 0.5 * f.L) + 1.4 * f.E          // 압축 + (Gen 압축 = 음수)
      const mu = Nc * 1000 / (fc * sc.H * sc.B)
      if (!worst || mu > worst.mu) worst = { id: rec.id, mu, s: rec.iz }
    }
    items.push(worst
      ? { id: 'axial', label: t('rv_axial'), value: worst.mu.toFixed(2), limit: `≤ ${lim} (${useFrame ? '框架' : '框架-抗震墙'} · ${['特一', '一', '二', '三', '四'][g]})`,
          status: worst.mu <= lim ? 'ok' : 'ng', where: `${storyName(p, worst.s)} · #${worst.id}`, clause: g === 0 ? 'GB 50011 6.3.6 / JGJ 3 3.10.4' : 'GB 50011 6.3.6', note: t('rv_axial_note', eCases.join('/')) }
      : { id: 'axial', label: t('rv_axial'), value: '-', limit: `≤ ${lim}`, status: 'info', clause: 'GB 50011 6.3.6', note: t('rv_no_data') })
  }

  /* 5) 嵌固端刚度比 — 지하층 있을 때 (附录 E.0.1 등가전단강성) */
  if (nb >= 1) {
    const nodes = new Map<number, any>((model?.nodes || []).map((x: any) => [x.id, x]))
    const shearArea = (s: number, d: 'X' | 'Y') => {
      const h = hOf(s) * 1000
      let A = 0
      for (const w of (model?.walls || []).filter((w: any) => w.story === s)) {
        const a = nodes.get(w.nodes[0]), b = nodes.get(w.nodes[1]); if (!a || !b) continue
        const along = d === 'X' ? Math.abs(b.x - a.x) : Math.abs(b.y - a.y)
        A += along * w.thick
      }
      for (const r of recs.filter(r => r.type === 'col' && r.iz === s)) {
        const sc = model?.sections?.[r.sect]; if (!sc) continue
        const hc = d === 'X' ? sc.H : sc.B                       // 기둥 국부 z(=단면 H) ∥ 전역 X (라이브: EX → Shear-z)
        A += Math.min(1, 2.5 * (hc / h) ** 2) * sc.H * sc.B
      }
      return A / h
    }
    for (const d of ['X', 'Y'] as const) {
      const k0 = shearArea(nb, d), k1 = shearArea(nb + 1, d)
      const r = k1 > 0 ? k0 / k1 : NaN
      items.push({ id: 'embed', label: t('rv_embed'), dir: d, value: isFinite(r) ? r.toFixed(2) : '-', limit: '≥ 2', status: !isFinite(r) ? 'info' : r >= 2 ? 'ok' : 'warn',
        where: `${storyName(p, nb)} / ${storyName(p, nb + 1)}`, clause: 'JGJ 3 5.3.7 · E.0.1 / GB 50011 6.1.14', note: t('rv_embed_note') })
    }
  }

  /* 6) 风振舒适度 — 150m 이상만 안내 */
  if (info.H >= 150)
    items.push({ id: 'comfort', label: t('rv_comfort'), value: '-', limit: p.bldgType === 'apartment' ? '≤ 0.15 m/s²' : '≤ 0.25 m/s²', status: 'info', clause: 'JGJ 3 3.7.6', note: t('rv_comfort_note') })
  return items
}

function stabItem(d: 'X' | 'Y', v: number, lo: number, hi: number, f: string, where?: string): ReviewItem {
  return { id: 'stab', label: t('rv_stab'), dir: d, value: isFinite(v) ? v.toFixed(2) : '-', limit: `≥ ${lo} (${f}) · ≥ ${hi} ${t('rv_stab_pd')}`,
    status: !isFinite(v) ? 'info' : v < lo ? 'ng' : v < hi ? 'warn' : 'ok', where, clause: 'JGJ 3 5.4.4 / 5.4.1',
    note: !isFinite(v) ? t('rv_no_data') : v < hi ? t('rv_stab_need_pd') : t('rv_stab_note') }
}

function storyName(p: BuildingSpec, s: number): string {
  const g = RC.deriveFloorGroups(p)
  let nb = 0
  for (let i = 1; i <= p.stories; i++) if (g[i] && g[i].role === 'BASEMENT') nb = i
  return s <= nb ? `B${nb - s + 1}` : `${s - nb}F`
}
