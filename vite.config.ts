import { copyFileSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { runInNewContext } from 'node:vm'
import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import pkg from './package.json' with { type: 'json' }
import { LANG_DEFS } from './src/i18n/types'

/* 레거시 단독 페이지(Wizard·API 검증)는 classic script 로 shared/rc_engine.js 를 직접 로드한다.
   Vite 는 non-module script 를 번들하지 않으므로 빌드 산출물에 원본을 그대로 복사한다. */
function copyLegacyShared(): Plugin {
  return {
    name: 'copy-legacy-shared',
    apply: 'build',
    closeBundle() {
      const out = resolve(import.meta.dirname, 'dist/shared')
      mkdirSync(out, { recursive: true })
      for (const f of ['rc_engine.js', 'i18n.js', 'app.css']) {
        copyFileSync(resolve(import.meta.dirname, 'shared', f), resolve(out, f))
      }
    },
  }
}

/* 언어별 공유 링크 — 메신저 링크 미리보기는 JS 를 실행하지 않고 HTML <title>/og 메타만 읽는다.
   그래서 /zh-CN/ 등 언어별 정적 index.html 을 만들어 미리보기 문구를 그 언어로 둔다(문구 = i18n.js meta_title/meta_desc).
   앱은 경로의 언어로 시작한다(store.ts readLang). 루트(/)는 ko. */
const OG_LOCALE: Record<string, string> = { ko: 'ko_KR', en: 'en_US', 'zh-TW': 'zh_TW', 'zh-CN': 'zh_CN' }
const META_RE = /<!--meta-->[\s\S]*?<!--\/meta-->/
function langPages(): Plugin {
  const dict = () => {
    const ctx: { window: Record<string, any> } = { window: {} }
    runInNewContext(readFileSync(resolve(import.meta.dirname, 'shared/i18n.js'), 'utf8'), ctx)
    return ctx.window.I18N as Record<string, Record<string, unknown>>
  }
  const esc = (v: unknown) => String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
  const meta = (I: ReturnType<typeof dict>, code: string) => {
    const d = I[code] || {}, title = esc(d.meta_title), desc = esc(d.meta_desc)
    return `<!--meta--><title>${title}</title>
<meta name="description" content="${desc}">
<meta property="og:type" content="website">
<meta property="og:title" content="${title}">
<meta property="og:description" content="${desc}">
<meta property="og:locale" content="${OG_LOCALE[code] ?? code.replace('-', '_')}">
<meta name="twitter:card" content="summary">
<meta name="twitter:title" content="${title}">
<meta name="twitter:description" content="${desc}"><!--/meta-->`
  }
  return {
    name: 'lang-pages',
    transformIndexHtml: {
      order: 'post',
      handler(html, ctx) {
        if (ctx.path !== '/index.html' || !META_RE.test(html)) return html
        return html.replace(META_RE, meta(dict(), 'ko'))
      },
    },
    closeBundle() {
      if (process.env.VITEST) return
      const src = resolve(import.meta.dirname, 'dist/index.html')
      let base: string
      try { base = readFileSync(src, 'utf8') } catch { return }   // dev/SSR 등 산출물 없음
      const I = dict()
      for (const d of LANG_DEFS) {
        const page = base.replace(/<html lang="[^"]*">/, `<html lang="${d.html}">`).replace(META_RE, meta(I, d.code))
        /* 대소문자 둘 다(/zh-CN/ · /zh-cn/) — 정적 호스팅 경로는 대소문자 구분 */
        for (const dir of new Set([d.code, d.code.toLowerCase()])) {
          mkdirSync(resolve(import.meta.dirname, 'dist', dir), { recursive: true })
          writeFileSync(resolve(import.meta.dirname, 'dist', dir, 'index.html'), page)
        }
      }
    },
  }
}

/* 헤더 버전 표시 — package.json version + 빌드 날짜(KST). 수동 문자열 금지 */
const BUILD_DATE = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Seoul', dateStyle: 'short', timeStyle: 'short' }).format(new Date())

export default defineConfig({
  plugins: [react(), copyLegacyShared(), langPages()],
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
    __BUILD_DATE__: JSON.stringify(BUILD_DATE),
  },
  build: {
    // plotly.js-dist-min(≈4.5MB)은 3D 탭 진입 시 동적 import 되는 별도 청크 — 경고 기준을 그에 맞춤
    chunkSizeWarningLimit: 5000,
    rollupOptions: {
      input: {
        main: resolve(import.meta.dirname, 'index.html'),
        wizard: resolve(import.meta.dirname, 'MIDAS_RC_Modeling_Wizard.html'),
        validation: resolve(import.meta.dirname, 'gen_nx_api_validation.html'),
      },
    },
  },
})
