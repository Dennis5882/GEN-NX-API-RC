import { resolve } from 'node:path'
import { defineConfig } from 'vitest/config'

// 앱 빌드 플러그인을 실행하지 않는 독립 설정. 프로필 테스트는 DOM·Gen NX를 사용하지 않는다.
export default defineConfig({
  resolve: { alias: { '@': resolve(import.meta.dirname, 'src') } },
  test: {
    environment: 'node',
    include: ['tests/**/*.test.{mjs,ts}'],
    setupFiles: ['./tests/setup.mjs'],
  },
})
