/* GUIDE 사이드바 — 섹션 접기/펼치기, hint(입력창 채우기) / quick(즉시 전송) */
import { useRef, useState } from 'react'
import { GUIDE, type GuideSection } from '../agent/guide'
import { hint, quick } from '../agent/session'
import { t } from '../i18n'
import { useStore } from '../state/store'

function Section({ sec }: { sec: GuideSection }) {
  const [open, setOpen] = useState(sec.open)
  const itemsRef = useRef<HTMLDivElement>(null)
  const maxH = open ? `${itemsRef.current?.scrollHeight ?? 2000}px` : '0'

  return (
    <div className={`gsec${open ? '' : ' closed'}`}>
      <div className="gsec-hd" onClick={() => setOpen(o => !o)}>
        <span>{sec.icon}</span><span style={{ flex: 1 }}>{t(`g_${sec.id}`)}</span><span className="garrow">▾</span>
      </div>
      <div className="gsec-items" ref={itemsRef} style={{ maxHeight: maxH }}>
        {sec.items.map((it, i) => {
          if ('div' in it) return <div key={i} className="gsec-div" />
          if ('note' in it) return <div key={i} className="gsec-note">{t(it.note)}</div>
          const label = t(it.key), cmd = t(`${it.key}_cmd`)
          return (
            <button key={i} className="gcmd" title={cmd} onClick={() => (it.send ? quick(cmd) : hint(cmd))}>
              <i className="gicon">{it.icon}</i><span className="glabel">{label}</span>
              {it.send && <span className="gsend">↵</span>}
            </button>
          )
        })}
      </div>
    </div>
  )
}

export function Guide({ collapsed, onToggle }: { collapsed: boolean; onToggle(): void }) {
  useStore()
  return (
    <aside className={`guide${collapsed ? ' collapsed' : ''}`}>
      <div className="guide-hd">
        <span>{t('guide_title')}</span>
        <button className="guide-tog" onClick={onToggle} title={collapsed ? t('guide_open') : t('guide_close')}>
          {collapsed ? '⟩' : '⟨'}
        </button>
      </div>
      <div className="guide-body">
        {GUIDE.map(sec => <Section key={sec.id} sec={sec} />)}
      </div>
    </aside>
  )
}
