import { defineComponent, nextTick, ref } from 'vue'
import { mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'

import {
  useAbstractAccountIdentities,
  type UseAbstractAccountIdentitiesState,
} from '../useAbstractAccountIdentities'
import type { AbstractAccountClient, AbstractAccountIdentity } from '../../domain/abstract-account'
import type { ConnectedWallet } from '../useWalletConnection'
import { networks } from '../../networks'

declare global {
  interface PromiseConstructor {
    withResolvers<T>(): PromiseWithResolvers<T>
  }
}

type PromiseWithResolvers<T> = {
  promise: Promise<T>
  resolve: (value: T | PromiseLike<T>) => void
  reject: (reason?: unknown) => void
}

const first: AbstractAccountIdentity = {
  address: 'axone1first',
  did: 'did:pkh:cosmos:axone-dendrite-2:cosmos1first',
  label: 'Anonymous',
}
const second: AbstractAccountIdentity = {
  address: 'axone1second',
  did: 'did:pkh:cosmos:axone-dendrite-2:cosmos1second',
  label: 'Anonymous',
}

function mountIdentities(client: AbstractAccountClient) {
  const connection = ref<ConnectedWallet | null>(null)
  const network = ref(networks[0]!)
  const state = { value: null as UseAbstractAccountIdentitiesState | null }
  const Harness = defineComponent({
    setup() {
      state.value = useAbstractAccountIdentities({ connection }, network, client)
      return () => null
    },
  })
  const wrapper = mount(Harness)
  if (!state.value) {
    throw new Error('Identity state was not initialized')
  }

  return { wrapper, connection, network, state: state.value }
}

function connected(address = 'axone1wallet'): ConnectedWallet {
  return { address, provider: 'keplr', chainId: 'axone-dendrite-2' }
}

describe('useAbstractAccountIdentities', () => {
  it('activates the first identity and selects a different discovered identity immediately', async () => {
    const client = {
      discover: vi.fn<AbstractAccountClient['discover']>().mockResolvedValue([first, second]),
    }
    const { connection, state } = mountIdentities(client)

    connection.value = connected()
    await nextTick()
    await vi.waitFor(() => expect(state.status.value).toBe('ready'))
    expect(state.activeIdentity.value).toEqual(first)

    state.selectIdentity(second.address)
    expect(state.activeIdentity.value).toEqual(second)
    expect(state.identities.value).toEqual([first, second])
  })

  it('reports an empty successful discovery distinctly from rejection', async () => {
    const client = { discover: vi.fn<AbstractAccountClient['discover']>().mockResolvedValue([]) }
    const { connection, state } = mountIdentities(client)

    connection.value = connected()
    await nextTick()
    await vi.waitFor(() => expect(state.status.value).toBe('ready'))
    expect(state.activeIdentity.value).toBeNull()

    client.discover.mockRejectedValueOnce(new Error('Registry unavailable'))
    connection.value = connected('axone1replacement')
    await nextTick()
    await vi.waitFor(() => expect(state.status.value).toBe('error'))
    expect(state.activeIdentity.value).toBeNull()
    expect(state.identities.value).toEqual([])
    expect(state.errorMessage.value).toBe('Registry unavailable')
  })

  it('aborts and resets stale discovery on disconnect, account replacement, and network replacement', async () => {
    const pendingRequests: PromiseWithResolvers<AbstractAccountIdentity[]>[] = []
    const client = {
      discover: vi.fn<AbstractAccountClient['discover']>().mockImplementation(() => {
        const pending = Promise.withResolvers<AbstractAccountIdentity[]>()
        pendingRequests.push(pending)
        return pending.promise
      }),
    }
    const { connection, network, state } = mountIdentities(client)

    connection.value = connected()
    await nextTick()
    const firstSignal = client.discover.mock.calls[0]![2]!
    connection.value = null
    await nextTick()
    expect(firstSignal.aborted).toBe(true)
    expect(state.status.value).toBe('idle')

    connection.value = connected('axone1replacement')
    await nextTick()
    const secondSignal = client.discover.mock.calls[1]![2]!
    network.value = { ...networks[0]!, chainId: 'axone-dendrite-3' }
    await nextTick()
    expect(secondSignal.aborted).toBe(true)
    expect(state.status.value).toBe('loading')

    pendingRequests[0]!.resolve([first])
    await nextTick()
    expect(state.identities.value).toEqual([])
  })
})
