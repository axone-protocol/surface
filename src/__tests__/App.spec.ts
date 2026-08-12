import { mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises } from '@vue/test-utils'
import type { WalletConnectionClient } from '../domain/wallet-connection'
import type { IdentityRequestClient } from '../domain/identity-request-client'

const walletClient = vi.hoisted(() => ({
  availableProviders: vi.fn<WalletConnectionClient['availableProviders']>(),
  connect: vi.fn<WalletConnectionClient['connect']>(),
  watchAccount: vi.fn<WalletConnectionClient['watchAccount']>(),
}))

const identityRequestClient = vi.hoisted(() => ({
  submit: vi.fn<IdentityRequestClient['submit']>(),
}))

vi.mock('../infra/browser-wallet-connection-client', () => ({
  browserWalletConnectionClient: walletClient,
}))

vi.mock('../infra/browser-identity-request-client', () => ({
  browserIdentityRequestClient: identityRequestClient,
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
  let currentMatches = matches
  const changeListeners = new Set<(event: MediaQueryListEvent) => void>()
  const mediaQueryList = {
    get matches() {
      return currentMatches
    },
    media: '(prefers-reduced-motion: reduce)',
    onchange: null,
    addEventListener: vi.fn<(type: string, listener: (event: MediaQueryListEvent) => void) => void>(
      (type, listener) => {
        if (type === 'change') {
          changeListeners.add(listener)
        }
      },
    ),
    removeEventListener: vi.fn<
      (type: string, listener: (event: MediaQueryListEvent) => void) => void
    >((type, listener) => {
      if (type === 'change') {
        changeListeners.delete(listener)
      }
    }),
    dispatchEvent: vi.fn<() => boolean>(),
    addListener: vi.fn<() => void>(),
    removeListener: vi.fn<() => void>(),
  } as unknown as MediaQueryList
  const matchMedia = vi.fn<() => MediaQueryList>().mockReturnValue(mediaQueryList)

  return Object.assign(matchMedia, {
    dispatchChange(nextMatches: boolean) {
      currentMatches = nextMatches
      const event = { matches: currentMatches } as MediaQueryListEvent
      changeListeners.forEach((listener) => listener(event))
    },
  })
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
  const wrapper = mount(App, { attachTo: document.body })
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
    identityRequestClient.submit.mockReset()
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

    const camera = wrapper.get('.surface-camera')
    expect(camera.attributes('data-active-facet')).toBe('current')
    expect(wrapper.get('.surface-mark').text()).toBe('AXONE / SURFACE')
    expect(wrapper.find('.surface-facet-label').exists()).toBe(false)
    expect(wrapper.get('[data-facet="established"] .surface-act-stream').text()).toContain(
      'CHAIN REGISTER',
    )
    expect(wrapper.get('[data-facet="initiated"] .surface-docket h2').text()).toBe('DOCKET')
    const navigator = wrapper.get('.surface-navigator')
    expect(navigator.text()).toContain('ESTABLISHED')
    expect(navigator.text()).toContain('INITIATED')
    expect(navigator.get('.surface-navigator-thumb').classes()).toContain('is-centered')
    expect(wrapper.text()).not.toContain('RECORDS')
    expect(wrapper.text()).not.toContain('LAST SYNC')
    expect(wrapper.text()).not.toContain('Awaiting')

    expect(wrapper.get('.network-trigger').attributes('aria-expanded')).toBe('false')
    await wrapper.get('.network-trigger').trigger('click')
    expect(wrapper.text()).toContain('AXONE-1')
    expect(wrapper.text()).toContain('soon')
    expect(wrapper.get('.network-trigger .menu-chevron').text()).toBe('▾')
    expect(wrapper.get('.network-trigger').attributes('aria-expanded')).toBe('true')
    expect(wrapper.get('#network-menu .surface-dropdown-heading').text()).toBe('NETWORKS')
    expect(wrapper.find('#network-menu .surface-dropdown-footer').exists()).toBe(false)
    await wrapper.get('.network-trigger').trigger('click')
    expect(wrapper.get('.network-trigger').attributes('aria-expanded')).toBe('false')
    expect(wrapper.find('#network-menu').exists()).toBe(false)
  })

  it('moves the focused camera one bounded facet at a time', async () => {
    installSuccessfulBrowserMocks()
    Object.defineProperty(window, 'matchMedia', {
      configurable: true,
      writable: true,
      value: createMatchMediaMock(true),
    })

    const wrapper = mountApp()
    await flushPromises()
    const camera = wrapper.get('.surface-camera')
    await camera.trigger('focus')

    await camera.trigger('keydown', { key: 'ArrowLeft' })
    expect(camera.attributes('data-active-facet')).toBe('established')
    await camera.trigger('keydown', { key: 'ArrowLeft' })
    expect(camera.attributes('data-active-facet')).toBe('established')

    await camera.trigger('keydown', { key: 'ArrowRight' })
    expect(camera.attributes('data-active-facet')).toBe('current')
    await camera.trigger('keydown', { key: 'ArrowRight' })
    expect(camera.attributes('data-active-facet')).toBe('initiated')
    await camera.trigger('keydown', { key: 'ArrowRight' })
    expect(camera.attributes('data-active-facet')).toBe('initiated')
  })

  it('stops hero rotation when reduced motion becomes preferred', async () => {
    vi.useFakeTimers()
    try {
      const matchMedia = createMatchMediaMock(false)
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

      const initialActorLine = wrapper.get('.actor-line').text()
      const initialLawLabel = wrapper.get('.law-line').attributes('aria-label')

      vi.advanceTimersByTime(4600)
      await wrapper.vm.$nextTick()
      expect(wrapper.get('.actor-line').text()).not.toBe(initialActorLine)

      vi.advanceTimersByTime(600)
      await wrapper.vm.$nextTick()
      expect(wrapper.get('.law-line').attributes('aria-label')).not.toBe(initialLawLabel)

      matchMedia.dispatchChange(true)
      await wrapper.vm.$nextTick()
      const reducedActorLine = wrapper.get('.actor-line').text()
      const reducedLawLabel = wrapper.get('.law-line').attributes('aria-label')

      vi.advanceTimersByTime(10_400)
      await wrapper.vm.$nextTick()
      expect(wrapper.get('.actor-line').text()).toBe(reducedActorLine)
      expect(wrapper.get('.law-line').attributes('aria-label')).toBe(reducedLawLabel)
    } finally {
      vi.useRealTimers()
    }
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
    Object.defineProperty(window, 'matchMedia', {
      configurable: true,
      writable: true,
      value: createMatchMediaMock(false),
    })

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
    const walletTrigger = wrapper.get('.wallet-address-row .surface-reference-trigger')
    expect(walletTrigger.text()).toBe('axone1wall…ddress')
    expect(walletTrigger.attributes('aria-label')).toBe(`Inspect Wallet address: ${walletAddress}`)
    expect(wrapper.find('.wallet-menu .surface-dropdown-footer .wallet-disconnect').exists()).toBe(
      true,
    )

    await walletTrigger.trigger('click')
    const walletDialog = document.body.querySelector<HTMLElement>('.surface-reference-panel')!
    expect(walletDialog.textContent).toContain(walletAddress)
    const walletExplorerLink = walletDialog.querySelector<HTMLAnchorElement>('a')!
    expect(walletExplorerLink.textContent).toBe('OPEN IN EXPLORER')
    expect(walletExplorerLink.getAttribute('href')).toBe(
      `https://explorer.aknodes.com/AXONE-TESTNET/account/${walletAddress}`,
    )
    expect(walletExplorerLink.target).toBe('_blank')
    expect(walletExplorerLink.rel).toBe('noopener noreferrer')

    const copyButton = walletDialog.querySelector<HTMLButtonElement>(
      'button.surface-reference-action',
    )!
    copyButton.click()
    await Promise.resolve()
    expect(writeClipboard).toHaveBeenCalledWith(walletAddress)
    expect(wrapper.find('#wallet-menu').exists()).toBe(true)

    await wrapper.get('input[name="identity-name"]').setValue('Draft identity')
    await wrapper.get('textarea[name="identity-description"]').setValue('Draft description')
    await wrapper.get('.wallet-disconnect').trigger('click')
    expect(wrapper.find('#wallet-menu').exists()).toBe(false)
    expect(wrapper.get('.top-connect').text()).toBe('Connect▾')
    expect(localStorage.getItem('axone.surface.wallet-provider')).toBeNull()

    walletClient.connect.mockResolvedValue({ address: walletAddress })
    await wrapper.get('.identity-request-connect-action').trigger('click')
    await wrapper.get('.wallet-option').trigger('click')
    await flushPromises()
    expect((wrapper.get('input[name="identity-name"]').element as HTMLInputElement).value).toBe('')
    expect(
      (wrapper.get('textarea[name="identity-description"]').element as HTMLTextAreaElement).value,
    ).toBe('')
    expect(wrapper.get('.surface-docket').text()).toContain('CONTROLLER DISCONNECTED')
    expect(wrapper.get('.surface-docket').text()).toContain('CONTROLLER CONNECTED')
  })

  it('collects identity details and submits the request from the connected wallet', async () => {
    installSuccessfulBrowserMocks()
    Object.defineProperty(window, 'matchMedia', {
      configurable: true,
      writable: true,
      value: createMatchMediaMock(false),
    })
    walletClient.availableProviders.mockReturnValue(['keplr'])
    walletClient.connect.mockResolvedValue({ address: 'axone1identitycontroller' })
    identityRequestClient.submit.mockResolvedValue({
      transactionHash: 'CFD44056AF808268C51211C571557FC2B7080F755DB0FDA77E8FEC10D37D34AD',
    })

    const wrapper = mountApp()
    await flushPromises()

    const request = wrapper.get('.identity-request')
    expect(request.text()).toContain('IDENTITY REQUEST')
    expect(request.find('input[name="identity-name"]').exists()).toBe(false)
    await request.get('.identity-request-connect-action').trigger('click')
    await wrapper.get('.wallet-option').trigger('click')
    await flushPromises()

    expect(wrapper.get('input[name="identity-name"]').attributes('required')).toBeDefined()
    expect(
      wrapper.get('textarea[name="identity-description"]').attributes('required'),
    ).toBeDefined()
    expect(wrapper.get('.identity-request-submit').attributes('disabled')).toBeDefined()
    await wrapper.get('input[name="identity-name"]').setValue('Library steward')
    await wrapper
      .get('textarea[name="identity-description"]')
      .setValue('Stewardship identity for the public archive.')
    await wrapper.get('.identity-request-form').trigger('submit')
    await flushPromises()

    expect(identityRequestClient.submit).toHaveBeenCalledWith(
      expect.objectContaining({
        provider: 'keplr',
        sender: 'axone1identitycontroller',
        name: 'Library steward',
        description: 'Stewardship identity for the public archive.',
      }),
    )
    expect(request.text()).toContain('REQUEST ADDED TO DOCKET')
    expect(request.get('.identity-request-submit').text()).toBe('CREATE ANOTHER IDENTITY')
    const docket = wrapper.get('.surface-docket')
    expect(docket.text()).toContain('CURRENT ACTIVITY')
    expect(docket.text()).toContain('Library steward')
    expect(docket.text()).toContain('TRANSACTION SUBMITTED')
    const transactionTrigger = docket.get('[aria-label^="Inspect Transaction hash:"]')
    expect(transactionTrigger.text()).toBe('CFD44056…D37D34AD')
    expect(transactionTrigger.attributes('aria-label')).toContain(
      'Transaction hash: CFD44056AF808268C51211C571557FC2B7080F755DB0FDA77E8FEC10D37D34AD',
    )
    await transactionTrigger.trigger('click')
    const transactionPopover = document.body.querySelector<HTMLElement>('.surface-reference-panel')!
    expect(transactionPopover.querySelector('a')?.getAttribute('href')).toBe(
      'https://explorer.aknodes.com/AXONE-TESTNET/tx/CFD44056AF808268C51211C571557FC2B7080F755DB0FDA77E8FEC10D37D34AD',
    )
    expect((wrapper.get('input[name="identity-name"]').element as HTMLInputElement).value).toBe(
      'Library steward',
    )
    expect(
      (wrapper.get('textarea[name="identity-description"]').element as HTMLTextAreaElement).value,
    ).toBe('Stewardship identity for the public archive.')
    expect(wrapper.get('input[name="identity-name"]').attributes('disabled')).toBeDefined()

    await wrapper.get('.identity-request-submit').trigger('click')
    expect(wrapper.get('.identity-request-submit').text()).toBe('SIGN IDENTITY CREATION')
    expect((wrapper.get('input[name="identity-name"]').element as HTMLInputElement).value).toBe('')
    expect(
      (wrapper.get('textarea[name="identity-description"]').element as HTMLTextAreaElement).value,
    ).toBe('')
    expect(wrapper.get('input[name="identity-name"]').attributes('disabled')).toBeUndefined()

    await wrapper.get('input[name="identity-name"]').setValue('Second identity')
    await wrapper.get('textarea[name="identity-description"]').setValue('A second stewardship.')
    await wrapper.get('.identity-request-form').trigger('submit')
    await flushPromises()
    expect(identityRequestClient.submit).toHaveBeenLastCalledWith(
      expect.objectContaining({ name: 'Second identity', description: 'A second stewardship.' }),
    )
    expect(wrapper.findAll('.surface-docket-entry')).toHaveLength(2)
  })

  it('reports an included transaction failure in the docket without calling it submitted', async () => {
    const fetchMock = installSuccessfulBrowserMocks()
    fetchMock.mockImplementation(async (input) =>
      String(input).includes('/cosmos/tx/v1beta1/txs/FAILED-TX')
        ? createResponse({
            tx_response: {
              code: 5,
              height: '42',
              raw_log:
                'failed to execute message; message index: 0: description too short, must be at least 1 characters: instantiate wasm contract failed',
            },
          })
        : createResponse(createEmptyTxList()),
    )
    walletClient.availableProviders.mockReturnValue(['keplr'])
    walletClient.connect.mockResolvedValue({ address: 'axone1failedcontroller' })
    identityRequestClient.submit.mockResolvedValue({ transactionHash: 'FAILED-TX' })

    const wrapper = mountApp()
    await flushPromises()
    await wrapper.get('.identity-request-connect-action').trigger('click')
    await wrapper.get('.wallet-option').trigger('click')
    await flushPromises()
    await wrapper.get('input[name="identity-name"]').setValue('Failed identity')
    await wrapper.get('textarea[name="identity-description"]').setValue('Failure evidence.')
    await wrapper.get('.identity-request-form').trigger('submit')
    await flushPromises()

    const docketEntry = wrapper.get('.surface-docket-entry')
    expect(docketEntry.get('.surface-docket-status').text()).toBe('TRANSACTION FAILED')
    expect(docketEntry.text()).toContain('Description too short, must be at least 1 characters.')
    expect(docketEntry.text()).not.toContain('Awaiting network result')
    const blockTrigger = docketEntry.get('[aria-label="Inspect Block height: 42"]')
    await blockTrigger.trigger('click')
    expect(
      document.body
        .querySelector<HTMLElement>('[aria-label="Inspect Block height"]')
        ?.querySelector('a')
        ?.getAttribute('href'),
    ).toBe('https://explorer.aknodes.com/AXONE-TESTNET/block/42')
  })

  it('records a rejected signature without inventing transaction evidence', async () => {
    installSuccessfulBrowserMocks()
    walletClient.availableProviders.mockReturnValue(['keplr'])
    walletClient.connect.mockResolvedValue({ address: 'axone1rejectingcontroller' })
    identityRequestClient.submit.mockRejectedValue(new Error('Request rejected'))

    const wrapper = mountApp()
    await flushPromises()
    await wrapper.get('.identity-request-connect-action').trigger('click')
    await wrapper.get('.wallet-option').trigger('click')
    await flushPromises()
    await wrapper.get('input[name="identity-name"]').setValue('Rejected identity')
    await wrapper.get('textarea[name="identity-description"]').setValue('Rejected locally.')
    await wrapper.get('.identity-request-form').trigger('submit')
    await flushPromises()

    expect(wrapper.get('.identity-request-error').text()).toBe(
      'Request not submitted. Inspect the Docket for details.',
    )
    const docketEntry = wrapper.get('.surface-docket-entry')
    expect(docketEntry.get('.surface-docket-status').text()).toBe('SIGNATURE DECLINED')
    expect(docketEntry.find('.surface-docket-situation-facts').exists()).toBe(false)
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
