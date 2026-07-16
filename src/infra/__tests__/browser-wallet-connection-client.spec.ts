import { afterEach, describe, expect, it, vi, type Mock } from 'vitest'

import { browserWalletConnectionClient } from '../browser-wallet-connection-client'

type InjectedWalletProvider = {
  enable: Mock<(chainId: string) => Promise<void>>
  getKey: Mock<(chainId: string) => Promise<{ bech32Address: string }>>
}

function wallet(address: string): InjectedWalletProvider {
  return {
    enable: vi.fn<(chainId: string) => Promise<void>>().mockResolvedValue(undefined),
    getKey: vi.fn<(chainId: string) => Promise<{ bech32Address: string }>>().mockResolvedValue({
      bech32Address: address,
    }),
  }
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('browserWalletConnectionClient', () => {
  it('discovers installed providers in stable order', () => {
    vi.stubGlobal('leap', wallet('axone1leap'))
    vi.stubGlobal('keplr', wallet('axone1keplr'))

    expect(browserWalletConnectionClient.availableProviders()).toEqual(['keplr', 'leap'])
  })

  it('enables a provider before reading its address', async () => {
    const keplr = wallet('axone1keplr')
    vi.stubGlobal('keplr', keplr)

    await expect(
      browserWalletConnectionClient.connect('keplr', 'axone-dendrite-2'),
    ).resolves.toEqual({
      address: 'axone1keplr',
    })
    expect(keplr.enable).toHaveBeenCalledWith('axone-dendrite-2')
    expect(keplr.getKey).toHaveBeenCalledWith('axone-dendrite-2')
    expect(keplr.enable.mock.invocationCallOrder[0]).toBeLessThan(
      keplr.getKey.mock.invocationCallOrder[0]!,
    )
  })

  it('rejects an absent requested provider', async () => {
    await expect(browserWalletConnectionClient.connect('leap', 'axone-dendrite-2')).rejects.toThrow(
      'leap wallet is unavailable',
    )
  })

  it.each([
    ['keplr', 'keplr_keystorechange'],
    ['leap', 'leap_keystorechange'],
  ] as const)('refreshes %s accounts and removes its %s listener', async (provider, eventName) => {
    const extension = wallet('axone1first')
    vi.stubGlobal(provider, extension)
    const onAccount = vi.fn<(account: { address: string }) => void>()
    const onError = vi.fn<() => void>()

    const cleanup = browserWalletConnectionClient.watchAccount(
      provider,
      'axone-dendrite-2',
      onAccount,
      onError,
    )
    extension.getKey.mockResolvedValue({ bech32Address: 'axone1second' })

    window.dispatchEvent(new Event(eventName))
    await vi.waitFor(() => expect(onAccount).toHaveBeenCalledWith({ address: 'axone1second' }))
    expect(onError).not.toHaveBeenCalled()

    cleanup()
    window.dispatchEvent(new Event(eventName))
    await Promise.resolve()
    expect(onAccount).toHaveBeenCalledTimes(1)
  })
})
