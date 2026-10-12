/* GUIDE 패널 구조 — 문구는 사전: 섹션 g_<id>, 항목 g_<id>_<n>(라벨)·g_<id>_<n>_cmd(명령), 안내 g_<id>_note.
   클릭 = 명령을 입력창에 타이핑해 보여준 뒤 바로 실행(채팅 입력과 같은 경로) — 직접 입력·클릭 두 방식을 함께 보여주기 위함.
   need:'review' = 현재 기준 프로필에 그 훅이 있을 때만 표시(기준 하드코딩 대신 기능 유무로 판정) */

import type { I18nKey } from '../i18n'

/* 키 타입: 사전에 실제로 있는 g_* 키만 허용 — 항목 키 K 는 `${K}_cmd` 도 사전에 있어야 함 */
type CmdBase<K = I18nKey> = K extends `${infer B}_cmd` ? B : never
export type GuideItemKey = Extract<CmdBase, I18nKey>
export type GuideSecId = I18nKey extends infer K ? (K extends `g_${infer Id}` ? (Id extends `${string}_${string}` ? never : Id) : never) : never

export type GuideItem =
  | { div: true }
  | { note: Extract<I18nKey, `g_${string}_note`> }
  | { icon: string; key: GuideItemKey; need?: 'review' }

/** acc = 섹션 강조색(app.css .gsec[data-acc]) */
export interface GuideSection { id: GuideSecId; icon: string; acc: 'cyan' | 'blue' | 'amber' | 'green' | 'violet'; open: boolean; items: GuideItem[] }

export const GUIDE: GuideSection[] = [
  { id: 'build', acc: 'cyan', icon: '⊞', open: true, items: [
    { icon: '🏠', key: 'g_build_1' },
    { icon: '🏢', key: 'g_build_2' },
    { icon: '🏬', key: 'g_build_3' },
    { icon: '🏥', key: 'g_build_4' },
    { icon: '🏫', key: 'g_build_5' },
    { div: true },
    { icon: '🏗', key: 'g_build_6' },
    { note: 'g_build_note' },
  ] },
  { id: 'section', acc: 'blue', icon: '◫', open: true, items: [
    { icon: '↕', key: 'g_section_1' },
    { icon: '↕', key: 'g_section_2' },
    { icon: '↕', key: 'g_section_3' },
    { icon: '↔', key: 'g_section_4' },
    { div: true },
    { icon: '🔢', key: 'g_section_5' },
    { icon: '📐', key: 'g_section_6' },
    { icon: '🧱', key: 'g_section_7' },
    { note: 'g_section_note' },
  ] },
  { id: 'load', acc: 'amber', icon: '⬇', open: true, items: [
    { icon: '↓', key: 'g_load_1' },
    { icon: '↓', key: 'g_load_2' },
    { icon: '✕', key: 'g_load_3' },
    { icon: '✕', key: 'g_load_4' },
  ] },
  { id: 'analysis', acc: 'green', icon: '∑', open: true, items: [
    { icon: '▶', key: 'g_analysis_1' },
    { icon: '〜', key: 'g_analysis_7' },
    { icon: '📋', key: 'g_analysis_8', need: 'review' },
    { icon: '⇣', key: 'g_analysis_2' },
    { icon: '⊥', key: 'g_analysis_3' },
    { icon: '≋', key: 'g_analysis_4' },
    { icon: '◎', key: 'g_analysis_5' },
    { div: true },
    { icon: '◈', key: 'g_analysis_6' },
  ] },
  { id: 'misc', acc: 'violet', icon: '⊟', open: false, items: [
    { icon: '↺', key: 'g_misc_1' },
    { div: true },
    { icon: '❓', key: 'g_misc_2' },
    { icon: '◉', key: 'g_misc_3' },
  ] },
]
