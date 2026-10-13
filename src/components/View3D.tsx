/* 3D VIEW — v2 (바닐라 plot3D 1:1). Plotly 는 동적 import 로 첫 화면 번들에서 분리.
   S.preview(미리보기 스펙)가 있으면 그 형상, 없으면 현재 모델. S.viewNonce 변경 시 재플롯. */
import { useEffect, useMemo, useRef } from 'react'
import { RC } from '../engine'
import { roleLbl, t, type I18nKey } from '../i18n'
import { S, notify, useStore, type AppState, type CamId, type VisKey } from '../state/store'

type Plotly = typeof import('plotly.js-dist-min')

let plotlyP: Promise<Plotly> | null = null
const loadPlotly = () => (plotlyP ??= import('plotly.js-dist-min').then(m => ((m as any).default ?? m) as Plotly))

/* 3D 색 = 현재 테마의 CSS 변수(app.css --p-*) — 플롯할 때마다 읽어 테마 전환에 따라감 */
function palette() {
  const cs = getComputedStyle(document.documentElement)
  const v = (n: string, fb: string) => cs.getPropertyValue(n).trim() || fb
  return {
    role: { TYPICAL: v('--p-typ', '#4cc2ff'), PODIUM: v('--p-pod', '#ffb454'), ROOF: v('--p-roof', '#5ee6a8'), TRANSFER: v('--p-trans', '#ff6b6b'), BASEMENT: v('--p-base', '#9b8cff') } as Record<string, string>,
    link: v('--amber', '#ffb454'), brace: v('--violet', '#9b8cff'), wall: v('--violet', '#9b8cff'),
    node: v('--p-node', '#445069'), sup: v('--p-sup', '#ff6b6b'), supBd: v('--p-sup-bd', '#ff9999'), floor: v('--p-floor', 'rgba(68,80,105,0.35)'),
    axis: v('--p-axis', '#445069'), grid: v('--p-grid', '#1a2538'), scene: v('--p-scene', 'rgba(10,14,26,0.4)'),
    legend: v('--p-legend', 'rgba(0,0,0,0.85)'), legendBd: v('--p-legend-bd', 'rgba(31,42,61,0.5)'), txt: v('--p-txt', '#c9d4e8'),
  }
}
type Pal = ReturnType<typeof palette>
const CAMS = {
  iso: { eye: { x: 1.6, y: 1.6, z: 1.1 } },
  front: { eye: { x: 0, y: -2.5, z: 0 } },    // 정면 입면(X–Z) — 정투영이라 수평 시점
  side: { eye: { x: -2.5, y: 0, z: 0 } },     // 측면 입면(Y–Z)
  top: { eye: { x: 0, y: 0, z: 2.5 }, up: { x: 0, y: 1, z: 0 } },   // 평면: X 가로·Y 세로
} as const satisfies Record<CamId, unknown>
type Cam = CamId
const FONT = 'IBM Plex Mono, Noto Sans KR, Noto Sans TC, Noto Sans SC'

/** 표시할 형상 — 미리보기 스펙이면 buildFrame, 아니면 현재 모델 */
function frameOf(s: AppState): any | null {
  if (s.preview) return { ...RC.buildFrame(s.preview), spec: s.preview }
  const m = s.model
  if (!m.nodes.length) return null
  return { nodes: m.nodes, cols: m.cols, beams: m.beams, links: m.links, braces: m.braces, walls: m.walls,
    baseNodes: m.baseNodes, elev: m.elev, spec: m.spec }
}

function gax(title: string, P: Pal) {
  return {
    title: { text: title, font: { color: P.axis, size: 13, family: FONT } },
    color: P.axis, gridcolor: P.grid, zerolinecolor: P.grid,
    backgroundcolor: P.scene, showbackground: true,
    tickfont: { color: P.axis, size: 11, family: FONT },
  }
}

function buildTraces(f: any, vis: Record<VisKey, boolean>, P: Pal, cam: Cam) {
  const ROLE_C3 = P.role
  const byId: Record<number, { x: number; y: number; z: number }> = {}
  ;(f.nodes || []).forEach((n: any) => { byId[n.id] = n })
  const O = { x: 0, y: 0, z: 0 }
  const traces: any[] = []
  const idx: Record<VisKey, number[]> = { col: [], beam: [], node: [], floor: [] }

  /* ── 1+2. Columns & beams colored by typical-floor group (role) ── */
  const grp = f.spec ? RC.deriveFloorGroups(f.spec) : {}
  const elev: number[] = f.elev || []
  const storyOf = (z: number) => { let best = 1, bd = 1e18; for (let i = 1; i < elev.length; i++) { const d = Math.abs(elev[i] - z); if (d < bd) { bd = d; best = i } } return best }
  const roleOf = (z: number) => { const g = grp[storyOf(z)]; return (g && g.role) || 'TYPICAL' }
  const colByRole: Record<string, { x: any[]; y: any[]; z: any[] }> = {}, beamByRole: typeof colByRole = {}
  const seg = (o: { x: any[]; y: any[]; z: any[] }, A: any, B: any) => { o.x.push(A.x, B.x, null); o.y.push(A.y, B.y, null); o.z.push(A.z, B.z, null) }
  ;(f.cols || []).forEach(([a, b]: [number, number]) => {
    const A = byId[a] || O, B = byId[b] || O
    const r = roleOf(Math.max(A.z, B.z)); seg((colByRole[r] ||= { x: [], y: [], z: [] }), A, B)
  })
  ;(f.beams || []).forEach(([a, b]: [number, number]) => {
    const A = byId[a] || O, B = byId[b] || O
    const r = roleOf(A.z); seg((beamByRole[r] ||= { x: [], y: [], z: [] }), A, B)
  })
  // 기둥: 역할별 트레이스 (범례에 표준층/기단부/지붕… 표시)
  ;['BASEMENT', 'PODIUM', 'TYPICAL', 'TRANSFER', 'ROOF'].forEach(r => {
    const o = colByRole[r]; if (!o) return
    idx.col.push(traces.length)
    traces.push({ type: 'scatter3d', mode: 'lines', name: roleLbl(r), x: o.x, y: o.y, z: o.z, visible: vis.col,
      line: { color: ROLE_C3[r] || P.role.TYPICAL, width: 4 }, hoverinfo: 'skip' })
  })
  // 보: 같은 역할 색(범례 중복 방지 showlegend:false)
  Object.keys(beamByRole).forEach(r => {
    const o = beamByRole[r]
    idx.beam.push(traces.length)
    traces.push({ type: 'scatter3d', mode: 'lines', name: t('show_beam'), showlegend: false, x: o.x, y: o.y, z: o.z, visible: vis.beam,
      line: { color: ROLE_C3[r] || P.role.TYPICAL, width: 2 }, hoverinfo: 'skip' })
  })

  /* ── 3. Connecting beams · 4. Braces ── */
  const edges = (list: [number, number][] | undefined, name: string, color: string, width: number) => {
    const o = { x: [] as any[], y: [] as any[], z: [] as any[] }
    ;(list || []).forEach(([a, b]) => seg(o, byId[a] || O, byId[b] || O))
    if (o.x.length) traces.push({ type: 'scatter3d', mode: 'lines', name, ...o, line: { color, width }, hoverinfo: 'skip' })
  }
  edges(f.links, t('vs_link'), P.link, 5)
  edges(f.braces, t('vs_brace'), P.brace, 4)

  /* ── 4b. Shear-wall / core panels (PLATE) — 반투명 면 ── */
  const wn = f.walls || []
  if (wn.length) {
    const vx: number[] = [], vy: number[] = [], vz: number[] = [], ii: number[] = [], jj: number[] = [], kk: number[] = []
    let base = 0
    wn.forEach((w: any) => {
      const ns = (w.nodes || []).map((id: number) => byId[id]).filter(Boolean)
      if (ns.length < 4) return
      ns.slice(0, 4).forEach((nd: any) => { vx.push(nd.x); vy.push(nd.y); vz.push(nd.z) })
      ii.push(base, base); jj.push(base + 1, base + 2); kk.push(base + 2, base + 3); base += 4
    })
    if (base) traces.push({ type: 'mesh3d', name: t('shear_wall'), x: vx, y: vy, z: vz, i: ii, j: jj, k: kk,
      color: P.wall, opacity: 0.32, flatshading: true, hoverinfo: 'skip' })
  }

  /* ── 5. Node markers · 6. Support markers ── */
  const baseSet = new Set(f.baseNodes || [])
  const regNodes = (f.nodes || []).filter((n: any) => !baseSet.has(n.id))
  const supNodes = (f.nodes || []).filter((n: any) => baseSet.has(n.id))
  if (regNodes.length) {
    idx.node.push(traces.length)
    traces.push({ type: 'scatter3d', mode: 'markers', name: t('show_node'),
      x: regNodes.map((n: any) => n.x), y: regNodes.map((n: any) => n.y), z: regNodes.map((n: any) => n.z), visible: vis.node,
      text: regNodes.map((n: any) => `N${n.id}  (${M(n.x)}, ${M(n.y)}, ${M(n.z)}) m`),
      hovertemplate: '%{text}<extra></extra>', marker: { size: 2.5, color: P.node, opacity: 0.85 } })
  }
  if (supNodes.length) {
    idx.node.push(traces.length)
    traces.push({ type: 'scatter3d', mode: 'markers', name: t('support'),
      x: supNodes.map((n: any) => n.x), y: supNodes.map((n: any) => n.y), z: supNodes.map((n: any) => n.z), visible: vis.node,
      text: supNodes.map((n: any) => `Fixed  N${n.id}  (${M(n.x)}, ${M(n.y)}, 0) m`),
      hovertemplate: '%{text}<extra></extra>',
      marker: { size: 5, color: P.sup, symbol: 'diamond', opacity: 1, line: { color: P.supBd, width: 1 } } })
  }

  /* ── 7. Floor outline rectangles ── */
  if (f.elev && f.spec) {
    const p = f.spec
    const sx = RC.asSpans(p.spanX, p.bayX), sy = RC.asSpans(p.spanY, p.bayY)
    const Xp = RC.cumPos(sx), Yp = RC.cumPos(sy)
    const bW = Xp[sx.length], totalY = Yp[sy.length]
    const flx: any[] = [], fly: any[] = [], flz: any[] = []
    f.elev.forEach((z: number) => {
      for (let b = 0; b < p.buildings; b++) {
        const ox = b * (bW + p.gap)
        flx.push(ox, ox + bW, ox + bW, ox, ox, null)
        fly.push(0, 0, totalY, totalY, 0, null)
        flz.push(z, z, z, z, z, null)
      }
    })
    if (flx.length) {
      idx.floor.push(traces.length)
      traces.push({ type: 'scatter3d', mode: 'lines', name: t('show_floor'), x: flx, y: fly, z: flz, visible: vis.floor,
        line: { color: P.floor, width: 1 }, hoverinfo: 'skip' })
    }
  }
  /* ── 8. 축선 버블 (평면도 전용) — 기둥 위치 X1·X2… / Y1·Y2… , 지붕 높이에 점선 축선 + 바깥쪽 원 ── */
  const grid: number[] = []
  const gl = gridLines(f)
  if (gl) {
    const { xs, ys, x0, x1, y0, y1, off, z } = gl
    const lx: any[] = [], ly: any[] = [], lz: any[] = []
    xs.forEach(x => { lx.push(x, x, null); ly.push(y0 - off * 0.75, y1 + off * 0.25, null); lz.push(z, z, null) })
    ys.forEach(y => { lx.push(x0 - off * 0.75, x1 + off * 0.25, null); ly.push(y, y, null); lz.push(z, z, null) })
    grid.push(traces.length)
    traces.push({ type: 'scatter3d', mode: 'lines', name: 'grid', showlegend: false, x: lx, y: ly, z: lz, visible: cam === 'top',
      line: { color: P.axis, width: 1, dash: 'dash' }, hoverinfo: 'skip' })
    const bx = [...xs, ...ys.map(() => x0 - off)], by = [...xs.map(() => y0 - off), ...ys], bz = bx.map(() => z)
    grid.push(traces.length)
    traces.push({ type: 'scatter3d', mode: 'markers+text', name: 'grid-bubble', showlegend: false, x: bx, y: by, z: bz, visible: cam === 'top',
      text: [...xs.map((_, i) => `X${i + 1}`), ...ys.map((_, i) => `Y${i + 1}`)], textposition: 'middle center',
      textfont: { color: P.txt, size: 11, family: FONT },
      marker: { size: 8, symbol: 'circle-open', color: P.axis, line: { color: P.axis, width: 1.5 } }, hoverinfo: 'skip' })   // scatter3d 원 크기는 화면에서 약 3.5배로 보임(라이브 캡처)
  }

  /* 표시 단위 m — 모델 좌표(mm, Gen NX 전송 단위)는 그대로 두고 그릴 때만 ÷1000 (Plotly 가 30000 을 '30k' 로 줄여 쓰던 문제) */
  for (const tr of traces) for (const k of ['x', 'y', 'z'] as const) if (Array.isArray(tr[k])) tr[k] = tr[k].map((v: number | null) => (v == null ? v : v / 1000))
  return { traces, idx, grid }
}

/** 축선 — 기둥 절점의 서로 다른 X·Y 위치(mm). off = 버블을 평면 밖으로 띄우는 거리 */
function gridLines(f: any) {
  const ids = new Set<number>(); (f.cols || []).forEach(([a, b]: [number, number]) => { ids.add(a); ids.add(b) })
  const pts = (f.nodes || []).filter((n: any) => ids.has(n.id))
  if (!pts.length) return null
  const uniq = (v: number[]) => [...new Set(v.map(x => Math.round(x)))].sort((a, b) => a - b)
  const xs = uniq(pts.map((n: any) => n.x)), ys = uniq(pts.map((n: any) => n.y))
  const x0 = xs[0], x1 = xs[xs.length - 1], y0 = ys[0], y1 = ys[ys.length - 1]
  const off = Math.max(3500, 0.12 * Math.max(x1 - x0, y1 - y0))
  return { xs, ys, x0, x1, y0, y1, off, z: Math.max(...(f.nodes || []).map((n: any) => n.z)) }
}

/** mm → m 표기 (소수 둘째 자리, 끝 0 제거) */
const M = (mm: number) => String(+(mm / 1000).toFixed(2))

const layout = (P: Pal) => ({
  paper_bgcolor: 'rgba(0,0,0,0)', plot_bgcolor: 'rgba(0,0,0,0)', showlegend: true,
  legend: { font: { color: P.txt, family: FONT, size: 11 }, orientation: 'h', x: 0, y: 1.03,
    bgcolor: P.legend, bordercolor: P.legendBd, borderwidth: 1 },
  margin: { l: 0, r: 0, t: 28, b: 0 },
  modebar: { bgcolor: 'rgba(0,0,0,0)', color: P.axis, activecolor: P.txt },
})
const CONFIG = {
  responsive: true, displayModeBar: true, modeBarButtonsToRemove: ['resetCameraLastSave3d', 'hoverClosest3d'],
  displaylogo: false, toImageButtonOptions: { format: 'png', filename: 'gen_nx_model', scale: 2 },
}

function ViewStats({ f }: { f: any }) {
  if (!f) return <span style={{ color: 'var(--dim)', fontStyle: 'italic' }}>{t('view_empty')}</span>
  const n = (f.nodes || []).length, cols = (f.cols || []).length, beams = (f.beams || []).length
  const links = (f.links || []).length, braces = (f.braces || []).length
  const zH = f.nodes && f.nodes.length ? Math.max(...f.nodes.map((nd: any) => nd.z)) : 0
  const stories = f.elev ? f.elev.length - 1 : (f.spec ? f.spec.stories : '?')
  return (
    <>
      <span className="vs-item">{t('vs_node')} <span className="vs-val vs-hi">{n}</span></span>
      <span className="vs-item">{t('vs_col')} <span className="vs-val">{cols}</span></span>
      <span className="vs-item">{t('vs_beam')} <span className="vs-val">{beams}</span></span>
      {links > 0 && <span className="vs-item">{t('vs_link')} <span className="vs-val">{links}</span></span>}
      {braces > 0 && <span className="vs-item">{t('vs_brace')} <span className="vs-val vs-hi">{braces}</span></span>}
      <span style={{ flex: 1 }} />
      <span className="vs-item">{t('vs_story', stories)} · <span className="vs-val vs-hi">{(zH / 1000).toFixed(1)} m</span></span>
    </>
  )
}

export function View3D() {
  const s = useStore()
  const plotRef = useRef<HTMLDivElement>(null)
  const idxRef = useRef<Record<VisKey, number[]>>({ col: [], beam: [], node: [], floor: [] })
  const gridRef = useRef<number[]>([])   // 축선 버블 트레이스 — 평면(top)에서만 표시
  const { cam, vis, zoom } = s.view3d
  const visible = s.panel === 'viewP'
  /* 형상은 draw3D()/previewSpec() 시점(viewNonce)에만 갱신 — 바닐라와 동일 */
  const f = useMemo(() => frameOf(S), [s.viewNonce])

  /* 재플롯: nonce·언어 변경, 또는 패널이 보이게 될 때(숨김 상태에선 크기 0) */
  useEffect(() => {
    if (!visible) return
    const el = plotRef.current; if (!el) return
    let alive = true
    void loadPlotly().then(Plotly => {
      if (!alive) return
      if (!f) { Plotly.purge(el); return }
      const P = palette()
      const { traces, idx, grid } = buildTraces(f, vis, P, cam)
      idxRef.current = idx; gridRef.current = grid
      void Plotly.newPlot(el, traces, {
        ...layout(P),
        scene: { ...sceneOf(f, cam, zoom), xaxis: gax('X (m)', P), yaxis: gax('Y (m)', P), zaxis: gax('Z (m)', P), camera: camOf(cam, zoom), bgcolor: 'rgba(0,0,0,0)' },
      } as any, CONFIG as any)
    })
    return () => { alive = false }
    // vis/cam 은 restyle/relayout 으로 처리 — 재플롯 트리거에서 제외
  }, [s.viewNonce, s.lang, s.theme, visible])

  /* 카메라·표시 변경은 재플롯 없이 relayout/restyle (버튼·LLM 공통 — store 변경을 따라감) */
  useEffect(() => {
    const el = plotRef.current
    if (!visible || !el || !f) return
    const sc = sceneOf(f, cam, zoom)
    void loadPlotly().then(async P => {
      if (gridRef.current.length) await P.restyle(el, { visible: cam === 'top' } as any, gridRef.current)
      await P.relayout(el, { 'scene.camera': camOf(cam, zoom), 'scene.aspectmode': sc.aspectmode, ...(sc.aspectratio ? { 'scene.aspectratio': sc.aspectratio } : {}) } as any)
    })
  }, [cam, zoom])
  useEffect(() => {
    const el = plotRef.current
    if (!visible || !el || !f) return
    void loadPlotly().then(P => (Object.keys(vis) as VisKey[]).forEach(k => {
      const ids = idxRef.current[k]; if (ids.length) P.restyle(el, { visible: vis[k] } as any, ids)
    }))
  }, [vis.col, vis.beam, vis.node, vis.floor])

  const onCam = (c: Cam) => setView({ cam: c, zoom: 1 })
  const onToggle = (k: VisKey) => setView({ vis: { [k]: !vis[k] } })

  const camBtn = (c: Cam, key: I18nKey) => (
    <button className={`vcam${cam === c ? ' on' : ''}`} onClick={() => onCam(c)}>{t(key)}</button>
  )
  const togBtn = (k: VisKey, color: string, key: I18nKey) => (
    <button className={`vtog ${vis[k] ? 'on' : 'off'}`} onClick={() => onToggle(k)}>
      <span className="swatch" style={{ background: color }} /><span>{t(key)}</span>
    </button>
  )

  return (
    <>
      <div className="view-tb">
        <span className="vlbl">{t('cam')}</span>
        {camBtn('iso', 'cam_iso')}{camBtn('front', 'cam_front')}{camBtn('side', 'cam_side')}{camBtn('top', 'cam_top')}
        <span className="vsep" />
        <span className="vlbl">{t('show')}</span>
        {togBtn('col', 'var(--p-typ)', 'show_col')}{togBtn('beam', 'var(--cyan)', 'show_beam')}
        {togBtn('node', 'var(--p-node)', 'show_node')}{togBtn('floor', 'var(--p-floor)', 'show_floor')}
      </div>
      <div id="plot">
        {/* Plotly 전용 노드(React 자식 없음) — 빈 상태 안내는 형제 요소로 */}
        <div ref={plotRef} style={{ width: '100%', height: '100%', display: f ? 'block' : 'none' }} />
        {!f && <div className="res-empty" style={{ paddingTop: 120 }}>{t('view_empty')}</div>}
      </div>
      <div className="view-stats"><ViewStats f={f} /></div>
    </>
  )
}

/* 입면(front/side)·평면(top) = 정투영(도면처럼 왜곡 없음), iso = 원근. zoom = 카메라 거리 배율 —
   Plotly 정투영은 카메라 거리를 무시하므로 확대는 sceneOf 의 aspectratio 배율로 처리 */
const camOf = (c: Cam, zoom: number) => {
  const e = CAMS[c].eye, up = 'up' in CAMS[c] ? CAMS[c].up : { x: 0, y: 0, z: 1 }
  return { eye: { x: e.x * zoom, y: e.y * zoom, z: e.z * zoom }, up, projection: { type: c === 'iso' ? 'perspective' : 'orthographic' } }
}

/** 축 비율 — iso 는 data 비율 그대로, 정투영은 data 비율 × (기본 1.6 / zoom) 으로 화면을 채우고 확대 */
function sceneOf(f: any, c: Cam, zoom: number): Record<string, any> {
  if (c === 'iso' || !f?.nodes?.length) return { aspectmode: 'data' }
  const ext = (k: 'x' | 'y' | 'z') => { const v = f.nodes.map((n: any) => n[k]); return Math.max(...v) - Math.min(...v) || 1 }
  /* 평면: 축선 버블이 평면 밖(−off)까지 그려지므로 그 폭만큼 x·y 범위를 넓혀야 비율이 맞음 */
  const g = c === 'top' ? gridLines(f) : null, add = g ? g.off * 1.25 : 0
  const d = { x: ext('x') + add, y: ext('y') + add, z: ext('z') }, m = Math.max(d.x, d.y, d.z), k = 1.6 / zoom
  return { aspectmode: 'manual', aspectratio: { x: d.x / m * k, y: d.y / m * k, z: d.z / m * k } }
}

/** 3D 뷰 조작 — 카메라(cam 지정 시 zoom 1 로 리셋 가능)·확대 배율·표시 항목 일부만 바꿔도 됨 */
export function setView(o: { cam?: Cam; zoom?: number; vis?: Partial<Record<VisKey, boolean>> }): void {
  const v = S.view3d
  S.view3d = { cam: o.cam ?? v.cam, zoom: Math.min(4, Math.max(0.25, o.zoom ?? v.zoom)), vis: { ...v.vis, ...(o.vis || {}) } }
  notify()
}

/** 3D 탭 클릭 = 다시 그리기만 — 미리보기(빌드 전 확인 카드)는 유지. 빌드·편집 액션이 draw3D() 로 미리보기를 끝낸다.
    (이전엔 draw3D 를 불러 미리보기가 지워져, 미연결 상태에서 탭을 오가면 빈 화면) */
export function onView3DTab(): void { S.viewNonce++; notify() }
