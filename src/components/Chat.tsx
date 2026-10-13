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
  if (m.kind === 'thinking') body = <div className="bubble"><span className="typing"><span /><span /><span /></span></div>
  else if (m.kind === 'plan') body = <div className="bubble"><PlanCard msg={m} /></div>
  else body = <div className="bubble" dangerouslySetInnerHTML={{ __html: plainIcons(m.html) }} />
  return (
    <div className={`msg ${m.role}`}>
      {m.kind !== 'thinking' && <div className="who"><span className="who-n">{who}</span>{m.ts && <span className="who-t">{m.ts}</span>}</div>}
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
    <div className="composer">
      <div className="modebar">
        <span>{t('mode')}</span>
        <span className={`tag ${llm ? 'llm' : 'local'}`}>{llm ? `LLM · ${label} · ${s.provModel}` : t('mode_local')}</span>
        <span style={{ flex: 1 }} />
        <span style={{ opacity: 0.6 }}>{llm ? label + t('brain') : s.llm ? t('mode_nokey') : ''}</span>
        <button className="clearchat" onClick={clearChat} title={t('clearchat_tip')}>{t('clearchat')}</button>
      </div>
      <div className="row">
        <textarea
          ref={ref}
          rows={1}
          value={text}
          placeholder={t('input_ph')}
          onChange={e => { setText(e.target.value); autosize() }}
          onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); void onSend() } }}
        />
        <button className="send" disabled={s.busy} onClick={() => void onSend()}>➤</button>
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
    <div className={`chat-inner${guideCollapsed ? ' g-closed' : ''}`}>
      <button className="guide-open" style={{ display: guideCollapsed ? 'block' : 'none' }}
        onClick={onOpenGuide} title={t('guide_open')}>{t('guide_open_txt')}</button>
      <div className="msgs" ref={msgsRef}>
        {s.msgs.map(m => <Message key={m.id} m={m} />)}
      </div>
      <Composer />
    </div>
  )
}
