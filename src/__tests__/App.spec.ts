import { mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises } from '@vue/test-utils'
import type { WalletConnectionClient } from '../domain/wallet-connection'

const walletClient = vi.hoisted(() => ({
  availableProviders: vi.fn<WalletConnectionClient['availableProviders']>(),
  connect: vi.fn<WalletConnectionClient['connect']>(),
  watchAccount: vi.fn<WalletConnectionClient['watchAccount']>(),
}))

vi.mock('../infra/browser-wallet-connection-client', () => ({
  browserWalletConnectionClient: walletClient,
}))

const writeClipboard = vi.fn<(address: string) => Promise<void>>()

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
  const fetchMock = vi
    .fn<(input: RequestInfo | URL) => Promise<Response>>()
    .mockResolvedValue(createResponse(createEmptyTxList()))
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: createMatchMediaMock(true),
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
  return fetchMock
}

const mountedApps = new Set<{ unmount: () => void }>()

function mountApp() {
  const wrapper = mount(App)
  mountedApps.add(wrapper)
  return wrapper
}

describe('App', () => {
  beforeEach(() => {
    localStorage.clear()
    walletClient.availableProviders.mockReset()
    walletClient.availableProviders.mockReturnValue([])
    walletClient.connect.mockReset()
    walletClient.watchAccount.mockReset()
    walletClient.watchAccount.mockReturnValue(vi.fn())
    writeClipboard.mockReset()
    writeClipboard.mockResolvedValue()
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText: writeClipboard },
    })
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
    expect(wrapper.get('.top-connect').text()).toBe('Connect▾')
    expect(wrapper.text()).toContain('axone-testnet')
    expect(wrapper.text()).toContain('CHAIN REGISTER')
    expect(wrapper.text()).not.toContain('RECORDS')
    expect(wrapper.text()).not.toContain('LAST SYNC')
    expect(wrapper.text()).not.toContain('Awaiting')

    await wrapper.get('.network-trigger').trigger('click')
    expect(wrapper.text()).toContain('AXONE-1')
    expect(wrapper.text()).toContain('soon')
    expect(wrapper.get('.network-trigger .menu-chevron').text()).toBe('▾')
    expect(wrapper.get('#network-menu .surface-dropdown-heading').text()).toBe('NETWORKS')
    expect(wrapper.find('#network-menu .surface-dropdown-footer').exists()).toBe(false)
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

  it('connects a wallet without discovering identities', async () => {
    const fetchMock = installSuccessfulBrowserMocks()
    walletClient.availableProviders.mockReturnValue(['keplr'])
    let resolveWallet!: (wallet: { address: string }) => void
    walletClient.connect.mockImplementation(
      () =>
        new Promise<{ address: string }>((resolve) => {
          resolveWallet = resolve
        }),
    )
    const walletAddress = 'axone1walletprivateaddress'

    const wrapper = mountApp()
    await flushPromises()
    await wrapper.get('.top-connect').trigger('click')
    await wrapper.get('.wallet-option').trigger('click')

    expect(wrapper.get('.top-connect').attributes('disabled')).toBeDefined()
    expect(wrapper.get('.top-connect').text()).toBe('Waiting for wallet...')

    resolveWallet({ address: walletAddress })
    await flushPromises()
    await wrapper.vm.$nextTick()

    expect(wrapper.get('.top-connect').text()).toBe('Connected▾')
    expect(wrapper.find('#wallet-menu').exists()).toBe(false)
    expect(
      fetchMock.mock.calls.some(([input]) => String(input).includes('/cosmwasm/wasm/v1/contract/')),
    ).toBe(false)

    await wrapper.get('.top-connect').trigger('click')
    expect(wrapper.get('.wallet-menu .surface-dropdown-heading').text()).toBe('WALLET')
    expect(wrapper.get('.wallet-provider').text()).toBe('Keplr')
    expect(wrapper.get('.wallet-address').text()).toBe('axone1wall...ddress')
    expect(wrapper.find('.wallet-menu .surface-dropdown-footer .wallet-disconnect').exists()).toBe(
      true,
    )
    const walletAddressCopy = wrapper.get('.wallet-address-copy')
    expect(walletAddressCopy.text()).toBe('⧉')
    expect(walletAddressCopy.attributes('title')).toBe(walletAddress)
    expect(walletAddressCopy.attributes('aria-label')).toBe(`Copy wallet address: ${walletAddress}`)

    vi.useFakeTimers()
    try {
      await walletAddressCopy.trigger('click')
      await Promise.resolve()
      await wrapper.vm.$nextTick()
      expect(writeClipboard).toHaveBeenCalledWith(walletAddress)
      expect(wrapper.find('.wallet-address-copy').exists()).toBe(false)
      expect(wrapper.get('.wallet-address-copied').attributes('role')).toBe('status')
      expect(wrapper.get('.wallet-address-copied-icon').text()).toBe('✓')
      expect(wrapper.get('.wallet-address-copied-label').text()).toBe('Copied')
      expect(wrapper.get('.sr-only[role="status"]').text()).toContain('Wallet address copied.')

      vi.advanceTimersByTime(1000)
      await wrapper.vm.$nextTick()

      writeClipboard.mockRejectedValueOnce(new Error('Clipboard unavailable'))
      await wrapper.get('.wallet-address-copy').trigger('click')
      await Promise.resolve()
      await wrapper.vm.$nextTick()
      expect(wrapper.get('.sr-only[role="status"]').text()).toContain(
        'Could not copy wallet address.',
      )
      expect(wrapper.find('#wallet-menu').exists()).toBe(true)
    } finally {
      vi.useRealTimers()
    }

    await wrapper.get('.wallet-disconnect').trigger('click')
    expect(wrapper.find('#wallet-menu').exists()).toBe(false)
    expect(wrapper.get('.top-connect').text()).toBe('Connect▾')
    expect(localStorage.getItem('axone.surface.wallet-provider')).toBeNull()
  })

  it('renders unavailable wallet options when no extension is installed', async () => {
    installSuccessfulBrowserMocks()
    const wrapper = mountApp()
    await flushPromises()
    await wrapper.vm.$nextTick()

    await wrapper.get('.top-connect').trigger('click')

    expect(wrapper.get('.wallet-menu .surface-dropdown-heading').text()).toBe('WALLETS')
    expect(wrapper.find('.wallet-menu .surface-dropdown-footer').exists()).toBe(false)
    const walletRegisterList = wrapper.get('.wallet-register-list')
    const walletRows = walletRegisterList.findAll('.wallet-option')
    expect(walletRows).toHaveLength(2)
    expect(walletRows[0]!.get('.wallet-option-name').text()).toBe('Keplr')
    expect(walletRows[0]!.get('.wallet-option-status').text()).toBe('unavailable')
    expect(walletRows[1]!.get('.wallet-option-name').text()).toBe('Leap')
    expect(walletRows[1]!.get('.wallet-option-status').text()).toBe('unavailable')
    expect(wrapper.text()).toContain('Install Keplr or Leap to connect a wallet.')
  })

  it('renders wallet provider availability without connecting', async () => {
    installSuccessfulBrowserMocks()
    walletClient.availableProviders.mockReturnValue(['keplr'])
    const wrapper = mountApp()
    await flushPromises()
    await wrapper.vm.$nextTick()

    await wrapper.get('.top-connect').trigger('click')

    const walletRows = wrapper.get('.wallet-register-list').findAll('.wallet-option')
    expect(walletRows[0]!.get('.wallet-option-name').text()).toBe('Keplr')
    expect(walletRows[0]!.get('.wallet-option-status').text()).toBe('available')
    expect(walletRows[1]!.get('.wallet-option-name').text()).toBe('Leap')
    expect(walletRows[1]!.get('.wallet-option-status').text()).toBe('unavailable')
    expect(walletClient.connect).not.toHaveBeenCalled()
  })
})
