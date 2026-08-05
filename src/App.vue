<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'

import SurfaceActStream from './components/SurfaceActStream.vue'
import SurfaceDropdown from './components/SurfaceDropdown.vue'
import { useSurfaceActs } from './composables/useSurfaceActs'
import { useWalletConnection } from './composables/useWalletConnection'
import type { WalletProviderId } from './domain/wallet-connection'
import { networks, type Network } from './networks'
import { surfaceLaws } from './surfaceLaws'

const actorLines = [
  'For humans.',
  'For agents.',
  'For organisations.',
  'For any resource in scope.',
]
const defaultLaw = surfaceLaws[0]!

const prefersReducedMotion = ref(false)
const activeLawId = ref(defaultLaw.id)
const activeActorIndex = ref(0)
const selectedNetworkKey = ref<Network['key']>('testnet')
const networkMenuOpen = ref(false)
const walletMenuOpen = ref(false)
const surfaceActionsEl = ref<HTMLElement | null>(null)
const { acts, loading, error, polling } = useSurfaceActs()

let motionQuery: MediaQueryList | null = null
let actorTimer: number | undefined
let lawTimer: number | undefined
let motionChangeHandler: ((event: MediaQueryListEvent) => void) | null = null
let documentClickHandler: ((event: MouseEvent) => void) | null = null
let documentKeydownHandler: ((event: KeyboardEvent) => void) | null = null

const activeLaw = computed(
  () => surfaceLaws.find((law) => law.id === activeLawId.value) ?? defaultLaw,
)
const activeActorLine = computed(() => actorLines[activeActorIndex.value] ?? actorLines[0])
const selectedNetwork = computed(
  () => networks.find((network) => network.key === selectedNetworkKey.value) ?? networks[0]!,
)
const {
  status: walletConnectionStatus,
  connection: walletConnection,
  errorMessage: walletErrorMessage,
  availableProviders: availableWalletProviders,
  connect: connectWalletClient,
  disconnect: disconnectWalletClient,
} = useWalletConnection(selectedNetwork)
const walletAnnouncement = ref('')
const walletAddressCopyState = ref<'idle' | 'copying' | 'copied'>('idle')
let walletAddressCopiedTimer: number | undefined
let isUnmounted = false
const walletTriggerLabel = computed(() => {
  if (walletConnectionStatus.value === 'connecting') {
    return 'Waiting for wallet...'
  }

  return walletConnection.value ? 'Connected' : 'Connect'
})
const walletTriggerDisabled = computed(() => walletConnectionStatus.value === 'connecting')
const walletAddressExplorerUrl = computed(() =>
  walletConnection.value
    ? `${selectedNetwork.value.explorer}/account/${walletConnection.value.address}`
    : undefined,
)

function updateReducedMotion(event?: MediaQueryListEvent) {
  prefersReducedMotion.value = event?.matches ?? motionQuery?.matches ?? false
}

function selectNetwork(networkKey: Network['key']) {
  const network = networks.find((entry) => entry.key === networkKey)
  if (!network || !network.selectable) {
    return
  }

  selectedNetworkKey.value = network.key
  networkMenuOpen.value = false
}

function toggleNetworkMenu() {
  networkMenuOpen.value = !networkMenuOpen.value
  walletMenuOpen.value = false
}

function toggleWalletMenu() {
  walletMenuOpen.value = !walletMenuOpen.value
  networkMenuOpen.value = false
}

function closeMenus() {
  networkMenuOpen.value = false
  walletMenuOpen.value = false
}

async function connectWallet(provider: WalletProviderId) {
  await connectWalletClient(provider)
  if (walletConnection.value) {
    walletMenuOpen.value = false
  }
}

function compactWalletAddress(address: string): string {
  return address.length <= 16 ? address : `${address.slice(0, 10)}...${address.slice(-6)}`
}

function clearWalletAddressCopiedTimer() {
  window.clearTimeout(walletAddressCopiedTimer)
  walletAddressCopiedTimer = undefined
}

async function copyWalletAddress(address: string) {
  if (walletAddressCopyState.value !== 'idle') {
    return
  }

  walletAddressCopyState.value = 'copying'
  try {
    await navigator.clipboard.writeText(address)
  } catch {
    if (!isUnmounted) {
      walletAddressCopyState.value = 'idle'
      walletAnnouncement.value = 'Could not copy wallet address.'
    }
    return
  }

  if (isUnmounted) {
    return
  }

  walletAnnouncement.value = 'Wallet address copied.'
  walletAddressCopyState.value = 'copied'
  walletAddressCopiedTimer = window.setTimeout(() => {
    walletAddressCopiedTimer = undefined
    walletAddressCopyState.value = 'idle'
  }, 1000)
}

function disconnectWallet() {
  disconnectWalletClient()
  closeMenus()
}

function rotateActorLine() {
  activeActorIndex.value = (activeActorIndex.value + 1) % actorLines.length
}

function rotateLaw() {
  const currentIndex = surfaceLaws.findIndex((law) => law.id === activeLawId.value)
  const nextLaw = surfaceLaws[(currentIndex + 1) % surfaceLaws.length] ?? defaultLaw
  activeLawId.value = nextLaw.id
}

function startHeroRotation() {
  window.clearInterval(actorTimer)
  window.clearInterval(lawTimer)

  if (prefersReducedMotion.value) {
    return
  }

  actorTimer = window.setInterval(rotateActorLine, 4600)
  lawTimer = window.setInterval(rotateLaw, 5200)
}

onMounted(() => {
  motionQuery =
    typeof window.matchMedia === 'function'
      ? window.matchMedia('(prefers-reduced-motion: reduce)')
      : null
  updateReducedMotion()
  motionChangeHandler = () => {
    updateReducedMotion()
    startHeroRotation()
  }
  motionQuery?.addEventListener('change', motionChangeHandler)
  documentClickHandler = (event) => {
    const target = event.target as Node | null
    const root = surfaceActionsEl.value
    if (
      (networkMenuOpen.value || walletMenuOpen.value) &&
      root &&
      target &&
      !root.contains(target)
    ) {
      closeMenus()
    }
  }
  documentKeydownHandler = (event) => {
    if (event.key === 'Escape') {
      closeMenus()
    }
  }
  document.addEventListener('click', documentClickHandler)
  document.addEventListener('keydown', documentKeydownHandler)
  startHeroRotation()
})

onBeforeUnmount(() => {
  window.clearInterval(actorTimer)
  window.clearInterval(lawTimer)
  isUnmounted = true
  clearWalletAddressCopiedTimer()
  if (motionChangeHandler) {
    motionQuery?.removeEventListener('change', motionChangeHandler)
  }
  if (documentClickHandler) {
    document.removeEventListener('click', documentClickHandler)
  }
  if (documentKeydownHandler) {
    document.removeEventListener('keydown', documentKeydownHandler)
  }
})
</script>

<template>
  <main class="surface-home" :class="{ 'is-reduced-motion': prefersReducedMotion }">

    <section class="surface-document" aria-label="Axone Surface">
      <nav class="surface-bar" aria-label="Surface heading">
        <p class="surface-mark">AXONE <span class="surface-mark-separator">/</span> SURFACE</p>
        <div ref="surfaceActionsEl" class="surface-actions" aria-label="Surface actions">
          <button
            class="top-connect"
            :class="{ 'is-pending': walletTriggerDisabled }"
            type="button"
            aria-haspopup="menu"
            :aria-expanded="walletMenuOpen"
            aria-controls="wallet-menu"
            :disabled="walletTriggerDisabled"
            @click="toggleWalletMenu"
          >
            <span>{{ walletTriggerLabel }}</span>
            <span v-if="!walletTriggerDisabled" class="menu-chevron" aria-hidden="true">▾</span>
          </button>
          <p class="sr-only" role="status" aria-live="polite">{{ walletAnnouncement }}</p>
          <SurfaceDropdown
            v-if="walletMenuOpen"
            id="wallet-menu"
            class="wallet-menu"
            aria-label="Wallet connection"
            :heading="walletConnection ? 'WALLET' : 'WALLETS'"
            :has-footer="Boolean(walletConnection)"
          >
            <template v-if="!walletConnection">
              <div class="wallet-register-list">
                <button
                  class="network-option wallet-option"
                  :class="{ 'is-disabled': !availableWalletProviders.includes('keplr') }"
                  type="button"
                  role="menuitem"
                  :aria-disabled="!availableWalletProviders.includes('keplr')"
                  :disabled="!availableWalletProviders.includes('keplr')"
                  @click="connectWallet('keplr')"
                >
                  <span class="wallet-option-name">Keplr</span>
                  <span class="wallet-option-status">
                    {{ availableWalletProviders.includes('keplr') ? 'available' : 'unavailable' }}
                  </span>
                </button>
                <button
                  class="network-option wallet-option"
                  :class="{ 'is-disabled': !availableWalletProviders.includes('leap') }"
                  type="button"
                  role="menuitem"
                  :aria-disabled="!availableWalletProviders.includes('leap')"
                  :disabled="!availableWalletProviders.includes('leap')"
                  @click="connectWallet('leap')"
                >
                  <span class="wallet-option-name">Leap</span>
                  <span class="wallet-option-status">
                    {{ availableWalletProviders.includes('leap') ? 'available' : 'unavailable' }}
                  </span>
                </button>
              </div>
              <p
                v-if="availableWalletProviders.length === 0"
                class="wallet-menu-status"
                role="status"
                aria-live="polite"
              >
                Install Keplr or Leap to connect a wallet.
              </p>
              <p v-if="walletErrorMessage" class="wallet-menu-error" role="alert">
                {{ walletErrorMessage }}
              </p>
            </template>
            <template v-else>
              <div class="wallet-connection-details">
                <p class="wallet-provider">
                  {{ walletConnection.provider === 'keplr' ? 'Keplr' : 'Leap' }}
                </p>
                <div class="wallet-address-row">
                  <a
                    class="wallet-address"
                    :href="walletAddressExplorerUrl"
                    :title="walletConnection.address"
                    :aria-label="`View wallet address ${walletConnection.address} in explorer`"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    {{ compactWalletAddress(walletConnection.address) }}
                  </a>
                  <span class="wallet-address-action">
                    <button
                      v-if="walletAddressCopyState !== 'copied'"
                      class="wallet-address-copy"
                      type="button"
                      role="menuitem"
                      :disabled="walletAddressCopyState === 'copying'"
                      :title="walletConnection.address"
                      :aria-label="`Copy wallet address: ${walletConnection.address}`"
                      @click="copyWalletAddress(walletConnection.address)"
                    >
                      <svg
                        aria-hidden="true"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        stroke-width="2"
                      >
                        <rect x="8" y="8" width="12" height="12" rx="1" />
                        <path d="M4 16V5a1 1 0 0 1 1-1h11" />
                      </svg>
                    </button>
                    <span v-else class="wallet-address-copied" role="status">
                      <span class="wallet-address-copied-icon" aria-hidden="true">✓</span>
                      <span class="wallet-address-copied-label">Copied</span>
                    </span>
                  </span>
                </div>
              </div>
            </template>
            <template #footer>
              <button
                class="network-option wallet-disconnect"
                type="button"
                role="menuitem"
                @click="disconnectWallet"
              >
                Disconnect
              </button>
            </template>
          </SurfaceDropdown>
          <span class="surface-actions-divider" aria-hidden="true">|</span>
          <button
            class="network-trigger"
            type="button"
            aria-haspopup="menu"
            :aria-expanded="networkMenuOpen"
            aria-controls="network-menu"
            @click="toggleNetworkMenu"
          >
            <span class="network-live-dot" aria-hidden="true" />
            <span>{{ selectedNetwork.displayName }}</span>
            <span class="menu-chevron" aria-hidden="true">▾</span>
          </button>
          <SurfaceDropdown
            v-if="networkMenuOpen"
            id="network-menu"
            aria-label="Network selection"
            heading="NETWORKS"
          >
            <button
              v-for="network in networks"
              :key="network.key"
              type="button"
              class="network-option"
              :class="{
                'is-active': selectedNetwork.key === network.key,
                'is-disabled': !network.selectable,
              }"
              role="menuitemradio"
              :aria-checked="selectedNetwork.key === network.key"
              :aria-disabled="!network.selectable"
              :disabled="!network.selectable"
              @click="selectNetwork(network.key)"
            >
              <span class="network-option-name">{{ network.displayName }}</span>
              <span class="network-option-state">
                <span class="network-option-chain">{{ network.chainId.toUpperCase() }}</span>
                <span v-if="!network.selectable" class="network-option-soon">soon</span>
              </span>
            </button>
          </SurfaceDropdown>
        </div>
      </nav>

      <header class="doctrine-hero">
        <Transition name="law-fade" mode="out-in">
          <p
            :key="activeLaw.id"
            class="law-line"
            :aria-label="`${activeLaw.number} / ${activeLaw.title} - ${activeLaw.paraphrase}`"
            aria-live="polite"
            aria-atomic="true"
          >
            <span class="law-number">{{ activeLaw.number }}</span>
            <span class="law-content">
              <span class="law-title">{{ activeLaw.title }}</span>
              <span class="law-separator" aria-hidden="true">—</span>
              <span class="law-paraphrase">{{ activeLaw.paraphrase }}</span>
            </span>
            <span class="law-rule" aria-hidden="true"></span>
          </p>
        </Transition>
        <h1>GOVERN<br /><span class="act">ACT</span></h1>
        <p class="actor-line" aria-live="polite" aria-atomic="true">
          <Transition name="actor-turn" mode="out-in">
            <span :key="activeActorIndex">{{ activeActorLine }}</span>
          </Transition>
        </p>
      </header>

      <SurfaceActStream
        :acts="acts"
        :loading="loading"
        :error="error"
        :explorer="selectedNetwork.explorer"
        :reduced-motion="prefersReducedMotion"
        :polling="polling"
      />
    </section>
  </main>
</template>
