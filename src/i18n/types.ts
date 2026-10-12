/* ════════════════════════════════════════════════════════════
   언어 레지스트리 — 지원 언어의 단일 출처.
   언어 추가 = 여기 한 줄 + shared/i18n.js 에 I18N/LOGS 블록 (npm run i18n:check 로 검증).
════════════════════════════════════════════════════════════ */
export const LANG_DEFS = [
  { code: 'ko', label: '한국어', html: 'ko' },
  { code: 'en', label: 'English', html: 'en' },
  { code: 'zh-TW', label: '繁體中文', html: 'zh-Hant' },   // 대만 번체 (구 코드 'zh')
  { code: 'zh-CN', label: '简体中文', html: 'zh-Hans' },   // 대륙 간체 (대륙 용어)
] as const

export type Lang = (typeof LANG_DEFS)[number]['code']
export const LANGS: readonly Lang[] = LANG_DEFS.map(d => d.code)
export const DEFAULT_LANG: Lang = 'ko'
/** 키 누락 시 폴백 언어 */
export const FALLBACK_LANG: Lang = 'en'

/** 구버전 코드 → 현재 코드 (localStorage 'nx_lang' 호환) */
const LEGACY: Record<string, Lang> = { zh: 'zh-TW' }

export function normalizeLang(raw: string | null | undefined): Lang | null {
  if (!raw) return null
  const l = LEGACY[raw] ?? raw
  return (LANGS as readonly string[]).includes(l) ? (l as Lang) : null
}

/** 브라우저 선호 언어 → 지원 언어 (첫 방문용). zh-TW/HK/MO·Hant → 번체, 그 밖의 zh → 간체.
    선호 목록 중 처음 맞는 것, 없으면 null (호출부가 영어로 폴백) */
export function detectLang(prefs: readonly string[] | null | undefined): Lang | null {
  for (const raw of prefs || []) {
    const l = String(raw).toLowerCase()
    if (/^zh-(tw|hk|mo|hant)/.test(l)) return 'zh-TW'
    if (/^zh\b/.test(l)) return 'zh-CN'
    if (/^ko\b/.test(l)) return 'ko'
    if (/^en\b/.test(l)) return 'en'
  }
  return null
}

/** <html lang> 값 */
export function htmlLang(l: Lang): string {
  return LANG_DEFS.find(d => d.code === l)?.html ?? l
}

/* 값이 함수면 인자를 받아 문자열을 만든다. 배열/객체값(hdr_*, roles, uses, pe)도 존재. */
export type DictValue = string | ((...args: any[]) => string) | unknown
export type Dict = Record<string, DictValue>

declare global {
  interface Window {
    /* 레지스트리에 있어도 사전 블록이 없을 수 있음(부분 추가 중) → Partial, 조회 시 en 폴백 */
    I18N: Partial<Record<Lang, Dict>> & Record<typeof FALLBACK_LANG, Dict>
    LOGS: Partial<Record<Lang, Dict>> & Record<typeof FALLBACK_LANG, Dict>
  }
}
