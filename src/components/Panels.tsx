/* 우측 패널 — 활동 로그 · 모델 상태 · 해석 결과 (바닐라 renderModelState / renderResults 1:1) */
import { useEffect, useRef } from 'react'
import { bt } from '../agent/plan'
import { reviewIcon } from '../actions/review'
import { momentTable, resultStats } from '../agent/results'
import { profileOf } from '../codes'
import { RC } from '../engine'
import { t } from '../i18n'
import { S, notify, useStore, type ResultTab } from '../state/store'

export function LogPanel() {
  const s = useStore()
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const box = ref.current?.parentElement
    if (box) box.scrollTop = box.scrollHeight
  }, [s.log.length])
  return (
    <div id="log" ref={ref}>
      {s.log.length === 0 && <div className="empty">{t('log_empty')}</div>}
      {s.log.map(l => (
        <div key={l.id} className={`ln ${l.type}`}>
          <span className="ts">{l.ts}</span><span className="m" dangerouslySetInnerHTML={{ __html: l.html }} />
        </div>
      ))}
    </div>
  )
}

function KV({ k, v, hi, style }: { k: string; v: React.ReactNode; hi?: boolean; style?: React.CSSProperties }) {
  return <div className="kv"><span className="k">{k}</span><span className={`v${hi ? ' hi' : ''}`} style={style}>{v}</span></div>
}

export function ModelPanel() {
  const { model: m } = useStore()
  if (!m.nodes.length || !m.spec) return <div id="modelState"><div className="res-empty">{t('model_empty')}</div></div>
  const sp = m.spec
  const elems = m.cols.length + m.beams.length + m.links.length
  const height = (m.elev[m.elev.length - 1] / 1000).toFixed(1)

  /* 단면·재료: 레지스트리 기준 distinct 목록 + 다중 단면이면 구역 카드 */
  const R = m.secReg || RC.specSections(sp)
  let colTxt = m.colSect, beamTxt = m.beamSect, matTxt = m.matl
  let zones: React.ReactNode = null
  if (R) {
    const colIds = new Set<number>(), beamIds = new Set<number>()
    for (const st in R.storyAssign) { colIds.add(R.storyAssign[st].colSect); beamIds.add(R.storyAssign[st].beamSect) }
    const nm = (id: number) => (R.sections[id - 1] || {}).name || '-'
    colTxt = [...colIds].map(nm).join(', ')
    beamTxt = [...beamIds].map(nm).join(', ')
    matTxt = (m.materials && m.materials.length ? m.materials : [m.matl]).join(', ')
    if (R.sections.length > 2 || R.mats.length > 1) {
      zones = (
        <div className="scard"><h3>{t('section_zones')}</h3>
          {RC.specToGroupRows(sp).slice().reverse().map(r => (
            <KV key={r.from} k={r.from === r.to ? `${r.from}F` : `${r.from}–${r.to}F`}
              v={`${r.col || sp.colName} / ${r.beam || sp.beamName} · ${r.mat || sp.matName}`} style={{ fontSize: '.82em' }} />
          ))}
        </div>
      )
    }
  }

  return (
    <div id="modelState">
      <div className="statgrid">
        <div className="stat"><div className="n">{m.nodes.length}</div><div className="l">{t('st_node')}</div></div>
        <div className="stat"><div className="n">{elems}</div><div className="l">{t('st_elem')}</div></div>
        <div className="stat"><div className="n">{height}</div><div className="l">{t('st_h')}</div></div>
      </div>
      <div className="scard"><h3>{t('sec_geom')}</h3>
        <KV k={t('kv_code')} v={t(`code_${profileOf(sp).id}`)} hi />
        {sp.bldgType && <KV k={t('kv_type')} v={`${RC.BUILDING_TYPES[sp.bldgType].icon} ${bt(sp.bldgType, 'label')}`} hi />}
        <KV k={t('kv_bs')} v={`${sp.buildings} · ${sp.stories}`} hi />
        <KV k={t('kv_bay')} v={`${sp.bayX} × ${sp.bayY}`} />
        <KV k={t('kv_span')} v={`${sp.spanX} × ${sp.spanY}`} />
        <KV k={t('kv_h')} v={`${sp.h1} / ${sp.hTyp}`} />
        <KV k={t('kv_cb')} v={`${m.cols.length} / ${m.beams.length}`} />
        {m.links.length > 0 && <KV k={t('kv_link', sp.connectFloor)} v={m.links.length} hi />}
      </div>
      <div className="scard"><h3>{t('sec_prop')}</h3>
        <KV k={t('kv_mat')} v={matTxt} />
        <KV k={t('kv_csect')} v={colTxt} />
        <KV k={t('kv_bsect')} v={beamTxt} />
        <KV k={t('kv_bound', m.baseNodes.length)} v="" />
        <KV k={t('kv_lc')} v={m.loadCases.map(l => l.name).join(', ') || '-'} />
      </div>
      {zones}
      {m.edits && m.edits.length > 0 && (
        <div className="scard"><h3>{t('sec_edits')}</h3>
          {m.edits.map((e, i) => <KV key={i} k={String(i + 1)} v={e} hi style={{ textAlign: 'right' }} />)}
        </div>
      )}
    </div>
  )
}

const MAX_ROWS = 200

/** 심사 지표(审图) — 기준 프로필 review 결과 (값: Gen 층 결과 테이블, 한계: 조문) */
function ReviewBlock({ rv }: { rv: NonNullable<typeof S.review> }) {
  return (
    <div className="res-review" style={{ marginBottom: 14 }}>
      <div style={{ fontWeight: 600, color: 'var(--cyan)', marginBottom: 6 }}>
        📋 {t('rv_title')} <span style={{ color: 'var(--muted)', fontWeight: 400, fontSize: '.8em' }}>({rv.rs ? t('rv_src_rs') : t('rv_src_st')})</span>
      </div>
      <div style={{ overflow: 'auto' }}>
        <table>
          <thead><tr><th></th><th>{t('rv_item')}</th><th>{t('rv_value')}</th><th>{t('rv_limit')}</th><th>{t('rv_where')}</th><th>{t('rv_clause')}</th></tr></thead>
          <tbody>
            {rv.items.map((it, i) => {
              const c = reviewIcon(it.status)
              return (
                <tr key={i} title={it.note || ''}>
                  <td style={{ color: c.color, fontWeight: 700 }}>{c.icon}</td>
                  <td>{it.label}{it.dir ? ' ' + it.dir : ''}</td>
                  <td style={{ color: c.color, fontWeight: 600 }}>{it.value}</td>
                  <td>{it.limit}</td>
                  <td style={{ color: 'var(--muted)' }}>{it.where || ''}</td>
                  <td style={{ color: 'var(--muted)', whiteSpace: 'nowrap' }}>{it.clause}{it.note ? ' *' : ''}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      {rv.items.some(i => i.note) && <div className="pe-tip" style={{ opacity: 0.8 }}>* {[...new Set(rv.items.map(i => i.note).filter(Boolean))].join(' · ')}</div>}
    </div>
  )
}

export function ResultsPanel() {
  const s = useStore()
  const r = s.results
  const rv = s.review
  if (!r.react && !r.disp && !r.force) return <div id="results">{rv ? <ReviewBlock rv={rv} /> : <div className="res-empty">{t('res_empty')}</div>}</div>
  const tabs: [ResultTab, string][] = [['react', t('r_react')], ['disp', t('r_disp')], ['force', t('r_force')], ['moment', t('r_moment')]]
  const tbl = s.resultTab === 'moment' ? momentTable() : r[s.resultTab]
  /* 탭별 요약바 — 표를 훑지 않아도 최대 변위/반력/휨모멘트를 바로 보이게 */
  const stat = tbl ? resultStats(s.resultTab) : ''
  return (
    <div id="results">
      {rv && <ReviewBlock rv={rv} />}
      <div className="res-sel">
        {tabs.map(([k, l]) => (
          <button key={k} className="chip" style={s.resultTab === k ? { borderColor: 'var(--cyan)', color: 'var(--cyan)' } : undefined}
            onClick={() => { S.resultTab = k; notify() }}>{l}</button>
        ))}
      </div>
      {!tbl ? <div className="res-empty">{t('r_none')}</div> : (
        <>
          {stat && <div className="res-stat" dangerouslySetInnerHTML={{ __html: stat }} />}
          <div style={{ overflow: 'auto' }}>
            <table>
              <thead><tr>{tbl.head.map((h, i) => <th key={i}>{h}</th>)}</tr></thead>
              <tbody>
                {tbl.data.slice(0, MAX_ROWS).map((row, ri) => (
                  <tr key={ri}>{row.map((c, ci) => {
                    const n = parseFloat(c)
                    const cls = !isNaN(n) ? (n > 0 ? 'pos' : n < 0 ? 'neg' : '') : ''
                    return <td key={ci} className={cls}>{c}</td>
                  })}</tr>
                ))}
              </tbody>
            </table>
          </div>
          {tbl.data.length > MAX_ROWS && <div style={{ color: 'var(--dim)', fontSize: '.74rem', marginTop: 8 }}>{t('r_more', tbl.data.length)}</div>}
        </>
      )}
    </div>
  )
}
