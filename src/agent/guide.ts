/* GUIDE 패널 구조 — 문구는 사전: 섹션 g_<id>, 항목 g_<id>_<n>(라벨)·g_<id>_<n>_cmd(명령), 안내 g_<id>_note.
   send:true = 클릭 시 즉시 전송, 아니면 입력창에 채우기만 */

import type { I18nKey } from '../i18n'

/* 키 타입: 사전에 실제로 있는 g_* 키만 허용 — 항목 키 K 는 `${K}_cmd` 도 사전에 있어야 함 */
type CmdBase<K = I18nKey> = K extends `${infer B}_cmd` ? B : never
export type GuideItemKey = Extract<CmdBase, I18nKey>
export type GuideSecId = I18nKey extends infer K ? (K extends `g_${infer Id}` ? (Id extends `${string}_${string}` ? never : Id) : never) : never

export type GuideItem =
  | { div: true }
  | { note: Extract<I18nKey, `g_${string}_note`> }
  | { icon: string; key: GuideItemKey; send?: boolean }

export interface GuideSection { id: GuideSecId; icon: string; open: boolean; items: GuideItem[] }

export const GUIDE: GuideSection[] = [
  { id: 'build', icon: '⊞', open: true, items: [
    { icon: '🏠', key: 'g_build_1' },
    { icon: '🏢', key: 'g_build_2' },
    { icon: '🏬', key: 'g_build_3' },
    { icon: '🏥', key: 'g_build_4' },
    { icon: '🏫', key: 'g_build_5' },
    { div: true },
    { icon: '🏗', key: 'g_build_6' },
    { note: 'g_build_note' },
  ] },
  { id: 'section', icon: '◫', open: true, items: [
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
  { id: 'load', icon: '⬇', open: true, items: [
    { icon: '↓', key: 'g_load_1' },
    { icon: '↓', key: 'g_load_2' },
    { icon: '✕', key: 'g_load_3' },
    { icon: '✕', key: 'g_load_4' },
  ] },
  { id: 'analysis', icon: '∑', open: true, items: [
    { icon: '▷', key: 'g_analysis_1', send: true },
    { icon: '▷', key: 'g_analysis_2', send: true },
    { icon: '▷', key: 'g_analysis_3', send: true },
    { icon: '▷', key: 'g_analysis_4', send: true },
    { icon: '▷', key: 'g_analysis_5', send: true },
    { div: true },
    { icon: '◈', key: 'g_analysis_6', send: true },
  ] },
  { id: 'misc', icon: '⊟', open: false, items: [
    { icon: '↺', key: 'g_misc_1' },
    { div: true },
    { icon: '❓', key: 'g_misc_2', send: true },
    { icon: '◉', key: 'g_misc_3', send: true },
  ] },
]
