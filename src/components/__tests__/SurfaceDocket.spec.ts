import { mount } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'

import type { IdentityDocketEntry, SurfaceDocketEntry } from '../../domain/surface-docket'
import SurfaceDocket from '../SurfaceDocket.vue'

const transactionHash = 'CFD44056AF808268C51211C571557FC2B7080F755DB0FDA77E8FEC10D37D34AD'

function identityEntry(overrides: Partial<IdentityDocketEntry> = {}): IdentityDocketEntry {
  return {
    id: 'event-1',
    type: 'identity-creation',
    occurredAt: '2026-08-12T12:32:00Z',
    name: 'forge-01',
    description: 'Operational identity for the forge.',
    controller: 'axone1identitycontroller',
    provider: 'keplr',
    networkKey: 'testnet',
    chainId: 'axone-dendrite-2',
    explorer: 'https://explorer.example/AXONE-TESTNET',
    situation: 'transaction-submitted',
    transactionHash,
    ...overrides,
  }
}

describe('SurfaceDocket', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    document.body.innerHTML = ''
  })

  it('renders an inspectable local request and compact session context', async () => {
    vi.stubGlobal(
      'matchMedia',
      vi.fn().mockReturnValue({
        matches: false,
        addEventListener: vi.fn<() => void>(),
        removeEventListener: vi.fn<() => void>(),
      }),
    )
    const entries: SurfaceDocketEntry[] = [
      identityEntry(),
      {
        id: 'session-1',
        type: 'session',
        occurredAt: '2026-08-12T12:30:00Z',
        event: 'connected',
        provider: 'keplr',
        controller: 'axone1identitycontroller',
        chainId: 'axone-dendrite-2',
        explorer: 'https://explorer.example/AXONE-TESTNET',
      },
    ]
    const wrapper = mount(SurfaceDocket, { attachTo: document.body, props: { entries } })

    expect(wrapper.text()).toContain('CURRENT ACTIVITY')
    expect(wrapper.text()).toContain('forge-01')
    expect(wrapper.text()).toContain('2026-08-12 12:32 UTC')
    expect(wrapper.text()).toContain('TRANSACTION SUBMITTED')
    expect(wrapper.text()).toContain('TIMEACTIVITYSITUATION')
    expect(wrapper.get('.surface-docket-kind').text()).toBe('IDENTITY CREATION')
    expect(wrapper.text()).toContain('CONTROLLER CONNECTED')
    expect(wrapper.text()).toContain('axone-dendrite-2')
    expect(wrapper.get('[aria-label^="Inspect Transaction hash:"]').text()).toBe(
      'CFD44056…D37D34AD',
    )
    const networkTrigger = wrapper.get('[aria-label="Inspect Network ID: axone-dendrite-2"]')
    await networkTrigger.trigger('click')
    expect(
      document.body
        .querySelector<HTMLElement>('.surface-reference-panel')
        ?.querySelector('a')
        ?.getAttribute('href'),
    ).toBe('https://explorer.example/AXONE-TESTNET')
    wrapper.unmount()
  })

  it('shows a concise failure with inspectable chain detail', () => {
    const error =
      'failed to execute message; message index: 0: description too short, must be at least 1 characters: instantiate wasm contract failed'
    const wrapper = mount(SurfaceDocket, {
      props: { entries: [identityEntry({ situation: 'transaction-failed', error })] },
    })

    expect(wrapper.get('.surface-docket-status').text()).toBe('TRANSACTION FAILED')
    expect(wrapper.get('.surface-docket-situation').text()).toContain(
      'Description too short, must be at least 1 characters.',
    )
    expect(wrapper.get('.surface-docket-error-detail code').text()).toBe(error)
  })

  it('keeps rejection distinct from transaction failure', () => {
    const wrapper = mount(SurfaceDocket, {
      props: {
        entries: [
          identityEntry({
            situation: 'signature-declined',
            transactionHash: undefined,
            error: 'Request rejected',
          }),
        ],
      },
    })

    expect(wrapper.get('.surface-docket-status').text()).toBe('SIGNATURE DECLINED')
    expect(wrapper.text()).toContain('NO TRANSACTION SUBMITTED')
    expect(wrapper.find('.surface-docket-situation-facts').exists()).toBe(false)
  })
})
