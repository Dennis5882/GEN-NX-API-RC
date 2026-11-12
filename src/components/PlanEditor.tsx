import { Button } from './ui/button'
import { NativeSelect } from './ui/native-select'
import { Input } from './ui/input'
import { EditorSection, Segmented, SwitchRow } from './editor/EditorParts'
import { checkEditor } from '../agent/editorCheck'
import { uiClass } from '@/styles/component-classes'
import { cn } from '@/lib/utils'
/* 편집 가능 규격 카드 — 상단 그리드 · 단면/재료 팔레트 · 표준층 표 · 내진 · 풍 · 코어.
   상태(EditorState)가 바뀔 때마다 onChange(spec) — 부모가 미리보기 갱신(디바운스). */
import { profileOf, type LateralGroup } from '../codes'
import { FG_ROLES, FG_USES, coreLayout, useOf, type BuildingSpec } from '../engine'
import {
  applyTop, coreInput, effectiveSel, newKey, paletteOf, renumber, TOP_KEYS,
  type CoreState, type EditorState, type FgRow, type LateralState, type PalRow, type TopKey,
} from '../agent/editor'
import { typeHeadHTML } from '../agent/plan'
import { roleLbl, t, tv, useLbl } from '../i18n'
import { useState, type CSSProperties } from 'react'

interface Props {
  base: BuildingSpec
  st: EditorState
  setSt(fn: (s: EditorState) => EditorState): void
  disabled?: boolean
}

const TOP_UNIT: Partial<Record<TopKey, string>> = { spanX: 'mm', spanY: 'mm', gap: 'mm' }
const TOP_TEXT: Partial<Record<TopKey, boolean>> = { spanX: true, spanY: true }

function Unit({ u }: { u?: string }) { return u ? <span className={uiClass("pe-u")}>{u}</span> : null }

/** 선택지가 4개 이하이고 짧으면 분절 버튼, 아니면 드롭다운 */
function Choice({ value, options, onChange, label }: { value: string; options: { value: string; label: string }[]; onChange(v: string): void; label?: string }) {
  const short = options.length >= 2 && options.length <= 4 && options.every(o => o.label.length <= 8)
  return short
    ? <Segmented value={value} options={options} onChange={onChange} label={label} />
    : <NativeSelect plain value={value} onChange={e => onChange(e.target.value)}>
        {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </NativeSelect>
}

const TOWER = ['A', 'B', 'C', 'D']
const SIZES: [number, number][] = [[1, 1], [2, 1], [1, 2], [2, 2]]

/** 전단벽 코어 — 켜기·두께 + 미니 평면 격자(칸 클릭·화살표 이동)·크기 + 2동 이상 적용 동·배치(같은 위치/좌우 대칭/동별) */
function CoreSection({ base, st, setSt, first }: Pick<Props, 'base' | 'st' | 'setSt'> & { first?: boolean }) {
  const c = st.core
  const [ed, setEd] = useState(0)
  const set = (fn: (c: CoreState) => CoreState) => setSt(s => ({ ...s, core: fn(s.core) }))
  const geo = applyTop({ ...base }, st)
  const L = coreLayout(geo, coreInput(c))
  const nb = L.towers.length
  const edit = c.layout === 'each' && ed < nb ? ed : 0
  const cur = L.towers[edit] || L.towers[0]
  /** 편집 동 위치 지정 — 엔진과 같은 범위 보정 */
  const place = (ix: number, iy: number) => set(k => {
    ix = Math.min(Math.max(0, ix), L.nbx - L.nx); iy = Math.min(Math.max(0, iy), L.nby - L.ny)
    if (edit === 0) return { ...k, ix, iy }
    const pos = k.pos.slice(); pos[edit] = { ix, iy }; return { ...k, pos }
  })
  const centerAll = () => set(k => (edit === 0 ? { ...k, ix: null, iy: null } : { ...k, pos: k.pos.map((q, i) => (i === edit ? null : q)) }))
  const btn = 'px-[8px]! py-[2px]! min-w-[28px]!'
  const cell = Math.max(14, Math.min(26, Math.floor(220 / Math.max(L.nbx, L.nby))))
  return (
    <div className={uiClass(first ? '' : '[margin-top:14px]! [border-top:1px_dashed_var(--border)]! [padding-top:12px]!')} >
      <SwitchRow checked={c.on} onChange={v => set(k => ({ ...k, on: v }))} label={<>🧱 {t('central_shear_wall_core_au')}</>} />
      <div className={uiClass("pe-grid [margin-top:10px]!")} >
        <div className={uiClass("pe-f")}><label>{t('wall_thick')}</label><div className={uiClass("pe-in")}>
          <Input plain type="number" step="any" value={c.thick} onChange={e => set(k => ({ ...k, thick: e.target.value }))} /><Unit u="mm" /></div></div>
        {c.on && <div className={uiClass("pe-f")}><label>{t('core_size')}</label><div className={uiClass("pe-in")}>
          <Choice label={t('core_size')} value={`${L.nx}x${L.ny}`} onChange={v => { const [nx, ny] = v.split('x').map(Number); set(k => ({ ...k, nx, ny })) }}
            options={SIZES.filter(([x, y]) => x <= L.nbx && y <= L.nby).map(([x, y]) => ({ value: `${x}x${y}`, label: `${x}×${y}` }))} /></div></div>}
        {c.on && nb > 1 && <div className={uiClass("pe-f")}><label>{t('core_layout')}</label><div className={uiClass("pe-in")}>
          <Choice label={t('core_layout')} value={c.layout} onChange={v => set(k => ({ ...k, layout: v as CoreState['layout'] }))}
            options={(['same', 'mirror', 'each'] as const).map(v => ({ value: v, label: t(`core_layout_${v}`) }))} /></div></div>}
        {c.on && nb > 1 && <div className={uiClass("pe-f")}><label>{t('core_towers')}</label><div className={uiClass("pe-in [gap:10px]!")} >
          {L.towers.map(tw => <label className={uiClass("[display:inline-flex]! [align-items:center]! [gap:3px]! [cursor:pointer]!")} key={tw.building} >
            <Input plain type="checkbox" checked={tw.on} onChange={e => set(k => ({ ...k, skip: e.target.checked ? k.skip.filter(b => b !== tw.building) : [...k.skip, tw.building] }))} />{TOWER[tw.building]}
          </label>)}
        </div></div>}
      </div>
      {c.on && <div className={uiClass("[display:flex]! [gap:14px]! [align-items:flex-start]! [flex-wrap:wrap]! [margin-top:10px]!")} >
        <div>
          <div className={uiClass("[font-size:.74rem]! [color:var(--txt-2)]! [margin-bottom:4px]!")} >
            {t('core_pos')}{nb > 1 ? ` · ${TOWER[edit]}` : ''} ({cur.ix + 1}, {cur.iy + 1})
          </div>
          <div className={uiClass("grid grid-cols-[repeat(var(--core-cols),var(--core-cell))] gap-[2px]")} style={{ '--core-cols': L.nbx, '--core-cell': `${cell}px` } as CSSProperties} role="grid">
            {Array.from({ length: L.nby }, (_, r) => L.nby - 1 - r).flatMap(iy => Array.from({ length: L.nbx }, (_, ix) => {
              const inCore = cur.on && ix >= cur.ix && ix < cur.ix + L.nx && iy >= cur.iy && iy < cur.iy + L.ny
              return <Button variant="native" size="plain" className={uiClass("size-[var(--core-cell)]! bg-transparent! opacity-100! data-[active=true]:bg-primary! data-[active=true]:opacity-85! [padding:0]! [border:1px_solid_var(--border)]! [border-radius:2px]! [cursor:pointer]!")} key={`${ix}_${iy}`} type="button" title={`X${ix + 1}–X${ix + 2} · Y${iy + 1}–Y${iy + 2}`}
                onClick={() => place(ix, iy)}
                data-active={inCore} />
            }))}
          </div>
        </div>
        <div className={uiClass("[display:grid]! [grid-template-columns:repeat(3,_auto)]! [gap:3px]! [align-self:center]!")} >
          <span /><Button variant="native" size="plain" type="button" className={uiClass(btn)} onClick={() => place(cur.ix, cur.iy + 1)}>▲</Button><span />
          <Button variant="native" size="plain" type="button" className={uiClass(btn)} onClick={() => place(cur.ix - 1, cur.iy)}>◀</Button>
          <Button variant="native" size="plain" type="button" className={uiClass(cn(btn, 'text-[.7rem]!'))} onClick={centerAll}>{t('core_center')}</Button>
          <Button variant="native" size="plain" type="button" className={uiClass(btn)} onClick={() => place(cur.ix + 1, cur.iy)}>▶</Button>
          <span /><Button variant="native" size="plain" type="button" className={uiClass(btn)} onClick={() => place(cur.ix, cur.iy - 1)}>▼</Button><span />
        </div>
        {c.layout === 'each' && nb > 1 && <div className={uiClass("[align-self:center]!")} >
          <div className={uiClass("[font-size:.74rem]! [color:var(--txt-2)]! [margin-bottom:4px]!")} >{t('core_edit')}</div>
          <div className={uiClass("[display:flex]! [gap:4px]!")} >{L.towers.map(tw => <Button variant="native" size="plain" key={tw.building} type="button" className={uiClass(cn(btn, edit === tw.building ? 'font-bold! border-primary!' : 'font-normal!'))} onClick={() => setEd(tw.building)}>{TOWER[tw.building]}</Button>)}</div>
        </div>}
      </div>}
      {c.on && <div className={uiClass("pe-tip")}>{t('core_grid_tip')}{c.layout === 'mirror' && nb > 1 ? ` · ${t('core_mirror_tip')}` : ''}</div>}
      <div className={uiClass("pe-tip")}>{t('places_4_sided_plate_shear')}</div>
    </div>
  )
}

/** 횡하중(지진·풍) 섹션 — 항목·프리셋·안내문은 설계기준 프로필이 정의 */
function LateralSection({ g, icon, st, set, first }: {
  g: LateralGroup; icon: string; st: LateralState; set(next: LateralState): void; first?: boolean
}) {
  const setVal = (k: string, v: string) => set({ ...st, vals: { ...st.vals, [k]: v } })
  const presets = g.presets?.list()
  const applyPreset = (idx: string) => {
    const pr = presets?.[+idx]; if (idx === '' || !pr) return
    const vals = { ...st.vals }
    for (const [k, v] of Object.entries(pr.values)) vals[k] = v == null ? '' : String(v)
    set({ ...st, vals })
  }
  return (
    <div className={uiClass(first ? '' : '[border-top:1px_dashed_var(--border)]! [margin-top:14px]! [padding-top:12px]!')}>
      <SwitchRow checked={st.on} onChange={v => set({ ...st, on: v })} label={<>{icon} {t(g.toggleKey)}</>} />
      <div className={uiClass("pe-grid [margin-top:10px]!")} >
        {presets && g.presets && (
          <div className={uiClass("pe-f pe-full")}><label>{t(g.presets.labelKey)}</label><div className={uiClass("pe-in")}>
            <NativeSelect plain defaultValue="" onChange={e => applyPreset(e.target.value)}>
              <option value="">{t('manual')}</option>
              {presets.map((z, i) => <option key={i} value={i}>{z.label}</option>)}
            </NativeSelect></div></div>
        )}
        {g.fields.map(f => (
          <div className={uiClass("pe-f")} key={f.key}><label>{f.label()}</label><div className={uiClass("pe-in")}>
            {f.kind === 'select'
              ? <Choice label={f.label()} value={st.vals[f.key] ?? ''} onChange={v => setVal(f.key, v)} options={f.options!()} />
              : <Input plain type="number" step="any" value={st.vals[f.key] ?? ''} onChange={e => setVal(f.key, e.target.value)} />}
            <Unit u={f.unit} /></div></div>
        ))}
      </div>
      <div className={uiClass("pe-tip")} dangerouslySetInnerHTML={{ __html: g.tipHtml() }} />
    </div>
  )
}

export function PlanEditor({ base, st, setSt, disabled }: Props) {
  const PE = tv<Record<string, string>>('pe')
  const pal = paletteOf(st, base)

  /* ── 상단 그리드 ── */
  const setTop = (k: TopKey, v: string) => setSt(s => {
    const top = { ...s.top, [k]: v }
    // 가변 스팬(콤마)이면 跨數 입력칸 동기화
    if (k === 'spanX' || k === 'spanY') {
      const n = v.split(',').map(x => parseFloat(x)).filter(x => !isNaN(x) && x > 0).length
      if (n > 1) top[k === 'spanX' ? 'bayX' : 'bayY'] = String(n)
    }
    return { ...s, top }
  })

  /* ── 팔레트 ── */
  const palKinds = [['cols', 'pal_cols', [600, 600]], ['beams', 'pal_beams', [600, 400]]] as const
  const palAdd = (kind: 'cols' | 'beams', d: readonly [number, number]) =>
    setSt(s => ({ ...s, [kind]: [...s[kind], { key: newKey(), H: String(d[0]), B: String(d[1]) }] }))
  const palDel = (kind: 'cols' | 'beams', key: number) =>
    setSt(s => s[kind].length <= 1 ? s : ({ ...s, [kind]: s[kind].filter(r => r.key !== key) }))   // 종류별 최소 1개
  const palSet = (kind: 'cols' | 'beams', key: number, f: 'H' | 'B', v: string) =>
    setSt(s => ({ ...s, [kind]: s[kind].map(r => r.key === key ? { ...r, [f]: v } : r) }))
  const palName = (kind: 'cols' | 'beams', r: PalRow) => kind === 'cols' ? `C${r.H}x${r.B}` : `B${r.B}x${r.H}`
  const toggleMat = (m: string, on: boolean) =>
    setSt(s => ({ ...s, mats: on ? [...s.mats, m] : s.mats.filter(x => x !== m) }))

  /* ── 표준층 표 ── */
  const setRow = (key: number, patch: Partial<FgRow>) =>
    setSt(s => ({ ...s, rows: s.rows.map(r => r.key === key ? { ...r, ...patch } : r) }))
  /* 행별 삽입: 'above'(↑ 더 높은 층) → 그 행 위, 'below'(↓ 더 낮은 층) → 그 행 아래.
     최상단 위 = ROOF, 최하단 아래 = BASEMENT, 그 외 TYPICAL. 단면/재료는 클릭한 행 상속. */
  const fgInsert = (key: number, dir: 'above' | 'below') => setSt(s => {
    const i = s.rows.findIndex(r => r.key === key); if (i < 0) return s
    const row = s.rows[i]
    let role = 'TYPICAL'
    if (dir === 'above' && i === 0) role = 'ROOF'
    else if (dir === 'below' && i === s.rows.length - 1) role = 'BASEMENT'
    const h = row.h && +row.h ? row.h : String(base.hTyp || 3200)
    const nr: FgRow = { key: newKey(), role, from: '1', to: '1', h, use: row.use || useOf(base), col: row.col, beam: row.beam, mat: row.mat }
    const rows = s.rows.slice()
    rows.splice(dir === 'above' ? i : i + 1, 0, nr)
    return { ...s, rows: renumber(rows) }
  })
  const fgDel = (key: number) => setSt(s => s.rows.length <= 1 ? s : ({ ...s, rows: renumber(s.rows.filter(r => r.key !== key)) }))

  const prof = profileOf(base)
  const chk = checkEditor(st, base)

  /* 섹션이 접혔을 때 보이는 한 줄 요약 */
  const onOff = (g: LateralState | undefined, name: string) => (g?.on ? name : '')
  const sumGeom = [st.top.buildings && `${st.top.buildings}`, st.top.bayX && st.top.bayY && `${st.top.bayX}×${st.top.bayY}`, st.top.spanX && `${st.top.spanX} mm`].filter(Boolean).join(' · ')
  const sumPal = [...st.cols.slice(0, 1).map(r => palName('cols', r)), ...st.beams.slice(0, 1).map(r => palName('beams', r)), st.mats[0]].filter(Boolean).join(' · ')
  const sumFloors = `${st.rows.length} ${t('role')} · ${t('slab_thk')} ${st.slabThk} mm`
  const sumLat = [onOff(st.seis, t(prof.seismic.toggleKey)), onOff(st.wind, t(prof.wind.toggleKey))].filter(Boolean).join(' · ') || t('pe_off')
  const sumWalls = [st.core.on && `${t('central_shear_wall_core_au')} ${st.core.nx}×${st.core.ny}`, st.bearing.on && t('bw_toggle')].filter(Boolean).join(' · ') || t('pe_off')

  return (
    <fieldset className={uiClass("[border:none]! [padding:0]! [margin:0]! [min-width:0]!")} disabled={disabled} >
      <div className={uiClass("plan-editor")}>
        <div dangerouslySetInnerHTML={{ __html: typeHeadHTML(base, '<div class="pe-head">') }} />
        <EditorSection num={1} title={t('pe_sec_geom')} summary={sumGeom} missing={chk.geom} defaultOpen>
        <div className={uiClass("pe-grid")}>
          {TOP_KEYS.map(k => (
            <div className={uiClass("pe-f")} key={k}>
              <label>{PE[k]}</label>
              <div className={uiClass("pe-in")}>
                <Input plain type={TOP_TEXT[k] ? 'text' : 'number'} value={st.top[k]} onChange={e => setTop(k, e.target.value)} />
                <Unit u={TOP_UNIT[k]} />
              </div>
            </div>
          ))}
        </div>
        </EditorSection>

        {/* ── 단면·재료 팔레트 ── */}
        <EditorSection num={2} title={t('pe_sec_sections')} summary={sumPal} missing={chk.sections}>
        <div className={uiClass("palette")} >
          {palKinds.map(([kind, lbl, d], ki) => (
            <div className={uiClass(cn("pal-sec", ki ? "[margin-top:8px]!" : ""))} key={kind} >
              <div className={uiClass("[font-size:.76rem]! [color:var(--muted)]! [margin-bottom:4px]!")} >
                {t(lbl)} <Button variant="native" size="plain" className={uiClass("btn btn-ghost [padding:0_7px]!")}  onClick={() => palAdd(kind, d)}>＋</Button>
              </div>
              <div className={uiClass("pal-rows")}>
                {st[kind].map(r => (
                  <div className={uiClass("pal-row [display:flex]! [align-items:center]! [gap:4px]! [margin-bottom:4px]!")} key={r.key} >
                    <Input plain className={uiClass("pal-h [width:54px]!")} type="number" value={r.H}  onChange={e => palSet(kind, r.key, 'H', e.target.value)} />
                    <span className={uiClass("[color:var(--dim)]!")} >×</span>
                    <Input plain className={uiClass("pal-b [width:54px]!")} type="number" value={r.B}  onChange={e => palSet(kind, r.key, 'B', e.target.value)} />
                    <span className={uiClass("pal-nm [font-size:.78rem]! [color:var(--cyan)]! [min-width:78px]!")} >{palName(kind, r)}</span>
                    <Button variant="native" size="plain" className={uiClass("btn btn-ghost [padding:1px_7px]!")}  title={t('delete')} onClick={() => palDel(kind, r.key)}>×</Button>
                  </div>
                ))}
              </div>
            </div>
          ))}
          <div className={uiClass("pal-sec [margin-top:8px]!")} >
            <div className={uiClass("[font-size:.76rem]! [color:var(--muted)]! [margin-bottom:4px]!")} >{t('pal_mats')}</div>
            <div className={uiClass("pal-rows pal-mats")}>
              {st.matCat.map(m => (
                <label className={uiClass("[display:inline-flex]! [align-items:center]! [gap:4px]! [margin:0_9px_4px_0]! [font-size:.8rem]! [cursor:pointer]!")} key={m} >
                  <Input plain type="checkbox" checked={st.mats.includes(m)} onChange={e => toggleMat(m, e.target.checked)} /> {m}
                </label>
              ))}
            </div>
          </div>
          <div className={uiClass("pe-tip [margin-top:6px]!")} >{t('pal_hint')}</div>
        </div>
        </EditorSection>

        {/* ── 표준층 표 (위=지붕 → 아래=지하) ── */}
        <EditorSection num={3} title={t('pe_sec_floors')} summary={sumFloors} missing={chk.floors}>
        <div>
          <div className={uiClass("[font-size:.7rem]! [color:var(--amber)]! [font-family:'IBM_Plex_Mono',var(--cjk)]! [letter-spacing:.5px]! [margin-bottom:6px]!")} >
            {t('floor_stack_top_roof_botto')}
          </div>
          <div className={uiClass("[overflow-x:auto]!")} >
            <table className={uiClass("fgtable [width:100%]! [min-width:560px]!")} >
              <thead><tr>
                <th>{t('role')}</th><th>{t('from')}</th><th>{t('to')}</th><th>{t('ht')}</th><th>{t('use')}</th>
                <th>{t('fg_col')}</th><th>{t('fg_beam')}</th><th>{t('fg_mat')}</th><th>{t('add_del')}</th>
              </tr></thead>
              <tbody>
                {st.rows.map(r => {
                  const sel = effectiveSel(pal, r)
                  return (
                    <tr className={uiClass("fg-row")} key={r.key}>
                      <td><NativeSelect plain value={r.role} onChange={e => setRow(r.key, { role: e.target.value })}>
                        {FG_ROLES.map(x => <option key={x} value={x}>{roleLbl(x)}</option>)}</NativeSelect></td>
                      <td><Input plain className={uiClass("[width:44px]!")} type="number" value={r.from}  onChange={e => setRow(r.key, { from: e.target.value })} /></td>
                      <td><Input plain className={uiClass("[width:44px]!")} type="number" value={r.to}  onChange={e => setRow(r.key, { to: e.target.value })} /></td>
                      <td><Input plain className={uiClass("[width:58px]!")} type="number" value={r.h}  onChange={e => setRow(r.key, { h: e.target.value })} /></td>
                      <td><NativeSelect plain value={r.use} onChange={e => setRow(r.key, { use: e.target.value })}>
                        {FG_USES.map(x => <option key={x} value={x}>{useLbl(x)}</option>)}</NativeSelect></td>
                      <td><NativeSelect plain value={sel.col} onChange={e => setRow(r.key, { col: e.target.value })}>
                        {pal.cols.map(c => <option key={c.name} value={c.name}>{c.name}</option>)}</NativeSelect></td>
                      <td><NativeSelect plain value={sel.beam} onChange={e => setRow(r.key, { beam: e.target.value })}>
                        {pal.beams.map(b => <option key={b.name} value={b.name}>{b.name}</option>)}</NativeSelect></td>
                      <td><NativeSelect plain value={sel.mat} onChange={e => setRow(r.key, { mat: e.target.value })}>
                        {pal.mats.map(m => <option key={m} value={m}>{m}</option>)}</NativeSelect></td>
                      <td className={uiClass("[white-space:nowrap]!")} >
                        <Button variant="native" size="plain" className={uiClass("btn btn-ghost [padding:2px_6px]!")}  title={t('insert_above_higher')} onClick={() => fgInsert(r.key, 'above')}>↑</Button>
                        <Button variant="native" size="plain" className={uiClass("btn btn-ghost [padding:2px_6px]!")}  title={t('insert_below_lower')} onClick={() => fgInsert(r.key, 'below')}>↓</Button>
                        <Button variant="native" size="plain" className={uiClass("btn btn-ghost [padding:2px_6px]!")}  title={t('delete')} onClick={() => fgDel(r.key)}>×</Button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          <div className={uiClass("pe-tip")}>{t('use_above_below_on_a_row_t')}</div>
          <div className={uiClass("[margin-top:10px]!")}>
            <SwitchRow checked={st.storyData} onChange={v => setSt(s => ({ ...s, storyData: v }))} label={t('auto_create_story_data_db_')} />
          </div>
          <div className={uiClass("pe-tip [opacity:0.75]!")} >{t('fills_the_story_data_table')}</div>
          <div className={uiClass("pe-f [margin-top:10px]!")} >
            <label>{t('diaphragm_method')}</label>
            <Segmented label={t('diaphragm_method')} value={st.diaMethod} onChange={v => setSt(s => ({ ...s, diaMethod: v as 'story' | 'rigd' }))}
              options={[{ value: 'story', label: t('story_floor_diaphragm_db_s') }, { value: 'rigd', label: t('rigid_link_db_rigd') }]} />
          </div>
          <div className={uiClass("pe-tip [opacity:0.75]!")} >{t('rigd_db_rigd_rigid_link_man')}</div>
          <div className={uiClass("pe-grid [margin-top:8px]!")} >
            <div className={uiClass("pe-f")}><label>{t('slab_thk')}</label><div className={uiClass("pe-in")}>
              <Input plain type="number" step="any" min={0} value={st.slabThk} onChange={e => setSt(s => ({ ...s, slabThk: e.target.value }))} /><Unit u="mm" /></div></div>
          </div>
          <div className={uiClass("pe-tip [opacity:0.75]!")} >{t('slab_tip')}</div>
        </div>
        </EditorSection>

        {/* ── M2-A1 지진 · M2-A2 풍하중 (설계기준 프로필) ── */}
        <EditorSection num={4} title={t('pe_sec_lateral')} summary={sumLat} missing={chk.lateral}>
        {prof.unverified && <div className={uiClass("pe-tip [margin-bottom:8px]! [color:var(--amber)]!")} >{t(`code_${prof.id}`)} — {t('code_unverified')}</div>}
        <LateralSection g={prof.seismic} icon="🌐" st={st.seis} set={v => setSt(s => ({ ...s, seis: v }))} first />
        <LateralSection g={prof.wind} icon="🌬" st={st.wind} set={v => setSt(s => ({ ...s, wind: v }))} />
        </EditorSection>

        {/* ── 내력벽(벽식) — 한국 기준 또는 이미 켜진 스펙 ── */}
        <EditorSection num={5} title={t('pe_sec_walls')} summary={sumWalls} missing={chk.walls}>
        {(prof.id === 'KR' || st.bearing.on) && <div>
          <SwitchRow checked={st.bearing.on} onChange={v => setSt(s => ({ ...s, bearing: { ...s.bearing, on: v } }))} label={<>🏢 {t('bw_toggle')}</>} />
          {st.bearing.on && <div className={uiClass("pe-grid [margin-top:10px]!")} >
            <div className={uiClass("pe-f")}><label>{t('wall_thick')}</label><div className={uiClass("pe-in")}>
              <Input plain type="number" step="any" value={st.bearing.thick} onChange={e => setSt(s => ({ ...s, bearing: { ...s.bearing, thick: e.target.value } }))} /><Unit u="mm" /></div></div>
          </div>}
          <div className={uiClass("pe-tip")}>{t('bw_tip')}</div>
        </div>}

        {/* ── M2-A3 전단벽 코어 (위치·크기·동별) ── */}
        <CoreSection base={base} st={st} setSt={setSt} first={!(prof.id === 'KR' || st.bearing.on)} />
        </EditorSection>

        <div className={uiClass("pe-tip")}>{t('edit_role_range_height_use')}</div>
        <div className={uiClass("pe-tip [margin-top:4px]!")} >{t('spanHint')}</div>
      </div>
    </fieldset>
  )
}
