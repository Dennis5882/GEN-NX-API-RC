/* 결과·상태 요약 — 채팅 브리프와 결과 패널 요약바가 공유 (바닐라 1:1) */
import { escapeHtml, t } from '../i18n'
import { S, type ResultTab, type Table } from '../state/store'

/* BEAMFORCE에서 휨모멘트 열(Torsion 제외) 인덱스 */
function momentCols(F: Table): number[] {
  return F.head.map((_, i) => i).filter(i => /moment/i.test(F.head[i]) && !/torsion/i.test(F.head[i]))
}

/* 최대 휨모멘트 요약 라인 — fetchTable이 N·MM 고정이므로 N·mm → kN·m 는 1e6으로 나눔 */
function momentLines(): string {
  const F = S.results.force; if (!F) return ''
  let s = ''
  const ei = F.head.findIndex(h => /ELEM/i.test(h))
  momentCols(F).forEach(ci => {
    let best: { v: number; id: string } | null = null
    for (const r of F.data) {
      const v = parseFloat(r[ci]); if (isNaN(v)) continue
      if (!best || Math.abs(v) > Math.abs(best.v)) best = { v, id: ei >= 0 ? r[ei] : '?' }
    }
    if (best) s += t('rb_moment', escapeHtml(String(F.head[ci])), (best.v / 1e6).toFixed(1), escapeHtml(String(best.id)))
  })
  return s
}

/* 휨모멘트 탭 — BEAMFORCE에서 식별열 + Moment 열만 추린 뷰 (추가 API 호출 없음) */
export function momentTable(): Table | null {
  const F = S.results.force; if (!F) return null
  const mc = momentCols(F); if (!mc.length) return null
  const keep = F.head.map((_, i) => i).filter(i => /index|elem|load|part/i.test(F.head[i])).concat(mc)
  return { head: keep.map(i => F.head[i]), data: F.data.map(r => keep.map(i => r[i])) }
}

export function extremum(tbl: Table, colName: string): { v: number; node: string } | null {
  const ci = tbl.head.findIndex(h => h.toUpperCase().includes(colName))
  const ni = tbl.head.findIndex(h => h.toUpperCase().includes('NODE'))
  if (ci < 0) return null
  let best: { v: number; node: string } | null = null
  for (const r of tbl.data) {
    const v = parseFloat(r[ci]); if (isNaN(v)) continue
    if (!best || Math.abs(v) > Math.abs(best.v)) best = { v, node: ni >= 0 ? r[ni] : '?' }
  }
  return best
}

/* 탭별 결과 요약(HTML) */
export function resultStats(which?: ResultTab): string {
  let s = ''
  if ((!which || which === 'disp') && S.results.disp) {
    const ext = extremum(S.results.disp, 'DZ'); if (ext) s += t('rb_disp', ext.v.toFixed(3), ext.node)
  }
  if ((!which || which === 'react') && S.results.react) {
    const ext = extremum(S.results.react, 'FZ'); if (ext) s += t('rb_react', (ext.v / 1000).toFixed(1), ext.node)
  }
  if ((!which || which === 'force') && S.results.force) {
    s += t('rb_force', S.results.force.data.length) + momentLines()
  }
  if (which === 'moment') s += momentLines()
  return s
}

export function resultBrief(which?: ResultTab): string { return (resultStats(which) || t('rb_none')) + t('rb_see') }

export function statusBrief(): string {
  const m = S.model
  if (!m.nodes.length) return t('st_nomodel')
  return t('st_cur', m.spec?.buildings || '?', m.spec?.stories || '?') +
    t('st_counts', m.nodes.length, m.cols.length, m.beams.length, m.links.length) +
    t('st_props', m.matl || '-', m.colSect || '-', m.beamSect || '-') +
    t('st_height', (m.elev[m.elev.length - 1] / 1000).toFixed(1))
}
