import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs'
import { Card } from './ui/card'
import { uiClass } from '@/styles/component-classes'
import { cn } from '@/lib/utils'
/* 우측 패널 — 활동 로그 · 모델 상태 · 해석 결과 (바닐라 renderModelState / renderResults 1:1) */
import { useEffect, useRef } from 'react'
import { bt } from '../agent/plan'
import { reviewIcon } from '../actions/review'
import { momentTable, resultStats } from '../agent/results'
import { profileOf } from '../codes'
import { BUILDING_TYPES, specSections, specToGroupRows } from '../engine'
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
    <div className={uiClass(undefined, "log")} id="log" ref={ref}>
      {s.log.length === 0 && <div className={uiClass("empty")}>{t('log_empty')}</div>}
      {s.log.map(l => (
        <div key={l.id} className={uiClass(`ln ${l.type}`)}>
          <span className={uiClass("ts")}>{l.ts}</span><span className={uiClass("m")} dangerouslySetInnerHTML={{ __html: l.html }} />
        </div>
      ))}
    </div>
  )
}

function KV({ k, v, hi, className }: { k: string; v: React.ReactNode; hi?: boolean; className?: string }) {
  return <div className={uiClass("kv")}><span className={uiClass("k")}>{k}</span><span className={uiClass(cn(`v${hi ? ' hi' : ''}`, className))}>{v}</span></div>
}

export function ModelPanel() {
  const { model: m } = useStore()
  if (!m.nodes.length || !m.spec) return <div id="modelState"><div className={uiClass("res-empty")}>{t('model_empty')}</div></div>
  const sp = m.spec
  const elems = m.cols.length + m.beams.length + m.links.length
  const height = (m.elev[m.elev.length - 1] / 1000).toFixed(1)

  /* 단면·재료: 레지스트리 기준 distinct 목록 + 다중 단면이면 구역 카드 */
  const R = m.secReg || specSections(sp)
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
        <Card plain className={uiClass("scard")}><h3>{t('section_zones')}</h3>
          {specToGroupRows(sp).slice().reverse().map(r => (
            <KV className={uiClass("[font-size:.82em]!")} key={r.from} k={r.from === r.to ? `${r.from}F` : `${r.from}–${r.to}F`}
              v={`${r.col || sp.colName} / ${r.beam || sp.beamName} · ${r.mat || sp.matName}`}  />
          ))}
        </Card>
      )
    }
  }

  return (
    <div id="modelState">
      <div className={uiClass("statgrid")}>
        <Card plain className={uiClass("stat")}><div className={uiClass("n")}>{m.nodes.length}</div><div className={uiClass("l")}>{t('st_node')}</div></Card>
        <Card plain className={uiClass("stat")}><div className={uiClass("n")}>{elems}</div><div className={uiClass("l")}>{t('st_elem')}</div></Card>
        <Card plain className={uiClass("stat")}><div className={uiClass("n")}>{height}</div><div className={uiClass("l")}>{t('st_h')}</div></Card>
      </div>
      <Card plain className={uiClass("scard")}><h3>{t('sec_geom')}</h3>
        <KV k={t('kv_code')} v={t(`code_${profileOf(sp).id}`)} hi />
        {sp.bldgType && <KV k={t('kv_type')} v={`${BUILDING_TYPES[sp.bldgType].icon} ${bt(sp.bldgType, 'label')}`} hi />}
        <KV k={t('kv_bs')} v={`${sp.buildings} · ${sp.stories}`} hi />
        <KV k={t('kv_bay')} v={`${sp.bayX} × ${sp.bayY}`} />
        <KV k={t('kv_span')} v={`${sp.spanX} × ${sp.spanY}`} />
        <KV k={t('kv_h')} v={`${sp.h1} / ${sp.hTyp}`} />
        <KV k={t('kv_cb')} v={`${m.cols.length} / ${m.beams.length}`} />
        {m.links.length > 0 && <KV k={t('kv_link', sp.connectFloor)} v={m.links.length} hi />}
      </Card>
      <Card plain className={uiClass("scard")}><h3>{t('sec_prop')}</h3>
        <KV k={t('kv_mat')} v={matTxt} />
        <KV k={t('kv_csect')} v={colTxt} />
        <KV k={t('kv_bsect')} v={beamTxt} />
        <KV k={t('kv_bound', m.baseNodes.length)} v="" />
        <KV k={t('kv_lc')} v={m.loadCases.map(l => l.name).join(', ') || '-'} />
      </Card>
      {zones}
      {m.edits && m.edits.length > 0 && (
        <Card plain className={uiClass("scard")}><h3>{t('sec_edits')}</h3>
          {m.edits.map((e, i) => <KV className={uiClass("[text-align:right]!")} key={i} k={String(i + 1)} v={e} hi  />)}
        </Card>
      )}
    </div>
  )
}

const MAX_ROWS = 200

/** 심사 지표(审图) — 기준 프로필 review 결과 (값: Gen 층 결과 테이블, 한계: 조문) */
function ReviewBlock({ rv }: { rv: NonNullable<typeof S.review> }) {
  return (
    <div className={uiClass("res-review [margin-bottom:14px]!")} >
      <div className={uiClass("[font-weight:600]! [color:var(--cyan)]! [margin-bottom:6px]!")} >
        📋 {t('rv_title')} <span className={uiClass("[color:var(--muted)]! [font-weight:400]! [font-size:.8em]!")} >({rv.rs ? t('rv_src_rs') : t('rv_src_st')})</span>
      </div>
      <div className={uiClass("[overflow:auto]!")} >
        <table>
          <thead><tr><th></th><th>{t('rv_item')}</th><th>{t('rv_value')}</th><th>{t('rv_limit')}</th><th>{t('rv_where')}</th><th>{t('rv_clause')}</th></tr></thead>
          <tbody>
            {rv.items.map((it, i) => {
              const c = reviewIcon(it.status)
              const tone = { ok: 'text-[var(--green)]!', warn: 'text-[var(--amber)]!', ng: 'text-[var(--red)]!', info: 'text-[var(--muted)]!' }[it.status]
              return (
                <tr key={i} title={it.note || ''}>
                  <td className={uiClass(cn("font-bold!", tone))}>{c.icon}</td>
                  <td>{it.label}{it.dir ? ' ' + it.dir : ''}</td>
                  <td className={uiClass(cn("font-semibold!", tone))}>{it.value}</td>
                  <td>{it.limit}</td>
                  <td className={uiClass("[color:var(--muted)]!")} >{it.where || ''}</td>
                  <td className={uiClass("[color:var(--muted)]! [white-space:nowrap]!")} >{it.clause}{it.note ? ' *' : ''}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      {rv.items.some(i => i.note) && <div className={uiClass("pe-tip [opacity:0.8]!")} >* {[...new Set(rv.items.map(i => i.note).filter(Boolean))].join(' · ')}</div>}
    </div>
  )
}

export function ResultsPanel() {
  const s = useStore()
  const r = s.results
  const rv = s.review
  if (!r.react && !r.disp && !r.force) return <div id="results">{rv ? <ReviewBlock rv={rv} /> : <div className={uiClass("res-empty")}>{t('res_empty')}</div>}</div>
  const tabs: [ResultTab, string][] = [['react', t('r_react')], ['disp', t('r_disp')], ['force', t('r_force')], ['moment', t('r_moment')]]
  const tbl = s.resultTab === 'moment' ? momentTable() : r[s.resultTab]
  /* 탭별 요약바 — 표를 훑지 않아도 최대 변위/반력/휨모멘트를 바로 보이게 */
  const stat = tbl ? resultStats(s.resultTab) : ''
  return (
    <Tabs plain value={s.resultTab} onValueChange={value => { S.resultTab = value as ResultTab; notify() }} asChild><div id="results">
      {rv && <ReviewBlock rv={rv} />}
      <TabsList plain asChild><div className={uiClass("res-sel")}>
        {tabs.map(([k, l]) => (
          <TabsTrigger plain value={k} key={k} className={uiClass(cn("chip", s.resultTab === k ? "[border-color:var(--cyan)]! [color:var(--cyan)]!" : ""))}>{l}</TabsTrigger>
        ))}
      </div></TabsList>
      <TabsContent plain value={s.resultTab}><div>{!tbl ? <div className={uiClass("res-empty")}>{t('r_none')}</div> : (
        <>
          {stat && <div className={uiClass("res-stat")} dangerouslySetInnerHTML={{ __html: stat }} />}
          <div className={uiClass("[overflow:auto]!")} >
            <table>
              <thead><tr>{tbl.head.map((h, i) => <th key={i}>{h}</th>)}</tr></thead>
              <tbody>
                {tbl.data.slice(0, MAX_ROWS).map((row, ri) => (
                  <tr key={ri}>{row.map((c, ci) => {
                    const n = parseFloat(c)
                    const cls = !isNaN(n) ? (n > 0 ? 'pos' : n < 0 ? 'neg' : '') : ''
                    return <td key={ci} className={uiClass(cls)}>{c}</td>
                  })}</tr>
                ))}
              </tbody>
            </table>
          </div>
          {tbl.data.length > MAX_ROWS && <div className={uiClass("[color:var(--dim)]! [font-size:.74rem]! [margin-top:8px]!")} >{t('r_more', tbl.data.length)}</div>}
        </>
      )}</div></TabsContent>
    </div></Tabs>
  )
}
