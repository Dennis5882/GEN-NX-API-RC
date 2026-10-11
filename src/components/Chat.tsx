/* 채팅 — 메시지 목록 + 입력창(모드바). plan 메시지는 PlanCard 로 렌더. */
import { useEffect, useRef, useState } from 'react'
import { PROVIDERS } from '../agent/llm'
import { clearChat, llmActive, registerComposer, send } from '../agent/session'
import { t } from '../i18n'
import { useStore, type ChatMsg } from '../state/store'
import { PlanCard } from './PlanCard'

function Message({ m }: { m: ChatMsg }) {
  const who = m.role === 'user' ? 'YOU' : 'AGENT'
  let body
  if (m.kind === 'thinking') body = <div className="bubble"><span className="typing"><span /><span /><span /></span></div>
  else if (m.kind === 'plan') body = <div className="bubble"><PlanCard msg={m} /></div>
  else body = <div className="bubble" dangerouslySetInnerHTML={{ __html: m.html }} />
  return <div className={`msg ${m.role}`}><div className="who">{who}</div>{body}</div>
}

function Composer() {
  const s = useStore()
  const [text, setText] = useState('')
  const ref = useRef<HTMLTextAreaElement>(null)

  const autosize = () => {
    const el = ref.current; if (!el) return
    el.style.height = 'auto'
    el.style.height = Math.min(el.scrollHeight, 120) + 'px'
  }

  useEffect(() => {
    registerComposer(txt => { setText(txt); requestAnimationFrame(() => { ref.current?.focus(); autosize() }) })
    return () => registerComposer(null)
  }, [])

  async function onSend() {
    const txt = text.trim(); if (!txt) return
    setText('')
    requestAnimationFrame(autosize)
    await send(txt)
    ref.current?.focus()
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
    <div className="chat-inner">
      <button className="guide-open" style={{ display: guideCollapsed ? 'block' : 'none' }}
        onClick={onOpenGuide} title={t('guide_open')}>{t('guide_open_txt')}</button>
      <div className="msgs" ref={msgsRef}>
        {s.msgs.map(m => <Message key={m.id} m={m} />)}
      </div>
      <Composer />
    </div>
  )
}
