/* i18n — 사전은 shared/i18n.js(window.I18N / window.LOGS) 단일 소스.
   t()/tl(): 현재 언어(S.lang) → FALLBACK_LANG(en) 폴백, 함수값이면 인자 적용.
   React 밖(액션)에서도 쓰이므로 plain 함수. 컴포넌트는 useStore() 로 언어 변경에 재렌더된다.
   ⚠ UI 문구는 전부 사전에 둔다 — 코드에 {ko,en,…} 인라인 객체를 만들지 말 것. */
import '../../shared/i18n.js'
import { S } from '../state/store'
import type { I18nKey, LogKey } from './keys.gen'
import { FALLBACK_LANG, type Dict, type Lang } from './types'

function lookup(dicts: Partial<Record<Lang, Dict>>, key: string, args: unknown[]): any {
  let v = dicts[S.lang]?.[key]
  if (v === undefined) v = dicts[FALLBACK_LANG]?.[key]
  if (v === undefined && import.meta.env?.DEV) console.warn(`[i18n] missing key: ${key}`)
  return typeof v === 'function' ? (v as (...a: unknown[]) => unknown)(...args) : v
}

/** UI 문자열 (HTML 포함 가능) */
export function t(key: I18nKey, ...args: unknown[]): string {
  return lookup(window.I18N, key, args)
}
/** 배열/객체값 사전 항목 (pe, roles, uses, hdr_* …) */
export function tv<T = any>(key: I18nKey): T {
  return lookup(window.I18N, key, [])
}
/** 활동 로그 메시지 */
export function tl(key: LogKey, ...args: unknown[]): string {
  return lookup(window.LOGS, key, args)
}

export function roleLbl(r: string): string { return tv<Record<string, string>>('roles')[r] || r }
export function useLbl(u: string): string { return tv<Record<string, string>>('uses')[u] || u }

export function escapeHtml(s: string): string {
  return s.replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]!))
}

export type { Lang } from './types'
export type { I18nKey, LogKey } from './keys.gen'
export { LANGS, LANG_DEFS, htmlLang, normalizeLang } from './types'
