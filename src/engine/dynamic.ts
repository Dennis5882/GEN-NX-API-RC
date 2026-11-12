/* Behavior-preserving port of shared/rc_engine.js. Equations and iteration order are unchanged. */
import type {
  SpectrumParams,
  SpectrumPoint,
  ModalPeriod,
  ModalTable,
} from './types'

function effSD1(params: SpectrumParams) {
  if (params.SD1 != null) return params.SD1
  if (params.SDS && params.T0) return params.SDS * params.T0
  return 0
}

export function twDesignSpectrum(params?: SpectrumParams) {
  params = params || {}
  const SDS = params.SDS || 0,
    SD1 = effSD1 ? effSD1(params) : params.SD1 || 0,
    TL = params.TL != null ? params.TL : 2.5
  const Ts = SDS > 0 ? SD1 / SDS : 0,
    T0 = 0.2 * Ts
  const Sa: (period: number) => number = T => {
    if (SDS <= 0) return 0
    if (T <= 0) return 0.4 * SDS
    if (T < T0) return SDS * (0.4 + (0.6 * T) / T0)
    if (T <= Ts) return SDS
    if (T <= TL) return SD1 / T
    return (SD1 * TL) / (T * T)
  }
  const pts = [
    0,
    T0,
    Ts,
    0.3,
    0.5,
    0.75,
    1.0,
    1.5,
    2.0,
    TL,
    3.0,
    4.0,
    5.0,
  ].filter(t => t >= 0 && isFinite(t))
  const seen: Record<string, number> = {},
    func: SpectrumPoint[] = []
  pts
    .sort((a, b) => a - b)
    .forEach(T => {
      const k = T.toFixed(4)
      if (seen[k]) return
      seen[k] = 1
      func.push({ PERIOD: +T.toFixed(4), VALUE: +Sa(T).toFixed(5) })
    })
  return { func, T0: +T0.toFixed(4), Ts: +Ts.toFixed(4), SDS, SD1, TL }
}

export function eigvPayload(modes: number) {
  return {
    TYPE: 'LANCZOS',
    iFREQ: Math.max(1, modes | 0),
    iITER: 20,
    iDIM: 1,
    TOL: 1e-10,
    bMINMAX: false,
    FRMIN: 0,
    FRMAX: 0,
    bSTRUM: false,
  }
}

export function splcPayload(
  name: string,
  dir: string | undefined,
  funcName: string,
  scale?: number,
) {
  return {
    NAME: name,
    DIR: dir || 'XY',
    ANGLE: 0,
    SCALE: scale != null ? scale : 1,
    PMFT: 1,
    bDAMP: false,
    INTERP: 'LOG',
    DESC: '',
    COMTYPE: 'CQC',
    bADDSIGN: true,
    iSIGNTYPE: 0,
    bMODE: false,
    aFUNCNAME: [funcName],
  }
}

export function pickModalPeriods(resp: unknown) {
  const out: ModalPeriod[] = []
  const tryTable: (table: ModalTable | null | undefined) => boolean = tb => {
    if (!tb || !Array.isArray(tb.HEAD) || !Array.isArray(tb.DATA)) return false
    const H = tb.HEAD.map(x => String(x).toLowerCase())
    const ip = H.findIndex(h => h.includes('period'))
    if (ip < 0) return false
    const im = H.findIndex(h => h.includes('mode')),
      ifc = H.findIndex(h => h.includes('cycle'))
    tb.DATA.forEach(r => {
      const T = parseFloat(r[ip] as string)
      if (isFinite(T) && T > 0)
        out.push({
          mode: im >= 0 ? r[im] : out.length + 1,
          period: T,
          fcyc: ifc >= 0 ? parseFloat(r[ifc] as string) : null,
        })
    })
    return out.length > 0
  }
  const walk: (value: unknown) => boolean = o => {
    if (!o || typeof o !== 'object') return false
    if (tryTable(o as ModalTable)) return true
    if (Array.isArray(o)) {
      for (const v of o) {
        if (walk(v)) return true
      }
      return false
    }
    for (const k in o) {
      const v = (o as Record<string, unknown>)[k]
      if (v && typeof v === 'object' && walk(v)) return true
    }
    return false
  }
  walk(resp)
  const T1 = out.reduce((m, x) => Math.max(m, x.period), 0) || null
  return { modes: out, T1 }
}
