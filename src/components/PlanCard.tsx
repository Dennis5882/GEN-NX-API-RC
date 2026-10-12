/* 건물 확인 카드 — 설명카드(건물유형) ↔ 편집카드(자유골조/수정). [실행]/[수정]/[취소].
   편집 시 디바운스 미리보기(3D). 실행되면(buildEpoch 증가) 모든 카드 버튼 제거 + 입력 잠금. */
import { useEffect, useMemo, useRef, useState } from 'react'
import { editorToSpec, initEditor, type EditorState } from '../agent/editor'
import { confirmBuild } from '../agent/local'
import { planSummaryHTML } from '../agent/plan'
import { t } from '../i18n'
import { S, useStore, type ChatMsg } from '../state/store'
import { draw3D, previewSpec, tab } from '../state/ui'
import { PlanEditor } from './PlanEditor'

type PlanMsg = Extract<ChatMsg, { kind: 'plan' }>

const PREVIEW_DEBOUNCE_MS = 250

export function PlanCard({ msg }: { msg: PlanMsg }) {
  const s = useStore()
  const [editing, setEditing] = useState(msg.editable)
  const [cancelled, setCancelled] = useState(false)
  const [st, setSt] = useState<EditorState | null>(() => (msg.editable ? initEditor(msg.spec) : null))
  const dirty = useRef(false)

  const spec = useMemo(() => (st ? editorToSpec(st, msg.spec) : msg.spec), [st, msg.spec])
  const live = s.buildEpoch === msg.epoch
  const showButtons = live && !cancelled

  /* 편집 변경 → pendingBuild 동기화 + 3D 미리보기 (첫 렌더 제외) */
  useEffect(() => {
    if (!st || !dirty.current) return
    const h = setTimeout(() => {
      if (msg.buildId === S.pendingBuildId) S.pendingBuild = spec
      tab('viewP'); previewSpec(spec)
    }, PREVIEW_DEBOUNCE_MS)
    return () => clearTimeout(h)
  }, [st, spec, msg.buildId])

  const update = (fn: (x: EditorState) => EditorState) => { dirty.current = true; setSt(prev => (prev ? fn(prev) : prev)) }

  function onEdit() {
    setEditing(true)
    setSt(initEditor(msg.spec))
    tab('viewP'); previewSpec(msg.spec)
  }

  return (
    <>
      <span dangerouslySetInnerHTML={{ __html: msg.intro }} />
      {editing && st
        ? <PlanEditor base={msg.spec} st={st} setSt={update} disabled={!live} />
        : <div dangerouslySetInnerHTML={{ __html: planSummaryHTML(msg.spec) }} />}
      {showButtons && (
        <div className="confirm-row">
          <button className="btn btn-c" onClick={() => void confirmBuild(spec, msg.buildId)}>{t('exec')}</button>
          {!editing && <button className="btn btn-ghost" onClick={onEdit}>{t('edit_btn')}</button>}
          <button className="btn btn-ghost" onClick={() => { setCancelled(true); if (S.preview) draw3D() }}>{t('cancel')}</button>
        </div>
      )}
    </>
  )
}
