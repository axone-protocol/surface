export type NetworkStatus = 'active' | 'coming-soon'

export type Network = {
  key: 'testnet' | 'mainnet'
  name: string
  chainId: string
  displayName: string
  bech32Prefix: string
  rest: string
  abstractRegistry: string | null
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
    abstractRegistry: 'axone1cjfrzdjtm8hp2jl24e7u2frm9xr8gy62uugl6yy08m5nw77ku6psh2p7yn',
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
    abstractRegistry: null,
    status: 'coming-soon',
    selectable: false,
  },
]
