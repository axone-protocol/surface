<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'

import ChainPollingStatus from './ChainPollingStatus.vue'
import SurfaceActLine from './SurfaceActLine.vue'
import type { SurfaceAct } from '../domain/surface-act'
import {
  compactRegisterActWindowSize,
  desktopRegisterActWindowSize,
} from '../domain/surface-act-window'

const props = defineProps<{
  acts: SurfaceAct[]
  loading: boolean
  error?: string
  reducedMotion: boolean
  polling: boolean
}>()

const visibleActs = ref<SurfaceAct[]>([])
const pendingActs = ref<SurfaceAct[]>([])
const typingActId = ref<string | undefined>()
const cursorActId = ref<string | undefined>()
const knownActIds = new Set<string>()
const compactViewport = ref(false)
const registerActWindowSize = computed(() =>
  compactViewport.value ? compactRegisterActWindowSize : desktopRegisterActWindowSize,
)
let drainResolver: (() => void) | undefined
let draining = false
let drainGeneration = 0
let compactViewportQuery: MediaQueryList | undefined
let compactViewportChangeHandler: ((event: MediaQueryListEvent) => void) | undefined

function stopDrain() {
  drainGeneration += 1
  typingActId.value = undefined
  if (drainResolver) {
    drainResolver()
    drainResolver = undefined
  }
  draining = false
}

function currentActs() {
  return props.acts.slice(0, registerActWindowSize.value).reverse()
}

function pruneKnownActIds() {
  const retainedIds = new Set([
    ...currentActs().map((act) => act.id),
    ...visibleActs.value.map((act) => act.id),
    ...pendingActs.value.map((act) => act.id),
  ])

  knownActIds.forEach((actId) => {
    if (!retainedIds.has(actId)) {
      knownActIds.delete(actId)
    }
  })
}

function enqueueMissingActs() {
  // The API is newest-first, while the register is written like paper:
  // the oldest retained act is printed before the newest one.
  pruneKnownActIds()
  const missingActs = currentActs().filter((act) => !knownActIds.has(act.id))

  if (missingActs.length === 0) {
    return
  }

  missingActs.forEach((act) => knownActIds.add(act.id))
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
      visibleActs.value = [...visibleActs.value, next].slice(-registerActWindowSize.value)

      if (props.reducedMotion) {
        cursorActId.value = undefined
        continue
      }

      cursorActId.value = next.id
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
      const acts = currentActs()
      visibleActs.value = acts
      cursorActId.value = undefined
      pendingActs.value = []
      knownActIds.clear()
      acts.forEach((act) => knownActIds.add(act.id))
      stopDrain()
      return
    }

    enqueueMissingActs()
  },
)

watch(compactViewport, () => {
  stopDrain()
  visibleActs.value = []
  pendingActs.value = []
  knownActIds.clear()
  enqueueMissingActs()
})

onMounted(() => {
  if (typeof window.matchMedia !== 'function') {
    return
  }

  compactViewportQuery = window.matchMedia('(max-width: 760px)')
  compactViewport.value = compactViewportQuery.matches
  compactViewportChangeHandler = (event) => {
    compactViewport.value = event.matches
  }
  compactViewportQuery.addEventListener('change', compactViewportChangeHandler)
})

onBeforeUnmount(() => {
  stopDrain()
  if (compactViewportChangeHandler) {
    compactViewportQuery?.removeEventListener('change', compactViewportChangeHandler)
  }
})
</script>

<template>
  <section class="surface-act-stream" aria-labelledby="surface-act-stream-title">
    <header class="surface-act-stream-head">
      <p id="surface-act-stream-title">CHAIN REGISTER</p>
    </header>

    <div class="surface-act-column-head" aria-hidden="true">
      <span>ENTRY</span>
      <span>STATEMENT</span>
      <span>EVIDENCE</span>
    </div>

    <p v-if="error" class="surface-act-stream-error">{{ error }}</p>

    <div v-else-if="visibleActs.length > 0" class="surface-act-window">
      <TransitionGroup tag="ol" name="surface-act-row" class="surface-act-list">
        <li v-for="act in visibleActs" :key="act.id" class="surface-act-list-item">
          <SurfaceActLine
            :act="act"
            :reducedMotion="reducedMotion"
            :typing-active="typingActId === act.id"
            :cursor-visible="cursorActId === act.id"
            @typing-complete="completeTyping(act.id)"
          />
        </li>
      </TransitionGroup>
    </div>

    <div v-else-if="loading" class="surface-act-skeleton" role="status">
      <ol class="surface-act-skeleton-list">
        <li v-for="n in registerActWindowSize" :key="n" class="surface-act-skeleton-item">
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
