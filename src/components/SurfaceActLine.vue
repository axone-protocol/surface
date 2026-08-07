<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'

import { shortenHash, shortenIdentifier } from '../lib/shorten'
import { surfaceActKindCategories, type SurfaceAct } from '../domain/surface-act'

const props = defineProps<{
  act: SurfaceAct
  reducedMotion: boolean
  typingActive: boolean
  cursorVisible: boolean
  explorer: string
}>()

const emit = defineEmits<{
  'typing-complete': []
}>()

const typedLength = ref(0)
let typingTimer: number | undefined
const transactionCopyState = ref<'idle' | 'copying' | 'copied'>('idle')
let copiedTimer: number | undefined
let isUnmounted = false

const assertionIdentifierPattern =
  /(did:pkh:…cosmos1[a-z0-9]+…[a-z0-9]{6}|[a-z][a-z\d+.-]*:[^\s.]+(?:\.[^\s.]+)*)/i
const technicalIdentifierPattern =
  /^(did:pkh:…cosmos1[a-z0-9]+…[a-z0-9]{6}|[a-z][a-z\d+.-]*:[^\s.]+(?:\.[^\s.]+)*)$/i

const typedAssertionParts = computed(() => {
  let remainingLength = typedLength.value

  return props.act.assertion.split(assertionIdentifierPattern).flatMap((value) => {
    const text = value.slice(0, remainingLength)
    remainingLength -= value.length

    return text ? [{ text, technical: technicalIdentifierPattern.test(value) }] : []
  })
})
const entryParts = computed(() => {
  const entry = props.act.entry ?? '—'
  const match = entry.match(/^(.*)(\.\d+\.\d+)$/)
  return match ? { prefix: match[1], suffix: match[2] } : { prefix: entry, suffix: '' }
})
const transactionExplorerUrl = computed(() => `${props.explorer}/tx/${props.act.txhash}`)

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

function clearCopiedTimer() {
  window.clearTimeout(copiedTimer)
  copiedTimer = undefined
}

async function copyTransactionHash() {
  if (transactionCopyState.value !== 'idle') {
    return
  }

  transactionCopyState.value = 'copying'

  try {
    await navigator.clipboard.writeText(props.act.txhash)
  } catch {
    if (!isUnmounted) {
      transactionCopyState.value = 'idle'
    }
    return
  }

  if (isUnmounted) {
    return
  }

  transactionCopyState.value = 'copied'
  copiedTimer = window.setTimeout(() => {
    copiedTimer = undefined
    transactionCopyState.value = 'idle'
  }, 1000)
}

function stopTyping() {
  window.clearInterval(typingTimer)
  typingTimer = undefined
}

function startTyping() {
  stopTyping()

  if (props.reducedMotion || !props.typingActive) {
    typedLength.value = props.act.assertion.length
    return
  }

  typedLength.value = 1
  typingTimer = window.setInterval(() => {
    if (typedLength.value >= props.act.assertion.length) {
      typedLength.value = props.act.assertion.length
      stopTyping()
      emit('typing-complete')
      return
    }

    const nextCharacter = props.act.assertion[typedLength.value] ?? ''
    typedLength.value = Math.min(
      props.act.assertion.length,
      typedLength.value + (nextCharacter === ' ' ? 2 : 1),
    )
  }, 16)
}

watch(
  () => [props.act.id, props.act.assertion, props.reducedMotion, props.typingActive] as const,
  () => {
    startTyping()
  },
  { immediate: true },
)

onBeforeUnmount(() => {
  stopTyping()
  isUnmounted = true
  clearCopiedTimer()
})
</script>

<template>
  <article class="surface-act-record">
    <div class="surface-act-entry">
      <p>{{ entryParts.prefix }}</p>
      <p v-if="entryParts.suffix" class="surface-act-entry-suffix">{{ entryParts.suffix }}</p>
    </div>

    <div class="surface-act-assertion">
      <p
        class="surface-act-category"
        :class="`surface-act-category--${surfaceActKindCategories[act.kind].toLowerCase()}`"
      >
        {{ surfaceActKindCategories[act.kind] }}
      </p>
      <p class="surface-act-inscription" :aria-label="act.assertion">
        <template v-for="(part, index) in typedAssertionParts" :key="index">
          <span v-if="part.technical" class="surface-act-identifier">{{ part.text }}</span>
          <template v-else>{{ part.text }}</template>
        </template>
        <span v-if="cursorVisible" class="surface-act-cursor" aria-hidden="true" />
      </p>
    </div>

    <dl class="surface-act-proof">
      <div class="surface-act-proof-row surface-act-tx-row">
        <dt>tx</dt>
        <dd class="surface-act-tx">
          <span class="surface-act-tx-value">{{ shortenHash(act.txhash) }}</span>
          <span class="surface-act-tx-action">
            <button
              v-if="transactionCopyState !== 'copied'"
              class="surface-act-tx-copy"
              type="button"
              :disabled="transactionCopyState === 'copying'"
              :aria-label="`Copy transaction hash ${act.txhash}`"
              @click="copyTransactionHash"
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
            <span v-else class="surface-act-tx-copied" role="status">
              <span class="surface-act-tx-copied-icon" aria-hidden="true">✓</span>
              <span class="surface-act-tx-copied-label">Copied</span>
            </span>
          </span>
        </dd>
      </div>
      <div>
        <dt>recorded</dt>
        <dd>{{ compactDate(act.timestamp) }}</dd>
      </div>
      <div v-if="act.kind === 'governance.decision.recorded' && act.payload.decision_id">
        <dt>decision</dt>
        <dd>n° {{ act.payload.decision_id }}</dd>
      </div>
      <div v-if="act.payload.constitution_revision && act.payload.constitution_hash">
        <dt>constitution</dt>
        <dd>
          r. {{ act.payload.constitution_revision }} ·
          {{ shortenHash(act.payload.constitution_hash) }}
        </dd>
      </div>
      <div
        v-if="
          (act.kind === 'credential.issued' || act.kind === 'credential.revoked') &&
          act.payload.identifier
        "
      >
        <dt>credential</dt>
        <dd>{{ shortenIdentifier(act.payload.identifier) }}</dd>
      </div>
      <div v-if="act.kind === 'governance.decision.recorded' && act.payload.verdict">
        <dt>verdict</dt>
        <dd>{{ act.payload.verdict }}</dd>
      </div>
    </dl>
    <a
      class="surface-act-explorer"
      :href="transactionExplorerUrl"
      :title="`View transaction ${act.txhash} in explorer`"
      :aria-label="`View transaction ${act.txhash} in explorer`"
      target="_blank"
      rel="noopener noreferrer"
    >
      <svg
        aria-hidden="true"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
      >
        <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
        <path d="M15 3h6v6" />
        <path d="M10 14 21 3" />
      </svg>
    </a>
  </article>
</template>
