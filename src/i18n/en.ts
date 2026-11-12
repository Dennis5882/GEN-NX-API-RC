// en UI messages and activity logs. Keep keys and function arity aligned with en.ts.
export const messages = {
  /* Phase1 errors+maps */ err_sseis_nostory:
    'No stories registered. SSEIS references Gen Story Manager stories — define them in the GUI Story tab (or Auto Generate) first (live-confirmed 0616).',
  err_level_mismatch:
    'Computed story levels do not match registered story levels (check units/elevations).',
  err_sseis_names:
    'SSEIS did not recognize some story names — must be seismic-load stories (above G.L.) matching registered names.',
  err_swind_nostory:
    'No stories registered. SWIND references Gen Story Manager stories — use a GUI Story-tab / Auto Generate model.',
  err_swind_names:
    'SWIND did not recognize stories — needs Gen Story Manager stories (GUI Auto Generate).',
  err_weight_nostory:
    'No stories registered — story weights come from Gen Story Manager stories (need GUI Story tab / Auto Generate).',
  err_sseis_names2:
    'SSEIS did not recognize stories — needs registered seismic-load stories (above G.L.).',
  err_weight_mismatch:
    'No story weights matched — registered story levels must match self elevations.',
  roles: {
    TYPICAL: 'Typical',
    PODIUM: 'Podium',
    TRANSFER: 'Transfer',
    ROOF: 'Roof',
    BASEMENT: 'Basement',
  },
  uses: {
    Residential: 'Residential',
    Office: 'Office',
    Commercial: 'Commercial',
    School: 'School',
    Hospital: 'Hospital',
    Equipment: 'Equipment',
    Roof: 'Roof',
  },
  /* Phase1 complex */ massSrc: (liveF: unknown) =>
    `Mass: self-weight + (DL×1.0, live×${liveF})`,
  dynTitle: (ds: unknown) =>
    `🌀 Dynamic analysis (eigenvalue${ds ? ' + response spectrum' : ''})`,
  dynNote: (liveF: unknown) =>
    `Mass=self-wt+(DL+live×${liveF}). Lanczos eigen. RS=CQC, all modes; spectrum and scaling follow the design-code profile (TW seismic table 2-5(a)·3.2·3.3, CN GB 50011, KR KDS 41 17 00 7.3.3.5).`,
  expo: (e: unknown) => (e === 'A' ? 'urban' : e === 'B' ? 'suburb' : 'open'),
  spanHint:
    'Enter spans like <b>3000,4000,3000</b> for variable bays (bay count auto-syncs).',
  hdr_shear: ['Story', 'STORY_SHEAR self/Gen', 'OTM', 'Acc.Torsion'],
  hdr_shear_otm: ['Story', 'STORY_SHEAR self/Gen', 'OTM self/Gen'],
  hdr_weight: ['Story', 'self W(kN)', 'Gen W(kN)', 'Δ'],
  /* Phase1: inline->key */ iso_view: 'ISO view',
  eigenvalue_setup: 'Eigenvalue setup',
  no_sds_sd1_rs_skipped: 'no SDS/SD1 — RS skipped',
  response_spectrum_tw_rsx_r: 'Response spectrum (TW) RSX·RSY',
  analysis_refused: 'analysis refused: ',
  eigen_uses_lanczos_subspac:
    ' (eigen uses Lanczos — Subspace invalid with off-diagonal mass)',
  period_retrieval_failed: 'period retrieval failed: ',
  '1st_mode_period': '1st mode period',
  modes: 'modes',
  analysis_was_refused_setup:
    '⚠ Analysis was refused — setup (mass·eigen·RS) created OK. Eigen uses Lanczos.',
  analysis_ran_but_the_eigen:
    '✓ Analysis ran, but the EIGENVALUEMODE period table was not retrieved — no eigen results yet or model not analyzed (retry after analysis).',
  seismic_cs_update_empirica: 'Seismic Cs update (empirical Ta → modal T₁)',
  design_spectrum: 'Design spectrum',
  floor_make_up: 'Floor make-up',
  edit_role_range_height_use:
    'Edit role/range/height/use/diaphragm in the table → stories & heights follow the table.',
  floor_stack_top_roof_botto: 'Floor stack (top = roof → bottom = basement)',
  role: 'Role',
  from: 'From',
  to: 'To',
  ht: 'Ht',
  use: 'Use',
  add_del: 'Add/Del',
  pal_title: 'Section & material palette',
  pe_sec_geom: 'Building geometry',
  pe_sec_sections: 'Sections & materials',
  pe_sec_floors: 'Floor layout',
  pe_sec_lateral: 'Seismic & wind',
  pe_sec_walls: 'Walls & core',
  pe_on: 'On',
  pe_off: 'Off',
  pe_req_ok: 'All required items are filled in',
  pe_req_missing: 'Check required items',
  pal_cols: 'Column sections (H×B)',
  pal_beams: 'Beam sections (depth×width)',
  pal_mats: 'Materials',
  pal_hint:
    'Define sections, then assign each to a zone (basement / typical / roof…) in the table below. The first entry is the default (primary) section.',
  fg_col: 'Col',
  fg_beam: 'Beam',
  fg_mat: 'Mat',
  section_zones: 'Sections by zone',
  use_above_below_on_a_row_t:
    'Use ↑ (above) / ↓ (below) on a row to insert a floor there, × to delete. Numbers auto-renumber.',
  auto_create_story_data_db_:
    'Auto-create Story data (db/STOR — G.L. 1F + floors)',
  fills_the_story_data_table:
    'Fills the Story Data table from typical-floor elevations (rigid diaphragm is handled by db/rigd — Story flag is false to avoid duplicate DOF). Note: Story Manager (Module) registration is a separate GUI step — SSEIS/weight checks need that.',
  manual: 'Manual',
  apply_equivalent_static_se: 'Apply equivalent-static seismic (TWD)',
  site_preset: 'Site preset',
  t0_basin: 'T0 (basin)',
  use_2: 'use',
  sys: 'sys',
  dead_w0: 'dead w0',
  live: 'live%',
  ovr: '(ovr)',
  v_direct: 'V direct',
  look_up_site_sds_sd1_or_t0:
    '— look up site SDS/SD1 (or T0). Basin: enter T0 → SD1 auto.',
  apply_wind_simplified_stat: 'Apply wind (simplified static)',
  wind_v10: 'Wind V10',
  exposure: 'Exposure',
  gust_g: 'Gust G',
  force_cf: 'Force Cf',
  simplified_qz_0_613_vz_wx_:
    'Simplified (qz=0.613·Vz²). WX·WY auto → cLCB4/6. Tune per code.',
  central_shear_wall_core_au: 'Shear-wall core',
  wall_thick: 'Wall thick',
  places_4_sided_plate_shear:
    'Places 4-sided shear walls (Gen WALL elements) in the selected bay over full height (default = plan center) → higher lateral stiffness. Grid-aligned, reuses existing nodes.',
  seismic: 'Seismic',
  wind: 'Wind',
  shear_wall_core: 'Shear-wall core',
  panels_plate: 'panels (PLATE)',
  insert_above_higher: 'Insert above (higher)',
  insert_below_lower: 'Insert below (lower)',
  delete: 'Delete',
  the_shared_engine_shared_r:
    'The shared engine (shared/rc_engine.js) failed to load. Ensure shared/rc_engine.js sits next to this HTML, and hard-refresh (Ctrl+Shift+R). Opening the HTML alone will not work.',
  material: 'Material',
  floor_loads: 'Floor loads',
  load_combos_twd_usd112: 'Load combos (TWD-USD112)',
  rigid_diaphragm: 'Rigid diaphragm',
  diaphragm_method: 'Diaphragm method',
  rigid_link_db_rigd: 'Rigid link (db/rigd)',
  story_floor_diaphragm_db_s: 'Story floor diaphragm (db/STOR)',
  rigd_db_rigd_rigid_link_man:
    'Rigid link (db/rigd): node-DOF-based, the default. Story diaphragm (db/STOR): sets bFLOOR_DIAPHRAGM in Story Data. Cannot use both — duplicate DOF error.',
  story_data_skipped: 'Story data skipped: ',
  seismic_static: 'Seismic (static)',
  story_data_db_stor: 'Story data (db/STOR)',
  g_l_1f_floors_diaphragm_vi: '(G.L. 1F + floors; diaphragm via rigd)',
  story_register_accidental_: 'Story register + accidental eccen. (ope/STOR)',
  need_a_model_with_seismic_: 'Need a model with seismic load on (EX/EY).',
  forces_registered_stories: 'forces (registered stories)',
  no_profile_rows_matched_ch: 'no PROFILE rows matched (check response shape)',
  sseis_cross_check_x_dir: '🔬 SSEIS cross-check (X-dir)',
  worst_shear_err: 'worst shear err',
  need_a_model_with_wind_loa: 'Need a model with wind load on (WX/WY).',
  pressure_conversion_failed:
    'Pressure conversion failed — check STOR floor widths / levels.',
  stories_pressure_from_forc: 'stories (pressure from forces)',
  no_profile_rows_matched: 'no PROFILE rows matched',
  swind_cross_check_x_dir_wi: '🌬 SWIND cross-check (X-dir, wind)',
  no_stories_above_g_l: 'No stories above G.L.',
  story_weight_check_self_es:
    '⚖ Story weight check (self estimate vs Gen model — informational)',
  shear_wall: 'Shear wall',
  support: 'Support',
  app_title: 'RC Structure Agent',
  subtitle: 'MIDAS Gen NX · Automation tool',
  dev: 'Developer',
  updated: 'Updated',
  conn_unlinked: 'Not connected',
  conn_linked: 'Gen NX connected',
  conn_failed: 'Connection failed',
  split_tip: 'Drag to resize · double-click to reset',
  guide_title: '⌘ Menu',
  guide_close: 'Collapse menu',
  guide_open: 'Expand menu',
  guide_open_txt: 'Menu',
  mode: 'MODE',
  mode_local: 'LOCAL · rule-based',
  mode_nokey: 'no key→LOCAL',
  brain: ' brain',
  input_ph: 'Type a command…  e.g. build a 15-story residential',
  tab_log: '⬡ Activity',
  tab_model: '▣ Model Summary',
  tab_3d: '◈ 3D Preview',
  tab_res: '∑ Results',
  log_empty: '',
  model_empty: '',
  view_empty: '',
  res_empty: '',
  clearchat: '🧹 Clear chat',
  clearchat_tip: 'Clear the chat (model & results kept)',
  clear_done: '🧹 Chat cleared. The model and analysis results are kept.',
  cam: 'View',
  cam_iso: 'ISO',
  cam_front: 'Front',
  cam_side: 'Side',
  cam_top: 'Top',
  show: 'Show',
  show_col: 'Columns',
  show_beam: 'Beams',
  show_node: 'Nodes',
  show_floor: 'Floor lines',
  set_title: 'Connection Settings',
  mapi_hint_html:
    'Gen NX must be running and its API status must be <b class="[color:var(--cyan)]!">Connect</b>.',
  mapi_key_ph: 'Copy from Gen NX → API Settings',
  conn_test: 'Test connection',
  ai_section: 'AI mode (optional)',
  model_custom: 'Custom…',
  llm_mode: 'Use LLM',
  model_hint: 'Model name is editable (providers update models often).',
  save: 'Save',
  close: 'Close',
  exec: 'Run ▶',
  cancel: 'Cancel',
  edit_btn: '✎ Edit',
  test_need: 'Enter both Base URL and MAPI Key.',
  test_ing: 'Testing connection…',
  test_ok: (_prog: unknown, _user: unknown) => `✅ Gen NX connected`,
  test_keyfail:
    "❌ Couldn't verify the key.\nCheck Gen NX is running with Apps → Connect enabled, and that the MAPI-Key matches your current session key.",
  test_wrongprod: (p: unknown) =>
    `⚠️ Connected, but the product is "${p}".\nThis tool targets Gen NX; some features (shear wall, wind…) may behave differently.`,
  test_http: (c: unknown) =>
    `❌ The server returned an error (HTTP ${c}).\nCheck the Base URL is correct and the Gen NX API server is running.`,
  test_err: (m: unknown) =>
    `❌ Couldn't reach Gen NX.\nCheck Gen NX is running/Connected, the Base URL, and CORS.\n(Details: ${m})`,
  sec_geom: '▣ Geometry',
  sec_prop: '◫ Properties',
  sec_edits: '✏ Edit history',
  kv_type: 'Building type',
  kv_bs: 'Buildings / Stories',
  kv_bay: 'Plan bays',
  kv_span: 'Span (mm)',
  kv_h: 'Height 1F / typ',
  kv_cb: 'Columns / Beams',
  kv_link: (f: unknown) => `Link beams (${f}F)`,
  kv_mat: 'Material',
  kv_csect: 'Column section',
  kv_bsect: 'Beam section',
  kv_bound: (n: unknown) => `Fixed ${n} pts`,
  kv_lc: 'Load cases',
  st_node: 'Nodes',
  st_elem: 'Elements',
  st_h: 'Height m',
  r_react: 'Reaction',
  r_disp: 'Displacement',
  r_force: 'Member force',
  r_moment: 'Bending moment',
  r_none: '// No such result',
  r_more: (tot: unknown) => `… showing 200 of ${tot} rows`,
  vs_node: 'Nodes',
  vs_col: 'Cols',
  vs_beam: 'Beams',
  vs_link: 'Links',
  vs_brace: 'Braces',
  vs_story: (s: unknown) => `${s} stories`,
  plan_intro_tpl:
    'I will build a model with the spec below. Press <b>Run</b> to confirm.',
  plan_intro_custom:
    'I will build a <b>custom frame</b> below. <b>Edit the fields</b> directly, then press <b>Run</b>.',
  pe: {
    buildings: 'Buildings',
    stories: 'Stories',
    bayX: 'X bays',
    bayY: 'Y bays',
    spanX: 'X span',
    spanY: 'Y span',
    h1: '1F height',
    hTyp: 'Typ height',
    colH: 'Col H',
    colB: 'Col B',
    beamH: 'Beam H',
    beamB: 'Beam B',
    connectFloor: 'Link floor *',
    gap: 'Bldg gap *',
    mat: 'Material',
  },
  ps_bs: (b: unknown, s: unknown) =>
    `<span class="k">Buildings</span> ${b} · <span class="k">Stories</span> ${s}<br>`,
  ps_plane: (bx: unknown, by: unknown, sx: unknown, sy: unknown) =>
    `<span class="k">Plan</span> ${bx}×${by} bays · span ${sx}×${sy} mm<br>`,
  ps_h: (h1: unknown, ht: unknown) =>
    `<span class="k">Height</span> 1F ${h1} / typ ${ht} mm<br>`,
  ps_cb: (c: unknown, b: unknown) =>
    `<span class="k">Column</span> ${c} · <span class="k">Beam</span> ${b}<br>`,
  ps_link: (cf: unknown, g: unknown) =>
    `<span class="k">Link</span> floor ${cf} · gap ${g} mm<br>`,
  ps_mat: (m: unknown) => `<span class="k">Material</span> ${m}`,
  build_ok: (b: unknown, s: unknown, n: unknown, e: unknown) =>
    `✅ <b>${b} buildings, ${s} stories</b> model built.<br>Nodes <b>${n}</b> · elements <b>${e}</b> · self-weight (DL) applied.<br><br>Next: <code>run analysis</code> or <code>show max displacement</code>`,
  build_fail: (m: unknown) => `⚠ Build failed: ${m}`,
  need_analyze: 'No analysis results yet. Say <code>run analysis</code> first.',
  edit_done: (m: unknown) =>
    `✏️ ${m}<br><span class="[color:var(--muted)]! [font-size:.82rem]!">Run analysis again to see the effect.</span>`,
  err: (m: unknown) => `⚠ ${m}`,
  unknown:
    'Sorry, I didn\'t understand. Examples:<br><code>build a 15 story residential</code> · <code>run analysis</code> · <code>show max displacement</code><br><span class="[color:var(--cyan)]!">Incremental edits:</span> <code>enlarge floor 3 columns to 700x700</code> · <code>change stories to 20</code><br><span class="[color:var(--muted)]! [font-size:.82rem]!">For free chat, turn on Use LLM under AI (top).</span>',
  clear_chat_model: 'Model cleared. Ready to build a new one.',
  rb_disp: (v: unknown, n: unknown) =>
    `Max vertical displacement <b>${v} mm</b> (Node ${n})<br>`,
  rb_react: (v: unknown, n: unknown) =>
    `Max vertical reaction <b>${v} kN</b> (Node ${n})<br>`,
  rb_force: (n: unknown) =>
    `Member-force table: <b>${n}</b> rows extracted<br>`,
  rb_moment: (name: unknown, v: unknown, e: unknown) =>
    `Max bending moment ${name} <b>${v} kN·m</b> (Elem ${e})<br>`,
  rb_none: 'No results',
  rb_see:
    '<br><span class="[color:var(--muted)]! [font-size:.82rem]!">See the full table in the Results tab</span>',
  st_nomodel: 'No model created yet.',
  st_cur: (b: unknown, s: unknown) =>
    `Current model: <b>${b} buildings, ${s} stories</b><br>`,
  st_counts: (n: unknown, c: unknown, bm: unknown, l: unknown) =>
    `Nodes ${n} · columns ${c} · beams ${bm} · link beams ${l}<br>`,
  st_props: (m: unknown, c: unknown, b: unknown) =>
    `Material ${m} · column ${c} · beam ${b}<br>`,
  st_height: (h: unknown) => `Height ${h} m`,
  meta_title: 'RC Structure Agent — MIDAS Gen NX Automation Tool',
  meta_desc:
    'Model and analyze RC frames in MIDAS Gen NX by chat or click. Taiwan, China & Korea design codes, response spectrum analysis, review indicators.',
  welcome:
    'Hello — this is the <b>Gen NX Conversational Agent</b>. 🏗️<br><br>Click items in the <b>Menu</b> on the left, or type in natural language.<br>Building types: <code>🏠 Residential</code> · <code>🏢 Office</code> · <code>🏬 Commercial</code> · <code>🏥 Hospital</code> · <code>🏫 School</code><br><br>e.g. <code>build a 15 story residential</code> → <code>run analysis</code> → <code>show max displacement</code><br><br><span class="[color:var(--muted)]! [font-size:.82rem]!">Set up the MAPI connection in ⚙. You can change the language at the top.</span>',
  tgt_col: 'Column',
  tgt_beam: 'Beam',
  act_modsect: (t: unknown, n: unknown, c: unknown) =>
    `Changed ${t} section to ${n} (applied to ${c} members).`,
  act_resize: (
    fl: unknown,
    t: unknown,
    c: unknown,
    H: unknown,
    B: unknown,
    n: unknown,
  ) => `Changed ${c} ${t}${fl} to ${H}×${B} (${n}).`,
  act_addload: (
    name: unknown,
    type: unknown,
    fl: unknown,
    n: unknown,
    fz: unknown,
  ) =>
    `Added load case ${name}(${type}) — Fz=${fz}N on ${n} nodes at floor ${fl}.`,
  act_brace: (b: unknown, fl: unknown, c: unknown) =>
    `Added ${c} braces to building ${b}, floors ${fl}.`,
  e_nomodel_edit: 'No model to modify.',
  e_nomodel: 'No model.',
  e_notarget: 'No target members found (check floor range).',
  e_nofloor: 'No nodes found at that floor.',
  e_nobrace: 'No place found for bracing.',
  e_noanalyze: 'No model to analyze. Build a model first.',
  e_notconn:
    'Not connected to Gen NX yet.<br><span class="[color:var(--muted)]! [font-size:.85rem]!">① Launch Gen NX and open a model, then ② open <b>⚙</b> (top-right), enter the Base URL &amp; MAPI-Key and press <b>Test connection</b>.</span>',
  llm_err: (p: unknown, m: unknown) =>
    `⚠ LLM error (${p}): ${m}<br><span class="[color:var(--muted)]! [font-size:.8rem]!">May be a key/model/CORS issue. Check the F12 console or switch to LOCAL mode in ⚙.</span>`,
  /* Phase2 (2026-10): src 인라인 다국어 → 사전 이관 — GUIDE(g_*)·HELP·공급자 힌트(prov_hint_*)·건물유형(bt_*) */
  g_build: 'Build',
  g_build_1: 'Residential 15F',
  g_build_1_cmd: 'build 15 story residential',
  g_build_2: 'Office 10F',
  g_build_2_cmd: 'build 10 story office',
  g_build_3: 'Commercial 6F',
  g_build_3_cmd: 'build 6 story mall',
  g_build_4: 'Hospital 8F',
  g_build_4_cmd: 'build 8 story hospital',
  g_build_5: 'School 5F',
  g_build_5_cmd: 'build 5 story school',
  g_build_6: 'Custom frame',
  g_build_6_cmd: 'build a 10 story custom frame',
  g_build_note:
    'Click to type it into the input and run it → fine-tune in the editable card (typical-floor table). You can also type commands yourself.',
  g_section: 'Modify model',
  g_section_1: 'Resize all columns',
  g_section_1_cmd: 'change all columns to 700x700',
  g_section_2: 'Resize floor columns',
  g_section_2_cmd: 'enlarge floor 3 columns to 700x700',
  g_section_3: 'Floor-range columns',
  g_section_3_cmd: 'enlarge floors 1-3 columns',
  g_section_4: 'Resize all beams',
  g_section_4_cmd: 'change all beams to 400x700',
  g_section_5: 'Change stories',
  g_section_5_cmd: 'change stories to 20',
  g_section_6: 'Change floor height',
  g_section_6_cmd: 'change floor height to 3500',
  g_section_7: 'Change material',
  g_section_7_cmd: 'change material to C350',
  g_section_note:
    'Click = run with the example values. For other values, type the command yourself (just change the numbers). Spec changes show a rebuild-confirm card.',
  g_analysis: 'Analysis',
  g_result: 'Results',
  g_analysis_1: 'Static analysis',
  g_analysis_1_cmd: 'run analysis',
  g_analysis_2: 'Max displacement',
  g_analysis_2_cmd: 'show max displacement',
  g_analysis_3: 'Reactions',
  g_analysis_3_cmd: 'show reactions',
  g_analysis_4: 'Member forces',
  g_analysis_4_cmd: 'show member forces',
  g_analysis_5: 'Status summary',
  g_analysis_5_cmd: 'status summary',
  g_analysis_6: '3D view',
  g_analysis_6_cmd: 'show 3D',
  g_analysis_7: 'Response spectrum analysis',
  g_analysis_7_cmd: 'response spectrum analysis',
  g_analysis_8: 'Review indicators',
  g_analysis_8_cmd: 'review indicators',
  g_misc: 'Manage model',
  g_help: 'Help',
  g_misc_1: 'Clear model',
  g_misc_1_cmd: 'clear',
  g_misc_2: 'User manual',
  g_misc_2_cmd: 'user manual',
  g_misc_4: 'Release notes',
  g_misc_4_cmd: 'release notes',
  g_misc_3: 'Check connection',
  g_misc_3_cmd: 'check connection',
  help_html:
    '<div class="help"><div class="hr"><div class="hk">Start</div><div class="hv"><div class="hn">⚙ → Base URL and MAPI-Key → Test connection</div><div class="hn">Pick language and design code in the header — TWN-USD112 · GB 50010-2010 · KDS 41 20 00</div><div class="hn">Confirmation card and 3D preview work before connecting to Gen NX</div></div></div><div class="hr"><div class="hk">Build</div><div class="hv"><div class="hc"><code>build 15-story apartment</code><code>build 20-story office 2 buildings</code><code>build custom frame</code></div><div class="hn">[Edit] on the card → typical floors, sections, material, slab, seismic/wind → [Run]</div></div></div><div class="hr"><div class="hk">Sections & spec</div><div class="hv"><div class="hc"><code>change all columns to 700x700</code><code>enlarge floor 3 columns to 700x700</code><code>change stories to 20</code><code>change floor height to 3500</code><code>change material to C350</code></div></div></div><div class="hr"><div class="hk">Analysis</div><div class="hv"><div class="hc"><code>run analysis</code><code>response spectrum analysis</code><code>review indicators</code></div><div class="hn">Static → eigen + response spectrum with code scaling (TW 3.2/3.3 · GB min. shear-weight ratio · KDS 0.85V)</div><div class="hn">Review — GB 审图 · KDS drift, torsional irregularity, design category</div></div></div><div class="hr"><div class="hk">Results</div><div class="hv"><div class="hc"><code>show max displacement</code><code>show reactions</code><code>show member forces</code><code>show bending moment</code><code>status summary</code></div></div></div><div class="hr"><div class="hk">View</div><div class="hv"><div class="hc"><code>show 3D</code><code>show results</code><code>model tab</code></div><div class="hn">3D toolbar — iso/front/side/top (orthographic), toggle columns/beams/nodes/floor lines</div><div class="hn">Drag the chat|panel divider to resize · theme buttons (Dark/Light/Cyan) at the bottom</div></div></div><div class="hr"><div class="hk">AI mode</div><div class="hv"><div class="hn">AI (top right) → provider, model, API key → turn on Use LLM</div><div class="hn">Natural-language modeling, analysis and review, view control (“plan view, zoom 2x”), result queries (“top 5 axial forces”)</div></div></div><div class="hr"><div class="hk">Sharing</div><div class="hv"><div class="hn">Append /ko/ · /en/ · /zh-TW/ · /zh-CN/ to open the link (and its preview) in that language</div></div></div><div class="hr"><div class="hk">Other</div><div class="hv"><div class="hc"><code>check connection</code><code>clear model</code><code>help</code></div><div class="hn">Clicking a menu item on the left types the command and runs it</div></div></div></div>',
  unknown_hint: '💡 Type <code>help</code> to see all commands',
  prov_hint_claude:
    '<b>Separate</b> from claude.ai login. Get a key at console.anthropic.com.',
  prov_hint_gemini:
    'Get a key at aistudio.google.com → Get API key (Gemini API).',
  prov_hint_gpt: 'Get a key at platform.openai.com → API keys.',
  prov_hint_deepseek: 'Get a key at platform.deepseek.com → API keys.',
  bt_apartment_label: 'Residential',
  bt_apartment_desc: 'Residential RC frame · short spans',
  bt_apartment_tip:
    'You can change stories and buildings. e.g. <code>build a 25 story 2 building residential</code>',
  bt_office_label: 'Office',
  bt_office_desc: 'Office RC · open-plan long spans',
  bt_office_tip:
    'Adjust stories and span. e.g. <code>build a 20 story office span 10000</code>',
  bt_commercial_label: 'Commercial',
  bt_commercial_desc: 'Commercial RC · large spans · heavy live load',
  bt_commercial_tip:
    'Adjust stories and spans. e.g. <code>build a 6 story mall</code>',
  bt_hospital_label: 'Hospital',
  bt_hospital_desc: 'Hospital RC · heavy MEP floors, large spans',
  bt_hospital_tip:
    'Change the number of stories. e.g. <code>build a 12 story hospital</code>',
  bt_school_label: 'School',
  bt_school_desc: 'School RC · corridor-type rectangular plan',
  bt_school_tip:
    'Change the number of stories. e.g. <code>build a 4 story school</code>',
  /* design code profiles (2026-10) */
  theme_s_navy: 'Dark',
  theme_s_light: 'Light',
  theme_s_cyber: 'Cyan',
  theme_label: 'Theme',
  theme_cyber: 'Cyan',
  theme_navy: 'Dark navy',
  theme_light: 'Light navy',
  who_user: 'User',
  who_agent: 'Gen NX Agent',
  code_label: 'Design code',
  code_TW: 'TWN-USD112',
  code_CN: 'GB 50010-2010',
  code_KR: 'KDS 41 20 00',
  kv_code: 'Design code',
  code_unverified:
    '⚠ Includes items not yet confirmed on live Gen NX (material DB grade label, CH2010 spectrum parameters)',
  load_combos_gb: 'Load combinations (GB 55001/55002)',
  response_spectrum_cn: 'Response spectrum (GB50011 CH2010) RSX·RSY',
  cn_seis_toggle:
    'Apply equivalent static seismic (GB 50011 base shear method)',
  cn_seis_tip:
    'Fortification intensity and design group: GB 50011 Appendix A; site class from the geotechnical report. Blank T1 = GB 50009 F.2.2 empirical formula. Minimum seismic shear factor (GB 55002 4.2.3) is checked per story — forces are scaled up if short. Blank ψT = 0.7 frame / 0.8 with walls or core (JGJ 3 4.3.17) — multiplies analytical periods when reading α (response spectrum too). Beam amplifier Bk: edge beams use (1+Bk)/2 (JGJ 3 5.2.2, slabs are not modeled). Coupling beams (both ends on walls, span/depth < 5) × reduction factor (5.2.1, ≥0.5).',
  cn_intensity: 'Fortification intensity',
  cn_group: 'Design seismic group',
  cn_group_n: (n: unknown) => `Group ${n}`,
  cn_site: 'Site class',
  cn_zeta: 'Damping ratio ζ',
  cn_psil: 'Live load combination factor ψ',
  cn_t1: 'T1 override',
  cn_wind_toggle: 'Apply wind load (GB 50009 wk=βz·μs·μz·w0)',
  cn_wind_tip:
    'Basic wind pressure w0 from GB 50009 Appendix E (50-year), minimum 0.30 kN/㎡. Wind amplification βz is raised to 1.2 if lower (GB 55001 4.6.5). μs 1.3 = rectangular plan (Table 8.3.1).',
  cn_w0wind: 'Basic wind pressure w0',
  cn_terrain: 'Terrain roughness',
  cn_terrain_n: (x: unknown) =>
    (
      ({
        A: 'Coast/lake',
        B: 'Open country/suburb',
        C: 'Urban',
        D: 'Dense urban, high-rise',
      }) as Record<string, string>
    )[x as string] || x,
  cn_mus: 'Shape coefficient μs',
  cn_betaz: 'Wind vibration coefficient βz',
  cn_psit: 'Period reduction ψT (blank = auto)',
  cn_beamamp: 'Beam stiffness amplifier Bk',
  cn_cbred: 'Coupling-beam stiffness reduction',
  cn_stiff_log: (
    a: unknown,
    e: unknown,
    m: unknown,
    n: unknown,
    c: unknown,
    k: unknown,
  ) =>
    `Beam stiffness factors (JGJ 3 5.2.2/5.2.1, ESSF Iyy): interior ×${a} ${m} · edge ×${e} ${n}${k ? ` · coupling ×${c} ${k}` : ''}`,
  cn_cat: 'Fortification category (抗震设防类别)',
  cn_cat_auto: 'Auto (hospital/school → 乙类, others 丙类)',
  cn_cat_B: '乙类 (key fortification)',
  cn_cat_C: '丙类 (standard)',
  kr_grade_n: (x: unknown) =>
    (
      ({
        S: 'Special',
        1: 'I',
        2: 'II',
        3: 'II',
      }) as Record<string, string>
    )[x as string] || x,
  rv_kr_limd: (m: unknown) => `≤ ${m} m (category D)`,
  kr_floors: (n: unknown) => `${n} stories`,
  inwall_beams: (n: unknown) =>
    `${n} beams embedded in walls — self-weight 0 (included in walls, ESSF)`,
  kr_prep_bw: (t: unknown, s: unknown, sys: unknown) =>
    `Apartment = <b>bearing-wall structure</b> — walls ${t} mm · slab ${s} mm · story 2.9 m · units 4.2 m × 2 bays, no columns · system ${sys} (KDS 41 17 00 Table 6.2-1). Give a column size to keep a frame`,
  bw_toggle: 'Bearing walls',
  bw_tip:
    'Unit party walls on every X grid line (full depth, Y direction) + corridor wall on the middle line (X direction, every other bay from both ends — symmetric, door openings simplified). Columns inside walls are omitted, front/back beams act as lintels, beams on walls carry no self-weight (floor load transfer only).',
  bw_desc: 'Residential RC bearing-wall · slab-type (simplified)',
  ps_bw: (t: unknown, b: unknown, s: unknown) =>
    `<span class="k">Bearing wall</span> ${t} mm · no columns · <span class="k">Beam</span> ${b} (lintel) · <span class="k">Slab</span> ${s} mm<br>`,
  core_pos: 'Position',
  core_size: 'Size',
  core_center: 'Center',
  core_towers: 'Towers',
  core_layout: 'Layout',
  core_layout_same: 'Same position',
  core_layout_mirror: 'Mirror (X)',
  core_layout_each: 'Per tower',
  core_edit: 'Edit tower',
  core_grid_tip:
    'Click a cell = core lower-left to that bay · up = +Y, right = +X',
  core_mirror_tip: 'Tower B (every 2nd tower) mirrors tower A in X',
  kr_crack: 'Cracked-section stiffness',
  kr_crack_kds: 'KDS 14 20 20 (columns 0.70 · beams 0.35 · walls 0.70 Ig)',
  kr_crack_half: '50% of gross (KDS 14 20 10 4.3.6)',
  kr_crack_none: 'Off (gross section)',
  kr_crack_log: (
    c: unknown,
    nc: unknown,
    b: unknown,
    nb: unknown,
    w: unknown,
    nw: unknown,
  ) =>
    `Cracked-section stiffness (KDS 41 17 00 7.3.2 ④): columns ×${c} ${nc} · beams ×${b} ${nb}${nw ? ` · walls ×${w} ${nw}` : ''} (ESSF·WSSF)`,
  kr_prep_single:
    'Custom frame = 1 tower (two linked towers are irregular — diaphragm discontinuity; ask for "2 buildings" explicitly)',
  kr_prep_col: (a: unknown, b: unknown, pu: unknown, cap: unknown) =>
    `Columns ${a} → <b>${b}</b> (interior column Pu ≈ ${pu} kN > 0.9·φPn,max ${cap} kN, KDS 14 20 20 4.1.2)`,
  rv_kr_soft: 'Soft story (stiffness ratio)',
  rv_kr_soft_note:
    'Soft story → vertical irregularity V-1 (SDC D: dynamic analysis per 7.1)',
  rv_kr_weight: 'Weight ratio',
  rv_kr_weight_note: 'Effective weight vs adjacent story (7.2.1 W)',
  rv_kr_pdelta: 'P-Δ stability coefficient θ',
  rv_kr_pdelta_ok: 'θ ≤ 0.1 → P-Δ may be ignored',
  rv_kr_pdelta_amp: (a: unknown) =>
    `0.1 < θ ≤ θ_max → P-Δ analysis or amplify drift and forces ×${a} (a_d)`,
  rv_kr_pdelta_ng: 'θ > θ_max → potentially unstable, redesign',
  rv_kr_irr_dyn:
    'Irregularity found (H-1·V-1·V-2) → dynamic analysis required by 7.1 — set Irregular or Response spectrum in seismic input',
  rn_title: 'Release notes',
  rn_open: 'Show release notes',
  rn_current: 'current',
  rn_note:
    'Changes by version, newest first — entries before v3.11 are in Korean',
  kr_seis_toggle: 'Apply equivalent static seismic (KDS 41 17 00)',
  kr_seis_tip:
    'V = Cs·W, Cs = S_DS/(R/I_E) ≤ S_D1/((R/I_E)T), ≥ 0.044·S_DS·I_E ≥ 0.01 (7.2.2) · S_DS = S·2.5·Fa·2/3, S_D1 = S·Fv·2/3 (4.2.2), S = 2.0Z (zone I 0.22 · II 0.14) or the hazard-map value · Ta = 0.0466hn^0.9 (moment frame) / 0.0488hn^0.75 (walls), analytical T ≤ Cu·Ta · accidental eccentricity 5% · whether dynamic analysis is required is decided from the design category, height, stories and regularity (7.1).',
  kr_zone: 'Seismic zone',
  kr_zone_n: (x: unknown) => (x === '2' ? 'II (Z=0.07)' : 'I (Z=0.11)'),
  kr_site: 'Site class',
  kr_s: 'S direct (hazard map)',
  kr_imp: 'Importance',
  kr_imp_auto:
    'Auto (general hospital → 특 · school / ≥5-story apartment / ≥5,000 m² retail → 1 · others 2)',
  kr_imp_S: '특 (I_E 1.5)',
  kr_imp_1: '1 (I_E 1.2)',
  kr_imp_2: '2 (I_E 1.0)',
  kr_imp_3: '3 (I_E 1.0)',
  kr_sys: 'Seismic force-resisting system',
  kr_regular_Y: 'Regular',
  kr_regular_N: 'Irregular (tables 5.3-1/5.3-2)',
  kr_method_auto: 'Auto (7.1 — category·height·stories → dynamic)',
  kr_method_ESL: 'Equivalent static',
  kr_method_RS: 'Response spectrum',
  kr_t: 'T direct (≤ Cu·Ta)',
  kr_rs_primary_auto: (c: unknown, H: unknown, n: unknown) =>
    `KDS 41 17 00 7.1 — design category ${c}, above-ground H=${H} m, ${n} stories`,
  kr_rs_line: (d: unknown, T: unknown, v: unknown, s: unknown, c: unknown) =>
    `${d}: T=${T}s · V_t=${v} kN / static V=${s} kN (0.85V, 7.3.3.5) · C_m=${c}`,
  load_combos_kds: 'Load combinations (KDS 41 12 00 1.7.1)',
  response_spectrum_kds:
    'Response spectrum (KDS 41 17 00 design spectrum) RSX·RSY',
  kr_wind_toggle: 'Apply wind (KDS 41 12 00)',
  kr_wind_tip:
    'W_D = G_D·q_H·(C_pe1 − C_pe2)·A (5.2-2) · q_H = ½ρV_H², V_H = V0·K_zr(H)·I_W (K_D·K_zt = 1.0) · windward 0.8k_z, leeward −0.5 (table 5.7-1) · G_D 5.6.1 (n_D ≤ 1 Hz) / 5.6.2 · strength-design wind factor 1.0 (500-year).',
  kr_v0: 'Basic wind speed V0',
  kr_expo: 'Surface roughness',
  kr_expo_n: (x: unknown) =>
    (
      ({
        A: 'dense high-rise city',
        B: 'dense houses / mid-rise',
        C: 'scattered low-rise',
        D: 'coast / open',
      }) as Record<string, string>
    )[x as string] || x,
  kr_nd: 'Frequency n_D (blank = 1/Ta)',
  kr_zetad: 'Along-wind damping ζ_D',
  rv_sdc: 'Seismic design category',
  rv_kr_grade: 'Seismic grade',
  rv_sys: 'System height limit',
  rv_no_limit: 'no limit',
  rv_method: 'Analysis method',
  rv_method_dyn: 'dynamic analysis required',
  rv_method_esl_ok: 'equivalent static allowed',
  rv_kr_drift: 'Story drift Δ/h',
  rv_kr_drift_note: (c: unknown, i: unknown) =>
    `Δ = C_d·δ_e/I_E (C_d ${c}, I_E ${i}) · P-Δ amplification not included`,
  rv_kr_torsion: 'Torsional irregularity δmax/δavg',
  rv_kr_torsion_note:
    '> 1.2 → torsional irregularity (H-1): set regularity to irregular · torsional amplification A_x (7.2.6.5) not applied',
  rv_cm: 'RS scaling factor C_m',
  rv_cm_note:
    'C_m applies to member forces only — excluded from drift (7.3.3.5)',
  kr_sys_SMF: 'RC special moment frame',
  kr_sys_IMF: 'RC intermediate moment frame',
  kr_sys_OMF: 'RC ordinary moment frame',
  kr_sys_BF_SW: 'Building frame · RC special shear wall',
  kr_sys_BF_OW: 'Building frame · RC ordinary shear wall',
  kr_sys_DS_SW: 'Dual (special MF) · RC special wall',
  kr_sys_DS_OW: 'Dual (special MF) · RC ordinary wall',
  kr_sys_DI_SW: 'Dual (intermediate MF) · RC special wall',
  kr_sys_DI_OW: 'Dual (intermediate MF) · RC ordinary wall',
  kr_sys_SWF: 'RC ordinary shear wall–frame interactive',
  kr_sys_BW_SW: 'Bearing wall · RC special shear wall',
  kr_sys_BW_OW: 'Bearing wall · RC ordinary shear wall',
  cn_method: 'Analysis method',
  cn_method_auto: 'Auto (above-ground > 40 m → response spectrum)',
  cn_method_ESL: 'Base shear method (equivalent static)',
  cn_method_RS: 'Mode-superposition response spectrum',
  rs_primary_build: (w: unknown) =>
    `Primary analysis = response spectrum (${w}). Running <code>dynamic analysis</code> switches the seismic combos to RSX/RSY and applies the code's RS adjustment (minimum shear / base-shear scaling).`,
  rs_primary_title: 'Primary analysis: response spectrum',
  rs_primary_auto: (H: unknown) =>
    `GB 50011 5.1.2 — above-ground H=${H} m > 40 m`,
  rs_primary_forced: 'user selected',
  rs_min_shear: (d: unknown, m: unknown, s: unknown, l: unknown) =>
    `${d} min shear-weight ratio ${m} (${s}) / λ=${l}`,
  rs_scaled: (x: unknown, y: unknown) =>
    `RS load scale X×${x} · Y×${y} (code RS adjustment) → re-analyzed`,
  rs_scaled_note:
    'Short directions are scaled uniformly over all stories and re-analyzed — applies to forces and displacements (GB 50011 5.2.5 commentary).',
  rs_min_shear_failed: 'Minimum shear check failed: ',
  rs_combos:
    'Seismic combos → RSX·RSY (static EX·EY kept in the model for reference)',
  acc_ecc: 'accidental eccentricity',
  rv_height: 'Building height',
  rv_not_tall: 'not high-rise',
  rv_grade_a: 'Class A height',
  rv_grade_b: 'Class B height — period ratio 0.85, torsion 1.4 apply',
  rv_grade_over: 'exceeds max. applicable height — needs special justification',
  rv_grade: 'Seismic grade (抗震等级)',
  rv_frame: 'frame',
  rv_wall: 'wall',
  rv_grade_note_C:
    '丙类 (standard) — local intensity. Large multi-storey malls, large stadiums, theatres etc. may be 乙类 per GB 50223 ch. 6 (set the category on the edit card)',
  rv_grade_note_B:
    '乙类 (key fortification) — seismic measures at intensity +1 (GB 55002 2.3.2); seismic action stays at the local intensity',
  rv_grade_beyond:
    'Height exceeds the table limit at the raised intensity — measures more effective than grade 一 required',
  rv_concrete: 'Concrete grade',
  rv_torsion_relaxed: 'story drift ≤ 40% of limit → cap 1.6 (JGJ 3 3.4.5 note)',
  rv_period_not_tall: 'not a high-rise (JGJ 3 1.0.2) — for reference',
  rv_tw_drift_note: (T: unknown, k: unknown) =>
    `2.16.1 — scaled to V* (I=1, T=${T}s uncapped, no SaD floor) ×${k} · P-Δ amplification not included`,
  rv_tw_torsion_note: (a: unknown) =>
    `> 1.2 → torsional irregularity (table 1-2): set regularity to irregular · accidental-torsion amplifier A_x ≈ ${a} (2.14) not applied`,
  rv_tw_soft_note: 'Soft story (table 1-1 1a) → dynamic analysis per 3.1',
  rv_tw_vsoft_note:
    'Extremely soft story (table 1-1 1b) — not permitted: revise the structural plan',
  rv_tw_weight_note:
    'Seismic weight vs adjacent story (table 1-1 2; excluded when the story below the roof is heavier)',
  rv_tw_pdelta_ng:
    'θ ≥ 0.1 → P-Δ effects must be included in the structural model (2.13; not applied by the app)',
  rv_tw_irr: 'irregularity found',
  rv_tw_rsadj: 'RS base-shear adjustment η',
  rv_tw_rsadj_note:
    '3.3: V_RS ≥ 0.9V (regular) / 1.0V (irregular) — scaled by η when short; dynamic value kept when larger',
  tw_vertical: 'Vertical seismic (2.18)',
  tw_vertical_Y: 'On (EV ±, 100%+30% combos)',
  tw_vertical_N: 'Off',
  tw_vertical_log: (k: unknown, c: unknown, f: unknown) =>
    `Vertical seismic EV (2.18): beams/slab K_z=${k} · columns/walls ${c} · total ${f} kN (downward positive, combos ±0.3·1.0)`,
  tw_pdelta: 'P-Δ analysis (2.13)',
  tw_pdelta_auto: 'Auto (when θ ≥ 0.1)',
  tw_pdelta_Y: 'Always',
  tw_pdelta_N: 'Off',
  tw_pdelta_log: (c: unknown) =>
    `P-Δ analysis (seismic code 2.13, Gen db/PDEL): ${c}`,
  tw_prep_col: (a: unknown, b: unknown, pu: unknown, cap: unknown) =>
    `Columns ${a} → <b>${b}</b> (interior column Pu ≈ ${pu} kN > 0.9·φPn,max ${cap} kN, 112 φPn,max)`,
  rv_tw_pdelta_high:
    'P-Δ analysis applied but θ ≥ 0.25 — amplification is large; re-check convergence and member stiffness (a review threshold, not a code value)',
  tw_ax_unmapped: (n: unknown) =>
    `${n} table rows could not be mapped to a story number — A_x not applied to those stories`,
  rv_tw_pdelta_on:
    'θ ≥ 0.1 but P-Δ analysis (db/PDEL, 1.2D+1.0L) is applied, satisfying 2.13 — θ uses the P-Δ-reduced stiffness',
  tw_ax_log: (a: unknown) =>
    `Torsional amplification A_x (seismic code 2.14) up to ${a} — static EX·EY accidental torsion scaled per story and re-analyzed (RS: 5% × max A_x)`,
  rv_title: 'Review indicators',
  rv_src_rs: 'response spectrum',
  rv_src_st: 'static base shear method',
  rv_item: 'Item',
  rv_value: 'Value',
  rv_limit: 'Limit',
  rv_where: 'Governing',
  rv_clause: 'Clause',
  rv_drift: 'Story drift ratio',
  rv_shear: 'Shear-weight ratio',
  rv_torsion: 'Torsional displacement ratio',
  dia_per_bldg: (n: unknown, m: unknown, t: unknown, c: unknown, k: unknown) =>
    `per-tower floor membranes: ${n} towers · ${m} (PLSTRS t=${t} mm, zero density — in-plane stiffness only)${c ? ` · ${k} connector slab panels at floor ${c}` : ''} · story diaphragm OFF`,
  rigd_story_conflict:
    'rigd diaphragm together with Story Data makes Gen NX refuse the analysis — using the story diaphragm instead.',
  cn_prep_single:
    'Custom frame = 1 tower (two connected towers are a connected structure under JGJ 3 10.5 — ask for "2 buildings" explicitly)',
  cn_prep_col: (a: unknown, b: unknown, m: unknown, l: unknown) =>
    `Columns ${a} → <b>${b}</b> (estimated axial ratio ${m} > limit ${l}×0.9, GB 50011 6.3.6)`,
  cn_rs_primary_conn: (c: unknown) =>
    `connected towers (floor ${c}) — irregular, JGJ 3 10.5`,
  rv_conn: 'Connected structure',
  rv_conn_val: (n: unknown, c: unknown) =>
    `${n} towers · connected at floor ${c}`,
  rv_conn_vert: 'vertical seismic required (10.5.2, not computed)',
  rv_conn_note:
    'Not handled by the app: rigid connector with slab ≥150 mm two-way (10.5.4), seismic grade +1 for the connector and attached members (10.5.6), vertical seismic at 7 (0.15g)/8 (10.5.2). Analysis switched to response spectrum automatically.',
  rv_stiff: 'Lateral stiffness ratio',
  rv_stiff_avg3: 'vs. average of 3 stories above',
  rv_stiff_note: 'K = story shear / story drift (seismic)',
  rv_stiff_soft:
    'Stories below the limit are soft stories → seismic shear ×1.25 required (JGJ 3 3.5.8, not applied by the app)',
  rv_stab: 'Stiffness-to-weight ratio',
  rv_stab_pd: 'P-Δ may be ignored',
  rv_stab_need_pd:
    'Stable, but gravity second-order (P-Δ) effects must be considered (JGJ 3 5.4.1)',
  rv_stab_note:
    'G = 1.2D + 1.4L · with walls: EJd = 11·V0·H³/(60u) (static EX/EY as inverted triangle)',
  rv_otm: 'Frame overturning-moment ratio',
  rv_otm_1: '≤10% → design as shear-wall structure',
  rv_otm_2: '10–50% → typical frame–shear wall',
  rv_otm_3: '50–80% → frame grade & axial ratio per frame structure',
  rv_otm_4: '>80% → max. height per frame structure',
  rv_otm_note:
    'Mc = Σ column shear × story height / total overturning moment at the embedment (static EX/EY as the specified lateral force)',
  rv_axial: 'Column axial compression ratio',
  rv_axial_note: (e: unknown) =>
    `N = 1.3(D+0.5L) + 1.4|${e}| · μ = N/(fc·A), fc per GB 50010 table 4.1.4 · −0.05 for shear-span ratio ≤ 2 not applied`,
  rv_embed: 'Embedment stiffness ratio',
  rv_embed_note:
    'B1 / 1F equivalent shear stiffness G·A/h (Appendix E.0.1). Basement “related area” (3 bays beyond the tower) and soil restraint are not modeled, so this usually comes out low',
  rv_comfort: 'Wind-induced comfort',
  rv_comfort_note:
    'H ≥ 150 m — needs 10-year wind pressure and across-wind spectra (GB 50009 App. J/H) or a wind-tunnel test. Not computed by the app',
  rv_mass: 'Effective mass participation',
  rv_period: 'Period ratio Tt/T1',
  rv_no_data: 'no data in the Gen table',
  rv_torsion_src:
    'Torsional ratio = max/average story drift under static EX·EY (+5% accidental eccentricity)',
  rv_unverified_clause:
    'period-ratio limit not checked against the JGJ 3-2010 text',
  rv_no_torsion_mode: 'no torsion-dominant mode found (too few modes)',
  rv_need_dynamic:
    'Review indicators need dynamic-analysis results. Run <code>dynamic analysis</code> first.',
  rv_not_supported:
    'This design code has no review indicators (currently China GB, Korea KDS and Taiwan).',
  rv_fetch_failed: 'Review table retrieval failed: ',
  rv_summary_bad: (n: unknown, w: unknown) => `${n} exceeded · ${w} caution.`,
  rv_summary_ok: 'All indicators satisfied.',
  rv_panel_hint: 'Shown as a table in the Results tab.',
  tw_seis_tip:
    'V = I/(1.4αy)·(SaD/Fu)m·W (seismic code 2.2, αy=1.0) · V*/VM floors (2.10; VM needs SMS·SM1) · empirical T 0.070hn^¾ (0.050 with walls), analytical T ≤ 1.4× · T0 given = Taipei Basin. Use response spectrum for irregular buildings.',
  tw_t: 'T direct (≤1.4×empirical)',
  tw_method_auto: 'Auto (≥50 m or ≥15 stories above ground → RS)',
  tw_method_ESL: 'Equivalent static',
  tw_method_RS: 'Response spectrum',
  tw_regular: 'Regularity',
  tw_regular_Y: 'Regular (RS ≥ 0.9V)',
  tw_regular_N: 'Irregular (RS ≥ 1.0V)',
  tw_rs_primary_auto: (H: unknown, n: unknown) =>
    `seismic code 3.1 — above-ground H=${H} m, ${n} stories (≥50 m or ≥15)`,
  tw_rs_line: (
    d: unknown,
    T: unknown,
    C: unknown,
    v: unknown,
    r: unknown,
    s: unknown,
  ) =>
    `${d}: T=${T}s · C=${C} · V_RS=${v} kN / ${r}%×static V=${s} kN (3.2·3.3)`,
  tw_rs_nodata: (d: unknown) =>
    `${d}: RS base shear not read — adjustment skipped`,
  tw_wind_toggle: 'Apply wind (TW wind code 2014)',
  tw_wind_tip:
    'q(z)=0.06·K(z)·[I·V10(C)]² kgf/m², K(z)=2.774(z/zg)^2α · windward 0.8q(z) + leeward q(h) (Table 2.4) · G=1.88 (ordinary buildings). V10(C) = basic wind speed, exposure C at 10 m (2.4). Combos 1.6W·0.8W (112 5.3.1).',
  tw_wind_i: 'Wind importance I',
  slab_thk: 'Slab thickness',
  slab_tip:
    'Slabs are not modeled as elements, so slab self-weight (thickness × RC unit weight) is added to the floor dead load (DL). Enter 0 if already included in the superimposed load.',
  w0_auto_tip:
    'Leave dead w0 blank to derive story weights from the model dead load (columns·beams·walls·slab·finishes) — consistent with the dynamic-analysis mass.',
}
export const logs = {
  cleared: '└ <b>Existing model cleared</b>',
  unit: (f: unknown, d: unknown) => `└ Units <b>${f}, ${d}</b>`,
  matl: (n: unknown, E: unknown) => `└ Material <b>${n}</b> (E=${E})`,
  sect: (n: unknown, H: unknown, B: unknown) =>
    `└ Section <b>${n}</b> ${H}×${B}`,
  node: (n: unknown) => `└ Nodes <b>${n}</b>`,
  elem: (n: unknown) => `└ Elements <b>${n}</b>`,
  bound: (n: unknown, c: unknown) => `└ Boundary <b>${n}</b> (${c})`,
  lc: (n: unknown, ty: unknown) => `└ Load case <b>${n}</b> (${ty})`,
  selfw: (f: unknown, l: unknown) => `└ Self-weight <b>${f}g</b> (Z) → ${l}`,
  nodal: (n: unknown, l: unknown) => `└ Nodal loads <b>${n}</b> → ${l}`,
  analRun: 'Running analysis…',
  analDone: '└ <b>Analysis done</b>',
  fail: (m: unknown) => `└ <b class="[color:var(--red)]!">failed</b> ${m}`,
  reassign: (n: unknown, nm: unknown) =>
    `└ ${n} members → section <b>${nm}</b> reassigned`,
  braceAdd: (c: unknown, b: unknown, f: unknown) =>
    `└ <b>${c}</b> braces added (B${b}, floors ${f})`,
}
