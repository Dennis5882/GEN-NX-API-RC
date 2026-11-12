import { afterEach, expect, it, vi } from 'vitest'

afterEach(() => vi.unstubAllGlobals())

it('loads every engine module without browser globals', async () => {
  vi.stubGlobal('window', undefined)
  vi.stubGlobal('document', undefined)
  vi.stubGlobal('localStorage', undefined)
  vi.resetModules()
  const engine = await import('../src/engine/index.ts')
  expect(
    engine.buildFrame({ ...engine.DEFAULT_SPEC, buildings: 1 }).nodes.length,
  ).toBeGreaterThan(0)
  expect('RC' in engine).toBe(false)
  expect(engine.eigvPayload(12).TYPE).toBe('LANCZOS')
})
