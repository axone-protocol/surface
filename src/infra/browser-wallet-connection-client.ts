import type { WalletConnectionClient, WalletProviderId } from '../domain/wallet-connection'

type InjectedWalletProvider = {
  enable(chainId: string): Promise<void>
  getKey(chainId: string): Promise<{ bech32Address: string }>
}

type BrowserWalletWindow = Window &
  typeof globalThis & {
    keplr?: InjectedWalletProvider
    leap?: InjectedWalletProvider
  }

const providerIds: WalletProviderId[] = ['keplr', 'leap']

function walletWindow(): BrowserWalletWindow | undefined {
  return typeof window === 'undefined' ? undefined : (window as BrowserWalletWindow)
}

function providerFor(provider: WalletProviderId): InjectedWalletProvider | undefined {
  return walletWindow()?.[provider]
}

function unavailableProviderError(provider: WalletProviderId): Error {
  return new Error(`${provider} wallet is unavailable`)
}

export const browserWalletConnectionClient: WalletConnectionClient = {
  availableProviders() {
    return providerIds.filter((provider) => providerFor(provider))
  },

  async connect(provider, chainId) {
    const wallet = providerFor(provider)
    if (!wallet) {
      throw unavailableProviderError(provider)
    }

    await wallet.enable(chainId)
    const key = await wallet.getKey(chainId)
    return { address: key.bech32Address }
  },

  watchAccount(provider, chainId, onAccount, onError) {
    const eventName = provider === 'keplr' ? 'keplr_keystorechange' : 'leap_keystorechange'
    const refreshAccount = async () => {
      const wallet = providerFor(provider)
      if (!wallet) {
        onError()
        return
      }

      try {
        const key = await wallet.getKey(chainId)
        onAccount({ address: key.bech32Address })
      } catch {
        onError()
      }
    }

    window.addEventListener(eventName, refreshAccount)
    return () => window.removeEventListener(eventName, refreshAccount)
  },
}
