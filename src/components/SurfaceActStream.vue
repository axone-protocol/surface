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

const registerWindowSize = 3
const visibleActs = ref<SurfaceAct[]>([])
const pendingActs = ref<SurfaceAct[]>([])
let drainResolver: (() => void) | undefined
const typingActId = ref<string | undefined>()
let draining = false
let drainGeneration = 0

function stopDrain() {
  drainGeneration += 1
  typingActId.value = undefined
  if (drainResolver) {
    drainResolver()
    drainResolver = undefined
  }
  draining = false
}

function enqueueMissingActs() {
  // The API is newest-first, while the fixed register is rendered like paper:
  // oldest visible line at the top and the newest line at the bottom.
  const targetWindow = props.acts.slice(0, registerWindowSize).reverse()
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
  const generation = drainGeneration

  try {
    while (generation === drainGeneration && pendingActs.value.length > 0) {
      const next = pendingActs.value[0]!
      pendingActs.value = pendingActs.value.slice(1)
      visibleActs.value = [...visibleActs.value, next].slice(-registerWindowSize)

      if (props.reducedMotion) {
        continue
      }

      typingActId.value = next.id
      await new Promise<void>((resolve) => {
        drainResolver = resolve
      })
    }
  } finally {
    if (generation === drainGeneration) {
      typingActId.value = undefined
      draining = false
    }
  }
}

function completeTyping(actId: string) {
  if (typingActId.value !== actId) {
    return
  }

  typingActId.value = undefined
  if (drainResolver) {
    drainResolver()
    drainResolver = undefined
  }
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
      visibleActs.value = props.acts.slice(0, registerWindowSize).reverse()
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
          <SurfaceActItem
            :act="act"
            :reducedMotion="reducedMotion"
            :typing-active="typingActId === act.id"
            @typing-complete="completeTyping(act.id)"
          />
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
