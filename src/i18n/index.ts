/* 사전은 언어별 TS 모듈. t()/tl()은 S.lang → en 폴백 후 함수 인자를 적용한다. */
import { I18N, LOGS } from './dictionaries'
import { S } from '../state/store'
import type { I18nKey, LogKey } from './keys.gen'
import { FALLBACK_LANG, type Dict, type Lang } from './types'

function lookup(
  dicts: Partial<Record<Lang, Dict>>,
  key: string,
  args: unknown[],
): any {
  let v = dicts[S.lang]?.[key]
  if (v === undefined) v = dicts[FALLBACK_LANG]?.[key]
  if (v === undefined && import.meta.env?.DEV)
    console.warn(`[i18n] missing key: ${key}`)
  return typeof v === 'function'
    ? (v as (...a: unknown[]) => unknown)(...args)
    : v
}

/** UI 문자열 (HTML 포함 가능) */
export function t(key: I18nKey, ...args: unknown[]): string {
  return lookup(I18N, key, args)
}
/** 배열/객체값 사전 항목 (pe, roles, uses, hdr_* …) */
export function tv<T = any>(key: I18nKey): T {
  return lookup(I18N, key, [])
}
/** 활동 로그 메시지 */
export function tl(key: LogKey, ...args: unknown[]): string {
  return lookup(LOGS, key, args)
}

export function roleLbl(r: string): string {
  return tv<Record<string, string>>('roles')[r] || r
}
export function useLbl(u: string): string {
  return tv<Record<string, string>>('uses')[u] || u
}

export function escapeHtml(s: string): string {
  return s.replace(
    /[&<>]/g,
    c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[c]!,
  )
}

export type { Lang } from './types'
export type { I18nKey, LogKey } from './keys.gen'
export { LANGS, LANG_DEFS, htmlLang, normalizeLang } from './types'
