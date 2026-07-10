export type NetworkStatus = 'active' | 'coming-soon'

export type Network = {
  key: 'testnet' | 'mainnet'
  name: string
  chainId: string
  displayName: string
  bech32Prefix: string
  rest: string
  status: NetworkStatus
  selectable: boolean
}

export const networks: Network[] = [
  {
    key: 'testnet',
    name: 'axone-testnet',
    chainId: 'axone-dendrite-2',
    displayName: 'axone-testnet',
    bech32Prefix: 'axone',
    rest: 'https://api.axone.aknodes.net/cosmos/base/tendermint/v1beta1/blocks/latest',
    status: 'active',
    selectable: true,
  },
  {
    key: 'mainnet',
    name: 'axone-mainnet',
    chainId: 'axone-1',
    displayName: 'axone-mainnet',
    bech32Prefix: 'axone',
    rest: 'https://rpc.axone.aknodes.net',
    status: 'coming-soon',
    selectable: false,
  },
]
