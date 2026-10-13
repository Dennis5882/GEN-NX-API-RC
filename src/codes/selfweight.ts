/* ════════════════════════════════════════════════════════════
   모델 고정하중 — Gen NX 가 질량으로 쓰는 것과 같은 출처에서 층별 중량을 산정.
   부재 자중(BODF: 기둥·보·연결보·전단벽) + 바닥 DL(마감 SDL + 슬래브 자중).
   정적 지진 중량이 동적해석 질량과 어긋나지 않게 하는 단일 출처(w0 미입력 시).
════════════════════════════════════════════════════════════ */
import { RC } from '../engine'
import type { BuildingSpec } from '../engine/types'
import type { CodeProfile } from './types'

/** 슬래브 두께 기본값 (mm) — 바닥판을 요소로 만들지 않으므로 바닥 DL 에 자중으로 얹는다 */
export const SLAB_THK_DEF = 150

export function slabThk(p: BuildingSpec): number {
  const raw: unknown = p.slabThk
  const v = raw == null || raw === '' ? NaN : Number(raw)
  return isFinite(v) && v >= 0 ? v : SLAB_THK_DEF
}

/** 지상 높이 H (m) — 지하층(BASEMENT) 제외. 예: GB 50011 5.1.2 '高度不超过40m' 판정 */
export function heightAboveGround(p: BuildingSpec): number {
  const elev = RC.storyElevations(p)
  const g = RC.deriveFloorGroups(p)
  let nb = 0
  for (let s = 1; s <= p.stories; s++) if (g[s] && g[s].role === 'BASEMENT') nb = s
  return ((elev[p.stories] || 0) - (elev[nb] || 0)) / 1000
}

/** 슬래브 자중 kN/m² = 두께 × γc */
export const slabLoad = (p: BuildingSpec, prof: CodeProfile): number => slabThk(p) / 1000 * prof.concreteGamma

/** 층별 고정하중 W_D[s] (kN, s=1..stories). 기둥·벽은 아래·위 층에 반씩, 보·바닥은 그 층.
    지반(0층)으로 가는 몫은 질량에서 빠지므로 제외 — Gen NX 질량 집계와 같은 방식. */
export function modelDeadWeights(p: BuildingSpec, prof: CodeProfile): number[] {
  const core: any = p.core
  const q: BuildingSpec = core && core.on && !(Array.isArray(p.walls) && p.walls.length)
    ? { ...p, walls: RC.coreWalls(p, core) } : p
  const f = RC.buildFrame(q)
  const R = RC.specSections(q)
  const g = RC.deriveFloorGroups(q)
  const gam = prof.concreteGamma
  const xyz: Record<number, { x: number; y: number; z: number }> = {}
  f.nodes.forEach((n: any) => { xyz[n.id] = n })
  const len = (a: number, b: number) => Math.hypot(xyz[a].x - xyz[b].x, xyz[a].y - xyz[b].y, xyz[a].z - xyz[b].z)
  const sect = (id: number) => R.sections[id - 1] || { H: 0, B: 0 }
  const asg = (iz: number) => R.storyAssign[iz] || R.def
  const W: number[] = []
  for (let s = 0; s <= q.stories; s++) W[s] = 0
  const kN = (mm3: number) => mm3 * 1e-9 * gam
  /* 기둥·벽: 층 s 의 부재는 s-1 / s 레벨에 반씩 */
  f.colMeta.forEach((c: any) => { const sc = sect(asg(c.iz).colSect); const w = kN(sc.H * sc.B * len(c.n1, c.n2)); W[c.iz - 1] += w / 2; W[c.iz] += w / 2 })
  ;(f.walls || []).forEach((w: any) => {
    const [n1, n2, , n4] = w.nodes
    const wt = kN(w.thick * len(n1, n2) * len(n1, n4)); W[w.story - 1] += wt / 2; W[w.story] += wt / 2
  })
  /* 보·연결보: 그 층 */
  f.beamMeta.forEach((c: any) => { const sc = sect(asg(c.iz).beamSect); W[c.iz] += kN(sc.H * sc.B * len(c.n1, c.n2)) })
  f.linkMeta.forEach((c: any) => { const sc = sect(asg(c.iz).beamSect); W[c.iz] += kN(sc.H * sc.B * len(c.n1, c.n2)) })
  /* 바닥 DL: (SDL + 슬래브) × 바닥면적 — FBLA 와 같은 면적(동별 평면 × 동수) */
  const area = RC.planAreaM2(q) * (q.buildings || 1)
  const slab = slabLoad(q, prof)
  for (let s = 1; s <= q.stories; s++) {
    const fu = prof.floorUse[(g[s] && g[s].use) || 'Residential'] || prof.floorUse.Residential
    W[s] += area * ((fu ? fu.sdl : 0) + slab)
  }
  W[0] = 0
  return W
}
