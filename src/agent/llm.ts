/* ════════════════════════════════════════════════════════════
   LLM MODE — Claude / Gemini / GPT / DeepSeek tool-use 루프.
   키는 브라우저에서 직접 공급자에 전송(메모리 보관만). Gemini 는 gSchema() 정규화 필요.
   공급자별 제약(2026-10 공식 문서 확인):
   - GPT: Chat Completions 도구호출은 gpt-6-luna 가 reasoning_effort 'none' 일 때만. gpt-6.1-sol 은 미지원 → 목록 제외.
   - Gemini 3: 응답 part(thoughtSignature 포함)를 다음 요청에 그대로 재전송 → turn.raw 보존.
   - DeepSeek: thinking 기본 ON, assistant reasoning_content 를 모든 후속 요청에 재전송(누락 시 400).
════════════════════════════════════════════════════════════ */
import { actAnalyze } from '../actions/analysis'
import { actAddBracing, actAddLoad, actBuildFrame, actModifySection, actResizeSubset, clearModel } from '../actions/model'
import { actStoryWeightVerify, actSseisVerify, actSwindVerify } from '../actions/verify'
import { stampSpec } from '../codes'
import { RC, type BuildingSpec } from '../engine'
import { escapeHtml, t } from '../i18n'
import { S, type Provider } from '../state/store'
import { addMsg, renderModelState, tab, thinking } from '../state/ui'
import { extremum, statusBrief } from './results'

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

const TOOLS = [
  { name: 'build_frame', description: 'Build a parametric multi-building moment frame (Ramen) in Gen NX. Generates nodes, columns, beams, optional connecting beams, fixed supports, and a self-weight load case. Use this for a brand-new model; it clears any existing model first.',
    input_schema: { type: 'object', properties: {
      buildings: { type: 'integer' }, stories: { type: 'integer' }, bayX: { type: 'integer' }, bayY: { type: 'integer' },
      spanX: { type: ['number', 'array'], items: { type: 'number' }, description: 'mm; single value = uniform, or array of per-bay distances e.g. [3000,4000,3000]' },
      spanY: { type: ['number', 'array'], items: { type: 'number' }, description: 'mm; single value = uniform, or array of per-bay distances e.g. [3000,4000,3000]' },
      h1: { type: 'number', description: 'first floor height mm' }, hTyp: { type: 'number', description: 'typical floor height mm' },
      gap: { type: 'number', description: 'gap between buildings mm' }, connectFloor: { type: 'integer', description: 'floor index where buildings connect, 0=none' }, podium: { type: 'integer', description: 'number of podium (commercial) floors at base, 0=none' },
      colH: { type: 'number' }, colB: { type: 'number' }, beamH: { type: 'number' }, beamB: { type: 'number' }, matName: { type: 'string' },
    }, required: ['stories'] } },
  { name: 'modify_section', description: 'Resize ALL columns or ALL beams of the existing model by changing their shared section. Incremental edit — does not rebuild.',
    input_schema: { type: 'object', properties: { target: { type: 'string', enum: ['col', 'beam'] }, H: { type: 'number', description: 'depth mm' }, B: { type: 'number', description: 'width mm' } }, required: ['target', 'H', 'B'] } },
  { name: 'resize_subset', description: 'Resize only a SUBSET of columns or beams limited to specific floors. Creates a dedicated new section for those members only. Incremental edit.',
    input_schema: { type: 'object', properties: { target: { type: 'string', enum: ['col', 'beam'] }, H: { type: 'number' }, B: { type: 'number' }, floors: { type: 'array', items: { type: 'integer' }, description: 'floor indices, e.g. [1,2,3]' } }, required: ['target', 'H', 'B', 'floors'] } },
  { name: 'add_load', description: 'Add a new load case and apply a vertical nodal load to all nodes on one floor. Incremental edit.',
    input_schema: { type: 'object', properties: { name: { type: 'string' }, type: { type: 'string', description: 'D/L/W/E/U' }, floor: { type: 'integer' }, fz: { type: 'number', description: 'vertical force N, negative = downward' } }, required: ['name', 'type', 'floor', 'fz'] } },
  { name: 'add_bracing', description: 'Add diagonal bracing in one building at given floors. Incremental edit — appends new elements.',
    input_schema: { type: 'object', properties: { building: { type: 'integer', description: '0-based building index' }, floors: { type: 'array', items: { type: 'integer' } } }, required: ['building', 'floors'] } },
  { name: 'verify_seismic_sseis', description: 'QA cross-check: feed the self-computed equivalent-static seismic story forces into Gen NX native db/SSEIS (USER TYPE) and compare the returned STORY_SHEAR / overturning moment / accidental torsion profile against our own. Read-back verification only — does NOT change the analysis loads (EX/EY via CNLD stay authoritative). Requires an existing model with seismic load enabled. Beta feature.', input_schema: { type: 'object', properties: {} } },
  { name: 'verify_story_weight', description: 'Informational QA: compare our estimated equivalent-static seismic story weights (w0 assumption) against Gen NX model-derived story weights. Sources the real weights from db/SSEIS GET PROFILE (STORY_WEIGHT) via a minimal probe PUT→GET→DELETE (ope/STORPROP is absent in the 0612 beta). Differences are expected (estimate vs actual mass) — use to sanity-check / calibrate w0. Requires a model with stories registered in Gen Story Manager.', input_schema: { type: 'object', properties: {} } },
  { name: 'verify_swind', description: 'QA cross-check (wind): feed the self-computed static wind story forces into Gen NX native db/SWIND (USER TYPE) — converting force→pressure via the model floor width and tributary height — and compare the returned WIND_FORCE / STORY_SHEAR / overturning-moment profile against our own. Read-back verification only; does not change analysis loads (WX/WY via CNLD stay authoritative). Requires a model with wind on and stories registered in Gen Story Manager.', input_schema: { type: 'object', properties: {} } },
  { name: 'run_analysis', description: 'Run static analysis and fetch reaction / displacement / beam-force result tables.', input_schema: { type: 'object', properties: {} } },
  { name: 'get_result', description: 'Summarize a previously computed result.', input_schema: { type: 'object', properties: { which: { type: 'string', enum: ['disp', 'react', 'force'] } }, required: ['which'] } },
  { name: 'clear_model', description: 'Delete all model data in Gen NX.', input_schema: { type: 'object', properties: {} } },
  { name: 'get_status', description: 'Report the current in-memory model summary including section sizes, load cases, and edit history.', input_schema: { type: 'object', properties: {} } },
]

const SYSTEM = `You are a structural engineering agent that builds, EDITS, and analyzes models in MIDAS Gen NX through tools. Defaults when unspecified: 2 buildings, 10 stories, 4x2 bays, 7000x8000mm spans, first floor 3600mm / typical 2900mm, columns 600x600, beams 400x600, C24 concrete, connect buildings at floor 8 if 2+ buildings.
spanX and spanY accept either a single number (uniform bays) OR an array of per-bay distances for non-uniform spacing, e.g. spanY=[3000,4000,3000] makes 3 Y-bays of 3000/4000/3000mm; the bay count auto-syncs to the array length.
When the user asks to verify / cross-check / QA the seismic story shear (層剪力 교차검증) against Gen's native calculation, call verify_seismic_sseis (requires seismic to be on). It is a read-back QA check and does not alter the analysis model. To compare story weights (層重量) against Gen's model-derived values, call verify_story_weight (informational). To cross-check the static WIND story shear (風 層剪力 교차검증) against Gen, call verify_swind (requires wind on). All three require a model whose stories are registered in Gen's Story Manager (GUI Story tab / Auto Generate).
IMPORTANT — incremental editing: when a model already exists and the user asks to change part of it, do NOT call build_frame. Instead use modify_section / resize_subset / add_load / add_bracing. Floors are 1-based. After an edit, suggest re-running analysis to see the effect. If unsure of the current state, call get_status first. Always confirm key parameters in your reply. Be concise and reply in the user's language: Korean if they write Korean, English if English, Traditional Chinese (Taiwan) if Traditional Chinese — using Taiwan structural-engineering terminology (結構, 構架, 柱, 梁, 斷面, 載重, 桿件內力, 變位, 反力, 斜撐, 跨距, 樓層), and Simplified Chinese (mainland China) if Simplified Chinese — using mainland terminology (结构, 框架, 柱, 梁, 截面, 荷载, 构件内力, 位移, 支座反力, 斜撑, 跨度, 楼层). Use millimetres and Newtons.`

async function callTool(name: string, inp: any): Promise<string> {
  if (name === 'build_frame') {
    const base: any = inp.bldgType && RC.BUILDING_TYPES[inp.bldgType as keyof typeof RC.BUILDING_TYPES]
      ? { ...RC.BUILDING_TYPES[inp.bldgType as keyof typeof RC.BUILDING_TYPES], bldgType: inp.bldgType } : { ...RC.DEFAULT_SPEC }
    let p: BuildingSpec = { ...base, ...inp }
    if (inp.colH || inp.colB) { p.colH = inp.colH || p.colH; p.colB = inp.colB || p.colB; p.colName = `C${p.colH}x${p.colB}` }
    if (inp.beamH || inp.beamB) { p.beamH = inp.beamH || p.beamH; p.beamB = inp.beamB || p.beamB; p.beamName = `B${p.beamB}x${p.beamH}` }
    if (inp.connectFloor === 0) p.connectFloor = 0
    // 가변 스팬(배열)이면 跨數 동기화
    if (Array.isArray(p.spanX)) p.bayX = p.spanX.length
    if (Array.isArray(p.spanY)) p.bayY = p.spanY.length
    p = stampSpec(p)   // 현재 설계기준 기록 + 재료명 변환
    tab('logP'); await actBuildFrame(p)
    return `Built ${p.buildings} buildings x ${p.stories} stories. Nodes=${S.model.nodes.length}, elements=${S.model.cols.length + S.model.beams.length + S.model.links.length}. Self-weight load case 'DL' applied.`
  }
  if (name === 'modify_section') { tab('logP'); return await actModifySection(inp.target, inp.H, inp.B) }
  if (name === 'resize_subset') { tab('logP'); return await actResizeSubset(inp.target, inp.H, inp.B, inp.floors || []) }
  if (name === 'add_load') { tab('logP'); return await actAddLoad(inp.name, inp.type, inp.floor, inp.fz) }
  if (name === 'add_bracing') { tab('logP'); return await actAddBracing(inp.building, inp.floors || []) }
  if (name === 'verify_seismic_sseis') { tab('logP'); return await actSseisVerify() }
  if (name === 'verify_story_weight') { tab('logP'); return await actStoryWeightVerify() }
  if (name === 'verify_swind') { tab('logP'); return await actSwindVerify() }
  if (name === 'run_analysis') {
    await actAnalyze(); tab('resP')
    const d = S.results.disp && extremum(S.results.disp, 'DZ'), r = S.results.react && extremum(S.results.react, 'FZ')
    return `Analysis done. Max vertical disp ${d ? d.v.toFixed(3) + 'mm @node ' + d.node : 'n/a'}; max vertical reaction ${r ? (r.v / 1000).toFixed(1) + 'kN @node ' + r.node : 'n/a'}.`
  }
  if (name === 'get_result') {
    const which = inp.which as 'disp' | 'react' | 'force'
    const ext = extremum(S.results[which] || { head: [], data: [] }, which === 'react' ? 'FZ' : which === 'disp' ? 'DZ' : 'MY')
    S.resultTab = which; tab('resP')
    return ext ? `extreme ${ext.v} @node ${ext.node}` : 'no result yet'
  }
  if (name === 'clear_model') {
    await clearModel()
    S.model.nodes = []; S.model.cols = []; S.model.beams = []; S.model.links = []
    renderModelState(); return 'Model cleared.'
  }
  if (name === 'get_status') return statusBrief().replace(/<[^>]+>/g, '') + (S.model.edits && S.model.edits.length ? (' Edits: ' + S.model.edits.join('; ')) : '')
  return 'unknown tool'
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
      body: { model, max_tokens: 1024, system: SYSTEM, tools: TOOLS, messages } }
  }
  const compatUrl = OPENAI_COMPAT[provider]
  if (compatUrl) {
    const messages: any[] = [{ role: 'system', content: SYSTEM }]
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
    const body: any = { model, messages, tools: TOOLS.map(tl => ({ type: 'function',
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
    body: { systemInstruction: { parts: [{ text: SYSTEM }] },
      tools: [{ functionDeclarations: TOOLS.map(tl => ({ name: tl.name, description: tl.description, parameters: gSchema(tl.input_schema) })) }],
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
    while (loop++ < 8) {
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
