import { onBeforeUnmount, ref, watch, type Ref } from 'vue'

import type { AbstractAccountClient, AbstractAccountIdentity } from '../domain/abstract-account'
import { browserAbstractAccountClient } from '../infra/abstract-account-client'
import type { Network } from '../networks'
import type { UseWalletConnectionState } from './useWalletConnection'

export type IdentityDiscoveryStatus = 'idle' | 'loading' | 'ready' | 'error'

export type UseAbstractAccountIdentitiesState = {
  status: Readonly<Ref<IdentityDiscoveryStatus>>
  identities: Readonly<Ref<AbstractAccountIdentity[]>>
  activeIdentity: Readonly<Ref<AbstractAccountIdentity | null>>
  errorMessage: Readonly<Ref<string | null>>
  selectIdentity: (address: string) => void
}

export function useAbstractAccountIdentities(
  walletConnection: Pick<UseWalletConnectionState, 'connection'>,
  selectedNetwork: Readonly<Ref<Network>>,
  client: AbstractAccountClient = browserAbstractAccountClient,
): UseAbstractAccountIdentitiesState {
  const status = ref<IdentityDiscoveryStatus>('idle')
  const identities = ref<AbstractAccountIdentity[]>([])
  const activeIdentity = ref<AbstractAccountIdentity | null>(null)
  const errorMessage = ref<string | null>(null)
  let generation = 0
  let controller: AbortController | null = null

  function reset() {
    controller?.abort()
    controller = null
    generation += 1
    status.value = 'idle'
    identities.value = []
    activeIdentity.value = null
    errorMessage.value = null
  }

  function selectIdentity(address: string) {
    const identity = identities.value.find((candidate) => candidate.address === address)
    if (identity) {
      activeIdentity.value = identity
    }
  }

  watch(
    [() => walletConnection.connection.value, () => selectedNetwork.value.chainId],
    async ([connection]) => {
      reset()
      if (!connection) {
        return
      }

      const requestGeneration = generation
      controller = new AbortController()
      status.value = 'loading'
      const signal = controller.signal

      try {
        const discovered = await client.discover(connection.address, selectedNetwork.value, signal)
        if (requestGeneration !== generation) {
          return
        }

        identities.value = discovered
        activeIdentity.value = discovered[0] ?? null
        status.value = 'ready'
      } catch (error) {
        if (requestGeneration !== generation) {
          return
        }

        identities.value = []
        activeIdentity.value = null
        errorMessage.value = error instanceof Error ? error.message : 'Identity discovery failed.'
        status.value = 'error'
      }
    },
    { immediate: true },
  )

  onBeforeUnmount(reset)

  return { status, identities, activeIdentity, errorMessage, selectIdentity }
}
