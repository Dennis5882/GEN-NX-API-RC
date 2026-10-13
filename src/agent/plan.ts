/* 건물 규격 설명카드 HTML + 편집 카드용 팔레트 헬퍼 (바닐라 planSummary · floorCompoLine · editorPalette) */
import { RC, type BuildingSpec, type Palette } from '../engine'
import { roleLbl, t, useLbl } from '../i18n'

/** 건물유형 문구 (사전 bt_<type>_label|desc|tip) */
export function bt(typeKey: keyof typeof RC.BUILDING_TYPES, field: 'label' | 'desc' | 'tip'): string {
  return t(`bt_${typeKey}_${field}`)
}

const rng = (r: { from: number; to: number }) => (r.from === r.to) ? `${r.from}F` : `${r.from}–${r.to}F`

/* 표준층 구성 한 줄: "1F 기단부(商業) · 2–14F 표준층(住宅) · 15F 지붕" */
function floorCompoLine(p: BuildingSpec): string {
  return RC.specToGroupRows(p).map(r => `${rng(r)} ${roleLbl(r.role)}(${useLbl(r.use)})`).join('  ·  ')
}

/* 구역별 단면/재료 — 다중 단면일 때만 줄 단위로 표시(단일이면 빈 문자열) */
function sectionCompoLine(p: BuildingSpec): string {
  const R = RC.specSections(p)
  if (R.sections.length <= 2 && R.mats.length <= 1) return ''
  return RC.specToGroupRows(p).map(r => `${rng(r)}: ${r.col || p.colName} / ${r.beam || p.beamName} · ${r.mat || p.matName}`).join('<br>')
}

/** 건물유형 헤더(아이콘·이름·설명). openTag = 감싸는 div 여는 태그 */
export function typeHeadHTML(p: BuildingSpec, openTag: string): string {
  const k = p.bldgType
  if (!k) return ''
  return `${openTag}<div><span class="plan-type">${bt(k, 'label')}</span>` +
    `<span class="plan-desc">${p.bearing?.on ? t('bw_desc') : bt(k, 'desc')}</span></div></div>`
}

export function planSummaryHTML(p: BuildingSpec): string {
  const k = p.bldgType
  const header = typeHeadHTML(p,
    '<div style="display:flex;align-items:center;gap:8px;margin-bottom:9px;padding-bottom:8px;border-bottom:1px dashed var(--line2)">')
  const tip = k ? `<div class="plan-tip">${bt(k, 'tip')}</div>` : ''
  const sec = sectionCompoLine(p)
  return `<div class="plan">${header}` +
    t('ps_bs', p.buildings, p.stories) +
    t('ps_plane', p.bayX, p.bayY, p.spanX, p.spanY) +
    t('ps_h', p.h1, p.hTyp) +
    (p.bearing?.on ? t('ps_bw', p.bearing.thick ?? 200, p.beamName, p.slabThk ?? 150) : t('ps_cb', p.colName, p.beamName)) +
    (p.buildings >= 2 ? t('ps_link', p.connectFloor, p.gap) : '') +
    t('ps_mat', p.matName) +
    `<div class="plan-sub"><span class="k">${t('floor_make_up')}</span> ${floorCompoLine(p)}</div>` +
    (sec ? `<div class="plan-sub"><span class="k">${t('section_zones')}</span><br>${sec}</div>` : '') +
    tip + `</div>`
}

/* 편집용 팔레트: 엔진 paletteFor + 최상위 기본 단면/재료를 항상 포함(드롭다운 기본 선택지) */
export function editorPalette(p: BuildingSpec): Palette {
  const pal = RC.paletteFor(p)
  const cols = pal.cols.slice(), beams = pal.beams.slice(), mats = pal.mats.slice()
  if (p.colName && !cols.some(c => c.name === p.colName)) cols.unshift({ name: p.colName, H: p.colH, B: p.colB })
  if (p.beamName && !beams.some(b => b.name === p.beamName)) beams.unshift({ name: p.beamName, H: p.beamH, B: p.beamB })
  if (p.matName && !mats.includes(p.matName)) mats.unshift(p.matName)
  return { cols, beams, mats }
}
