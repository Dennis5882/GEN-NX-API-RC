/* Story QA·배근·DXF는 기존 JS 출력으로 기준을 만든 뒤 TS 이전 중 갱신하지 않는다. */
import { describe, expect, it } from 'vitest'
import * as RC from '../src/engine/index.ts'

const forces = [
  { story: 1, name: '2F', h: 3000, F: 10 },
  { story: 2, name: 'RF', h: 6000, F: 20 },
]
const profile = {
  PROFILE: {
    X_DIR: [
      {
        STORY_NAME: '2F',
        STORY_LEVEL: '3000',
        STORY_SHEAR: '20000',
        OVERTURN_MOMENT: '60000000',
        ACCIDENT_TORSION: '400',
        STORY_WEIGHT: '100',
      },
      {
        STORY_NAME: 'RF',
        STORY_LEVEL: '6000',
        STORY_SHEAR: '0',
        OVERTURN_MOMENT: '0',
        ACCIDENT_TORSION: '-',
        STORY_WEIGHT: '120',
      },
      {
        STORY_NAME: 'G.L.',
        STORY_LEVEL: '0',
        STORY_SHEAR: '30000',
        OVERTURN_MOMENT: '150000000',
        STORY_WEIGHT: '-',
      },
    ],
  },
}

describe('engine golden — Story QA', () => {
  it('self profile and direction fallback', () => {
    expect({
      self: RC.sseisSelfProfile(forces),
      gen: RC.sseisGenRows(profile, 'Y'),
    }).toMatchSnapshot()
  })
  it('shear, overturning moment and base comparison', () => {
    expect(
      RC.sseisDiff(RC.sseisSelfProfile(forces), profile, 'X', 0.05),
    ).toMatchSnapshot()
  })
  it('wind pressure with ground, roof and missing story', () => {
    expect(
      RC.swindSelfPressures(
        [...forces, { name: 'missing', h: 9000, F: 5 }],
        [
          { name: 'G.L.', level: 0, width: 12000 },
          { name: '2F', level: 3000, width: 12000 },
          { name: 'RF', level: 6000, width: 12000 },
        ],
      ),
    ).toMatchSnapshot()
  })
  it('SSEIS weights translated and matched by elevation', () => {
    const prop = RC.sseisProfileToStoryProp(profile)
    expect({
      prop,
      diff: RC.storyWeightDiff(
        [
          { level: 3000, weight: 100 },
          { level: 6000, weight: 115 },
        ],
        prop,
        0.05,
      ),
    }).toMatchSnapshot()
  })
})

const material = { fc: 28, fy: 420, fyt: 280, cover: 40 }
const beamDemand = { MuPos: 160e6, MuNeg: 220e6, Vu: 180000 }
const columnDemand = { Pu: 1400000, Mux: 120e6, Muy: 60e6 }

describe('engine golden — RC design', () => {
  it('beam flexure and shear reinforcement', () => {
    expect(
      RC.rcBeamDesign(beamDemand, { b: 300, h: 600 }, material),
    ).toMatchSnapshot()
  })
  it('column biaxial reinforcement and interaction curves', () => {
    expect(
      RC.rcColumnDesign(columnDemand, { b: 600, h: 600 }, material),
    ).toMatchSnapshot()
  })
  it('section limits and bar selection edge cases', () => {
    expect({
      zero: RC.flexAs(0, 300, 500, 28, 420),
      over: RC.flexAs(1e15, 300, 500, 28, 420),
      bars: RC.pickBars(0),
      shear: RC.stirrupSpacing(1e9, 300, 500, 28, 280, 226),
      column: RC.pickColBars(20000),
    }).toMatchSnapshot()
  })
})

describe('engine golden — DXF', () => {
  it('entities, layers, text encoding and alignment', () => {
    const doc = RC.DxfDoc(RC.DRAW_PROFILE.tw)
    doc
      .line(0, 0, 100, 100, 'S-OUTLINE')
      .rect(10, 20, 300, 600)
      .circle(50, 50, 10)
      .text(0, 0, 150, '柱 C1', 'S-TEXT', { align: 'center', rot: 90 })
    expect(doc.toString()).toMatchSnapshot()
  })
  it('complete drawing set with deterministic title block and group differences', () => {
    const beam = RC.rcBeamDesign(beamDemand, { b: 300, h: 600 }, material)
    const col = RC.rcColumnDesign(columnDemand, { b: 600, h: 600 }, material)
    const group = {
      role: 'TYPICAL',
      from: 1,
      to: 2,
      beam: { sec: { B: 300, H: 600 }, d: beam, ...beamDemand },
      col: { sec: { B: 600, H: 600 }, d: col },
    }
    expect(
      RC.drawingSetDXF(
        {
          spec: {
            ...RC.DEFAULT_SPEC,
            buildings: 1,
            bayX: 1,
            bayY: 1,
            stories: 3,
          },
          groups: [group, { ...group, role: 'ROOF', from: 3, to: 3 }],
          colB: 600,
          repSpan: 7000,
          storyH: 3200,
          date: '2026-11-11',
        },
        { title: 'RC golden', sheet: 'S-01' },
      ),
    ).toMatchSnapshot()
  })
  it('spectrum period and basin branches', () => {
    expect([
      RC.twDesignSpectrum({ SDS: 0.6, SD1: 0.35, TL: 5 }),
      RC.twDesignSpectrum({ SDS: 0.6, T0: 1.6 }),
    ]).toMatchSnapshot()
  })
})
