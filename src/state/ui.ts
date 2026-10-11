/* UI 헬퍼 — 바닐라 log/addMsg/thinking/tab/draw3D/previewSpec 의 store 버전 */
import { escapeHtml } from '../i18n'
import { S, nextId, notify, type ChatMsg, type LogType, type PanelId } from './store'
import type { BuildingSpec } from '../engine/types'

function nowTs(): string { return new Date().toTimeString().slice(0, 8) }

/** 활동 로그. err 는 이스케이프(바닐라 동일), 나머지는 HTML 허용. */
export function log(msg: string, type: LogType = 'api'): void {
  S.log.push({ id: nextId(), ts: nowTs(), type, html: type === 'err' ? escapeHtml(msg) : msg })
  notify()
}

export function addMsg(role: 'user' | 'bot', html: string): void {
  S.msgs.push({ id: nextId(), role, kind: 'html', html })
  notify()
}

export function addPlanMsg(m: Omit<Extract<ChatMsg, { kind: 'plan' }>, 'id' | 'role' | 'kind'>): void {
  S.msgs.push({ id: nextId(), role: 'bot', kind: 'plan', ...m })
  notify()
}

/** 대기 표시 — remove() 로 제거 */
export function thinking(): { remove(): void } {
  const id = nextId()
  S.msgs.push({ id, role: 'bot', kind: 'thinking' })
  notify()
  return {
    remove() {
      const i = S.msgs.findIndex(m => m.id === id)
      if (i >= 0) { S.msgs.splice(i, 1); notify() }
    },
  }
}

export function tab(id: PanelId): void { S.panel = id; notify() }

/** 현재 모델로 3D 재플롯 (미리보기 해제) */
export function draw3D(): void { S.preview = null; S.viewNonce++; notify() }

/** 스펙 미리보기(아직 Gen NX 에 보내지 않은 형상) */
export function previewSpec(p: BuildingSpec): void { S.preview = p; S.viewNonce++; notify() }

/** 모델/결과 패널 재렌더 — store 구독으로 자동, 호환용 */
export const renderModelState = notify
export const renderResults = notify
