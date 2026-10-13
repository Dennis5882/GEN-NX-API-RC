/* 편집 가능 규격 카드 — 상단 그리드 · 단면/재료 팔레트 · 표준층 표 · 내진 · 풍 · 코어.
   상태(EditorState)가 바뀔 때마다 onChange(spec) — 부모가 미리보기 갱신(디바운스). */
import { profileOf, type LateralGroup } from '../codes'
import { RC, type BuildingSpec } from '../engine'
import {
  applyTop, coreInput, effectiveSel, newKey, paletteOf, renumber, TOP_KEYS,
  type CoreState, type EditorState, type FgRow, type LateralState, type PalRow, type TopKey,
} from '../agent/editor'
import { typeHeadHTML } from '../agent/plan'
import { roleLbl, t, tv, useLbl } from '../i18n'
import { useState } from 'react'

interface Props {
  base: BuildingSpec
  st: EditorState
  setSt(fn: (s: EditorState) => EditorState): void
  disabled?: boolean
}

const TOP_UNIT: Partial<Record<TopKey, string>> = { spanX: 'mm', spanY: 'mm', gap: 'mm' }
const TOP_TEXT: Partial<Record<TopKey, boolean>> = { spanX: true, spanY: true }

function Unit({ u }: { u?: string }) { return u ? <span className="pe-u">{u}</span> : null }

const TOWER = ['A', 'B', 'C', 'D']
const SIZES: [number, number][] = [[1, 1], [2, 1], [1, 2], [2, 2]]

/** 전단벽 코어 — 켜기·두께 + 미니 평면 격자(칸 클릭·화살표 이동)·크기 + 2동 이상 적용 동·배치(같은 위치/좌우 대칭/동별) */
function CoreSection({ base, st, setSt }: Pick<Props, 'base' | 'st' | 'setSt'>) {
  const c = st.core
  const [ed, setEd] = useState(0)
  const set = (fn: (c: CoreState) => CoreState) => setSt(s => ({ ...s, core: fn(s.core) }))
  const geo = applyTop({ ...base }, st)
  const L = RC.coreLayout(geo, coreInput(c))
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
  const btn = { padding: '2px 8px', minWidth: 28 } as const
  const cell = Math.max(14, Math.min(26, Math.floor(220 / Math.max(L.nbx, L.nby))))
  return (
    <div style={{ marginTop: 12, borderTop: '1px dashed var(--border)', paddingTop: 12 }}>
      <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: '.82rem', color: 'var(--cyan)', fontWeight: 600 }}>
        <input type="checkbox" checked={c.on} onChange={e => set(k => ({ ...k, on: e.target.checked }))} /> 🧱 {t('central_shear_wall_core_au')}
      </label>
      <div className="pe-grid" style={{ marginTop: 10 }}>
        <div className="pe-f"><label>{t('wall_thick')}</label><div className="pe-in">
          <input type="number" step="any" value={c.thick} onChange={e => set(k => ({ ...k, thick: e.target.value }))} /><Unit u="mm" /></div></div>
        {c.on && <div className="pe-f"><label>{t('core_size')}</label><div className="pe-in">
          <select value={`${L.nx}x${L.ny}`} onChange={e => { const [nx, ny] = e.target.value.split('x').map(Number); set(k => ({ ...k, nx, ny })) }}>
            {SIZES.filter(([x, y]) => x <= L.nbx && y <= L.nby).map(([x, y]) => <option key={`${x}x${y}`} value={`${x}x${y}`}>{x}×{y}</option>)}
          </select></div></div>}
        {c.on && nb > 1 && <div className="pe-f"><label>{t('core_layout')}</label><div className="pe-in">
          <select value={c.layout} onChange={e => set(k => ({ ...k, layout: e.target.value as CoreState['layout'] }))}>
            {(['same', 'mirror', 'each'] as const).map(v => <option key={v} value={v}>{t(`core_layout_${v}`)}</option>)}
          </select></div></div>}
        {c.on && nb > 1 && <div className="pe-f"><label>{t('core_towers')}</label><div className="pe-in" style={{ gap: 10 }}>
          {L.towers.map(tw => <label key={tw.building} style={{ display: 'inline-flex', alignItems: 'center', gap: 3, cursor: 'pointer' }}>
            <input type="checkbox" checked={tw.on} onChange={e => set(k => ({ ...k, skip: e.target.checked ? k.skip.filter(b => b !== tw.building) : [...k.skip, tw.building] }))} />{TOWER[tw.building]}
          </label>)}
        </div></div>}
      </div>
      {c.on && <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start', flexWrap: 'wrap', marginTop: 10 }}>
        <div>
          <div style={{ fontSize: '.74rem', color: 'var(--txt-2)', marginBottom: 4 }}>
            {t('core_pos')}{nb > 1 ? ` · ${TOWER[edit]}` : ''} ({cur.ix + 1}, {cur.iy + 1})
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: `repeat(${L.nbx}, ${cell}px)`, gap: 2 }} role="grid">
            {Array.from({ length: L.nby }, (_, r) => L.nby - 1 - r).flatMap(iy => Array.from({ length: L.nbx }, (_, ix) => {
              const inCore = cur.on && ix >= cur.ix && ix < cur.ix + L.nx && iy >= cur.iy && iy < cur.iy + L.ny
              return <button key={`${ix}_${iy}`} type="button" title={`X${ix + 1}–X${ix + 2} · Y${iy + 1}–Y${iy + 2}`}
                onClick={() => place(ix, iy)}
                style={{ width: cell, height: cell, padding: 0, border: '1px solid var(--border)', borderRadius: 2, cursor: 'pointer',
                  background: inCore ? 'var(--cyan)' : 'transparent', opacity: inCore ? 0.85 : 1 }} />
            }))}
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, auto)', gap: 3, alignSelf: 'center' }}>
          <span /><button type="button" style={btn} onClick={() => place(cur.ix, cur.iy + 1)}>▲</button><span />
          <button type="button" style={btn} onClick={() => place(cur.ix - 1, cur.iy)}>◀</button>
          <button type="button" style={{ ...btn, fontSize: '.7rem' }} onClick={centerAll}>{t('core_center')}</button>
          <button type="button" style={btn} onClick={() => place(cur.ix + 1, cur.iy)}>▶</button>
          <span /><button type="button" style={btn} onClick={() => place(cur.ix, cur.iy - 1)}>▼</button><span />
        </div>
        {c.layout === 'each' && nb > 1 && <div style={{ alignSelf: 'center' }}>
          <div style={{ fontSize: '.74rem', color: 'var(--txt-2)', marginBottom: 4 }}>{t('core_edit')}</div>
          <div style={{ display: 'flex', gap: 4 }}>{L.towers.map(tw => <button key={tw.building} type="button" style={{ ...btn, fontWeight: edit === tw.building ? 700 : 400,
            borderColor: edit === tw.building ? 'var(--cyan)' : undefined }} onClick={() => setEd(tw.building)}>{TOWER[tw.building]}</button>)}</div>
        </div>}
      </div>}
      {c.on && <div className="pe-tip">{t('core_grid_tip')}{c.layout === 'mirror' && nb > 1 ? ` · ${t('core_mirror_tip')}` : ''}</div>}
      <div className="pe-tip">{t('places_4_sided_plate_shear')}</div>
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
    <div style={{ marginTop: first ? 14 : 12, borderTop: '1px dashed var(--border)', paddingTop: 12 }}>
      <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: '.82rem', color: 'var(--cyan)', fontWeight: 600 }}>
        <input type="checkbox" checked={st.on} onChange={e => set({ ...st, on: e.target.checked })} /> {icon} {t(g.toggleKey)}
      </label>
      <div className="pe-grid" style={{ marginTop: 10 }}>
        {presets && g.presets && (
          <div className="pe-f pe-full"><label>{t(g.presets.labelKey)}</label><div className="pe-in">
            <select defaultValue="" onChange={e => applyPreset(e.target.value)}>
              <option value="">{t('manual')}</option>
              {presets.map((z, i) => <option key={i} value={i}>{z.label}</option>)}
            </select></div></div>
        )}
        {g.fields.map(f => (
          <div className="pe-f" key={f.key}><label>{f.label()}</label><div className="pe-in">
            {f.kind === 'select'
              ? <select value={st.vals[f.key] ?? ''} onChange={e => setVal(f.key, e.target.value)}>
                  {f.options!().map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              : <input type="number" step="any" value={st.vals[f.key] ?? ''} onChange={e => setVal(f.key, e.target.value)} />}
            <Unit u={f.unit} /></div></div>
        ))}
      </div>
      <div className="pe-tip" dangerouslySetInnerHTML={{ __html: g.tipHtml() }} />
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
    const nr: FgRow = { key: newKey(), role, from: '1', to: '1', h, use: row.use || RC.useOf(base), col: row.col, beam: row.beam, mat: row.mat }
    const rows = s.rows.slice()
    rows.splice(dir === 'above' ? i : i + 1, 0, nr)
    return { ...s, rows: renumber(rows) }
  })
  const fgDel = (key: number) => setSt(s => s.rows.length <= 1 ? s : ({ ...s, rows: renumber(s.rows.filter(r => r.key !== key)) }))

  const prof = profileOf(base)

  return (
    <fieldset disabled={disabled} style={{ border: 'none', padding: 0, margin: 0, minWidth: 0 }}>
      <div className="plan-editor">
        <div dangerouslySetInnerHTML={{ __html: typeHeadHTML(base, '<div class="pe-head">') }} />
        <div className="pe-grid">
          {TOP_KEYS.map(k => (
            <div className="pe-f" key={k}>
              <label>{PE[k]}</label>
              <div className="pe-in">
                <input type={TOP_TEXT[k] ? 'text' : 'number'} value={st.top[k]} onChange={e => setTop(k, e.target.value)} />
                <Unit u={TOP_UNIT[k]} />
              </div>
            </div>
          ))}
        </div>

        {/* ── 단면·재료 팔레트 ── */}
        <div className="palette" style={{ marginTop: 14, borderTop: '1px dashed var(--border)', paddingTop: 12 }}>
          <div style={{ fontSize: '.82rem', color: 'var(--cyan)', fontWeight: 600, marginBottom: 8 }}>◫ {t('pal_title')}</div>
          {palKinds.map(([kind, lbl, d], ki) => (
            <div className="pal-sec" key={kind} style={ki ? { marginTop: 8 } : undefined}>
              <div style={{ fontSize: '.76rem', color: 'var(--muted)', marginBottom: 4 }}>
                {t(lbl)} <button className="btn btn-ghost" style={{ padding: '0 7px' }} onClick={() => palAdd(kind, d)}>＋</button>
              </div>
              <div className="pal-rows">
                {st[kind].map(r => (
                  <div className="pal-row" key={r.key} style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 4 }}>
                    <input className="pal-h" type="number" value={r.H} style={{ width: 54 }} onChange={e => palSet(kind, r.key, 'H', e.target.value)} />
                    <span style={{ color: 'var(--dim)' }}>×</span>
                    <input className="pal-b" type="number" value={r.B} style={{ width: 54 }} onChange={e => palSet(kind, r.key, 'B', e.target.value)} />
                    <span className="pal-nm" style={{ fontSize: '.78rem', color: 'var(--cyan)', minWidth: 78 }}>{palName(kind, r)}</span>
                    <button className="btn btn-ghost" style={{ padding: '1px 7px' }} title={t('delete')} onClick={() => palDel(kind, r.key)}>×</button>
                  </div>
                ))}
              </div>
            </div>
          ))}
          <div className="pal-sec" style={{ marginTop: 8 }}>
            <div style={{ fontSize: '.76rem', color: 'var(--muted)', marginBottom: 4 }}>{t('pal_mats')}</div>
            <div className="pal-rows pal-mats">
              {st.matCat.map(m => (
                <label key={m} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, margin: '0 9px 4px 0', fontSize: '.8rem', cursor: 'pointer' }}>
                  <input type="checkbox" checked={st.mats.includes(m)} onChange={e => toggleMat(m, e.target.checked)} /> {m}
                </label>
              ))}
            </div>
          </div>
          <div className="pe-tip" style={{ marginTop: 6 }}>{t('pal_hint')}</div>
        </div>

        {/* ── 표준층 표 (위=지붕 → 아래=지하) ── */}
        <div style={{ marginTop: 14 }}>
          <div style={{ fontSize: '.7rem', color: 'var(--amber)', fontFamily: "'IBM Plex Mono',var(--cjk)", letterSpacing: '.5px', marginBottom: 6 }}>
            {t('floor_stack_top_roof_botto')}
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table className="fgtable" style={{ width: '100%', minWidth: 560 }}>
              <thead><tr>
                <th>{t('role')}</th><th>{t('from')}</th><th>{t('to')}</th><th>{t('ht')}</th><th>{t('use')}</th>
                <th>{t('fg_col')}</th><th>{t('fg_beam')}</th><th>{t('fg_mat')}</th><th>{t('add_del')}</th>
              </tr></thead>
              <tbody>
                {st.rows.map(r => {
                  const sel = effectiveSel(pal, r)
                  return (
                    <tr className="fg-row" key={r.key}>
                      <td><select value={r.role} onChange={e => setRow(r.key, { role: e.target.value })}>
                        {RC.FG_ROLES.map(x => <option key={x} value={x}>{roleLbl(x)}</option>)}</select></td>
                      <td><input type="number" value={r.from} style={{ width: 44 }} onChange={e => setRow(r.key, { from: e.target.value })} /></td>
                      <td><input type="number" value={r.to} style={{ width: 44 }} onChange={e => setRow(r.key, { to: e.target.value })} /></td>
                      <td><input type="number" value={r.h} style={{ width: 58 }} onChange={e => setRow(r.key, { h: e.target.value })} /></td>
                      <td><select value={r.use} onChange={e => setRow(r.key, { use: e.target.value })}>
                        {RC.FG_USES.map(x => <option key={x} value={x}>{useLbl(x)}</option>)}</select></td>
                      <td><select value={sel.col} onChange={e => setRow(r.key, { col: e.target.value })}>
                        {pal.cols.map(c => <option key={c.name} value={c.name}>{c.name}</option>)}</select></td>
                      <td><select value={sel.beam} onChange={e => setRow(r.key, { beam: e.target.value })}>
                        {pal.beams.map(b => <option key={b.name} value={b.name}>{b.name}</option>)}</select></td>
                      <td><select value={sel.mat} onChange={e => setRow(r.key, { mat: e.target.value })}>
                        {pal.mats.map(m => <option key={m} value={m}>{m}</option>)}</select></td>
                      <td style={{ whiteSpace: 'nowrap' }}>
                        <button className="btn btn-ghost" style={{ padding: '2px 6px' }} title={t('insert_above_higher')} onClick={() => fgInsert(r.key, 'above')}>↑</button>
                        <button className="btn btn-ghost" style={{ padding: '2px 6px' }} title={t('insert_below_lower')} onClick={() => fgInsert(r.key, 'below')}>↓</button>
                        <button className="btn btn-ghost" style={{ padding: '2px 6px' }} title={t('delete')} onClick={() => fgDel(r.key)}>×</button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          <div className="pe-tip">{t('use_above_below_on_a_row_t')}</div>
          <label style={{ display: 'flex', alignItems: 'center', gap: 7, marginTop: 8, fontSize: '.82rem', cursor: 'pointer' }}>
            <input type="checkbox" checked={st.storyData} onChange={e => setSt(s => ({ ...s, storyData: e.target.checked }))} />
            <span>{t('auto_create_story_data_db_')}</span>
          </label>
          <div className="pe-tip" style={{ opacity: 0.75 }}>{t('fills_the_story_data_table')}</div>
          <div className="pe-f" style={{ marginTop: 8, alignItems: 'center', gap: 8, display: 'flex' }}>
            <label style={{ fontSize: '.82rem', whiteSpace: 'nowrap' }}>{t('diaphragm_method')}</label>
            <select value={st.diaMethod} style={{ flex: 1, fontSize: '.82rem' }}
              onChange={e => setSt(s => ({ ...s, diaMethod: e.target.value as 'story' | 'rigd' }))}>
              <option value="story">{t('story_floor_diaphragm_db_s')}</option>
              <option value="rigd">{t('rigid_link_db_rigd')}</option>
            </select>
          </div>
          <div className="pe-tip" style={{ opacity: 0.75 }}>{t('rigd_db_rigd_rigid_link_man')}</div>
          <div className="pe-grid" style={{ marginTop: 8 }}>
            <div className="pe-f"><label>{t('slab_thk')}</label><div className="pe-in">
              <input type="number" step="any" min={0} value={st.slabThk} onChange={e => setSt(s => ({ ...s, slabThk: e.target.value }))} /><Unit u="mm" /></div></div>
          </div>
          <div className="pe-tip" style={{ opacity: 0.75 }}>{t('slab_tip')}</div>
        </div>

        {/* ── M2-A1 지진 · M2-A2 풍하중 (설계기준 프로필) ── */}
        {prof.unverified && <div className="pe-tip" style={{ marginTop: 12, color: 'var(--amber)' }}>{t(`code_${prof.id}`)} — {t('code_unverified')}</div>}
        <LateralSection g={prof.seismic} icon="🌐" st={st.seis} set={v => setSt(s => ({ ...s, seis: v }))} first />
        <LateralSection g={prof.wind} icon="🌬" st={st.wind} set={v => setSt(s => ({ ...s, wind: v }))} />

        {/* ── M2-A3 전단벽 코어 (위치·크기·동별) ── */}
        <CoreSection base={base} st={st} setSt={setSt} />

        <div className="pe-tip">{t('edit_role_range_height_use')}</div>
        <div className="pe-tip" style={{ marginTop: 4 }}>{t('spanHint')}</div>
      </div>
    </fieldset>
  )
}
