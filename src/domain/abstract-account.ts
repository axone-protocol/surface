import { bech32 } from 'bech32'

export function toCanonicalDid(address: string, chainId: string): string {
  const decoded = bech32.decode(address)
  const cosmosAddress = bech32.encode('cosmos', decoded.words)

  return `did:pkh:cosmos:${chainId}:${cosmosAddress}`
}
