/* ════════════════════════════════════════════════════════════
   i18n 검사 + 키 타입 생성 — `npm run i18n:check` (빌드 전 자동 실행)
   - 언어 목록: src/i18n/types.ts 의 LANG_DEFS (단일 출처)
   - 오류(exit 1): 함수/값 타입 불일치, 함수 인자 수 불일치, 폴백(en)에 없는 키,
                   레지스트리 언어의 사전 블록 누락, keys.gen.ts 가 사전과 불일치
   - 경고: 일부 언어의 키 누락(en 폴백으로 동작) — --strict 면 오류
   - --write: src/i18n/keys.gen.ts 재생성
════════════════════════════════════════════════════════════ */
import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const write = process.argv.includes('--write')
const strict = process.argv.includes('--strict')
const FALLBACK = 'en'

globalThis.window = globalThis
await import(pathToFileURL(resolve(root, 'shared/i18n.js')).href)

const typesSrc = readFileSync(resolve(root, 'src/i18n/types.ts'), 'utf8')
const defsBlock = typesSrc.match(/LANG_DEFS = \[([\s\S]*?)\] as const/)
if (!defsBlock) { console.error('✗ LANG_DEFS 를 찾지 못함 (src/i18n/types.ts)'); process.exit(1) }
const langs = [...defsBlock[1].matchAll(/code: '([^']+)'/g)].map(m => m[1])

const errors = [], warns = []
const keysOf = {}
for (const name of ['I18N', 'LOGS']) {
  const dict = window[name]
  for (const l of Object.keys(dict)) if (!langs.includes(l)) warns.push(`${name}: 사전 블록 '${l}' 이 LANG_DEFS 에 없음 (선택 불가)`)
  for (const l of langs) if (!dict[l]) errors.push(`${name}: LANG_DEFS 의 '${l}' 사전 블록 없음`)
  const base = dict[FALLBACK]
  const all = new Set(langs.filter(l => dict[l]).flatMap(l => Object.keys(dict[l])))
  for (const k of all) {
    if (!(k in base)) { errors.push(`${name}.${k}: 폴백(${FALLBACK})에 없음 — 다른 언어에서 폴백 불가`); continue }
    for (const l of langs) {
      const d = dict[l]; if (!d) continue
      if (!(k in d)) { (strict ? errors : warns).push(`${name}.${l}.${k}: 누락 (en 폴백)`); continue }
      const a = d[k], b = base[k]
      const ta = Array.isArray(a) ? 'array' : typeof a, tb = Array.isArray(b) ? 'array' : typeof b
      if (ta !== tb) errors.push(`${name}.${l}.${k}: 타입 ${ta} ≠ ${FALLBACK} ${tb}`)
      else if (ta === 'function' && a.length !== b.length) errors.push(`${name}.${l}.${k}: 인자 ${a.length}개 ≠ ${FALLBACK} ${b.length}개`)
    }
  }
  keysOf[name] = Object.keys(base).sort()
}

/* keys.gen.ts — t()/tl() 키 타입 */
const union = ks => ks.map(k => `  | '${k}'`).join('\n')
const gen = `/* 자동 생성 — 수정 금지. \`npm run i18n:check -- --write\` 로 갱신 (원본: shared/i18n.js 의 ${FALLBACK} 블록) */
export type I18nKey =
${union(keysOf.I18N)}

export type LogKey =
${union(keysOf.LOGS)}
`
const genPath = resolve(root, 'src/i18n/keys.gen.ts')
if (write) writeFileSync(genPath, gen)
else if (!existsSync(genPath) || readFileSync(genPath, 'utf8').replace(/\r\n/g, '\n') !== gen)
  errors.push('src/i18n/keys.gen.ts 가 사전과 다름 → npm run i18n:check -- --write')

warns.forEach(w => console.warn('⚠ ' + w))
errors.forEach(e => console.error('✗ ' + e))
console.log(`i18n: ${langs.join(', ')} · I18N ${keysOf.I18N.length}키 · LOGS ${keysOf.LOGS.length}키 · 오류 ${errors.length} · 경고 ${warns.length}${write ? ' · keys.gen.ts 갱신' : ''}`)
process.exit(errors.length ? 1 : 0)
