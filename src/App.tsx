/* 앱 셸 — 바닐라 index.html 레이아웃·클래스명 유지(shared/app.css 재사용) */
import { useEffect, useState } from 'react'
import { Chat } from './components/Chat'
import { Drawers, type DrawerId } from './components/Drawers'
import { Guide } from './components/Guide'
import { Header } from './components/Header'
import { LogPanel, ModelPanel, ResultsPanel } from './components/Panels'
import { View3D, onView3DTab } from './components/View3D'
import { htmlLang, t, type I18nKey } from './i18n'
import { useStore, type PanelId } from './state/store'
import { addMsg, tab } from './state/ui'

const TABS: { id: PanelId; key: I18nKey }[] = [
  { id: 'logP', key: 'tab_log' },
  { id: 'modelP', key: 'tab_model' },
  { id: 'viewP', key: 'tab_3d' },
  { id: 'resP', key: 'tab_res' },
]

let greeted = false

export function App() {
  const s = useStore()
  const [drawer, setDrawer] = useState<DrawerId>(null)
  const [guideCollapsed, setGuideCollapsed] = useState(false)

  useEffect(() => {
    document.documentElement.lang = htmlLang(s.lang)
    if (!greeted) { greeted = true; addMsg('bot', t('welcome')) }   // StrictMode 이중 실행 방지
  }, [s.lang])

  const toggleGuide = () => setGuideCollapsed(c => !c)

  return (
    <>
      <Header onOpenMapi={() => setDrawer('mapi')} onOpenLlm={() => setDrawer('llm')} />
      <main>
        <section className="chat">
          <Guide collapsed={guideCollapsed} onToggle={toggleGuide} />
          <Chat guideCollapsed={guideCollapsed} onOpenGuide={toggleGuide} />
        </section>
        <section className="right">
          <div className="tabbar">
            {TABS.map(tb => (
              <div key={tb.id} className={`tab${s.panel === tb.id ? ' on' : ''}`}
                onClick={() => { tab(tb.id); if (tb.id === 'viewP') onView3DTab() }}>
                {t(tb.key)}
              </div>
            ))}
          </div>
          <div id="logP" className={`panel${s.panel === 'logP' ? ' on' : ''}`}><LogPanel /></div>
          <div id="modelP" className={`panel${s.panel === 'modelP' ? ' on' : ''}`}><ModelPanel /></div>
          <div id="viewP" className={`panel${s.panel === 'viewP' ? ' on' : ''}`}><View3D /></div>
          <div id="resP" className={`panel${s.panel === 'resP' ? ' on' : ''}`}><ResultsPanel /></div>
        </section>
      </main>
      <Drawers open={drawer} onClose={() => setDrawer(null)} />
    </>
  )
}
