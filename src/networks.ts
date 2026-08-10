export type NetworkStatus = 'active' | 'coming-soon'

export type Network = {
  key: 'testnet' | 'mainnet'
  name: string
  chainId: string
  displayName: string
  bech32Prefix: string
  rest: string
  api: string | null
  explorer: string
  rpc: string | null
  feeDenom: string | null
  gasPrice: string | null
  identityRequestGasLimit: number | null
  abstractAccountCodeId: number | null
  abstractAccountAdmin: string | null
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
    api: 'https://api.axone.aknodes.net',
    explorer: 'https://explorer.aknodes.com/AXONE-TESTNET',
    rpc: 'https://rpc.axone.aknodes.net',
    feeDenom: 'uaxone',
    gasPrice: '0.025uaxone',
    identityRequestGasLimit: 400_000,
    abstractAccountCodeId: 5,
    abstractAccountAdmin: 'axone1aefmjg2n9mns6eqfvlc6vqfhs9t9aq95spsuxpqadkz4n9r8nkhqn5jf90',
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
    api: null,
    explorer: 'https://explorer.aknodes.com/AXONE-MAINNET',
    rpc: null,
    feeDenom: null,
    gasPrice: null,
    identityRequestGasLimit: null,
    abstractAccountCodeId: null,
    abstractAccountAdmin: null,
    abstractRegistry: null,
    status: 'coming-soon',
    selectable: false,
  },
]
