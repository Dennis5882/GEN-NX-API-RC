/* 세션 액션 — 전송·언어·공급자·연결 테스트·대화 초기화 (바닐라 SEND / SETTINGS / I18N APPLY) */
import { escapeHtml, htmlLang, t } from '../i18n'
import type { Lang } from '../i18n/types'
import { verifyConn } from '../mapi/client'
import type { CodeId } from '../codes/types'
import { S, notify, type Provider } from '../state/store'
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
  S.provider = p
  S.provModel = PROVIDERS[p].def
  S.conv = []
  notify()
}

export function clearChat(): void {
  S.msgs = []; S.conv = []; S.pendingBuild = null
  addMsg('bot', t('clear_done'))
}

/** 언어 변경 — 채팅은 언어 혼용을 피하기 위해 초기화 후 환영문 재출력 (바닐라 동일) */
export function setLang(l: Lang): void {
  S.lang = l
  try { localStorage.setItem('nx_lang', l) } catch { /* noop */ }
  if (!S.codeChosen) S.code = l === 'zh-CN' ? 'CN' : 'TW'   // 기준을 직접 고르기 전엔 언어를 따라감
  document.documentElement.lang = htmlLang(l)
  S.conv = []
  draw3D()
  S.msgs = []; S.pendingBuild = null
  addMsg('bot', t('welcome'))
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
    if (!ok) { fail(); return { cls: 'err', text: t('test_http', status) } }
    const connected = j && j.status === 'connected' && j.keyVerified !== false
    if (!connected) { fail(); return { cls: 'err', text: t('test_keyfail') } }
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
