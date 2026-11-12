/* Behavior-preserving port of shared/rc_engine.js. Equations and iteration order are unchanged. */
import type {
  BuildingSpec,
  CoreInput,
  BearingInput,
  CoreLayout,
  CoreWall,
  LineWall,
  WallDefinition,
  FrameNode,
  FrameEdge,
  ColumnMeta,
  BeamMeta,
  LinkMeta,
  Frame,
  FrameWall,
  ApiNode,
  ApiElement,
  DetectedFloorGroup,
} from './types'

export function asSpans(span: number | number[] | undefined, bays?: number) {
  return Array.isArray(span)
    ? span.map(Number)
    : Array.from({ length: Math.max(1, bays || 1) }, () => +span!)
}

export function cumPos(arr: number[]) {
  const o = [0]
  arr.forEach(d => o.push(o[o.length - 1] + (+d || 0)))
  return o
}

export function buildFrame(p: BuildingSpec): Frame {
  const nodes: FrameNode[] = [],
    cols: FrameEdge[] = [],
    beams: FrameEdge[] = [],
    links: FrameEdge[] = [],
    map: Record<string, number> = {}
  let nid = 0
  const colMeta: ColumnMeta[] = [],
    beamMeta: BeamMeta[] = [],
    linkMeta: LinkMeta[] = []
  const elev = [0]
  if (p.groups && p.groups.length) {
    const hByS: Record<number, number> = {}
    p.groups.forEach(g => {
      for (let s = g.from; s <= g.to; s++) hByS[s] = g.h
    })
    for (let s = 1; s <= p.stories; s++)
      elev.push(elev[s - 1] + (hByS[s] || p.hTyp || 3000))
  } else {
    for (let s = 1; s <= p.stories; s++)
      elev.push(elev[s - 1] + (s === 1 ? p.h1 : p.hTyp))
  }
  const sx = asSpans(p.spanX, p.bayX),
    sy = asSpans(p.spanY, p.bayY)
  const nbx = sx.length,
    nby = sy.length // 실제 X/Y 跨 수
  const Xp = cumPos(sx),
    Yp = cumPos(sy) // 누적 좌표 (길이 = 跨수+1)
  const npx = nbx + 1,
    npy = nby + 1,
    bW = Xp[nbx]
  const floorGroups: Record<string, number[]> = {}
  for (let b = 0; b < p.buildings; b++) {
    const ox = b * (bW + p.gap)
    for (let iz = 0; iz <= p.stories; iz++)
      for (let iy = 0; iy < npy; iy++)
        for (let ix = 0; ix < npx; ix++) {
          nid++
          nodes.push({ id: nid, x: ox + Xp[ix], y: Yp[iy], z: elev[iz] })
          map[`${b},${ix},${iy},${iz}`] = nid
          if (iz >= 1) {
            ;(floorGroups[b + '_' + iz] = floorGroups[b + '_' + iz] || []).push(
              nid,
            )
          }
        }
  }
  const N: (b: number, ix: number, iy: number, iz: number) => number = (
    b,
    ix,
    iy,
    iz,
  ) => map[`${b},${ix},${iy},${iz}`]
  /* 벽 그리드 편집 — 벽 패널 테두리 점(층별)·수평 테두리(레벨별). 내력벽(bearing.on)이면 벽 속 기둥 생략, 벽 위 보 = inWall(자중 0) */
  const wallEdges: {
    b: number
    x0: number
    y0: number
    x1: number
    y1: number
    from: number
    to: number
    w: WallDefinition
  }[] = [] // {b, x0,y0,x1,y1, from, to}
  ;(p.walls || []).forEach(w => {
    const from = Math.max(1, w.from || 1),
      to = Math.min(p.stories, w.to || p.stories),
      b = Math.min(w.building || 0, p.buildings - 1)
    const run: (dir: string, ix: number, iy: number, bays: number) => void = (
      dir,
      ix,
      iy,
      bays,
    ) => {
      for (let k = 0; k < Math.max(1, bays); k++) {
        if (dir === 'Y')
          wallEdges.push({
            b,
            x0: ix,
            y0: iy + k,
            x1: ix,
            y1: iy + k + 1,
            from,
            to,
            w,
          })
        else
          wallEdges.push({
            b,
            x0: ix + k,
            y0: iy,
            x1: ix + k + 1,
            y1: iy,
            from,
            to,
            w,
          })
      }
    }
    if (w.kind === 'core') {
      const x0 = Math.min(w.ix0, w.ix1),
        x1 = Math.max(w.ix0, w.ix1),
        y0 = Math.min(w.iy0, w.iy1),
        y1 = Math.max(w.iy0, w.iy1)
      run('X', x0, y0, x1 - x0)
      run('X', x0, y1, x1 - x0)
      run('Y', x0, y0, y1 - y0)
      run('Y', x1, y0, y1 - y0)
    } else run(w.dir || 'X', w.ix || 0, w.iy || 0, w.bays || 1)
  })
  const wallPt = new Set(),
    wallLine = new Set()
  const ek: (
    b: number,
    x0: number,
    y0: number,
    x1: number,
    y1: number,
  ) => string = (b, x0, y0, x1, y1) =>
    x0 < x1 || (x0 === x1 && y0 < y1)
      ? `${b}|${x0},${y0}|${x1},${y1}`
      : `${b}|${x1},${y1}|${x0},${y0}`
  wallEdges.forEach(e => {
    for (let s = e.from; s <= e.to; s++) {
      wallPt.add(`${e.b},${e.x0},${e.y0},${s}`)
      wallPt.add(`${e.b},${e.x1},${e.y1},${s}`)
      wallLine.add(ek(e.b, e.x0, e.y0, e.x1, e.y1) + '@' + (s - 1))
      wallLine.add(ek(e.b, e.x0, e.y0, e.x1, e.y1) + '@' + s)
    }
  })
  const colOmit = !!(p.bearing && p.bearing.on)
  for (let b = 0; b < p.buildings; b++)
    for (let iz = 0; iz < p.stories; iz++)
      for (let iy = 0; iy < npy; iy++)
        for (let ix = 0; ix < npx; ix++) {
          if (colOmit && wallPt.has(`${b},${ix},${iy},${iz + 1}`)) continue
          const n1 = N(b, ix, iy, iz),
            n2 = N(b, ix, iy, iz + 1)
          cols.push([n1, n2])
          colMeta.push({ n1, n2, b, iz: iz + 1 })
        }
  for (let b = 0; b < p.buildings; b++)
    for (let iz = 1; iz <= p.stories; iz++) {
      for (let iy = 0; iy < npy; iy++)
        for (let ix = 0; ix < nbx; ix++) {
          const n1 = N(b, ix, iy, iz),
            n2 = N(b, ix + 1, iy, iz)
          beams.push([n1, n2])
          beamMeta.push({
            n1,
            n2,
            b,
            iz,
            inWall: wallLine.has(ek(b, ix, iy, ix + 1, iy) + '@' + iz),
          })
        }
      for (let ix = 0; ix < npx; ix++)
        for (let iy = 0; iy < nby; iy++) {
          const n1 = N(b, ix, iy, iz),
            n2 = N(b, ix, iy + 1, iz)
          beams.push([n1, n2])
          beamMeta.push({
            n1,
            n2,
            b,
            iz,
            inWall: wallLine.has(ek(b, ix, iy, ix, iy + 1) + '@' + iz),
          })
        }
    }
  if (p.buildings >= 2 && p.connectFloor >= 1 && p.connectFloor <= p.stories) {
    const iz = p.connectFloor
    for (let iy = 0; iy < npy; iy++) {
      const n1 = N(0, nbx, iy, iz),
        n2 = N(1, 0, iy, iz)
      links.push([n1, n2])
      linkMeta.push({ n1, n2, iz })
    }
  }
  const baseNodes = nodes.filter(n => n.z === 0).map(n => n.id)
  const floorCorners: Record<string, number[]> = {}
  for (let b = 0; b < p.buildings; b++)
    for (let iz = 1; iz <= p.stories; iz++)
      floorCorners[b + '_' + iz] = [
        N(b, 0, 0, iz),
        N(b, nbx, 0, iz),
        N(b, nbx, nby, iz),
        N(b, 0, nby, iz),
      ]
  /* ── 전단벽/코어 패널 (PLATE) — 그리드 정렬, 기존 절점 재사용, 베이·층 단위 메시 ──
     spec.walls 항목:
       {kind:'wall', dir:'X'|'Y', ix, iy, bays, from, to, thick}  // 한 줄 벽
       {kind:'core', ix0, iy0, ix1, iy1, from, to, thick}          // 사각 코어(4면)
     ix/iy = 0-based 그리드 교점 인덱스, from/to = 1-based story(미지정 시 전층), thick = mm */
  const walls: FrameWall[] = []
  const wallThks: Set<number> = new Set()
  const seen = new Set() // 코어·내력벽 겹침 패널 중복 제거
  ;(p.walls || []).forEach((w, wi) => {
    const from = Math.max(1, w.from || 1),
      to = Math.min(p.stories, w.to || p.stories)
    const b = Math.min(w.building || 0, p.buildings - 1),
      thick = +w.thick! || 250
    const edges: number[][] = []
    const addRun: (dir: string, ix: number, iy: number, bays: number) => void =
      (dir, ix, iy, bays) => {
        for (let k = 0; k < Math.max(1, bays); k++) {
          if (dir === 'Y') edges.push([ix, iy + k, ix, iy + k + 1])
          else edges.push([ix + k, iy, ix + k + 1, iy])
        }
      }
    if (w.kind === 'core') {
      const x0 = Math.min(w.ix0, w.ix1),
        x1 = Math.max(w.ix0, w.ix1)
      const y0 = Math.min(w.iy0, w.iy1),
        y1 = Math.max(w.iy0, w.iy1)
      addRun('X', x0, y0, x1 - x0)
      addRun('X', x0, y1, x1 - x0) // 하·상변
      addRun('Y', x0, y0, y1 - y0)
      addRun('Y', x1, y0, y1 - y0) // 좌·우변
    } else addRun(w.dir || 'X', w.ix || 0, w.iy || 0, w.bays || 1)
    for (let s = from; s <= to; s++) {
      const izb = s - 1,
        izt = s
      edges.forEach(e => {
        const n1 = N(b, e[0], e[1], izb),
          n2 = N(b, e[2], e[3], izb),
          n3 = N(b, e[2], e[3], izt),
          n4 = N(b, e[0], e[1], izt)
        const dk = [n1, n2, n3, n4]
          .slice()
          .sort((a, c) => a - c)
          .join(',')
        if (n1 && n2 && n3 && n4 && !seen.has(dk)) {
          seen.add(dk)
          walls.push({
            nodes: [n1, n2, n3, n4],
            thick,
            story: s,
            building: b,
            w: wi,
          })
          wallThks.add(thick)
        }
      })
    }
  })
  return {
    nodes,
    cols,
    beams,
    links,
    colMeta,
    beamMeta,
    linkMeta,
    baseNodes,
    elev,
    floorGroups,
    floorCorners,
    walls,
    wallThks: [...wallThks].sort((a, b) => a - b),
  }
}

export function coreLayout(
  p: Partial<BuildingSpec>,
  c?: CoreInput,
): CoreLayout {
  c = c || {}
  const nbx = asSpans(p.spanX, p.bayX).length,
    nby = asSpans(p.spanY, p.bayY).length
  const nx = Math.min(Math.max(1, Math.round(+c.nx! || 1)), nbx),
    ny = Math.min(Math.max(1, Math.round(+c.ny! || 1)), nby)
  const fit: (
    v: number | string | null | undefined,
    nb: number,
    n: number,
  ) => number = (v, nb, n) =>
    v == null || v === '' || !isFinite(+v)
      ? Math.max(0, Math.floor((nb - n) / 2))
      : Math.min(Math.max(0, Math.round(+v)), nb - n)
  const A = { ix: fit(c.ix, nbx, nx), iy: fit(c.iy, nby, ny) }
  const layout: CoreLayout['layout'] = ['mirror', 'each'].includes(c.layout!)
    ? c.layout!
    : 'same'
  const skip = Array.isArray(c.skip) ? c.skip.map(Number) : []
  const towers: CoreLayout['towers'] = []
  for (let b = 0; b < Math.max(1, p.buildings || 1); b++) {
    let q = A
    if (b > 0 && layout === 'mirror' && b % 2 === 1)
      q = { ix: nbx - nx - A.ix, iy: A.iy }
    else if (b > 0 && layout === 'each') {
      const e = (c.pos || [])[b] || {}
      q = {
        ix: fit(e.ix != null ? e.ix : A.ix, nbx, nx),
        iy: fit(e.iy != null ? e.iy : A.iy, nby, ny),
      }
    }
    towers.push({ building: b, on: !skip.includes(b), ix: q.ix, iy: q.iy })
  }
  return { nbx, nby, nx, ny, layout, towers }
}

export function coreWalls(p: Partial<BuildingSpec>, c?: CoreInput): CoreWall[] {
  const L = coreLayout(p, c),
    thick = +(c && c.thick)! || 250
  return L.towers
    .filter(t => t.on)
    .map(t => ({
      kind: 'core',
      building: t.building,
      ix0: t.ix,
      iy0: t.iy,
      ix1: t.ix + L.nx,
      iy1: t.iy + L.ny,
      from: 1,
      to: p.stories,
      thick,
    }))
}

export function bearingWalls(
  p: Partial<BuildingSpec>,
  bw?: BearingInput,
): LineWall[] {
  bw = bw || {}
  const thick = +bw.thick! || 200
  const nbx = asSpans(p.spanX, p.bayX).length,
    nby = asSpans(p.spanY, p.bayY).length
  const out: LineWall[] = []
  for (let b = 0; b < Math.max(1, p.buildings || 1); b++) {
    for (let ix = 0; ix <= nbx; ix++)
      out.push({
        kind: 'wall',
        dir: 'Y',
        ix,
        iy: 0,
        bays: nby,
        from: 1,
        to: p.stories,
        thick,
        building: b,
        bearing: true,
      })
    if (nby >= 2) {
      const iy = Math.floor(nby / 2)
      for (let ix = 0; ix < nbx; ix++)
        if (Math.min(ix, nbx - 1 - ix) % 2 === 0)
          // 양 끝에서 한 베이 걸러 — 좌우 대칭(비틀림)
          out.push({
            kind: 'wall',
            dir: 'X',
            ix,
            iy,
            bays: 1,
            from: 1,
            to: p.stories,
            thick,
            building: b,
            bearing: true,
          })
    }
  }
  return out
}

export function resolveWalls(p: Partial<BuildingSpec>): WallDefinition[] {
  const c = p.core || {},
    bw = p.bearing || {}
  return c.on || bw.on ? specWalls(p) : Array.isArray(p.walls) ? p.walls : []
}

export function specWalls(p: Partial<BuildingSpec>): WallDefinition[] {
  const c = p.core || {},
    bw = p.bearing || {}
  return [
    ...(c.on ? coreWalls(p, c) : []),
    ...(bw.on ? bearingWalls(p, bw) : []),
  ]
}

export function storyElevations(spec: BuildingSpec): number[] {
  const elev = [0]
  if (spec.groups && spec.groups.length) {
    const hByS: Record<number, number> = {}
    spec.groups.forEach(g => {
      for (let s = g.from; s <= g.to; s++) hByS[s] = g.h
    })
    for (let s = 1; s <= spec.stories; s++)
      elev.push(elev[s - 1] + (hByS[s] || spec.hTyp || 3000))
  } else
    for (let s = 1; s <= spec.stories; s++)
      elev.push(elev[s - 1] + (s === 1 ? spec.h1 : spec.hTyp))
  return elev
}

export function planAreaM2(spec: BuildingSpec): number {
  const Xp = cumPos(asSpans(spec.spanX, spec.bayX)),
    Yp = cumPos(asSpans(spec.spanY, spec.bayY))
  const Lx = Xp[Xp.length - 1] || 0,
    Ly = Yp[Yp.length - 1] || 0
  return (Lx * Ly) / 1e6
}

export function detectTypicalFloors(
  nodes: FrameNode[] | Record<string, ApiNode>,
  elems: ApiElement[] | Record<string, ApiElement>,
) {
  const N: Record<string, { x: number; y: number; z: number }> = {}
  if (Array.isArray(nodes))
    nodes.forEach(n => {
      N[n.id] = { x: +n.x, y: +n.y, z: +n.z }
    })
  else
    for (const id in nodes || {}) {
      const v = nodes[id]
      N[id] = { x: +v.X, y: +v.Y, z: +v.Z }
    }
  const E = Array.isArray(elems) ? elems : Object.values(elems || {})
  const R1: (z: number) => number = z => Math.round(z * 10) / 10
  const zof: (id: number) => number | null = id => (N[id] ? R1(N[id].z) : null)
  const levels = [...new Set(Object.values(N).map(n => R1(n.z)))].sort(
    (a, b) => a - b,
  )
  const lvi: Record<number, number> = {}
  levels.forEach((z, i) => {
    lvi[z] = i
  })
  const nstory = levels.length - 1
  const colS: Record<number, number[]> = {},
    beamS: Record<number, number[]> = {},
    plate: Record<number, boolean> = {}
  E.forEach(e => {
    const nd = (e.NODE || []).filter(x => x)
    const zs = nd.map(zof).filter(z => z != null)
    if (!zs.length) return
    if (e.TYPE === 'BEAM') {
      if ([...new Set(zs)].length >= 2) {
        const s = lvi[Math.max(...zs)]
        if (s >= 1) (colS[s] = colS[s] || []).push(e.SECT)
      } else {
        const s = lvi[zs[0]]
        if (s >= 1) (beamS[s] = beamS[s] || []).push(e.SECT)
      }
    } else if (e.TYPE === 'PLATE' || e.TYPE === 'WALL') {
      const s = lvi[Math.max(...zs)]
      if (s >= 1) plate[s] = true
    }
  })
  const sig: (story: number) => string = s =>
    JSON.stringify([
      R1(levels[s] - levels[s - 1]),
      [...new Set(colS[s] || [])].sort(),
      [...new Set(beamS[s] || [])].sort(),
      !!plate[s],
    ])
  const groups: DetectedFloorGroup[] = []
  for (let s = 1; s <= nstory; s++) {
    const g = sig(s)
    const last = groups[groups.length - 1]
    if (last && last.sig === g) {
      last.to = s
    } else
      groups.push({
        from: s,
        to: s,
        sig: g,
        h: R1(levels[s] - levels[s - 1]),
        colSects: [...new Set(colS[s] || [])].sort((a, b) => a - b),
        beamSects: [...new Set(beamS[s] || [])].sort((a, b) => a - b),
        hasSlab: !!plate[s],
      })
  }
  return { levels, stories: nstory, baseZ: levels[0], groups }
}
