import type { Network } from '../networks'
import type { WalletProviderId } from './wallet-connection'

export type SubmitIdentityRequest = {
  provider: WalletProviderId
  sender: string
  network: Network
  name: string
  description: string
}

export type SubmittedIdentityRequest = {
  transactionHash: string
}

export interface IdentityRequestClient {
  submit(request: SubmitIdentityRequest): Promise<SubmittedIdentityRequest>
}
