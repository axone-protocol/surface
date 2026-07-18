import { mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises } from '@vue/test-utils'
import type { WalletConnectionClient } from '../domain/wallet-connection'
import type { AbstractAccountClient, AbstractAccountIdentity } from '../domain/abstract-account'

const walletClient = vi.hoisted(() => ({
  availableProviders: vi.fn<WalletConnectionClient['availableProviders']>(),
  connect: vi.fn<WalletConnectionClient['connect']>(),
  watchAccount: vi.fn<WalletConnectionClient['watchAccount']>(),
}))

const abstractAccountClient = vi.hoisted(() => ({
  discover: vi.fn<AbstractAccountClient['discover']>(),
}))

vi.mock('../infra/browser-wallet-connection-client', () => ({
  browserWalletConnectionClient: walletClient,
}))
vi.mock('../infra/abstract-account-client', () => ({
  browserAbstractAccountClient: abstractAccountClient,
}))

import App from '../App.vue'

function createCanvasContextMock() {
  return {
    setTransform: vi.fn<() => void>(),
    fillRect: vi.fn<() => void>(),
    clearRect: vi.fn<() => void>(),
    rect: vi.fn<() => void>(),
    save: vi.fn<() => void>(),
    restore: vi.fn<() => void>(),
    beginPath: vi.fn<() => void>(),
    moveTo: vi.fn<() => void>(),
    lineTo: vi.fn<() => void>(),
    stroke: vi.fn<() => void>(),
    arc: vi.fn<() => void>(),
    fill: vi.fn<() => void>(),
  } as unknown as CanvasRenderingContext2D
}

function createMatchMediaMock(matches: boolean) {
  return vi.fn<() => MediaQueryList>().mockImplementation(() => ({
    matches,
    media: '(prefers-reduced-motion: reduce)',
    onchange: null,
    addEventListener: vi.fn<() => void>(),
    removeEventListener: vi.fn<() => void>(),
    dispatchEvent: vi.fn<() => boolean>(),
    addListener: vi.fn<() => void>(),
    removeListener: vi.fn<() => void>(),
  }))
}

function createEmptyTxList() {
  return { tx_responses: [] }
}

function createResponse(body: unknown, ok = true, status = 200): Response {
  return {
    ok,
    status,
    json: async () => body,
  } as unknown as Response
}

function installSuccessfulBrowserMocks() {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: createMatchMediaMock(true),
  })
  Object.defineProperty(window, 'fetch', {
    writable: true,
    value: vi.fn<() => Promise<Response>>().mockResolvedValue(createResponse(createEmptyTxList())),
  })
  Object.defineProperty(HTMLCanvasElement.prototype, 'getContext', {
    writable: true,
    value: vi
      .fn<() => CanvasRenderingContext2D | null>()
      .mockReturnValue(createCanvasContextMock()),
  })
}

const mountedApps = new Set<{ unmount: () => void }>()

function mountApp() {
  const wrapper = mount(App)
  mountedApps.add(wrapper)
  return wrapper
}

async function waitForIdentityReveal() {
  await new Promise((resolve) => window.setTimeout(resolve, 900))
  await flushPromises()
}

describe('App', () => {
  beforeEach(() => {
    localStorage.clear()
    walletClient.availableProviders.mockReset()
    walletClient.availableProviders.mockReturnValue([])
    walletClient.connect.mockReset()
    walletClient.watchAccount.mockReset()
    walletClient.watchAccount.mockReturnValue(vi.fn())
    abstractAccountClient.discover.mockReset()
  })

  afterEach(() => {
    for (const wrapper of mountedApps) {
      wrapper.unmount()
    }
    mountedApps.clear()
    localStorage.clear()
  })

  it('renders the live act homepage shell', async () => {
    const matchMedia = createMatchMediaMock(true)

    const fetchMock = vi
      .fn<() => Promise<Response>>()
      .mockImplementation(async () => createResponse(createEmptyTxList()))

    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: matchMedia,
    })
    Object.defineProperty(window, 'fetch', {
      writable: true,
      value: fetchMock,
    })
    Object.defineProperty(HTMLCanvasElement.prototype, 'getContext', {
      writable: true,
      value: vi
        .fn<() => CanvasRenderingContext2D | null>()
        .mockReturnValue(createCanvasContextMock()),
    })

    const wrapper = mountApp()
    await flushPromises()
    await wrapper.vm.$nextTick()

    expect(wrapper.text()).toContain('AXONE / SURFACE')
    expect(wrapper.text()).toContain('GOVERN ACT')
    expect(wrapper.text()).toContain('Connect')
    expect(wrapper.text()).toContain('axone-testnet')
    expect(wrapper.text()).toContain('CHAIN REGISTER')
    expect(wrapper.text()).toContain('Enter the surface')
    expect(wrapper.text()).not.toContain('RECORDS')
    expect(wrapper.text()).not.toContain('LAST SYNC')
    expect(wrapper.text()).not.toContain('Awaiting')

    await wrapper.get('.network-trigger').trigger('click')
    expect(wrapper.text()).toContain('AXONE-1')
    expect(wrapper.text()).toContain('soon')
  })

  it('does not show register metadata when the chain request fails', async () => {
    const matchMedia = createMatchMediaMock(true)

    const fetchMock = vi.fn<() => Promise<Response>>().mockRejectedValue(new Error('offline'))

    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: matchMedia,
    })
    Object.defineProperty(window, 'fetch', {
      writable: true,
      value: fetchMock,
    })
    Object.defineProperty(HTMLCanvasElement.prototype, 'getContext', {
      writable: true,
      value: vi
        .fn<() => CanvasRenderingContext2D | null>()
        .mockReturnValue(createCanvasContextMock()),
    })

    const wrapper = mountApp()
    await flushPromises()
    await wrapper.vm.$nextTick()

    expect(wrapper.text()).not.toContain('RECORDS')
    expect(wrapper.text()).not.toContain('LAST SYNC')
  })
  it('switches between discovered identities without rendering the wallet address', async () => {
    installSuccessfulBrowserMocks()
    walletClient.availableProviders.mockReturnValue(['keplr'])
    const walletAddress = 'axone1walletprivateaddress'
    walletClient.connect.mockResolvedValue({ address: walletAddress })
    const firstDid =
      'did:pkh:cosmos:axone-dendrite-2:cosmos1lfcc2yt3gmd3xspw5yxsl3r9qyuumuya6hur2gnejgmafyrapmkqpk2un3'
    const secondDid = 'did:pkh:cosmos:axone-dendrite-2:cosmos1a0u12345678901234567890pk2un3'
    abstractAccountClient.discover.mockResolvedValue([
      {
        address: 'axone1abstractfirst',
        did: firstDid,
        label: 'Anonymous',
      },
      {
        address: 'axone1abstractsecond',
        did: secondDid,
        label: 'Anonymous',
      },
    ])

    const wrapper = mountApp()
    await flushPromises()
    await wrapper.get('.top-connect').trigger('click')
    await wrapper.get('#wallet-menu button').trigger('click')
    await flushPromises()
    await wrapper.vm.$nextTick()
    await waitForIdentityReveal()

    expect(wrapper.get('.top-connect').text()).toContain('Anonymous')
    expect(wrapper.text()).not.toContain(walletAddress)

    await wrapper.get('.top-connect').trigger('click')
    expect(wrapper.get('.identity-current-row').text()).toContain('Anonymous')
    expect(wrapper.text()).toContain('Other identities')
    expect(wrapper.text()).not.toContain('Current identity')
    const currentDid = wrapper.get('.identity-current-row .identity-did')
    const alternateDid = wrapper.get('.identity-choice .identity-did')
    expect(currentDid.text()).toBe('did:pkh:…cosmos1lfc…pk2un3')
    expect(alternateDid.text()).toBe('did:pkh:…cosmos1a0u…pk2un3')
    expect(currentDid.attributes('title')).toBe(firstDid)
    expect(alternateDid.attributes('title')).toBe(secondDid)
    await wrapper.get('.identity-choice').trigger('click')
    expect(wrapper.get('.top-connect').text()).toContain('Anonymous')
    await wrapper.get('.top-connect').trigger('click')
    expect(wrapper.get('.identity-current-row .identity-did').text()).toBe(
      'did:pkh:…cosmos1a0u…pk2un3',
    )
    expect(wrapper.get('.identity-current-row .identity-did').attributes('title')).toBe(secondDid)
  })

  it('reveals the discovered identity count before returning to the active identity label', async () => {
    vi.useFakeTimers()
    try {
      installSuccessfulBrowserMocks()
      walletClient.availableProviders.mockReturnValue(['keplr'])
      walletClient.connect.mockResolvedValue({ address: 'axone1wallet' })
      let resolveDiscovery!: (value: AbstractAccountIdentity[]) => void
      abstractAccountClient.discover.mockReturnValue(
        new Promise<AbstractAccountIdentity[]>((resolve) => {
          resolveDiscovery = resolve
        }),
      )

      const wrapper = mountApp()
      await flushPromises()
      await wrapper.get('.top-connect').trigger('click')
      await wrapper.get('#wallet-menu button').trigger('click')
      await flushPromises()

      expect(wrapper.get('.top-connect').text()).toContain('Resolving identities')
      expect(wrapper.find('.identity-status-label').exists()).toBe(true)
      expect(wrapper.find('.identity-resolution-dot.is-pending').exists()).toBe(true)
      expect(wrapper.get('.top-connect').text()).not.toContain('identities found')

      resolveDiscovery([
        {
          address: 'axone1abstractfirst',
          did: 'did:pkh:cosmos:axone-dendrite-2:cosmos1identityone',
          label: 'Anonymous',
        },
        {
          address: 'axone1abstractsecond',
          did: 'did:pkh:cosmos:axone-dendrite-2:cosmos1identitytwo',
          label: 'Anonymous',
        },
      ])
      await flushPromises()
      await wrapper.vm.$nextTick()

      expect(wrapper.get('.top-connect').text()).toContain('2 identities found')
      expect(wrapper.find('.identity-resolution-dot.is-revealed').exists()).toBe(true)

      await vi.advanceTimersByTimeAsync(900)
      await wrapper.vm.$nextTick()

      expect(wrapper.get('.top-connect').text()).toContain('Anonymous')
      expect(wrapper.find('.identity-resolution-dot').exists()).toBe(false)
    } finally {
      vi.useRealTimers()
    }
  })
  it('restores the discovered identity after remounting with the remembered wallet', async () => {
    installSuccessfulBrowserMocks()
    walletClient.availableProviders.mockReturnValue(['keplr'])
    walletClient.connect.mockResolvedValue({ address: 'axone1wallet' })
    abstractAccountClient.discover.mockResolvedValue([
      {
        address: 'axone1abstract',
        did: 'did:pkh:cosmos:axone-dendrite-2:cosmos1identity',
        label: 'Anonymous',
      },
    ])

    const firstWrapper = mountApp()
    await flushPromises()
    await firstWrapper.get('.top-connect').trigger('click')
    await firstWrapper.get('#wallet-menu button').trigger('click')
    await waitForIdentityReveal()
    await flushPromises()
    expect(firstWrapper.get('.top-connect').text()).toContain('Anonymous')
    expect(localStorage.getItem('axone.surface.wallet-provider')).toBe('keplr')

    firstWrapper.unmount()
    mountedApps.delete(firstWrapper)

    const secondWrapper = mountApp()
    await flushPromises()
    await secondWrapper.vm.$nextTick()
    await waitForIdentityReveal()

    expect(walletClient.connect).toHaveBeenCalledTimes(2)
    expect(secondWrapper.get('.top-connect').text()).toContain('Anonymous')
  })

  it('renders the verified empty identity state as noninteractive informational text', async () => {
    installSuccessfulBrowserMocks()
    walletClient.availableProviders.mockReturnValue(['keplr'])
    walletClient.connect.mockResolvedValue({ address: 'axone1wallet' })
    abstractAccountClient.discover.mockResolvedValue([])
    const wrapper = mountApp()
    await flushPromises()
    await wrapper.get('.top-connect').trigger('click')
    await wrapper.get('#wallet-menu button').trigger('click')
    await flushPromises()
    expect(wrapper.get('.top-connect').text()).toContain('0 identities found')
    await waitForIdentityReveal()

    expect(wrapper.get('.top-connect').text()).toContain('No identity')
    await wrapper.get('.top-connect').trigger('click')
    expect(wrapper.text()).toContain('This wallet does not control any identity.')
    expect(wrapper.text()).toContain('Create identity…')
    expect(wrapper.text()).toContain('Import existing identity…')
    expect(wrapper.findAll('.identity-management-affordance')).toHaveLength(2)
  })

  it('renders discovery failure as unavailable rather than no identity', async () => {
    installSuccessfulBrowserMocks()
    walletClient.availableProviders.mockReturnValue(['keplr'])
    walletClient.connect.mockResolvedValue({ address: 'axone1wallet' })
    abstractAccountClient.discover.mockRejectedValue(new Error('Registry unavailable'))
    const wrapper = mountApp()
    await flushPromises()
    await wrapper.get('.top-connect').trigger('click')
    await wrapper.get('#wallet-menu button').trigger('click')
    await flushPromises()

    expect(wrapper.get('.top-connect').text()).toContain('Identity unavailable')
    await wrapper.get('.top-connect').trigger('click')
    expect(wrapper.text()).toContain('Registry unavailable')
    expect(wrapper.text()).not.toContain('This wallet does not control any identity.')
  })

  it('shows unavailable wallet options when no extension is installed', async () => {
    installSuccessfulBrowserMocks()
    const wrapper = mountApp()
    await flushPromises()
    await wrapper.vm.$nextTick()

    await wrapper.get('.top-connect').trigger('click')

    expect(wrapper.text()).toContain('Keplr unavailable')
    expect(wrapper.text()).toContain('Leap unavailable')
    expect(wrapper.text()).toContain('Install Keplr or Leap to connect an Axone identity.')
  })
})
