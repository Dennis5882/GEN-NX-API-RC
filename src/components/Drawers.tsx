/* 설정 드로어 — ⚙ MIDAS API(#drawerMapi) / AI LLM(#drawerLlm). 스크림 공유. 키는 메모리에만. */
import { useState } from 'react'
import { PROVIDERS } from '../agent/llm'
import { setProvider, testConn, type TestOut } from '../agent/session'
import { t } from '../i18n'
import { S, notify, useStore, type Provider } from '../state/store'

export type DrawerId = 'mapi' | 'llm' | null

function DrawerHead({ title, sub, onClose }: { title: string; sub: string; onClose(): void }) {
  return (
    <header>
      <h1 style={{ fontSize: '.9rem' }}>{title}<small>{sub}</small></h1>
      <div className="spacer" />
      <div className="gear" onClick={onClose}>✕</div>
    </header>
  )
}

function MapiDrawer({ open, onClose }: { open: boolean; onClose(): void }) {
  const s = useStore()
  const [out, setOut] = useState<TestOut | null>(null)

  async function onTest() {
    setOut({ cls: '', text: t('test_ing') })
    setOut(await testConn())
  }

  return (
    <div className={`drawer${open ? ' on' : ''}`}>
      <DrawerHead title={t('set_title')} sub="MIDAS Gen NX" onClose={onClose} />
      <div className="body">
        <div className="field">
          <label>BASE URL</label>
          <input value={s.baseUrl} onChange={e => { S.baseUrl = e.target.value; notify() }} />
        </div>
        <div className="field">
          <label>MAPI-KEY</label>
          <input type="password" value={s.mapiKey} placeholder={t('mapi_key_ph')}
            onChange={e => { S.mapiKey = e.target.value; notify() }} />
          <div className="hint" dangerouslySetInnerHTML={{ __html: t('mapi_hint_html') }} />
        </div>
        <button className="btn btn-c" onClick={onTest}>{t('conn_test')}</button>
        {out && <div className={`test-out${out.cls ? ' ' + out.cls : ''}`} style={{ display: 'block' }}>{out.text}</div>}
        <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
          <button className="btn btn-c" onClick={onClose}>{t('save')}</button>
          <button className="btn btn-ghost" onClick={onClose}>{t('close')}</button>
        </div>
      </div>
    </div>
  )
}

function LlmDrawer({ open, onClose }: { open: boolean; onClose(): void }) {
  const s = useStore()
  const cfg = PROVIDERS[s.provider]

  return (
    <div className={`drawer${open ? ' on' : ''}`}>
      <DrawerHead title={t('ai_section')} sub="LLM · AI Brain" onClose={onClose} />
      <div className="body">
        <div className="toggle-row" style={{ border: 'none', paddingTop: 0, marginBottom: 18 }}>
          <div>
            <div style={{ fontSize: '.85rem' }}>{t('llm_mode')}</div>
            <div style={{ fontSize: '.7rem', color: 'var(--muted)' }}>{t('llm_mode_desc')}</div>
          </div>
          <label className="switch">
            <input type="checkbox" checked={s.llm} onChange={e => { S.llm = e.target.checked; notify() }} />
            <span className="track" /><span className="knob" />
          </label>
        </div>
        <div className="field">
          <label>PROVIDER</label>
          <div className="prov-seg">
            {(Object.keys(PROVIDERS) as Provider[]).map(p => (
              <button key={p} className={s.provider === p ? 'on' : ''} onClick={() => setProvider(p)}>{PROVIDERS[p].label}</button>
            ))}
          </div>
        </div>
        <div className="field">
          <label>{cfg.keyLabel}</label>
          <input type="password" value={s.provKey} placeholder={cfg.ph}
            onChange={e => { S.provKey = e.target.value; notify() }} />
          <div className="hint" dangerouslySetInnerHTML={{ __html: t(`prov_hint_${s.provider}`) }} />
        </div>
        <div className="field">
          <label>MODEL</label>
          <input list="modelList" value={s.provModel} onChange={e => { S.provModel = e.target.value; notify() }} />
          <datalist id="modelList">{cfg.models.map(m => <option key={m} value={m} />)}</datalist>
          <div className="hint">{t('model_hint')}</div>
        </div>
        <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
          <button className="btn btn-c" onClick={onClose}>{t('save')}</button>
          <button className="btn btn-ghost" onClick={onClose}>{t('close')}</button>
        </div>
      </div>
    </div>
  )
}

export function Drawers({ open, onClose }: { open: DrawerId; onClose(): void }) {
  return (
    <>
      <div className={`scrim${open ? ' on' : ''}`} onClick={onClose} />
      <MapiDrawer open={open === 'mapi'} onClose={onClose} />
      <LlmDrawer open={open === 'llm'} onClose={onClose} />
    </>
  )
}
