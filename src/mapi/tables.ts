/* post/table 응답 파싱 — 순수 함수 (액션·기준 프로필 공용) */

/** post/table 응답 → 행 객체 배열 (HEAD 를 키로). name = 요청한 TABLE_NAME */
export function tableObjs(j: any, name: string): Record<string, string>[] {
  const tb = j?.[name]
  if (!tb?.HEAD || !tb?.DATA) return []
  return tb.DATA.map((r: any[]) => Object.fromEntries(tb.HEAD.map((h: string, i: number) => [h, r[i]])))
}

/** SUB_TABLES 중 이름이 prefix 로 시작하는 표들의 행을 이어 붙임 (예: 'MODAL PARTICIPATION MASSES PRINTOUT (1)', '(2)' …) */
export function subTableObjs(j: any, name: string, prefix: string): Record<string, string>[] {
  const subs = j?.[name]?.SUB_TABLES
  const out: Record<string, string>[] = []
  for (const st of Array.isArray(subs) ? subs : subs ? [subs] : []) {
    for (const k of Object.keys(st || {})) {
      if (!k.startsWith(prefix)) continue
      out.push(...tableObjs(st, k))
    }
  }
  return out
}

export const num = (v: unknown): number => { const n = parseFloat(String(v)); return isFinite(n) ? n : NaN }

/** 모드 분류 — MODAL PARTICIPATION MASSES 행에서 질량참여율이 가장 큰 성분(X·Y 병진 / Z 회전) */
export function classifyModes(rows: Record<string, string>[]) {
  /* Gen 은 PRINTOUT (1)=비율(%) · (2)=절대질량(헤더에 (%) 없음) 두 표를 줌 — % 표 행만 (2026-10-12 라이브) */
  return rows.filter(r => r['TRAN-XMASS(%)'] != null).map(r => {
    const x = num(r['TRAN-XMASS(%)']), y = num(r['TRAN-YMASS(%)']), rz = num(r['ROTN-ZMASS(%)'])
    const dom = rz >= x && rz >= y ? 'RZ' : x >= y ? 'X' : 'Y'
    return { mode: Math.round(num(r.ModeNo)), x, y, rz, dom, sumX: num(r['TRAN-XSUM(%)']), sumY: num(r['TRAN-YSUM(%)']) }
  })
}

/** 방향별 기본주기 — 각 방향 질량참여 최대 모드(대개 첫 지배 모드)의 주기. EIGENVALUEMODE 응답(name=TABLE_NAME) */
export function dirPeriods(j: any, name: string): { X: number | null; Y: number | null } {
  const per = subTableObjs(j, name, 'EIGENVALUE ANALYSIS').map(r => ({ mode: Math.round(num(r.ModeNo ?? r.Mode)), T: num(r['Period(sec)']) }))
  const modes = classifyModes(subTableObjs(j, name, 'MODAL PARTICIPATION MASSES'))
  const pick = (d: 'X' | 'Y') => {
    const m = modes.find(x => x.dom === d)
    const T = m ? per.find(q => q.mode === m.mode)?.T : undefined
    return T != null && isFinite(T) ? T : null
  }
  return { X: pick('X'), Y: pick('Y') }
}

/** 최소 전단중량비 — STORY_SHEAR_FORCE_COEFFICIENT 행의 V_i/ΣG_j 최소값과 증폭 배율 η = max(1, λ/최소) */
export function minShearScale(rows: Record<string, string>[], dir: 'X' | 'Y', lambda: number) {
  let min = Infinity, story = ''
  for (const r of rows) {
    const c = parseFloat(r['Story Shear Force Coefficient/' + dir])
    if (c > 0 && c < min) { min = c; story = r.Story }
  }
  if (!isFinite(min)) return null
  return { min, story, eta: lambda > 0 ? Math.max(1, Math.ceil(lambda / min * 1000) / 1000) : 1 }
}
