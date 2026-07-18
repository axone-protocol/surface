import { bech32 } from 'bech32'

import type { Network } from '../networks'

export type AbstractAccountIdentity = {
  address: string
  did: string
  label: 'Anonymous'
}

export interface AbstractAccountClient {
  discover(
    walletAddress: string,
    network: Network,
    signal?: AbortSignal,
  ): Promise<AbstractAccountIdentity[]>
}

export function toCanonicalDid(address: string, chainId: string): string {
  const decoded = bech32.decode(address)
  const cosmosAddress = bech32.encode('cosmos', decoded.words)

  return `did:pkh:cosmos:${chainId}:${cosmosAddress}`
}

export function compactCanonicalDid(did: string): string {
  const cosmosAddress = did.slice(did.lastIndexOf(':') + 1)

  return `did:pkh:…${cosmosAddress.slice(0, 10)}…${cosmosAddress.slice(-6)}`
}
