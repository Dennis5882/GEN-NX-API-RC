// 버전과 릴리즈 노트가 함께 움직이지 않으면 빌드 실패:
//  - package.json "version" == src/data/releases.json 맨 앞 항목
//  - 버전 유일·엄격 내림차순 semver, 날짜 YYYY-MM-DD·비증가
//  - 각 항목의 노트 releaseNotes.json[id][lang] 이 4개 언어 모두 items 개수만큼 비어 있지 않음, 남는 id 없음
// 새 버전은 `npm run release -- patch|minor|major` 로만 연다 (손으로 버전을 고치지 말 것).
import { readFileSync } from 'node:fs'

const root = new URL('../', import.meta.url)
const read = p => JSON.parse(readFileSync(new URL(p, root), 'utf8'))
const pkg = read('package.json')
const releases = read('src/data/releases.json')
const notes = read('src/data/releaseNotes.json')
const LANGS = ['ko', 'en', 'zh-TW', 'zh-CN']
const errors = []

const sv = v => v.split('.').map(Number)
const cmp = (a, b) => { const x = sv(a), y = sv(b); for (let i = 0; i < 3; i++) if (x[i] !== y[i]) return x[i] - y[i]; return 0 }

if (!releases.length) errors.push('releases.json 이 비어 있음')
else if (releases[0].version !== pkg.version)
  errors.push(`package.json 버전 ${pkg.version} != 최신 릴리즈 ${releases[0].version} — 손으로 고치지 말고 \`npm run release\` 사용`)

const ids = new Set()
releases.forEach((r, i) => {
  if (!/^\d+\.\d+\.\d+$/.test(r.version)) errors.push(`잘못된 버전 "${r.version}"`)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(r.date)) errors.push(`${r.version}: 잘못된 날짜 "${r.date}"`)
  if (!(Number.isInteger(r.items) && r.items > 0)) errors.push(`${r.version}: items 는 1 이상`)
  if (ids.has(r.id)) errors.push(`id 중복 ${r.id}`)
  ids.add(r.id)
  const next = releases[i + 1]
  if (next) {
    if (cmp(r.version, next.version) <= 0) errors.push(`${r.version} 은 ${next.version} 보다 새로워야 함`)
    if (r.date < next.date) errors.push(`${r.version} 날짜 ${r.date} 가 ${next.version} 의 ${next.date} 보다 이름`)
  }
  for (const lang of LANGS) {
    const arr = notes[r.id]?.[lang]
    if (!Array.isArray(arr) || arr.length !== r.items) { errors.push(`${lang}: v${r.version} 노트 ${r.items}개 필요 (현재 ${Array.isArray(arr) ? arr.length : '없음'})`); continue }
    arr.forEach((s, k) => { if (typeof s !== 'string' || !s.trim()) errors.push(`${lang}: v${r.version} 노트 ${k + 1} 가 비어 있음`) })
  }
})
for (const k of Object.keys(notes)) if (!ids.has(k)) errors.push(`releases.json 에 없는 노트 ${k}`)

if (errors.length) {
  for (const e of errors) console.error('✗ ' + e)
  console.error(`release: 오류 ${errors.length}건`)
  process.exit(1)
}
console.log(`release: v${pkg.version} · 릴리즈 ${releases.length}개 · 노트 ${LANGS.length}개 언어 완비`)
