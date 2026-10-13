/* ════════════════════════════════════════════════════════════
   중국 부재 강성 배율 — Gen NX /db/ESSF IYY_SF(보 연직 휨, 라이브 확인 2026-10-13: Iyy ×1.5 → T₁ −11.6%, Izz 무영향)
   - 中梁刚度放大 (JGJ 3-2010 5.2.2): 楼板 미모델링 → 楼面梁 강성 증대 1.3~2.0.
     중간 보 = Bk, 가장자리 보 = (1+Bk)/2 (YJK 기본 규칙). 층·동별 평면 외곽선 위 보 = 가장자리.
   - 连梁刚度折减 (JGJ 3-2010 5.2.1, ≥0.5): 양 끝이 모두 벽 절점이고 벽 패널 테두리가 아닌 보 중
     跨高比 < 5 (7.1.3 — ≥5 는 框架梁으로 설계) → 강성 × βc (증대 없음).
   - 연결보(link, 동 사이)는 1.0 — 양쪽 바닥판 여부를 모델이 모름.
   단순화: 连梁 折减을 지진·풍 구분 없이 전 하중에 적용(YJK 는 풍하중 계산 시 1.0 선택 가능).
════════════════════════════════════════════════════════════ */
import type { ElemRec, Node3 } from '../state/store'

export interface CnStiffInput { beamAmp?: number; cbRed?: number }
export interface CnStiffResult {
  factors: Record<number, number>
  amp: number; edgeAmp: number; cbRed: number
  count: { mid: number; edge: number; coupling: number }
}

const clamp = (v: unknown, lo: number, hi: number, def: number) => {
  const n = typeof v === 'number' && isFinite(v) ? v : def
  return Math.min(hi, Math.max(lo, n))
}

/** 보 요소별 IYY 배율. sectH = 단면 id → 춤 H(mm) */
export function cnBeamStiffness(sp: CnStiffInput, recs: ElemRec[], nodes: Node3[], sectH: Record<number, number>): CnStiffResult {
  const amp = clamp(sp.beamAmp, 1, 2, 2)
  const edgeAmp = +((1 + amp) / 2).toFixed(3)
  const cbRed = clamp(sp.cbRed, 0.5, 1, 0.7)
  const N = new Map(nodes.map(n => [n.id, n]))
  const tol = 1

  /* 벽 절점·벽 패널 테두리(같은 패널에 속한 절점 쌍) */
  const wallNode = new Set<number>()
  const panelPair = new Set<string>()
  const key = (a: number, b: number) => (a < b ? `${a}_${b}` : `${b}_${a}`)
  for (const r of recs) if (r.type === 'wall' && r.nodes) {
    r.nodes.forEach(n => wallNode.add(n))
    for (let i = 0; i < r.nodes.length; i++) for (let j = i + 1; j < r.nodes.length; j++) panelPair.add(key(r.nodes[i], r.nodes[j]))
  }

  /* 층·동별 보 평면 외곽(가장자리 판정) */
  const box = new Map<string, { x0: number; x1: number; y0: number; y1: number }>()
  const beams = recs.filter(r => r.type === 'beam' && r.n1 && r.n2)
  for (const r of beams) {
    const k = `${r.b}_${r.iz}`, a = N.get(r.n1!)!, c = N.get(r.n2!)!
    const bx = box.get(k) || { x0: Infinity, x1: -Infinity, y0: Infinity, y1: -Infinity }
    for (const n of [a, c]) { bx.x0 = Math.min(bx.x0, n.x); bx.x1 = Math.max(bx.x1, n.x); bx.y0 = Math.min(bx.y0, n.y); bx.y1 = Math.max(bx.y1, n.y) }
    box.set(k, bx)
  }

  const factors: Record<number, number> = {}
  const count = { mid: 0, edge: 0, coupling: 0 }
  for (const r of beams) {
    const a = N.get(r.n1!)!, c = N.get(r.n2!)!
    /* 连梁 */
    if (wallNode.has(r.n1!) && wallNode.has(r.n2!)) {
      if (panelPair.has(key(r.n1!, r.n2!))) continue          // 벽 패널 테두리에 묻힌 보 — 배율 없음
      const L = Math.hypot(a.x - c.x, a.y - c.y, a.z - c.z), H = sectH[r.sect] || 0
      if (H > 0 && L / H < 5) { factors[r.id] = cbRed; count.coupling++; continue }
    }
    const bx = box.get(`${r.b}_${r.iz}`)!
    const alongX = Math.abs(a.y - c.y) < tol
    const edge = alongX
      ? Math.abs(a.y - bx.y0) < tol || Math.abs(a.y - bx.y1) < tol
      : Math.abs(a.x - bx.x0) < tol || Math.abs(a.x - bx.x1) < tol
    factors[r.id] = edge ? edgeAmp : amp
    edge ? count.edge++ : count.mid++
  }
  return { factors, amp, edgeAmp, cbRed, count }
}
