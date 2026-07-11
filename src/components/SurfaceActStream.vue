<script setup lang="ts">
import { onBeforeUnmount, ref, watch } from 'vue'

import ChainPollingStatus from './ChainPollingStatus.vue'
import SurfaceActLine from './SurfaceActLine.vue'
import { surfaceActKindCategories, type SurfaceAct } from '../domain/surface-act'

type SurfaceActLineRole = 'category' | 'meta' | 'title' | 'description'

type RegisterLine = {
  id: string
  role: SurfaceActLineRole
  text: string
}

const props = defineProps<{
  acts: SurfaceAct[]
  loading: boolean
  error?: string
  reducedMotion: boolean
  polling: boolean
  lastSyncLabel?: string
  registerSummary?: string
}>()

const registerActWindowSize = 3
const registerLineWindowSize = 12
const visibleLines = ref<RegisterLine[]>([])
const pendingLines = ref<RegisterLine[]>([])
const typingLineId = ref<string | undefined>()
const cursorLineId = ref<string | undefined>()
const knownActIds = new Set<string>()
let drainResolver: (() => void) | undefined
let draining = false
let drainGeneration = 0

function stopDrain() {
  drainGeneration += 1
  typingLineId.value = undefined
  if (drainResolver) {
    drainResolver()
    drainResolver = undefined
  }
  draining = false
}

function shortValue(value: string) {
  if (value.length <= 24) {
    return value
  }

  return `${value.slice(0, 12)}...${value.slice(-6)}`
}

function compactValue(value: string) {
  if (value.startsWith('did:pkh:')) {
    const didParts = value.split(':')
    return shortValue(didParts[didParts.length - 1] ?? value)
  }

  return shortValue(value)
}

function compactDate(value: string) {
  const normalized = value.match(
    /^(\d{4}-\d{2}-\d{2})[T ](\d{2}):(\d{2})(?::\d{2}(?:\.\d{3})?)?(?:Z| UTC)?$/,
  )

  if (normalized) {
    const [, date, hour, minute] = normalized
    return `${date} ${hour}:${minute} UTC`
  }

  return value.replace('.000Z', ' UTC').replace('T', ' ').replace(/Z$/, ' UTC')
}

function registerLines(act: SurfaceAct): RegisterLine[] {
  const lines: Array<{ role: SurfaceActLineRole; text: string }> = [
    { role: 'category', text: surfaceActKindCategories[act.kind] },
    {
      role: 'meta',
      text: `SIGNER ${compactValue(act.signer ?? '-')}  DATE ${compactDate(act.timestamp)}  TX ${shortValue(act.txhash)}  HEIGHT ${act.height}  MSG ${act.msgIndex}`,
    },
    { role: 'title', text: act.title },
    { role: 'description', text: act.description },
  ]

  return lines.map((line) => ({
    ...line,
    id: `${act.id}:${line.role}`,
  }))
}

function currentActs() {
  return props.acts.slice(0, registerActWindowSize).reverse()
}

function enqueueMissingActs() {
  // The API is newest-first, while the register is written like paper:
  // the oldest retained act is printed before the newest one.
  const missingActs = currentActs().filter((act) => !knownActIds.has(act.id))

  if (missingActs.length === 0) {
    return
  }

  missingActs.forEach((act) => knownActIds.add(act.id))
  pendingLines.value = [...pendingLines.value, ...missingActs.flatMap(registerLines)]
  if (!draining) {
    void drainVisibleLines()
  }
}

async function drainVisibleLines() {
  if (draining) {
    return
  }

  draining = true
  const generation = drainGeneration

  try {
    while (generation === drainGeneration && pendingLines.value.length > 0) {
      const next = pendingLines.value[0]!
      pendingLines.value = pendingLines.value.slice(1)
      visibleLines.value = [...visibleLines.value, next].slice(-registerLineWindowSize)

      if (props.reducedMotion) {
        cursorLineId.value = undefined
        continue
      }

      cursorLineId.value = next.id
      typingLineId.value = next.id
      await new Promise<void>((resolve) => {
        drainResolver = resolve
      })
    }
  } finally {
    if (generation === drainGeneration) {
      typingLineId.value = undefined
      draining = false
    }
  }
}

function completeTyping(lineId: string) {
  if (typingLineId.value !== lineId) {
    return
  }

  typingLineId.value = undefined
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
      visibleLines.value = acts.flatMap(registerLines)
      cursorLineId.value = undefined
      pendingLines.value = []
      knownActIds.clear()
      acts.forEach((act) => knownActIds.add(act.id))
      stopDrain()
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

    <div v-else-if="visibleLines.length > 0" class="surface-act-window">
      <TransitionGroup tag="ol" name="surface-act-row" class="surface-act-list">
        <li v-for="line in visibleLines" :key="line.id" class="surface-act-list-item">
          <SurfaceActLine
            :role="line.role"
            :text="line.text"
            :reducedMotion="reducedMotion"
            :typing-active="typingLineId === line.id"
            :cursor-visible="cursorLineId === line.id"
            @typing-complete="completeTyping(line.id)"
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
