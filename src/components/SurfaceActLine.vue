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

const typedAssertion = computed(() => props.act.assertion.slice(0, typedLength.value))

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
    <div class="surface-act-assertion">
      <p class="surface-act-category">{{ surfaceActKindCategories[act.kind] }}</p>
      <p class="surface-act-inscription">
        {{ typedAssertion
        }}<span v-if="cursorVisible" class="surface-act-cursor" aria-hidden="true" />
      </p>
    </div>

    <dl class="surface-act-proof">
      <div>
        <dt>entry</dt>
        <dd>{{ act.entry ?? '—' }}</dd>
      </div>
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
