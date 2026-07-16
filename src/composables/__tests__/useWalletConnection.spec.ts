import { defineComponent, nextTick, ref } from 'vue'
import { mount } from '@vue/test-utils'
import { describe, expect, it, vi, type Mock } from 'vitest'

import { useWalletConnection, type UseWalletConnectionState } from '../useWalletConnection'
import type { WalletAccount, WalletConnectionClient } from '../../domain/wallet-connection'
import { networks } from '../../networks'

type FakeWalletClient = {
  client: WalletConnectionClient
  connect: Mock<WalletConnectionClient['connect']>
  cleanup: Mock<() => void>
  onAccount: (account: WalletAccount) => void
  onError: () => void
}

function createClient(account: WalletAccount = { address: 'axone1initial' }): FakeWalletClient {
  const connect = vi.fn<WalletConnectionClient['connect']>().mockResolvedValue(account)
  const cleanup = vi.fn<() => void>()
  let onAccount: (account: WalletAccount) => void = () => undefined
  let onError: () => void = () => undefined
  const watchAccount = vi
    .fn<WalletConnectionClient['watchAccount']>()
    .mockImplementation((_provider, _chainId, nextAccount, nextError) => {
      onAccount = nextAccount
      onError = nextError
      return cleanup
    })

  return {
    client: {
      availableProviders: () => ['keplr', 'leap'],
      connect,
      watchAccount,
    },
    connect,
    cleanup,
    onAccount: (account) => onAccount(account),
    onError: () => onError(),
  }
}

function mountConnection(client: WalletConnectionClient) {
  const network = ref(networks[0]!)
  const state = { value: null as UseWalletConnectionState | null }
  const Harness = defineComponent({
    setup() {
      state.value = useWalletConnection(network, client)
      return {}
    },
    template: '<div />',
  })
  const wrapper = mount(Harness)
  const walletState = state.value

  if (!walletState) {
    throw new Error('Wallet connection state was not initialized')
  }

  return { wrapper, network, state: walletState }
}

describe('useWalletConnection', () => {
  it('stores the selected provider, address, and chain ID then cleans up locally', async () => {
    const fake = createClient({ address: 'axone1connected' })
    const { state } = mountConnection(fake.client)

    await state.connect('keplr')

    expect(state.status.value).toBe('connected')
    expect(state.connection.value).toEqual({
      provider: 'keplr',
      address: 'axone1connected',
      chainId: 'axone-dendrite-2',
    })
    expect(fake.connect).toHaveBeenCalledWith('keplr', 'axone-dendrite-2')

    state.disconnect()
    expect(fake.cleanup).toHaveBeenCalledOnce()
    expect(state.status.value).toBe('idle')
    expect(state.connection.value).toBeNull()
  })

  it('rejects an address outside the selected Axone network', async () => {
    const fake = createClient({ address: 'cosmos1wrongnetwork' })
    const { state } = mountConnection(fake.client)

    await state.connect('leap')

    expect(state.connection.value).toBeNull()
    expect(state.status.value).toBe('error')
    expect(state.errorMessage.value).toBe(
      'Wallet address does not belong to the selected Axone network.',
    )
    expect(fake.cleanup).not.toHaveBeenCalled()
  })

  it('exposes a provider-specific retry message after a connection rejection', async () => {
    const fake = createClient()
    fake.connect.mockRejectedValue(new Error('locked'))
    const { state } = mountConnection(fake.client)

    await state.connect('keplr')

    expect(state.status.value).toBe('error')
    expect(state.errorMessage.value).toBe(
      'Could not connect to Keplr. Unlock the wallet, enable the selected Axone network, and try again.',
    )
  })

  it('replaces the displayed address when the wallet account changes', async () => {
    const fake = createClient()
    const { state } = mountConnection(fake.client)
    await state.connect('keplr')

    fake.onAccount({ address: 'axone1changed' })

    expect(state.connection.value?.address).toBe('axone1changed')
    expect(state.status.value).toBe('connected')
  })

  it('disconnects after a watched wallet refresh fails', async () => {
    const fake = createClient()
    const { state } = mountConnection(fake.client)
    await state.connect('leap')

    fake.onError()

    expect(fake.cleanup).toHaveBeenCalledOnce()
    expect(state.connection.value).toBeNull()
    expect(state.status.value).toBe('error')
    expect(state.errorMessage.value).toBe(
      'Wallet connection is no longer available. Connect again to continue.',
    )
  })

  it('disconnects when the selected network changes', async () => {
    const fake = createClient()
    const { network, state } = mountConnection(fake.client)
    await state.connect('keplr')

    network.value = networks[1]!
    await nextTick()

    expect(fake.cleanup).toHaveBeenCalledOnce()
    expect(state.connection.value).toBeNull()
    expect(state.status.value).toBe('idle')
  })
})
