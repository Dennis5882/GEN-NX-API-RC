import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { afterEach, expect, it, vi } from 'vitest'
import { I18N, LOGS } from '../src/i18n/dictionaries.ts'
import {
  detectLang,
  htmlLang,
  LANG_DEFS,
  normalizeLang,
} from '../src/i18n/types.ts'

// Captured from the JS dictionaries before migration, including successful function samples.
const golden = JSON.parse(
  readFileSync(new URL('./i18n.golden.json', import.meta.url), 'utf8'),
)
const samples = [
  [],
  [1, 2, 3, 4, 5, 6, 7, 8],
  ['A', 'sample', 'info', 'X', 'Y'],
  [true, false, true, false],
  [[1, 2], [3, 4], {}, {}],
]

afterEach(() => vi.unstubAllGlobals())

for (const { code } of LANG_DEFS) {
  it(`preserves every ${code} dictionary value and function output`, () => {
    for (const [name, dictionaries] of Object.entries({ I18N, LOGS })) {
      const values = Object.fromEntries(
        Object.entries(dictionaries[code]).map(([key, value]) => {
          if (typeof value !== 'function') return [key, value]
          const outputs = []
          for (const args of samples) {
            try {
              outputs.push({ args, result: value(...args) })
            } catch {
              /* Same invalid inputs as the JS baseline. */
            }
          }
          return [key, { samples: outputs }]
        }),
      )
      expect(
        createHash('sha256').update(JSON.stringify(values)).digest('hex'),
      ).toBe(golden[name][code])
    }
  })
}

it('imports the dictionaries without browser globals or installing a bridge', async () => {
  vi.stubGlobal('window', undefined)
  vi.stubGlobal('document', undefined)
  vi.resetModules()
  const dictionaries = await import('../src/i18n/dictionaries.ts')
  expect(Object.keys(dictionaries.I18N.en)).toHaveLength(583)
  expect(Object.keys(dictionaries.LOGS.en)).toHaveLength(15)
  expect(globalThis.window).toBeUndefined()
})

it('retains legacy language preferences and CJK HTML language tags', () => {
  expect(normalizeLang('zh')).toBe('zh-TW')
  expect(normalizeLang('invalid')).toBeNull()
  expect(detectLang(['fr-FR', 'zh-HK'])).toBe('zh-TW')
  expect(detectLang(['zh-SG'])).toBe('zh-CN')
  expect(LANG_DEFS.map(d => htmlLang(d.code))).toEqual([
    'ko',
    'en',
    'zh-Hant',
    'zh-Hans',
  ])
})

it('retains English fallback when a translated entry is unavailable', async () => {
  const { S } = await import('../src/state/store.ts')
  const { t } = await import('../src/i18n/index.ts')
  const { I18N: current } = await import('../src/i18n/dictionaries.ts')
  const saved = current.ko.app_title,
    lang = S.lang
  try {
    S.lang = 'ko'
    delete current.ko.app_title
    expect(t('app_title')).toBe(current.en.app_title)
  } finally {
    current.ko.app_title = saved
    S.lang = lang
  }
})
