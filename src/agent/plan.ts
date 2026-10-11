/* 건물 규격 설명카드 HTML + 편집 카드용 팔레트 헬퍼 (바닐라 planSummary · floorCompoLine · editorPalette) */
import { RC, type BuildingSpec, type Palette } from '../engine'
import { pick, roleLbl, t, useLbl } from '../i18n'

/** 건물유형 필드의 현재 언어 값 */
export function bt(typeKey: keyof typeof RC.BUILDING_TYPES, field: 'label' | 'desc' | 'tip'): string {
  return pick(RC.BUILDING_TYPES[typeKey][field])
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
  return `${openTag}<span style="font-size:1.4rem;line-height:1">${RC.BUILDING_TYPES[k].icon}</span>` +
    `<div><span style="color:var(--cyan);font-weight:700">${bt(k, 'label')}</span>` +
    `<span style="color:var(--muted);font-size:.82em;margin-left:7px">${bt(k, 'desc')}</span></div></div>`
}

export function planSummaryHTML(p: BuildingSpec): string {
  const k = p.bldgType
  const header = typeHeadHTML(p,
    '<div style="display:flex;align-items:center;gap:8px;margin-bottom:9px;padding-bottom:8px;border-bottom:1px dashed rgba(255,255,255,.06)">')
  const tip = k ? `<div style="margin-top:8px;font-size:.78em;color:var(--dim)">${bt(k, 'tip')}</div>` : ''
  const sec = sectionCompoLine(p)
  return `<div class="plan">${header}` +
    t('ps_bs', p.buildings, p.stories) +
    t('ps_plane', p.bayX, p.bayY, p.spanX, p.spanY) +
    t('ps_h', p.h1, p.hTyp) +
    t('ps_cb', p.colName, p.beamName) +
    (p.buildings >= 2 ? t('ps_link', p.connectFloor, p.gap) : '') +
    t('ps_mat', p.matName) +
    `<div style="margin-top:7px;font-size:.8em;color:var(--cyan);line-height:1.5">▤ ${t('floor_make_up')}: ${floorCompoLine(p)}</div>` +
    (sec ? `<div style="margin-top:6px;font-size:.78em;color:var(--amber);line-height:1.5">◫ ${t('section_zones')}<br>${sec}</div>` : '') +
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
