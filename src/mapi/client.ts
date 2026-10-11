/* ════════════════════════════════════════════════════════════
   MAPI — midas-nx SDK(MidasClient) 기반 전송.
   바닐라 mapi(method, path, body) 시그니처·로그·오류 메시지 유지:
   path 가 '/' 로 시작하면 그대로, 아니면 /db/{path}.
════════════════════════════════════════════════════════════ */
import { MidasAPIError, MidasClient, type JsonObject } from 'midas-nx'
import { tl } from '../i18n'
import { S } from '../state/store'
import { log } from '../state/ui'

/* 해석(doc/anal)·동적해석은 수 분 걸릴 수 있다 — SDK 기본 30s 대신 넉넉히.
   (타임아웃은 대기만 중단할 뿐 Gen NX 쪽 작업을 취소하지 않는다) */
const TIMEOUT_MS = 15 * 60 * 1000

let cached: { key: string; base: string; client: MidasClient } | null = null

export function getClient(): MidasClient {
  const base = S.baseUrl.trim().replace(/\/$/, '')
  const key = S.mapiKey.trim()
  if (!cached || cached.key !== key || cached.base !== base) {
    cached = { key, base, client: new MidasClient({ mapiKey: key, baseUrl: base, product: 'gen', timeout: TIMEOUT_MS }) }
  }
  return cached.client
}

/** SDK 오류 → 바닐라와 같은 사용자용 메시지 (json.error.message || HTTP status) */
export function apiErrorMessage(e: unknown): string {
  if (e instanceof MidasAPIError) {
    const body = e.responseBody as any
    const m = body?.error?.message ?? (typeof body?.error === 'string' ? body.error : undefined) ?? body?.message
    if (m) return String(m)
    if (e.statusCode) return `HTTP ${e.statusCode}`
  }
  return e instanceof Error ? e.message : String(e)
}

export async function mapi<T = any>(method: 'GET' | 'POST' | 'PUT' | 'DELETE', path: string, body?: Record<string, any>): Promise<T> {
  const ep = path.startsWith('/') ? path : `/db/${path}`
  log(`<span style="color:var(--blue)">${method}</span> ${ep}`, 'api')
  try {
    return (await getClient().request(method, ep, body as JsonObject | undefined)) as T
  } catch (e) {
    const m = apiErrorMessage(e)
    log(tl('fail', m), 'err')
    throw new Error(m)
  }
}

export interface VerifyResult {
  ok: boolean
  status: number
  j: { status?: string; keyVerified?: boolean; program?: string; user?: string }
}

/** /mapikey/verify — 실패해도 throw 하지 않고 바닐라 verifyConn 과 같은 형태로 반환 */
export async function verifyConn(): Promise<VerifyResult> {
  try {
    const j = (await getClient().verifyConnection()) as VerifyResult['j']
    return { ok: true, status: 200, j }
  } catch (e) {
    if (e instanceof MidasAPIError && e.statusCode) {
      return { ok: false, status: e.statusCode, j: (e.responseBody as any) ?? {} }
    }
    throw e
  }
}
