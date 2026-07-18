<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'

import { surfaceActKindCategories, type SurfaceAct } from '../domain/surface-act'

const props = defineProps<{
  act: SurfaceAct
  reducedMotion: boolean
  typingActive: boolean
  cursorVisible: boolean
}>()

const emit = defineEmits<{
  'typing-complete': []
}>()

const typedLength = ref(0)
let typingTimer: number | undefined

const assertionIdentifierPattern = /(did:pkh:…cosmos1[a-z0-9]+…[a-z0-9]{6}|urn:[a-z0-9:-]+)/i
const technicalIdentifierPattern = /^(did:pkh:…cosmos1[a-z0-9]+…[a-z0-9]{6}|urn:[a-z0-9:-]+)$/i

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

function shortValue(value: string) {
  if (value.length <= 24) {
    return value
  }

  return `${value.slice(0, 12)}...${value.slice(-6)}`
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
})
</script>

<template>
  <article class="surface-act-record">
    <div class="surface-act-entry">
      <p>{{ entryParts.prefix }}</p>
      <p v-if="entryParts.suffix" class="surface-act-entry-suffix">{{ entryParts.suffix }}</p>
    </div>

    <div class="surface-act-assertion">
      <p class="surface-act-category">{{ surfaceActKindCategories[act.kind] }}</p>
      <p class="surface-act-inscription" :aria-label="act.assertion">
        <template v-for="(part, index) in typedAssertionParts" :key="index">
          <span v-if="part.technical" class="surface-act-identifier">{{ part.text }}</span>
          <template v-else>{{ part.text }}</template>
        </template>
        <span v-if="cursorVisible" class="surface-act-cursor" aria-hidden="true" />
      </p>
    </div>

    <dl class="surface-act-proof">
      <div>
        <dt>tx</dt>
        <dd>{{ shortValue(act.txhash) }}</dd>
      </div>
      <div>
        <dt>time</dt>
        <dd>{{ compactDate(act.timestamp) }}</dd>
      </div>
      <div v-if="act.kind === 'governance.decision.recorded' && act.payload.verdict">
        <dt>verdict</dt>
        <dd>{{ act.payload.verdict }}</dd>
      </div>
    </dl>
  </article>
</template>
