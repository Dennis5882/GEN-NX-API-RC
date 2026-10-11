/* i18n — 사전은 shared/i18n.js(window.I18N / window.LOGS) 단일 소스 유지.
   t()/tl() 의미는 바닐라와 동일: 현재 언어(S.lang) → en 폴백, 함수값이면 인자 적용.
   React 밖(액션)에서도 쓰이므로 plain 함수. 컴포넌트는 useStore() 로 언어 변경에 재렌더된다. */
import '../../shared/i18n.js'
import { S } from '../state/store'
import type { Dict, Lang } from './types'

function lookup(dicts: Record<Lang, Dict>, key: string, args: unknown[]): any {
  const d = dicts[S.lang] ?? dicts.en
  let v = d[key]
  if (v === undefined) v = dicts.en[key]
  return typeof v === 'function' ? (v as (...a: unknown[]) => unknown)(...args) : v
}

/** UI 문자열 (HTML 포함 가능) */
export function t(key: string, ...args: unknown[]): string {
  return lookup(window.I18N, key, args)
}
/** 배열/객체값 사전 항목 (pe, roles, uses, hdr_* …) */
export function tv<T = any>(key: string): T {
  return lookup(window.I18N, key, [])
}
/** 활동 로그 메시지 */
export function tl(key: string, ...args: unknown[]): string {
  return lookup(window.LOGS, key, args)
}

/** {ko,en,zh} 객체에서 현재 언어 값 (en 폴백) */
export function pick<T>(o: Partial<Record<Lang, T>> | T): T {
  if (o && typeof o === 'object' && ('en' in (o as object) || 'ko' in (o as object))) {
    const r = o as Partial<Record<Lang, T>>
    return (r[S.lang] !== undefined ? r[S.lang] : r.en) as T
  }
  return o as T
}

export function roleLbl(r: string): string { return tv<Record<string, string>>('roles')[r] || r }
export function useLbl(u: string): string { return tv<Record<string, string>>('uses')[u] || u }

export function escapeHtml(s: string): string {
  return s.replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]!))
}

export type { Lang } from './types'
export { LANGS } from './types'
