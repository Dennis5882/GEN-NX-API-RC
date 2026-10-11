export type Lang = 'ko' | 'en' | 'zh'
export const LANGS: readonly Lang[] = ['ko', 'en', 'zh']

/* 값이 함수면 인자를 받아 문자열을 만든다. 배열/객체값(hdr_*, role, use)도 존재. */
export type DictValue = string | ((...args: any[]) => string) | unknown
export type Dict = Record<string, DictValue>

declare global {
  interface Window {
    I18N: Record<Lang, Dict>
    LOGS: Record<Lang, Dict>
  }
}
