/* 앱 셸 — 바닐라 index.html 레이아웃·클래스명 유지(shared/app.css 재사용) */
import { useEffect, useRef, useState, type PointerEvent as RPointerEvent } from 'react'
import { Chat } from './components/Chat'
import { Drawers, type DrawerId } from './components/Drawers'
import { Guide } from './components/Guide'
import { Footer } from './components/Footer'
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

/* 채팅|우측 패널 분할 비율(%) — 드래그로 조절, 더블클릭 = 기본값. 뷰어별 편의라 localStorage(실패해도 기본값) */
const SPLIT_DEF = 49, SPLIT_MIN = 25, SPLIT_MAX = 75
function readSplit(): number {
  try { const v = parseFloat(localStorage.getItem('nx_split') || ''); return v >= SPLIT_MIN && v <= SPLIT_MAX ? v : SPLIT_DEF } catch { return SPLIT_DEF }
}
function saveSplit(v: number) { try { localStorage.setItem('nx_split', String(v)) } catch { /* 무시 */ } }

export function App() {
  const s = useStore()
  const [drawer, setDrawer] = useState<DrawerId>(null)
  const [guideCollapsed, setGuideCollapsed] = useState(false)
  const [split, setSplit] = useState(readSplit)
  const [dragging, setDragging] = useState(false)
  const mainRef = useRef<HTMLElement>(null)

  const onSplitDown = (e: RPointerEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.currentTarget.setPointerCapture(e.pointerId)
    setDragging(true)
  }
  const onSplitMove = (e: RPointerEvent<HTMLDivElement>) => {
    if (!dragging || !mainRef.current) return
    const r = mainRef.current.getBoundingClientRect()
    setSplit(Math.min(SPLIT_MAX, Math.max(SPLIT_MIN, ((e.clientX - r.left) / r.width) * 100)))
  }
  const onSplitUp = () => {
    if (!dragging) return
    setDragging(false)
    saveSplit(split)
    window.dispatchEvent(new Event('resize'))   // Plotly(responsive) 3D 뷰 재배치
  }
  const resetSplit = () => { setSplit(SPLIT_DEF); saveSplit(SPLIT_DEF); requestAnimationFrame(() => window.dispatchEvent(new Event('resize'))) }

  useEffect(() => {
    document.documentElement.lang = htmlLang(s.lang)
    document.title = t('meta_title')   // 탭 제목도 현재 언어 (공유 미리보기는 빌드 시 정적 메타)
    if (!greeted) { greeted = true; addMsg('bot', t('welcome')) }   // StrictMode 이중 실행 방지
  }, [s.lang])

  const toggleGuide = () => setGuideCollapsed(c => !c)

  return (
    <>
      <Header onOpenMapi={() => setDrawer('mapi')} onOpenLlm={() => setDrawer('llm')} />
      <main ref={mainRef} className={dragging ? 'splitting' : undefined} style={{ ['--split' as any]: `${split}%` }}>
        <section className="chat">
          <Guide collapsed={guideCollapsed} onToggle={toggleGuide} />
          <Chat guideCollapsed={guideCollapsed} onOpenGuide={toggleGuide} />
        </section>
        <div className="splitter" title={t('split_tip')} onPointerDown={onSplitDown} onPointerMove={onSplitMove}
          onPointerUp={onSplitUp} onPointerCancel={onSplitUp} onDoubleClick={resetSplit} />
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
      <Footer />
      <Drawers open={drawer} onClose={() => setDrawer(null)} />
    </>
  )
}
