// 새 버전 열기: `npm run release -- patch|minor|major [--items N]`
// package.json(+lock) 버전을 올리고, src/data/releases.json 맨 앞에 항목({version,date,id,items} — date = 오늘 KST)을 넣고,
// src/data/releaseNotes.json 에 4개 언어(ko·en·zh-TW·zh-CN)의 빈 노트 N개를 만든다.
// 노트를 다 쓰기 전에는 release-check(빌드·typecheck 에 포함)가 실패 — 버전업과 릴리즈 노트는 항상 같은 커밋.
import { readFileSync, writeFileSync } from 'node:fs'

const root = new URL('../', import.meta.url)
const level = process.argv[2]
const ia = process.argv.indexOf('--items')
const items = ia > 0 ? Number(process.argv[ia + 1]) : 3
if (!['patch', 'minor', 'major'].includes(level) || !(items >= 1)) {
  console.error('usage: npm run release -- patch|minor|major [--items N]')
  process.exit(1)
}

const pkgPath = new URL('package.json', root)
const pkgTxt = readFileSync(pkgPath, 'utf8')
let [ma, mi, pa] = JSON.parse(pkgTxt).version.split('.').map(Number)
if (level === 'major') [ma, mi, pa] = [ma + 1, 0, 0]
else if (level === 'minor') [mi, pa] = [mi + 1, 0]
else pa += 1
const version = `${ma}.${mi}.${pa}`
const id = 'v' + version.replace(/\./g, '_')
const kst = new Date(Date.now() + 9 * 3600 * 1000).toISOString().slice(0, 10)

const setVersion = txt => txt.replace(/("version":\s*")[^"]+(")/, `$1${version}$2`)
writeFileSync(pkgPath, setVersion(pkgTxt))
try {
  const lockPath = new URL('package-lock.json', root)
  let lock = setVersion(readFileSync(lockPath, 'utf8'))
  lock = lock.replace(/("packages":\s*\{\s*"":\s*\{[^}]*?"version":\s*")[^"]+(")/, `$1${version}$2`)
  writeFileSync(lockPath, lock)
} catch { /* lock 없음 */ }

const relPath = new URL('src/data/releases.json', root)
const rel = JSON.parse(readFileSync(relPath, 'utf8'))
rel.unshift({ version, date: kst, id, items })
writeFileSync(relPath, '[\n' + rel.map(r => '  ' + JSON.stringify(r).replace(/,"/g, ', "').replace(/":/g, '": ').replace(/^\{/, '{ ').replace(/\}$/, ' }')).join(',\n') + '\n]\n')

const notesPath = new URL('src/data/releaseNotes.json', root)
const notes = JSON.parse(readFileSync(notesPath, 'utf8'))
const blank = () => Array.from({ length: items }, () => '')
const fresh = { ko: blank(), en: blank(), 'zh-TW': blank(), 'zh-CN': blank() }
writeFileSync(notesPath, JSON.stringify({ [id]: fresh, ...notes }, null, 2) + '\n')

console.log(`v${version} (${kst}) 열림 — 빈 노트 ${items}개: src/data/releaseNotes.json["${id}"]`)
console.log('ko 먼저, 이어서 en · zh-TW · zh-CN 으로 사용자 눈높이 한 줄씩 작성하세요. 다 채우기 전까지 빌드가 실패합니다.')
