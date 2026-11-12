/* node 환경에서 앱 store 로딩에 필요한 최소 브라우저 전역만 제공한다. */
import { vi } from 'vitest'

if (typeof document === 'undefined') {
  const memory = new Map()
  vi.stubGlobal('window', globalThis)
  vi.stubGlobal('localStorage', {
    getItem: key => memory.get(key) ?? null,
    setItem: (key, value) => memory.set(key, String(value)),
  })
  vi.stubGlobal('document', { documentElement: { dataset: {} } })
}
