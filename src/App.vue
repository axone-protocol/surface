<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { usePreferredReducedMotion } from '@vueuse/core'
import { MotionConfig } from 'motion-v'
import { RouterView, useRoute, useRouter } from 'vue-router'

import SurfaceActStream from './components/SurfaceActStream.vue'
import SurfaceDocket from './components/SurfaceDocket.vue'
import SurfaceDropdown from './components/SurfaceDropdown.vue'
import SurfaceReference from './components/SurfaceReference.vue'
import { isWalletRejection } from './domain/surface-docket'
import type { SurfaceReference as SurfaceReferenceModel } from './domain/surface-reference'
import { shortenWalletAddress } from './lib/shorten'
import { useSurfaceActs } from './composables/useSurfaceActs'
import { useSurfaceDocket, type DocketSessionContext } from './composables/useSurfaceDocket'
import { useWalletConnection } from './composables/useWalletConnection'
import type { WalletProviderId } from './domain/wallet-connection'
import { networks, type Network } from './networks'

const walletProviderOptions: ReadonlyArray<{ id: WalletProviderId; label: string }> = [
  { id: 'keplr', label: 'Keplr' },
  { id: 'leap', label: 'Leap' },
]

type FacetId = 'established' | 'current' | 'initiated'

const facetIds: readonly FacetId[] = ['established', 'current', 'initiated']

const preferredMotion = usePreferredReducedMotion()
const prefersReducedMotion = computed(() => preferredMotion.value === 'reduce')
const route = useRoute()
const router = useRouter()
const selectedNetworkKey = ref<Network['key']>('testnet')
const networkMenuOpen = ref(false)
const walletMenuOpen = ref(false)
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
let cameraTouchId: number | undefined
let cameraStartX = 0
let cameraStartY = 0
let hasPanned = false
let cameraPointerCanPan = false
let horizontalWheelSettleTimer: number | undefined
let docketAttentionTimer: number | undefined

let documentClickHandler: ((event: MouseEvent) => void) | null = null
let documentKeydownHandler: ((event: KeyboardEvent) => void) | null = null

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
  closeMenus()
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

async function submitIdentityRequest(input: { name: string; description: string }) {
  if (
    !walletConnection.value ||
    selectedNetwork.value.abstractAccountCodeId === null ||
    selectedNetwork.value.abstractAccountAdmin === null ||
    selectedNetwork.value.api === null
  ) {
    return 'Request not submitted. Inspect the Docket for details.'
  }

  const connection = walletConnection.value
  const network = selectedNetwork.value
  const identityEvent = {
    ...input,
    controller: connection.address,
    provider: connection.provider,
    networkKey: network.key,
    chainId: network.chainId,
    explorer: network.explorer,
  }

  signalDocketActivity()

  try {
    const { browserIdentityRequestClient } = await import('./infra/browser-identity-request-client')
    const submitted = await browserIdentityRequestClient.submit({
      provider: connection.provider,
      sender: connection.address,
      network,
      ...input,
    })
    const docketEntry = appendIdentityEvent({
      ...identityEvent,
      situation: 'transaction-submitted',
      transactionHash: submitted.transactionHash,
    })
    void observeSubmittedTransaction(docketEntry.id)
    return null
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Identity request could not be submitted.'
    appendIdentityEvent({
      ...identityEvent,
      situation: isWalletRejection(error) ? 'signature-declined' : 'submission-not-sent',
      error: message,
    })

    return 'Request not submitted. Inspect the Docket for details.'
  }
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

function facetFromHash(hash: string): FacetId {
  switch (hash) {
    case '#established':
      return 'established'
    case '#initiated':
      return 'initiated'
    case '':
    case '#current':
      return 'current'
    default:
      return 'current'
  }
}

function hashForFacet(facet: FacetId) {
  return facet === 'current' ? '' : `#${facet}`
}

function routeLocationForFacet(facet: FacetId) {
  return {
    path: route.path,
    query: route.query,
    hash: hashForFacet(facet),
  }
}

function requestCameraAt(index: number) {
  const nextIndex = clampFacetIndex(index)
  const nextFacet = facetIds[nextIndex] ?? 'current'
  const hash = hashForFacet(nextFacet)
  temporaryCameraOffset.value = 0

  if (route.hash === hash) {
    settleCameraAt(nextIndex)
    return
  }

  void router.push(routeLocationForFacet(nextFacet))
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
    requestCameraAt(Math.round(activeFacetIndex.value - temporaryCameraOffset.value / width))
  } else {
    temporaryCameraOffset.value = 0
  }

  isCameraWheeling.value = false
}

function canPanFrom(target: EventTarget | null, input: 'mouse' | 'touch') {
  if (!(target instanceof Element)) {
    return true
  }

  if (input === 'touch') {
    return !target.closest('a, button, input, textarea, select, [contenteditable]')
  }

  return !target.closest(
    'a, button, input, textarea, select, [contenteditable], p, h1, h2, h3, h4, h5, h6, li, code, pre, span',
  )
}

function handleCameraPointerDown(event: PointerEvent) {
  if (event.pointerType === 'touch' || !event.isPrimary || event.button !== 0) {
    return
  }

  hasPanned = false
  cameraPointerCanPan = canPanFrom(event.target, 'mouse')
  cameraPointerId = event.pointerId
  cameraStartX = event.clientX
  cameraStartY = event.clientY
  temporaryCameraOffset.value = 0
}

function touchWithId(touches: TouchList, identifier: number) {
  for (let index = 0; index < touches.length; index += 1) {
    const touch = touches.item(index)
    if (touch?.identifier === identifier) {
      return touch
    }
  }

  return undefined
}

function handleCameraTouchStart(event: TouchEvent) {
  if (event.touches.length !== 1) {
    return
  }

  const touch = event.touches.item(0)
  if (!touch) {
    return
  }

  hasPanned = false
  cameraPointerCanPan = canPanFrom(event.target, 'touch')
  cameraTouchId = touch.identifier
  cameraStartX = touch.clientX
  cameraStartY = touch.clientY
  temporaryCameraOffset.value = 0
}

function handleCameraTouchMove(event: TouchEvent) {
  if (cameraTouchId === undefined || !cameraPointerCanPan) {
    return
  }

  const touch = touchWithId(event.touches, cameraTouchId)
  if (!touch) {
    return
  }

  const horizontalTravel = touch.clientX - cameraStartX
  const verticalTravel = touch.clientY - cameraStartY
  if (!isCameraPanning.value) {
    if (
      Math.abs(horizontalTravel) <= 12 ||
      Math.abs(horizontalTravel) <= Math.abs(verticalTravel)
    ) {
      return
    }

    window.getSelection()?.removeAllRanges()
    isCameraPanning.value = true
  }

  event.preventDefault()
  temporaryCameraOffset.value = boundedCameraOffset(horizontalTravel)
}

function finishCameraTouch(event: TouchEvent) {
  if (cameraTouchId === undefined || !touchWithId(event.changedTouches, cameraTouchId)) {
    return
  }

  const didPan = isCameraPanning.value
  if (didPan) {
    const threshold = Math.min(96, cameraWidth() * 0.18)
    if (temporaryCameraOffset.value <= -threshold) {
      requestCameraAt(activeFacetIndex.value + 1)
    } else if (temporaryCameraOffset.value >= threshold) {
      requestCameraAt(activeFacetIndex.value - 1)
    } else {
      temporaryCameraOffset.value = 0
    }
  }

  isCameraPanning.value = false
  cameraTouchId = undefined
  cameraPointerCanPan = false
  hasPanned = didPan
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
      requestCameraAt(activeFacetIndex.value + 1)
    } else if (temporaryCameraOffset.value >= threshold) {
      requestCameraAt(activeFacetIndex.value - 1)
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
    requestCameraAt(activeFacetIndex.value - 1)
  } else if (event.key === 'ArrowRight') {
    event.preventDefault()
    requestCameraAt(activeFacetIndex.value + 1)
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

watch(
  () => route.hash,
  (hash) => {
    const facet = facetFromHash(hash)
    const canonicalHash = hashForFacet(facet)
    if (hash !== canonicalHash) {
      void router.replace(routeLocationForFacet(facet))
      return
    }

    settleCameraAt(facetIds.indexOf(facet))
  },
  { immediate: true },
)
watch(docketSessionContext, (current, previous) => {
  recordSessionTransition(previous, current)
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
})

onBeforeUnmount(() => {
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
        @touchstart="handleCameraTouchStart"
        @touchmove="handleCameraTouchMove"
        @touchend="finishCameraTouch"
        @touchcancel="finishCameraTouch"
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
            aria-label="Surface view"
          >
            <div class="surface-facet-inner">
              <RouterView v-slot="{ Component }">
                <component
                  :is="Component"
                  :wallet-connection="walletConnection"
                  :wallet-trigger-disabled="walletTriggerDisabled"
                  :network="selectedNetwork"
                  :reduced-motion="prefersReducedMotion"
                  :request-wallet-connection="requestWalletConnection"
                  :send-identity-request="submitIdentityRequest"
                />
              </RouterView>
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
