/* 프로필 순수 함수 테스트 하네스 — Vite SSR 로 src 를 직접 로드 (DOM·Gen NX 불필요). 식은 각 테스트 안에서 규범 원문대로 독립 재구현해 대조 */
import { pathToFileURL, fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

export const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')

export async function boot() {
  const { createServer } = await import(pathToFileURL(root + '/node_modules/vite/dist/node/index.js').href)
  globalThis.window = globalThis
  const mem = {}
  globalThis.localStorage = { getItem: k => mem[k] ?? null, setItem: (k, v) => { mem[k] = String(v) } }
  globalThis.document = { documentElement: { dataset: {} } }
  const server = await createServer({ root, configFile: false, logLevel: 'error', server: { middlewareMode: true, hmr: false }, appType: 'custom', optimizeDeps: { noDiscovery: true } })
  await server.ssrLoadModule('/src/engine/index.ts')
  const { S } = await server.ssrLoadModule('/src/state/store.ts')
  return { server, S, load: p => server.ssrLoadModule(p), RC: globalThis.RCEngine }
}

export function checker() {
  let pass = 0, fail = 0
  const note = (good, name, a, b) => { good ? pass++ : fail++; if (!good || process.env.V) console.log(`${good ? 'ok  ' : 'FAIL'} ${name}: app=${a} ref=${b}`) }
  return {
    ok: (name, a, b, tol = 1e-3) => note(Math.abs(a - b) <= tol * Math.max(1, Math.abs(b)), name, a, b),
    eq: (name, a, b) => note(a === b, name, a, b),
    done: label => { console.log(`${label}: ${pass} pass / ${fail} fail`); return fail },
  }
}
