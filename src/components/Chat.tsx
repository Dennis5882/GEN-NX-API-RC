import { Textarea } from './ui/textarea'
import { Badge } from './ui/badge'
import { cn } from '../lib/utils'
import { Button } from './ui/button'
import { Card } from './ui/card'
import { uiClass } from '@/styles/component-classes'
/* 채팅 — 메시지 목록 + 입력창(모드바). plan 메시지는 PlanCard 로 렌더. */
import { useEffect, useRef, useState } from 'react'
import { PROVIDERS } from '../agent/llm'
import { clearChat, llmActive, registerComposer, send } from '../agent/session'
import { t } from '../i18n'
import { S, useStore, type ChatMsg } from '../state/store'
import { PlanCard } from './PlanCard'
import { plainIcons } from './icons'

/* 메시지 = 작업 로그 행: 작성자·시각 머리줄 + 본문(사용자 = 명령줄, 에이전트 = 보고 패널) */
function Message({ m }: { m: ChatMsg }) {
  const who = m.role === 'user' ? t('who_user') : t('who_agent')
  let body
  if (m.kind === 'thinking') body = <Card plain className={uiClass("bubble")}><span className={uiClass("typing")}><span /><span /><span /></span></Card>
  else if (m.kind === 'plan') body = <Card plain className={uiClass("bubble")}><PlanCard msg={m} /></Card>
  else body = <Card plain className={uiClass("bubble")} dangerouslySetInnerHTML={{ __html: plainIcons(m.html) }} />
  return (
    <div className={uiClass(`msg ${m.role}`)}>
      {m.kind !== 'thinking' && <div className={uiClass("who")}><span className={uiClass("who-n")}>{who}</span>{m.ts && <span className={uiClass("who-t")}>{m.ts}</span>}</div>}
      {body}
    </div>
  )
}

function Composer() {
  const s = useStore()
  const [text, setText] = useState('')
  const ref = useRef<HTMLTextAreaElement>(null)
  const typing = useRef(false)

  const autosize = () => {
    const el = ref.current; if (!el) return
    el.style.height = 'auto'
    el.style.height = Math.min(el.scrollHeight, 120) + 'px'
  }

  async function submit(txt: string) {
    setText('')
    requestAnimationFrame(autosize)
    await send(txt)
    ref.current?.focus()
  }

  /* 가이드 클릭 — 사람이 친 것처럼 한 글자씩 채운 뒤 Enter 와 같은 경로로 전송 (전체 ≈0.5s 이내) */
  async function typeAndRun(txt: string) {
    if (typing.current || S.busy) return
    typing.current = true
    try {
      const chars = [...txt], step = Math.max(8, Math.min(30, 500 / chars.length))
      ref.current?.focus()
      for (let i = 1; i <= chars.length; i++) {
        setText(chars.slice(0, i).join(''))
        await new Promise(r => setTimeout(r, step))
      }
      autosize()
      await new Promise(r => setTimeout(r, 150))
    } finally { typing.current = false }
    await submit(txt)
  }

  useEffect(() => {
    registerComposer(typeAndRun)
    return () => registerComposer(null)
  }, [])

  async function onSend() {
    const txt = text.trim(); if (!txt || typing.current) return
    await submit(txt)
  }

  const llm = llmActive()
  const label = PROVIDERS[s.provider].label
  return (
    <div className={uiClass("composer")}>
      <div className={uiClass("modebar")}>
        <span>{t('mode')}</span>
        <Badge plain className={uiClass(`tag ${llm ? 'llm' : 'local'}`)}>{llm ? `LLM · ${label} · ${s.provModel}` : t('mode_local')}</Badge>
        <span className={uiClass("[flex:1]!")}  />
        <span className={uiClass("[opacity:0.6]!")} >{llm ? label + t('brain') : s.llm ? t('mode_nokey') : ''}</span>
        <Button variant="native" size="plain" className={uiClass("clearchat")} onClick={clearChat} title={t('clearchat_tip')}>{t('clearchat')}</Button>
      </div>
      <div className={uiClass("row")}>
        <Textarea plain
          ref={ref}
          rows={1}
          value={text}
          placeholder={t('input_ph')}
          onChange={e => { setText(e.target.value); autosize() }}
          onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); void onSend() } }}
        />
        <Button variant="native" size="plain" className={uiClass("send")} disabled={s.busy} onClick={() => void onSend()}>➤</Button>
      </div>
    </div>
  )
}

export function Chat({ guideCollapsed, onOpenGuide }: { guideCollapsed: boolean; onOpenGuide(): void }) {
  const s = useStore()
  const msgsRef = useRef<HTMLDivElement>(null)
  const count = s.msgs.length

  useEffect(() => {
    const el = msgsRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [count])

  return (
    <div className={uiClass(`chat-inner${guideCollapsed ? ' g-closed' : ''}`)}>
      <Button variant="native" size="plain" className={uiClass(cn("guide-open", guideCollapsed ? 'block!' : 'hidden!'))}
        onClick={onOpenGuide} title={t('guide_open')}>{t('guide_open_txt')}</Button>
      <div className={uiClass("msgs")} ref={msgsRef}>
        {s.msgs.map(m => <Message key={m.id} m={m} />)}
      </div>
      <Composer />
    </div>
  )
}
