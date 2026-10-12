/* 3D VIEW — v2 (바닐라 plot3D 1:1). Plotly 는 동적 import 로 첫 화면 번들에서 분리.
   S.preview(미리보기 스펙)가 있으면 그 형상, 없으면 현재 모델. S.viewNonce 변경 시 재플롯. */
import { useEffect, useMemo, useRef, useState } from 'react'
import { RC } from '../engine'
import { roleLbl, t, type I18nKey } from '../i18n'
import { S, notify, useStore, type AppState } from '../state/store'

type Plotly = typeof import('plotly.js-dist-min')
type VisKey = 'col' | 'beam' | 'node' | 'floor'

let plotlyP: Promise<Plotly> | null = null
const loadPlotly = () => (plotlyP ??= import('plotly.js-dist-min').then(m => ((m as any).default ?? m) as Plotly))

const ROLE_C3: Record<string, string> = { TYPICAL: '#4cc2ff', PODIUM: '#ffb454', ROOF: '#5ee6a8', TRANSFER: '#ff6b6b', BASEMENT: '#9b8cff' }
const CAMS = {
  iso: { eye: { x: 1.6, y: 1.6, z: 1.1 } },
  front: { eye: { x: 0, y: -2.5, z: 0.4 } },
  side: { eye: { x: -2.5, y: 0, z: 0.4 } },
  top: { eye: { x: 0.001, y: 0.001, z: 2.5 } },
} as const
type Cam = keyof typeof CAMS
const FONT = 'IBM Plex Mono, Noto Sans KR, Noto Sans TC, Noto Sans SC'

/** 표시할 형상 — 미리보기 스펙이면 buildFrame, 아니면 현재 모델 */
function frameOf(s: AppState): any | null {
  if (s.preview) return { ...RC.buildFrame(s.preview), spec: s.preview }
  const m = s.model
  if (!m.nodes.length) return null
  return { nodes: m.nodes, cols: m.cols, beams: m.beams, links: m.links, braces: m.braces, walls: m.walls,
    baseNodes: m.baseNodes, elev: m.elev, spec: m.spec }
}

function gax(title: string) {
  return {
    title: { text: title, font: { color: '#445069', size: 10, family: FONT } },
    color: '#445069', gridcolor: '#1a2538', zerolinecolor: '#1a2538',
    backgroundcolor: 'rgba(10,14,26,0.4)', showbackground: true,
    tickfont: { color: '#445069', size: 9, family: FONT },
  }
}

function buildTraces(f: any, vis: Record<VisKey, boolean>) {
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
      line: { color: ROLE_C3[r] || '#4cc2ff', width: 4 }, hoverinfo: 'skip' })
  })
  // 보: 같은 역할 색(범례 중복 방지 showlegend:false)
  Object.keys(beamByRole).forEach(r => {
    const o = beamByRole[r]
    idx.beam.push(traces.length)
    traces.push({ type: 'scatter3d', mode: 'lines', name: t('show_beam'), showlegend: false, x: o.x, y: o.y, z: o.z, visible: vis.beam,
      line: { color: ROLE_C3[r] || '#38e1d6', width: 2 }, hoverinfo: 'skip' })
  })

  /* ── 3. Connecting beams · 4. Braces ── */
  const edges = (list: [number, number][] | undefined, name: string, color: string, width: number) => {
    const o = { x: [] as any[], y: [] as any[], z: [] as any[] }
    ;(list || []).forEach(([a, b]) => seg(o, byId[a] || O, byId[b] || O))
    if (o.x.length) traces.push({ type: 'scatter3d', mode: 'lines', name, ...o, line: { color, width }, hoverinfo: 'skip' })
  }
  edges(f.links, t('vs_link'), '#ffb454', 5)
  edges(f.braces, t('vs_brace'), '#9b8cff', 4)

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
      color: '#9b8cff', opacity: 0.32, flatshading: true, hoverinfo: 'skip' })
  }

  /* ── 5. Node markers · 6. Support markers ── */
  const baseSet = new Set(f.baseNodes || [])
  const regNodes = (f.nodes || []).filter((n: any) => !baseSet.has(n.id))
  const supNodes = (f.nodes || []).filter((n: any) => baseSet.has(n.id))
  if (regNodes.length) {
    idx.node.push(traces.length)
    traces.push({ type: 'scatter3d', mode: 'markers', name: t('show_node'),
      x: regNodes.map((n: any) => n.x), y: regNodes.map((n: any) => n.y), z: regNodes.map((n: any) => n.z), visible: vis.node,
      text: regNodes.map((n: any) => `N${n.id}  (${n.x.toFixed(0)}, ${n.y.toFixed(0)}, ${n.z.toFixed(0)})`),
      hovertemplate: '%{text}<extra></extra>', marker: { size: 2.5, color: '#445069', opacity: 0.85 } })
  }
  if (supNodes.length) {
    idx.node.push(traces.length)
    traces.push({ type: 'scatter3d', mode: 'markers', name: t('support'),
      x: supNodes.map((n: any) => n.x), y: supNodes.map((n: any) => n.y), z: supNodes.map((n: any) => n.z), visible: vis.node,
      text: supNodes.map((n: any) => `Fixed  N${n.id}  (${n.x.toFixed(0)}, ${n.y.toFixed(0)}, 0)`),
      hovertemplate: '%{text}<extra></extra>',
      marker: { size: 5, color: '#ff6b6b', symbol: 'diamond', opacity: 1, line: { color: '#ff9999', width: 1 } } })
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
        line: { color: 'rgba(68,80,105,0.35)', width: 1 }, hoverinfo: 'skip' })
    }
  }
  return { traces, idx }
}

const LAYOUT = {
  paper_bgcolor: 'rgba(0,0,0,0)', plot_bgcolor: 'rgba(0,0,0,0)', showlegend: true,
  legend: { font: { color: '#c9d4e8', family: FONT, size: 10 }, orientation: 'h', x: 0, y: 1.03,
    bgcolor: 'rgba(0,0,0,0.85)', bordercolor: 'rgba(31,42,61,0.5)', borderwidth: 1 },
  margin: { l: 0, r: 0, t: 28, b: 0 },
}
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
  const [vis, setVis] = useState<Record<VisKey, boolean>>({ col: true, beam: true, node: true, floor: true })
  const [cam, setCam] = useState<Cam>('iso')
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
      const { traces, idx } = buildTraces(f, vis)
      idxRef.current = idx
      void Plotly.newPlot(el, traces, {
        ...LAYOUT,
        scene: { aspectmode: 'data', xaxis: gax('X'), yaxis: gax('Y'), zaxis: gax('Z'), camera: CAMS[cam], bgcolor: 'rgba(0,0,0,0)' },
      } as any, CONFIG as any)
    })
    return () => { alive = false }
    // vis/cam 은 restyle/relayout 으로 처리 — 재플롯 트리거에서 제외
  }, [s.viewNonce, s.lang, visible])

  function onCam(c: Cam) {
    setCam(c)
    const el = plotRef.current
    if (el && f) void loadPlotly().then(P => P.relayout(el, { 'scene.camera': CAMS[c] } as any))
  }
  function onToggle(k: VisKey) {
    const on = !vis[k]
    setVis(v => ({ ...v, [k]: on }))
    const el = plotRef.current, ids = idxRef.current[k]
    if (el && f && ids.length) void loadPlotly().then(P => P.restyle(el, { visible: on } as any, ids))
  }

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
        {togBtn('col', '#2faadc', 'show_col')}{togBtn('beam', '#38e1d6', 'show_beam')}
        {togBtn('node', '#6b7a99', 'show_node')}{togBtn('floor', '#2a3a55', 'show_floor')}
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

/** 3D 탭 클릭 = 다시 그리기만 — 미리보기(빌드 전 확인 카드)는 유지. 빌드·편집 액션이 draw3D() 로 미리보기를 끝낸다.
    (이전엔 draw3D 를 불러 미리보기가 지워져, 미연결 상태에서 탭을 오가면 빈 화면) */
export function onView3DTab(): void { S.viewNonce++; notify() }
