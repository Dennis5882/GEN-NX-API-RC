/* 앱 버전 — vite.config.ts define 이 package.json version·빌드 날짜(KST)를 주입. SSR 하네스(define 없음)에선 'dev' */
export const APP_VERSION: string = typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : 'dev'
export const BUILD_DATE: string = typeof __BUILD_DATE__ !== 'undefined' ? __BUILD_DATE__ : ''
