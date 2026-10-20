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
/* 그 밖의 호출은 짧게 — Gen NX 에 모달 대화상자가 뜨면 /db/* 호출이 전부 막혀, 호출마다 15분을 기다리게 된다(midas-nx 2.10.2 README).
   긴 호출 = 해석·저장·문서·Story Calc·결과 표 등(/doc /ope /post) */
const SHORT_TIMEOUT_MS = 2 * 60 * 1000
const LONG_CALL = /^\/(doc|ope|post)\//i
/* 표 전체를 비우는 DELETE /db/<NAME> 은 midas-nx 2.10.2 부터 confirm 없이는 거부 — 우리가 의도한 표만 허용
   (lcom-gen: 조합 수가 줄 때 번호가 남지 않게 비움 / SSEIS: QA 흔적 제거). 그 밖의 표 삭제는 SDK 가 계속 막는다 */
const CLEARABLE = new Set(['lcom-gen', 'sseis'])

let cached: { key: string; base: string; client: MidasClient } | null = null

export function getClient(): MidasClient {
  const base = S.baseUrl.trim().replace(/\/$/, '')
  const key = S.mapiKey.trim()
  if (!cached || cached.key !== key || cached.base !== base) {
    /* 기본 fetch 사용 — midas-nx 2.10.1 이 fetch 를 떼어 호출하도록 고침(2.9.3 은 this.fetch(url) → 브라우저 "Illegal invocation").
       2.9.x 로 내리면 v3.0.1 처럼 fetch 래퍼를 다시 넘겨야 함 → package.json 은 ^2.10.1 */
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
    const clear = method === 'DELETE' && CLEARABLE.has(ep.replace(/^\/db\//i, '').toLowerCase())
    return (await getClient().request(method, ep, body as JsonObject | undefined,
      { timeout: LONG_CALL.test(ep) ? TIMEOUT_MS : SHORT_TIMEOUT_MS, ...(clear ? { confirm: true } : {}) })) as T
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
