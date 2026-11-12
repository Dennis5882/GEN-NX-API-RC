/* B0: 현재 JS 엔진 출력을 그대로 고정한다. TS 이전 중에는 스냅샷을 갱신하지 않는다.
   이 테스트는 동작 보존용이며, 규범 식 검증은 기존 TW/KR 독립 계산 테스트가 담당한다. */
import { describe, expect, it } from 'vitest'
import * as RC from '../src/engine/index.ts'

const spec = overrides => ({
  ...structuredClone(RC.DEFAULT_SPEC),
  buildings: 1,
  bayX: 2,
  bayY: 2,
  stories: 2,
  connectFloor: 0,
  ...overrides,
})

const fixtures = [
  { name: 'single tower', input: spec({ stories: 3, podium: 1 }) },
  {
    name: 'connected twin towers',
    input: spec({ buildings: 2, connectFloor: 2, diaphragmMethod: 'none' }),
  },
  {
    name: 'mirrored cores',
    input: spec({
      buildings: 2,
      bayX: 3,
      core: {
        on: true,
        thick: 250,
        ix: 0,
        iy: 0,
        nx: 1,
        ny: 2,
        layout: 'mirror',
      },
      // 저장된 벽이 낡아도 resolveWalls는 현재 core에서 다시 생성해야 한다.
      walls: [
        { kind: 'wall', dir: 'X', ix: 0, iy: 0, from: 1, to: 99, thick: 999 },
      ],
    }),
  },
  {
    name: 'bearing walls with overlapping core',
    input: spec({
      bayX: 4,
      core: { on: true, thick: 200, ix: 1, iy: 0 },
      bearing: { on: true, thick: 200 },
    }),
  },
  {
    name: 'variable spans and section palettes',
    input: spec({
      spanX: [4200, 6300],
      spanY: [5100, 7200],
      stories: 3,
      diaphragmMethod: 'rigd',
      palette: {
        cols: [
          { name: 'C600x600', H: 600, B: 600 },
          { name: 'C800x500', H: 800, B: 500 },
        ],
        beams: [
          { name: 'B400x600', H: 600, B: 400 },
          { name: 'B300x500', H: 500, B: 300 },
        ],
        mats: ['C280', 'C350'],
      },
      groups: [
        {
          role: 'BASEMENT',
          from: 1,
          to: 1,
          h: 4200,
          use: 'Commercial',
          col: 'C800x500',
          beam: 'B400x600',
          mat: 'C350',
          dia: false,
        },
        {
          role: 'TYPICAL',
          from: 2,
          to: 2,
          h: 3100,
          use: 'Office',
          col: 'C600x600',
          beam: 'B300x500',
          mat: 'C280',
        },
        { role: 'ROOF', from: 3, to: 3, h: 2800, use: 'Roof' },
      ],
    }),
  },
  {
    name: 'per-tower core positions and skipped tower',
    input: spec({
      buildings: 3,
      core: {
        on: true,
        nx: 9,
        ny: 1,
        ix: -2,
        iy: 99,
        layout: 'each',
        pos: [null, { ix: 1, iy: 0 }],
        skip: [2],
      },
    }),
  },
  {
    name: 'explicit legacy walls without automatic layout',
    input: spec({
      walls: [
        {
          kind: 'wall',
          dir: 'X',
          ix: 0,
          iy: 1,
          bays: 2,
          from: 2,
          to: 2,
          thick: 300,
        },
      ],
    }),
  },
]

describe.each(fixtures)('engine golden — $name', ({ input }) => {
  // 액션과 같은 순서로 벽을 해석한 뒤 프레임·Story Data를 만든다.
  const resolvedSpec = () => {
    const fresh = structuredClone(input)
    return { ...fresh, walls: RC.resolveWalls(fresh) }
  }

  it('buildFrame', () => {
    expect(RC.buildFrame(resolvedSpec())).toMatchSnapshot()
  })
  it('specSections', () => {
    expect(RC.specSections(structuredClone(input))).toMatchSnapshot()
  })
  it('deriveFloorGroups', () => {
    expect(RC.deriveFloorGroups(structuredClone(input))).toMatchSnapshot()
  })
  it('coreLayout', () => {
    expect(RC.coreLayout(input, input.core)).toMatchSnapshot()
  })
  it('resolveWalls', () => {
    expect(RC.resolveWalls(structuredClone(input))).toMatchSnapshot()
  })
  it('buildStoryData', () => {
    const current = resolvedSpec()
    expect(RC.buildStoryData(current, RC.buildFrame(current))).toMatchSnapshot()
  })
})

describe('engine golden — dynamic payloads', () => {
  it.each([0, 1, 12, 3.7])('eigvPayload(%s)', modes => {
    expect(RC.eigvPayload(modes)).toMatchSnapshot()
  })
  it.each([
    ['RSX', 'XY', 'TW-spectrum', undefined],
    ['RSY', 'XY', 'USER-spectrum', 0.2],
    ['RSZ', 'Z', 'vertical-spectrum', 0],
  ])('splcPayload(%s)', (name, dir, spectrum, scale) => {
    expect(RC.splcPayload(name, dir, spectrum, scale)).toMatchSnapshot()
  })
  it.each([
    {
      name: 'nested eigenvalue table',
      response: {
        EIGENVALUEMODE: {
          SUB_TABLES: [
            {
              'EIGENVALUE ANALYSIS': {
                HEAD: ['Mode', 'Period(sec)', 'Cycle(sec^-1)'],
                DATA: [
                  ['2', '0.8', '1.25'],
                  ['1', '2.4', '0.4167'],
                  ['3', '0', '0'],
                  ['4', '-', '-'],
                ],
              },
            },
          ],
        },
      },
    },
    {
      name: 'period-only table',
      response: { HEAD: ['Period'], DATA: [['0.5'], ['1.5'], ['-1']] },
    },
    {
      name: 'missing period table',
      response: {
        PARTICIPATIONVECTORMODE: { HEAD: ['Mode', 'UX'], DATA: [['1', '0.8']] },
      },
    },
    { name: 'empty response', response: null },
  ])('pickModalPeriods: $name', ({ response }) => {
    expect(RC.pickModalPeriods(response)).toMatchSnapshot()
  })
})
