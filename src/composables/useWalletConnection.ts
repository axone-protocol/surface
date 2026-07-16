import { computed, onBeforeUnmount, ref, watch, type Ref } from 'vue'

import type {
  WalletAccount,
  WalletConnectionClient,
  WalletProviderId,
} from '../domain/wallet-connection'
import { browserWalletConnectionClient } from '../infra/browser-wallet-connection-client'
import type { Network } from '../networks'

export type WalletConnectionStatus = 'idle' | 'connecting' | 'connected' | 'error'

export type ConnectedWallet = WalletAccount & {
  provider: WalletProviderId
  chainId: string
}

export type UseWalletConnectionState = {
  status: Readonly<Ref<WalletConnectionStatus>>
  connection: Readonly<Ref<ConnectedWallet | null>>
  errorMessage: Readonly<Ref<string | null>>
  availableProviders: Readonly<Ref<WalletProviderId[]>>
  connect: (provider: WalletProviderId) => Promise<void>
  disconnect: () => void
}

const wrongNetworkMessage = 'Wallet address does not belong to the selected Axone network.'
const unavailableMessage = 'Wallet connection is no longer available. Connect again to continue.'

function providerName(provider: WalletProviderId) {
  return provider === 'keplr' ? 'Keplr' : 'Leap'
}

export function useWalletConnection(
  network: Readonly<Ref<Network>>,
  client: WalletConnectionClient = browserWalletConnectionClient,
): UseWalletConnectionState {
  const status = ref<WalletConnectionStatus>('idle')
  const connection = ref<ConnectedWallet | null>(null)
  const errorMessage = ref<string | null>(null)
  const availableProviders = computed(() => client.availableProviders())
  let stopWatchingAccount: (() => void) | null = null

  function disconnect() {
    stopWatchingAccount?.()
    stopWatchingAccount = null
    connection.value = null
    errorMessage.value = null
    status.value = 'idle'
  }

  function disconnectWithError(message: string) {
    disconnect()
    errorMessage.value = message
    status.value = 'error'
  }

  function belongsToSelectedNetwork(account: WalletAccount) {
    return account.address.startsWith(`${network.value.bech32Prefix}1`)
  }

  async function connect(provider: WalletProviderId) {
    disconnect()
    status.value = 'connecting'

    try {
      const chainId = network.value.chainId
      const account = await client.connect(provider, chainId)
      if (!belongsToSelectedNetwork(account)) {
        disconnectWithError(wrongNetworkMessage)
        return
      }

      connection.value = { provider, address: account.address, chainId }
      stopWatchingAccount = client.watchAccount(
        provider,
        chainId,
        (updatedAccount) => {
          if (!belongsToSelectedNetwork(updatedAccount)) {
            disconnectWithError(wrongNetworkMessage)
            return
          }

          if (connection.value) {
            connection.value = { ...connection.value, address: updatedAccount.address }
          }
        },
        () => disconnectWithError(unavailableMessage),
      )
      status.value = 'connected'
    } catch {
      disconnectWithError(
        `Could not connect to ${providerName(provider)}. Unlock the wallet, enable the selected Axone network, and try again.`,
      )
    }
  }

  watch(
    () => network.value.chainId,
    () => {
      if (connection.value) {
        disconnect()
      }
    },
  )

  onBeforeUnmount(() => stopWatchingAccount?.())

  return { status, connection, errorMessage, availableProviders, connect, disconnect }
}
