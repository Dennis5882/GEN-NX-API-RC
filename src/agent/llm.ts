/* ════════════════════════════════════════════════════════════
   LLM MODE — Claude / Gemini / GPT / DeepSeek tool-use 루프.
   키는 브라우저에서 직접 공급자에 전송(메모리 보관만). Gemini 는 gSchema() 정규화 필요.
   공급자별 제약(2026-10 공식 문서 확인):
   - GPT: Chat Completions 도구호출은 gpt-6-luna 가 reasoning_effort 'none' 일 때만. gpt-6.1-sol 은 미지원 → 목록 제외.
   - Gemini 3: 응답 part(thoughtSignature 포함)를 다음 요청에 그대로 재전송 → turn.raw 보존.
   - DeepSeek: thinking 기본 ON, assistant reasoning_content 를 모든 후속 요청에 재전송(누락 시 400).
════════════════════════════════════════════════════════════ */
import { actAnalyze, actDynamic } from '../actions/analysis'
import { actAddBracing, actAddLoad, actBuildFrame, actModifySection, actResizeSubset, clearModel } from '../actions/model'
import { actReview } from '../actions/review'
import { actStoryWeightVerify, actSseisVerify, actSwindVerify } from '../actions/verify'
import { CODE_IDS, PROFILES, profile, profileOf, stampSpec, takePrepNotes, type CodeId, type LateralGroup } from '../codes'
import { onView3DTab, setView } from '../components/View3D'
import { RC, type BuildingSpec } from '../engine'
import { escapeHtml, t } from '../i18n'
import { S, THEMES, type PanelId, type Provider, type ResultTab, type Table } from '../state/store'
import { addMsg, renderModelState, tab, thinking } from '../state/ui'
import { confirmBuild, proposeBuild } from './local'
import { extremum, momentTable, statusBrief } from './results'
import { setCode, setTheme } from './session'

/* 키 발급 안내 문구는 사전 prov_hint_<provider> */
export const PROVIDERS: Record<Provider, { label: string; keyLabel: string; ph: string; models: string[]; def: string }> = {
  claude: { label: 'Claude', keyLabel: 'ANTHROPIC API KEY', ph: 'sk-ant-…',
    models: ['claude-sonnet-5-5', 'claude-opus-5-5', 'claude-haiku-5-5', 'claude-fable-5-1'], def: 'claude-sonnet-5-5' },
  gemini: { label: 'Gemini', keyLabel: 'GOOGLE AI STUDIO API KEY', ph: 'AIza…',
    models: ['gemini-3.8-flash', 'gemini-3.1-pro-preview', 'gemini-3.5-flash-lite'], def: 'gemini-3.8-flash' },
  gpt: { label: 'GPT', keyLabel: 'OPENAI API KEY', ph: 'sk-…',
    models: ['gpt-6-luna', 'gpt-6-astra'], def: 'gpt-6-luna' },
  deepseek: { label: 'DeepSeek', keyLabel: 'DEEPSEEK API KEY', ph: 'sk-…',
    models: ['deepseek-flash', 'deepseek-v4-pro'], def: 'deepseek-flash' },
}

/* OpenAI Chat Completions 호환 공급자(GPT · DeepSeek) 엔드포인트 */
const OPENAI_COMPAT: Partial<Record<Provider, string>> = {
  gpt: 'https://api.openai.com/v1/chat/completions',
  deepseek: 'https://api.deepseek.com/chat/completions',
}

/* ── 도구 정의 — 현재 설계기준 프로필에서 동적으로 생성(지진·풍 입력 항목은 기준마다 다름) ── */
const PANELS: Record<string, PanelId> = { log: 'logP', model: 'modelP', '3d': 'viewP', result: 'resP' }
const plain = (h: string) => h.replace(/<br\s*\/?>/g, '\n').replace(/<[^>]+>/g, '').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&').replace(/\n{3,}/g, '\n\n').trim()

/* 결과 표(N·mm) → 읽기 단위. 헤더로 판정: 모멘트 kN·m, 힘 kN, 변위 mm */
function unitOf(h: string): { k: number; u: string } {
  if (/moment|^M[XYZ]\b|^M[yz]/i.test(h) && !/torsion/i.test(h)) return { k: 1e-6, u: 'kN·m' }
  if (/torsion/i.test(h)) return { k: 1e-6, u: 'kN·m' }
  if (/^F[XYZ]\b|axial|shear|force/i.test(h)) return { k: 1e-3, u: 'kN' }
  if (/^D[XYZ]\b|^R[XYZ]\b|disp/i.test(h)) return { k: 1, u: /^R[XYZ]/.test(h) ? 'rad' : 'mm' }
  return { k: 1, u: '' }
}
function resultTable(which: ResultTab): Table | null { return which === 'moment' ? momentTable() : S.results[which] }

function queryResults(inp: any): string {
  const which = (inp.which || 'react') as ResultTab
  const T = resultTable(which)
  if (!T || !T.data.length) return 'no result yet — run_analysis first'
  const H = T.head, idCol = H.findIndex(h => /^node$|^elem/i.test(h) || /NODE|ELEM/i.test(h)), lcCol = H.findIndex(h => /load/i.test(h))
  let rows = T.data
  if (inp.loadcase) rows = rows.filter(r => lcCol >= 0 && String(r[lcCol]).toUpperCase().includes(String(inp.loadcase).toUpperCase()))
  if (inp.id != null) rows = rows.filter(r => idCol >= 0 && String(r[idCol]) === String(inp.id))
  const numCols = H.map((_, i) => i).filter(i => i !== idCol && i !== lcCol && rows.some(r => r[i] !== '' && !isNaN(parseFloat(r[i]))) && !/index/i.test(H[i]))
  const partCol = H.findIndex(h => /^part/i.test(h))   // 부재력 I/J 단
  const fmt = (r: string[]) => [idCol >= 0 ? `${H[idCol]} ${r[idCol]}` : '', partCol >= 0 ? r[partCol] : '', lcCol >= 0 ? r[lcCol] : '',
    ...numCols.map(i => { const u = unitOf(H[i]); const v = parseFloat(r[i]); return `${H[i]}=${isNaN(v) ? r[i] : +(v * u.k).toFixed(u.k === 1 ? 3 : 2)}${u.u ? ' ' + u.u : ''}` })].filter(Boolean).join(', ')
  S.resultTab = which; tab('resP')
  if (inp.id != null) return rows.length ? rows.slice(0, 12).map(fmt).join('\n') : `no rows for ${H[idCol] || 'id'} ${inp.id}`
  const col = inp.column ? H.findIndex(h => h.toUpperCase() === String(inp.column).toUpperCase()) : -1
  const ci = col >= 0 ? col : (inp.column ? H.findIndex(h => h.toUpperCase().includes(String(inp.column).toUpperCase())) : -1)
  if (ci < 0) {
    /* 열 미지정 → 숫자 열마다 절댓값 최대 */
    return `${which}: ${rows.length} rows. Columns: ${numCols.map(i => H[i]).join(', ')}.\n` + numCols.map(i => {
      let best: string[] | null = null
      for (const r of rows) { const v = Math.abs(parseFloat(r[i])); if (!isNaN(v) && (!best || v > Math.abs(parseFloat(best[i])))) best = r }
      const u = unitOf(H[i])
      return best ? `max|${H[i]}| = ${+(parseFloat(best[i]) * u.k).toFixed(3)} ${u.u} @ ${idCol >= 0 ? H[idCol] + ' ' + best[idCol] : '?'}${lcCol >= 0 ? ' (' + best[lcCol] + ')' : ''}` : ''
    }).filter(Boolean).join('\n')
  }
  const n = Math.min(Math.max(+inp.n || 5, 1), 30)
  const mode = inp.mode || 'absmax'
  const val = (r: string[]) => parseFloat(r[ci])
  const sorted = rows.filter(r => !isNaN(val(r))).sort((a, b) => mode === 'max' ? val(b) - val(a) : mode === 'min' ? val(a) - val(b) : Math.abs(val(b)) - Math.abs(val(a)))
  return `${which} by ${H[ci]} (${mode}, top ${n} of ${sorted.length}):\n` + sorted.slice(0, n).map(fmt).join('\n')
}

/** 프로필 입력 항목 → JSON schema (라벨·단위·선택지를 설명에 담아 LLM 이 기준 용어로 매핑) */
function lateralSchema(g: LateralGroup, what: string, p: BuildingSpec): any {
  const props: Record<string, any> = { on: { type: 'boolean', description: `apply ${what} loads (story forces + combinations)` } }
  for (const f of g.fields) {
    const def = f.def(p)
    const d = `${f.label()}${f.unit ? ` [${f.unit}]` : ''}${def !== '' ? ` (default ${def})` : ' (blank = auto)'}`
    props[f.key] = f.kind === 'select'
      ? { type: 'string', enum: f.options!().map(o => o.value), description: `${d}. Options: ${f.options!().map(o => `${o.value}=${o.label}`).join('; ')}` }
      : { type: 'number', description: d }
  }
  return { type: 'object', description: `${what} input for design code ${profile().id}; omitted keys keep defaults`, properties: props }
}

function specProps(): Record<string, any> {
  const prof = profile(), p = RC.DEFAULT_SPEC as BuildingSpec
  return {
    bldgType: { type: 'string', enum: Object.keys(RC.BUILDING_TYPES), description: 'building-type template (sets bays/spans/heights/sections/uses/podium): apartment=residential, office, commercial=retail, hospital, school. Other given fields override the template.' },
    buildings: { type: 'integer', description: 'number of towers (1–4)' }, stories: { type: 'integer', description: 'stories above ground' },
    bayX: { type: 'integer' }, bayY: { type: 'integer' },
    spanX: { type: ['number', 'array'], items: { type: 'number' }, description: 'mm; single value = uniform, or array of per-bay distances e.g. [3000,4000,3000]' },
    spanY: { type: ['number', 'array'], items: { type: 'number' }, description: 'mm; single value = uniform, or array of per-bay distances' },
    h1: { type: 'number', description: 'first-floor height mm' }, hTyp: { type: 'number', description: 'typical floor height mm' },
    gap: { type: 'number', description: 'gap between towers mm' }, connectFloor: { type: 'integer', description: 'floor where towers are linked by connecting beams, 0=none' },
    podium: { type: 'integer', description: 'podium (commercial) floors at base, 0=none' },
    colH: { type: 'number', description: 'column depth mm' }, colB: { type: 'number', description: 'column width mm' },
    beamH: { type: 'number', description: 'beam depth mm' }, beamB: { type: 'number', description: 'beam width mm' },
    matName: { type: 'string', enum: Object.keys(prof.materials), description: `concrete grade (${prof.id} catalogue, default ${prof.defaultMat})` },
    slabThk: { type: 'number', description: 'slab thickness mm (default 150) — slab self-weight is added to floor dead load; 0 if already in SDL' },
    seismic: lateralSchema(prof.seismic, 'seismic', p),
    wind: lateralSchema(prof.wind, 'wind', p),
    bearing: { type: 'object', description: 'bearing-wall (wall-type) structure: party walls on every X grid line (Y direction, full depth) + corridor wall on the middle Y line (every other bay); columns inside walls omitted. KR apartments default to this. Give colH/colB to keep a moment frame instead.',
      properties: { on: { type: 'boolean' }, thick: { type: 'number', description: 'wall thickness mm (default 200)' } } },
    core: { type: 'object', description: 'shear-wall core (4 walls around nx×ny bays, full height). Omitted position = plan center. To move it, give absolute bay indices (read the current ones from get_status/spec).',
      properties: {
        on: { type: 'boolean' }, thick: { type: 'number', description: 'wall thickness mm (default 250)' },
        ix: { type: 'integer', description: 'lower-left bay index in X, 0-based (0 … bayX−nx)' }, iy: { type: 'integer', description: 'lower-left bay index in Y, 0-based (0 … bayY−ny)' },
        nx: { type: 'integer', description: 'core width in bays (1–2)' }, ny: { type: 'integer', description: 'core depth in bays (1–2)' },
        layout: { type: 'string', enum: ['same', 'mirror', 'each'], description: '2+ towers: same position / tower B mirrored in X / per tower (pos)' },
        pos: { type: 'array', items: { type: 'object', properties: { ix: { type: 'integer' }, iy: { type: 'integer' } } }, description: 'layout=each: per-tower {ix,iy}, index = tower (0 = A uses ix/iy)' },
        skip: { type: 'array', items: { type: 'integer' }, description: 'tower indices without a core (0 = A, 1 = B)' },
      } },
  }
}

function tools() {
  const sp = specProps()
  const none = { type: 'object', properties: {} }
  const list: { name: string; description: string; input_schema: any }[] = [
    { name: 'build_frame', description: 'Build a NEW RC moment-frame model in Gen NX (clears the current model): nodes, columns, beams, connecting beams, fixed supports, materials/sections, floor dead+live loads (SDL + slab self-weight), and — if seismic/wind .on — static story forces and code load combinations.',
      input_schema: { type: 'object', properties: sp, required: ['stories'] } },
    { name: 'update_spec', description: 'Change parameters of the EXISTING model and rebuild it with the merged spec (e.g. stories, floor height, material, slab thickness, turn seismic/wind on or change their inputs). Section-only changes should use modify_section / resize_subset instead (no rebuild).',
      input_schema: { type: 'object', properties: sp } },
    { name: 'modify_section', description: 'Resize ALL columns or ALL beams of the existing model by changing their shared section. Incremental edit — does not rebuild.',
      input_schema: { type: 'object', properties: { target: { type: 'string', enum: ['col', 'beam'] }, H: { type: 'number', description: 'depth mm' }, B: { type: 'number', description: 'width mm' } }, required: ['target', 'H', 'B'] } },
    { name: 'resize_subset', description: 'Resize only columns or beams on specific floors (creates a dedicated section). Incremental edit.',
      input_schema: { type: 'object', properties: { target: { type: 'string', enum: ['col', 'beam'] }, H: { type: 'number' }, B: { type: 'number' }, floors: { type: 'array', items: { type: 'integer' }, description: '1-based floor numbers, e.g. [1,2,3]' } }, required: ['target', 'H', 'B', 'floors'] } },
    { name: 'add_load', description: 'Add a load case and a vertical nodal load on every node of one floor. Incremental edit.',
      input_schema: { type: 'object', properties: { name: { type: 'string' }, type: { type: 'string', description: 'D/L/W/E/U' }, floor: { type: 'integer' }, fz: { type: 'number', description: 'vertical force per node N, negative = downward' } }, required: ['name', 'type', 'floor', 'fz'] } },
    { name: 'add_bracing', description: 'Add diagonal bracing in one tower at given floors. Incremental edit.',
      input_schema: { type: 'object', properties: { building: { type: 'integer', description: '0-based tower index' }, floors: { type: 'array', items: { type: 'integer' } } }, required: ['building', 'floors'] } },
    { name: 'run_analysis', description: 'Run linear static analysis and fetch reaction / displacement / beam-force tables.', input_schema: none },
    { name: 'run_dynamic', description: 'Eigenvalue (modal) analysis; with rs=true also response-spectrum analysis using the code spectrum, code RS scaling (TW 3.2/3.3 base-shear adjustment, CN minimum shear-weight ratio, KR KDS 41 17 00 7.3.3.5 Cm = 0.85V/V_t when V_t < 0.85V — drift is checked without Cm), and — when RS is the primary method (TW ≥50 m or ≥15 stories; CN >40 m; KR per 7.1: category C ≥70 m/≥21 stories or irregular ≥20 m/≥6 stories, category D ≥70 m or irregular >20 m/>5 stories) — seismic combinations switched to RSX/RSY. Ends with review indicators when the code has them. Needs a built model with seismic on.',
      input_schema: { type: 'object', properties: { rs: { type: 'boolean', description: 'include response spectrum (default true)' } } } },
    { name: 'review_indicators', description: 'Recompute code review indicators from Gen NX story tables, each vs its code limit — CN (审图指标): height class, 抗震等级, concrete grade, drift ratio, shear-weight ratio, torsional displacement ratio, effective mass, period ratio; KR (KDS 41 17 00): seismic design category, system height limit, analysis method, story drift Cd·δe/IE, torsional irregularity H-1, effective mass, RS scaling Cm. Available only for codes that define them (currently CN, KR). Needs run_dynamic first.', input_schema: none },
    { name: 'get_result', description: 'Summarize a computed result and open it in the Results tab.', input_schema: { type: 'object', properties: { which: { type: 'string', enum: ['disp', 'react', 'force'] } }, required: ['which'] } },
    { name: 'get_status', description: 'Current model summary: spec, sections, load cases, edits, design code, analysis state.', input_schema: none },
    { name: 'set_design_code', description: `Switch the design code for NEW models (an existing model keeps its own code). ${CODE_IDS.map(id => `${id} = ${PROFILES[id].designCode}`).join(', ')}.`,
      input_schema: { type: 'object', properties: { code: { type: 'string', enum: CODE_IDS } }, required: ['code'] } },
    { name: 'show_panel', description: 'Switch the right-hand panel.', input_schema: { type: 'object', properties: { panel: { type: 'string', enum: Object.keys(PANELS) } }, required: ['panel'] } },
    { name: 'propose_model', description: 'Show a model proposal in the WEB UI without touching Gen NX: a confirmation card (spec summary with Run / Edit / Cancel) plus a live 3D preview. Works offline (no Gen NX connection). Use when the user wants to see/preview/review a model first, or when Gen NX is not connected. The user can then press Run, or you call confirm_build.',
      input_schema: { type: 'object', properties: sp, required: ['stories'] } },
    { name: 'confirm_build', description: 'Build the currently proposed (pending) model card in Gen NX — same as the user pressing Run. Needs a Gen NX connection.', input_schema: none },
    { name: 'set_view', description: 'Control the 3D view in the web UI: camera preset, zoom, and which element groups are visible. Opens the 3D panel.',
      input_schema: { type: 'object', properties: {
        camera: { type: 'string', enum: ['iso', 'front', 'side', 'top'], description: 'iso = isometric, front = X–Z elevation, side = Y–Z elevation, top = plan' },
        zoom: { type: 'number', description: 'magnification relative to the preset: 2 = twice as close, 0.5 = farther, 1 = reset' },
        show: { type: 'object', description: 'visibility toggles; omitted keys unchanged', properties: { col: { type: 'boolean' }, beam: { type: 'boolean' }, node: { type: 'boolean' }, floor: { type: 'boolean', description: 'floor outline lines' } } },
      } } },
    { name: 'show_results', description: 'Open the Results panel on a table: react (support reactions), disp (nodal displacements), force (beam/column member forces), moment (bending moments only).',
      input_schema: { type: 'object', properties: { tab: { type: 'string', enum: ['react', 'disp', 'force', 'moment'] } }, required: ['tab'] } },
    { name: 'query_results', description: 'Read values from the static-analysis result tables (converted to kN, kN·m, mm). Without column → max |value| of every column. With column → sorted top-n rows (mode absmax/max/min). With id → all rows of that node (react/disp) or element (force/moment). Optional loadcase filter (e.g. DL, LL, EX, cLCB1).',
      input_schema: { type: 'object', properties: {
        which: { type: 'string', enum: ['react', 'disp', 'force', 'moment'] },
        column: { type: 'string', description: 'header name, e.g. FZ, DZ, DX, Axial, Shear-z, Moment-y' },
        mode: { type: 'string', enum: ['absmax', 'max', 'min'] }, n: { type: 'integer', description: 'rows to return (default 5, max 30)' },
        id: { type: 'integer', description: 'node number (react/disp) or element number (force/moment)' },
        loadcase: { type: 'string' },
      }, required: ['which'] } },
    { name: 'get_dynamic', description: 'Modal / response-spectrum summary of the last run_dynamic: T1, periods and mass participation per mode, RS scaling and checks.', input_schema: none },
    { name: 'get_review', description: 'Return the current review-indicator table (CN 审图指标 / KR KDS checks): item, direction, value, limit, status, governing story, clause.', input_schema: none },
    { name: 'set_theme', description: 'Change the web UI colour theme.', input_schema: { type: 'object', properties: { theme: { type: 'string', enum: [...THEMES], description: 'navy = black/navy dark (default), light = white/navy, cyber = cyan dark' } }, required: ['theme'] } },
    { name: 'clear_model', description: 'Delete all model data in Gen NX.', input_schema: none },
    { name: 'verify_seismic_sseis', description: 'QA only (TW/USER TYPE): feed our static seismic story forces into Gen NX db/SSEIS and compare its story shear / overturning / accidental torsion with ours. Does not change analysis loads. Needs stories registered via Gen GUI "Auto Generate Story Data". Not supported for CN.', input_schema: none },
    { name: 'verify_story_weight', description: 'QA only: compare our seismic story weights with Gen NX model-derived story weights.', input_schema: none },
    { name: 'verify_swind', description: 'QA only (TW/USER TYPE): feed our static wind story forces into Gen NX db/SWIND and compare. Needs Gen GUI "Auto Generate Story Data". Not supported for CN.', input_schema: none },
  ]
  return list
}

/* ── 시스템 프롬프트 — 현재 기준·모델 상태를 매 요청마다 반영 ── */
const CODE_BRIEF: Record<CodeId, string> = {
  TW: `TW (Taiwan) — concrete TWN-USD112 (Gen NX DCON label); seismic 建築物耐震設計規範 (2.2 V = I/(1.4αy)·(SaD/Fu)m·W, V*/VM floors, empirical T = 0.070hn^0.75, Ft = 0.07TV, accidental torsion 5%, R 4.8 RC SMRF, I hospital 1.5 / school·commercial 1.25); wind 耐風設計規範 2014 (q(z)=0.06K(z)[I·V10]², G 1.88); combinations 112 5.3.1 (1.6W, 0.8W, seismic per direction). Response spectrum is the PRIMARY method when ≥50 m or ≥15 stories above ground (or method=RS for irregular buildings); RS is scaled to ≥0.9V (regular) / 1.0V (irregular). Seismic inputs come from the site (SDS, SD1; T0 for Taipei Basin) — use the site preset values if the user names a city/district.`,
  KR: `KR (Korea) — concrete KDS 41 20 00 / KDS 14 20 (Gen NX DCON "KDS 41 20 : 2022", material KS19(RC), Ec = 8500·∛(fck+Δf); catalogue C21–C60); loads KDS 41 12 00 (live table 3.2-1, office partition 1.0 kN/m²); combinations 1.7.1 (1.4D, 1.2D+1.6L+0.5Lr, 1.2D+1.0W+1.0L+0.5Lr, 1.2D+1.0E+1.0L, 0.9D+1.0W, 0.9D+1.0E — wind factor 1.0 because KDS wind is a 500-year strength-level load; seismic 100% + 30% orthogonal). Seismic KDS 41 17 00: zone I/II (S = 2.0Z = 0.22/0.14, or S from the hazard map), site class S1–S5 (S4 default), Fa/Fv table 4.2-1/4.2-2, SDS = S·2.5·Fa·2/3, SD1 = S·Fv·2/3; importance (중요도 특/1/2/3 → I_E 1.5/1.2/1.0; auto: general hospital 특, school / ≥5-story apartment / ≥5,000 m² retail 1, others 2); seismic design category A–D (table 5.2-1/5.2-2); system (seismic.system: SMF R8, IMF R5, OMF R3, BF_SW, BF_OW R5, DS_SW, DS_OW, DI_SW, DI_OW, SWF) gives R/Ω0/Cd; Cs = SDS/(R/IE) ≤ SD1/((R/IE)T), ≥ 0.044·SDS·IE ≥ 0.01; Ta = 0.0466hn^0.9 (moment frame) or 0.0488hn^0.75 (walls), T ≤ Cu·Ta; vertical distribution exponent k 1–2; accidental eccentricity 5%. Dynamic (response spectrum) analysis is PRIMARY when required by 7.1 (category C: ≥70 m or ≥21 stories, irregular ≥20 m or ≥6 stories; category D: ≥70 m, irregular >20 m or >5 stories) or method=RS; RS base shear is scaled to ≥ 0.85·V (Cm, 7.3.3.5). Wind KDS 41 12 00 ch.5: V_H = V0·Kzr(H)·Iw, q_H = ½ρV_H², windward 0.8kz, leeward −0.5, gust factor G_D (5.6). After run_dynamic, review indicators: seismic design category, system height limit (category D), analysis method, story drift Δ = Cd·δe/IE ≤ 0.010/0.015/0.020 h (내진등급 특/I/II), torsional irregularity H-1 (>1.2), effective mass ≥90%, Cm.`,
  CN: `CN (China) — concrete GB 50010-2010 (Gen NX DCON GB/T50010-10); seismic GB 50011-2010 base-shear method (设防烈度 intensity, 设计地震分组 group, 场地类别 site class, damping), minimum shear-weight ratio λ per GB 55002 4.2.3, accidental eccentricity 5%; wind GB 50009-2012 (wk = βz·μs·μz·w0, terrain A–D); combinations GB 55001/55002 (γG 1.3, γQ 1.5, γEh 1.4). Response spectrum (振型分解反应谱法, Gen NX native CH2010) is the PRIMARY method when height above ground > 40 m (GB 50011 5.1.2) or method=RS; the RS is amplified to satisfy λ. Concrete for RC members ≥ C25, ≥ C30 when 抗震等级 is 二级 or higher (GB 55008 2.0.2; catalogue C25–C60). After run_dynamic, review indicators (审图指标) are reported: building height vs JGJ 3 3.3.1 A/B-class limits, 抗震等级 (GB 55002 5.2.1; seismic.category auto/B/C = 抗震设防类别 per GB 50223-2008 — auto: hospital/school → 乙类, others 丙类; 乙类 raises seismic measures one degree (GB 55002 2.3.2), 9度+1 → 特一级, seismic action unchanged), concrete grade, drift ratio (框架 1/550, 框架-剪力墙/核心筒 1/800; JGJ 3 3.7.3), 剪重比, 扭转位移比 (≤1.2; A ≤1.5, B ≤1.4, ≤1.6 where drift ≤40% of limit), 有效质量系数 ≥90%, 周期比 (high-rise only, A ≤0.9 / B ≤0.85). Seismic intensity strings look like 7_010 = 7度(0.10g), 8_020 = 8度(0.20g).`,
}

function system(): string {
  const prof = profile(), d = RC.DEFAULT_SPEC
  const m = S.model, sp = m.spec
  const model = m.nodes.length && sp
    ? `Current model: code ${sp.code || prof.id}, ${sp.buildings} tower(s) × ${sp.stories} stories, ${sp.colName}/${sp.beamName}, ${sp.matName}, seismic ${sp.seismic?.on ? 'ON' : 'off'}, wind ${sp.wind?.on ? 'ON' : 'off'}; static results ${S.results.react ? 'available' : 'none'}; dynamic ${m.dynamic ? (m.dynamic.rs ? 'eigen + RS done' : 'eigen done') : 'not run'}; review ${S.review ? 'available' : 'none'}. Gen NX ${S.connected ? 'connected' : 'NOT connected'}.`
    : `No model yet. Gen NX ${S.connected ? 'connected' : 'NOT connected (tools that touch Gen NX will fail — tell the user to connect via ⚙ first)'}.`
  return `You are a structural engineering agent that builds, edits and analyzes RC frame models in MIDAS Gen NX through tools. Act — call tools rather than describing what you would do.

ACTIVE DESIGN CODE: ${CODE_BRIEF[prof.id]}
${model}

Defaults when unspecified: ${d.buildings} towers, ${d.stories} stories, ${d.bayX}×${d.bayY} bays, ${d.spanX}×${d.spanY} mm spans, 1F ${d.h1} / typical ${d.hTyp} mm, columns ${d.colH}×${d.colB}, beams ${d.beamB}×${d.beamH} (B×H), material ${prof.defaultMat}, slab 150 mm. If the user names a building type (residential/apartment, office, retail/commercial, hospital, school) pass bldgType — it supplies realistic spans, heights, sections, uses and podium. Seismic weight w0 blank = derived from the model dead load (members + slab + SDL), which matches the dynamic-analysis mass.

Typical workflow: build_frame (seismic.on / wind.on when lateral loads are wanted) → run_analysis → run_dynamic (rs=true) → review_indicators (CN, KR). When the user asks for "응답스펙트럼/反应谱/反應譜/response spectrum" use run_dynamic rs=true; for "审图/审查指标/심사 지표/review" use review_indicators; for a different design code use set_design_code before building.
Editing an existing model: never call build_frame. Sections → modify_section / resize_subset; loads → add_load; bracing → add_bracing; anything else (stories, heights, material, slab, seismic/wind inputs) → update_spec. Floors are 1-based. After an edit, offer to re-run analysis. If unsure of the state call get_status.
WEB UI CONTROL (works without Gen NX): propose_model shows a confirmation card + 3D preview (prefer it when Gen NX is not connected or the user wants to preview first; confirm_build builds it); set_view controls the 3D camera (iso/front/side/top), zoom and visible groups; show_results / query_results open and read result tables (answer numeric questions such as "max reaction", "displacement of node 51", "top 5 column axial forces" with query_results instead of guessing); get_dynamic / get_review return modal and review data; set_theme changes colours; show_panel switches panels.
QA tools verify_seismic_sseis / verify_swind work only for TW (USER TYPE) and need Gen's GUI "Auto Generate Story Data" first; verify_story_weight is informational.

Reply concisely in the user's language with correct structural terminology — Korean (구조, 골조, 기둥, 보, 단면, 하중, 부재력, 변위, 반력, 가새, 스팬, 층, 응답스펙트럼, 층간변위각), English, Traditional Chinese for Taiwan (結構, 構架, 柱, 梁, 斷面, 載重, 桿件內力, 位移, 反力, 斜撐, 跨距, 樓層, 反應譜, 層間變位角), or Simplified Chinese for mainland China (结构, 框架, 柱, 梁, 截面, 荷载, 构件内力, 位移, 支座反力, 斜撑, 跨度, 楼层, 反应谱, 层间位移角, 剪重比). State key parameters you used. Units: mm, N (kN for story forces).`
}

function buildSpec(inp: any, base: BuildingSpec): BuildingSpec {
  const tpl: any = inp.bldgType && RC.BUILDING_TYPES[inp.bldgType as keyof typeof RC.BUILDING_TYPES]
    ? { ...RC.BUILDING_TYPES[inp.bldgType as keyof typeof RC.BUILDING_TYPES], bldgType: inp.bldgType } : {}
  const { seismic, wind, core, bearing, ...rest } = inp
  let p: BuildingSpec = { ...base, ...tpl, ...rest }
  if (core) p.core = { ...(base.core || {}), ...core }
  if (bearing) (p as any).bearing = { ...((base as any).bearing || {}), ...bearing }
  if (seismic) p.seismic = { ...(base.seismic || {}), ...seismic }
  if (wind) p.wind = { ...(base.wind || {}), ...wind }
  if (inp.colH || inp.colB) { p.colH = inp.colH || p.colH; p.colB = inp.colB || p.colB; p.colName = `C${p.colH}x${p.colB}`; delete (p as any).palette }
  if (inp.beamH || inp.beamB) { p.beamH = inp.beamH || p.beamH; p.beamB = inp.beamB || p.beamB; p.beamName = `B${p.beamB}x${p.beamH}`; delete (p as any).palette }
  if (inp.connectFloor === 0) p.connectFloor = 0
  if (Array.isArray(p.spanX)) p.bayX = p.spanX.length
  if (Array.isArray(p.spanY)) p.bayY = p.spanY.length
  /* 코어 벽은 항상 현재 형상으로 다시 생성(층수·경간 변경 반영) */
  if (p.core || (p as any).bearing) p.walls = RC.specWalls(p)
  /* 편집카드(editorToSpec)와 같은 마무리 — 질량원 활하중비·풍↔지진 공유값(KR 중요도·시스템, TW I) */
  const seis = { ...(p.seismic || {}) }, wnd = { ...(p.wind || {}) }
  profileOf(p).finalizeLateral?.(seis, wnd)
  if (p.seismic) p.seismic = seis
  if (p.wind) p.wind = wnd
  return p
}

/** 도구 인자로 직접 준 항목 → stampSpec 의 prepareNew 가 덮어쓰지 않음 */
function withExplicit(p: BuildingSpec, inp: any): BuildingSpec {
  const ex = Object.keys(inp || {}).filter(k => inp[k] != null)
  if (inp?.colH || inp?.colB) ex.push('col')
  if (Array.isArray(inp?.spanX) || Array.isArray(inp?.spanY)) ex.push('span')
  p._explicit = ex
  return p
}

async function callTool(name: string, inp: any): Promise<string> {
  if (name === 'build_frame') {
    const p = stampSpec(withExplicit(buildSpec(inp, { ...RC.DEFAULT_SPEC } as BuildingSpec), inp))   // 현재 설계기준 기록 + 재료명 변환 + 기준별 보정
    const notes = takePrepNotes(p)
    tab('logP'); await actBuildFrame(p)
    return (notes.length ? `Code defaults applied: ${notes.map(n => n.replace(/<[^>]+>/g, '')).join(' / ')}. ` : '') + `Built ${p.buildings} tower(s) × ${p.stories} stories (code ${p.code}). Nodes=${S.model.nodes.length}, elements=${S.model.cols.length + S.model.beams.length + S.model.links.length}. Seismic ${p.seismic?.on ? 'on' : 'off'}, wind ${p.wind?.on ? 'on' : 'off'}.`
  }
  if (name === 'update_spec') {
    if (!S.model.spec) return 'ERROR: no model — use build_frame'
    const p = buildSpec(inp, S.model.spec)   // 모델 자신의 기준 유지
    tab('logP'); await actBuildFrame(p)
    return `Rebuilt with updated spec: ${p.buildings} tower(s) × ${p.stories} stories, ${p.colName}/${p.beamName}, ${p.matName}, seismic ${p.seismic?.on ? 'on' : 'off'}, wind ${p.wind?.on ? 'on' : 'off'}.`
  }
  if (name === 'modify_section') { tab('logP'); return await actModifySection(inp.target, inp.H, inp.B) }
  if (name === 'resize_subset') { tab('logP'); return await actResizeSubset(inp.target, inp.H, inp.B, inp.floors || []) }
  if (name === 'add_load') { tab('logP'); return await actAddLoad(inp.name, inp.type, inp.floor, inp.fz) }
  if (name === 'add_bracing') { tab('logP'); return await actAddBracing(inp.building, inp.floors || []) }
  if (name === 'verify_seismic_sseis') { tab('logP'); return plain(await actSseisVerify()) }
  if (name === 'verify_story_weight') { tab('logP'); return plain(await actStoryWeightVerify()) }
  if (name === 'verify_swind') { tab('logP'); return plain(await actSwindVerify()) }
  if (name === 'run_analysis') {
    await actAnalyze(); tab('resP')
    const d = S.results.disp && extremum(S.results.disp, 'DZ'), r = S.results.react && extremum(S.results.react, 'FZ')
    return `Analysis done. Max vertical disp ${d ? d.v.toFixed(3) + 'mm @node ' + d.node : 'n/a'}; max vertical reaction ${r ? (r.v / 1000).toFixed(1) + 'kN @node ' + r.node : 'n/a'}.`
  }
  /* 동적해석·심사 결과는 표·판정이 담긴 HTML 이라 채팅에 그대로 남기고, LLM 에는 평문 요약 */
  if (name === 'run_dynamic') {
    const msg = await actDynamic({ rs: inp.rs !== false })
    addMsg('bot', msg); tab(S.review ? 'resP' : 'logP')
    return plain(msg)
  }
  if (name === 'review_indicators') {
    const msg = await actReview()
    addMsg('bot', msg); if (S.review) tab('resP')
    return plain(msg)
  }
  if (name === 'get_result') {
    const which = inp.which as 'disp' | 'react' | 'force'
    const ext = extremum(S.results[which] || { head: [], data: [] }, which === 'react' ? 'FZ' : which === 'disp' ? 'DZ' : 'MY')
    S.resultTab = which; tab('resP')
    return ext ? `extreme ${ext.v} @node ${ext.node} (units N, mm)` : 'no result yet — run_analysis first'
  }
  if (name === 'set_design_code') {
    if (!CODE_IDS.includes(inp.code)) return `ERROR: code must be one of ${CODE_IDS.join(', ')}`
    setCode(inp.code)
    return `Design code for new models = ${inp.code} (${PROFILES[inp.code as CodeId].designCode}).${S.model.spec ? ` Existing model keeps ${S.model.spec.code || '?'}.` : ''}`
  }
  if (name === 'show_panel') { const id = PANELS[inp.panel]; if (!id) return 'ERROR: unknown panel'; tab(id); if (id === 'viewP') onView3DTab(); return `Showing ${inp.panel}.` }
  if (name === 'clear_model') {
    await clearModel()
    S.model.nodes = []; S.model.cols = []; S.model.beams = []; S.model.links = []
    renderModelState(); return 'Model cleared.'
  }
  if (name === 'propose_model') {
    const p = stampSpec(withExplicit(buildSpec(inp, { ...RC.DEFAULT_SPEC } as BuildingSpec), inp))
    const notes = ((p.prepNotes as string[]) || []).map(n => n.replace(/<[^>]+>/g, ''))   // proposeBuild 가 카드에 표시 후 제거
    proposeBuild(p, false)   // 확인 카드 + 3D 미리보기 (Gen NX 불필요)
    return (notes.length ? `Code defaults applied: ${notes.join(' / ')}. ` : '') + `Proposal card shown with 3D preview: ${p.buildings} tower(s) × ${p.stories} stories, ${p.colName}/${p.beamName}, ${p.matName} (code ${p.code}). Waiting for the user to press Run (or call confirm_build).`
  }
  if (name === 'confirm_build') {
    if (!S.pendingBuild) return 'ERROR: no pending proposal — use propose_model or build_frame'
    if (!S.connected) return 'ERROR: Gen NX not connected — ask the user to connect via ⚙ first'
    await confirmBuild(S.pendingBuild, S.pendingBuildId)
    return S.model.nodes.length ? `Built from the proposal: nodes=${S.model.nodes.length}.` : 'Build did not complete — see the chat/log.'
  }
  if (name === 'set_view') {
    const mag = +inp.zoom > 0 ? +inp.zoom : null   // 프리셋 대비 배율 → 카메라 거리 = 1/배율 (카메라만 바꾸면 기본 거리)
    setView({ cam: inp.camera, zoom: mag ? 1 / mag : inp.camera ? 1 : undefined, vis: inp.show })
    tab('viewP')
    const v = S.view3d
    return `3D view: camera ${v.cam}, zoom ×${(1 / v.zoom).toFixed(2)}, visible ${Object.entries(v.vis).filter(([, on]) => on).map(([k]) => k).join('/') || 'none'}.${S.preview || S.model.nodes.length ? '' : ' (nothing to display yet)'}`
  }
  if (name === 'show_results') {
    const tb = inp.tab as ResultTab
    if (!resultTable(tb)) return 'no result yet — run_analysis first'
    S.resultTab = tb; tab('resP'); return `Showing ${tb} table.`
  }
  if (name === 'query_results') return queryResults(inp)
  if (name === 'get_dynamic') {
    const d = S.model.dynamic
    if (!d) return 'no dynamic result — run_dynamic first'
    return JSON.stringify({ T1: d.T1, rs: d.rs, rsPrimary: d.rsPrimary, Cs: d.Cs, V: d.V, Ta: d.Ta, rsChk: d.rsChk, modes: (d.modes || []).slice(0, 12) })
  }
  if (name === 'get_review') {
    if (!S.review) return 'no review — run_dynamic (or review_indicators) first'
    tab('resP')
    return `basis ${S.review.rs ? 'response spectrum' : 'static'}\n` + S.review.items.map(i => `${i.status.toUpperCase()} ${i.label}${i.dir ? ' ' + i.dir : ''}: ${i.value} (limit ${i.limit}${i.where ? ', at ' + i.where : ''}; ${i.clause})`).join('\n')
  }
  if (name === 'set_theme') { if (!(THEMES as readonly string[]).includes(inp.theme)) return 'ERROR: unknown theme'; setTheme(inp.theme); return `Theme = ${inp.theme}.` }
  if (name === 'get_status') {
    const sp = S.model.spec
    return plain(statusBrief()) + (sp ? ` Code ${sp.code}; seismic ${JSON.stringify(sp.seismic || {})}; wind ${JSON.stringify(sp.wind || {})}; slab ${sp.slabThk ?? 150} mm; core ${coreBrief(sp)}.` : '') +
      (S.model.edits && S.model.edits.length ? (' Edits: ' + S.model.edits.join('; ')) : '')
  }
  return 'unknown tool'
}

/** 코어 현재 배치(LLM 이 상대 이동을 절대 인덱스로 바꿀 수 있게) */
function coreBrief(sp: BuildingSpec): string {
  const c: any = sp.core
  if (!c?.on) return 'off'
  const L = RC.coreLayout(sp, c)
  return JSON.stringify({ thick: c.thick ?? 250, nx: L.nx, ny: L.ny, bays: [L.nbx, L.nby], layout: L.layout, towers: L.towers })
}

function genId(): string { return 'tc_' + Math.random().toString(36).slice(2, 10) }
function safeJSON(s: string): any { try { return JSON.parse(s) } catch { return {} } }

/* Gemini requires type to be a single string (OpenAPI 3.0), not an array */
function gSchema(s: any): any {
  if (!s || typeof s !== 'object') return s
  const r: any = {}
  for (const k of Object.keys(s)) {
    if (k === 'type' && Array.isArray(s[k])) r.type = s[k].includes('array') ? 'array' : s[k][0]
    else if (k === 'items') r.items = gSchema(s[k])
    else if (k === 'properties') r.properties = Object.fromEntries(Object.entries(s[k]).map(([pk, pv]) => [pk, gSchema(pv)]))
    else r[k] = s[k]
  }
  // items only valid on array type
  if (r.items && r.type !== 'array') delete r.items
  return r
}

function buildLLMRequest(provider: Provider, model: string, key: string): { url: string; headers: Record<string, string>; body: any } {
  if (provider === 'claude') {
    const messages = S.conv.map(tn => {
      if (tn.role === 'user') return { role: 'user', content: tn.text }
      if (tn.role === 'assistant') {
        const c: any[] = []
        if (tn.text) c.push({ type: 'text', text: tn.text })
        ;(tn.calls || []).forEach(k => c.push({ type: 'tool_use', id: k.id, name: k.name, input: k.args }))
        return { role: 'assistant', content: c.length ? c : '' }
      }
      return { role: 'user', content: tn.results!.map(r => ({ type: 'tool_result', tool_use_id: r.id, content: r.output })) }
    })
    return { url: 'https://api.anthropic.com/v1/messages',
      headers: { 'Content-Type': 'application/json', 'x-api-key': key,
        'anthropic-version': '2023-06-01', 'anthropic-dangerous-direct-browser-access': 'true' },
      body: { model, max_tokens: 2048, system: system(), tools: tools(), messages } }
  }
  const compatUrl = OPENAI_COMPAT[provider]
  if (compatUrl) {
    const messages: any[] = [{ role: 'system', content: system() }]
    S.conv.forEach(tn => {
      if (tn.role === 'user') messages.push({ role: 'user', content: tn.text })
      else if (tn.role === 'assistant') {
        const m: any = { role: 'assistant', content: tn.text || null }
        if (tn.reasoning != null) m.reasoning_content = tn.reasoning   // DeepSeek thinking: 반드시 재전송
        if ((tn.calls || []).length) m.tool_calls = tn.calls!.map(k => ({ id: k.id, type: 'function',
          function: { name: k.name, arguments: JSON.stringify(k.args || {}) } }))
        messages.push(m)
      } else tn.results!.forEach(r => messages.push({ role: 'tool', tool_call_id: r.id, content: r.output }))
    })
    const body: any = { model, messages, tools: tools().map(tl => ({ type: 'function',
      function: { name: tl.name, description: tl.description, parameters: tl.input_schema } })) }
    if (/^gpt-6-luna/.test(model)) body.reasoning_effort = 'none'   // luna: 도구호출은 none 에서만
    return { url: compatUrl, headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + key }, body }
  }
  const contents: any[] = []
  S.conv.forEach(tn => {
    if (tn.role === 'user') contents.push({ role: 'user', parts: [{ text: tn.text }] })
    else if (tn.role === 'assistant') {
      // Gemini 3: thoughtSignature 가 붙은 원본 part 를 그대로 재전송
      if (tn.raw) { contents.push({ role: 'model', parts: tn.raw }); return }
      const parts: any[] = []
      if (tn.text) parts.push({ text: tn.text })
      ;(tn.calls || []).forEach(k => parts.push({ functionCall: { name: k.name, args: k.args || {} } }))
      contents.push({ role: 'model', parts })
    } else contents.push({ role: 'user', parts: tn.results!.map(r => ({ functionResponse: { name: r.name, response: { result: r.output } } })) })
  })
  return { url: `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(key)}`,
    headers: { 'Content-Type': 'application/json' },
    body: { systemInstruction: { parts: [{ text: system() }] },
      tools: [{ functionDeclarations: tools().map(tl => ({ name: tl.name, description: tl.description, parameters: gSchema(tl.input_schema) })) }],
      contents } }
}

interface LLMReply { text: string; calls: { id: string; name: string; args: any }[]; reasoning?: string; raw?: any[] }

function parseLLMResponse(provider: Provider, data: any): LLMReply {
  if (data.error) throw new Error(data.error.message || JSON.stringify(data.error))
  if (provider === 'claude') {
    const text = data.content.filter((c: any) => c.type === 'text').map((c: any) => c.text).join('\n')
    const calls = data.content.filter((c: any) => c.type === 'tool_use').map((c: any) => ({ id: c.id, name: c.name, args: c.input || {} }))
    return { text, calls }
  }
  if (OPENAI_COMPAT[provider]) {
    const m = data.choices?.[0]?.message || {}
    const calls = (m.tool_calls || []).map((tc: any) => ({ id: tc.id, name: tc.function.name, args: safeJSON(tc.function.arguments) }))
    return { text: m.content || '', calls, reasoning: m.reasoning_content ?? undefined }
  }
  const parts = data.candidates?.[0]?.content?.parts || []
  const text = parts.filter((p: any) => p.text).map((p: any) => p.text).join('\n')
  const calls = parts.filter((p: any) => p.functionCall).map((p: any) => ({ id: genId(), name: p.functionCall.name, args: p.functionCall.args || {} }))
  return { text, calls, raw: parts }
}

export async function handleLLM(txt: string): Promise<void> {
  const provider = S.provider, model = S.provModel.trim(), key = S.provKey.trim()
  S.conv.push({ role: 'user', text: txt })
  let th: { remove(): void } | null = thinking()
  const dropThinking = () => { if (th) { th.remove(); th = null } }
  try {
    let loop = 0
    while (loop++ < 12) {   // 빌드→해석→동적→심사 연쇄 여유
      const req = buildLLMRequest(provider, model, key)
      const res = await fetch(req.url, { method: 'POST', headers: req.headers, body: JSON.stringify(req.body) })
      const data = await res.json()
      const { text, calls, reasoning, raw } = parseLLMResponse(provider, data)
      S.conv.push({ role: 'assistant', text, calls, reasoning, raw })
      if (text) { dropThinking(); addMsg('bot', escapeHtml(text).replace(/\n/g, '<br>')) }
      if (!calls.length) break
      const results: { id: string; name: string; output: string }[] = []
      for (const c of calls) {
        let out: string
        try { out = await callTool(c.name, c.args || {}) } catch (e: any) { out = 'ERROR: ' + e.message }
        results.push({ id: c.id, name: c.name, output: String(out) })
      }
      S.conv.push({ role: 'tool', results })
    }
    dropThinking()
  } catch (e: any) {
    dropThinking()
    addMsg('bot', t('llm_err', provider, escapeHtml(e.message)))
  }
}
