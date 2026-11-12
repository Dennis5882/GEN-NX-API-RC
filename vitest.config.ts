import { resolve } from 'node:path'
import { defineConfig } from 'vitest/config'
import pkg from './package.json' with { type: 'json' }

// 앱 빌드 플러그인을 실행하지 않는 독립 설정. 프로필 테스트는 DOM·Gen NX를 사용하지 않는다.
export default defineConfig({
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
    __BUILD_DATE__: JSON.stringify(''),
  },
  resolve: { alias: { '@': resolve(import.meta.dirname, 'src') } },
  test: {
    environment: 'node',
    include: ['tests/**/*.test.{mjs,ts,tsx}'],
    setupFiles: ['./tests/setup.mjs'],
  },
})
