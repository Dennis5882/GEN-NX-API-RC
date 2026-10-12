import { copyFileSync, mkdirSync } from 'node:fs'
import { resolve } from 'node:path'
import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import pkg from './package.json' with { type: 'json' }

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

/* 헤더 버전 표시 — package.json version + 빌드 날짜(KST). 수동 문자열 금지 */
const BUILD_DATE = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Seoul' }).format(new Date())

export default defineConfig({
  plugins: [react(), copyLegacyShared()],
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
