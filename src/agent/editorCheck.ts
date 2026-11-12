/* 편집 카드 필수 항목 검사 — 섹션별로 비었거나 잘못된 항목의 이름 목록을 돌려준다.
   기준별 항목은 프로필 `fields[].required`, 지진 입력 완성도는 프로필 `seismic.ready`가 정한다. */
import { profileOf } from '../codes'
import type { BuildingSpec } from '../engine'
import { t, tv } from '../i18n'
import { editorToSpec, TOP_KEYS, type EditorState, type LateralState } from './editor'
import type { LateralGroup } from '../codes'

export type SectionKey = 'geom' | 'sections' | 'floors' | 'lateral' | 'walls'
export type EditorCheck = Record<SectionKey, string[]>

const pos = (v: unknown) => { const n = parseFloat(String(v ?? '').trim()); return Number.isFinite(n) && n > 0 }
const posList = (v: string) => { const parts = String(v ?? '').split(',').map(x => x.trim()).filter(Boolean); return parts.length > 0 && parts.every(pos) }

function lateralMissing(g: LateralGroup, ls: LateralState): string[] {
  if (!ls.on) return []
  return g.fields.filter(f => f.required && !pos(ls.vals[f.key])).map(f => f.label())
}

export function checkEditor(st: EditorState, base: BuildingSpec): EditorCheck {
  const PE = tv<Record<string, string>>('pe')
  const name = (k: string) => String(PE[k] ?? k).replace(/\s*\*$/, '')
  const prof = profileOf(base)
  const multi = pos(st.top.buildings) && +st.top.buildings > 1

  const geom: string[] = []
  for (const k of TOP_KEYS) {
    const v = st.top[k]
    if (k === 'spanX' || k === 'spanY') { if (!posList(v)) geom.push(name(k)) }
    else if (k === 'connectFloor') { if (multi && (v === '' || !Number.isFinite(+v) || +v < 0)) geom.push(name(k)) }
    else if (k === 'gap') { if (multi && !pos(v)) geom.push(name(k)) }
    else if (!pos(v)) geom.push(name(k))
  }

  const sections: string[] = []
  if (st.cols.some(r => !pos(r.H) || !pos(r.B))) sections.push(t('pal_cols'))
  if (st.beams.some(r => !pos(r.H) || !pos(r.B))) sections.push(t('pal_beams'))
  if (!st.mats.length) sections.push(t('pal_mats'))

  const floors: string[] = []
  if (st.rows.some(r => !pos(r.from) || !pos(r.to) || +r.to < +r.from)) floors.push(`${t('from')}/${t('to')}`)
  if (st.rows.some(r => !pos(r.h))) floors.push(t('ht'))
  if (!pos(st.slabThk)) floors.push(t('slab_thk'))

  const lateral = [...lateralMissing(prof.seismic, st.seis), ...lateralMissing(prof.wind, st.wind)]
  if (st.seis.on && !lateral.length) {
    const sp = (editorToSpec(st, base).seismic ?? {}) as Record<string, any>
    if (!prof.seismic.ready(sp)) lateral.push(t(prof.seismic.toggleKey))
  }

  const walls: string[] = []
  if (st.core.on && !pos(st.core.thick)) walls.push(`${t('central_shear_wall_core_au')} · ${t('wall_thick')}`)
  if (st.bearing.on && !pos(st.bearing.thick)) walls.push(`${t('bw_toggle')} · ${t('wall_thick')}`)

  return { geom, sections, floors, lateral, walls }
}

export const checkTotal = (c: EditorCheck) => Object.values(c).reduce((n, a) => n + a.length, 0)
