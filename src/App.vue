<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'

import HeroCanvas from './components/HeroCanvas.vue'
import SurfaceActStream from './components/SurfaceActStream.vue'
import { useSurfaceActs } from './composables/useSurfaceActs'
import { useAbstractAccountIdentities } from './composables/useAbstractAccountIdentities'
import { useWalletConnection } from './composables/useWalletConnection'
import { compactCanonicalDid } from './domain/abstract-account'
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
const activeLawIndex = computed(() => surfaceLaws.findIndex((law) => law.id === activeLaw.value.id))
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
} = useWalletConnection(selectedNetwork)
const {
  status: identityDiscoveryStatus,
  identities,
  activeIdentity,
  errorMessage: identityErrorMessage,
  selectIdentity,
} = useAbstractAccountIdentities({ connection: walletConnection }, selectedNetwork)
const identityAnnouncement = ref('')
type IdentityDiscoveryPhase = 'idle' | 'pending' | 'reveal'
const identityDiscoveryPhase = ref<IdentityDiscoveryPhase>('idle')
const revealedIdentityCount = ref<number | null>(null)
let identityRevealTimer: number | undefined
function clearIdentityRevealTimer() {
  if (identityRevealTimer !== undefined) {
    window.clearTimeout(identityRevealTimer)
    identityRevealTimer = undefined
  }
}
watch(
  [walletConnectionStatus, identityDiscoveryStatus],
  ([connectionStatus, discoveryStatus]) => {
    clearIdentityRevealTimer()
    if (connectionStatus === 'connecting' || discoveryStatus === 'loading') {
      identityDiscoveryPhase.value = 'pending'
      revealedIdentityCount.value = null
      return
    }
    if (
      connectionStatus === 'connected' &&
      discoveryStatus === 'ready' &&
      walletConnection.value &&
      identityDiscoveryPhase.value !== 'reveal'
    ) {
      revealedIdentityCount.value = identities.value.length
      identityDiscoveryPhase.value = 'reveal'
      identityRevealTimer = window.setTimeout(() => {
        identityDiscoveryPhase.value = 'idle'
        revealedIdentityCount.value = null
        identityRevealTimer = undefined
      }, 900)
      return
    }
    identityDiscoveryPhase.value = 'idle'
    revealedIdentityCount.value = null
  },
  { immediate: true },
)
const identityTriggerLabel = computed(() => {
  if (!walletConnection.value) {
    return 'Connect'
  }
  if (identityDiscoveryStatus.value === 'error') {
    return 'Identity unavailable'
  }
  if (!activeIdentity.value) {
    return 'No identity'
  }
  return activeIdentity.value.label
})
const identityTriggerDisabled = computed(() => identityDiscoveryPhase.value === 'pending')

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

function selectAndCloseIdentity(address: string) {
  selectIdentity(address)
  walletMenuOpen.value = false
}

async function copyIdentityDid(did: string) {
  await navigator.clipboard.writeText(did)
  identityAnnouncement.value = 'Full identity DID copied.'
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
  clearIdentityRevealTimer()
  window.clearInterval(lawTimer)
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
    <HeroCanvas
      :active-law-index="activeLawIndex"
      :sealed-count="acts.length"
      :polling-active="polling"
      :reduced-motion="prefersReducedMotion"
    />

    <section class="surface-document" aria-label="Axone Surface">
      <nav class="surface-bar" aria-label="Surface heading">
        <p class="surface-mark">AXONE / SURFACE</p>
        <div ref="surfaceActionsEl" class="surface-actions" aria-label="Surface actions">
          <button
            class="top-connect"
            :class="{ 'is-pending': identityTriggerDisabled }"
            type="button"
            aria-haspopup="menu"
            :aria-expanded="walletMenuOpen"
            aria-controls="wallet-menu"
            :disabled="identityTriggerDisabled"
            @click="toggleWalletMenu"
          >
            <Transition name="identity-label" mode="out-in">
              <span
                v-if="identityDiscoveryPhase === 'pending'"
                key="pending"
                class="identity-status-label"
              >
                <span class="identity-resolution-dot is-pending" aria-hidden="true" />
                Resolving identities
              </span>
              <span
                v-else-if="identityDiscoveryPhase === 'reveal'"
                key="reveal"
                class="identity-status-label"
              >
                <span class="identity-resolution-dot is-revealed" aria-hidden="true" />
                {{ revealedIdentityCount }} identities found
              </span>
              <span v-else :key="identityTriggerLabel">{{ identityTriggerLabel }}</span>
            </Transition>
            <span v-if="walletConnection" class="menu-chevron" aria-hidden="true">▾</span>
          </button>
          <p class="sr-only" role="status" aria-live="polite">{{ identityAnnouncement }}</p>
          <div
            v-if="walletMenuOpen"
            id="wallet-menu"
            class="network-menu wallet-menu"
            role="menu"
            aria-label="Identity connection"
          >
            <template v-if="!walletConnection">
              <div class="wallet-register-head">WALLETS</div>
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
                Install Keplr or Leap to connect an Axone identity.
              </p>
              <p v-if="walletErrorMessage" class="wallet-menu-error" role="alert">
                {{ walletErrorMessage }}
              </p>
            </template>
            <p
              v-else-if="
                walletConnectionStatus === 'connecting' || identityDiscoveryStatus === 'loading'
              "
              class="wallet-menu-status"
              role="status"
              aria-live="polite"
            >
              Discovering identities…
            </p>
            <p
              v-else-if="identityDiscoveryStatus === 'error'"
              class="wallet-menu-error"
              role="alert"
            >
              {{ identityErrorMessage }}
            </p>
            <template v-else-if="identities.length === 0">
              <p class="identity-section-heading">No identity</p>
              <p class="identity-empty-message">This wallet does not control any identity.</p>
              <div class="identity-menu-separator" aria-hidden="true" />
              <p class="identity-management-affordance">Create identity…</p>
              <p class="identity-management-affordance">Import existing identity…</p>
            </template>
            <template v-else-if="activeIdentity">
              <div class="identity-current-row" aria-current="true">
                <p class="identity-name">
                  <span class="identity-current-dot" aria-hidden="true">●</span> Anonymous
                </p>
                <div class="identity-evidence">
                  <span
                    class="identity-did"
                    :title="activeIdentity.did"
                    :aria-label="`Full identity DID: ${activeIdentity.did}`"
                    >{{ compactCanonicalDid(activeIdentity.did) }}</span
                  >
                  <button
                    class="identity-copy"
                    type="button"
                    aria-label="Copy full identity DID"
                    @click="copyIdentityDid(activeIdentity.did)"
                  >
                    ⧉
                  </button>
                </div>
              </div>
              <template v-if="identities.length > 1">
                <div class="identity-menu-separator" aria-hidden="true" />
                <p class="identity-section-heading">Other identities</p>
                <button
                  v-for="identity in identities.filter(
                    (entry) => entry.address !== activeIdentity?.address,
                  )"
                  :key="identity.address"
                  class="network-option wallet-option identity-choice"
                  type="button"
                  role="menuitemradio"
                  :aria-checked="false"
                  @click="selectAndCloseIdentity(identity.address)"
                >
                  <span>{{ identity.label }}</span>
                  <span
                    class="identity-did"
                    :title="identity.did"
                    :aria-label="`Full identity DID: ${identity.did}`"
                    >{{ compactCanonicalDid(identity.did) }}</span
                  >
                </button>
              </template>
              <div class="identity-menu-separator" aria-hidden="true" />
              <p class="identity-management-affordance">Manage identities…</p>
            </template>
          </div>
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
          </button>
          <div
            v-if="networkMenuOpen"
            id="network-menu"
            class="network-menu"
            role="menu"
            aria-label="Network selection"
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
          </div>
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
            <span>{{ activeLaw.number }} / {{ activeLaw.title }}</span>
            <span class="law-separator" aria-hidden="true">-</span>
            <span class="law-paraphrase">{{ activeLaw.paraphrase }}</span>
          </p>
        </Transition>
        <h1>GOVERN ACT</h1>
        <p class="actor-line" aria-live="polite" aria-atomic="true">
          <span>{{ activeActorLine }}</span>
        </p>
        <p class="sr-only">You decide. The chain records. The register stays public.</p>
      </header>

      <section class="surface-bridge" aria-label="Surface state">
        <div class="surface-gestures">
          <a href="#surface-act-stream-title"
            >Enter the surface <span aria-hidden="true">→</span></a
          >
        </div>
      </section>

      <SurfaceActStream
        :acts="acts"
        :loading="loading"
        :error="error"
        :reduced-motion="prefersReducedMotion"
        :polling="polling"
      />
    </section>
  </main>
</template>
