<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'

import HeroCanvas from './components/HeroCanvas.vue'
import SurfaceActStream from './components/SurfaceActStream.vue'
import { useSurfaceActs } from './composables/useSurfaceActs'
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
const surfaceActionsEl = ref<HTMLElement | null>(null)
const { acts, loading, error, lastSync, polling, total } = useSurfaceActs()

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
const hasValidSync = computed(() => !!lastSync.value && !error.value)
const registerSummary = computed(() => {
  if (error.value) {
    return 'CHAIN UNAVAILABLE'
  }

  if (hasValidSync.value) {
    return total.value != null ? `${total.value} RECORDS` : undefined
  }

  return undefined
})
const selectedNetwork = computed(
  () => networks.find((network) => network.key === selectedNetworkKey.value) ?? networks[0]!,
)
const lastSyncLabel = computed(() => {
  const sync = lastSync.value
  if (!sync) {
    return undefined
  }

  return new Intl.DateTimeFormat('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
    timeZone: 'UTC',
  }).format(sync)
})

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
}

function closeNetworkMenu() {
  networkMenuOpen.value = false
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
    if (networkMenuOpen.value && root && target && !root.contains(target)) {
      closeNetworkMenu()
    }
  }
  documentKeydownHandler = (event) => {
    if (event.key === 'Escape') {
      closeNetworkMenu()
    }
  }
  document.addEventListener('click', documentClickHandler)
  document.addEventListener('keydown', documentKeydownHandler)
  startHeroRotation()
})

onBeforeUnmount(() => {
  window.clearInterval(actorTimer)
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
          <button class="top-connect" type="button">Connect identity</button>
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
        :last-sync-label="lastSyncLabel"
        :register-summary="registerSummary"
      />
    </section>
  </main>
</template>
