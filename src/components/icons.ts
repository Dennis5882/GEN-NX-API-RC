/* 채팅 HTML 의 이모지 정리 — 전문 도구 톤: 상태 이모지는 작은 상태 배지로, 장식 이모지(🏗️📋🏥…)는 제거.
   문구 사전(i18n.js)은 그대로 두고 렌더 직전에만 변환한다(로그·LLM 경로 공통). */
const BADGE: [RegExp, string][] = [
  [/✅|✔️?/g, '<span class="sb ok">✓</span>'],
  [/❌|✖️?/g, '<span class="sb ng">✗</span>'],
  [/⚠️?/g, '<span class="sb warn">!</span>'],
  [/ℹ️?/g, '<span class="sb info">i</span>'],
]
const PICTO = /[\p{Extended_Pictographic}\u{1F1E6}-\u{1F1FF}]️?\s?|️/gu

export function plainIcons(html: string): string {
  let s = html
  for (const [re, rep] of BADGE) s = s.replace(re, rep)
  /* 배지 마크업 바깥의 남은 그림 문자만 제거 */
  return s.replace(PICTO, '')
}
