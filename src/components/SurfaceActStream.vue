<script setup lang="ts">
import { onBeforeUnmount, ref, watch } from 'vue'

import ChainPollingStatus from './ChainPollingStatus.vue'
import SurfaceActItem from './SurfaceActItem.vue'
import type { SurfaceAct } from '../domain/surface-act'

const props = defineProps<{
  acts: SurfaceAct[]
  loading: boolean
  error?: string
  reducedMotion: boolean
  polling: boolean
  lastSyncLabel?: string
  registerSummary?: string
}>()

const maxVisibleActs = 3
const visibleActs = ref<SurfaceAct[]>([])
const pendingActs = ref<SurfaceAct[]>([])
let drainTimer: number | undefined
let drainResolver: (() => void) | undefined
let draining = false

function stopDrain() {
  window.clearTimeout(drainTimer)
  drainTimer = undefined
  if (drainResolver) {
    drainResolver()
    drainResolver = undefined
  }
}

function enqueueMissingActs() {
  const targetWindow = props.acts.slice(0, maxVisibleActs).reverse()
  const currentIds = new Set([...visibleActs.value, ...pendingActs.value].map((act) => act.id))
  const missingActs = targetWindow.filter((act) => !currentIds.has(act.id))

  if (missingActs.length === 0) {
    return
  }

  pendingActs.value = [...pendingActs.value, ...missingActs]
  if (!draining) {
    void drainVisibleActs()
  }
}

async function drainVisibleActs() {
  if (draining) {
    return
  }

  draining = true

  while (pendingActs.value.length > 0) {
    const next = pendingActs.value[0]!
    pendingActs.value = pendingActs.value.slice(1)
    visibleActs.value = [...visibleActs.value, next].slice(-maxVisibleActs)

    if (!props.reducedMotion) {
      await new Promise<void>((resolve) => {
        drainResolver = resolve
        drainTimer = window.setTimeout(() => {
          drainResolver = undefined
          resolve()
        }, 1900)
      })
    }
  }

  draining = false
}

watch(
  () => props.acts.map((act) => act.id).join('|'),
  () => {
    enqueueMissingActs()
  },
  { immediate: true },
)

watch(
  () => props.reducedMotion,
  () => {
    if (props.reducedMotion) {
      visibleActs.value = props.acts.slice(0, maxVisibleActs).reverse()
      pendingActs.value = []
      stopDrain()
      draining = false
      return
    }

    enqueueMissingActs()
  },
)

onBeforeUnmount(() => {
  stopDrain()
})
</script>

<template>
  <section class="surface-act-stream" aria-labelledby="surface-act-stream-title">
    <header class="surface-act-stream-head">
      <div class="surface-act-stream-head-main">
        <p id="surface-act-stream-title">CHAIN REGISTER</p>
      </div>
      <div class="surface-act-stream-head-meta">
        <span v-if="registerSummary" class="surface-act-stream-summary">{{ registerSummary }}</span>
        <span
          v-if="registerSummary && lastSyncLabel"
          class="surface-act-stream-separator"
          aria-hidden="true"
          >·</span
        >
        <span v-if="lastSyncLabel" class="surface-act-stream-sync"
          >LAST SYNC {{ lastSyncLabel }}</span
        >
      </div>
    </header>

    <p v-if="error" class="surface-act-stream-error">{{ error }}</p>

    <div v-else-if="visibleActs.length > 0" class="surface-act-window">
      <TransitionGroup tag="ol" name="surface-act-row" class="surface-act-list">
        <li v-for="act in visibleActs" :key="act.id" class="surface-act-list-item">
          <SurfaceActItem :act="act" :reducedMotion="reducedMotion" />
        </li>
      </TransitionGroup>
    </div>

    <div v-else-if="loading" class="surface-act-skeleton" role="status">
      <ol class="surface-act-skeleton-list">
        <li v-for="n in 3" :key="n" class="surface-act-skeleton-item">
          <span
            class="surface-act-skeleton-bar surface-act-skeleton-bar-badge"
            aria-hidden="true"
          />
          <span class="surface-act-skeleton-bar surface-act-skeleton-bar-meta" aria-hidden="true" />
          <span
            class="surface-act-skeleton-bar surface-act-skeleton-bar-title"
            aria-hidden="true"
          />
          <span
            class="surface-act-skeleton-bar surface-act-skeleton-bar-description"
            aria-hidden="true"
          />
        </li>
      </ol>
      <p class="sr-only">Reading the chain register…</p>
    </div>

    <p v-else class="surface-act-stream-empty">No acts recorded yet.</p>

    <div class="surface-act-stream-status">
      <ChainPollingStatus :polling="polling" :loading="loading" :error="error" />
    </div>
  </section>
</template>
