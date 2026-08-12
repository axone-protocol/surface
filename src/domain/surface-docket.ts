import type { Network } from '../networks'
import type { WalletProviderId } from './wallet-connection'

export type IdentityDocketSituation =
  | 'signature-declined'
  | 'submission-not-sent'
  | 'transaction-submitted'
  | 'transaction-executed'
  | 'transaction-failed'
  | 'transaction-unresolved'
  | 'public-record-observed'

export type IdentityDocketEntry = {
  id: string
  type: 'identity-creation'
  occurredAt: string
  name: string
  description: string
  controller: string
  provider: WalletProviderId
  networkKey: Network['key']
  chainId: string
  explorer: string
  situation: IdentityDocketSituation
  transactionHash?: string
  height?: string
  error?: string
}

export type NewIdentityDocketEntry = Omit<IdentityDocketEntry, 'id' | 'occurredAt' | 'type'>

export type DocketSessionEntry = {
  id: string
  type: 'session'
  occurredAt: string
  event: 'connected' | 'disconnected' | 'controller-changed'
  provider?: WalletProviderId
  controller?: string
  previousController?: string
  chainId: string
  explorer?: string
}

export type SurfaceDocketEntry = IdentityDocketEntry | DocketSessionEntry

export function isWalletRejection(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error)
  return /reject|rejected|denied|declined|cancelled|canceled/i.test(message)
}

export function docketEntryTimestamp(entry: SurfaceDocketEntry): string {
  return entry.occurredAt
}
