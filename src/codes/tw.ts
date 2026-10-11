/* ════════════════════════════════════════════════════════════
   대만 프로필 — TWN-USD112 / 建築物耐震設計規範 / TWD WIND.
   계산 구현은 shared/rc_engine.js(대만 단일 소스, Wizard 공용)를 그대로 감싼다.
   바닐라 동작과 1:1 — 값·문구·페이로드를 바꾸지 말 것(등가성 하네스로 검증).
════════════════════════════════════════════════════════════ */
import { RC } from '../engine'
import { t } from '../i18n'
import type { CodeProfile, ParamField } from './types'

const num = (key: string, label: () => string, def: ParamField['def'], unit?: string): ParamField =>
  ({ key, kind: 'number', label, def, unit })

export const TW: CodeProfile = {
  id: 'TW',
  designCode: 'TWN-USD112',

  materials: RC.MATERIALS,
  /* M1.7: Taiwan material - concrete CNS560(RC) (live-verified). MPa 등급명은 CNS 표기로 정규화. */
  concreteMatl(name) {
    const shown = RC._MPA2CNS[name] || (RC._CNS_CONC.includes(name) ? name : 'C280')
    return { NAME: shown, STANDARD: 'CNS560(RC)', DB: shown }
  },

  floorUse: RC.FLOOR_USE,
  combos: lc => RC.taiwanCombos(lc),
  combosLogKey: 'load_combos_twd_usd112',

  seismic: {
    toggleKey: 'apply_equivalent_static_se',
    tipHtml: () => `<a href="https://seaport.ncree.org/sederes/" target="_blank" rel="noopener" style="color:var(--cyan);font-weight:600">↗ Sederes</a> ${t('look_up_site_sds_sd1_or_t0')}`,
    fields: [
      num('SDS', () => 'SDS (Sas)', () => 0.6),
      num('SD1', () => 'SD1 (Sa1)', () => 0.35),
      num('T0', () => t('t0_basin'), () => '', 's'),
      /* 用途係數: 병원·학교 1.25 */
      num('I', () => 'I ' + t('use_2'), p => (p.bldgType === 'hospital' || p.bldgType === 'school') ? 1.25 : 1.0),
      num('R', () => 'R ' + t('sys'), () => 4.5),
      num('w0', () => t('dead_w0'), () => 12, 'kN/㎡'),
      num('liveRatio', () => t('live'), () => 0.25),
      num('Cs', () => 'Cs ' + t('ovr'), () => ''),
      num('V', () => t('v_direct'), () => '', 'kN'),
    ],
    presets: {
      labelKey: 'site_preset',
      list: () => RC.SEISMIC_ZONES.map(z => ({ label: `${z.city} ${z.dist} · SDS ${z.SDS}`, values: { SDS: z.SDS, SD1: z.SD1, T0: z.T0 } })),
    },
    storyForces: (p, sp, opt = {}) => RC.seismicStoryForces(p, {
      SDS: sp.SDS, SD1: sp.SD1, T0: sp.T0, I: sp.I, R: sp.R, w0: sp.w0, liveRatio: sp.liveRatio,
      ...(opt.T != null ? { T: opt.T } : { Cs: sp.Cs, V: sp.V }),
    }),
    storyWeights: (p, sp) => RC.seismicStoryWeights(p, { w0: sp.w0, liveRatio: sp.liveRatio }),
    /* 대만 설계스펙트럼(SDS/SD1 → ASCE-7 형상)을 USER 함수로 */
    spectrum(sp) {
      const ds = RC.twDesignSpectrum({ SDS: sp.SDS, SD1: sp.SD1, T0: sp.T0 })
      if (!(sp.SDS > 0) || !ds.func.length) return null
      return {
        name: 'TW-RS',
        spfc: { NAME: 'TW-RS', iTYPE: 1, iMETHOD: 0, SCALE: 1, GRAV: 9.806, DRATIO: 0.05, DESC: 'TWD design spectrum', STR: { SPEC_CODE: 'USER' }, aFUNC: ds.func },
        logSuffix: ` · T0=${ds.T0}s Ts=${ds.Ts}s`,
        reportSuffix: ` SDS=${ds.SDS} SD1=${ds.SD1} (T0=${ds.T0}s, Ts=${ds.Ts}s)`,
      }
    },
    spectrumLogKey: 'response_spectrum_tw_rsx_r',
  },

  wind: {
    toggleKey: 'apply_wind_simplified_stat',
    tipHtml: () => t('simplified_qz_0_613_vz_wx_'),
    fields: [
      num('V10', () => t('wind_v10'), () => 42.5, 'm/s'),
      { key: 'exposure', kind: 'select', label: () => t('exposure'), def: () => 'B',
        options: () => ['A', 'B', 'C'].map(x => ({ value: x, label: `${x} ${t('expo', x)}` })) },
      num('G', () => t('gust_g'), () => 1.9),
      num('Cf', () => t('force_cf'), () => 1.3),
    ],
    storyForces: (p, wp) => RC.windStoryForces(p, { V10: wp.V10, exposure: wp.exposure, G: wp.G, Cf: wp.Cf, I: wp.I }),
  },

  /* 用途係數 공유: 풍하중 I = 지진 I */
  finalizeLateral(seis, wind) { if (seis.I != null) wind.I = seis.I },
}
