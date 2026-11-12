// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { Header } from '../src/components/Header'
import { Drawers, type DrawerId } from '../src/components/Drawers'
import { Footer } from '../src/components/Footer'
import { S, notify } from '../src/state/store'
import { t } from '../src/i18n'
import { App } from '../src/App'
import { PlanCard } from '../src/components/PlanCard'
import * as RC from '../src/engine'

function SettingsHarness() {
  const [open, setOpen] = useState<DrawerId>(null)
  return (
    <>
      <Header
        onOpenMapi={() => setOpen('mapi')}
        onOpenLlm={() => setOpen('llm')}
      />
      <Drawers open={open} onClose={() => setOpen(null)} />
    </>
  )
}

beforeEach(() => {
  localStorage.clear()
  S.lang = 'ko'
  S.mapiKey = ''
  S.provKey = ''
  S.llm = false
  S.rnOpen = false
  S.panel = 'logP'
  S.preview = null
  S.pendingBuild = null
  notify()
  vi.stubGlobal(
    'fetch',
    vi.fn(() => {
      throw new Error('Network is forbidden in UI migration tests')
    }),
  )
})
afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

describe('UI migration behavior', () => {
  it('keeps the public settings IDs and restores focus after Escape', async () => {
    const user = userEvent.setup()
    render(<SettingsHarness />)
    const opener = document.getElementById('gearBtn')!
    await user.click(opener)
    expect(screen.getByRole('dialog').id).toBe('drawerMapi')
    expect(screen.getByLabelText('MAPI-KEY').getAttribute('type')).toBe(
      'password',
    )
    await user.keyboard('{Escape}')
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    expect(document.activeElement).toBe(opener)
    expect(fetch).not.toHaveBeenCalled()
  })

  it('uses the controlled LLM switch without saving credentials', async () => {
    const user = userEvent.setup()
    render(<SettingsHarness />)
    await user.click(document.getElementById('llmGear')!)
    expect(screen.getByRole('dialog').id).toBe('drawerLlm')
    await user.click(screen.getByRole('switch'))
    expect(S.llm).toBe(true)
    expect(localStorage.getItem('nx_mapiKey')).toBeNull()
    expect(fetch).not.toHaveBeenCalled()
  })

  it.each(['ko', 'en', 'zh-TW', 'zh-CN'] as const)(
    'renders localized settings in %s',
    lang => {
      S.lang = lang
      render(<Drawers open="mapi" onClose={() => {}} />)
      expect(
        screen.getByRole('dialog').getAttribute('aria-labelledby'),
      ).toBeTruthy()
      expect(screen.getByText(t('set_title'))).toBeTruthy()
      expect(screen.getByRole('button', { name: t('conn_test') })).toBeTruthy()
    },
  )

  it('keeps theme selection and opens the release dialog', async () => {
    const user = userEvent.setup()
    render(<Footer />)
    await user.click(screen.getByRole('button', { name: t('theme_s_light') }))
    expect(S.theme).toBe('light')
    expect(document.documentElement.dataset.theme).toBe('light')
    await user.click(screen.getByTitle(t('rn_open')))
    expect(await screen.findByRole('dialog')).toBeTruthy()
    fireEvent.keyDown(document, { key: 'Escape', code: 'Escape' })
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
  })

  it('keeps all panels mounted while tabs support keyboard navigation', async () => {
    const user = userEvent.setup()
    render(<App />)
    const tabs = screen.getAllByRole('tab')
    expect(tabs).toHaveLength(4)
    await user.click(screen.getByRole('tab', { name: t('tab_model') }))
    expect(S.panel).toBe('modelP')
    await user.keyboard('{End}')
    await waitFor(() => expect(S.panel).toBe('resP'))
    for (const id of ['logP', 'modelP', 'viewP', 'resP'])
      expect(document.getElementById(id)).toBeTruthy()
    expect(fetch).not.toHaveBeenCalled()
  })

  it('updates an editable plan and its preview without contacting Gen NX', async () => {
    S.pendingBuildId = 44
    const spec = {
      ...structuredClone(RC.DEFAULT_SPEC),
      buildings: 2,
      stories: 3,
      code: 'KR',
      core: { on: true, ix: 0, iy: 0 },
    }
    const { container } = render(
      <PlanCard
        msg={{
          id: 1,
          role: 'bot',
          kind: 'plan',
          intro: '',
          spec,
          editable: true,
          buildId: 44,
          epoch: S.buildEpoch,
        }}
      />,
    )
    const buildingCount = container.querySelector('input')!
    fireEvent.change(buildingCount, { target: { value: '1' } })
    await waitFor(() => expect(S.pendingBuild?.buildings).toBe(1))
    expect(S.preview).toBeTruthy()
    expect(fetch).not.toHaveBeenCalled()
  })
})
