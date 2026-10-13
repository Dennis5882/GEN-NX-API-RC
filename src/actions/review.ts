/* 심사 지표(审图) — 기준 프로필의 review 훅이 정한 Gen 층 결과 테이블을 회수해 한계와 비교.
   동적해석(doc/anal 재실행) 직후에 호출: actAnalyze 끝의 ope/STOR 가 해석 결과를 무효화하므로 정적 해석만으론 표가 비어 있음. */
import { profileOf } from '../codes'
import type { ReviewItem } from '../codes/types'
import { t } from '../i18n'
import { mapi } from '../mapi/client'
import { S, notify } from '../state/store'
import { log } from '../state/ui'

const ICON: Record<ReviewItem['status'], string> = { ok: '✓', warn: '⚠', ng: '✗', info: 'ℹ' }
const COLOR: Record<ReviewItem['status'], string> = { ok: 'var(--green)', warn: 'var(--amber)', ng: 'var(--red)', info: 'var(--muted)' }
export const reviewIcon = (s: ReviewItem['status']) => ({ icon: ICON[s], color: COLOR[s] })

/** 채팅용 요약 — 항목당 한 줄 */
export function reviewHtml(items: ReviewItem[], rs: boolean): string {
  const ng = items.filter(i => i.status === 'ng').length, warn = items.filter(i => i.status === 'warn').length
  let h = `<b>📋 ${t('rv_title')}</b> <span style="color:var(--dim)">(${rs ? t('rv_src_rs') : t('rv_src_st')})</span>`
  for (const it of items) {
    const c = reviewIcon(it.status)
    h += `<br><span style="color:${c.color}">${c.icon}</span> ${it.label}${it.dir ? ' ' + it.dir : ''}: <b>${it.value}</b> <span style="color:var(--dim)">${it.limit}${it.where ? ' · ' + it.where : ''}</span>`
  }
  h += `<br><span style="color:var(--dim);font-size:.85em">${ng || warn ? t('rv_summary_bad', ng, warn) : t('rv_summary_ok')} ${t('rv_panel_hint')}</span>`
  return h
}

export async function actReview(): Promise<string> {
  if (!S.connected) throw new Error(t('e_notconn'))
  if (!S.model.nodes || !S.model.nodes.length) throw new Error(t('e_nomodel'))
  const p: any = S.model.spec || {}
  const prof = profileOf(p)
  if (!prof.review) return t('rv_not_supported')
  const dyn = S.model.dynamic
  if (!dyn) return t('rv_need_dynamic')
  const rs = !!dyn.rs
  const data: Record<string, any> = {}
  for (const tb of prof.review.tables({ rs, model: S.model })) {
    try {
      data[tb.key] = await mapi('POST', '/post/table', { Argument: { TABLE_NAME: tb.key, TABLE_TYPE: tb.type,
        UNIT: { FORCE: 'KN', DIST: 'M' }, STYLES: { FORMAT: 'Fixed', PLACE: 5 }, ...(tb.lcs ? { LOAD_CASE_NAMES: tb.lcs } : {}), ...(tb.extra || {}) } })
    } catch (e: any) { log('▸ ' + t('rv_fetch_failed') + tb.type + ' — ' + e.message, 'warn') }
  }
  const items = prof.review.evaluate(p, p.seismic || {}, data, { rs, T1: dyn.T1 ?? null, rsChk: dyn.rsChk, model: S.model })
  S.review = { items, rs }
  notify()
  return reviewHtml(items, rs)
}
