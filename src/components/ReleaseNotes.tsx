import { uiClass } from '@/styles/component-classes'
/* 릴리즈 노트 — 하단 바 버전 클릭 시.
   v3.11.0 이후 = src/data/releases.json(버전·날짜·노트 수) + releaseNotes.json(4개 언어 한 줄 노트) — `npm run release` 로만 추가,
   release-check 가 버전·노트 완비를 빌드에서 강제. 현재 UI 언어로 표시(없으면 ko).
   그 이전 이력 = CHANGELOG.md(한국어 원문) — 열 때만 별도 청크로 로드. 마크다운은 이 파일이 쓰는 부분만 변환:
   ## 버전 머리, ### 소제목, - 목록(2칸 들여쓰기 = 하위), **굵게**, `코드`. */
import { useEffect, useRef, useState } from 'react'
import { t } from '../i18n'
import releases from '../data/releases.json'
import notes from '../data/releaseNotes.json'
import { S, useStore } from '../state/store'
import { APP_VERSION } from '../version'
import { Dialog, DialogContent, DialogTitle } from './ui/dialog'
import { Button } from './ui/button'
import { Badge } from './ui/badge'

interface Release { ver: string; date: string; title: string; html: string }

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
const inline = (s: string) => esc(s)
  .replace(/`([^`]+)`/g, '<code>$1</code>')
  .replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>')

/** 한 버전의 본문 → HTML (목록 들여쓰기 깊이 추적) */
function body(lines: string[]): string {
  let h = '', depth = 0
  const close = (to: number) => { while (depth > to) { h += '</li></ul>'; depth-- } }
  for (const raw of lines) {
    if (/^-{3,}\s*$/.test(raw)) continue
    const li = raw.match(/^(\s*)- (.*)$/)
    if (li) {
      const d = Math.floor(li[1].length / 2) + 1
      if (d > depth) { while (depth < d) { h += '<ul><li>'; depth++ } }
      else { close(d); h += '</li><li>' }
      h += inline(li[2])
      continue
    }
    if (!raw.trim()) continue
    if (depth && /^\s{2,}\S/.test(raw)) { h += ' ' + inline(raw.trim()); continue }   // 목록 항목의 이어지는 줄
    close(0)
    const sub = raw.match(/^###\s+(.*)$/)
    h += sub ? `<h4>${inline(sub[1])}</h4>` : `<p>${inline(raw)}</p>`
  }
  close(0)
  return h
}

export function parseChangelog(md: string): Release[] {
  const out: Release[] = []
  for (const sec of md.split(/\n(?=## v)/).slice(1)) {
    const [head, ...rest] = sec.split('\n')
    /* 머리줄: "## v3.6.0 — 2026-10-13 (제목)" — 옛 항목은 날짜 앞에 덧말("/ v1.2.1", "(안정판/배포)")이 있음 */
    const d = head.match(/(\d{4}-\d{2}-\d{2})/)
    const pre = (d ? head.slice(0, d.index) : head).replace(/^## v/, '').replace(/\s*[—-]\s*$/, '').trim()
    const ver = pre.match(/^[\w.\-]+/)?.[0]
    if (!ver) continue
    const extra = pre.slice(ver.length).trim()
    const tail = d ? head.slice((d.index || 0) + d[0].length).trim().replace(/^\((.*)\)$/, '$1') : ''
    out.push({ ver, date: d?.[1] || '', title: [extra, tail].filter(Boolean).join(' · '), html: body(rest) })
  }
  return out
}

/** 새 방식 릴리즈 — 현재 UI 언어의 노트(없으면 ko) 목록 */
function currentReleases(lang: string): Release[] {
  const book = notes as Record<string, Record<string, string[]>>
  return (releases as { version: string; date: string; time?: string; id: string }[]).map(r => {
    const lines = book[r.id]?.[lang] || book[r.id]?.ko || []
    return { ver: r.version, date: `${r.date} ${r.time || ''} KST`.trim(), title: '', html: '<ul>' + lines.map(l => `<li>${inline(l)}</li>`).join('') + '</ul>' }
  })
}

export function ReleaseNotes({ onClose }: { onClose(): void }) {
  const opener = useRef<HTMLElement | null>(null)
  useStore()   // 언어 변경 시 다시 그림
  const [legacy, setList] = useState<Release[] | null>(null)
  const [err, setErr] = useState('')
  useEffect(() => {
    const have = new Set((releases as { version: string }[]).map(r => r.version))
    import('../../CHANGELOG.md?raw').then(m => setList(parseChangelog(m.default).filter(r => !have.has(r.ver)))).catch(e => setErr(String(e?.message || e)))
  }, [onClose])
  return (
    <Dialog open onOpenChange={open => { if (!open) onClose() }}>
      <DialogContent onOpenAutoFocus={() => { opener.current = document.activeElement as HTMLElement }} onCloseAutoFocus={event => { event.preventDefault(); opener.current?.focus() }} showCloseButton={false} aria-describedby={undefined} overlayClassName="z-40 bg-[var(--scrim)] backdrop-blur-[3px]" className={uiClass("z-[41] flex h-[min(80vh,820px)] w-[min(760px,calc(100vw-32px))] max-w-none flex-col gap-0 font-mono text-[.68rem] text-[var(--dim)] overflow-hidden rounded-[8px] border border-border bg-card p-0 shadow-[0_18px_50px_var(--shadow)] sm:max-w-none")}>
        <div className={uiClass("rn-hd")}>
          <DialogTitle className={uiClass("text-[1rem] font-bold text-[var(--txt-hi)]")}>{t('rn_title')}</DialogTitle>
          <span className={uiClass("rn-sub")}>{t('rn_note')}</span>
          <Button variant="native" size="plain" className={uiClass("rn-x")} onClick={onClose} aria-label={t('close')}>✕</Button>
        </div>
        <div className={uiClass("rn-body")}>
          {err && <p className={uiClass("rn-err")}>{err}</p>}
          {!legacy && !err && <p className={uiClass("rn-sub")}>…</p>}
          {[...currentReleases(S.lang), ...(legacy || [])].map((r, i) => (
            <details key={r.ver} className={uiClass("rn-item")} open={i === 0}>
              <summary>
                <span className={uiClass("rn-ver")}>v{r.ver}</span>
                {r.ver === APP_VERSION && <Badge plain className={uiClass("rn-cur")}>{t('rn_current')}</Badge>}
                <span className={uiClass("rn-date")}>{r.date}</span>
                <span className={uiClass("rn-title")}>{r.title}</span>
              </summary>
              <div className={uiClass("rn-text")} dangerouslySetInnerHTML={{ __html: r.html }} />
            </details>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  )
}
