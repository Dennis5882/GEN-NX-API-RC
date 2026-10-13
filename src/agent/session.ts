/* 세션 액션 — 전송·언어·공급자·연결 테스트·대화 초기화 (바닐라 SEND / SETTINGS / I18N APPLY) */
import { escapeHtml, htmlLang, t } from '../i18n'
import { LANGS, type Lang } from '../i18n/types'
import { verifyConn } from '../mapi/client'
import type { CodeId } from '../codes/types'
import { S, codeForLang, notify, type Provider, type Theme } from '../state/store'
import { addMsg, draw3D } from '../state/ui'
import { PROVIDERS, handleLLM } from './llm'
import { handleLocal } from './local'

export function llmActive(): boolean { return S.llm && !!S.provKey.trim() }

export async function send(txt: string): Promise<void> {
  txt = txt.trim(); if (!txt || S.busy) return
  addMsg('user', escapeHtml(txt))
  S.busy = true; notify()
  try {
    if (llmActive()) await handleLLM(txt); else await handleLocal(txt)
  } catch (e: any) {
    console.error(e); addMsg('bot', t('err', (e && e.message) || String(e)))
  } finally {
    S.busy = false; notify()
  }
}

/** 공급자 변경 — 기본 모델 적용 + 대화 초기화 */
export function setProvider(p: Provider): void {
  S.provKeys[S.provider] = S.provKey   // 현재 키 보관 → 새 공급자 키 복원
  S.provider = p
  S.provKey = S.provKeys[p] || ''
  S.provModel = PROVIDERS[p].def
  S.conv = []
  notify()
}

export function clearChat(): void {
  S.msgs = []; S.conv = []; S.pendingBuild = null
  addMsg('bot', t('clear_done'))
}

/** 언어 변경 — 채팅은 언어 혼용을 피하기 위해 초기화 후 환영문 재출력 (바닐라 동일) */
/** 언어 링크(/zh-CN/ · ?lang=)로 들어온 경우 주소도 새 언어로 — 주소창을 복사해 공유해도 지금 언어로 미리보기 */
function syncLangUrl(l: Lang): void {
  try {
    const u = new URL(location.href)
    const seg = u.pathname.split('/').filter(Boolean)
    const isLangPath = seg.length === 1 && LANGS.some(x => x.toLowerCase() === seg[0].toLowerCase())
    if (u.searchParams.has('lang')) u.searchParams.set('lang', l)
    if (isLangPath) u.pathname = `/${l}/`
    if (u.href !== location.href) history.replaceState(null, '', u.href)
  } catch { /* SSR 등 */ }
}

export function setLang(l: Lang): void {
  S.lang = l
  try { localStorage.setItem('nx_lang', l) } catch { /* noop */ }
  if (!S.codeChosen) S.code = codeForLang(l)   // 기준을 직접 고르기 전엔 언어를 따라감
  document.documentElement.lang = htmlLang(l)
  syncLangUrl(l)
  S.conv = []
  draw3D()
  S.msgs = []; S.pendingBuild = null
  addMsg('bot', t('welcome'))
}

/** 화면 테마 — <html data-theme> + 저장. 3D 뷰는 s.theme 변경으로 재플롯(색을 CSS 변수에서 다시 읽음) */
export function setTheme(th: Theme): void {
  S.theme = th
  document.documentElement.dataset.theme = th
  try { localStorage.setItem('nx_theme', th) } catch { /* noop */ }
  notify()
}

/** 설계기준 선택 — 이후 새로 만드는 모델에 적용(기존 모델은 자기 spec.code 유지) */
export function setCode(id: CodeId): void {
  S.code = id; S.codeChosen = true
  try { localStorage.setItem('nx_code', id) } catch { /* noop */ }
  notify()
}

export interface TestOut { cls: '' | 'ok' | 'err'; text: string }

export async function testConn(): Promise<TestOut> {
  const fail = (): void => { S.connected = false; S.connErr = true; notify() }
  if (!S.baseUrl.trim() || !S.mapiKey.trim()) return { cls: 'err', text: t('test_need') }
  try {
    const { ok, status, j } = await verifyConn()
    /* 401·403 = 키 거부 → Base URL/서버 안내 대신 키 확인 안내 */
    if (!ok) { fail(); return { cls: 'err', text: status === 401 || status === 403 ? `${t('test_keyfail')}
(HTTP ${status})` : t('test_http', status) } }
    const connected = j && j.status === 'connected' && j.keyVerified !== false
    /* 원인 구분용 — 릴레이 응답 그대로(status·keyVerified) */
    if (!connected) { fail(); return { cls: 'err', text: `${t('test_keyfail')}
(status: ${j?.status ?? '-'} · keyVerified: ${j?.keyVerified ?? '-'})` } }
    S.connected = true; S.connErr = false
    S.program = (j.program || '').toLowerCase(); S.apiUser = j.user || ''
    notify()
    if (S.program && S.program !== 'gen') return { cls: 'err', text: t('test_wrongprod', j.program) }
    return { cls: 'ok', text: t('test_ok', j.program || 'gen', j.user || '') }
  } catch (e: any) {
    fail()
    return { cls: 'err', text: t('test_err', e.message) }
  }
}

/* ── 입력창 제어 (가이드 패널용) — Composer 가 등록 ── */
let composerRun: ((txt: string) => Promise<void>) | null = null
export function registerComposer(run: ((txt: string) => Promise<void>) | null): void { composerRun = run }
/** 가이드 클릭 — 입력창에 명령을 타이핑해 보인 뒤 실행 (Composer 없으면 바로 전송). 응답 완료 시 resolve */
export function runCmd(txt: string): Promise<void> { return composerRun ? composerRun(txt) : send(txt).then(() => {}) }
