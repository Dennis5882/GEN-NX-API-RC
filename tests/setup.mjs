/* node 환경에서 레거시 엔진·사전 및 store 로딩에 필요한 최소 전역만 제공한다. */
import { vi } from 'vitest'

const memory = new Map()
vi.stubGlobal('window', globalThis)
vi.stubGlobal('localStorage', {
  getItem: key => memory.get(key) ?? null,
  setItem: (key, value) => memory.set(key, String(value)),
})
vi.stubGlobal('document', { documentElement: { dataset: {} } })
