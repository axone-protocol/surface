export type WalletProviderId = 'keplr' | 'leap'

export type WalletAccount = {
  address: string
}

export interface WalletConnectionClient {
  availableProviders(): WalletProviderId[]
  connect(provider: WalletProviderId, chainId: string): Promise<WalletAccount>
  watchAccount(
    provider: WalletProviderId,
    chainId: string,
    onAccount: (account: WalletAccount) => void,
    onError: () => void,
  ): () => void
}
