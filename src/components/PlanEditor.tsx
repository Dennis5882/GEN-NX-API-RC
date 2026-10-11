/* 편집 가능 규격 카드 — 상단 그리드 · 단면/재료 팔레트 · 표준층 표 · 내진 · 풍 · 코어.
   상태(EditorState)가 바뀔 때마다 onChange(spec) — 부모가 미리보기 갱신(디바운스). */
import { RC, type BuildingSpec } from '../engine'
import {
  effectiveSel, newKey, paletteOf, renumber, SEIS_KEYS, TOP_KEYS,
  type EditorState, type FgRow, type PalRow, type TopKey,
} from '../agent/editor'
import { typeHeadHTML } from '../agent/plan'
import { roleLbl, t, tv, useLbl } from '../i18n'

interface Props {
  base: BuildingSpec
  st: EditorState
  setSt(fn: (s: EditorState) => EditorState): void
  disabled?: boolean
}

const TOP_UNIT: Partial<Record<TopKey, string>> = { spanX: 'mm', spanY: 'mm', gap: 'mm' }
const TOP_TEXT: Partial<Record<TopKey, boolean>> = { spanX: true, spanY: true }

function Unit({ u }: { u?: string }) { return u ? <span className="pe-u">{u}</span> : null }

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

  const seisPreset = (idx: string) => {
    const z = RC.SEISMIC_ZONES[+idx]; if (idx === '' || !z) return
    setSt(s => ({ ...s, seis: { ...s.seis, SDS: String(z.SDS ?? ''), SD1: String(z.SD1 ?? ''), T0: z.T0 != null ? String(z.T0) : '' } }))
  }

  const seisLabels: Record<(typeof SEIS_KEYS)[number], [string, string?]> = {
    SDS: ['SDS (Sas)'], SD1: ['SD1 (Sa1)'], T0: [t('t0_basin'), 's'], I: ['I ' + t('use_2')], R: ['R ' + t('sys')],
    w0: [t('dead_w0'), 'kN/㎡'], liveRatio: [t('live')], Cs: ['Cs ' + t('ovr')], V: [t('v_direct'), 'kN'],
  }

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
          <div style={{ fontSize: '.7rem', color: 'var(--amber)', fontFamily: "'IBM Plex Mono','Noto Sans KR','Noto Sans TC'", letterSpacing: '.5px', marginBottom: 6 }}>
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
        </div>

        {/* ── M2-A1 내진 等效靜力 ── */}
        <div style={{ marginTop: 14, borderTop: '1px dashed var(--border)', paddingTop: 12 }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: '.82rem', color: 'var(--cyan)', fontWeight: 600 }}>
            <input type="checkbox" checked={st.seis.on} onChange={e => setSt(s => ({ ...s, seis: { ...s.seis, on: e.target.checked } }))} /> 🌐 {t('apply_equivalent_static_se')}
          </label>
          <div className="pe-grid" style={{ marginTop: 10 }}>
            <div className="pe-f pe-full"><label>{t('site_preset')}</label><div className="pe-in">
              <select defaultValue="" onChange={e => seisPreset(e.target.value)}>
                <option value="">{t('manual')}</option>
                {RC.SEISMIC_ZONES.map((z, i) => <option key={i} value={i}>{z.city} {z.dist} · SDS {z.SDS}</option>)}
              </select></div></div>
            {SEIS_KEYS.map(k => (
              <div className="pe-f" key={k}><label>{seisLabels[k][0]}</label><div className="pe-in">
                <input type="number" step="any" value={st.seis[k]} onChange={e => setSt(s => ({ ...s, seis: { ...s.seis, [k]: e.target.value } }))} />
                <Unit u={seisLabels[k][1]} /></div></div>
            ))}
          </div>
          <div className="pe-tip">
            <a href="https://seaport.ncree.org/sederes/" target="_blank" rel="noopener" style={{ color: 'var(--cyan)', fontWeight: 600 }}>↗ Sederes</a> {t('look_up_site_sds_sd1_or_t0')}
          </div>
        </div>

        {/* ── M2-A2 풍하중 ── */}
        <div style={{ marginTop: 12, borderTop: '1px dashed var(--border)', paddingTop: 12 }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: '.82rem', color: 'var(--cyan)', fontWeight: 600 }}>
            <input type="checkbox" checked={st.wind.on} onChange={e => setSt(s => ({ ...s, wind: { ...s.wind, on: e.target.checked } }))} /> 🌬 {t('apply_wind_simplified_stat')}
          </label>
          <div className="pe-grid" style={{ marginTop: 10 }}>
            <div className="pe-f"><label>{t('wind_v10')}</label><div className="pe-in">
              <input type="number" step="any" value={st.wind.V10} onChange={e => setSt(s => ({ ...s, wind: { ...s.wind, V10: e.target.value } }))} /><Unit u="m/s" /></div></div>
            <div className="pe-f"><label>{t('exposure')}</label><div className="pe-in">
              <select value={st.wind.exposure} onChange={e => setSt(s => ({ ...s, wind: { ...s.wind, exposure: e.target.value } }))}>
                {['A', 'B', 'C'].map(x => <option key={x} value={x}>{x} {t('expo', x)}</option>)}
              </select></div></div>
            <div className="pe-f"><label>{t('gust_g')}</label><div className="pe-in">
              <input type="number" step="any" value={st.wind.G} onChange={e => setSt(s => ({ ...s, wind: { ...s.wind, G: e.target.value } }))} /></div></div>
            <div className="pe-f"><label>{t('force_cf')}</label><div className="pe-in">
              <input type="number" step="any" value={st.wind.Cf} onChange={e => setSt(s => ({ ...s, wind: { ...s.wind, Cf: e.target.value } }))} /></div></div>
          </div>
          <div className="pe-tip">{t('simplified_qz_0_613_vz_wx_')}</div>
        </div>

        {/* ── M2-A3 전단벽 중앙코어 ── */}
        <div style={{ marginTop: 12, borderTop: '1px dashed var(--border)', paddingTop: 12 }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: '.82rem', color: 'var(--cyan)', fontWeight: 600 }}>
            <input type="checkbox" checked={st.core.on} onChange={e => setSt(s => ({ ...s, core: { ...s.core, on: e.target.checked } }))} /> 🧱 {t('central_shear_wall_core_au')}
          </label>
          <div className="pe-grid" style={{ marginTop: 10 }}>
            <div className="pe-f"><label>{t('wall_thick')}</label><div className="pe-in">
              <input type="number" step="any" value={st.core.thick} onChange={e => setSt(s => ({ ...s, core: { ...s.core, thick: e.target.value } }))} /><Unit u="mm" /></div></div>
          </div>
          <div className="pe-tip">{t('places_4_sided_plate_shear')}</div>
        </div>

        <div className="pe-tip">{t('edit_role_range_height_use')}</div>
        <div className="pe-tip" style={{ marginTop: 4 }}>{t('spanHint')}</div>
      </div>
    </fieldset>
  )
}
