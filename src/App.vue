<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { usePreferredReducedMotion } from '@vueuse/core'
import { AnimatePresence, motion, MotionConfig } from 'motion-v'

import SurfaceActStream from './components/SurfaceActStream.vue'
import SurfaceDocket from './components/SurfaceDocket.vue'
import SurfaceDropdown from './components/SurfaceDropdown.vue'
import SurfaceReference from './components/SurfaceReference.vue'
import { isIdentityRequestComplete } from './domain/identity-request'
import { isWalletRejection } from './domain/surface-docket'
import type { SurfaceReference as SurfaceReferenceModel } from './domain/surface-reference'
import { shortenWalletAddress } from './lib/shorten'
import { useSurfaceActs } from './composables/useSurfaceActs'
import { useSurfaceDocket, type DocketSessionContext } from './composables/useSurfaceDocket'
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
const walletProviderOptions: ReadonlyArray<{ id: WalletProviderId; label: string }> = [
  { id: 'keplr', label: 'Keplr' },
  { id: 'leap', label: 'Leap' },
]

type FacetId = 'established' | 'current' | 'initiated'

const facetIds: readonly FacetId[] = ['established', 'current', 'initiated']

const preferredMotion = usePreferredReducedMotion()
const prefersReducedMotion = computed(() => preferredMotion.value === 'reduce')
const activeLawId = ref(defaultLaw.id)
const activeActorIndex = ref(0)
const selectedNetworkKey = ref<Network['key']>('testnet')
const networkMenuOpen = ref(false)
const walletMenuOpen = ref(false)
const identityName = ref('')
const identityDescription = ref('')
const identityRequestState = ref<'idle' | 'submitting' | 'submitted' | 'error'>('idle')
const identityRequestComposing = ref(false)
const identityRequestError = ref<string | null>(null)
const docketAttention = ref(false)
const surfaceActionsEl = ref<HTMLElement | null>(null)
const { acts, loading, error, polling } = useSurfaceActs()
const {
  entries: docketEntries,
  appendIdentityEvent,
  recordSessionTransition,
  observeSubmittedTransaction,
} = useSurfaceDocket(acts)
const surfaceCameraEl = ref<HTMLElement | null>(null)
const activeFacetIndex = ref(1)
const temporaryCameraOffset = ref(0)
const isCameraPanning = ref(false)
const isCameraWheeling = ref(false)
const facetElements = new Map<FacetId, HTMLElement>()
let cameraPointerId: number | undefined
let cameraStartX = 0
let cameraStartY = 0
let hasPanned = false
let cameraPointerCanPan = false
let horizontalWheelSettleTimer: number | undefined
let actorTimer: number | undefined
let lawTimer: number | undefined
let docketAttentionTimer: number | undefined

let documentClickHandler: ((event: MouseEvent) => void) | null = null
let documentKeydownHandler: ((event: KeyboardEvent) => void) | null = null

const activeLaw = computed(
  () => surfaceLaws.find((law) => law.id === activeLawId.value) ?? defaultLaw,
)
const activeActorLine = computed(() => actorLines[activeActorIndex.value] ?? actorLines[0])
const immediateMotionTransition = { duration: 0 }
const lawMotionTransition = { duration: 0.5, ease: 'easeInOut' }
const actorMotionTransition = { duration: 0.26, ease: 'easeInOut' }
const lawTransition = computed(() =>
  prefersReducedMotion.value ? immediateMotionTransition : lawMotionTransition,
)
const actorTransition = computed(() =>
  prefersReducedMotion.value ? immediateMotionTransition : actorMotionTransition,
)
const selectedNetwork = computed(
  () => networks.find((network) => network.key === selectedNetworkKey.value) ?? networks[0]!,
)
const activeFacet = computed(() => facetIds[activeFacetIndex.value] ?? 'current')
const cameraStatus = computed(
  () => `Surface position ${activeFacetIndex.value + 1} of ${facetIds.length}`,
)
const cameraTrackStyle = computed(() => ({
  '--surface-active-index': activeFacetIndex.value,
  '--surface-pan-offset': `${temporaryCameraOffset.value}px`,
}))
const cameraNavigatorStyle = computed(() => {
  const width = cameraWidth()
  const position = width
    ? activeFacetIndex.value - temporaryCameraOffset.value / width
    : activeFacetIndex.value
  const boundedPosition = Math.min(Math.max(position, 0), facetIds.length - 1)
  return {
    '--surface-navigator-offset': `${(boundedPosition / facetIds.length) * 100}%`,
  }
})
const {
  status: walletConnectionStatus,
  connection: walletConnection,
  errorMessage: walletErrorMessage,
  availableProviders: availableWalletProviders,
  connect: connectWalletClient,
  disconnect: disconnectWalletClient,
} = useWalletConnection(selectedNetwork)
const walletTriggerLabel = computed(() => {
  if (walletConnectionStatus.value === 'connecting') {
    return 'Waiting for wallet...'
  }

  return walletConnection.value ? 'Connected' : 'Connect'
})
const walletTriggerDisabled = computed(() => walletConnectionStatus.value === 'connecting')
const docketSessionContext = computed<DocketSessionContext | undefined>(() =>
  walletConnection.value
    ? {
        provider: walletConnection.value.provider,
        controller: walletConnection.value.address,
        chainId: walletConnection.value.chainId,
      }
    : undefined,
)
const walletProviderInstallHint = computed(
  () =>
    `Install ${walletProviderOptions.map((provider) => provider.label).join(' or ')} to connect a wallet.`,
)
const identityRequestReady = computed(() =>
  isIdentityRequestComplete({ name: identityName.value, description: identityDescription.value }),
)
const identityRequestSubmitting = computed(() => identityRequestState.value === 'submitting')
const identityRequestConfigured = computed(
  () =>
    selectedNetwork.value.abstractAccountCodeId !== null &&
    selectedNetwork.value.abstractAccountAdmin !== null &&
    selectedNetwork.value.api !== null,
)
const walletAddressExplorerUrl = computed(() =>
  walletConnection.value
    ? `${selectedNetwork.value.explorer}/account/${walletConnection.value.address}`
    : undefined,
)
const walletReference = computed<SurfaceReferenceModel | undefined>(() => {
  if (!walletConnection.value || !walletAddressExplorerUrl.value) {
    return undefined
  }

  return {
    designation: 'Wallet address',
    value: walletConnection.value.address,
    display: shortenWalletAddress(walletConnection.value.address),
    link: {
      href: walletAddressExplorerUrl.value,
      label: 'OPEN IN EXPLORER',
    },
  }
})
function selectNetwork(networkKey: Network['key']) {
  const network = networks.find((entry) => entry.key === networkKey)
  if (!network || !network.selectable) {
    return
  }

  selectedNetworkKey.value = network.key
  clearIdentityRequest()
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

function requestWalletConnection() {
  if (walletTriggerDisabled.value) {
    return
  }

  walletMenuOpen.value = true
  networkMenuOpen.value = false
}

function walletProviderLabel(providerId: WalletProviderId) {
  return walletProviderOptions.find((provider) => provider.id === providerId)?.label ?? providerId
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

function disconnectWallet() {
  disconnectWalletClient()
  clearIdentityRequest()
  closeMenus()
}

function clearIdentityRequestDraft() {
  identityName.value = ''
  identityDescription.value = ''
}

function clearIdentityRequest() {
  clearIdentityRequestDraft()
  identityRequestState.value = 'idle'
  identityRequestComposing.value = false
  identityRequestError.value = null
}

function beginIdentityRequest() {
  if (walletConnection.value) {
    identityRequestComposing.value = true
  }
}

function beginAnotherIdentityRequest() {
  clearIdentityRequestDraft()
  identityRequestState.value = 'idle'
  identityRequestComposing.value = true
  identityRequestError.value = null
}

function signalDocketActivity() {
  if (activeFacet.value === 'initiated') {
    return
  }

  docketAttention.value = true
  window.clearTimeout(docketAttentionTimer)
  docketAttentionTimer = window.setTimeout(() => {
    docketAttention.value = false
  }, 4_000)
}

function acknowledgeIdentityRequest(state: 'submitted' | 'error') {
  identityRequestState.value = state
}

async function submitIdentityRequest() {
  if (
    !walletConnection.value ||
    !identityRequestReady.value ||
    !identityRequestConfigured.value ||
    identityRequestSubmitting.value
  ) {
    return
  }

  const connection = walletConnection.value
  const network = selectedNetwork.value
  const name = identityName.value.trim()
  const description = identityDescription.value.trim()
  const identityEvent = {
    name,
    description,
    controller: connection.address,
    provider: connection.provider,
    networkKey: network.key,
    chainId: network.chainId,
    explorer: network.explorer,
  }

  identityRequestState.value = 'submitting'
  identityRequestError.value = null
  signalDocketActivity()

  try {
    const { browserIdentityRequestClient } = await import('./infra/browser-identity-request-client')
    const submitted = await browserIdentityRequestClient.submit({
      provider: connection.provider,
      sender: connection.address,
      network,
      name,
      description,
    })
    const docketEntry = appendIdentityEvent({
      ...identityEvent,
      situation: 'transaction-submitted',
      transactionHash: submitted.transactionHash,
    })
    void observeSubmittedTransaction(docketEntry.id)

    acknowledgeIdentityRequest('submitted')
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Identity request could not be submitted.'
    appendIdentityEvent({
      ...identityEvent,
      situation: isWalletRejection(error) ? 'signature-declined' : 'submission-not-sent',
      error: message,
    })

    identityRequestError.value = 'Request not submitted. Inspect the Docket for details.'
    acknowledgeIdentityRequest('error')
  }
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

function clampFacetIndex(index: number) {
  return Math.min(Math.max(index, 0), facetIds.length - 1)
}

function setFacetElement(facet: FacetId, element: unknown) {
  if (element instanceof HTMLElement) {
    facetElements.set(facet, element)
  }
}

function resetFacetScroll(facetIndex: number) {
  const facet = facetElements.get(facetIds[facetIndex] ?? 'current')
  if (facet) {
    facet.scrollTop = 0
  }
}

function settleCameraAt(index: number) {
  const nextIndex = clampFacetIndex(index)
  if (nextIndex !== activeFacetIndex.value) {
    resetFacetScroll(nextIndex)
    activeFacetIndex.value = nextIndex
  }
  temporaryCameraOffset.value = 0
}

function cameraWidth() {
  return surfaceCameraEl.value?.clientWidth ?? 0
}

function boundedCameraOffset(offset: number) {
  const width = cameraWidth()
  if (width === 0) {
    return 0
  }

  const minimum = activeFacetIndex.value < facetIds.length - 1 ? -width : 0
  const maximum = activeFacetIndex.value > 0 ? width : 0
  return Math.min(Math.max(offset, minimum), maximum)
}

function clearHorizontalWheelSettleTimer() {
  window.clearTimeout(horizontalWheelSettleTimer)
  horizontalWheelSettleTimer = undefined
}

function settleCameraOffset() {
  const width = cameraWidth()
  if (width > 0) {
    settleCameraAt(Math.round(activeFacetIndex.value - temporaryCameraOffset.value / width))
  } else {
    temporaryCameraOffset.value = 0
  }

  isCameraWheeling.value = false
}

function canPanFrom(event: PointerEvent) {
  const target = event.target
  if (!(target instanceof Element)) {
    return true
  }

  return !target.closest(
    'a, button, input, textarea, select, [contenteditable], p, h1, h2, h3, h4, h5, h6, li, code, pre, span',
  )
}

function handleCameraPointerDown(event: PointerEvent) {
  if (!event.isPrimary || event.button !== 0) {
    return
  }

  hasPanned = false
  cameraPointerCanPan = canPanFrom(event)
  cameraPointerId = event.pointerId
  cameraStartX = event.clientX
  cameraStartY = event.clientY
  temporaryCameraOffset.value = 0
}

function handleCameraPointerMove(event: PointerEvent) {
  if (event.pointerId !== cameraPointerId) {
    return
  }

  if (!cameraPointerCanPan) {
    return
  }

  const horizontalTravel = event.clientX - cameraStartX
  const verticalTravel = event.clientY - cameraStartY
  if (!isCameraPanning.value) {
    if (
      Math.abs(horizontalTravel) <= 12 ||
      Math.abs(horizontalTravel) <= Math.abs(verticalTravel)
    ) {
      return
    }

    window.getSelection()?.removeAllRanges()
    surfaceCameraEl.value?.setPointerCapture(event.pointerId)
    isCameraPanning.value = true
  }

  event.preventDefault()

  temporaryCameraOffset.value = boundedCameraOffset(horizontalTravel)
}

function finishCameraPointer(event: PointerEvent) {
  if (event.pointerId !== cameraPointerId) {
    return
  }

  const didPan = isCameraPanning.value
  if (didPan) {
    const threshold = Math.min(96, cameraWidth() * 0.18)
    if (temporaryCameraOffset.value <= -threshold) {
      settleCameraAt(activeFacetIndex.value + 1)
    } else if (temporaryCameraOffset.value >= threshold) {
      settleCameraAt(activeFacetIndex.value - 1)
    } else {
      temporaryCameraOffset.value = 0
    }
  }

  if (surfaceCameraEl.value?.hasPointerCapture(event.pointerId)) {
    surfaceCameraEl.value.releasePointerCapture(event.pointerId)
  }
  isCameraPanning.value = false
  cameraPointerId = undefined
  cameraPointerCanPan = false
  hasPanned = didPan
}

function suppressCameraPanClick(event: MouseEvent) {
  if (!hasPanned) {
    return
  }

  event.preventDefault()
  event.stopPropagation()
  hasPanned = false
}

function handleCameraKeydown(event: KeyboardEvent) {
  if (event.key === 'ArrowLeft') {
    event.preventDefault()
    settleCameraAt(activeFacetIndex.value - 1)
  } else if (event.key === 'ArrowRight') {
    event.preventDefault()
    settleCameraAt(activeFacetIndex.value + 1)
  }
}

function handleCameraWheel(event: WheelEvent) {
  if (Math.abs(event.deltaX) <= Math.abs(event.deltaY)) {
    return
  }

  event.preventDefault()
  isCameraWheeling.value = true
  temporaryCameraOffset.value = boundedCameraOffset(temporaryCameraOffset.value - event.deltaX)
  clearHorizontalWheelSettleTimer()
  horizontalWheelSettleTimer = window.setTimeout(settleCameraOffset, 120)
}

watch(prefersReducedMotion, startHeroRotation)
watch(docketSessionContext, (current, previous) => {
  recordSessionTransition(previous, current)
  if (
    previous &&
    (!current ||
      current.controller !== previous.controller ||
      current.chainId !== previous.chainId ||
      current.provider !== previous.provider)
  ) {
    clearIdentityRequest()
  }
})
watch(activeFacet, (facet) => {
  if (facet === 'initiated') {
    docketAttention.value = false
    window.clearTimeout(docketAttentionTimer)
  }
})

onMounted(() => {
  documentClickHandler = (event) => {
    const target = event.target as Node | null
    const root = surfaceActionsEl.value
    const inReferenceSurface =
      target instanceof Element &&
      target.closest(
        '.surface-reference-panel, .surface-reference-sheet, .surface-reference-backdrop',
      )
    const isWalletConnectionRequest =
      target instanceof Element && target.closest('.identity-request-connect-action')
    if (
      (networkMenuOpen.value || walletMenuOpen.value) &&
      root &&
      target &&
      !root.contains(target) &&
      !inReferenceSurface &&
      !isWalletConnectionRequest
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
  surfaceCameraEl.value?.addEventListener('wheel', handleCameraWheel, { passive: false })
  startHeroRotation()
})

onBeforeUnmount(() => {
  window.clearInterval(actorTimer)
  window.clearInterval(lawTimer)
  window.clearTimeout(docketAttentionTimer)
  clearHorizontalWheelSettleTimer()
  surfaceCameraEl.value?.removeEventListener('wheel', handleCameraWheel)
  if (documentClickHandler) {
    document.removeEventListener('click', documentClickHandler)
  }
  if (documentKeydownHandler) {
    document.removeEventListener('keydown', documentKeydownHandler)
  }
})
</script>

<template>
  <MotionConfig reduced-motion="user">
    <main class="surface-home" :class="{ 'is-reduced-motion': prefersReducedMotion }">
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
                  v-for="provider in walletProviderOptions"
                  :key="provider.id"
                  class="network-option wallet-option"
                  :class="{ 'is-disabled': !availableWalletProviders.includes(provider.id) }"
                  type="button"
                  role="menuitem"
                  :aria-disabled="!availableWalletProviders.includes(provider.id)"
                  :disabled="!availableWalletProviders.includes(provider.id)"
                  @click="connectWallet(provider.id)"
                >
                  <span class="wallet-option-name">{{ provider.label }}</span>
                  <span class="wallet-option-status">
                    {{
                      availableWalletProviders.includes(provider.id) ? 'available' : 'unavailable'
                    }}
                  </span>
                </button>
              </div>
              <p
                v-if="availableWalletProviders.length === 0"
                class="wallet-menu-status"
                role="status"
                aria-live="polite"
              >
                {{ walletProviderInstallHint }}
              </p>
              <p v-if="walletErrorMessage" class="wallet-menu-error" role="alert">
                {{ walletErrorMessage }}
              </p>
            </template>
            <template v-else>
              <div class="wallet-connection-details">
                <p class="wallet-provider">
                  {{ walletProviderLabel(walletConnection.provider) }}
                </p>
                <div class="wallet-address-row">
                  <SurfaceReference v-if="walletReference" :reference="walletReference" />
                </div>
              </div>
            </template>
            <template #footer>
              <button
                class="wallet-disconnect"
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

      <section
        ref="surfaceCameraEl"
        class="surface-camera"
        :class="{ 'is-dragging': isCameraPanning, 'is-wheeling': isCameraWheeling }"
        :data-active-facet="activeFacet"
        tabindex="0"
        :aria-label="`Surface camera. ${cameraStatus}`"
        aria-describedby="surface-camera-instructions surface-camera-status"
        @pointerdown="handleCameraPointerDown"
        @pointermove="handleCameraPointerMove"
        @pointerup="finishCameraPointer"
        @pointercancel="finishCameraPointer"
        @click.capture="suppressCameraPanClick"
        @keydown="handleCameraKeydown"
      >
        <p id="surface-camera-instructions" class="sr-only">
          Use Arrow Left and Arrow Right to move across Surface facets.
        </p>
        <p id="surface-camera-status" class="sr-only" aria-live="polite" aria-atomic="true">
          {{ cameraStatus }}
        </p>
        <div class="surface-track" :style="cameraTrackStyle">
          <section
            :ref="(element) => setFacetElement('established', element)"
            data-facet="established"
            class="surface-facet"
            aria-label="Chain register"
          >
            <div class="surface-facet-inner">
              <SurfaceActStream
                :acts="acts"
                :loading="loading"
                :error="error"
                :explorer="selectedNetwork.explorer"
                :reduced-motion="prefersReducedMotion"
                :polling="polling"
              />
            </div>
          </section>

          <section
            :ref="(element) => setFacetElement('current', element)"
            data-facet="current"
            class="surface-facet"
            aria-labelledby="surface-home-title"
          >
            <div class="surface-facet-inner">
              <header class="doctrine-hero">
                <p
                  class="law-line"
                  :aria-label="`${activeLaw.number} / ${activeLaw.title} - ${activeLaw.paraphrase}`"
                  aria-live="polite"
                  aria-atomic="true"
                >
                  <AnimatePresence mode="wait" :initial="false">
                    <motion.span
                      :key="activeLaw.id"
                      class="law-statement"
                      :initial="{ opacity: 0, filter: 'blur(2px)' }"
                      :animate="{ opacity: 1, filter: 'blur(0px)' }"
                      :exit="{ opacity: 0, filter: 'blur(2px)' }"
                      :transition="lawTransition"
                    >
                      <span class="law-number">{{ activeLaw.number }}</span>
                      <span class="law-content">
                        <span class="law-title">{{ activeLaw.title }}</span>
                        <span class="law-separator" aria-hidden="true">—</span>
                        <span class="law-paraphrase">{{ activeLaw.paraphrase }}</span>
                      </span>
                    </motion.span>
                  </AnimatePresence>
                  <span class="law-rule" aria-hidden="true"></span>
                </p>
                <h1 id="surface-home-title">GOVERN<br /><span class="act">ACT</span></h1>
                <p class="actor-line" aria-live="polite" aria-atomic="true">
                  <AnimatePresence mode="wait" :initial="false">
                    <motion.span
                      :key="activeActorIndex"
                      :initial="{ opacity: 0, y: '0.3em' }"
                      :animate="{ opacity: 1, y: 0 }"
                      :exit="{ opacity: 0, y: '-0.24em' }"
                      :transition="actorTransition"
                    >
                      {{ activeActorLine }}
                    </motion.span>
                  </AnimatePresence>
                </p>
              </header>
              <section class="identity-request" aria-labelledby="identity-request-title">
                <div class="identity-request-heading">
                  <p class="identity-request-kicker">IDENTITY REQUEST</p>
                  <h2 id="identity-request-title">Establish an identity.</h2>
                </div>

                <div v-if="!identityRequestComposing" class="identity-request-connect">
                  <button
                    class="identity-request-connect-action"
                    type="button"
                    :disabled="walletTriggerDisabled"
                    @click="walletConnection ? beginIdentityRequest() : requestWalletConnection()"
                  >
                    {{ walletConnection ? 'NEW IDENTITY REQUEST' : 'CONNECT WALLET' }}
                  </button>
                </div>

                <form
                  v-else-if="walletConnection"
                  class="identity-request-form"
                  @submit.prevent="submitIdentityRequest()"
                >
                  <p class="identity-request-controller">
                    CONTROLLER <code>{{ shortenWalletAddress(walletConnection.address) }}</code>
                  </p>
                  <label>
                    <span>NAME · REQUIRED</span>
                    <input
                      v-model="identityName"
                      name="identity-name"
                      autocomplete="off"
                      required
                      :disabled="identityRequestSubmitting || identityRequestState === 'submitted'"
                    />
                  </label>
                  <label>
                    <span>DESCRIPTION · REQUIRED</span>
                    <textarea
                      v-model="identityDescription"
                      name="identity-description"
                      rows="3"
                      required
                      :disabled="identityRequestSubmitting || identityRequestState === 'submitted'"
                    />
                  </label>
                  <p v-if="!identityRequestConfigured" class="identity-request-error" role="alert">
                    Identity creation is not available on the selected network.
                  </p>
                  <button
                    v-if="identityRequestState === 'submitted'"
                    class="identity-request-submit"
                    type="button"
                    @click="beginAnotherIdentityRequest"
                  >
                    NEW IDENTITY REQUEST
                  </button>
                  <button
                    v-else
                    class="identity-request-submit"
                    type="submit"
                    :disabled="
                      !identityRequestReady ||
                      !identityRequestConfigured ||
                      identityRequestSubmitting
                    "
                  >
                    {{ identityRequestSubmitting ? 'AWAITING SIGNATURE' : 'SIGN REQUEST' }}
                  </button>
                  <p
                    v-if="identityRequestSubmitting"
                    class="identity-request-status is-pending"
                    role="status"
                    aria-live="polite"
                  >
                    <span aria-hidden="true"></span> Awaiting wallet signature.
                  </p>
                  <div
                    v-if="identityRequestState === 'submitted'"
                    class="identity-request-status"
                    role="status"
                    aria-live="polite"
                  >
                    <p class="identity-request-status-label">REQUEST ADDED TO DOCKET</p>
                  </div>
                  <p v-else-if="identityRequestError" class="identity-request-error" role="alert">
                    {{ identityRequestError }}
                  </p>
                </form>
              </section>
            </div>
          </section>

          <section
            :ref="(element) => setFacetElement('initiated', element)"
            data-facet="initiated"
            class="surface-facet"
            aria-labelledby="surface-docket-title"
          >
            <div class="surface-facet-inner">
              <SurfaceDocket :entries="docketEntries" />
            </div>
          </section>
        </div>
      </section>

      <div
        class="surface-navigator"
        :class="{ 'is-dragging': isCameraPanning, 'is-wheeling': isCameraWheeling }"
        aria-hidden="true"
      >
        <span class="surface-navigator-label" :class="{ 'is-active': activeFacetIndex === 0 }">
          ESTABLISHED
        </span>
        <span class="surface-navigator-track" :style="cameraNavigatorStyle">
          <span class="surface-navigator-thumb" :class="{ 'is-centered': activeFacetIndex === 1 }">
            <span class="surface-navigator-home-pulse"></span>
          </span>
        </span>
        <span
          class="surface-navigator-label"
          :class="{ 'is-active': activeFacetIndex === 2, 'has-attention': docketAttention }"
        >
          INITIATED
        </span>
      </div>
    </main>
  </MotionConfig>
</template>
