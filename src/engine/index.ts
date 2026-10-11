/* ════════════════════════════════════════════════════════════
   RC ENGINE 브리지 — shared/rc_engine.js 를 단일 소스로 유지한 채 TS 에서 사용.
   레거시 Wizard 도 같은 파일을 classic script 로 쓰므로, 이전 완료 전까지 원본은 그대로 둔다.
   side-effect import 가 window.RCEngine 을 채운다. 타입은 ./types.ts 에서 점진적으로 확장.
════════════════════════════════════════════════════════════ */
import '../../shared/rc_engine.js'
import type { RCEngineApi } from './types'

if (!window.RCEngine) throw new Error('RCEngine missing — shared/rc_engine.js 로드 실패')

export const RC: RCEngineApi = window.RCEngine
export type * from './types'
